#!/usr/bin/env node
/**
 * failure-class-eval.mjs — Phase-0 acceptance runner for the recurrence-detector
 * work-packet (docs/proposals/2026-07-13-recurrence-detector-workpacket.md).
 *
 * EVAL-SIDE ONLY — production code untouched. predict-loo.mjs is NOT modified:
 * the corpus-wide numbers use its exported runLooEval() with the hypothesis
 * matcher injected through the existing `opts.matchFn` hook (lines 191–194).
 * The pair-level and held-out harnesses need predict-loo's PRIVATE helpers
 * (redactLeadIn / clusterSignature / predictBlind anchoring); those are
 * MIRRORED here verbatim rather than exported (mirror-fidelity beats touching
 * the zero-regression surface).
 *
 * What it reports (the work-packet "Eval + Acceptance Criteria" contract):
 *
 *  GATE 1 — HELD-IN
 *    1a. recurrence recall on the 5 hand-labeled cross-project pairs ≥ 50%
 *        (baseline 0%), measured on the LOO/matchFn surface: blind profile
 *        from ALL projects' ACTIVE corrections dated ≤ t (same-project < t),
 *        REDACTED lead-in, fire via failureClassMatchFn, detection = a fired
 *        risk anchors to a hand-labeled cross-project sibling.
 *    1b. corpus-wide precision not lower than baseline and FFR
 *        (negFires/negTrials) not increased — runLooEval baseline (keyword)
 *        vs runLooEval with the ADDITIVE union matcher injected (models the
 *        production proposal: existing loop unchanged + secondary class join).
 *
 *  GATE 2 — HELD-OUT (time split at 2026-06-01)
 *    train = active ≤ 2026-05-31, test = active ≥ 2026-06-01.
 *    ≥ 1 confirmed cross-project recurrence detection on test lead-ins against
 *    train-derived profiles, AND 0 false positives on the NEG_PER_LEADIN=5
 *    stride-sampled negative pairs (mirrors predict-loo's FP instrument).
 *
 *  GATE 3 — ZERO-REGRESSION is run separately: `npm run bench` (fixture
 *    exact-match gate + claim-gates table incl. memory_beats_baseline).
 *    This runner never imports into, nor is imported by, the bench pipeline.
 *
 *  SUPPLEMENTARY (not gated, for the verdict): the capture-time surface —
 *  record-to-record class join on RECORDED fields (rule available at capture,
 *  exactly what the proposed session-end secondary loop sees), reported on the
 *  same 5 pairs plus the full cross-project join-edge table for FP eyeballing.
 *
 * Honesty invariants preserved from predict-loo:
 *  - C.rule is never fed to the matcher on the LOO surface (redacted lead-in).
 *  - Blind cut: same-project priors strictly < t; cross-project priors ≤ t
 *    (day-resolution dates make same-day cross-project order unknowable; the
 *    production session-end join of the later session sees the earlier record,
 *    so ≤ is the faithful convention — flagged per-direction in the output).
 *  - HIT/confirmation judged on RECORDED fields (anchor identity), never on
 *    the lead-in text the matcher saw.
 *  - deriveBlindSpots drops active===false internally; prior pools passed here
 *    are active-only to also keep the ANCHOR universe production-faithful.
 *
 * Usage:
 *   node scripts/eval/failure-class-eval.mjs            # human report
 *   node scripts/eval/failure-class-eval.mjs --json     # machine-readable
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import {
  deriveBlindSpots,
  matchesBlindSpot,
  BLIND_SPOT_SEMANTIC_THRESHOLD,
} from "../../packages/core/dist/helpers/blind-spots.js";
import { tokenize, overlap } from "../../packages/core/dist/tools-logic/check-action.js";
import { runLooEval } from "./predict-loo.mjs";
import {
  failureClassMatchFn,
  makeUnionMatchFn,
  classifyCorrection,
  classifyBlindSpot,
  MIN_OVERLAP,
} from "./failure-class-matchfn.mjs";

const MAX_RISKS = 3; // mirrors predict-loo / predict-correction.ts
const NEG_PER_LEADIN = 5; // mirrors predict-loo's FP instrument
const SPLIT_TRAIN_MAX = "2026-05-31";
const SPLIT_TEST_MIN = "2026-06-01";

// ───────────────────────────────────────────────────────────────────────────
// Ground truth — hand-labeled cross-project pairs (owner labels 2026-07-13/14)
// ───────────────────────────────────────────────────────────────────────────

const GROUND_TRUTH = [
  {
    pair: "framing_error",
    failure_class: "framing_error",
    members: [
      { project: "aam", id: "2026-05-06-don-t-map-to-human-memory" },
      { project: "AgentRecall", id: "2026-05-06-don-t-map-to-human-memory-it-w" },
    ],
  },
  {
    pair: "naming_violation/wrong-repo",
    failure_class: "naming_violation",
    members: [
      { project: "prismma-web", id: "2026-05-20-wrong-repo" },
      { project: "eu-ai-gateway", id: "2026-05-20-wrong-repo" },
    ],
  },
  {
    pair: "naming_violation/correct-repo",
    failure_class: "naming_violation",
    members: [
      { project: "prismma-web", id: "2026-05-27-correct-repo-is-novadalabs-pri" },
      { project: "eu-ai-gateway", id: "2026-05-27-correct-repo-is-novadalabs-pri" },
    ],
  },
  {
    pair: "model_dispatch",
    failure_class: "model_dispatch",
    members: [
      { project: "novada-proxy", id: "2026-05-04-opus-must-not-do-coding-via-so" },
      { project: "aam", id: "2026-05-11-confirmed-user-also-corrected-" },
      { project: "AgentRecall", id: "2026-07-04-never-dispatch-sub-agents-on-f" },
    ],
  },
  {
    pair: "confidential_leak",
    failure_class: "confidential_leak",
    members: [
      { project: "prismma-web", id: "2026-06-02-never-reveal-our-margin-cost-b" },
      { project: "prismma-web", id: "2026-06-15-do-not-put-api-key-secrets-in-" },
      { project: "skaylink-aws", id: "2026-06-26-excel-must-show-only-what-artu" },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Corpus loading (same reader semantics as predict-loo, plus project stamp)
// ───────────────────────────────────────────────────────────────────────────

function defaultRoot() {
  return process.env.AGENT_RECALL_ROOT || path.join(os.homedir(), ".agent-recall");
}

function loadCorpus(root) {
  const base = path.join(root, "projects");
  const out = [];
  if (!fs.existsSync(base)) return out;
  for (const project of fs.readdirSync(base).sort()) {
    const dir = path.join(base, project, "corrections");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
        if (rec && rec.rule && rec.date) {
          rec._project = project; // eval-side stamp; ignored by deriveBlindSpots
          out.push(rec);
        }
      } catch {
        /* skip malformed */
      }
    }
  }
  // Deterministic global order so deriveBlindSpots clustering is stable.
  out.sort((a, b) =>
    a.date === b.date
      ? a._project === b._project
        ? (a.id ?? "").localeCompare(b.id ?? "")
        : a._project.localeCompare(b._project)
      : a.date < b.date
        ? -1
        : 1,
  );
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// MIRRORS of predict-loo private helpers (verbatim semantics; not exported there)
// ───────────────────────────────────────────────────────────────────────────

function tokenSet(s) {
  return tokenize(s || "");
}

/** Mirror of predict-loo redactLeadIn — C.context minus the rule text. */
function redactLeadIn(c) {
  const rule = (c.rule || "").trim();
  let ctx = (c.context || "").trim();
  if (!ctx) return "";
  if (rule) {
    const idx = ctx.toLowerCase().indexOf(rule.toLowerCase());
    if (idx >= 0) ctx = (ctx.slice(0, idx) + " " + ctx.slice(idx + rule.length)).trim();
  }
  const ruleTokens = tokenSet(rule);
  const kept = [];
  for (const sentence of ctx.split(/(?<=[.!?])\s+/)) {
    const st = tokenSet(sentence);
    if (st.size === 0) continue;
    let subset = true;
    for (const t of st) {
      if (!ruleTokens.has(t)) {
        subset = false;
        break;
      }
    }
    if (!subset) kept.push(sentence.trim());
  }
  return kept.join(" ").trim();
}

/** Mirror of predict-loo clusterSignature — recorded rule + tags tokens. */
function clusterSignature(c) {
  return tokenize(`${c.rule || ""} ${(c.tags || []).join(" ")}`);
}

function sigOverlap(a, b) {
  return overlap(a, b).length;
}

/**
 * Mirror of predict-loo predictBlind with an explicit matcher: fire per blind
 * spot via matchFn, anchor each fired risk to the prior correction whose
 * recorded signature best overlaps the blind spot's triggers+tendency tokens.
 */
function predictBlindMirror(leadIn, profile, priorCorrs, matchFn) {
  const planTokens = tokenize(leadIn);
  if (planTokens.size === 0 || !profile.blind_spots.length) return [];
  const risks = [];
  for (const bs of profile.blind_spots) {
    const m = matchFn(leadIn, bs);
    if (!m.fired) continue;
    const triggerSet = new Set((bs.trigger_keywords ?? []).map((k) => k.toLowerCase()));
    const bsSig = new Set([...triggerSet, ...tokenize(bs.tendency || "")]);
    let anchor;
    let best = 0;
    for (const pc of priorCorrs) {
      const n = sigOverlap(clusterSignature(pc), bsSig);
      if (n >= 1 && n > best) {
        best = n;
        anchor = pc;
      }
    }
    const baseMatch =
      m.via === "keyword" ? m.matched.length : MIN_OVERLAP * (m.semanticScore ?? 0);
    risks.push({
      tendency: bs.tendency,
      severity: bs.severity,
      via: m.via,
      matched: m.matched,
      score: baseMatch * (bs.severity === "p0" ? 1.5 : 1),
      anchor,
    });
  }
  risks.sort((a, b) => b.score - a.score);
  return risks.slice(0, MAX_RISKS);
}

// ───────────────────────────────────────────────────────────────────────────
// Held-in 1a — pair recall on the LOO/matchFn surface
// ───────────────────────────────────────────────────────────────────────────

function isMember(group, rec) {
  return group.members.some((m) => m.project === rec._project && m.id === rec.id);
}

function crossProjectSiblings(group, rec) {
  return group.members.filter((m) => m.project !== rec._project);
}

/**
 * For each hand-labeled group, evaluate EVERY member as the "new violation" C:
 * blind profile from active corrections of OTHER projects dated ≤ C.date plus
 * SAME project dated < C.date (strict LOO within-project), C itself excluded.
 * Detection = any of the ≤MAX_RISKS fired risks anchors to a cross-project
 * member of the same group (top-1-only also reported).
 */
function runPairHarness(corpus, matcherName, matchFn) {
  const active = corpus.filter((c) => c.active !== false);
  const byKey = new Map(active.map((c) => [`${c._project}/${c.id}`, c]));
  const groups = [];

  for (const group of GROUND_TRUTH) {
    const directions = [];
    for (const member of group.members) {
      const c = byKey.get(`${member.project}/${member.id}`);
      if (!c) {
        directions.push({
          as_c: `${member.project}/${member.id}`,
          skipped: "record retracted or missing — excluded from the active-only universe",
        });
        continue;
      }
      const siblings = crossProjectSiblings(group, c).map((m) => `${m.project}/${m.id}`);
      const priors = active
        .filter(
          (pc) =>
            !(pc._project === c._project && pc.id === c.id) &&
            (pc._project === c._project ? pc.date < c.date : pc.date <= c.date),
        );
      const leadIn = redactLeadIn(c);
      if (!leadIn) {
        directions.push({ as_c: `${c._project}/${c.id}`, skipped: "no usable redacted lead-in" });
        continue;
      }
      const profile = deriveBlindSpots(priors, []);
      const risks = predictBlindMirror(leadIn, profile, priors, matchFn);
      const anchorsOf = (rs) =>
        rs
          .filter((r) => r.anchor)
          .map((r) => ({
            anchor: `${r.anchor._project}/${r.anchor.id}`,
            via: r.via,
            matched: r.matched,
            score: Number(r.score.toFixed(2)),
          }));
      const confirmedAny = risks.some(
        (r) => r.anchor && siblings.includes(`${r.anchor._project}/${r.anchor.id}`),
      );
      const confirmedTop =
        risks.length > 0 &&
        risks[0].anchor &&
        siblings.includes(`${risks[0].anchor._project}/${risks[0].anchor.id}`);
      directions.push({
        as_c: `${c._project}/${c.id}`,
        same_date_cross_prior: group.members.some(
          (m) => m.project !== c._project && byKey.get(`${m.project}/${m.id}`)?.date === c.date,
        ),
        lead_in: leadIn.length > 120 ? leadIn.slice(0, 117) + "…" : leadIn,
        fired: risks.length,
        risks: anchorsOf(risks),
        confirmed_top1: !!confirmedTop,
        confirmed_any_top3: !!confirmedAny,
      });
    }
    const detected = directions.some((d) => d.confirmed_any_top3);
    const detectedTop1 = directions.some((d) => d.confirmed_top1);
    groups.push({
      pair: group.pair,
      failure_class: group.failure_class,
      detected,
      detected_top1: detectedTop1,
      directions,
    });
  }

  const detected = groups.filter((g) => g.detected).length;
  return {
    matcher: matcherName,
    pairs: GROUND_TRUTH.length,
    detected,
    detected_top1: groups.filter((g) => g.detected_top1).length,
    recall: detected / GROUND_TRUTH.length,
    groups,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Supplementary — capture-time surface (record-to-record class join)
// ───────────────────────────────────────────────────────────────────────────

/**
 * The proposed session-end secondary loop sees the NEW correction's recorded
 * fields (rule is available at capture). Join: class equality (both != other)
 * AND clusterSignature overlap ≥ 1, across projects.
 */
function runCaptureSurface(corpus, { activeOnly }) {
  const universe = activeOnly ? corpus.filter((c) => c.active !== false) : corpus;
  const classified = universe.map((c) => ({
    c,
    cls: classifyCorrection(c).failure_class,
    sig: clusterSignature(c),
  }));

  // All cross-project join edges (for FP eyeballing).
  const edges = [];
  for (let i = 0; i < classified.length; i++) {
    for (let j = i + 1; j < classified.length; j++) {
      const A = classified[i];
      const B = classified[j];
      if (A.c._project === B.c._project) continue;
      if (A.cls === "other" || A.cls !== B.cls) continue;
      const shared = overlap(A.sig, B.sig);
      if (shared.length < 1) continue;
      const inSameGroup = GROUND_TRUTH.some((g) => isMember(g, A.c) && isMember(g, B.c));
      edges.push({
        failure_class: A.cls,
        a: `${A.c._project}/${A.c.id}`,
        b: `${B.c._project}/${B.c.id}`,
        sig_overlap: shared.slice(0, 6),
        hand_labeled: inSameGroup,
      });
    }
  }

  // Pair recall on this surface.
  const groups = GROUND_TRUTH.map((g) => {
    const detected = edges.some(
      (e) =>
        e.hand_labeled &&
        g.members.some((m) => `${m.project}/${m.id}` === e.a) &&
        g.members.some((m) => `${m.project}/${m.id}` === e.b),
    );
    return { pair: g.pair, detected };
  });
  const detected = groups.filter((g) => g.detected).length;
  return {
    universe: activeOnly ? "active-only (production scan semantics)" : "as-captured (retracted included)",
    pairs: GROUND_TRUTH.length,
    detected,
    recall: detected / GROUND_TRUTH.length,
    groups,
    join_edges: edges,
    unlabeled_edges: edges.filter((e) => !e.hand_labeled).length,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Gate 2 — held-out time split
// ───────────────────────────────────────────────────────────────────────────

function runHeldOut(corpus) {
  const active = corpus.filter((c) => c.active !== false);
  const train = active.filter((c) => c.date <= SPLIT_TRAIN_MAX);
  const test = active.filter((c) => c.date >= SPLIT_TEST_MIN);

  const profile = deriveBlindSpots(train, []);

  const detections = [];
  let usableLeadIns = 0;
  for (const c of test) {
    const leadIn = redactLeadIn(c);
    if (!leadIn) continue;
    usableLeadIns += 1;
    const risks = predictBlindMirror(leadIn, profile, train, failureClassMatchFn);
    for (const r of risks) {
      if (!r.anchor) continue;
      if (r.anchor._project === c._project) continue; // cross-project only
      const group = GROUND_TRUTH.find((g) => isMember(g, c) && isMember(g, r.anchor));
      detections.push({
        test_c: `${c._project}/${c.id}`,
        test_date: c.date,
        anchor: `${r.anchor._project}/${r.anchor.id}`,
        anchor_date: r.anchor.date,
        via: r.via,
        matched: r.matched,
        confirmed: !!group,
        pair: group?.pair ?? null,
      });
    }
  }

  // Stride-sampled negative pairs — mirror of predict-loo's FP instrument,
  // negatives drawn from TRAIN (the only knowledge the detector may have).
  let negTrials = 0;
  let negFires = 0;
  let negTrialsKeyword = 0;
  let negFiresKeyword = 0;
  const negFireDetails = [];
  const keywordFn = (leadIn, bs) =>
    matchesBlindSpot(leadIn, bs, MIN_OVERLAP, Number.POSITIVE_INFINITY);
  for (const c of test) {
    const leadIn = redactLeadIn(c);
    if (!leadIn) continue;
    const cSig = clusterSignature(c);
    const unrelated = train.filter(
      (other) =>
        !(other._project === c._project && other.id === c.id) &&
        sigOverlap(clusterSignature(other), cSig) === 0,
    );
    if (unrelated.length === 0) continue;
    const stride = Math.max(1, Math.floor(unrelated.length / NEG_PER_LEADIN));
    for (let i = 0, taken = 0; i < unrelated.length && taken < NEG_PER_LEADIN; i += stride, taken++) {
      const negProfile = deriveBlindSpots([unrelated[i]], []);
      if (negProfile.blind_spots.length === 0) continue;
      negTrials += 1;
      const negRisks = predictBlindMirror(leadIn, negProfile, [unrelated[i]], failureClassMatchFn);
      if (negRisks.length > 0) {
        negFires += 1;
        negFireDetails.push({
          test_c: `${c._project}/${c.id}`,
          neg: `${unrelated[i]._project}/${unrelated[i].id}`,
          matched: negRisks[0].matched,
        });
      }
      negTrialsKeyword += 1;
      const kwRisks = predictBlindMirror(leadIn, negProfile, [unrelated[i]], keywordFn);
      if (kwRisks.length > 0) negFiresKeyword += 1;
    }
  }

  const confirmed = detections.filter((d) => d.confirmed);
  return {
    split: { train_max: SPLIT_TRAIN_MAX, test_min: SPLIT_TEST_MIN },
    train_records: train.length,
    test_records: test.length,
    test_usable_leadins: usableLeadIns,
    detections,
    confirmed_cross_project: confirmed.length,
    confirmed_list: confirmed,
    unconfirmed_cross_project: detections.length - confirmed.length,
    neg_trials: negTrials,
    neg_fires: negFires,
    neg_fire_details: negFireDetails,
    keyword_baseline_neg: { neg_trials: negTrialsKeyword, neg_fires: negFiresKeyword },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

function pct(x) {
  return x === null || x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`;
}

function main() {
  const asJson = process.argv.includes("--json");
  const root = defaultRoot();
  const corpus = loadCorpus(root);
  const activeCount = corpus.filter((c) => c.active !== false).length;

  // ── Gate 1a: pair recall, LOO/matchFn surface, three matchers ──
  const pairClass = runPairHarness(corpus, "failure_class", failureClassMatchFn);
  const pairKeyword = runPairHarness(corpus, "keyword-baseline", (l, b) =>
    matchesBlindSpot(l, b, MIN_OVERLAP, Number.POSITIVE_INFINITY),
  );
  const pairSemantic = runPairHarness(corpus, "semantic-baseline@0.20", (l, b) =>
    matchesBlindSpot(l, b, MIN_OVERLAP, BLIND_SPOT_SEMANTIC_THRESHOLD),
  );

  // ── Gate 1b: corpus-wide runLooEval — baseline vs injected ──
  const looBaseline = runLooEval(root, {}); // byte-identical keyword path
  const looUnion = runLooEval(root, { matchFn: makeUnionMatchFn() });
  const looPure = runLooEval(root, { matchFn: failureClassMatchFn });

  // ── Supplementary: capture-time surface ──
  const captureActive = runCaptureSurface(corpus, { activeOnly: true });
  const captureAll = runCaptureSurface(corpus, { activeOnly: false });

  // ── Gate 2: held-out ──
  const heldOut = runHeldOut(corpus);

  // ── Gate evaluation ──
  const g1aPass = pairClass.recall >= 0.5;
  const precBase = looBaseline.precision;
  const precUnion = looUnion.precision;
  const g1bPrecisionPass =
    precBase === null ? true : precUnion !== null && precUnion >= precBase - 1e-12;
  const ffrBase = looBaseline.false_positive_rate ?? 0;
  const ffrUnion = looUnion.false_positive_rate ?? 0;
  const g1bFfrPass = ffrUnion <= ffrBase + 1e-12;
  const g2Pass = heldOut.confirmed_cross_project >= 1 && heldOut.neg_fires === 0;

  const report = {
    generated_at: new Date().toISOString(),
    root,
    corpus: { records: corpus.length, active: activeCount },
    gate1a_heldin_pair_recall: {
      gate: "recall on 5 hand-labeled cross-project pairs ≥ 50% (baseline 0%)",
      failure_class: {
        detected: pairClass.detected,
        pairs: pairClass.pairs,
        recall: pairClass.recall,
        detected_top1: pairClass.detected_top1,
      },
      keyword_baseline: { detected: pairKeyword.detected, recall: pairKeyword.recall },
      semantic_baseline: { detected: pairSemantic.detected, recall: pairSemantic.recall },
      pass: g1aPass,
      detail: pairClass.groups,
    },
    gate1b_heldin_corpuswide: {
      gate: "precision not lower than baseline; FFR not increased (runLooEval, matchFn injected)",
      baseline_keyword: {
        fired: looBaseline.predictions_fired,
        hits: looBaseline.hits,
        precision: looBaseline.precision,
        recall_active: looBaseline.recall_active,
        ffr: looBaseline.false_positive_rate,
        neg: `${looBaseline.neg_fires}/${looBaseline.neg_trials}`,
      },
      injected_union: {
        fired: looUnion.predictions_fired,
        hits: looUnion.hits,
        precision: looUnion.precision,
        recall_active: looUnion.recall_active,
        ffr: looUnion.false_positive_rate,
        neg: `${looUnion.neg_fires}/${looUnion.neg_trials}`,
      },
      injected_pure_class: {
        fired: looPure.predictions_fired,
        hits: looPure.hits,
        precision: looPure.precision,
        recall_active: looPure.recall_active,
        ffr: looPure.false_positive_rate,
        neg: `${looPure.neg_fires}/${looPure.neg_trials}`,
      },
      precision_pass: g1bPrecisionPass,
      ffr_pass: g1bFfrPass,
    },
    gate2_heldout: {
      gate: "≥1 confirmed cross-project recurrence AND 0 stride-sample false positives",
      ...heldOut,
      pass: g2Pass,
    },
    supplementary_capture_surface: {
      note: "record-to-record class join on recorded fields — what the proposed session-end secondary loop actually sees (rule available at capture). Not gated; evidence for the verdict.",
      active_only: {
        detected: captureActive.detected,
        pairs: captureActive.pairs,
        recall: captureActive.recall,
        groups: captureActive.groups,
        unlabeled_edges: captureActive.unlabeled_edges,
        join_edges: captureActive.join_edges,
      },
      as_captured: {
        detected: captureAll.detected,
        pairs: captureAll.pairs,
        recall: captureAll.recall,
        unlabeled_edges: captureAll.unlabeled_edges,
      },
    },
    gates_summary: {
      "held-in pair recall ≥50% (matchFn surface)": g1aPass ? "PASS" : "FAIL",
      "held-in precision not lower": g1bPrecisionPass ? "PASS" : "FAIL",
      "held-in FFR not increased": g1bFfrPass ? "PASS" : "FAIL",
      "held-out ≥1 confirmed + 0 stride FPs": g2Pass ? "PASS" : "FAIL",
    },
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  const L = [];
  L.push("══════════════════════════════════════════════════════════════════");
  L.push("  failure_class hypothesis — Phase-0 acceptance run (eval-side only)");
  L.push(`  corpus ${root} — records=${corpus.length} active=${activeCount}`);
  L.push("══════════════════════════════════════════════════════════════════");
  L.push("");
  L.push("── GATE 1a · held-in pair recall (LOO/matchFn surface, redacted lead-ins) ──");
  L.push(
    `  failure_class matcher : ${pairClass.detected}/${pairClass.pairs} pairs = ${pct(pairClass.recall)}  (top-1-only: ${pairClass.detected_top1}/${pairClass.pairs})`,
  );
  L.push(`  keyword baseline      : ${pairKeyword.detected}/${pairKeyword.pairs} = ${pct(pairKeyword.recall)}`);
  L.push(`  semantic@0.20 baseline: ${pairSemantic.detected}/${pairSemantic.pairs} = ${pct(pairSemantic.recall)}`);
  L.push(`  GATE (≥50%): ${g1aPass ? "PASS" : "FAIL"}`);
  for (const g of pairClass.groups) {
    L.push(`   · ${g.detected ? "✓" : "✗"} ${g.pair}`);
    for (const d of g.directions) {
      if (d.skipped) {
        L.push(`       - C=${d.as_c}: SKIPPED (${d.skipped})`);
      } else {
        const top = d.risks[0];
        L.push(
          `       - C=${d.as_c}${d.same_date_cross_prior ? " [same-date ≤ convention]" : ""}: fired=${d.fired}${top ? ` top→${top.anchor} via=${top.via} matched=[${top.matched.join(",")}]` : ""} confirmed=${d.confirmed_any_top3}`,
        );
      }
    }
  }
  L.push("");
  L.push("── GATE 1b · held-in corpus-wide (runLooEval via opts.matchFn injection) ──");
  const row = (name, r) =>
    `  ${name.padEnd(22)} fired=${r.predictions_fired}  hits=${r.hits}  precision=${pct(r.precision)}  recall*=${pct(r.recall_active)}  FFR=${pct(r.false_positive_rate)} (${r.neg_fires}/${r.neg_trials})`;
  L.push(row("keyword baseline", looBaseline));
  L.push(row("union (kw ∨ class)", looUnion));
  L.push(row("pure failure_class", looPure));
  L.push(`  GATE precision not lower: ${g1bPrecisionPass ? "PASS" : "FAIL"} (${pct(precBase)} → ${pct(precUnion)})`);
  L.push(`  GATE FFR not increased  : ${g1bFfrPass ? "PASS" : "FAIL"} (${pct(ffrBase)} → ${pct(ffrUnion)})`);
  L.push("");
  L.push(`── GATE 2 · held-out time split (train ≤ ${SPLIT_TRAIN_MAX}, test ≥ ${SPLIT_TEST_MIN}) ──`);
  L.push(
    `  train=${heldOut.train_records} active records → profile; test=${heldOut.test_records} (usable lead-ins=${heldOut.test_usable_leadins})`,
  );
  L.push(
    `  cross-project detections: confirmed=${heldOut.confirmed_cross_project} unconfirmed=${heldOut.unconfirmed_cross_project}`,
  );
  for (const d of heldOut.detections) {
    L.push(
      `   · ${d.confirmed ? "✓ CONFIRMED" : "? unlabeled"} ${d.test_c} (${d.test_date}) → anchor ${d.anchor} (${d.anchor_date}) matched=[${d.matched.join(",")}]${d.pair ? ` pair=${d.pair}` : ""}`,
    );
  }
  L.push(
    `  stride negatives (NEG_PER_LEADIN=${NEG_PER_LEADIN}): class fires=${heldOut.neg_fires}/${heldOut.neg_trials}  (keyword baseline on same trials: ${heldOut.keyword_baseline_neg.neg_fires}/${heldOut.keyword_baseline_neg.neg_trials})`,
  );
  for (const nf of heldOut.neg_fire_details) {
    L.push(`   · NEG-FIRE ${nf.test_c} vs ${nf.neg} matched=[${nf.matched.join(",")}]`);
  }
  L.push(`  GATE (≥1 confirmed AND 0 stride FPs): ${g2Pass ? "PASS" : "FAIL"}`);
  L.push("");
  L.push("── SUPPLEMENTARY · capture-time surface (record-to-record class join) ──");
  L.push(
    `  active-only universe : ${captureActive.detected}/${captureActive.pairs} pairs = ${pct(captureActive.recall)}  (unlabeled cross-project join edges: ${captureActive.unlabeled_edges})`,
  );
  for (const g of captureActive.groups) L.push(`   · ${g.detected ? "✓" : "✗"} ${g.pair}`);
  for (const e of captureActive.join_edges) {
    L.push(
      `   edge[${e.hand_labeled ? "labeled" : "UNLABELED"}] ${e.failure_class}: ${e.a} ↔ ${e.b} sig∩=[${e.sig_overlap.join(",")}]`,
    );
  }
  L.push(
    `  as-captured universe : ${captureAll.detected}/${captureAll.pairs} pairs = ${pct(captureAll.recall)} (retracted included — shows the class key works where records were live at capture time)`,
  );
  L.push("");
  L.push("── GATES SUMMARY ──");
  for (const [k, v] of Object.entries(report.gates_summary)) L.push(`  ${v.padEnd(4)} ${k}`);
  L.push("  (Gate 3 zero-regression runs separately: npm run bench — fixture exact-match + claim-gates.)");
  L.push("══════════════════════════════════════════════════════════════════");
  process.stdout.write(L.join("\n") + "\n");
}

main();
