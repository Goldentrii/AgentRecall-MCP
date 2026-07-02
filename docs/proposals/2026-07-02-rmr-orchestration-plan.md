# RMR Orchestration Plan — Making AgentRecall Measurably Better

*2026-07-02 · Orchestrator: Fable 5 · Derived from `docs/research/agent-memory-landscape-2026-07.md`*

**Mission:** convert the research verdict into reality. AgentRecall's identity becomes
(a) the governed corrections ledger and (b) the missing measurement instrument for
correction-learning. Everything below is organized around ONE north-star metric: **RMR
(Repeat-Mistake Rate) must fall, and we must be able to prove it fell.**

**Shape:** 4 phases · 17 loops · ~55 agent dispatches · 5 human gates · ~6–8 weeks
calendar (long pole is A/B data accumulation, not engineering).

---

## 0. Operating rules (apply to every loop)

- **Roles per loop:** Orchestrator (Fable 5 — briefs, decisions, reflection; never
  self-reviews) · Worker(s) (Sonnet — implement) · Reviewer (Sonnet, fresh eyes — every
  code loop, no exceptions) · Verifier (Sonnet — independently runs the exit condition,
  pass/fail) · security-reviewer (Sonnet) added on any egress-touching loop.
  Opus reserved for adversarial review + synthesis in the benchmark round-table.
- **Briefs:** `Role/Scope/SOP/Input/Output/Review-by`; branchy SOPs compiled to Plywood
  pseudocode. State in files, not chat.
- **Loop close-out:** UPDATE-LOG.md entry + Linear record (Tong Wu — Projects) +
  `ar session_end` (the project dogfoods itself; our own corrections feed the corpus).
- **REDLINE:** no push / publish / version bump / PR submission without explicit human GO.
  Gates marked G* below.
- **Honesty clause:** a null or negative result is a valid loop exit. It gets published
  (internally, and externally where relevant) — never buried. Referee credibility is the
  product.

## 1. North-star success standard (specific)

**Definitions**
- **RMR-proxy (computable today):** recurrence events per 100 sessions, per project and
  pooled, from the `recurrence` field. No trigger detection needed.
- **RMR-strict (needs Loop C3):** over window W, `RMR = (active correction-classes with ≥1
  recurrence in W) / (active correction-classes whose trigger context occurred ≥1× in W)`.
  Trigger occurrence detected via check-action events + nightly dream audit.
- **Heed rate:** injected ∧ triggered → complied. From `heeded` ledger.
- **Capture recall:** of human-pushback events in sampled transcripts, % captured as
  corrections.

**Targets** (provisional until G1 fixes them against measured baselines; the committed
form is the *relative delta + minimum sample size*, not the absolute number)

| Metric | Baseline | Phase-1 exit bar | Program success bar |
|---|---|---|---|
| RMR-proxy | M1 output = RMR₀ | −30% relative vs RMR₀ over a 4-week window, n≥20 recurrence-opportunities | sustained −50% over 8 weeks |
| Heed rate | M1 output | ≥70% (n≥15 triggered injections) | ≥80% |
| Capture recall | M2 output | ≥70% on fresh n≥30 sample (Wilson lower bound ≥55%) | ≥80% |
| Capture precision | M2 output | ≥80% (don't capture non-corrections) | ≥85% |
| Injection precision@5 | feedback-loop data | ≥60% | ≥70% |
| Injection cost | measure | median ≤1.5K tokens/session_start; p95 latency <800ms | same, held under corpus growth |
| predict-loo RECALL* | 0/8 | ≥25% after corpus growth (density gauge, not a forcing function) | ≥40% |
| A/B uplift (C4) | — | switch running, arms balanced | ON arm ≥20% fewer repeat-correction events, n≥30 sessions/arm — OR honest published null |
| Benchmark (Phase 2) | — | spec survives adversarial review | end-to-end on ≥3 backends; outsider reproduces from docs alone; versioned baseline artifact committed |
| README claims | over-claiming | — | 100% of claims cite a measured number or are cut |

**Guard-rails (must not regress):** predict-loo FP stays 0/40 · 720+ tests green ·
scrub remains fail-closed on every egress path · zero-cloud default unchanged.

## 2. Phases and loops

### PHASE 0 — Instrument (measure before improving) · start immediately on GO

**Loop M1 — "算总账" (RMR + heed aggregation)**
- Build `scripts/eval/rmr-report.mjs`: RMR-proxy, heed rate, per-project + pooled,
  Wilson intervals, versioned baseline JSON artifact (this seeds backlog #6).
- Agents (3): Worker · Reviewer · Verifier (recomputes from raw JSON by an independent
  method; must match ±1 event).
- Exit: baseline JSON committed (local), numbers cross-verified, UPDATE-LOG entry.
- Depends on: nothing. Parallel with M2.

**Loop M2 — "查漏点" (capture-leak audit)**
- Sample ≥30 human-pushback events from recent session transcripts. Two independent
  rater agents classify captured/missed + miss cause taxonomy (hook didn't fire /
  gate dropped / paraphrase missed / never surfaced). Inter-rater κ ≥ 0.6 or rubric
  is re-specified and re-run. Output: capture recall + CI + ranked miss causes.
- Agents (3): Rater ×2 · Adjudicator-Verifier.
- Exit: capture recall with CI + miss taxonomy.
- Depends on: nothing. Parallel with M1.

**GATE G1 (human):** review baselines; lock Phase-1 numeric targets; confirm loop order.

### PHASE 1 — Close the loop (make RMR physically able to fall)

**Loop C1 — "捕获" (capture density)** — fix top-2 miss causes from M2. TDD.
- Agents (4): Worker · Reviewer · Verifier (fresh n≥30 M2-method sample) · (security if
  hooks touch transcript paths).
- Exit: capture ≥70% recall / ≥80% precision on fresh sample.
- Depends on: M2, G1.

**Loop C2 — "注入" (injection efficacy)** — precision@5 + token budget + latency.
- Agents (3): Worker · Reviewer · Verifier.
- Exit: precision@5 ≥60%; median ≤1.5K tokens; p95 <800ms.
- Depends on: M1. Parallel with C1.

**Loop C3 — "听劝记账" (heed instrumentation)** — auto-record heed/not-heed/not-triggered
verdicts (check-action wiring + nightly dream fallback) → feeds proof_confidence.
- Agents (3): Worker · Reviewer · Verifier.
- Exit: ≥80% of injected corrections get a verdict within session or by next dream.
- Depends on: M1. Parallel with C1/C2.

**Loop C4 — "A/B" (outcome uplift, long-running)** — injection ON/OFF alternating by
session; count repeat-correction events per arm. Runs in background 3–4+ weeks.
- Agents (2): Worker (switch + logging) · Verifier (readout, later).
- Exit (at readout, Phase 4): ≥20% uplift or published null.
- Depends on: C1–C3 landed (else it A/B-tests a leaky system).

### PHASE 2 — Referee (the benchmark) · B1 starts parallel with Phase 1

**Loop B1 — "规格圆桌" (benchmark spec round-table)**
- Design the cross-session correction-transfer benchmark: task pipeline (error →
  correction → persist → fresh session → recurrence?), corpus plan (real scrubbed via
  `corrections-export/v1` + synthetic generator + donation pipeline), anti-gaming
  design (hidden split, fixed prompts protocol — the Mem0-Zep lesson), scoring
  (recall*/FP/lead-time, Wilson), adapter interface.
- Agents (11): Grounding ×2 (read predict-loo + MemoryAgentBench/STATE-Bench) →
  Lenses ×6 (eval design, statistics, gaming-adversary, engine integrator,
  corpus/privacy, reproducibility) → Adversarial reviewers ×2 (Opus) → Synthesis ×1 (Opus).
- Exit: spec survives adversarial review with all invented-API claims purged.
- **Naming = tongwu decision (naming is P0).** Candidates: `CorrectionBench` (safe,
  descriptive) · `HeedBench` (what it measures) · `RMR-Bench` (metric-first). Pick at G1.
- Depends on: research report only. Start immediately after G0.

**Loop B2 — "造机器" (harness + adapters)**
- Extend predict-loo into a vendor-neutral harness (matchFn seam exists); adapters:
  plain-files baseline · AgentRecall · Hindsight (Docker live) · Mem0 OSS.
- Agents (5): Worker ×2 parallel (harness+baseline / engine adapters) · Reviewer ·
  security-reviewer (egress runs through scrubForExport) · Verifier.
- Exit: one command runs end-to-end on ≥3 backends; deterministic re-run (same corpus
  hash → same numbers).
- Depends on: B1.

**Loop B3 — "基线出版" (versioned baseline publication)** — backlog #6 lands here.
- METHODOLOGY.md + baseline artifact incl. AgentRecall's own (low) scores.
- Agents (3): Worker · Reviewer · Verifier.
- **GATE G2 (human): publishing = push.**
- Depends on: B2 + M1.

**Loop B4 — "外验" (reproduce-from-docs)** — a fresh agent in a clean clone follows the
docs only; friction fixed until it passes.
- Agents (2): Fresh executor · Fixer.
- Exit: outsider reproduction succeeds.
- Depends on: B3.

### PHASE 3 — Ledger (interleaves after B1)

**Loop L1 — MemoryBackend write seam** (backlog #3; mirror RecallBackend dynamic-import
pattern; design must serve B2's adapter interface — schedule after B1 to avoid rework).
- Agents (4): Worker · Reviewer · security-reviewer · Verifier.
**Loop L2 — `ar scrub` CLI fail-closed (#4) + corrections as sync store (#5)** (respect
PERSONAL_PATH_MARKER tier decision).
- Agents (4): Worker · Reviewer · security-reviewer · Verifier.
**Loop L3 — Hindsight cookbook PR** — staged and ready TODAY; only needs **GATE G-PR**.
- Agents (2): Pre-submit checklist executor (HANDOFF.md §7) · Verifier.
**Loop L4 — confidence disambiguation (#2)** — small; folded into B2's export mapping.

### PHASE 4 — Identity & distribution

**Loop D1 — README/identity rewrite** — claims-ledger driven: every claim cites a
measured number or is cut. Vocabulary shifts to what users search ("claude code memory
that learns from corrections"). Naming/taste = tongwu gate.
- Agents (3): Writer · fresh-eyes Reviewer · Verifier (claims-vs-evidence table).
- Depends on: C1–C3 numbers + B1 name.
**Loop D2 — registry hygiene** — npm repo URL, Smithery listing, 26-issue triage, Glama
related-servers. Non-push parts can start any time.
- Agents (2): Worker · Verifier. (npm-touching parts gated.)
**Loop D3 — launch** — the benchmark announcement IS the story ("we measured whether
agents actually stop repeating mistakes — nobody had"). HN/X + report.
- Agents (2): Writer · Reviewer. **GATE G3 (human): publish.**
- Depends on: B3 + C4 readout.

## 3. Dependency graph

```
G0 (identity confirm)
├── M1 ─┐                     ├── B1 (round-table) ──→ B2 ──→ B3 ──(G2)──→ B4
├── M2 ─┴──→ G1 ──→ C1 ─┐     │                        ↑
│                  C2 ──┼─→ C4 (3-4 wks wall-clock)    │ M1 baselines
│                  C3 ─┘        │                      │
├── D2 (hygiene, non-push)      │            L1, L2 (after B1 spec)
└── L3 ──(G-PR)── submit        └──→ readout ─┐
                                              ├──→ D1 ──→ D3 (G3)
                                     B3 ──────┘
```
Critical path A (product): M→G1→C1..C3→C4 accumulation→readout.
Critical path B (category): B1→B2→B3→B4→D3.
They deliberately overlap: B-track runs while C4 accrues calendar time.

## 4. Dispatch budget

| Phase | Loops | Dispatches |
|---|---|---|
| 0 Instrument | M1 M2 | 6 |
| 1 Close loop | C1–C4 | 12 |
| 2 Referee | B1–B4 | 21 |
| 3 Ledger | L1–L4 | 10 |
| 4 Identity | D1–D3 | 7 |
| **Total** | **17** | **~55** |

## 5. Kill-switches & pivots

1. **Denominator starvation** (M1 finds ≈0 recurrence events): RMR unmeasurable on real
   usage → Phase 1 becomes capture + dogfood volume only; benchmark corpus goes
   synthetic-first; targets re-based at G1.
2. **A/B null after C-fixes:** publish the null (credibility > marketing), demote the
   README promise, ledger/referee identity becomes primary — measurement is the product.
3. **Someone ships a correction-transfer benchmark first:** fast-follow with an adapter;
   our real-corpus + governance schema is the differentiator. (This is why B1 starts
   now, not after Phase 1.)
4. **Capture fixes degrade precision** (noise floods in): the 75% retraction gate is the
   backstop; revert to strict gate and accept lower recall.

## 6. Human gates summary

| Gate | Decision | When |
|---|---|---|
| G0 | Confirm identity A+B (referee+ledger); benchmark name shortlist | now |
| G1 | Lock numeric targets from M1/M2 baselines; pick benchmark name | after Phase 0 (~2 days) |
| G-PR | Hindsight cookbook PR submission | any time (ready today) |
| G2 | Publish benchmark baseline (push) | after B2 |
| G3 | Launch (HN/X) | after B3 + C4 readout |
| — | Standing REDLINE on any push/publish/bump | always |
```
