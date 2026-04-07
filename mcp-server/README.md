<p align="center">
  <h1 align="center">AgentRecall</h1>
  <p align="center"><strong>The Intelligent Distance Protocol for AI Agents</strong></p>
  <p align="center">Minimize information loss between human and AI — across every session, every agent, every project.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-recall-mcp"><img src="https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square&color=5D34F2" alt="npm"></a>
  <a href="https://github.com/NovadaLabs/AgentRecall/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP-12_tools-orange?style=flat-square" alt="Tools">
  <img src="https://img.shields.io/badge/protocol-Intelligent_Distance-5B2D8E?style=flat-square" alt="Protocol">
  <img src="https://img.shields.io/badge/cloud-zero-blue?style=flat-square" alt="Zero Cloud">
</p>

---

## Intelligent Distance — The Core Idea

> *"The gap between human intelligence and AI intelligence is structural and permanent — not a temporary technology problem."*

Humans are **born** (embodied experience, emotion, survival pressure). Machines are **made** (rules, deterministic). AI is **trained** (statistical co-occurrence over data). Three different cognitive origins produce three different ways of understanding the world. This gap will not close as AI improves — because the difference is in **origin**, not capability.

**The conventional approach:** make AI more human-like → close the gap.

**The Intelligent Distance approach:** accept the gap as permanent → design a **protocol** that minimizes information loss when translating between the two intelligence types.

```
Human says: "click all"
Agent hears: "click the main things"
Gap: "all" ≠ "main things"

Human says: "done means identical"
Agent thinks: "close enough"
Gap: "identical" ≠ "close enough"

Human gives: scattered, non-linear instructions
Agent picks: one instruction, ignores the rest
Gap: the connective tissue between points is lost
```

**AgentRecall doesn't try to close this gap. It builds the protocol to navigate it.**

---

## How AgentRecall Bridges the Gap

| Intelligent Distance Gap | AgentRecall Tool | What It Does |
|--------------------------|-----------------|-------------|
| Agent forgets what human said yesterday | `journal_read` + `journal_cold_start` | Persistent memory — 3-layer, cache-aware |
| Agent misunderstands human intent | `alignment_check` | Records confidence + assumptions → human corrects BEFORE work |
| Agent contradicts a prior decision | `nudge` | Detects contradiction → surfaces it BEFORE damage |
| Agent says "done" but human disagrees | Think-Execute-Reflect loop | Quality scoring with COUNTS ("built 11 pages, 35 tabs"), not feelings ("went well") |
| Agent builds from imagination, not data | `journal_state` (JSON) | Structured state transfers agent-to-agent — no prose interpretation |
| Agent repeats the same mistake | Failures section + `context_synthesize` | Cross-session pattern detection → promoted to permanent memory |
| Next agent starts from zero | `journal_cold_start` (v3) | Hot/warm/cold cache — loads 3 files instead of 28 |

**Memory solves forgetting. AgentRecall solves misunderstanding.**

---

## Quick Start

### MCP Server (any agent)

```bash
# Claude Code
claude mcp add agent-recall -- npx -y agent-recall-mcp

# Cursor — .cursor/mcp.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# VS Code — .vscode/mcp.json
{ "servers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

### Skill (Claude Code)

```bash
mkdir -p ~/.claude/skills/agent-recall
curl -o ~/.claude/skills/agent-recall/SKILL.md \
  https://raw.githubusercontent.com/NovadaLabs/AgentRecall/main/SKILL.md
```

Say **"save"** to journal. Say **"read the latest journal"** to resume.

---

## 12 MCP Tools

### Session Memory (6 tools)

| Tool | Purpose |
|------|---------|
| `journal_read` | Read entry by date or "latest". Filter by section. |
| `journal_write` | Write or update journal content |
| `journal_capture` | Lightweight L1 Q&A capture |
| `journal_list` | List recent entries |
| `journal_search` | Full-text search across history |
| `journal_projects` | List all tracked projects |

### v3 Architecture (3 tools) — NEW

| Tool | Purpose |
|------|---------|
| `journal_state` | **JSON state layer** — structured read/write for agent-to-agent handoffs (milliseconds, no prose) |
| `journal_cold_start` | **Cache-aware cold start** — HOT (today+yesterday), WARM (2-7 days), COLD (7+ days) |
| `journal_archive` | **Archive old entries** — moves to `archive/` with summaries, keeps journal/ clean |

### Alignment & Synthesis (3 tools)

| Tool | Purpose |
|------|---------|
| `alignment_check` | Record confidence + assumptions + human corrections |
| `nudge` | Surface contradiction between current and past input |
| `context_synthesize` | L3 synthesis: patterns, contradictions, goal evolution |

---

## How Alignment Detection Works

When an agent isn't sure it understands:

```
ALIGNMENT CHECK:
- Goal: Build a REST API for user management
- Confidence: medium
- Assumptions: PostgreSQL, no auth yet, CRUD only
- Unclear: Should this include role-based access?
```

Human confirms or corrects. The delta is logged. Over time, patterns reveal where misunderstanding is most likely.

## How Nudge Protocol Works

When the agent detects the human contradicts a prior decision:

```
NUDGE:
- You decided Clerk for auth on March 25.
- Now you're asking for custom auth from scratch.
- Has the goal changed, or should we stick with Clerk?
```

Not the agent being difficult — it's helping the human **clarify their own thinking.**

---

## Three-Layer Memory + v3 Cache

```
┌─────────────────────────────────────────────────────────┐
│ L1: Working Memory   [per-turn, ~50 tok]  "What happened"│
│     ↓ synthesized into                                   │
│ L2: Episodic Memory  [daily, ~800 tok]    "What it means"│
│     ↓ synthesized into                                   │
│ L3: Semantic Memory  [cross-session]      "What's true"  │
│     (contradiction detection + goal evolution)            │
├─────────────────────────────────────────────────────────┤
│ v3: JSON State Layer  [per-session]  Agent-to-agent data │
│     journal_state → .state.json alongside .md            │
├─────────────────────────────────────────────────────────┤
│ v3: Cache Layer       HOT (0-1d) → WARM (2-7d) → COLD   │
│     journal_cold_start → loads 3 files, not 28           │
└─────────────────────────────────────────────────────────┘
```

---

## Think-Execute-Reflect Loop

Every session follows a structured quality cycle:

```
🧠 THINK    → Was the approach right? Was research done?
⚡ EXECUTE  → What happened vs planned? (COUNTS, not feelings)
🔍 REFLECT  → 5-dimension quality score + Intelligent Distance gap
🔄 FEEDBACK → Loop (needs iteration) or Exit (quality sufficient)
```

**The Reflect step explicitly measures Intelligent Distance:**
- What user meant vs what I interpreted
- The gap between them (or "none — aligned")
- What to change so the gap shrinks next time

---

## Supported Agents

| Agent | Skill | MCP | Protocol |
|-------|:-----:|:---:|:--------:|
| Claude Code | ✅ | ✅ | ✅ |
| Cursor | ⚡ | ✅ | ✅ |
| VS Code Copilot | — | ✅ | ✅ |
| Windsurf | ⚡ | ✅ | ✅ |
| Claude Desktop | — | ✅ | ✅ |
| Any MCP agent | — | ✅ | ✅ |
| Any AI agent | — | — | ✅ (manual) |

---

## Real Results

Validated over **30+ sessions** across 5 production projects:
- Cold-start: **5 min → 2 seconds** (with v3 cache: loads 3 files not 28)
- Decision history: **0% → 100% retained** across sessions
- Misunderstanding caught before wrong work: **6+ instances** via alignment checks
- Quality loop caught **4 code review gaps** that would have shipped
- Failures section prevented **3 repeated mistakes** across agent handoffs

---

## Feedback & Contributing

Built by [tongwu](https://github.com/Goldentrii) at [NovadaLabs](https://github.com/NovadaLabs).

**We'd love your feedback:**

- Email: tongwu0824@gmail.com
- GitHub Issues: [NovadaLabs/AgentRecall](https://github.com/NovadaLabs/AgentRecall/issues)

1. **Use the protocol** for a week → [report](https://github.com/NovadaLabs/AgentRecall/issues)
2. **Implement it** in a new agent → PR welcome
3. **Improve the spec** → [protocol doc](docs/intelligent-distance-protocol.md)

---

## License

MIT — *Concept & Design: [tongwu](https://github.com/Goldentrii)*

**Memory solves forgetting. AgentRecall solves misunderstanding.**
