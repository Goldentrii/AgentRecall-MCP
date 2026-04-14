---
name: agent-recall
description: >-
  Persistent compounding memory for AI agents. 5 MCP tools: session_start,
  remember, recall, session_end, check. Auto-naming, feedback loop, correction
  capture, cross-project insight matching. Stores everything as local markdown.
  Zero cloud, zero telemetry, Obsidian-compatible.
origin: community
version: 3.3.14
author: Goldentrii
platform: clawhub
tags:
  - memory
  - persistence
  - multi-session
  - mcp
  - cross-project
  - feedback-loop
  - intelligent-distance
  - auto-naming
  - knowledge-graph
  - obsidian
trigger:
  - "save"
  - "save session"
  - "/arsave"
  - "/arstart"
  - "remember this"
  - "recall"
  - "what did we do last time"
  - "load context"
  - "start session"
  - "end session"
  - "checkpoint"
  - "保存"
  - "记住"
  - "上次做了什么"
  - "加载上下文"
skip:
  - "don't save"
  - "skip memory"
  - "no need"
  - "不用记"
  - "算了"
---

# AgentRecall v3.3.14 — Agent Instructions

You have access to AgentRecall, a persistent memory system with 5 MCP tools. This file tells you exactly how and when to use them.

## Setup

AgentRecall requires the MCP server to be running. If tool calls fail with "unknown tool", the human needs to install it first.

### Installation (human runs once)

**Claude Code:**
```bash
claude mcp add --scope user agent-recall -- npx -y agent-recall-mcp
```

**Cursor** (`.cursor/mcp.json`):
```json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

**VS Code / GitHub Copilot** (`.vscode/mcp.json`):
```json
{ "servers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`):
```json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

**Codex:**
```bash
codex mcp add agent-recall -- npx -y agent-recall-mcp
```

**Hermes Agent** (`~/.hermes/config.yaml`):
```yaml
mcp_servers:
  agent-recall:
    command: npx
    args: ["-y", "agent-recall-mcp"]
```

**Roo Code** (`.roo/mcp.json`):
```json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

**Any MCP-compatible agent:**
```
command: npx
args: ["-y", "agent-recall-mcp"]
transport: stdio
```

---

## The 5 Tools

You have exactly 5 tools. No more, no less.

### `session_start`

**When:** Beginning of every session. Call FIRST before any work.

**What it returns:**
- `project` — detected project name
- `identity` — who the user is (1-2 lines)
- `insights` — top 5 awareness insights (title + confirmation count)
- `active_rooms` — top 3 palace rooms by salience
- `cross_project` — insights from other projects matching current context
- `recent` — today/yesterday journal briefs
- `watch_for` — predictive warnings from past correction patterns

**How to use the response:**
1. Read `identity` to calibrate your tone and approach
2. Read `insights` — these are battle-tested lessons. Follow them.
3. Read `watch_for` — these are patterns where you've been wrong before on this project. Adjust your approach.
4. Read `recent` to understand where the last session left off
5. Present a brief to the human: project name, last session summary, relevant insights

**Example call:**
```
session_start({ project: "auto" })
```

### `remember`

**When:** You learn something worth keeping. A decision, a bug fix, an insight, a session note.

**What it does:** Auto-classifies your content and routes it to the right store:
- Bug fix / lesson → knowledge store
- Architecture / decision → palace room
- Cross-project pattern → awareness system
- Session activity → journal

You do NOT need to decide where it goes. Just describe what to remember.

**How to use:**
```
remember({
  content: "We decided to use GraphQL instead of REST because the frontend needs flexible queries",
  context: "architecture decision"    // optional hint, improves routing
})
```

**Returns:** `routed_to` (which store), `classification` (content type), `auto_name` (semantic slug generated)

### `recall`

**When:** You need to find something from past sessions. A decision, a pattern, a lesson.

**What it does:** Searches ALL stores at once using Reciprocal Rank Fusion (RRF) — each source (palace, journal, insights) ranks internally, then positions merge so no single source dominates. Journal entries decay fast via Ebbinghaus curve (S=2 days); palace entries are near-permanent (S=9999). Returns ranked results with stable IDs.

**How to use:**
```
recall({ query: "authentication design", limit: 5 })
```

**Feedback:** After using results, rate them. Ratings use a Bayesian Beta model — the mathematically optimal estimate of true usefulness:
```
recall({
  query: "auth patterns",
  feedback: [
    { id: "abc123", useful: true },   // Beta(2,1) → ×1.33 next time
    { id: "def456", useful: false }   // Beta(1,2) → ×0.67 next time
  ]
})
```

Feedback is query-aware — rating something "useless" for one query doesn't penalize it for unrelated queries.

### `session_end`

**When:** End of session. Call ONCE, after all work is done.

**What it does in one call:**
- Writes daily journal entry
- Updates awareness with new insights (merge or add)
- Consolidates decisions/goals into palace rooms
- Archives demoted insights (preserved, not deleted)

**How to use:**
```
session_end({
  summary: "Built auth module with JWT refresh rotation. Fixed CORS bug.",
  insights: [
    {
      title: "JWT refresh tokens need httpOnly cookies — localStorage is vulnerable",
      evidence: "XSS attack vector discovered during security review",
      applies_when: ["auth", "jwt", "security", "cookies"],
      severity: "critical"
    }
  ],
  trajectory: "Next: add rate limiting to API endpoints"
})
```

**Rules for insights:**
- 1-3 per session. Quality over quantity.
- Must be reusable. "Fixed a bug" is NOT an insight. "API returns null when session expires — always null-check auth responses" IS an insight.
- `applies_when` keywords determine when this insight surfaces in future sessions across ALL projects.

### `check`

**When:** Before executing a complex task where you might misunderstand the human's intent.

**What it does:**
- Records your understanding of the goal
- Returns `watch_for` — patterns from past corrections on this project
- Returns `similar_past_deltas` — times you misunderstood similar goals before
- After human responds, record the correction for future agents

**Two-call pattern:**

Call 1 — before work:
```
check({
  goal: "Build REST API for user management",
  confidence: "medium",
  assumptions: ["User wants REST, not GraphQL", "CRUD endpoints", "PostgreSQL backend"]
})
```

Read the `watch_for` response. If it says "You've been corrected on API style 3 times", ASK the human before proceeding.

Call 2 — after human corrects (if they do):
```
check({
  goal: "Build REST API for user management",
  confidence: "high",
  human_correction: "Actually wants GraphQL, not REST",
  delta: "API style preference — assumed REST, human prefers GraphQL"
})
```

This feeds the predictive system. Future agents on this project will get warnings.

---

## Session Flow

### Start of session
```
1. session_start()           → load context, read insights and warnings
2. Present brief to human    → "Last session: X. Insights: Y. Ready."
3. check() if task is complex → verify understanding before work
```

### During work
```
4. remember() when you learn something   → auto-routes to right store
5. recall() when you need past context   → searches everything
6. check() before major decisions        → verify understanding
```

### End of session
```
7. check() with corrections if any       → record what human corrected
8. session_end()                          → save journal + insights + consolidation
9. Offer git push if applicable
```

---

## How Memory Compounds

Each layer feeds the next. The system gets better the more you use it.

```
SAVE: remember("JWT needs httpOnly cookies")
  → Auto-named: "lesson-jwt-httponly-cookies-security"
  → Indexed in palace + insights
  → Auto-linked to "architecture" room (keyword overlap)
  → Salience scored: recency(0.30) + access(0.25) + connections(0.20) + ...

RECALL: recall("cookie security") — 3 sessions later, different project
  → Finds the JWT insight via keyword match + graph edge traversal
  → Agent rates it useful → feedback boosts future ranking
  → Next recall on similar query → this result surfaces higher

COMPOUND: After 10 sessions
  → 200-line awareness contains cross-validated insights
  → watch_for warns about past mistakes before they repeat
  → Corrections auto-promote to awareness at 3+ occurrences
  → Graph connects related memories across rooms automatically
```

---

## Rules

1. **Always call `session_start` first.** No exceptions. Even for quick tasks — insights from past sessions prevent repeated mistakes.
2. **Never skip `session_end`.** If the session produced any decisions, insights, or corrections, save them.
3. **Insights must be reusable.** Write them for a future agent who has never seen this project.
4. **Match the human's language.** If they write in Chinese, save in Chinese.
5. **Don't over-save.** 1-3 insights per session. 1-2 `remember` calls during work. More is noise.
6. **Rate your recall results.** Feedback makes future retrievals better. If a result was useless, say so.
7. **Use `check` for ambiguous tasks.** 5 seconds of verification beats 30 minutes of wrong work.
8. **watch_for is gold.** If `session_start` or `check` returns warnings, read them carefully and adjust.

---

## Storage

All data is local markdown + JSON at `~/.agent-recall/`. No cloud, no telemetry, no API keys.

```
~/.agent-recall/
  awareness.md                  # 200-line compounding document (global)
  awareness-state.json          # Structured awareness data
  awareness-archive.json        # Demoted insights (preserved, not deleted)
  insights-index.json           # Cross-project insight matching
  feedback-log.json             # Retrieval quality ratings
  projects/<name>/
    journal/YYYY-MM-DD.md       # Daily journals
    palace/rooms/<room>/        # Persistent knowledge rooms
    palace/graph.json           # Memory connection edges
    alignment-log.json          # Correction history for watch_for
```

Obsidian-compatible. Open `palace/` as a vault to see the knowledge graph.

---

## Platform Compatibility

| Platform | How to install |
|----------|---------------|
| Claude Code | `claude mcp add --scope user agent-recall -- npx -y agent-recall-mcp` |
| Cursor | `.cursor/mcp.json` |
| VS Code / Copilot | `.vscode/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Codex | `codex mcp add agent-recall -- npx -y agent-recall-mcp` |
| Hermes Agent | `~/.hermes/config.yaml` under `mcp_servers:` |
| Roo Code | `.roo/mcp.json` |
| Claude Desktop | `claude_desktop_config.json` |
| Gemini CLI | MCP server config |
| OpenCode | MCP server config |
| Any MCP client | `command: npx, args: ["-y", "agent-recall-mcp"], transport: stdio` |

All platforms use the same 5 tools. No platform-specific behavior.
