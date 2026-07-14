#!/usr/bin/env node
/**
 * failure-class-matchfn.mjs — Phase-0 eval artifact for the recurrence-detector
 * work-packet (docs/proposals/2026-07-13-recurrence-detector-workpacket.md §3).
 *
 * EVAL-SIDE ONLY. Production code (packages/core/src) is untouched; a parallel
 * worker owns the capture-time classifier there. This module is a SELF-CONTAINED
 * mirror of the proposed `failure_class` semantics so the hypothesis can be
 * tested on the existing corpus via the `opts.matchFn` injection hook in
 * predict-loo.mjs (lines 191–194) — "without touching production code".
 *
 * Hypothesis under test (work-packet §"Bounded Change Proposal"):
 *   fire iff derived-or-stored failure_class equality (both != "other")
 *   AND token overlap ≥ 1 (relaxed from MIN_OVERLAP=2 because the class key
 *   narrows candidates).
 *
 * Enum: 9 values — the work-packet's 7 + `naming_violation` split out of
 * `scope_violation`/`wrong_ref` per owner Open Question #1 (hand-labels
 * 2026-07-13/14 treat the "Wrong repo"/"Correct repo is NovadaLabs/prismma"
 * pairs as naming_violation), + `other`.
 *
 * Classifier: keyword-set argmax over the SHARED production tokenizer
 * (`tokenize` from check-action.js dist — no fork, no new deps, no ML).
 * Zero hits or a tie → "other" (fail-closed). Keyword sets are written from
 * the work-packet's cluster SEMANTICS, frozen before any eval run:
 *   D model_dispatch     — wrong model / execution routing
 *   E framing_error      — wrong conceptual frame
 *   F confidential_leak  — internal info exposure
 *   C scope_violation    — wrong project / session scope
 *   H publish_gate       — push/publish/version-bump without approval
 *   B skipped_verify     — self-review bypass
 *   A wrong_ref          — stale API param / wrong reference
 *   + naming_violation   — canonical-name / repo-name rule broken
 *
 * Design notes (frozen 2026-07-14, BEFORE first eval run — see eval runner):
 *   - "wrong" is NOT a wrong_ref keyword (ambient in correction language; would
 *     tie-kill the hand-labeled naming pairs).
 *   - "verified" (completed state) is NOT a skipped_verify keyword — the class
 *     is about the ACT of skipping verification, not about things being verified.
 *   - bare "name"/"names" are NOT naming_violation keywords (ambient: "provider
 *     names"). Hyphenless "api key" does not hit "api-key" (tokenizer keeps
 *     hyphens) — only the hyphenated compound counts as a credential token.
 *   - "claude" is NOT a model_dispatch keyword (ambient: CLAUDE.md, project
 *     names). The dispatch pairs carry opus/sonnet/codex/fable anyway.
 *   - Stored `failure_class` (if the parallel capture-time work lands it on
 *     records / blind spots) takes precedence over derivation — "derived-or-
 *     stored" per the work-packet.
 *
 * No new deps: imports only the built core dist (same paths predict-loo uses).
 */

import { matchesBlindSpot } from "../../packages/core/dist/helpers/blind-spots.js";
import { tokenize, overlap } from "../../packages/core/dist/tools-logic/check-action.js";

/** Trigger-keyword overlap floor of the production keyword path (predict-correction.ts). */
export const MIN_OVERLAP = 2;

/** The 9-value enum (work-packet 7 + naming_violation + other). */
export const FAILURE_CLASSES = [
  "publish_gate",
  "naming_violation",
  "model_dispatch",
  "skipped_verify",
  "confidential_leak",
  "framing_error",
  "scope_violation",
  "wrong_ref",
  "other",
];

/**
 * Coordinate keyword sets per class — cluster semantics from the work-packet
 * table, expanded with surface variants because the shared tokenizer does NOT
 * stem (tokenize: lowercase, ≥3 chars, stopworded, hyphens preserved).
 */
export const CLASS_KEYWORDS = {
  publish_gate: [
    "push", "pushed", "pushes", "pushing",
    "publish", "published", "publishing",
    "deploy", "deployed", "deploys", "deployment",
    "release", "released", "releases",
    "version", "versions", "bump", "bumped",
    "approval", "approve", "approved",
    "permission", "permissions",
  ],
  naming_violation: [
    "naming", "rename", "renamed", "renames", "renaming",
    "repo", "repos", "repository", "repositories",
    "slug", "slugs", "filename", "filenames",
    "folder", "folders", "directory", "directories",
    "kebab-case", "canonical", "alias", "aliases",
    "spelling", "spelled", "misspelled",
  ],
  model_dispatch: [
    "opus", "sonnet", "haiku", "fable", "codex",
    "model", "models",
    "dispatch", "dispatched", "dispatching",
    "sub-agent", "sub-agents", "subagent", "subagents",
    "orchestrate", "orchestrates", "orchestrator", "orchestration",
    "worker", "workers", "reviewer", "reviewers",
    "sequential", "parallel", "routing",
  ],
  skipped_verify: [
    "verify", "verifying", "verifies", "verification",
    "self-review", "self-verify", "self-check",
    "unverified", "re-verify",
  ],
  confidential_leak: [
    "confidential", "secret", "secrets",
    "internal", "internals",
    "leak", "leaked", "leaks", "leaking",
    "expose", "exposed", "exposes", "exposure",
    "reveal", "reveals", "revealed", "revealing",
    "margin", "margins", "cost", "costs", "economics",
    "credential", "credentials", "api-key", "api-keys",
  ],
  framing_error: [
    "frame", "framed", "frames", "framing", "reframe",
    "lens", "lenses",
    "conceptual", "concept", "concepts",
    "metaphor", "metaphors", "paradigm",
    "analogy", "analogies",
    "neuroscience", "philosophy", "philosophical", "mental",
  ],
  scope_violation: [
    "scope", "scopes", "scoped", "out-of-scope",
    "session", "sessions",
    "focus", "focuses", "focused",
    "unrelated", "mix", "mixing",
    "boundary", "boundaries",
    "conversation", "conversations",
  ],
  wrong_ref: [
    "stale", "outdated", "deprecated",
    "param", "params", "parameter", "parameters",
    "endpoint", "endpoints", "ref", "refs",
    "mismatch", "mismatched",
  ],
};

// Precompute Set form once.
const CLASS_SETS = Object.fromEntries(
  Object.entries(CLASS_KEYWORDS).map(([k, words]) => [k, new Set(words)]),
);

/**
 * Classify free text into the 9-value enum.
 * Argmax over per-class keyword hits on the SHARED tokenizer.
 * Zero hits or a tie for first place → "other" (fail-closed, per the brief).
 *
 * @returns {{ failure_class: string, score: number, hits: string[], runner_up: {class: string, score: number} | null }}
 */
export function classifyFailureClass(text) {
  const tokens = tokenize(text || "");
  let best = null;
  let second = null;
  let bestHits = [];
  for (const [cls, kwSet] of Object.entries(CLASS_SETS)) {
    const hits = overlap(tokens, kwSet);
    const entry = { class: cls, score: hits.length, hits };
    if (!best || entry.score > best.score) {
      second = best;
      best = entry;
    } else if (!second || entry.score > second.score) {
      second = entry;
    }
  }
  if (!best || best.score === 0 || (second && second.score === best.score)) {
    return {
      failure_class: "other",
      score: best?.score ?? 0,
      hits: [],
      runner_up: second && second.score > 0 ? { class: second.class, score: second.score } : null,
    };
  }
  bestHits = best.hits;
  return {
    failure_class: best.class,
    score: best.score,
    hits: bestHits,
    runner_up: second && second.score > 0 ? { class: second.class, score: second.score } : null,
  };
}

/**
 * Class of a CORRECTION RECORD — stored field wins ("derived-or-stored"),
 * else derive from rule + context. Tags are deliberately EXCLUDED: they are
 * auto-generated topic labels ("deployment" appears on a color-palette record)
 * and would poison the class signal.
 */
export function classifyCorrection(c) {
  if (c && typeof c.failure_class === "string" && FAILURE_CLASSES.includes(c.failure_class)) {
    return { failure_class: c.failure_class, score: Infinity, hits: ["<stored>"], runner_up: null };
  }
  return classifyFailureClass(`${c?.rule ?? ""} ${c?.context ?? ""}`);
}

/**
 * Class of a BLIND SPOT — stored field wins if the derivation ever propagates
 * one, else derive from tendency + example_rule + trigger_keywords (the only
 * recorded prior-correction text a blind spot retains).
 */
export function classifyBlindSpot(bs) {
  if (bs && typeof bs.failure_class === "string" && FAILURE_CLASSES.includes(bs.failure_class)) {
    return { failure_class: bs.failure_class, score: Infinity, hits: ["<stored>"], runner_up: null };
  }
  return classifyFailureClass(
    `${bs?.tendency ?? ""} ${bs?.example_rule ?? ""} ${(bs?.trigger_keywords ?? []).join(" ")}`,
  );
}

/** Token set of a blind spot's recorded text (tendency + example + triggers). */
export function blindSpotTokens(bs) {
  return tokenize(
    `${bs?.tendency ?? ""} ${bs?.example_rule ?? ""} ${(bs?.trigger_keywords ?? []).join(" ")}`,
  );
}

const NO_FIRE = { fired: false, via: null, matched: [], semanticScore: 0 };

/**
 * The hypothesis matcher — inject as `opts.matchFn` into predict-loo's
 * runLooEval. Contract (matchFn(leadIn, bs) → {fired, via, matched?, semanticScore?}):
 *
 *   fired ⇔ classify(leadIn) === classify(bs)  (both != "other")
 *           AND |tokenize(leadIn) ∩ blindSpotTokens(bs)| ≥ 1
 *
 * semanticScore is capped at 0.99 so a class fire scores 2·0.99 = 1.98 in
 * predictBlind — STRICTLY below any keyword fire (matched.length ≥ 2) — a class
 * fire can therefore never displace a baseline keyword hit from the top risk.
 */
export function failureClassMatchFn(leadIn, bs) {
  const lc = classifyFailureClass(leadIn || "");
  if (lc.failure_class === "other") return NO_FIRE;
  const bc = classifyBlindSpot(bs);
  if (bc.failure_class === "other" || bc.failure_class !== lc.failure_class) return NO_FIRE;
  const matched = overlap(tokenize(leadIn || ""), blindSpotTokens(bs));
  if (matched.length < 1) return NO_FIRE;
  return {
    fired: true,
    via: "failure_class",
    matched,
    semanticScore: matched.length >= MIN_OVERLAP ? 0.99 : 0.5,
    failure_class: lc.failure_class,
  };
}

/**
 * Additive matcher modeling the PRODUCTION proposal ("no change to the existing
 * loop semantics; new secondary class join"): the byte-identical keyword path
 * first (matchesBlindSpot with the semantic branch disabled via an infinite
 * threshold — exactly what predict-loo's default does with semantic:false),
 * class join only when the keyword floor does not fire.
 */
export function makeUnionMatchFn(minOverlap = MIN_OVERLAP) {
  return function unionMatchFn(leadIn, bs) {
    const kw = matchesBlindSpot(leadIn, bs, minOverlap, Number.POSITIVE_INFINITY);
    if (kw.fired) return kw;
    return failureClassMatchFn(leadIn, bs);
  };
}
