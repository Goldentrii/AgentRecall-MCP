# Determinism Policy

Every `bench-result/v1` artifact is reproducible. Same `corpus_hash` + same `config`
must produce **byte-identical** `metrics` + `per_item` (after stripping
`generated_utc` and `environment`). Drift in those fields is a real behavior change
and must be intentional — carried in the same PR as a `--update-baselines` bump.

---

## Three Tiers

### Tier 0 — Required for any headline (fixture CI gate)

Pure-function scoring on recorded fields. Zero LLM, zero network, zero API key.

- Same `corpus_hash` + same `config` → byte-identical `metrics` + `per_item`.
- `Math.random` is **banned** in `scripts/eval/**`. Enforced in two layers:
  (1) a CI grep gate matching **invocation syntax** (`Math\.random\s*\(\s*\)`) — comment
  mentions of the name do not trigger it; (2) a runtime guard in `run-bench.mjs` that
  monkey-patches `Math.random` to throw `DETERMINISM VIOLATION`, catching aliased
  references (`arr.sort(Math.random)`) the static grep cannot see.
- The `NEG_PER_LEADIN` negative-pair sample uses a **deterministic stride**:
  `stride = Math.floor(unrelated.length / NEG_PER_LEADIN)`. No shuffle, no random.
- Fixture runs pin `TZ=UTC` (set by the CI workflow). Day bucketing via
  `new Date(ts).toLocaleDateString("sv")` is **TZ-sensitive** — a machine in a
  non-UTC zone produces different `YYYY-MM-DD` strings for timestamps near midnight.
  Fixture `_outcomes.jsonl` events are authored at `12:00Z` to make this a non-issue
  even if the TZ pin ever slips, but the pin is still required.
- `assertBlindCut` **THROWS** (never warns) on any blind-cut violation. A thrown
  assertion means the LOO filter leaked; the run halts rather than silently producing
  wrong results.

**CI gate (bench-fixture):** double-run byte-diff after stripping `generated_utc` and
`environment`. Any byte difference → fail.

### Tier 1 — Seeded PRNG (allowed, not yet used in v1)

When randomness is unavoidable (e.g. a future distractor sweep), use a seeded PRNG:

```js
// Allowed pattern — mulberry32, seed derived from corpus + benchmark version
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const seed = hashSeed(corpusHash + benchmarkVersion);
const rng = mulberry32(seed);
```

`Math.random` is still banned even in Tier-1 code — use `rng()` from the seeded
instance.

### Tier 2 — LLM judge (deferred, not in v1 CI)

For the live tier only. Requirements before any Tier-2 metric appears in a result:

- Pinned judge snapshot ID and temperature 0.
- `judge_prompt_hash` recorded in the artifact.
- Per-item judge verdicts persisted (analogous to LongMemEval's `autoeval_label`).
- Dual judge + Cohen's κ ≥ 0.7 before publishing.
- Judged metrics in a **separate block**, never merged into Tier-0 fields.

Tier-2 metrics are explicitly **not gated in CI** — they are observations, not
assertions.

---

## TZ Policy

The harness sets `TZ=UTC` for all fixture runs. Fixture `_outcomes.jsonl` events are
authored at `12:00Z` so day bucketing (`toLocaleDateString("sv")`) is unambiguous on
any machine even if the TZ pin slips. Real-corpus artifacts record the ambient TZ in
the `environment.tz` field and are treated as observations — they are **not** compared
byte-for-byte across machines.

---

## Math.random Ban

`Math.random` is categorically banned in `scripts/eval/**`.

- CI gate (invocation-syntax match):
  `grep -rnE 'Math\.random\s*\(\s*\)' scripts/eval && exit 1`
  Doc-comment mentions of the name and the deliberate runtime-guard monkey-patch in
  `run-bench.mjs` (`Math.random = () => { throw ... }`) are allowed and do not
  trigger. No exclusion pipe — a comment on a violating line cannot evade the gate.
- Runtime guard (second layer): `run-bench.mjs` replaces `Math.random` with a
  function that throws `DETERMINISM VIOLATION`, so aliased references
  (`arr.sort(Math.random)`, `const r = Math.random; r()`) fail loudly at run time
  even though the static grep cannot distinguish them from prose mentions.
- Code review must reject any PR that introduces a `Math.random` call in that tree,
  even "temporarily."
- If a seeded random source is needed, add a Tier-1 mulberry32 helper and use it
  with a corpus-derived seed.

---

## Error-Path Contract

The determinism guarantee extends to error paths:

- `assertBlindCut` throws; it does not warn and continue. A warning-only path would
  silently produce wrong results.
- A record excluded by the count rule (§2.2) is listed in `excluded[]` with its
  reason and is never treated as a counted record in any denominator.
- `redaction_survived: false` records are counted in `corpus.n_counted` but excluded
  from `predictions_fired` — they receive an honest null, never a free hit.
- `precision: null` when `den == 0` — the literal string
  `"n/a (uncomputable — 0 in denominator)"` is the `note` field value, never `0`.
