# Correction-Transfer Benchmark — v1 Spec

**Status:** proposal (synthesis of a 4-lens round-table + 2 adversarial reviews)
**Date:** 2026-07-02
**Owner:** tongwu (final call on all REDLINE items)
**Verified-against:** live corpus + core source, 2026-07-02 (see [Pre-implementation verifications](#12-open-questions--pre-implementation-verifications))

> **Honesty stance (inherited from `predict-loo.mjs`, verbatim intent):** a low score is a
> VALID result, not a bug. No tuning, cherry-picking, or gating to look good. Uncomputable
> metrics render as `null` / `"n/a (uncomputable — 0 in denominator)"`, never `0`.

> **Corpus reality (verified live, this session).** The real corpus is **94 correction
> records on disk / 30 active / 64 retracted (68%) / 19 projects**. The `predict-loo`
> reader sees **91** (it drops 3 records lacking `rule`+`date`). `predict-loo` today scores
> **0 predictions fired, 0 hits, 14 predictable, 8 achievable-predictable, 0/40 false
> fires.** This size **cannot** support any recall/transfer point estimate, any system
> ranking, or any marketing percentage. See [§2 minimum-n rules](#2-definitions--metrics)
> and [§6 anti-gaming](#6-anti-gaming-protocol). The v1 deliverable is the *instrument*,
> not a leaderboard.

---

## 1. Purpose & non-goals

### 1.1 Purpose

Build the first public benchmark that measures **memory as behavioral change**, not memory
as information retrieval. The confirmed gap (landscape §2): no public benchmark implements
the pipeline

```
(a) error occurs → (b) correction captured → (c) persisted →
(d) FRESH session recreates the error-triggering conditions → (e) measure recurrence.
```

Every existing benchmark (LongMemEval, LoCoMo, MemoryAgentBench, Letta Leaderboard) tests
retrieval QA within a session/conversation. None tests whether a captured correction
*changes what a fresh agent does*. `predict-loo` is a primitive, honest, offline instance of
exactly this pipeline; this spec lifts its anti-gaming invariants into a versioned,
reproducible artifact and (later) into live cross-session execution.

### 1.2 v1 delivers (offline tier only)

1. A harvest path `CorrectionExport → CorrectionTransferItem (CTI)` reusing the shipped
   fail-closed scrub, redaction, and cluster-signature primitives.
2. A `predict-loo`-style scorer over harvested CTIs with **honest dual denominators** and a
   **paired false-fire instrument**.
3. A versioned, self-verifying result artifact (`bench-result/v1`) with corpus hash.
4. A machine-enforced **claim-gate ledger** so the report physically cannot print an
   ungated number.
5. One command (`npm run bench`) over a frozen fixture corpus + a docs-repro CI gate.

### 1.3 Non-goals for v1 (deferred, with reasons)

| Deferred | Why (grounded) |
|---|---|
| Live agent execution / fresh-session drive | No clock seam in core (verified); headless multi-host drive unmeasured (OQ-6). Needs a core PR + a SUT contract. |
| Multi-engine leaderboard, cloud/hermetic tiers | Vendor SDK semantics unverified; building a leaderboard on an unverified competitor SDK is the vendor-runs-competitor failure the Mem0-Zep dispute documents. |
| LLM-as-judge (dual-rater) | Zero-key constraint on hot paths; judge variance is a named LongMemEval blind spot. Offline scorer is deterministic and needs no judge. |
| `corrections-export/v2` (`retracted_at`, `superseded_by`) | v1 export lacks these fields (verified); achievable-as-of-*t* is not reconstructible. Belief-revision/conflict track waits on v2. |
| Supersession/conflict track as a **headline** | Same v2 dependency; may be synthetic-only at this corpus size (open question). |
| Field-RMR as a rendered number | Opportunity-censored to near-vacuous intervals on today's data (most active classes have zero outcome events). |
| Synthetic density sweep (200+ distractors) | Quarters of infra; risks LoCoMo-style label errors. Harvest + honest nulls first. |
| Donation pipeline, pseudonymization, legal review | Needs counsel + reviewer capacity; dead weight at zero donors. |

**Scope rule (binding, from both reviews):** what B2 builds in ~1 week (§8) is the offline
tier. Everything in the deferred table is staged, not built, in v1.

---

## 2. Definitions & metrics

### 2.1 The unit of analysis is the *class*, never the trial

A **correction class** = the equivalence set of corrections sharing a cluster signature.
`clusterSignature(c) = tokenize(rule + " " + tags.join(" "))` — **recorded fields only**,
never the lead-in the predictor saw. Two corrections are same-class when signatures overlap
by `>= MIN_OVERLAP = 2` tokens. This is the exact `predict-loo` join and it decides both
(a) predictability and (b) HIT judgment.

`class_id = sha256(sorted(clusterSignature) join " ")[:16]`.

Treating trials as independent Bernoullis fabricates precision (STATS lens). All headline
metrics aggregate to the class; class outcome = **worst-case** (a class counts as *avoided*
only if ALL its triggered trials avoided).

### 2.2 Canonical record-count rule (fixes the 94-vs-91 gap)

**A record counts iff it has both a non-empty `rule` and a valid `date`.** This is the
`predict-loo` reader's rule and it is now normative. Every artifact MUST emit:

- `corpus.n_on_disk` — files present,
- `corpus.n_counted` — records passing the count rule,
- `corpus.excluded[]` — `{id, reason}` for each dropped record.

Rationale: two readers already disagree by 3 records TODAY (94 vs 91). A silent 3-record
drift is the exact denominator ambiguity that produced the Zep 84%→58.44% dispute. The
scored set is a published artifact; numerator and denominator are computed from the *same*
`n_counted` set.

### 2.3 Core metrics (offline tier)

All ratios carry `{value, num, den, wilson95}`. `value` is `null` (not `0`) when `den == 0`.

```
predictable(C)         := ∃ prior same-class sibling among ALL priors (incl. retracted),
                          strictly dated < C.date, id != C.id
active_predictable(C)  := ∃ such sibling that is ACTIVE
                          (deriveBlindSpots drops active===false, so a class whose only
                           priors are retracted is STRUCTURALLY unpredictable — achievable ceiling)

fired(C)               := scorer returned >= 1 guidance for C's redacted lead-in
hit(C)                 := top guidance anchors to a DIFFERENT correction (anchor.id != C.id)
                          whose recorded cluster overlaps C's by >= MIN_OVERLAP tokens

precision              = hits / predictions_fired
recall_theoretical     = hits / #{C : predictable(C)}
recall_achievable      = hits / #{C : active_predictable(C)}     # RECALL* — the honest ceiling
anti_self_confirm_hits = #{hits where anchor.id != C.id}          # by construction all hits; count explicitly

FFR (false-fire rate)  = neg_fires / neg_units                   # negatives fire under IDENTICAL rules
lead_time_days         = C.date − date(earliest correct active prior sibling), over hits only
                          reported {n, mean, median, max}; rendered only when n >= 5
```

**Report BOTH denominators, always.** Never print `recall_achievable` without
`recall_theoretical` beside it.

### 2.4 Negative-unit clustering (fixes how 0/40 reads)

The current `predict-loo` "0/40" is **8 lead-ins × NEG_PER_LEADIN=5** — pairs within a
lead-in share the lead-in text, so 40 is not the effective *n*. Kish design effect
`DEFF = 1 + (m−1)ρ`; at m=5, ρ≈0.5, DEFF≈3.0 → effective n≈13. **The claiming unit for FFR
is the lead-in/session, not the pair.** Report both levels; gate claims on the independent
unit:

- pair-level: 0/40 → Wilson upper 8.8%
- **lead-in-level (claiming unit): 0/8 → Wilson upper 32.4%**

`ρ` for real negatives is unmeasured — measure it before choosing a tighter unit (OQ).

### 2.5 Wilson interval (mandatory when den>0)

```
z = 1.96
center     = (p + z²/2n) / (1 + z²/n)
half_width  = (z / (1 + z²/n)) · sqrt( p(1−p)/n + z²/4n² )
wilson95    = [center − half_width, center + half_width]   clamped to [0,1]
```

Verified this session: `Wilson(0/8)=[0.0000, 0.3244]`, `Wilson(8/8)=[0.6756, 1.0000]`,
`Wilson(0/40)=[0.0000, 0.0876]`.

### 2.6 Minimum-n rules — the claim-gate ledger (`claim-gates/v1`)

Machine-enforced. A claim whose *n* is below its gate renders the literal string
`"CANNOT CLAIM (n=X < gate Y)"` instead of a number. All figures verified numerically this
session.

| Claim | Requires |
|---|---|
| transfer_recall point estimate ±15pp | 39 classes |
| transfer_recall point estimate ±10pp | 93 classes |
| transfer_recall point estimate ±5pp | 381 classes |
| FFR ≤ 5% | 59 zero-fire independent negatives (`1−0.05^(1/59)=4.95%`) |
| FFR ≤ 2% | 149 zero-fire negatives |
| FFR ≤ 1% | 299 zero-fire negatives |
| "memory ON beats OFF" | 6 discordant pairs, all one direction (exact McNemar `2·0.5⁶=0.031`; 5 → 0.0625, NOT sig) |
| "matcher A beats matcher B" | Fisher exact two-sided p ≤ 0.05 |
| lead-time summary | 5 hits |
| 80%-power detectable 10%→50% uplift (unpaired) | 20 classes/arm |
| 80%-power detectable 30%→60% uplift (unpaired) | 42 classes/arm |

**Thresholds are recomputed per run** against the live `n_counted` — the corpus grows daily,
and gate arithmetic is cheap. The ledger is data the renderer consumes; the *class
definition* (§2.1) is frozen in the item schema before anyone sees scores, to prevent
gate-shopping (redefining "class" to pass `classes:39`).

### 2.7 What this corpus can and cannot claim (fixed report footer)

Verified live: fired=0, hits=0, achievable=8, FP 0/8-independent.

**CANNOT claim at current density:** any transfer-recall point estimate as a headline; any
system/matcher ranking; any RMR trend over time; any marketing percentage ("X% fewer
repeated mistakes"); any cross-surface transfer claim (OQ-6 unmeasured); FFR < 5% (not
claimable at either clustering level — 0/8 → [0, 32.4%]).

**CAN claim:** the pipeline exists and is anti-gamed by construction; metric definitions are
frozen and versioned; the FFR pair-level bound (≤ 8.8%); `0/8` achievable recall as a
**diagnostic of corpus density** (a low number is a valid result). Historical
`semantic 2/13 vs keyword 0/13`: Fisher exact two-sided **p = 0.48** → no evidence of matcher
difference; independently corroborates the embeddings-declined decision (density is the
ceiling, not architecture — 5th confirmation).

### 2.8 Two scoreboards, never conflated

Enforced in report *layout*, not prose. One rendered page may not mix columns from both.

- **Memory quality (funnel):** capture % (incl. rejects from `_rejected.jsonl`), durability
  %, injection precision@k, tokens/injected-item.
- **Outcome uplift:** recall_achievable, (later) RMR/heed/A-B uplift, FFR.
- `predict_*` counters feed **neither** (kept strictly separate from `precision =
  heeded/retrieved`, exactly as `corrections.ts` mandates).

---

## 3. Task pipeline — one item end-to-end (concrete)

### 3.1 Item schema `ar-bench-item/v1`

Versioned, changelog'd, scores version-scoped (LongMemEval-cleaned lesson).

```jsonc
{
  "schema_version": "ar-bench-item/v1",
  "item_id": "sha256(canonical-JSON)[:16]",
  "class_id": "sha256(sorted clusterSignature tokens)[:16]",   // LOO split + hit join, recorded fields only
  "source": { "kind": "harvested"|"authored"|"synthetic",
              "correction_export": CorrectionExport|null },     // corrections-export/v1, already fail-closed scrubbed
  "canonical_correction": {                                     // GROUND TRUTH — never shown to a scorer/SUT
    "rule": "use proxy.ts not middleware.ts (Next.js 16 + Clerk)",
    "severity": "p0", "tags": ["nextjs","clerk","auth"], "date": "2026-05-10"
  },
  "lead_in": "…redacted context, rule text stripped…",          // predict-loo redactLeadIn output
  "redaction_survived": true,                                    // false → counted in corpus, excluded from fired
  "priors_active_at_t": null,                                    // v1: APPROXIMATION (see §3.3 leak note)
  "negative_lead_ins": ["…zero-cluster-overlap unrelated context…"]  // paired FP instrument
}
```

### 3.2 Offline scoring pipeline (v1 — the built path)

```
scoreCorpus(items, matchFn = keyword-default):
  for C in items:
    priors = items.filter(p => p.class_id shares tokens with C AND p.date < C.date AND p.id != C.id)
    assertBlindCut(priors, C)                       # THROWS on any p.id==C.id or p.date >= C.date
    predictable       = priors.length >= 1
    active_predictable = priors.some(p => p is active-at-export)   # v1 approximation
    if not C.redaction_survived:
        corpus_size++ ; continue                    # honest null, never a free hit
    blind    = deriveBlindSpots(priors)             # PURE, cannot see C or any p.date >= t
    fire     = predictBlind(C.lead_in, blind, {matchFn})
    if fire.fired:
        predictions_fired++
        anchor = topRisk(fire).anchor
        if anchor.id != C.id and clusterOverlap(anchor, C) >= 2: hits++
    # negatives — IDENTICAL predictBlind, same matchFn
    for neg in C.negative_lead_ins[:NEG_PER_LEADIN]:
        if predictBlind(neg, blind, {matchFn}).fired: neg_fires++
        neg_units++   # NOTE: independent unit is the lead-in, not the pair (§2.4)
  return metrics(...)   # dual denominators, wilson95, honest nulls
```

This is a **direct extension of `predict-loo`**: same `assertBlindCut`, same `redactLeadIn`,
same recorded-fields HIT judgment, same negative instrument, same `matchFn` A/B seam. The
scorer runs fully in-memory on the blind profile so the LOO cut is provable — it does **not**
call the disk-backed `predictCorrection` (async, no root param, reads the FULL current
profile — would defeat the cut; see [§5](#5-adapter-interface-signatures) and OQ).

### 3.3 The as-of-*t* leak (documented, bounded in v1)

`CorrectionExport` v1 carries **lifetime** counters (`retrieved_count`, `heeded_count`,
`recurrence_count`, `last_outcome`) and a **current-snapshot** `active`, both dated on a
record whose `date < t` — post-*t* information riding on a pre-*t* record.

**v1 mitigation (mandatory):** the harvest step **zeroes/nulls the four counter fields** on
every CTI. `active`-as-of-*t* is **NOT** reconstructible from v1 (no `retracted_at`), so v1
uses the export-time `active` flag as a documented approximation — the same approximation
`predict-loo` already accepts when `deriveBlindSpots` drops `active===false` priors. Full
as-of-*t* reconstruction and a real achievable denominator wait on `corrections-export/v2`
(§4.4). Any artifact using the approximation MUST stamp `active_approximation: "export-time"`.

### 3.4 The live tier (deferred — protocol recorded so the seam is designed)

When the clock seam ships (§4.5, REDLINE), one item runs as three phases with an **asserted
session boundary**:

```
runItem(item, sut):
  memRoot = mkdtemp()
  A   = sut.runSession({memRoot, workspace: fx(item), nowISO: T0,          turns: item.exposure})
  assertSessionBoundary(A, memRoot)          # THROWS, never warns
  B   = sut.runSession({memRoot, workspace: fx(item), nowISO: T0+Δ (Δ>=1), turns: [item.probe]})
  N   = sut.runSession({memRoot(copy), ...,           turns: [item.negative_probe]})
  ABL = sut.runSession({memRoot: EMPTY, ...same as B})   # no-memory arm
  return {A, B, N, ABL}
```

`assertSessionBoundary` = 5 loud conditions: (1) new PID for B; (2) workspace re-materialized,
content-hash == fixture_hash; (3) B's `context_at_start` contains no exposure-turn substring
that did not arrive through the memory store; (4) clock advanced via injected `nowISO`
(Δ>=1 day) so `sv`-locale strictly-before bucketing treats the probe as a genuinely later day;
(5) `memRoot` byte-hash identical across the boundary (the store is the ONLY carryover
channel). Recurrence oracle = action-trace predicates (not prose, not self-report), 4-way
outcome `{recurred | avoided_and_completed | avoided_but_incomplete | invalid}` — only
`avoided_and_completed` scores as transfer success, killing the do-nothing exploit.
**None of this is built in v1.**

---

## 4. Corpus strategy & versioning

### 4.1 The ONLY ingestion path is `exportCorrections()`

`corrections-export/v1` — fail-closed scrubbed, schema-pinned, deliberately vendor-neutral.
**Never glob raw JSON** (the export exists precisely because raw-glob re-implements a scrub
that drifts). Verified: `exportCorrections` and `scrubForExport` are exported;
`recordCorrection`/`applyCorrectionDefaults`/`writeRecordAtomic` are **not** (see §5).

### 4.2 Harvest mapping (v1)

```
harvestItem(rec: CorrectionExport) -> CTI | Excluded:
  class_id = clusterSignature(rec)               # recorded fields only
  lead_in  = redactLeadIn(rec)                    # verbatim strip + token-subset sentence drop
  if lead_in == ""            -> Excluded{no_usable_leadin}   # counted in corpus, listed in _excluded.jsonl
  if |tokenize(lead_in)| < 6  -> Excluded{thin_context}
  zero counters (retrieved/heeded/recurrence/last_outcome)   # §3.3 leak fix
  emit CTI
```

Every excluded record → `_excluded.jsonl` with reason (the `_rejected.jsonl`
survivorship-bias pattern applied to the benchmark itself).

**Density reality:** 30 active real corrections → expect roughly 10-18 usable CTIs and 8-14
predictable classes initially (predict-loo sees 14 predictable / 8 achievable today). The
harvest *pipeline* is the deliverable; corpus growth comes later.

### 4.3 Fixture corpus (the frozen CI target)

`scripts/eval/fixtures/corpus-v1/` + `corpus-v1.lock.json`
(`{schema_version:"bench-fixture/v1", corpus_hash, n:~30, provenance:"synthetic, hand-audited, secrets-free"}`).

Must include the structurally interesting cases: ≥2 same-class sibling chains (hits
possible), a retracted-only-prior case (achievable ≠ theoretical diverge), a
redaction-kills-lead-in case (excluded from fired), zero-overlap negatives, one
`superseded_by` chain (for future v2), and `_outcomes.jsonl` events with **all timestamps at
12:00Z** (unambiguous day bucketing).

**Authoring constraint (verified):** `recordCorrection`/`applyCorrectionDefaults` are NOT
exported, and `recordCorrection` hard-codes `todayDate()` (cannot backdate). Therefore the
fixture is authored either by (a) adding explicit public exports with tests, or (b) writing
store-layout JSON directly and reading back via the public `readCorrections()` (the only
public normalizer). Author from scratch against the case checklist, then run `scrubForExport`
+ manual review. A silently edited fixture is the LongMemEval-contamination failure; changing
it requires bumping to `corpus-v2` + changelog.

### 4.4 Versioning (`corr-corpus-manifest/v1`)

Content-addressed. `record_hash = sha256(canonicalJson(record))` where `canonicalJson` =
sorted keys, UTF-8 NFC, LF, no insignificant whitespace (pin with unit-test vectors —
two implementations must agree). `tree_hash = sha256(sorted record_hashes join "\n")`.
`_rejected.jsonl` is **excluded** from the hash but its line count is recorded (capture-rate
must include rejects). Inclusion/exclusion rules ARE part of the schema doc.

Semver: MAJOR = records removed/changed, MINOR = added, PATCH = metadata only. Scores are
**version-scoped**; cross-version comparison is forbidden (LongMemEval had to re-release as
`longmemeval-cleaned`). The harness stamps `{corpus_version, tree_hash}` into every result and
rejects submissions whose `tree_hash` matches no published release.

### 4.5 `corrections-export/v2` (deferred prerequisite)

Adds `retracted_at` and `superseded_by`; zeroes lifetime counters on the adapter-bound
projection. **Required before** any real achievable-as-of-*t* denominator or belief-revision
track. This is a schema bump (consumers pin/diff `corrections-export/v1`). Do not silently
widen v1.

### 4.6 Privacy note (binding for any published artifact)

The fail-closed guarantee covers **SECRET patterns only.** Verified: `scrubForExport`'s
re-scan tests `SECRET_CONTENT_PATTERNS` directly — but content-guard **layer 1
(prompt-injection)** stays fail-OPEN even inside `scrubForExport`, and generic
`Authorization: Bearer <jwt>` is intentionally unscanned. Any corpus card MUST state:
injection-scrub and JWT are not fail-closed; and free-form PII (emails, internal hostnames)
is not caught by any scrubber — real correction text (`"use proxy.ts not middleware.ts"`)
fingerprints a stack. **Human review + home-path redaction are mandatory before publishing**
(see §7.2). Publishing real-corpus baselines is gated on `tongwu`'s call.

---

## 5. Adapter interface (signatures)

**v1 builds no live adapter.** The offline scorer needs only these **already-public** core
functions:

```ts
// packages/core — verified exported
exportCorrections(opts?: ExportCorrectionsOptions): CorrectionExport[]   // tools-logic/export-corrections.ts:131
scrubForExport(content: string): string                                  // storage/content-guard.ts:182  (throws SecretScanError)
readCorrections(project: string): CorrectionRecord[]                     // storage/corrections.ts:598     (only public normalizer)
rankCorrections(records: CorrectionRecord[], limit?: number): CorrectionRecord[]  // corrections.ts:1059
deriveBlindSpots(...)                                                     // helpers/blind-spots.ts:170
```

**NOT exported (verified) — do not design against these as library calls:**
`recordCorrection`, `applyCorrectionDefaults`, `writeRecordAtomic`. If fixture authoring
needs the real write/normalize path, add explicit public exports **with tests** in a separate
core PR; otherwise write store-layout JSON and normalize via `readCorrections()`.

**`predictCorrection` (verified async, no root param, reads full profile):** do NOT run it
"in-bank." Running it against an alternate root requires mutating the module-global
`AGENT_RECALL_ROOT` mid-run (racy) and re-imports the full-profile leak the LOO cut exists to
prevent. **Mandate the `predict-loo` in-memory mirror** for scoring — that is the only correct
path.

**Live-tier `MemoryEngineAdapter` (recorded for the deferred tier only — not v1):**

```ts
interface MemoryEngineAdapter {
  manifest(): { adapter_name, adapter_version, engine:{name,version},
                sdk_versions: Record<string,string>,       // pinned; the created_at dispute fix
                config_digest: string,                       // hash of full config; any change => new submission
                capabilities: { anchor_attribution, retraction_events, local_only, deterministic } }
  init(bank_id: string, workdir: string): { ok: true }       // fresh isolated store per bank
  ingest(events: IngestEvent[]): { accepted: string[], rejected: {id,reason}[] }  // IngestEvent.record MUST be corrections-export/v1|v2
  start_session(ctx: {session_id, project, nowISO}): { injected?: { ids: string[], tokens: number } }
  advise(probe: { probe_id, lead_in /* REDACTED */, budget: { max_items: 3, max_tokens: T } }):
        { guidance: { text: string, anchor_ids: string[], engine_score?: number }[] }   // MAY return [] — correct on negatives
  end_session(session_id: string): {}
  teardown(): { ok: true }
}
```

Judgment stays **harness-side and deterministic**: `fired = guidance non-empty`; `HIT` iff
top guidance's `anchor_ids` map to a previously-accepted record whose recorded cluster
overlaps the target by `>= MIN_OVERLAP`, and `anchor.id != C.id`. Engines choose what
**fires**; the harness alone judges **hits** (the `matchFn` invariant). This whole interface
is deferred pending the clock seam + a verified engine SDK.

---

## 6. Anti-gaming protocol

Each threat maps to a concrete, sourced countermeasure. Threats the v1 offline tier actually
faces are marked **[v1]**; the rest are recorded for the deferred live tier.

| Threat | Countermeasure |
|---|---|
| **[v1]** Denominator manipulation (Zep 84%) | Published machine-readable scored set; numerator & denominator from the same `n_counted`; canonical count rule §2.2; `_excluded.jsonl`. |
| **[v1]** Feed-the-answer / parroting | `redactLeadIn` strips rule verbatim + token-subset sentences; empty redaction → excluded, counted, never a free hit. |
| **[v1]** Self-confirmation | HIT requires `anchor.id != C.id` (a prior sibling), never the target echoing itself; `anti_self_confirm_hits` reported. |
| **[v1]** Ground-truth on the seen text | Predictability + HIT judged on recorded `rule`+`tags` cluster signature only; `matchFn` changes what fires, never how a hit is judged. |
| **[v1]** Recall inflation w/o FP control | Paired negatives (zero-cluster-overlap) under IDENTICAL `predictBlind`; FFR printed adjacent to recall; de-clustered claiming unit (§2.4). |
| **[v1]** Blind-cut leak | `assertBlindCut` THROWS (never warns) on any `p.id==C.id` or `p.date >= t`; filtering alone is insufficient. |
| **[v1]** Overclaiming on thin data | Claim-gate ledger (§2.6) renders `"CANNOT CLAIM"` below gate; CI binds to the CAN-claim set only (§7.4). |
| **[v1]** Corpus cherry-picking / drop-hard-ones | Denominator = ALL counted corrections, not the captured subset; capture failures count against you; `_rejected.jsonl` line count published. |
| Prompt/template drift (Mem0-Zep 58.44 vs 75.14) | Harness owns exposure/probe text and the answer-generation prompt; a change = new version + all baselines re-run. |
| Config gaming (k=42) | `config_digest` + pinned SDK versions in the results table; perturbation set publishes `config_sensitivity`; headline = perturbation mean. |
| Vendor-runs-competitor (both directions) | Systems configured by their OWN authors against a frozen harness; full scripts published for third-party re-execution. |
| Within-session masquerade / same-day hit | Session-boundary `memRoot`-hash assertion; `sv`-locale strictly-before day cuts; nonce probe at same `nowISO`. |
| Judge gaming | Action-trace predicates as the headline (no judge); judged residual capped, dual-pinned model, persisted per-item labels, Cohen's κ. |
| Do-nothing / reroute exploit | 4-way outcome; only `avoided_and_completed` scores; `avoided_but_incomplete` (refusal) is neutral, not a win. |
| Trivial-baseline saturation (LoCoMo 74%) | Mandatory baselines every table: no-memory, flat-file, oracle-injection; a scale tier where flat-file re-read blows the token budget; discrimination gate. |

### 6.1 Known gaming holes carried into the design (stated, not solved)

The reviews surfaced holes v1 does **not** fully close — recorded so nobody mistakes silence
for safety:

1. **Author-time leakage.** `redactLeadIn` is token-level; a *conceptual* hint ("remember the
   file-naming gotcha for auth") passes the lint. **v1 mitigation:** any authored/harvested
   lead-in that is human-edited requires a second-reviewer sign-off and a held-back
   adversarial audit before it enters the scored set. The harness can be gamed upstream of
   every runtime guard.
2. **Anchor-attribution spoofing (live tier).** A different sibling's id is trivially
   available; anti-self-confirm alone doesn't prove causation. Needs a per-item counterfactual
   (ablate the *specific* injected item, not all memory) before crediting attribution.
3. **Capture-denominator evasion (live tier).** Storing trigger vocabulary verbatim inflates
   capture without belief; the FP instrument catches spurious *firing*, not spurious
   *capture*.
4. **Reroute-as-avoidance (live tier).** No verifier yet distinguishes "rerouted BECAUSE of
   the rule" from "got lucky."
5. **Operator-as-adversary (live tier).** The ABL/discrimination gates run on the operator's
   model; a weak base model inflates uplift. Needs a neutral operator or pre-registered model
   before any published leaderboard.
6. **Template-seed grinding (live tier).** Per-submission paraphrase seeds must derive from a
   server nonce committed before submission, never from a vendor-chosen `submission_id`.

---

## 7. Reproducibility & baseline artifact schema

### 7.1 `bench-result/v1` envelope (every field mandatory)

```jsonc
{
  "schema_version": "bench-result/v1",
  "benchmark": "predict-loo" | "correction-transfer" | ...,
  "benchmark_version": "loo-v4-2026-07-02",        // a const declared IN each script (GATE_VERSION-style)
  "generated_utc": "ISO8601",
  "corpus": {
    "corpus_hash": "sha256…",                       // canonicalJson rules pinned by test vectors
    "n_on_disk": 94, "n_counted": 91,               // §2.2 — BOTH, always
    "n_active": 30, "n_retracted": 64, "n_projects": 19,
    "excluded": [{ "id": "…", "reason": "missing_rule|missing_date" }],
    "rejected_lines": 42,                            // from _rejected.jsonl, capture accounting
    "active_approximation": "export-time",           // §3.3
    "manifest": [{ "project", "file", "sha256" }]    // hash-only mode available for public artifacts (§7.2)
  },
  "config": { "cli_args": [...], "semantic": false, "MIN_OVERLAP": 2, "MAX_RISKS": 3,
              "NEG_PER_LEADIN": 5, "matchFn": "keyword-default" },
  "environment": { "node": "v20.x", "platform": "darwin-arm64",
                   "tz": "Europe/…",                 // day bucketing is TZ-sensitive — artifacts from different tz are non-comparable unless bench is tz-insensitive
                   "repo_commit": "…"|null, "core_version": "3.4.35" },
  "denominators": { "theoretical": 14, "achievable": 8 },
  "metrics": {
    "recall_achievable": { "value": 0, "num": 0, "den": 8,  "wilson95": [0, 0.3244] },
    "recall_theoretical":{ "value": 0, "num": 0, "den": 14, "wilson95": [0, 0.2153] },
    "precision":         { "value": null, "num": 0, "den": 0, "note": "n/a (uncomputable — 0 in denominator)" },
    "ffr":               { "value": 0, "num": 0, "den": 8,  "wilson95": [0, 0.3244], "unit": "lead-in" }
  },
  "per_item": [ { "id", "project", "date", "predictable", "active_predictable",
                  "redaction_survived", "fired", "via", "hit", "anchor_id",
                  "anti_self_confirm", "lead_time_days" } ]
}
```

### 7.2 `writeBaseline` / `verifyBaseline` contract

- `writeBaseline` scrubs the **whole serialized artifact** via `scrubForExport` (fail-closed),
  maps any home path (`/Users/…`) → `"<redacted>"` (the current
  `rmr-baseline-2026-07-02.json` embeds `/Users/tongwu/.agent-recall` verbatim — verified;
  this is the leak to fix), sorts `per_item` by `(project, id)` so ordering is out of the
  contract, and offers a **`--manifest=hash-only`** mode (no file list) for public artifacts.
- `verifyBaseline(file)` (a) recomputes `corpus_hash` from the embedded manifest and (b)
  recomputes every headline metric from `per_item` and asserts equality with `metrics`.
  Adjudicate-by-artifact: a third party recomputes the headline without rerunning — the
  terminal state the Mem0-Zep dispute converged to, made the *entry* condition.
- Migration: existing `rmr-baseline/v1` keeps its inner shape, wrapped in the envelope as
  `bench-result/v1` with `benchmark: "rmr-report"`.

### 7.3 Determinism policy (`DETERMINISM.md`)

- **Tier 0 (required for any headline):** pure-function scoring on recorded fields, zero-LLM /
  zero-network / zero-key. Contract: same `corpus_hash` + same `config` ⇒ **byte-identical**
  `metrics` + `per_item`. Verified: `scripts/eval/*.mjs` contain **zero** `Math.random`; the
  `NEG_PER_LEADIN` sample is a deterministic stride. Codify as law with a CI gate matching
  **invocation syntax only**: `grep -rnE 'Math\.random\s*\(\s*\)' scripts/eval && exit 1`
  — the earlier plain-substring form false-triggered on doc comments and the runtime guard
  (verified 2026-07-03), and an exclusion-pipe variant is evadable by planting the exclusion
  string on a violating line. Second layer: run-bench's runtime monkey-patch throws on ANY
  call (catches bare-reference aliasing like `arr.sort(Math.random)` that line-grep cannot).
- **Tier 1 (allowed):** seeded PRNG only (`mulberry32(corpus_hash ⊕ benchmark_version)`);
  `Math.random` banned in `scripts/eval/**`.
- **Tier 2 (LLM-judge — deferred, not in v1 CI):** pinned judge snapshot ID, temperature 0,
  `judge_prompt_hash`, per-item verdicts persisted (LongMemEval `autoeval_label`), dual judge
  + Cohen's κ, judged metrics in a separate block never merged into Tier-0.
- **TZ:** the harness pins `TZ=UTC` for fixture runs (day bucketing via `toLocaleDateString("sv")`
  is tz-sensitive — verified — so unpinned tz is a real cross-machine nondeterminism source);
  fixture `_outcomes` events authored at 12:00Z. Real-corpus artifacts record ambient tz and
  are observations, not gates.

### 7.4 One command + CI shape

`package.json`: `"bench": "node scripts/eval/run-bench.mjs"`. Registry lists every eval script
(`predict-loo`, `rmr-report`, …); a bench not in the registry does not exist for reproduction.

- Default `--corpus fixture`: **exact-match** gate on `metrics` + `per_item` (Tier-0 +
  pinned TZ + hash-locked corpus removes every legitimate variance source; drift = a real
  behavior change and must arrive with an intentional `--update-baselines` bump in the same
  PR). Lockfile hash verified **before** running.
- `--corpus real`: **never gates** (living personal dataset); prints a drift table vs the last
  dated baseline, exit 0.

CI lanes:
1. **build-and-test** (existing).
2. **bench-fixture** (every PR, keyless, ~1 min): `npm run bench` → `--check-determinism`
   (double-run byte-diff, stripping `generated_utc`/`environment`) → `verifyBaseline` on every
   file in `scripts/eval/baselines/` → `Math.random` grep gate → upload artifacts. **Gate the
   CAN-claim set only** (§2.7): harness determinism, FFR=0 on negatives, blind-cut assertion
   fires, schema/hash validity. **Never gate a recall/RMR number** — at 0/8 every recall gate
   is a gate on noise (Wilson [0, 0.324]); a green recall gate on a thin corpus is the
   LoCoMo-74% trap in reverse.
3. **repro-docs** (`workflow_dispatch` + weekly cron + release pre-publish): fresh container,
   run ONLY commands extracted from `docs/eval/REPRODUCE.md` fenced blocks, assert fixture
   artifacts match pinned baselines (excluding `generated_utc`/`environment`). Executing the
   docs means the docs cannot rot silently.

**REDLINE:** wiring lane 3 into `release.yml` as a hard pre-publish gate is `tongwu`'s
explicit call. `release.yml` today only zips War Room + cuts a GH release (no build/test/bench
step; no npm publish — consistent with "npm publish HELD"). The gate is entirely additive.

---

## 8. v1 scope cut — what B2 builds in ~1 week with 2 workers

**Offline tier only.** Two-worker week, in dependency order:

1. **`bench-artifact.mjs`** — `corpusManifest()` (canonical hashing + count rule §2.2),
   `writeBaseline()` (whole-artifact scrub + home-path redaction + `--manifest=hash-only`),
   `verifyBaseline()`. Wrap the existing `rmr-report` output in `bench-result/v1`. *(reuses
   `scrubForExport`.)*
2. **`harvest.mjs`** — `CorrectionExport → CTI` via `exportCorrections()` + `redactLeadIn` +
   `clusterSignature`; zero counters; emit `_excluded.jsonl`. *(reuses shipped export +
   redaction.)*
3. **`correction-transfer.mjs`** — the §3.2 scorer as a `predict-loo` extension: dual
   denominators, `assertBlindCut`, paired negatives, `matchFn` seam, honest nulls, Wilson.
4. **`claim-gates.json` + renderer hook** — `"CANNOT CLAIM"` below gate; recomputed per run;
   fixed footer §2.7.
5. **`run-bench.mjs` + fixture corpus** — registry, `--corpus fixture|real`, lockfile-hash
   check, exact-match on fixture / drift-table on real. Author the ~30-record fixture against
   the §4.3 case checklist.
6. **CI lanes 2 + 3** + `DETERMINISM.md` + `REPRODUCE.md` + `BENCH-RESULT-SCHEMA.md`. (Lane-3
   release gate staged, not wired — REDLINE.)

**Explicitly NOT in the week** (each is quarters of infra): headless multi-host agent drivers
(OQ-6 unmeasured), OCI/container submission harness, LLM-judge dual-rater pipeline,
donation/pseudonymization pipeline + legal review, 200+-record synthetic distractor tier,
`corrections-export/v2`, the belief-revision/conflict track, field-RMR rendering, the clock
seam (its own gated core PR).

**Worker done-definition (mandatory, per house rules):** trace ≥1 error path (does
`assertBlindCut` actually throw, not warn?); assume no global binaries (every tool → deps or
install step); high-threshold-first ternaries; time logic vs TODAY (fixture `_outcomes` at
12:00Z; `n_counted` is measured per run, not hard-coded).

---

## 9. Naming

**Recommended pick: `HeedBench`.**

Rationale: the benchmark's north-star quantity is the *heed rate* — "when a correction was
injected AND its trigger situation arose, did the agent comply?" That is precisely
behavioral-change-across-sessions, and it is the axis no existing benchmark measures. `Heed`
is a plain English verb, unclaimed in the memory-eval space, and it foregrounds *behavior*
(did the agent heed the correction) over *storage* (did the store retain it) — which is the
entire thesis. It reads well as a metric name too (`heed@1`, `heed_rate`).

Alternatives considered:

- **`CorrectionBench`** — accurate and self-explanatory, but generic and easy to confuse with
  spell/grammar-correction benchmarks; describes the *input* (corrections) not the *thing
  measured* (behavioral transfer).
- **`RMR-Bench`** — ties the name to Repeat-Mistake Rate, the outcome-scoreboard headline. But
  RMR is opportunity-censored and **deferred** in v1 (§1.3); naming the whole benchmark after
  a metric it can't yet render honestly would overpromise on a 30-active corpus.
- **`TransferBench` / `CTB`** — "transfer" collides heavily with transfer-learning; low
  distinctiveness.

**Final naming call is the human's.** If `HeedBench` is taken or off-taste, `CorrectionBench`
is the safe fallback.

---

## 10. (reserved)

---

## 11. (reserved)

---

## 12. Open questions & pre-implementation verifications

### 12.1 Pre-implementation verifications (do BEFORE building the marked item)

| # | Verify | Blocks | Status |
|---|---|---|---|
| V1 | Clock seam in core — generalize the `isStaleCorrection(nowMs)` param (verified to exist, corrections.ts:232) into `todayDate()`, the `sv` bucketing (:926), and `readOutcomesBefore/onDay`; give `recordCorrection` a `date` param. | Entire live tier (§3.4), boundary condition 4. **REDLINE core PR.** | REFUTED as-specified; seam absent (verified). |
| V2 | Core public-export decision — add tested exports for `recordCorrection`/`applyCorrectionDefaults`, OR commit to store-layout-JSON + `readCorrections()`. | Fixture authoring path (§4.3). | REFUTED (not exported, verified). Pick a path. |
| V3 | `corrections-export/v2` (`retracted_at`, `superseded_by`; zero counters). | Real achievable denominator, belief-revision track. | v1 lacks fields (verified). Deferred. |
| V4 | Recompute every claim-gate against live `n_counted` (=91 today, 30 active) and make count a runtime field. | Any headline denominator. | Multiple lenses hard-coded stale 91/23. Fixed in §2.2/§2.6. |
| V5 | Hindsight recall semantics (per-result score? echoes `document_id`?) against a live instance + a human-labeled "belief present" calibration set. | Any cross-engine ranking (deferred). | UNVERIFIABLE (cookbook inference-from-absence). |
| V6 | Headless SUT drive (`claude -p` and other hosts) + `SessionArtifact` (action_trace, provenance). | Live tier + N-run policy. | UNVERIFIABLE (only dream.sh precedent; OQ-6). |
| V7 | Measure negative-pair ICC (ρ) before choosing pair-level vs lead-in-level FFR unit. | Tightening FFR claim. | Assumed ρ≈0.5; unmeasured. |
| V8 | Canonical-JSON test vectors (key sort, number formatting, unicode NFC). | `corpus_hash` reproducibility. | Must pin. |

### 12.2 Open questions (design decisions, no code blocked yet)

1. **Operator neutrality.** AgentRecall authoring AND scoring is vendor-adjacent (the
   zep-papers#5 record shows vendor-run eval is distrusted both directions). Who holds the
   sealed split / runs submissions for a public leaderboard — a lab, a consortium?
2. **Corpus density path.** 30 active → ~8 achievable classes. Real donated corpora vs a
   synthetic tier that risks LoCoMo-style label errors — and can synthetic generation preserve
   the honest "insufficient data" rendering via the achievable denominator?
3. **Tier-2 judge needed at all for v1?** If fresh-session recurrence can be judged
   deterministically per scenario (action-trace predicates, exit codes, file-state asserts),
   the entire judge protocol defers. Depends on the live-tier oracle design.
4. **`elapsed_days` stratification.** Should Δ be `{1, 7, 45}` to probe staleness
   (`STALE_DAYS=30`, recency `exp(-days/180)`), or does that conflate durability with transfer?
5. **Reroute-as-avoidance adjudication.** Deterministic verifier for "rerouted because of the
   rule" does not exist; anti-self-confirm analogue for behavioral trials is undesigned.
6. **Judge/SUT contamination once public.** Canary GUIDs + a versioned held-out split policy
   from v1 (BIG-bench pattern) — catches regurgitation, not silent contamination.
7. **Supersession track viability.** Enough real `superseded_by` chains for even 3-5 items, or
   synthetic-only at v1 (which weakens its headline value)?
8. **Field-RMR prerequisite.** Most active classes have zero outcome events today; the
   opportunity-censored interval is near-vacuous. Is `check_action` instrumentation a
   prerequisite before field-RMR renders at all?
9. **Baseline retention.** Keep all dated real-corpus baselines (audit trail, matches
   never-hard-delete) or roll up to latest+quarterly?
10. **Run-count policy.** For the deterministic Tier-0 path, N-run mean±std is meaningless
    (std=0). N≥10 (Mem0 precedent) applies only once a live LLM agent is in the loop — which is
    itself unbuilt.
