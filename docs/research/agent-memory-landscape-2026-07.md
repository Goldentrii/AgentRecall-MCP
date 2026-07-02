# AgentRecall vs. the Agent-Memory Landscape — Research Report

*Generated: 2026-07-02 | Sources: ~40 (GitHub API, arXiv, vendor docs/blogs, npm registry, Glama, HN Algolia) | Confidence: High on landscape/benchmarks, Medium on sentiment (Reddit/X blocked)*

Method: 3 parallel research agents (competitor landscape / evaluation landscape / AgentRecall public footprint) + local ground-truth measurement (predict-loo run, corrections corpus census, repo inspection).

---

## Executive Summary

1. **The "memory layer" category is crowded, commoditized, and benchmark-gamed.** Mem0 (~60K★), Graphiti/Zep (~28K★), Supermemory (~28K★), Cognee (~27K★), Letta (~24K★), Hindsight (~18K★), MemOS (~10K★). Every one of them claims SOTA on the same 2–3 benchmarks; the claims are mutually inconsistent and the Mem0-vs-Zep dispute documents outright benchmark gaming (denominator manipulation, prompt tampering worth 25+ points).
2. **Memory-as-retrieval is a solved-enough, losing battlefield. Memory-as-behavioral-change is unoccupied.** No public benchmark as of mid-2026 measures "given a past correction, does the agent avoid repeating the mistake in a NEW session." Every existing benchmark (LongMemEval, LoCoMo, MemBench, MemoryAgentBench) tests retrieval or within-session updates. The June 2026 self-improvement survey explicitly flags that the field conflates post-adaptation accuracy with genuine self-improvement.
3. **AgentRecall's data model is native to that unoccupied ground** (severity / weight / recurrence / retraction / heeded / proof_confidence — corrections as governed first-class objects), and its eval harness (predict-loo, anti-self-confirming, honest-by-design) is a primitive version of exactly the missing benchmark.
4. **But AgentRecall is currently losing as a product**: npm downloads −54% (Apr→Jun 2026), zero organic discussion (0 HN hits), invisible to the queries users actually type ("claude code memory"), 350× behind Mem0 on downloads, 26 unanswered GitHub issues signaling abandonment.
5. **And the machine-to-data ratio is inverted**: 40+ tool modules, 720 tests, FSRS/RRF/palace/journal/dreaming — sitting on **23 active corrections** (91 total, 75% retracted) from essentially one user. The bottleneck is capture density, not retrieval technology (confirmed 5× by internal loops).

**Strategic read:** stop competing as a memory engine; claim the referee + ledger position — the measurement standard and governance layer for correction-learning — which the whole field gestures at and nobody has built or measured.

---

## 1. Competitor Landscape (mid-2026)

| Product | Stars | License | Architecture | Local? | Corrections focus | Coding-agent focus | Self-claimed quality |
|---|---|---|---|---|---|---|---|
| Mem0 | ~60K | Apache-2.0 | vector+BM25+entity hybrid; Apr-2026 ADD-only pivot | both | Low | High (skills for Claude Code/Cursor/Codex) | LoCoMo 91.6, LongMemEval 94.8 (self-reported, unreplicated) |
| Graphiti (Zep) | ~28K | Apache-2.0 | temporal knowledge graph (Neo4j), bi-temporal edges | Graphiti local / Zep cloud | Low | Medium (MCP) | DMR/LongMemEval SOTA claims (disputed) |
| Supermemory | ~28K | MIT | fact extraction + profiles + memory graph + RAG connectors | both | Low | **Highest** (Claude Code plugin, /context command) | "#1 on LongMemEval, LoCoMo, ConvoMem" (unverified) |
| Cognee | ~27K | Apache-2.0 | knowledge graph + vector + Postgres | local-first | Low (one unverified README line) | Medium (CC plugin: captures traces, syncs at session end) | BEAM 0.79@100K / 0.67@10M |
| Letta (MemGPT) | ~24K | Apache-2.0 | agent-editable in-context memory blocks | both | Medium (self-write thesis) | Medium (Letta Code CLI) | Own leaderboard; flat-file agent scored 74% LoCoMo |
| Hindsight | ~18K | MIT | biomimetic: world facts + experiences + mental models; retain/recall/reflect | both | **High** ("agents that learn, not just remember") | Medium (skills) | LongMemEval 91.4% (indep. reproduced by Virginia Tech) |
| MemOS | ~10K | Apache-2.0 | 4-tier (traces/policies/world-model/skills) + correction feedback API | both | **High** (NL correction API) | Medium (OpenClaw/Hermes) | LoCoMo 75.8; +35% token savings (self-reported) |
| Memobase | ~2.8K | Apache-2.0 | user profiles + event timeline, SQL-only reads | both | Low | Low | LoCoMo SOTA claim |
| LangMem | ~1.5K | MIT | library over LangGraph BaseStore; hot-path + background | LangGraph cloud path | Low | Low | none advertised |
| **AgentRecall** | **306** | MIT | markdown-file corrections ledger + 5-layer memory, keyword+RRF, FSRS-lite | **local-only by default, zero cloud** | **Native** (the data model IS corrections governance) | High (Claude Code lifecycle hooks) | honest evals, low scores published |

Cross-cutting facts:
- **Who owns "learns from mistakes"?** Hindsight (positioning + reflect op) and MemOS (correction feedback API) come closest. **Nobody has shipped a rigorously benchmarked correction-learning system.** Cognee's "never repeats the same mistake" is a single unverified README line.
- **Coding-agent land grab is on**: Supermemory, Mem0, Cognee all shipped Claude Code plugins/skills in 2026. MCP is the converged integration path.
- **Zep deprecated its OSS product** (Nov 2024) → cloud-only; community fragmented. Mem0's Apr-2026 ADD-only pivot suggests the prior update/delete approach had consistency problems.

## 2. Evaluation Landscape — and the Gap

| Benchmark | Measures | Blind spot |
|---|---|---|
| LongMemEval (ICLR'25) | 5 abilities incl. knowledge updates, abstention | updates are within-conversation; LLM-judge variance; config gaming (k=42 incident) |
| LoCoMo (ACL'24) | long-conversation QA | synthetic; ~6.4% label errors; gamed (Mem0-Zep dispute); flat files score 74% → doesn't discriminate architectures |
| MemBench (ACL'25) | factual vs reflective memory; capacity | low adoption; reflective ground-truth hard |
| MemoryAgentBench (ICLR'26) | retrieval, test-time learning, long-range, conflict resolution | TTL is within-session; **everyone fails conflict resolution** (Zep 7% FC-SH, Mem0 18%) |
| Letta Leaderboard | operational memory management via tool calls | single-session synthetic ops |
| STATE-Bench (Microsoft, May 2026) | "agents improve with experience on enterprise tasks" | closest candidate; exact operationalization unverified |
| Reflexion/Voyager literature | same-task retry improvement | intra-session; no cross-session correction persistence |

**The confirmed gap:** no public benchmark implements the pipeline *(a) error occurs → (b) correction captured → (c) persisted → (d) fresh session with error-triggering conditions → (e) measure recurrence*. All benchmarks test memory as **information retrieval**; none tests memory as **behavioral change**. Mem0's own 2026 state-of-memory report lists cross-session identity and staleness as hardest open problems. No vendor dashboard exposes a "correction recall" metric.

AgentRecall's `predict-loo` (leave-one-out, anti-self-confirming, achievable-vs-theoretical denominators) is a primitive, honest instance of exactly this missing pipeline — currently scoring 0/8 achievable recall (keyword mode) on a 91-correction corpus, which is itself diagnostic: **the corpus is too thin to front-run mistakes; the ceiling is data density** (5th internal confirmation).

## 3. AgentRecall Public Footprint (outsider view)

- GitHub `Goldentrii/AgentRecall-MCP`: 306★ / 52 forks / 26 open issues (0 responded in 6 months per Glama) / last push 2026-06-29 / MIT / 720 tests.
- npm (all v3.4.35): `agent-recall-mcp` 272/wk; monthly trend **6,012 (Apr) → 3,374 (May) → 2,759 (Jun) = −54%**. Mem0: 95,049/wk (~350×).
- Discoverability: **0 HN hits**, 0 Glama comments, 1 Glama favorite, not on Smithery (404), Glama quality score 83% (tool-def average 3.7/5), Glama-channel telemetry shows no usage in 30 days. npm metadata still points at the pre-rename repo URL.
- **Vocabulary mismatch**: "correction-first" is not a term users search. "claude code memory" queries do not surface AgentRecall at all. Niche competitors in that exact query space: openclaw-supermemory 789★, mnemon 371★, auto-memory 361★.
- 60-second outsider impression (verbatim from research agent): *"impressive README, sparse community proof, no organic third-party discussion, and a download trajectory that is falling not growing."*

## 4. Local Ground Truth (2026-07-02)

- Corpus: **91 corrections, 19 projects, 23 active** (75% retracted — the quality gate works but the survivors are few).
- predict-loo (keyword): 0 fired / 0 hits / RECALL* 0% (0/8 achievable) / FP 0% (0/40). Semantic mode historically 2/13; embeddings evaluated and declined (no lift over lexical on this corpus — data density is the ceiling).
- Engineering surface: 40+ tools-logic modules; v3.4.35 added proof_count, Beta-evidence proof_confidence over heeded/recurrence, ranked P0 surfacing, supersession, staleness review — i.e., the **governance schema for outcome measurement exists**, but aggregate outcome numbers (repeat-mistake rate, heed rate) have never been computed.
- README promise "Every correction saved is a mistake never repeated" is currently **unfalsified marketing** — the system that could falsify or support it (its own eval + heed/recurrence fields) hasn't been pointed at the claim.

## 5. Identity Thesis

Three honest answers to "what is AgentRecall, really":

1. **As a market product:** a 306-star also-ran in a category where the leader has 200× the stars and 350× the distribution. Head-on "memory layer" competition is structurally lost.
2. **As an artifact:** an over-engineered, under-fed governance engine — a 720-test machine wrapped around 23 active rules. Its rarest property is not a feature but a habit: **honest measurement** (anti-self-confirming evals, published low scores) in a field where the leaders publish gamed numbers.
3. **As an idea:** early and correct. The field's own trajectory (Hindsight's "learn, not just remember", MemOS's correction API, Letta's self-improvement thesis, Microsoft's STATE-Bench) is converging on correction-learning — but nobody measures it, and no standard exists for capturing, governing, or exchanging corrections. AgentRecall already has the schema (`corrections-export/v1`), the scrubbed egress, and the embryonic benchmark.

**AgentRecall is not a memory engine. It is (a) a governed corrections ledger and (b) the missing measurement instrument for correction-learning — currently mislabeled as a memory tool.**

## 6. Strategic Options

- **A. Referee play (recommended spearhead):** productize the missing benchmark — cross-session correction transfer ("does the agent stop repeating the mistake?"). Extend predict-loo into a vendor-neutral harness with adapters (plain-files baseline, Mem0, Hindsight, Zep) over the `corrections-export/v1` schema; publish honest baselines including AgentRecall's own low scores. In a benchmark-gamed field, the honest referee with a real-world corpus becomes the authority. Weakness→asset conversion.
- **B. Ledger play (recommended body):** "git for your agent's mistakes." Lean fully into capture + governance; ship the `MemoryBackend` write seam (backlog #3) so any engine (Hindsight/Mem0/Zep) is a pluggable belief store. The Hindsight cookbook PR is the first instance of exactly this pattern.
- **C. Vertical UX play:** own the Claude Code power-user loop (arstatus/arstart/arsave, dashboard, dreaming). Continue as dogfooding substrate — it generates the corpus — but Supermemory/Mem0 outgun on distribution; don't bet the identity here.
- **D. Park it.** Included for honesty given OKR pressure; argued against because the unoccupied ground is real and adjacent to what's already built.

A+B compose: the benchmark defines the category's success metric; the ledger + export schema is the reference implementation every engine must integrate to be scored. This continues the existing Memory→Understanding plan (predict-the-correction north star) — the research validates that instinct as the only unclaimed high ground.

## 7. Agent-Centric Quality Metrics (what "good" means when the user is an agent)

**Outcome (north star):**
| Metric | Definition | Status today |
|---|---|---|
| **RMR — Repeat-Mistake Rate** | of correction-classes active at session start, % that recur in later sessions | **computable now** from `recurrence` — never aggregated |
| **Heed Rate** | when a correction was injected AND its trigger situation arose, % complied | schema exists (`heeded`) — never aggregated; denominator needs check-action + dream audit |
| **Outcome uplift (A/B)** | corrections-per-session with injection ON vs OFF | not run; the only honest marketing number possible |

**Funnel (leading indicators):**
| Stage | Metric | Status |
|---|---|---|
| Capture | % of real human-pushback events captured as corrections | unknown — suspected biggest leak (23 active rules after months of heavy use); nightly dream can audit transcripts |
| Durability | % captured surviving retraction | 25% today — tune gate |
| Injection | precision@k of session_start items; tokens per injected item | feedback KPI exists; compare vs Mem0 ~7K tokens/query |
| Prediction | predict-loo RECALL* (achievable) | 0/8 — density ceiling metric |
| Cold start | time/tokens to working context vs re-derivation | unmeasured |
| Cross-surface | correction captured in Claude Code heeded in Codex | adapter shipped, unmeasured (OQ-6) |

**Agent-ergonomics (P0 "LLM uses it right on first try"):** session_start latency; injection size vs context budget; tool-description first-try success (Glama tool-def 3.7/5 → improvable); zero-config bootstrap.

Per the June-2026 self-improvement survey: keep **memory quality** (funnel) and **outcome uplift** (RMR/heed/A-B) as separate scoreboards — conflating them is the field's standard evaluation mistake.

## 8. Immediate, Cheap, High-Value Moves

1. Compute RMR + heed-rate aggregates from existing recurrence/heeded data (a script, not a feature).
2. Reconcile README promise with measured reality — either qualify the claim or earn it with the A/B.
3. Fix distribution hygiene: npm repo URL, respond/triage the 26 issues, Smithery listing, retitle vocabulary toward queries users type ("claude code memory that learns from corrections").
4. Nightly-dream capture audit: sample transcripts, count missed corrections → measures the capture leak.
5. Decide the identity (A+B vs C) explicitly — the current README sells C's promise with A's evidence standards and B's architecture, which satisfies none of them.

---

## Sources

**Competitors:** github.com/mem0ai/mem0 · github.com/getzep/graphiti · github.com/getzep/zep · arxiv.org/abs/2501.13956 (Zep) · github.com/letta-ai/letta · github.com/langchain-ai/langmem · github.com/topoteretes/cognee · arxiv.org/abs/2505.24478 (Cognee) · github.com/vectorize-io/hindsight · github.com/supermemoryai/supermemory · github.com/memodb-io/memobase · github.com/MemTensor/MemOS · arxiv.org/abs/2507.03724 (MemOS) · github.com/IAAR-Shanghai/Awesome-AI-Memory

**Benchmarks:** arxiv.org/abs/2410.10813 (LongMemEval) · arxiv.org/abs/2506.21605 (MemBench) · arxiv.org/abs/2507.05257 + github.com/HUST-AI-HYZ/MemoryAgentBench · github.com/getzep/zep-papers/issues/5 (Mem0-Zep dispute) · blog.getzep.com/lies-damn-lies-statistics-is-mem0-really-sota-in-agent-memory/ · xmemory.ai/chasing-sota-in-ai-memory/ · letta.com/blog/letta-leaderboard · letta.com/blog/benchmarking-ai-agent-memory (flat-file 74%) · mem0.ai/blog/state-of-ai-agent-memory-2026 · opensource.microsoft.com/blog/2026/05/19/introducing-state-bench · openreview.net/forum?id=IUltZSgLMm (self-improvement survey)

**Footprint:** api.github.com (star counts 2026-07-02) · npmjs.com/package/agent-recall-mcp + npm downloads API · glama.ai/mcp/servers/Goldentrii/AgentRecall-MCP (+/score) · smithery.ai (404) · hn.algolia.com (0 hits)

**UNVERIFIED / flagged:** Mem0 2026 scores (self-reported); Supermemory "#1 on three benchmarks" (no table); Cognee "never repeats mistakes" (single line); STATE-Bench operationalization (blog only); Reddit/X sentiment (blocked — gap); PulseMCP listing (blocked).

**Methodology:** 3 parallel research agents, ~35 searches, 14 deep-reads, GitHub API cross-checks via gh CLI, local eval run (predict-loo), corrections corpus census.
