/**
 * Modern Hopfield retrieval (Ramsauer et al. 2020 — "Hopfield Networks is All You Need").
 *
 * The math
 * --------
 *   Given stored memory matrix  X ∈ ℝ^{N × d}  (N memories, d-dim embeddings)
 *   and query vector            ξ ∈ ℝ^d
 *
 *       ξ_new = X^⊤ · softmax( β · X · ξ )
 *
 *       weights[i] = softmax(β · ⟨x_i, ξ⟩)[i]
 *       blended    = Σ_i weights[i] · x_i
 *       energy     = -1/β · log Σ_i exp(β · ⟨x_i, ξ⟩) + ½‖ξ‖²
 *
 * Why this beats cosine k-NN
 * --------------------------
 *   1. Storage capacity ~ exp(d/2) instead of 0.14·d (classical Hopfield).
 *   2. Single-step convergence to the nearest pattern (no iterative search).
 *   3. Temperature β tunes precision vs. associative blend:
 *        β → ∞  : retrieval ≈ argmax k-NN
 *        β → 0  : retrieval ≈ centroid of nearby memories
 *   4. The `blended` vector is a free "expansion query" for a second
 *      retrieval pass (associative recall) — picks up wikilink-related
 *      memories that share semantic mass but lack lexical overlap.
 *
 * Use in AgentRecall
 * ------------------
 *   This module is a *pure scoring primitive*. It does not do I/O. Callers
 *   pass in already-loaded embeddings (e.g. from local-vector-store or
 *   Supabase pgvector). Typical wiring:
 *
 *     1. recall() runs BM25 + vector RRF → returns candidate set of K items
 *     2. Pull embeddings for those K items
 *     3. hopfieldRecall({query, memoryMatrix}) → returns soft re-rank weights
 *     4. Optionally pass `blended` back as a second-pass query for associative expansion
 *
 * Caveats
 * -------
 *   - Patterns must be L2-normalized for the capacity claim to hold.
 *   - Near-duplicate memories (cos > 0.95) produce blurry centroids ("spurious
 *     attractors"). Pre-dedup or raise β to mitigate.
 *   - The `energy` value is comparable only within a fixed (N, β); don't
 *     compare across different memory sets.
 */

export interface HopfieldRecallInput {
  /** Query vector — does not need to be normalized; we normalize internally. */
  query: number[];
  /** N stored memory vectors, each length d. Will be normalized internally. */
  memoryMatrix: number[][];
  /** Inverse temperature. Higher β = sharper retrieval. Default 8. */
  beta?: number;
  /**
   * Number of update steps. 1 is usually enough for well-separated patterns.
   * Set 2-3 only when patterns are dense (cos < 0.7 between nearest neighbors).
   */
  steps?: number;
  /**
   * Optional human-readable IDs aligned with memoryMatrix rows. Returned
   * with topIndices so callers don't have to re-map.
   */
  ids?: string[];
}

export interface HopfieldRecallResult {
  /** Softmax weights, length N, sums to 1. */
  weights: number[];
  /** Top indices by weight (descending). */
  topIndices: number[];
  /** Top ids (if provided in input), aligned with topIndices. */
  topIds?: string[];
  /** Weighted-sum vector — use as a synthetic expansion query. */
  blended: number[];
  /** Log-sum-exp energy. Lower = sharper match. */
  energy: number;
  /**
   * Retrieval status:
   *   sharp     — winner weight > 0.5
   *   blended   — top-2 weights within 2x of each other
   *   spurious  — entropy of weight distribution > log(N/2) (memory mass smeared)
   */
  status: "sharp" | "blended" | "spurious";
  /** Number of steps actually run. */
  steps_taken: number;
}

const DEFAULT_BETA = 8.0;
const DEFAULT_STEPS = 1;

/**
 * Validate that every value in a numeric vector is finite (no NaN, no ±Infinity).
 * Throws with a precise message including the offending position. Cheap (single pass).
 */
function assertFiniteVector(v: number[], label: string): void {
  for (let i = 0; i < v.length; i++) {
    if (!Number.isFinite(v[i])) {
      throw new Error(`hopfieldRecall: ${label}[${i}] is not finite (got ${v[i]})`);
    }
  }
}

function dot(a: number[], b: number[]): number {
  // Hard-fail on dim mismatch — silent truncation produced plausible-looking
  // but wrong rankings when callers accidentally mixed embedding-model versions.
  if (a.length !== b.length) {
    throw new Error(`hopfieldRecall: dimension mismatch (${a.length} vs ${b.length})`);
  }
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

function l2normalize(v: number[]): number[] {
  const n = norm(v);
  if (n === 0) return v.slice();
  const out = new Array<number>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

/**
 * Numerically-stable softmax + log-sum-exp.
 * Returns {weights, logSumExp} so callers can recover energy without recomputing.
 */
function softmaxStable(scores: number[]): { weights: number[]; logSumExp: number } {
  if (scores.length === 0) return { weights: [], logSumExp: -Infinity };
  let maxScore = -Infinity;
  for (const s of scores) if (s > maxScore) maxScore = s;
  const expScores = scores.map((s) => Math.exp(s - maxScore));
  let sum = 0;
  for (const e of expScores) sum += e;
  const weights = expScores.map((e) => e / sum);
  const logSumExp = maxScore + Math.log(sum);
  return { weights, logSumExp };
}

function entropy(weights: number[]): number {
  let h = 0;
  for (const w of weights) {
    if (w > 0) h -= w * Math.log(w);
  }
  return h;
}

function classifyStatus(weights: number[]): HopfieldRecallResult["status"] {
  if (weights.length === 0) return "spurious";
  // Defensive: any non-finite weight = garbage retrieval, mark spurious.
  for (const w of weights) {
    if (!Number.isFinite(w)) return "spurious";
  }
  const sorted = [...weights].sort((a, b) => b - a);
  if (sorted[0] > 0.5) return "sharp";
  const h = entropy(weights);
  const hThreshold = Math.log(Math.max(2, weights.length / 2));
  if (h > hThreshold) return "spurious";
  return "blended";
}

export function hopfieldRecall(input: HopfieldRecallInput): HopfieldRecallResult {
  const beta = input.beta ?? DEFAULT_BETA;
  // Input validation — fail loud rather than silently corrupting downstream consumers.
  if (!Number.isFinite(beta) || beta <= 0) {
    throw new Error(`hopfieldRecall: beta must be a finite positive number (got ${beta})`);
  }
  if (input.query.length === 0) {
    throw new Error("hopfieldRecall: query vector cannot be empty");
  }
  assertFiniteVector(input.query, "query");

  const steps = Math.max(1, input.steps ?? DEFAULT_STEPS);
  const N = input.memoryMatrix.length;
  if (N === 0) {
    return {
      weights: [],
      topIndices: [],
      topIds: input.ids ? [] : undefined,
      blended: input.query.slice(),
      energy: 0,
      status: "spurious",
      steps_taken: 0,
    };
  }
  // ids length must match memory matrix length when provided
  if (input.ids && input.ids.length !== N) {
    throw new Error(`hopfieldRecall: ids.length (${input.ids.length}) must equal memoryMatrix.length (${N})`);
  }
  const d = input.query.length;
  // Validate every memory vector before normalizing
  for (let i = 0; i < N; i++) {
    const row = input.memoryMatrix[i];
    if (row.length !== d) {
      throw new Error(`hopfieldRecall: memoryMatrix[${i}].length (${row.length}) must equal query.length (${d})`);
    }
    assertFiniteVector(row, `memoryMatrix[${i}]`);
  }
  // Normalize once — capacity & convergence assume unit vectors.
  const X = input.memoryMatrix.map((v) => l2normalize(v));
  let xi = l2normalize(input.query);

  let weights: number[] = new Array(N).fill(0);
  let logSumExp = 0;
  let stepsRun = 0;

  for (let step = 0; step < steps; step++) {
    // Scores = β · X · ξ
    const scores = new Array<number>(N);
    for (let i = 0; i < N; i++) scores[i] = beta * dot(X[i], xi);

    const sm = softmaxStable(scores);
    weights = sm.weights;
    logSumExp = sm.logSumExp;
    stepsRun++;

    // Blended = Σ w_i · x_i
    const blended = new Array<number>(d).fill(0);
    for (let i = 0; i < N; i++) {
      const w = weights[i];
      const xi_i = X[i];
      for (let j = 0; j < d; j++) blended[j] += w * xi_i[j];
    }
    xi = l2normalize(blended);
  }

  // Final blended (pre-normalized) for caller to use as expansion query
  const blendedRaw = new Array<number>(d).fill(0);
  for (let i = 0; i < N; i++) {
    const w = weights[i];
    const xi_i = X[i];
    for (let j = 0; j < d; j++) blendedRaw[j] += w * xi_i[j];
  }

  // Energy = -1/β · log Σ exp(β · ⟨x_i, ξ⟩) + ½‖ξ‖²
  // (ξ is the final iterate; ‖ξ‖² ≈ 1 since we re-normalize each step)
  const energy = -logSumExp / beta + 0.5 * dot(xi, xi);

  // Rank indices by weight desc
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => weights[b] - weights[a]);

  return {
    weights,
    topIndices: order,
    topIds: input.ids ? order.map((i) => input.ids![i]) : undefined,
    blended: blendedRaw,
    energy,
    status: classifyStatus(weights),
    steps_taken: stepsRun,
  };
}

/**
 * Convenience: rerank an existing candidate list (e.g. from RRF) using
 * Hopfield soft weights. Returns the input candidates in new order plus a
 * `score` field per candidate.
 */
export interface RerankInput<T> {
  query: number[];
  candidates: Array<T & { embedding: number[] }>;
  beta?: number;
  steps?: number;
}

export interface RerankItem<T> {
  item: T;
  score: number;
  rank: number;
}

export function hopfieldRerank<T>(input: RerankInput<T>): {
  items: Array<RerankItem<T>>;
  status: HopfieldRecallResult["status"];
  energy: number;
} {
  // Validate every candidate has a usable embedding before delegating.
  for (let i = 0; i < input.candidates.length; i++) {
    const cand = input.candidates[i];
    if (!cand || !Array.isArray(cand.embedding)) {
      throw new Error(`hopfieldRerank: candidates[${i}].embedding must be a number[]`);
    }
  }
  const matrix = input.candidates.map((c) => c.embedding);
  const result = hopfieldRecall({
    query: input.query,
    memoryMatrix: matrix,
    beta: input.beta,
    steps: input.steps,
  });
  const items: Array<RerankItem<T>> = result.topIndices.map((origIdx, newRank) => {
    const { embedding: _omit, ...rest } = input.candidates[origIdx] as { embedding: number[] } & Record<string, unknown>;
    return {
      item: rest as unknown as T,
      score: result.weights[origIdx],
      rank: newRank,
    };
  });
  return { items, status: result.status, energy: result.energy };
}
