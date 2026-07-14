# Recurrence Detector — Bounded Work-Packet

*2026-07-13 · Analyst: Sonnet (read-only) · RMR program*

---

## Summary

The recurrence detector in `session-end.ts` is near-blind because it evaluates only
corrections retrieved in the **same project, same session**. It never asks "is this new
violation an instance of a known pattern from another project?" Hand-clustering 42 active
corrections finds 5 cross-project failure classes; ~33% of the corpus is verifier-groundable.
The bounded fix: stamp a `failure_class` enum at capture time and widen the session-end join
to span all active corrections by class. The eval injection point already exists as the
`matchFn` hook in `predict-loo.mjs` (lines 191–194).

---

## Corpus Numbers

| | Count | Note |
|--|--:|--|
| Correction records on disk | 103 | excludes `_outcomes.jsonl`, `_rejected.jsonl` |
| Active | 42 | `active !== false` |
| Retracted | 61 | bulk-retracted 2026-06-12 (capture noise) |
| Projects with corrections dir | 21 | |
| Corrections with `recurrence_count > 0` | 5 | 6 total events; was 3/3 at 2026-07-03 baseline |
| Active corrections retrieved ≥ once | ~20 | |

Baseline RMR_proxy: 2.27 / 100 sessions (2026-07-03). All 6 recurrence events are
within-project; zero cross-project recurrences have ever been recorded.

---

## Cluster Table (42 active corrections, hand-labeled)

| Cluster | Failure class | Active | Projects | recur | Verifier-groundable |
|---------|--------------|:---:|:---:|:---:|:---:|
| D | `model_dispatch` — wrong model / execution routing | 3 | 3 | 1 | Yes — rule text |
| E | `framing_error` — wrong conceptual frame | 2 | 2 | 2 | **Yes — identical rule in 2 projects** |
| F | `confidential_leak` — internal info exposure | 3 | 2 | 0 | Partial — security audit |
| C | `scope_violation` — wrong project / session scope | 2 | 2 | 1 | Yes — rule text |
| H | `publish_gate` — push/publish without approval | 2 | 2 | 0 | Yes — git hook |
| B | `skipped_verify` — self-review bypass | 2 | 1 | 1 | Partial — CLAUDE.md |
| A | `wrong_ref` — stale API param / wrong repo | 1 | 1 | 0 | Partial — test failure |
| G | `product_direction` — strategy / taste | 3 | 1 | 0 | No |
| — | noise / unclear / domain context | ~24 | — | — | No |

**Verifier-groundable: ~14 / 42 = 33%.** Clusters D, E, C, H are the strongest.

Cluster E is the sharpest signal: the rule "Don't map to human memory" appears verbatim in
both `aam/corrections/2026-05-06-don-t-map-to-human-memory.json` and
`AgentRecall/corrections/2026-05-06-don-t-map-to-human-memory.json`; the existing detector
has never linked them (`recurrence_count=2` on the AgentRecall copy is within-project only).

---

## Why the Detector Is Blind (code quotes)

All three gaps are in `packages/core/src/tools-logic/session-end.ts`.

**Gap 1 — Single-project, retrieved-today scope only** (lines 298–303):
```typescript
const todays = readCorrections(slug).filter(
  (c) => c.last_retrieved &&
    new Date(c.last_retrieved).toLocaleDateString("sv") === todayStr &&
    c.active !== false && ...
);
```
A violation in a different project, or without a prior retrieval, never enters the loop.

**Gap 2 — Word-level match against a single correction's rule, no class join** (lines 336–341):
```typescript
const ruleWords = c.rule.toLowerCase().split(/\W+/).filter((w) => w.length >= 4);
const matchCount = uniqueRuleWords.filter((w) => summaryLower.includes(w)).length;
const hasTopicalOverlap = matchCount >= 2;
```
Each correction is evaluated in isolation. Cluster D's three corrections share a failure
class but zero ≥4-char word overlap; they can never reinforce each other's signal.

**Gap 3 — No `failure_class` field at capture time.** The schema carries `rule`, `context`,
`tags`, `severity`, `kind` — nothing encoding behavior class. `cross-project-transfer.mjs`
confirmed rule-only lexical overlap is a lower bound; what's missing is a class key to group
corrections across project boundaries.

---

## Bounded Change Proposal (targets Clusters D and E)

**1. Add `failure_class` to correction schema (additive, optional, 7 values):**
```
wrong_ref | skipped_verify | scope_violation | model_dispatch
| framing_error | confidential_leak | publish_gate | other
```
Derivable at capture via keyword classifier using only the already-imported `tokenize` /
`overlap` from `check-action.js` — no new deps, no ML, no schema break. Old records
without the field default to `other` silently.

**2. Cross-class cluster join in session-end (new secondary loop):**
When `genuineRecurrenceMarker()` fires, scan ALL active corrections across ALL projects
whose `failure_class` matches any correction retrieved or captured today. For matches with
`clusterSignature` overlap ≥ 1 token (relaxed from MIN_OVERLAP=2 because the class key
narrows candidates), emit `recurred` on the matching correction using that correction's
own project slug in `recordOutcome`. No change to the existing `todays` loop semantics.

**3. Eval — inject via existing `matchFn` hook** (`predict-loo.mjs:191–194`):
```javascript
const m = typeof opts.matchFn === "function"
  ? opts.matchFn(leadIn, bs)               // ← inject failure_class-aware matcher here
  : matchesBlindSpot(leadIn, bs, MIN_OVERLAP, semanticThreshold);
```
A `failure_class`-aware matchFn fires when `bs.failure_class === C.failure_class` AND
overlap ≥ 1. Tests the hypothesis on existing corpus without touching production code.

---

## Eval + Acceptance Criteria

**Held-in:** Run `predict-loo.mjs` with `opts.matchFn = failureClassMatchFn`. Acceptance:
recurrence recall on the 5 hand-labeled cross-project cluster pairs ≥ 50% (current: 0%);
precision must not drop; FFR (`negFires / negTrials`) must not increase.

**Held-out (time-split at 2026-06-01):** ~30 records before (train), ~25 active after (test).
Acceptance: ≥ 1 confirmed cross-project recurrence with 0 false positives on the
`NEG_PER_LEADIN=5` stride-sample check.

**Zero-regression:** `scripts/eval/claim-gates.mjs` baselines must not shift. The
`memory_beats_baseline` gate (Fisher exact, ≥6 discordant pairs) is the floor.

---

## Non-Goals

- **No embeddings.** Embedding-declined ruling (2026) stands: lexical beat embeddings five
  times on this corpus. Do not re-propose without new data.
- **No new deps.** Classifier uses only existing `tokenize` / `overlap`.
- **No capture-schema break.** `failure_class` is additive; old records default to `other`.

---

## Open Questions for the Owner

1. **Enum completeness:** Should `naming_violation` (CLAUDE.md naming rule) be its own
   class separate from `scope_violation`?
2. **Classifier authority:** Auto-derive `failure_class` at capture, or require explicit
   supply? Auto = zero friction; explicit = more accurate.
3. **Cross-project outcome routing:** When the cluster join fires `recurred` on a
   correction in a different project, confirm `recordOutcome` receives the originating
   correction's project slug, not the current session's slug.
4. **Feasibility gate:** 5 verified cross-project pairs is below the n≥39 claim gate.
   Accept ≥1 confirmed detection as the Phase-0 gate; defer the full ±15pp recall claim.
