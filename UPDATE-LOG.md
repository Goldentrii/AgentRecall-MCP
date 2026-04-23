# AgentRecall — Update Log

This log tracks phase-by-phase improvements to AgentRecall's architecture, based on an honest review of the system as an agent that uses it. Each phase targets a specific design weakness. Phases run in sequence; later phases build on earlier ones.

---

## Improvement Plan Overview

| Phase | Theme | Status |
|-------|-------|--------|
| [Phase 1](#phase-1--reliability) | Reliability — stop memories from being lost | ✅ Done |
| [Phase 2](#phase-2--ambient-recall) | Ambient Recall — remove agent discretion from retrieval | ✅ Done |
| [Phase 3](#phase-3--multi-label-classification) | Multi-label Classification — memories findable from any angle | ✅ Done |
| [Phase 4](#phase-4--corrections-as-first-class-citizens) | Corrections as First-Class Citizens — behavioral calibration layer | ✅ Done |
| [Phase 2.5](#phase-25--intelligent-file-naming) | Intelligent File Naming — readable for humans, parseable for agents | 🔧 In Progress |
| [Phase 5](#phase-5--protocol-foundations) | Protocol Foundations — schema + cross-LLM interoperability | 🔲 Long-term |

---

## Phase 1 — Reliability
**Goal: nothing gets lost due to mechanics**

### What we fixed
The biggest failure mode: sessions end without `/arsave` being typed. Memories are lost. Agent had to remember to save — an agent under cognitive load won't.

### Changes

| Item | What | Status | Version |
|------|------|--------|---------|
| 1a | Stop hook → `ar hook-end` auto-fires on session end | ✅ Done | v3.3.x |
| 1b | UserPromptSubmit hook → `ar hook-correction` captures corrections silently on every user message | ✅ Done | v3.3.x |
| 1c | Contact link in README (email + GitHub Issues) | ✅ Done | v3.3.x |
| 1d | Benchmark caveat — honest disclaimer that numbers are modeled, not long-term production data | ✅ Done | v3.3.18 |

### Design reasoning
- Hooks move the save burden from agent discretion → harness enforcement
- `hook-correction` reads the UserPromptSubmit JSON, detects correction signals in user messages, and captures silently — agent never has to decide to call `remember`
- Benchmark honesty: the "without AR" scenario is modeled (we estimated re-explanation cost). Real production savings data doesn't exist yet. Overstating numbers hurts trust.

---

## Phase 2 — Ambient Recall
**Goal: relevant memories surface automatically; agent never has to decide to search**

### Problem
Current `recall` is agent-initiated pull. The agent has to know what it doesn't know — and call `recall` with the right query. Agents under cognitive load don't do this.

Human memory doesn't require deciding to remember. Context triggers retrieval automatically.

### Plan
`UserPromptSubmit` hook extracts keywords from the user's message → fires `recall` query → top 3-5 results injected into context before the agent responds. Agent never calls `recall` manually.

### Changes

| Item | What | Status | Version |
|------|------|--------|---------|
| 2a | `ar hook-ambient` command: read user message from stdin, extract keywords, run recall, output formatted results | ✅ Done | v3.3.18 |
| 2b | Add `hook-ambient` to `UserPromptSubmit` hooks in settings.json | ✅ Done | v3.3.18 |
| 2c | Terse recall output format for context injection (not JSON, plain text) | ✅ Done | v3.3.18 |

---

## Phase 3 — Multi-label Classification
**Goal: every memory is findable from multiple angles**

### Problem
Current routing sends each memory to ONE store (journal / palace / knowledge / awareness). A correction about "Next.js render prop removed in shadcn v4" gets routed to palace. Query for "shadcn" finds it. Query for "correction" or "breaking-change" doesn't.

Wrong classification = memory exists but is unfindable. Worse than not saving it.

### Plan
At save time: LLM assigns 3-5 semantic tags to each memory. Tags stored in YAML frontmatter. At query time: match any tag before RRF ranking. Memory palace "rooms" become tag namespaces, not exclusive storage silos — a memory can live in multiple rooms simultaneously.

### Changes

| Item | What | Status | Version |
|------|------|--------|---------|
| 3a | `generateTags()` — rule-based tag assignment at `remember` / `palace write` time | ✅ Done | v3.3.18 |
| 3b | YAML frontmatter: `tags: []` field written to all new palace memory files | ✅ Done | v3.3.18 |
| 3c | `palaceSearch` tag-union matching (+0.3 bonus to keyword_score, capped at 1.0) | ✅ Done | v3.3.18 |
| 3d | Migration script: backfill tags on existing memories | 🔲 Skipped — lower priority |

---

## Phase 4 — Corrections as First-Class Citizens
**Goal: behavioral corrections are the highest-priority memory type, treated as such**

### Problem
Right now, "no black backgrounds" is just another palace entry. It should be:
- Immediately captured (no deference to session end) ← Phase 1b partially addresses this
- Highest persistence (never expires, never compressed by rollup)
- Highest retrieval priority (always surfaces in ambient recall)
- Cross-agent (available to any agent working in this project)

This is the long-term moat. OpenAI/Anthropic native memory will store facts. AgentRecall owns the behavioral correction layer — the structured capture of human feedback and its propagation across agents, sessions, and projects.

### Formal correction schema (planned)
```
type: correction
trigger: negative feedback from human
fields: { rule, why, how_to_apply, project, date, severity }
priority: always_load
expiry: never
```

### Changes

| Item | What | Status | Version |
|------|------|--------|---------|
| 4a | `corrections.ts` — JSON store separate from palace, never rolled up | ✅ Done | v3.3.18 |
| 4b | `session_start` loads P0 corrections (max 5 most recent) | ✅ Done | v3.3.18 |
| 4c | Auto-severity detection: P0 (never/always/don't) / P1 (everything else) | ✅ Done | v3.3.18 |
| 4d | Cross-agent correction propagation — corrections available to all agents on same project | 🔲 Skipped — later |

---

## Phase 2.5 — Intelligent File Naming
**Goal: every file name tells both humans and agents what's inside, how big it is, and how it was saved — without opening the file**

### Problem
Current naming: `2026-04-20.md`, `2026-04-20-277b1f.md`. Humans can't tell what happened. Agents must open every file to decide relevance. Random session-ID suffixes mean nothing. In a directory with 50+ entries, both humans and agents waste time.

### Naming System

```
{date}--{save-type}--{lines}L--{topic-slug}.md
  │        │           │          │
  │        │           │          └── from generateSlug(summary) — semantic keywords
  │        │           └── wc -l at save time — factual cost signal
  │        └── arsave / arsaveall / hook-end / hook-correction / capture
  └── YYYY-MM-DD
```

**Examples:**
```
2026-04-20--arsaveall--45L--ar-phase1-4-publish.md
2026-04-20--hook-end--8L--auto.md
2026-04-18--arsave--120L--genome-review-v23-gateway.md
2026-04-18--hook-correction--12L--no-black-backgrounds.md
2026-04-17--capture--6L--nextjs-render-prop-gotcha.md
```

**Why lines, not tokens or weight:**
- `wc -l` is trivially computable — zero dependencies, zero classification risk
- 1 line ≈ 10-15 tokens — agents estimate context cost instantly
- Humans read naturally: "8L = stub, 120L = deep entry"
- Weight/importance is a judgment call that can be wrong. Lines are a fact.
- Agent decides importance itself using its own context — file just provides the cost

**`--` double-dash separator** — parseable by agents:
```
split("--") → [date, save-type, lines, topic]
```

### Changes

| Item | What | Status | Version |
|------|------|--------|---------|
| 2.5a | `sessionEnd` / `journalWrite` — new naming function using `{date}--{save-type}--{lines}L--{slug}.md` | 🔧 To build | — |
| 2.5b | CLI `hook-end` — use `{date}--hook-end--{lines}L--auto.md` | 🔧 To build | — |
| 2.5c | CLI `hook-correction` — use `{date}--hook-correction--{lines}L--{slug}.md` for any file output | 🔧 To build | — |
| 2.5d | `captureLogFileName()` — use `{date}--capture--{lines}L--{slug}.md` | 🔧 To build | — |
| 2.5e | CLI `hook-ambient` — no file output (stdout only), no change needed | ✅ N/A | — |
| 2.5f | Update README naming convention section | 🔧 After code | — |
| 2.5g | Migration: rename existing journal files to new format (optional, low priority) | 🔲 Later | — |

### Design Principles
- **Facts over judgment** — line count is objective; weight is subjective
- **Agent decides importance** — filename provides cost, agent decides relevance
- **Human glanceable** — readable in file browser without opening
- **Parseable** — `split("--")` gives structured fields

---

## Phase 5 — Protocol Foundations
**Goal: define what AgentRecall IS, not just what it does**

### What "protocol" means here
A protocol is an agreement about format and behavior that anyone can implement. AgentRecall protocol = agreement about:
1. What a memory is (schema — required fields, types)
2. How agents store it (API surface)
3. How agents retrieve it (query rules, ranking)
4. What a correction is (behavioral layer, separate from factual memory)

When defined, any agent (Claude, GPT, Gemini) can read/write the same memory store. That's interoperability. That's where the intelligent gap starts to close across systems.

### Timeline
**Not now. 12-18 months from now.** After phases 1-4 are validated in real-world use.

### Changes (long-term planned)

| Item | What | Status |
|------|------|--------|
| 5a | Memory schema spec (language-agnostic, versioned) | 🔲 Long-term |
| 5b | API surface definition (OpenAPI or similar) | 🔲 Long-term |
| 5c | Cross-LLM adapter (GPT, Gemini read/write same store) | 🔲 Long-term |
| 5d | Correction protocol spec (behavioral calibration as a standard) | 🔲 Long-term |

---

## Version History

| Version | Date | Phase | Changes |
|---------|------|-------|---------|
| v3.3.x | 2026-04 | Phase 1 (partial) | `hook-end`, `hook-correction`, `hook-start` wired into harness |
| v3.3.18 | 2026-04-17 | Phase 1 complete | Benchmark caveat added; UPDATE-LOG created |
| v3.3.18 | 2026-04-17 | Phase 2+3+4 | hook-ambient, multi-label tags, corrections store |
| v3.3.19 | 2026-04-19 | README redesign | Package READMEs focused (mcp=284L, core=336L) |
| v3.3.23 | 2026-04-22 | Agent Experience V2 | watch_for clean rules, remember path routing, recall confidence labels, graph edges fix |
| v3.3.24 | 2026-04-22 | Palace + /arsave | Intent capture, palace selectivity rules, two arsave modes, /arstatus Why field, d<N> delete, AGENTS.md, commands.md |
| v3.3.26 | 2026-04-23 | Bug fixes | listAllProjects: smart-named journals now counted (3 projects were invisible); awareness truncation at section boundaries |
| v3.3.27 | 2026-04-23 | Bug fixes | Remove _cachedProject singleton (re-detect each call); ar rooms + session_start topics now use room description instead of raw content keywords |
| — | — | Phase 2.5 | Intelligent file naming system |
| — | — | Phase 5 | Protocol spec |

---

## Design Principles (from the review session, 2026-04-17)

1. **Hooks over discretion** — critical saves must be harness-enforced, not agent-decided
2. **Push over pull** — inject relevant memories automatically; don't wait for agent to search
3. **Multi-label over single-bucket** — memories are findable from any semantic angle
4. **Corrections over facts** — behavioral feedback is the highest-value memory type
5. **Honest benchmarks** — modeled estimates are disclosed as such; real data is the goal
6. **One-instruction simplicity** — users want to type one thing and know everything is safe
7. **Intelligent gap** — the long-term goal is not memory storage but reducing translation loss between human intent and agent execution
8. **Facts over judgment in metadata** — line count (fact) beats weight (judgment) for file naming. Agent decides importance; system provides cost.
