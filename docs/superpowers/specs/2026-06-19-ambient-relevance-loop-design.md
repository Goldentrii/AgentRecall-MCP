# Ambient Relevance Loop — automatic, precise read/write memory

**Date:** 2026-06-19
**Status:** Design — awaiting review, not yet planned/built
**Origin:** Real customer feedback (relayed via Telegram): "读取/写入 should be automatically triggered … a good memory project triggers what's worth writing and what's worth recalling — that accuracy is the core. Without it, you're just a database, not better than Postgres." tongwu accepts the critique. Brainstormed with the orchestrator over 5 rounds (2026-06-19).

---

## 1. Problem

AgentRecall is automatic at session **boundaries** (`session_start` injects context; `session_end` writes + classifies the journal; corrections auto-capture). But **between** the boundaries it is inert:

- To save something mid-session, the agent must *choose* to call `remember`.
- To pull something relevant, it must *choose* to call `recall`.

The project's own **Automaticity Law** (measured, README line 326): pull tools had **zero** organic calls across 44 projects over weeks. So mid-session recall never fires, and granular writes depend on agent discretion that doesn't happen. The system degrades to "a markdown database you query by hand" — barely better than Postgres.

The customer's deeper point, sharpened: the moat is **not** "automatic triggering" (that's the mechanism). The moat is **relevance accuracy** — judging *what's worth writing* and *what's worth surfacing right now*. Auto-triggering a blunt heuristic produces the opposite failure: context-flooding noise the user disables.

## 2. Goal & success metric

**Goal:** the agent receives exactly the 1–2 memories that matter on a given turn, and only durable things get written — with little-to-no agent effort, and without polluting the context.

**North-star metric (new):** `injection_precision = used / injected` — of the memories AgentRecall surfaces, the fraction the agent actually acts on. This is the number that proves "we're not just a database." It rides the existing outcome loop / ALIGNMENT machinery.

**Non-goals (YAGNI):** not building our own model; not a new storage engine; not replacing the boundary model — extending it. Not chasing 100% of clients in v1 (see §7).

## 3. The binding constraint (why this design, not another)

**An MCP server is blind to the conversation.** It only sees tool-call *arguments*, never the turn-by-turn dialogue. So it cannot judge "the right memory for this moment" because it doesn't know the moment. Every design decision below flows from giving the server *ears* and borrowing a *brain* it already has access to.

## 4. Architecture — Sense → Surface → Judge → Stage → Promote

A continuous loop on hook-capable hosts; the same loop collapsed to boundaries elsewhere (§7).

### READ path (per user turn)
1. **Sense** — a host `UserPromptSubmit` hook passes the user's message to AgentRecall (`ar hook-onprompt` or equivalent CLI entry).
2. **Surface** — cheap **local** retrieval over the palace/journal: lexical (BM25/keyword) + salience + recency/FSRS + correction-match. Returns top candidates **gated by a confidence threshold**. *If nothing clears the bar, return nothing.* Silence is precision. (Embeddings are an optional enhancement, off by default — see §8.)
3. **Judge** — the surfaced candidates (≤ K, default K=3) are injected into the agent's context via the hook's output, framed minimally: "Possibly relevant prior memory — use if it helps, ignore otherwise." The agent's own frontier model — already loaded, free to us — decides what to actually use. This converts pull→push, which the Automaticity Law shows is the channel that works.

### WRITE path (continuous capture, curated promotion)
4. **Stage** — a host `Stop`/`PostToolUse` hook silently appends each meaningful exchange to a per-project **staging buffer** (`~/.agent-recall/projects/<slug>/_staging/`). Zero agent effort; nothing is ever lost. Staging is itself retrievable by Surface (so this-session content is recallable before promotion).
5. **Promote** — at `session_end` (and optionally every N turns), the in-room model reviews the staging buffer and **promotes only durable items** into the palace/journal: dedupes against existing entries (reuse P1-1 compression), routes to rooms (existing auto-routing). The palace stays clean; raw remains in staging/journal. This is the literal answer to "only what's worth writing gets written" — *and* fixes "nothing granular gets saved" (everything is staged, then curated).

## 5. Components (each isolated, one purpose)

| Component | Does | Interface | Depends on |
|-----------|------|-----------|------------|
| **Sense hook adapter** | Receives a turn from the host hook, normalizes it | CLI: `ar hook-onprompt` (stdin: hook JSON → stdout: injection text) | host hook contract |
| **Surfacer** | Local retrieval + threshold + top-K | `surface(project, queryText) → Candidate[]` | palace/journal read, salience, optional embeddings |
| **Injector** | Formats candidates as hook stdout the host injects | `format(Candidate[]) → string` | host injection format |
| **Stager** | Appends exchanges to `_staging/` | `stage(project, exchange)` | fs |
| **Promoter** | Curates staging → palace at boundary, dedupes/routes | `promote(project, stagingBatch, modelJudgment)` | P1-1 compression, room routing |
| **Precision meter** | Tracks injected vs used | extends outcome loop | corrections/_outcomes |

Each is independently testable: Surfacer can be unit-tested against a fixture palace; Stager/Promoter against a temp root (matches existing `benchmark/*.mjs` pattern).

## 6. Precision guardrail ("noise stays out")

- **Read cap + threshold:** ≤ K candidates, only above a confidence floor; nothing relevant → inject nothing.
- **Measure:** `injection_precision = used / injected`, surfaced on the dashboard (new panel or fold into Correction Precision). A falling number is the early-warning that the threshold is mis-tuned.
- **Kill switch:** an env var / config to disable ambient injection per-project if it ever annoys (trust through reversibility).

## 7. Graceful degradation (non-hook hosts: Cursor, Hermes, etc.)

No hooks → no per-turn Sense. The loop runs at **boundaries** instead of continuously:
- `session_start` injection (exists today) does the Surface+Judge once at the top.
- `session_end` runs Promote.
- Optional: a thin "recall now" the agent can call when it chooses (weak, but available).

Same data model and components; only the *cadence* changes. This preserves the "compatible with everything" goal while reserving true ambient behavior for the primary surface (Claude Code).

## 8. Zero-cloud preservation (non-negotiable product value)

- Default retrieval is **fully local** — lexical + salience + recency, no network, no model call. This must work with zero API keys.
- Embeddings (semantic retrieval) remain **opt-in** via the existing `AGENT_RECALL_EMBEDDING_*` env vars.
- The "judge" is the agent's own model — AgentRecall spends **no** model calls of its own.
- Net: the loop adds zero cloud dependency. The "zero cloud by default" badge stays true.

## 9. Phasing (decompose into implementable chunks)

1. **P-A — Staging + boundary promote** (write path, no hooks needed). Lowest risk, immediate value, testable in isolation. Extends `session_end`.
2. **P-B — Sense/Surface/Inject via Claude Code hooks** (read path, primary surface). The headline automaticity.
3. **P-C — Precision meter + dashboard panel.** Proves the moat to the customer.
4. **P-D — Graceful-degrade boundary mode** for non-hook hosts.

Each phase ships independently and is separately verifiable.

## 10. Risks & open questions (honest)

- **Hook API specifics** differ by host; the Claude Code hook contract (stdin/stdout shape, injection mechanism) must be confirmed against current docs before P-B. *(verify, don't assume)*
- **Latency budget:** per-turn Surface must be ≤ ~tens of ms (prior perf work already bounded recall — reuse the timeout/circuit-breaker).
- **`used` is hard to measure precisely:** detecting whether the agent *used* an injected memory is inferential (does the recalled content appear in subsequent output / tool calls?). P-C needs a defensible heuristic; may start coarse.
- **Promotion quality** depends on the in-room model following the session_end review prompt; needs the same honest-reporting discipline as the rest of the system.
- **Context cost:** even ≤3 injected candidates add tokens every turn; the threshold must be conservative at launch (precision over recall).

## 11. Out of scope (explicit)

Building/Bundling a local model; replacing the journal/palace storage; cross-agent realtime sync; anything that requires the cloud by default.

---

*This design is the orchestrator's output. Implementation (plan + build) goes to the terminal implementer per `docs/ORCHESTRATION.md`, with review gates. No push/publish/version-bump without explicit approval (REDLINE).*
