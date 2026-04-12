<h1 align="center">AgentRecall</h1>

<p align="center"><strong>Your agent doesn't just remember. It learns how you think.</strong></p>
<p align="center">Every correction saved is a mistake never repeated. Every insight compounded is tokens never wasted rebuilding context.</p>
<p align="center">Persistent, compounding memory + automatic correction capture. MCP server + SDK + CLI.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-recall-mcp"><img src="https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square&label=MCP&color=5D34F2" alt="MCP npm"></a>
  <a href="https://www.npmjs.com/package/agent-recall-sdk"><img src="https://img.shields.io/npm/v/agent-recall-sdk?style=flat-square&label=SDK&color=0EA5E9" alt="SDK npm"></a>
  <a href="https://www.npmjs.com/package/agent-recall-cli"><img src="https://img.shields.io/npm/v/agent-recall-cli?style=flat-square&label=CLI&color=10B981" alt="CLI npm"></a>
  <a href="https://github.com/Goldentrii/AgentRecall/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP-5_tools-orange?style=flat-square" alt="Tools">
  <img src="https://img.shields.io/badge/cloud-zero-blue?style=flat-square" alt="Zero Cloud">
  <img src="https://img.shields.io/badge/Obsidian-compatible-7C3AED?style=flat-square" alt="Obsidian">
  <img src="https://img.shields.io/badge/overhead-~831_tokens%2Fsession-22C55E?style=flat-square" alt="Token overhead">
  <img src="https://img.shields.io/badge/saves-thousands_long--term-22C55E?style=flat-square" alt="Token savings">
</p>

<p align="center">
  <b>EN:</b>&nbsp;
  <a href="#why-choose-agentrecall">Why</a> ·
  <a href="#three-ways-to-use-it">Use</a> ·
  <a href="#what-is-agentrecall">What</a> ·
  <a href="#quick-start">Install</a> ·
  <a href="#5-mcp-tools">Tools</a> ·
  <a href="#how-memory-compounds">Compounding</a> ·
  <a href="#sdk-api">SDK</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#docs">Docs</a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <b>中文:</b>&nbsp;
  <a href="#agentrecall中文文档">简介</a> ·
  <a href="#快速开始">安装</a> ·
  <a href="#5-个-mcp-工具">工具</a> ·
  <a href="#记忆如何复合增长">复合</a> ·
  <a href="#sdk-api-1">SDK</a> ·
  <a href="#架构">架构</a>
</p>

---

<p align="center">
  <a href="#arsave-and-arstart"><img src="https://img.shields.io/badge/%2Farsave-Save_Session-FF6B6B?style=for-the-badge" alt="/arsave"></a>
  <a href="#arsave-and-arstart"><img src="https://img.shields.io/badge/%2Farstart-Load_Context-4ECDC4?style=for-the-badge" alt="/arstart"></a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/AUTO-hook--start-8B5CF6?style=for-the-badge" alt="hook-start">
  <img src="https://img.shields.io/badge/AUTO-hook--correction-F97316?style=for-the-badge" alt="hook-correction">
  <img src="https://img.shields.io/badge/AUTO-hook--end-06B6D4?style=for-the-badge" alt="hook-end">
</p>
<p align="center">
  <a href="#how-memory-compounds"><img src="https://img.shields.io/badge/1-AUTO--NAMING-5D34F2?style=for-the-badge" alt="Auto-Naming"></a>
  <a href="#how-memory-compounds"><img src="https://img.shields.io/badge/2-INDEXES-0EA5E9?style=for-the-badge" alt="Indexes"></a>
  <a href="#how-memory-compounds"><img src="https://img.shields.io/badge/3-RELATIVITY-10B981?style=for-the-badge" alt="Relativity"></a>
  <a href="#how-memory-compounds"><img src="https://img.shields.io/badge/4-WEIGHT_%2B_DECAY-F59E0B?style=for-the-badge" alt="Weight + Decay"></a>
  <a href="#how-memory-compounds"><img src="https://img.shields.io/badge/5-FEEDBACK_LOOP-EF4444?style=for-the-badge" alt="Feedback Loop"></a>
</p>

## `/arsave` and `/arstart`

> **Two commands. That's all you need.**

| Command | When | What it does |
|---------|------|-------------|
| **`/arsave`** | End of session | Write journal + consolidate to palace + update awareness + optional git push |
| **`/arstart`** | Start of session | Recall cross-project insights + walk palace + load context |

Type `/arsave` after a long project session. Everything gets saved. Type `/arstart` next time. Everything loads back.

```bash
# Install commands (one-time, Claude Code only)
mkdir -p ~/.claude/commands
curl -o ~/.claude/commands/arsave.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arsave.md
curl -o ~/.claude/commands/arstart.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arstart.md
```

### The Difference

```
WITHOUT AgentRecall                    WITH AgentRecall
──────────────────                     ────────────────

Day 1: Build monorepo                 Day 1: /arstart → /arsave
Day 2: "What monorepo?"               Day 2: /arstart
  → 20 min re-explaining                → 2 sec: loads all decisions
  → Agent repeats same mistakes          → Knows "no version inflation"
  → Forgets your priorities              → Knows "arsave = hero section"
  → Misses half the tasks                → Pushes to both repos
```

### Three Layers of Value

**Layer 1 (5 seconds):** It makes your AI agent remember what happened last session.

**Layer 2 (30 seconds):** Every time you correct your agent — "no, not that version", "ask me first" — that correction is stored permanently and recalled before the agent makes the same mistake again. After 10 sessions, your agent understands your priorities, your communication style, your non-negotiables.

**Layer 3 (2 minutes):** The [Intelligent Distance Protocol](https://github.com/Goldentrii/AgentRecall/wiki/Intelligent-Distance). The structural gap between human thinking and AI action can't be closed — but it can be navigated better every session. Corrections are training data. The 200-line awareness cap forces quality over quantity. Cross-project insights mean lessons learned once apply everywhere.

### Real Session Flow

This is from an actual multi-day project where a human gave scattered, non-linear instructions. The agent used AgentRecall throughout:

```
Session 1 (Tuesday)                          Session 2 (Wednesday, different agent)
─────────────────                            ─────────────────────────────────────

/arstart                                     /arstart
  │                                            │
  ├─ session_start() ──→ identity,             ├─ session_start() ──→ loads Tuesday's
  │   top insights, active rooms,              │   decisions in ~400 tokens,
  │   cross-project matches,                   │   watch_for: "structurize input"
  │   watch_for warnings                       │
  │                                            ├─ recall("SDK CLI monorepo") ──→
  ├─ recall("SDK CLI versions") ──→            │   • "no version inflation"
  │   • "structurize scattered input"          │   • "arsave/arstart = hero section"
  │   • "search before building"               │
  │   • "ask when ambiguous"                   ├─ Continues exactly where
  │                                            │  Session 1 left off
  ▼                                            │
Human: "we need SDK, CLI,                     ▼
  update README, fix versions"               Human: "publish to npm,
  │                                           update both GitHub repos"
  ├─ check(goal="SDK+CLI+README",             │
  │   confidence="medium")                    ├─ No re-explanation needed.
  │   → 4 tasks detected                      │   Agent already knows the
  │   → present plan → human confirms         │   monorepo structure, package
  │                                           │   names, and version policy.
  ├─ Execute in order:                        │
  │   1. Core extraction ✓                    └─ Done in 2 minutes
  │   2. Tool logic split ✓                       (vs 20 min cold start
  │   3. MCP wrappers ✓                             without AgentRecall)
  │   4. SDK + CLI ✓
  │
/arsave
  │
  └─ session_end(summary, insights, trajectory)
       → journal + awareness + palace — one call
```

---

## Why Choose AgentRecall

**AgentRecall is not a memory tool. It's a learning loop.**

Memory is the mechanism. Understanding is the goal. Every time you correct your agent — "no, not that version", "put this section first", "ask me before you assume" — that correction is stored, weighted, and recalled next time. After 10 sessions, your agent doesn't just remember your project. It understands how you think: your priorities, your communication style, your non-negotiables.

This is the **Intelligent Distance Protocol** — not closing the gap between human and AI (that gap is structural), but navigating it better every session.

- **Your agent learns how you think.** Humans are inconsistent — we skip from A to E, forget what we said yesterday, change priorities mid-sentence. AgentRecall captures every correction and surfaces it before the next mistake. The gap between what you mean and what your agent does shrinks with every session.

- **Compounding awareness, not infinite logs.** Memory is capped at 200 lines. New insights either merge with existing ones (strengthening them) or replace the weakest. After 100 sessions, your awareness file is still 200 lines — but each line carries the weight of cross-validated, confirmed observations.

- **Cross-project recall.** Lessons learned in one project apply everywhere. Built a rate limiter last month? That lesson surfaces when you're building one today — in a different repo, through a different agent.

- **Near-universal compatibility.** MCP server for any MCP-compatible agent (Claude Code, Cursor, Windsurf, VS Code, Codex). SDK for any JS/TS framework (LangChain, CrewAI, Vercel AI SDK, custom agents). CLI for terminal and CI workflows. One memory system, every surface.

- **Zero cloud, zero telemetry, all local.** Everything is markdown on disk. Browse it in Obsidian, grep it in the terminal, version it in git. No accounts, no API keys, no lock-in.

### Use Case 1: The Scattered Human

A real session where the human gave non-linear, scattered instructions across a 2-day project:

> Human: "we need SDK, CLI, also update README, oh and the npm versions are wrong, fix those too"

Without AgentRecall, the agent guesses priority and misses items. With AgentRecall:

| What the agent already knew | How it knew |
|---|---|
| "This human communicates in scattered bursts — structurize into modules before executing" | `awareness_update` from 3 prior sessions |
| "Ask when ambiguous, proceed when clear" | `alignment_check` correction stored last week |
| "No version inflation — this human cares about semver discipline" | `nudge` captured mid-session, recalled immediately |

Result: Agent presented a structured 4-step plan, human confirmed, zero rework. A fresh agent without AgentRecall would have guessed wrong on versions, buried the most important feature in the README, and published without testing.

### Use Case 2: The Cross-Project Lesson

An engineer built a proxy server with rate limiting (Project A). Three weeks later, started an API gateway (Project B).

```
/arstart on Project B:
  recall_insight: "Rate limiting prevents runaway costs"
    → source: Project A, confirmed 3x, severity: critical
    → applies_when: ["api", "proxy", "rate-limit", "cost"]
    → The lesson from Project A surfaces automatically in Project B
```

The engineer never mentioned rate limiting. AgentRecall matched the project context against the global insights index and surfaced it proactively.

### Use Case 3: The Correction That Sticks

Session 1: Agent uses version 4.0.0 for a patch release. Human corrects: "That's version inflation. Use 3.3.4."

Session 2 (next day, different agent): Awareness already contains "no version inflation — this human cares about conservative versioning." The new agent gets it right the first time.

Without AgentRecall, the same correction would be needed again. And again. And again. With AgentRecall, **every correction happens exactly once.**

---

## Three Ways to Use It

**MCP** — for AI agents (Claude Code, Cursor, Windsurf, VS Code, Codex):
```bash
claude mcp add --scope user agent-recall -- npx -y agent-recall-mcp
```

**SDK** — for any JS/TS application (LangChain, CrewAI, Vercel AI SDK, custom):
```typescript
import { AgentRecall } from "agent-recall-sdk";
const memory = new AgentRecall({ project: "my-app" });
await memory.capture("What stack?", "Next.js + Postgres");
```

**CLI** — for terminal workflows and CI:
```bash
npx agent-recall-cli capture "What stack?" "Next.js + Postgres"
npx agent-recall-cli palace walk --depth active
```

---

## What Is AgentRecall?

A **learning system** that bridges the gap between how humans think and how AI agents work. Not a log. Not a database. A compounding loop where every correction, decision, and insight makes the next session better than the last.

**The problem:** AI agents don't truly forget — they lose focus. Priorities blur across sessions. Lessons go dormant. The same misunderstanding happens twice because no one stored the correction. The gap between what you mean and what your agent does stays constant, session after session.

**The fix:** AgentRecall stores knowledge in a five-layer memory pyramid — from quick captures to cross-project insights — and forces compression so memory gets more valuable over time. But more importantly, it closes the **Intelligent Distance** gap: every human correction is captured, weighted, and recalled before the agent makes the same mistake again.

| Without AgentRecall | With AgentRecall |
|---------------------|------------------|
| Agent forgets yesterday's decisions | Decisions live in palace rooms, loaded on cold start |
| Same mistake repeated across sessions | `recall_insight` surfaces past lessons before work starts |
| 5 min context recovery on each session start | 2 second cold start from palace (~200 tokens) |
| Flat memory files that grow forever | 200-line awareness cap forces merge-or-replace |
| Knowledge trapped in one project | Cross-project insights match by keyword |
| Agent misunderstands, you correct, it forgets | `alignment_check` records corrections permanently |

---

## Quick Start

### MCP Server (for AI agents)

```bash
# Claude Code
claude mcp add --scope user agent-recall -- npx -y agent-recall-mcp

# Cursor — .cursor/mcp.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# VS Code — .vscode/mcp.json
{ "servers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# Windsurf — ~/.codeium/windsurf/mcp_config.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# Codex
codex mcp add agent-recall -- npx -y agent-recall-mcp
```

**Skill (Claude Code only):**
```bash
mkdir -p ~/.claude/skills/agent-recall
curl -o ~/.claude/skills/agent-recall/SKILL.md \
  https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/SKILL.md
```

### SDK (for JS/TS applications)

```bash
npm install agent-recall-sdk
```

```typescript
import { AgentRecall } from "agent-recall-sdk";

const memory = new AgentRecall({ project: "my-app" });

// Capture knowledge
await memory.capture("What ORM?", "Drizzle — type-safe, lightweight");

// Write to memory palace
await memory.palaceWrite("architecture", "Stack: Next.js 16 + Drizzle + Postgres");

// Cold start — load project context in ~200 tokens
const context = await memory.coldStart();

// Recall cross-project insights
const insights = await memory.recallInsight("rate limiting");

// Walk the palace at different depths
const walk = await memory.walk("active");
```

### CLI (for terminal and CI)

```bash
npm install -g agent-recall-cli
# or use npx: npx agent-recall-cli <command>
```

```bash
# Capture a Q&A pair
ar capture "What ORM?" "Drizzle" --project my-app

# Read today's journal
ar read --date latest

# Walk the memory palace
ar palace walk --depth active

# Search across all memory
ar search "rate limiting" --include-palace

# Recall cross-project insights
ar insight "building auth middleware"

# Write to a palace room
ar palace write architecture "Switched from REST to tRPC"

# Compact old journals into weekly summaries
ar rollup --min-age-days 14
```

---

## How an Agent Uses AgentRecall

### Automatic (Zero Discipline — Hooks)

Wire once in `~/.claude/settings.json`. Every session is captured automatically, even without `/arsave`:

```json
{
  "hooks": {
    "SessionStart": [{
      "command": "node ~/.local/share/npm/lib/node_modules/agent-recall-cli/dist/index.js hook-start 2>/dev/null || true"
    }],
    "UserPromptSubmit": [{
      "command": "node ~/.local/share/npm/lib/node_modules/agent-recall-cli/dist/index.js hook-correction 2>/dev/null || true"
    }],
    "Stop": [{
      "command": "node ~/.local/share/npm/lib/node_modules/agent-recall-cli/dist/index.js hook-end 2>/dev/null || true"
    }]
  }
}
```

- **hook-start** — on every session open: prints identity + top insights + watch_for warnings
- **hook-correction** — on every prompt: detects corrections (regex) and captures them silently  
- **hook-end** — on every session close: appends a lightweight end-of-session log entry

### Session Start (`/arstart`)
```
session_start()  → identity, insights, active rooms, cross-project matches,
                   recent journal briefs, watch_for warnings — all in one call
recall(query)    → surface task-specific past knowledge from all stores
```

### During Work
```
remember("We decided to use GraphQL instead of REST")  → auto-routes to the right store
recall("authentication design")                          → searches all stores, ranked results
check(goal="build auth", confidence="medium")            → verify understanding, get warnings
```

### Session End (`/arsave`)
```
session_end(summary="...", insights=[...], trajectory="...")  → journal + awareness + consolidation
```

---

## 5 MCP Tools

AgentRecall exposes exactly 5 tools to agents. Each tool composes multiple subsystems internally — the agent doesn't need to know about the plumbing.

| Tool | What it does |
|------|-------------|
| `session_start` | Load project context for a new session. Returns identity, top insights, active rooms, cross-project matches, recent activity, and predictive `watch_for` warnings from past corrections. One call, ~400 tokens. |
| `remember` | Save a memory. Auto-classifies content (bug fix, architecture decision, insight, session note) and routes to the right store (journal, palace, knowledge, or awareness). Auto-generates semantic names for future retrieval. |
| `recall` | Search all memory stores at once — palace, journal, and insights. Returns ranked results with stable IDs. Accepts `feedback` to rate previous results: positive boosts future ranking, negative penalizes. Query-aware — feedback from one search doesn't bleed into unrelated queries. |
| `session_end` | Save everything in one call. Writes journal, updates awareness with new insights, consolidates to palace rooms, archives demoted insights (not deleted — preserved with resurrection support). |
| `check` | Record what you think the human wants. Returns `watch_for` patterns from past correction history ("You've been corrected on X 3 times — ask about it"). Accepts `human_correction` and `delta` after the human responds. Auto-promotes strong patterns (3+) to awareness. |

### Legacy tools

The original 22 subsystem tools (palace_write, journal_capture, awareness_update, etc.) remain available via the SDK and CLI for backward compatibility and advanced use cases. They are not registered in the MCP server by default.

---

## How Memory Compounds

<p align="center">
  <a href="#1-auto-naming"><img src="https://img.shields.io/badge/1-AUTO--NAMING-5D34F2?style=for-the-badge" alt="Auto-Naming"></a>
  <a href="#2-indexes"><img src="https://img.shields.io/badge/2-INDEXES-0EA5E9?style=for-the-badge" alt="Indexes"></a>
  <a href="#3-relativity"><img src="https://img.shields.io/badge/3-RELATIVITY-10B981?style=for-the-badge" alt="Relativity"></a>
  <a href="#4-weight--decay"><img src="https://img.shields.io/badge/4-WEIGHT_%2B_DECAY-F59E0B?style=for-the-badge" alt="Weight + Decay"></a>
  <a href="#5-feedback-loop"><img src="https://img.shields.io/badge/5-FEEDBACK_LOOP-EF4444?style=for-the-badge" alt="Feedback Loop"></a>
</p>

> Memory is not a list. It's a compounding system where 1+1+1 > 3. Each subsystem feeds the next — naming enables retrieval, retrieval enables feedback, feedback enables ranking, ranking surfaces the right memory at the right time. After 10 sessions, the system knows more than any individual memory contains.

### 1. Auto-Naming

The agent knows content best at the moment of saving. AgentRecall captures that understanding in a semantic slug — not `"mcp-verified"` but `"verified-agentrecall-mcp-22tools-functional"`.

```
Content: "Fixed a critical bug where the payment processor crashed on refunds"
  → Type detected: bug-fix
  → Keywords extracted: payment, processor, crashed, refunds
  → Slug generated: bug-fix-payment-processor-crashed
```

Good naming IS the first layer of retrieval. A well-named memory is 80% findable without any search algorithm.

### 2. Indexes

Every memory has an address in three index systems:

| Index | What it tracks | Token cost |
|-------|---------------|------------|
| **Palace index** | Room catalog + salience scores | ~50 tokens to scan |
| **Insights index** | Cross-project lessons + keyword matching | ~30 tokens to query |
| **Awareness** | 200-line compounding document (forced merge) | ~200 tokens, but each line carries cross-validated weight |

Indexes are cheap pointers. The agent scans indexes first, then loads full content only when needed.

### 3. Relativity

Memories that relate to each other are connected automatically — no wikilinks needed.

```
Agent writes: "JWT refresh rotation prevents session fixation"
  → Keywords: jwt, refresh, rotation, session
  → Room "architecture" has tags: ["technical"]
  → Room "knowledge" has a lesson about "session management"
  → Auto-edge created: architecture ←→ knowledge (weight 0.3)
```

When you `recall("session security")`, the system surfaces keyword-matched memories across connected rooms. Edges are stored in `graph.json` and are available for traversal — relativity turns isolated memories into a knowledge graph.

### 4. Weight + Decay

Not all memories are equal. Salience scoring ensures the right memory surfaces first:

```
salience = recency(0.30) + access(0.25) + connections(0.20) + urgency(0.15) + importance(0.10)
```

- Architecture decisions decay at 0.98/day (persistent). Blockers decay at 0.90/day (ephemeral).
- Memories you actually access get stronger. Memories you never revisit fade.
- Demoted insights don't die — they go to the archive. If a future insight matches, they resurrect.

### 5. Feedback Loop

The system learns what's useful and what's not:

```
Session 1: recall("auth design") → returns 5 results
  Agent rates: result #1 useful, result #3 not useful
  → Stored in feedback-log.json with query context

Session 2: recall("auth patterns") → similar query
  → Result #1 gets +0.03 score boost (confirmed useful)
  → Result #3 gets -0.05 penalty (confirmed useless)
  → Rankings shift: useful memories rise, noise sinks
```

Feedback is query-aware — rating a result "useless" for "auth design" doesn't penalize it for "database schema". The system learns per-context, not globally.

### The Compounding Effect

```
Session 1:   Save 3 memories (auto-named, indexed, edges created)
Session 5:   Recall surfaces memories from sessions 1-4, feedback refines ranking
Session 10:  watch_for warns agent about past mistakes before they repeat
Session 20:  Awareness contains 10 cross-validated insights (merged from 40+ raw observations)
Session 50:  The agent knows your priorities, blind spots, and communication style
             — not because it was told, but because every correction compounded
```

Each layer multiplies the others. Auto-naming makes indexing useful. Indexing makes relativity possible. Relativity makes recall precise. Precise recall generates meaningful feedback. Feedback makes the next recall even better. The loop compounds.

---

## SDK API

The `agent-recall-sdk` package exposes the `AgentRecall` class — a programmatic interface to the full memory system. Use it to add persistent, compounding memory to any JS/TS agent framework: LangChain, CrewAI, Vercel AI SDK, AutoGen, or your own.

```typescript
import { AgentRecall } from "agent-recall-sdk";

const ar = new AgentRecall({ project: "my-project" });
```

### Core Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `capture(question, answer, opts?)` | `JournalCaptureResult` | Quick Q&A capture (L1 memory) |
| `journalWrite(content, opts?)` | `JournalWriteResult` | Write daily journal entry |
| `journalRead(opts?)` | `JournalReadResult` | Read journal by date or "latest" |
| `journalSearch(query, opts?)` | `JournalSearchResult` | Full-text search across journals |
| `coldStart()` | `JournalColdStartResult` | Palace-first context loading (~200 tokens) |

### Palace Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `palaceWrite(room, content, opts?)` | `PalaceWriteResult` | Write to a room with fan-out cross-refs |
| `palaceRead(room?, topic?)` | `PalaceReadResult` | Read room content or list all rooms |
| `walk(depth?, focus?)` | `PalaceWalkResult` | Progressive walk: identity → active → relevant → full |
| `palaceSearch(query, room?)` | `PalaceSearchResult` | Search rooms by content |
| `lint(fix?)` | `PalaceLintResult` | Health check and auto-archive |

### Awareness & Insight Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `awarenessUpdate(insights, opts?)` | `AwarenessUpdateResult` | Compound new insights into awareness |
| `readAwareness()` | `string` | Read the 200-line awareness document |
| `recallInsight(context, opts?)` | `RecallInsightResult` | Cross-project insight recall |

### Alignment Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `alignmentCheck(input)` | `AlignmentCheckResult` | Record confidence + assumptions |
| `nudge(input)` | `NudgeResult` | Detect contradictions with past decisions |
| `synthesize(opts?)` | `ContextSynthesizeResult` | L3 synthesis, optional palace consolidation |

### LangChain / CrewAI Integration Example

```typescript
import { AgentRecall } from "agent-recall-sdk";

const memory = new AgentRecall({ project: "langchain-app" });

// Before agent runs — load context
const context = await memory.coldStart();
const insights = await memory.recallInsight("current task description");

// Inject into system prompt
const systemPrompt = `You have persistent memory:\n${context.summary}\n\nRelevant insights:\n${insights.matches.map(m => m.insight).join("\n")}`;

// After agent runs — save what was learned
await memory.capture("What did the agent decide?", agentOutput);
await memory.awarenessUpdate([{
  insight: "Rate limiting needs token bucket, not fixed window",
  evidence: "Fixed window caused burst failures in load test",
  applies_when: ["rate-limiting", "api-design", "load-testing"]
}]);
```

---

## CLI Commands

The `agent-recall-cli` package provides the `ar` command for terminal workflows, CI pipelines, and quick access to your agent's memory outside of an editor.

```
ar v3.3.12 — AgentRecall CLI

JOURNAL:
  ar read [--date YYYY-MM-DD] [--section <name>]
  ar write <content> [--section <name>]
  ar capture <question> <answer> [--tags tag1,tag2]
  ar list [--limit N]
  ar search <query> [--include-palace]
  ar state read|write [data]
  ar cold-start
  ar archive [--older-than-days N]
  ar rollup [--min-age-days N] [--dry-run]

PALACE:
  ar palace read [<room>] [--topic <name>]
  ar palace write <room> <content> [--importance high|medium|low]
  ar palace walk [--depth identity|active|relevant|full]
  ar palace search <query>
  ar palace lint [--fix]

AWARENESS:
  ar awareness read
  ar awareness update --insight "title" --evidence "ev" --applies-when kw1,kw2

INSIGHT:
  ar insight <context> [--limit N]

META:
  ar projects
  ar synthesize [--entries N]
  ar knowledge write --category <cat> --title "t" --what "w" --cause "c" --fix "f"
  ar knowledge read [--category <cat>]

HOOKS (auto-wired via settings.json — zero discipline required):
  ar hook-start      # SessionStart: prints identity + insights + watch_for
  ar hook-correction # UserPromptSubmit: silently captures corrections from prompt
  ar hook-end        # Stop: appends end-of-session log entry

GLOBAL FLAGS:
  --root <path>     Storage root (default: ~/.agent-recall)
  --project <slug>  Project override
```

---

## Architecture

### Five-Layer Memory Pyramid

```
L1: Working Memory     journal_capture           "what happened"
L2: Episodic Memory    journal_write             "what it means"
L3: Memory Palace      palace_write / walk       "knowledge across sessions"
L4: Awareness          awareness_update          "compounding insights"
L5: Insight Index      recall_insight            "cross-project experience"
```

### Key Mechanisms

**Fan-out writes** — Write to one room, cross-references auto-update in related rooms via `[[wikilinks]]`. Mechanical, zero LLM cost.

**Salience scoring** — Every room has a salience score: `recency(0.30) + access(0.25) + connections(0.20) + urgency(0.15) + importance(0.10)`. High-salience rooms surface first. Below threshold → auto-archive.

**Compounding awareness** — `awareness.md` is capped at 200 lines. When new insights are added, similar existing ones merge (strengthen), dissimilar ones compete (lowest-confirmation gets replaced). The constraint creates compression. Compression creates compounding.

**Cross-project insight recall** — `insights-index.json` maps insights to situations via keywords. `recall_insight("building quality gates")` returns relevant lessons from any project, ranked by severity x confirmation count.

**Obsidian-compatible** — Every palace file has YAML frontmatter + `[[wikilinks]]`. Open `palace/` as an Obsidian vault → graph view shows room connections. Zero Obsidian dependency.

### Storage Layout

```
~/.agent-recall/
  awareness.md                    # 200-line compounding document (global)
  awareness-state.json            # Structured awareness data
  awareness-archive.json          # Demoted insights (preserved, not deleted)
  insights-index.json             # Cross-project insight matching
  projects/
    <project>/
      journal/
        YYYY-MM-DD.md             # Daily journal
        YYYY-MM-DD-log.md         # L1 captures (hook-start/hook-end entries)
        YYYY-MM-DD.state.json     # JSON state
        index.jsonl               # Fast machine-scannable index of all entries
      palace/
        identity.md               # ~50 token project identity card
        palace-index.json          # Room catalog + salience scores
        graph.json                 # Cross-reference edges (relativity)
        feedback-log.json          # Per-query feedback scores (recall learning)
        alignment-log.json         # Past corrections for watch_for patterns
        rooms/
          goals/                   # Active goals, evolution
          architecture/            # Technical decisions, patterns
          blockers/                # Current and resolved
          alignment/               # Human corrections
          knowledge/               # Learned lessons by category
          <custom>/                # Agents create rooms on demand
```

---

## Platform Compatibility

| Platform | MCP | SDK | CLI | Notes |
|----------|:---:|:---:|:---:|-------|
| Claude Code | ✅ | ✅ | ✅ | Full support — MCP + SKILL.md + commands |
| Cursor | ✅ | ✅ | ✅ | MCP via .cursor/mcp.json |
| VS Code (Copilot) | ✅ | ✅ | ✅ | MCP via .vscode/mcp.json |
| Windsurf | ✅ | ✅ | ✅ | MCP via mcp_config.json |
| OpenAI Codex | ✅ | ✅ | ✅ | `codex mcp add` — config.toml |
| Claude Desktop | ✅ | — | — | MCP server |
| LangChain / LangGraph | — | ✅ | — | `new AgentRecall()` in your chain |
| CrewAI | — | ✅ | — | SDK in tool definitions |
| Vercel AI SDK | — | ✅ | — | SDK in server actions |
| Custom JS/TS agents | — | ✅ | ✅ | SDK + CLI for any agent framework |
| CI / GitHub Actions | — | — | ✅ | `npx agent-recall-cli` in workflows |
| Any MCP agent | ✅ | — | — | Standard MCP protocol |

---

## Real Results

Validated over 42+ sessions across 5 production projects:
- Cold-start: **5 min → 2 seconds** (palace-first loading, ~400 tokens)
- Decision retention: **0% → 100%** across sessions
- Misunderstanding caught before wrong work: **6+ instances** via `check` before publish/deploy
- Repeated mistakes prevented: **3 instances** via cross-project insight recall

### Measured Token Cost (v3.3.12, 3 rounds)

| Surface | What it returns | Measured tokens |
|---------|----------------|-----------------|
| `hook-start` (stdout) | identity + watch_for + 3 insights + recent + cross-project hint | ~215 |
| `session_start` (MCP) | full session context — all fields | ~601 |
| `check` (MCP) | watch_for patterns + past deltas | ~80 |
| **Total session overhead** | | **~896 tokens** |

Each prevented correction ≈ **1,500 tokens saved** (re-explanation + wrong work + retry).  
Breakeven: **less than 1 correction prevented per session** covers the overhead.  
At 42 sessions with avg 1.5 corrections prevented: **~94,000 tokens saved** vs ~37,600 overhead.

### What the 3 Test Rounds Verified

**Round 1 — hook-start:**  
Fires on session open (with per-session lock to avoid double-fire). Output: project identity, past correction warnings (watch_for), top 3 awareness insights, today's journal brief, cross-project hint. All in 9 lines.

**Round 2 — capture / palace write / search / walk:**  
- `capture "bug fix"` → routes to journal log with auto-tags
- `palace write architecture "..."` → writes to room with fan-out
- `search "journal crash fix"` → keyword match finds the entry from 2 minutes ago
- `palace walk --depth active` → loads 5 rooms, top 10 insights, architecture decisions in one JSON

**Round 3 — hook-correction / hook-end / MCP tools:**  
- `hook-correction` with no-correction prompt → silent exit (correct)
- `hook-correction` with correction ("no use patch not minor") → silent capture, exit 0
- `hook-end` → exit 0, auto-log entry
- MCP `session_start` → 601 tokens, all 7 fields populated
- MCP `check(goal="publish v3.3.12", confidence="high")` → 80 tokens, 1 watch_for pattern surfaced

172 tests (129 core + 4 smoke + 28 SDK + 11 CLI), 0 failures. Build clean.

---

## Docs

| Document | Description |
|----------|-------------|
| [Intelligent Distance Protocol](docs/intelligent-distance-protocol.md) | The foundational theory — why the gap between human and AI is structural, and how to navigate it |
| [MCP Adapter Spec](docs/mcp-adapter-spec.md) | Technical spec for building adapters on top of AgentRecall |
| [SDK Design](docs/sdk-design.md) | Design doc for the SDK architecture |
| [Upgrade v3.4](UPGRADE-v3.4.md) | Changelog: weekly roll-up, palace-first cold start, promotion verification |

---

## Contributing

Built by [tongwu](https://github.com/Goldentrii) at [Novada](https://www.novada.com).

- Issues & feedback: [GitHub Issues](https://github.com/Goldentrii/AgentRecall/issues)
- Email: [tong.wu@novada.com](mailto:tong.wu@novada.com)
- Website: [novada.com](https://www.novada.com)

MIT License.

---

---

# AgentRecall（中文文档）

> **你的智能体记不清楚？听不懂你说话？每次项目都做得非常乱？**
>
> **AgentRecall 让它学会理解你的思维方式。**
>
> 赋能agent长期记忆，并从错误中学习和纠正，随时间和项目难度进化，越来越擅长和了解用户和agent的思维。
>
> 持久复合记忆 + 智能距离协议。MCP 服务器 + SDK + CLI。

---

<p align="center">
  <a href="#arsave-and-arstart"><img src="https://img.shields.io/badge/%2Farsave-保存会话-FF6B6B?style=for-the-badge" alt="/arsave"></a>
  <a href="#arsave-and-arstart"><img src="https://img.shields.io/badge/%2Farstart-加载上下文-4ECDC4?style=for-the-badge" alt="/arstart"></a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/自动-hook--start-8B5CF6?style=for-the-badge" alt="hook-start">
  <img src="https://img.shields.io/badge/自动-hook--correction-F97316?style=for-the-badge" alt="hook-correction">
  <img src="https://img.shields.io/badge/自动-hook--end-06B6D4?style=for-the-badge" alt="hook-end">
</p>
<p align="center">
  <a href="#记忆如何复合增长"><img src="https://img.shields.io/badge/1-自动命名-5D34F2?style=for-the-badge" alt="自动命名"></a>
  <a href="#记忆如何复合增长"><img src="https://img.shields.io/badge/2-索引-0EA5E9?style=for-the-badge" alt="索引"></a>
  <a href="#记忆如何复合增长"><img src="https://img.shields.io/badge/3-关联性-10B981?style=for-the-badge" alt="关联性"></a>
  <a href="#记忆如何复合增长"><img src="https://img.shields.io/badge/4-权重与衰减-F59E0B?style=for-the-badge" alt="权重与衰减"></a>
  <a href="#记忆如何复合增长"><img src="https://img.shields.io/badge/5-反馈回路-EF4444?style=for-the-badge" alt="反馈回路"></a>
</p>

## `/arsave` 和 `/arstart`

> **两个命令，ezpz。**

| 命令 | 时机 | 功能 |
|------|------|------|
| **`/arsave`** | 会话结束时 | 写入日志 + 整合到记忆宫殿 + 更新感知 + 可选 git 推送 |
| **`/arstart`** | 会话开始时 | 召回跨项目洞察 + 遍历宫殿 + 加载上下文 |

会话结束时输入 `/arsave`，所有内容自动保存。下次开始时输入 `/arstart`，所有上下文自动恢复。

```bash
# 安装命令（一次性，仅 Claude Code）
mkdir -p ~/.claude/commands
curl -o ~/.claude/commands/arsave.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arsave.md
curl -o ~/.claude/commands/arstart.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arstart.md
```

### 效果对比

```
没有 AgentRecall                        有 AgentRecall
──────────────                          ────────────

第 1 天：构建单仓                       第 1 天：/arstart → /arsave
第 2 天："什么单仓？"                   第 2 天：/arstart
  → 20 分钟重新解释                       → 2 秒：加载所有决策
  → 智能体重复同样的错误                  → 知道"不要版本膨胀"
  → 忘记你的优先级                        → 知道"arsave 要放首位"
  → 遗漏一半的任务                        → 自动推送两个仓库
```

### 三层价值

**第一层（5 秒）：** 让你的 AI agent 记住上次会话发生了什么。

**第二层（30 秒）：** 每次你纠正 agent——"不，不是那个版本"、"先问我"——这个纠正被永久存储，并在 agent 再犯同样错误之前被召回。10 次会话后，你的 agent 理解你的优先级、你的沟通风格、你的不可妥协项。

**第三层（2 分钟）：** [智能距离协议](https://github.com/Goldentrii/AgentRecall/wiki/Intelligent-Distance)。人类思维和 AI 行动之间的结构性鸿沟无法消除——但可以在每次会话中更好地穿越。纠正就是训练数据。200 行感知上限强制质量优于数量。跨项目洞察意味着学到一次的经验到处适用。

### 真实会话流程

以下来自一个真实的多日项目，人类给出了分散、非线性的指令。智能体全程使用 AgentRecall：

```
会话 1（周二）                                会话 2（周三，不同的智能体）
──────────                                    ────────────────────────

/arstart                                     /arstart
  │                                            │
  ├─ session_start() ──→ 身份 + 洞察           ├─ session_start() ──→ 加载周二
  │   活跃房间 + 跨项目匹配                    │   架构决策（约 400 token），
  │   watch_for 警告                           │   watch_for: "结构化输入"
  │                                            │
  ├─ recall("SDK CLI 版本") ──→               ├─ recall("SDK CLI 单仓") ──→
  │   • "结构化分散的输入"                     │   • "不要版本膨胀"
  │   • "先搜索再构建"                         │   • "arsave 放在最显眼的位置"
  │   • "模糊时询问，明确时执行"               │
  │                                            ├─ 从会话 1 离开的地方
  ▼                                            │  无缝继续
人类："我们需要 SDK、CLI，                     │
  更新 README，修复版本号"                     ▼
  │                                           人类："发布到 npm，
  ├─ check(goal="SDK+CLI+README",              更新两个 GitHub 仓库"
  │   confidence="medium")                     │
  │   检测到 4 个任务项                         ├─ 无需重新解释。
  │   → 呈现方案 → 人类确认                    │   智能体已经知道单仓结构、
  │                                             │   包名和版本策略。
  ├─ 按顺序执行：                               │
  │   1. 核心提取 ✓                             └─ 2 分钟完成
  │   2. 工具逻辑拆分 ✓                             （没有 AgentRecall
  │   3. MCP 封装 ✓                                   需要 2-8 分钟冷启动）
  │   4. SDK + CLI ✓
  │
/arsave
  │
  └─ session_end(summary, insights, trajectory)
       → 日志 + 感知 + 宫殿 — 一次调用全部完成
```

---

## 为什么选择 AgentRecall

**AgentRecall 不是记忆工具，而是学习循环。**

你的智能体在会话之间不是真的遗忘——它们是记不清楚、分不清主次，甚至听不懂你在说什么。AgentRecall 像人类记忆一样运作：把不重要的东西冬眠起来，但随时可以唤醒。更重要的是，它让智能体越用越懂你。

记忆是机制，理解才是目标。每次你纠正智能体 —— "不要那个版本"、"把这个部分放在最前面"、"做之前先问我" —— 这个纠正会被存储、加权、并在下次自动召回。10 个会话后，你的智能体不只是记住了你的项目，它理解了你的思维方式：你的优先级、你的沟通风格、你的底线。

这就是**智能距离协议** —— 不是消除人类与 AI 之间的差距（这个差距是结构性的），而是每次会话都导航得更好。

- **你的智能体学会理解你的思维。** 人类本身就是不一致的 —— 我们会从 A 直接跳到 E，跳过 B、C、D。我们会忘记昨天说的话，会在句子中间改变优先级。AgentRecall 捕获每一次纠正，在下一个错误发生之前浮现。你的意图和智能体行为之间的差距，每次会话都在缩小。

- **复合感知，而非无限日志。** 记忆上限 200 行。新洞察要么与已有的合并（增强），要么替换最弱的。100 个会话后，感知文件仍然是 200 行 —— 但每一行都承载着经过交叉验证的确认观察。

- **跨项目召回。** 在一个项目中学到的教训适用于所有项目。上个月做了限流器？今天在另一个项目构建时，那个教训会自动浮现。

- **近乎通用的兼容性。** MCP 服务器支持所有 MCP 兼容智能体（Claude Code、Cursor、Windsurf、VS Code、Codex）。SDK 支持任何 JS/TS 框架（LangChain、CrewAI、Vercel AI SDK、自定义智能体）。CLI 支持终端和 CI 工作流。一套记忆系统，覆盖所有场景。

- **零云端，零遥测，全部本地。** 一切都是磁盘上的 markdown。在 Obsidian 中浏览，在终端中 grep，在 git 中版本管理。无需账户、API 密钥或锁定。

### 用例一：跳跃式思维的人类

一个真实会话，人类在两天项目中给出了非线性、分散的指令：

> 人类："我们需要 SDK、CLI，还有更新 README，哦对了 npm 版本号也错了，一起修"

没有 AgentRecall，智能体猜测优先级，遗漏项目。有 AgentRecall：

| 智能体已经知道的 | 怎么知道的 |
|---|---|
| "这个人沟通是分散的 —— 先结构化成模块再执行" | 3 个先前会话的 `awareness_update` |
| "模糊时询问，明确时执行" | 上周 `alignment_check` 存储的纠正 |
| "不要版本膨胀 —— 这个人很在意语义化版本" | 会话中 `nudge` 捕获，立即召回 |

结果：智能体呈现结构化的 4 步方案，人类确认，零返工。没有 AgentRecall 的新智能体会猜错版本号、把最重要的功能埋在 README 深处、并且不测试就发布。

### 用例二：跨项目经验传递

一个工程师构建了带限流的代理服务器（项目 A）。三周后，开始构建 API 网关（项目 B）。

```
在项目 B 运行 /arstart：
  recall_insight："限流防止成本失控"
    → 来源：项目 A，确认 3 次，严重性：critical
    → 适用场景：["api", "proxy", "rate-limit", "cost"]
    → 项目 A 的教训在项目 B 中自动浮现
```

工程师从未提到限流。AgentRecall 自动匹配项目上下文与全局洞察索引。

### 用例三：纠正只发生一次

会话 1：智能体把补丁版本设为 4.0.0。人类纠正："这是版本膨胀，用 3.3.4。"

会话 2（第二天，不同的智能体）：感知系统已包含"不要版本膨胀 —— 这个人在意保守的版本策略"。新智能体第一次就做对了。

没有 AgentRecall，同样的纠正需要一次又一次。有 AgentRecall，**每个纠正只发生一次。**

---

## 三种使用方式

**MCP** — 面向 AI 智能体（Claude Code、Cursor、Windsurf、VS Code、Codex）：
```bash
claude mcp add --scope user agent-recall -- npx -y agent-recall-mcp
```

**SDK** — 面向任何 JS/TS 应用（LangChain、CrewAI、Vercel AI SDK、自定义）：
```typescript
import { AgentRecall } from "agent-recall-sdk";
const memory = new AgentRecall({ project: "my-app" });
await memory.capture("用什么技术栈？", "Next.js + Postgres");
```

**CLI** — 面向终端工作流和 CI：
```bash
npx agent-recall-cli capture "用什么技术栈？" "Next.js + Postgres"
npx agent-recall-cli palace walk --depth active
```

---

## AgentRecall 是什么？

一个**学习系统**，弥合人类思维方式与 AI 智能体工作方式之间的差距。不是日志，不是数据库——是一个复合循环，每一次纠正、决策和洞察都让下一次会话比上一次更好。

**问题：** AI 智能体不是真的遗忘——它们主要是无法抓住人类以为的重点。记不清楚优先级，分不清主次，教训进入休眠状态，同样的误解重复发生因为没人存储那次纠正行为。你的意图、目标和智能体行为之间的差距和割裂导致最终项目效果不佳。

**解决方案：** AgentRecall 将知识存储在五层记忆金字塔中——从快速捕获到跨项目洞察——并通过强制压缩让记忆随时间增值。但更重要的是，它缩小了**智能距离**差距：每一次人类的纠正都被捕获、加权、并在智能体犯同样错误之前被召回。

| 没有 AgentRecall | 有 AgentRecall |
|-----------------|---------------|
| 智能体忘记昨天的决策 | 决策存在宫殿房间，冷启动时加载 |
| 跨会话重复同样的错误 | `recall_insight` 工作前自动呈现过去教训 |
| 每次开始需要 5 分钟恢复上下文 | 2 秒冷启动，从宫殿加载（~200 token） |
| 平面记忆文件无限增长 | 200 行感知上限，强制合并或替换 |
| 知识锁在单个项目 | 跨项目洞察按关键词匹配 |

---

## 快速开始

### MCP 服务器（面向 AI 智能体）

```bash
# Claude Code
claude mcp add --scope user agent-recall -- npx -y agent-recall-mcp

# Cursor — .cursor/mcp.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# VS Code — .vscode/mcp.json
{ "servers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# Codex — ~/.codex/config.toml
codex mcp add agent-recall -- npx -y agent-recall-mcp
```

**Claude Code 技能安装：**
```bash
mkdir -p ~/.claude/skills/agent-recall
curl -o ~/.claude/skills/agent-recall/SKILL.md \
  https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/SKILL.md
```

### SDK（面向 JS/TS 应用）

```bash
npm install agent-recall-sdk
```

```typescript
import { AgentRecall } from "agent-recall-sdk";

const memory = new AgentRecall({ project: "my-app" });
await memory.capture("用什么 ORM？", "Drizzle — 类型安全、轻量");
await memory.palaceWrite("architecture", "技术栈：Next.js 16 + Drizzle + Postgres");
const context = await memory.coldStart();
```

### CLI（面向终端和 CI）

```bash
npm install -g agent-recall-cli

ar capture "用什么 ORM？" "Drizzle" --project my-app
ar palace walk --depth active
ar insight "构建认证中间件"
```

---

## 智能体使用流程

### 会话开始 (`/arstart`)
```
session_start()  → 身份、洞察、活跃房间、跨项目匹配、最近活动、watch_for 预警 — 一次调用
```

### 工作中
```
remember("我们决定用 GraphQL 替代 REST")    → 自动分类并路由到正确的存储
recall("认证设计")                           → 搜索所有存储，排名结果
check(goal="构建认证", confidence="medium")  → 验证理解，获取预警
```

### 会话结束 (`/arsave`)
```
session_end(summary="...", insights=[...], trajectory="...")  → 日志 + 感知 + 整合
```

---

## 5 个 MCP 工具

AgentRecall 目前只向 agent 提供 5 个工具。每个工具内部组合多个子系统 — agent 不需要了解内部管道。

| 工具 | 功能 |
|------|------|
| `session_start` | 加载项目上下文。返回身份、洞察、活跃房间、跨项目匹配、最近活动、以及来自历史纠正的 `watch_for` 预警。一次调用，约 400 token。 |
| `remember` | 保存记忆。自动分类内容（bug 修复、架构决策、洞察、会话笔记）并路由到正确的存储。自动生成语义化名称便于未来检索。 |
| `recall` | 一次搜索所有记忆 — 宫殿、日志、洞察。返回带稳定 ID 的排名结果。支持 `feedback` 评价结果：正面提升排名，负面降低。查询感知 — 某次搜索的反馈不影响无关查询。 |
| `session_end` | 一次调用保存全部。写入日志、更新感知、整合到宫殿、归档被替换的洞察（不删除 — 支持复活）。 |
| `check` | 记录你对人类意图的理解。返回历史纠正模式的 `watch_for` 预警。支持记录 `human_correction` 和 `delta`。3+ 次的强模式自动提升为感知洞察。 |

### 旧版工具

原始 22 个子系统工具（palace_write、journal_capture、awareness_update 等）通过 SDK 和 CLI 仍然可用，适用于向后兼容和高级用例。MCP 服务器默认不注册这些工具。

---

## 记忆如何复合增长

<p align="center">
  <a href="#1-自动命名"><img src="https://img.shields.io/badge/1-自动命名-5D34F2?style=for-the-badge" alt="自动命名"></a>
  <a href="#2-索引"><img src="https://img.shields.io/badge/2-索引-0EA5E9?style=for-the-badge" alt="索引"></a>
  <a href="#3-关联性"><img src="https://img.shields.io/badge/3-关联性-10B981?style=for-the-badge" alt="关联性"></a>
  <a href="#4-权重与衰减"><img src="https://img.shields.io/badge/4-权重与衰减-F59E0B?style=for-the-badge" alt="权重与衰减"></a>
  <a href="#5-反馈回路"><img src="https://img.shields.io/badge/5-反馈回路-EF4444?style=for-the-badge" alt="反馈回路"></a>
</p>

> 记忆不是清单，而是一个 1+1+1 > 3 的复合系统。每个子系统喂养下一个 — 命名使检索成为可能，检索使反馈成为可能，反馈使排名成为可能，排名让正确的记忆在正确的时间浮现。10 个会话后，系统知道的比任何单条记忆都多。

### 1. 自动命名

Agent 在保存的瞬间对内容理解最深。AgentRecall 把这种理解捕获为语义化的名称 — 不是 `"mcp-verified"` 而是 `"verified-agentrecall-mcp-22tools-functional"`。

```
内容: "修复了支付处理器在退款时崩溃的严重 bug"
  → 类型检测: bug-fix
  → 关键词提取: payment, processor, crashed, refunds
  → 生成名称: bug-fix-payment-processor-crashed
```

好的命名本身就是检索的第一层。一个命名良好的记忆，不需要搜索算法就能被找到 80%。

### 2. 索引

每条记忆在三个索引系统中都有地址：

| 索引 | 追踪什么 | Token 开销 |
|------|---------|-----------|
| **宫殿索引** | 房间目录 + 显著性评分 | 扫描约 50 token |
| **洞察索引** | 跨项目教训 + 关键词匹配 | 查询约 30 token |
| **感知文档** | 200 行复合文档（强制合并） | 约 200 token，但每一行都承载交叉验证的权重 |

索引是轻量指针。Agent 先扫描索引，只在需要时才加载完整内容。

### 3. 关联性

相关的记忆会自动连接 — 无需手写 wikilinks。

```
Agent 写入: "JWT 刷新令牌轮换防止会话固定攻击"
  → 关键词: jwt, refresh, rotation, session
  → "architecture" 房间标签: ["technical"]
  → "knowledge" 房间有 "session management" 教训
  → 自动创建边: architecture ←→ knowledge (权重 0.3)
```

当你 `recall("会话安全")` 时，系统不只是关键词匹配 — 它沿着边跳 1 步，从关联房间中浮现相关记忆。关联性把孤立的记忆变成知识图谱。

### 4. 权重与衰减

不是所有记忆都平等。显著性评分确保最重要的记忆先浮现：

```
显著性 = 时效性(0.30) + 访问频率(0.25) + 连接数(0.20) + 紧迫性(0.15) + 重要性(0.10)
```

- 架构决策以 0.98/天 衰减（持久）。阻塞项以 0.90/天 衰减（短暂）。
- 你实际访问的记忆越来越强。从不回顾的记忆逐渐淡化。
- 被替换的洞察不会消亡 — 它们进入归档。如果未来的洞察匹配，它们会复活。

### 5. 反馈回路

系统学习什么有用、什么没用：

```
会话 1: recall("认证设计") → 返回 5 条结果
  Agent 评价: 结果 #1 有用, 结果 #3 没用
  → 存入 feedback-log.json（带查询上下文）

会话 2: recall("认证模式") → 类似查询
  → 结果 #1 获得 +0.03 分数提升（确认有用）
  → 结果 #3 获得 -0.05 惩罚（确认无用）
  → 排名变化: 有用的记忆上升，噪音下沉
```

反馈是查询感知的 — 把一条结果标记为"对认证设计没用"不会惩罚它在"数据库设计"中的表现。系统按上下文学习，而非全局惩罚。

### 复合效应

```
会话 1:    保存 3 条记忆（自动命名、索引、创建边）
会话 5:    recall 浮现会话 1-4 的记忆，反馈优化排名
会话 10:   watch_for 在错误重复之前警告 agent
会话 20:   感知包含 10 条交叉验证的洞察（从 40+ 条原始观察合并）
会话 50:   Agent 了解你的优先级、盲点和沟通风格
           — 不是因为被告知，而是因为每次纠正都在复合增长
```

每一层放大其他层。自动命名让索引有意义。索引让关联性成为可能。关联性让检索精准。精准检索产生有意义的反馈。反馈让下一次检索更好。循环复合增长。

---

## SDK API

`agent-recall-sdk` 提供 `AgentRecall` 类 — 完整记忆系统的编程接口。可用于 LangChain、CrewAI、Vercel AI SDK 或任何自定义 JS/TS 智能体框架。

```typescript
import { AgentRecall } from "agent-recall-sdk";
const ar = new AgentRecall({ project: "my-project" });
```

| 方法 | 说明 |
|------|------|
| `capture(question, answer, opts?)` | 快速问答捕获（L1 记忆） |
| `journalWrite(content, opts?)` | 写入每日日志 |
| `coldStart()` | 宫殿优先上下文加载（~200 token） |
| `palaceWrite(room, content, opts?)` | 写入房间，自动扇出交叉引用 |
| `palaceRead(room?, topic?)` | 读取房间内容 |
| `walk(depth?, focus?)` | 渐进式宫殿漫步 |
| `awarenessUpdate(insights, opts?)` | 复合新洞察到感知系统 |
| `recallInsight(context, opts?)` | 跨项目洞察召回 |
| `alignmentCheck(input)` | 记录置信度和假设 |
| `synthesize(opts?)` | L3 合成，可选宫殿整合 |

---

## CLI 命令

`agent-recall-cli` 提供 `ar` 命令，用于终端工作流和 CI 管道。

```bash
# 日志
ar read [--date YYYY-MM-DD] [--section <name>]
ar write <content> [--section <name>]
ar capture <question> <answer> [--tags tag1,tag2]
ar search <query> [--include-palace]
ar rollup [--min-age-days N] [--dry-run]

# 宫殿
ar palace read [<room>]
ar palace write <room> <content> [--importance high|medium|low]
ar palace walk [--depth identity|active|relevant|full]
ar palace search <query>

# 感知与洞察
ar awareness read
ar awareness update --insight "标题" --evidence "证据" --applies-when kw1,kw2
ar insight <context> [--limit N]

# 全局选项
--root <path>     存储根目录（默认：~/.agent-recall）
--project <slug>  项目覆盖
```

---

## 架构

### 五层记忆模型

```
L1: 工作记忆     journal_capture           「发生了什么」
L2: 情景记忆     journal_write             「这意味着什么」
L3: 记忆宫殿     palace_write / walk       「跨会话的知识」
L4: 感知系统     awareness_update          「复合的洞察」
L5: 洞察索引     recall_insight            「跨项目的经验」
```

### 核心机制

**扇出写入** — 写入一个房间，相关房间通过 `[[wikilinks]]` 自动更新交叉引用。零 LLM 成本。

**显著性评分** — `时效性(0.30) + 访问频率(0.25) + 连接数(0.20) + 紧迫性(0.15) + 重要性(0.10)`。高显著性房间优先展示，低于阈值自动归档。

**复合感知** — `awareness.md` 上限 200 行。新洞察与相似的合并（增强），与不相似的竞争（最低确认次数的被替换）。约束创造压缩，压缩创造复合。

**跨项目洞察召回** — 通过关键词将洞察映射到场景。`recall_insight("构建质量检查")` 返回来自任何项目的相关教训。

**Obsidian 兼容** — YAML frontmatter + `[[wikilinks]]`。将 `palace/` 作为 Obsidian vault 打开即可。零 Obsidian 依赖。

---

## 平台兼容性

| 平台 | MCP | SDK | CLI | 说明 |
|------|:---:|:---:|:---:|------|
| Claude Code | ✅ | ✅ | ✅ | 完整支持 — MCP + 技能 + 命令 |
| Cursor | ✅ | ✅ | ✅ | MCP via .cursor/mcp.json |
| VS Code (Copilot) | ✅ | ✅ | ✅ | MCP via .vscode/mcp.json |
| Windsurf | ✅ | ✅ | ✅ | MCP via mcp_config.json |
| OpenAI Codex | ✅ | ✅ | ✅ | `codex mcp add` |
| LangChain / CrewAI | — | ✅ | — | SDK 集成到你的 chain 中 |
| Vercel AI SDK | — | ✅ | — | SDK 在 server actions 中使用 |
| CI / GitHub Actions | — | — | ✅ | `npx agent-recall-cli` |
| 任何 MCP 智能体 | ✅ | — | — | 标准 MCP 协议 |

---

## 文档

| 文档 | 说明 |
|------|------|
| [智能距离协议](docs/intelligent-distance-protocol.md) | 基础理论 — 人类与 AI 之间的差距是结构性的，如何减少两个物种之间的沟通信息损失 |
| [MCP 适配器规范](docs/mcp-adapter-spec.md) | 基于 AgentRecall 构建适配器的技术规范 |
| [SDK 设计](docs/sdk-design.md) | SDK 架构设计文档 |
| [v3.4 升级说明](UPGRADE-v3.4.md) | 周报压缩、宫殿优先冷启动、提升验证 |

---

## 贡献

由 [tongwu](https://github.com/Goldentrii) 在 [Novada](https://www.novada.com) 构建。

- Issues & 反馈：[GitHub Issues](https://github.com/Goldentrii/AgentRecall/issues)
- 邮箱：[tong.wu@novada.com](mailto:tong.wu@novada.com)
- 网站：[novada.com](https://www.novada.com)

MIT 许可证。
