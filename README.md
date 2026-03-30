# AgentRecall — The Intelligent Distance Protocol

> **Minimize information loss between human and AI — across every session, every agent, every project.**
> Not a memory tool. A communication protocol. The gap between human and AI cognition is structural — AgentRecall designs around it.

[![Version](https://img.shields.io/badge/version-2.1.0-blue?style=flat-square)](https://github.com/Goldentrii/AgentRecall)
[![License](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)](LICENSE)
[![Protocol](https://img.shields.io/badge/protocol-Intelligent_Distance_v1-5B2D8E?style=flat-square)](docs/intelligent-distance-protocol.md)
[![MCP](https://img.shields.io/badge/MCP-9_tools-orange?style=flat-square)](#mcp-server)
[![npm](https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square)](https://www.npmjs.com/package/agent-recall-mcp)

---

## The Problem

**The obvious problem:** AI agents forget everything between sessions. Cold-start amnesia costs 2,000–5,000 tokens per session.

**The real problem:** Humans and AI misunderstand each other — structurally, repeatedly, expensively. Humans contradict themselves, communicate in fragments, say "make it better" when they mean 10 different things. AI interprets literally and builds the wrong thing with perfect confidence.

**Memory solves forgetting. AgentRecall solves misunderstanding.**

---

## Three Pillars

| Pillar | What | Why |
|--------|------|-----|
| **Goal Alignment** | Agents have full freedom in HOW. Protocol ensures WHAT. | Don't prescribe methods — clarify the destination. |
| **Structured Memory** | L1 (working) → L2 (episodic) → L3 (semantic synthesis) | Writing journals isn't enough. Agents must synthesize and detect contradictions. |
| **Misunderstanding Detection** | Confidence checks, nudge on human inconsistency, feedback loop | Most protocols prevent misunderstanding. This one also detects it. |

**[Read the full protocol spec →](docs/intelligent-distance-protocol.md)**

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
  https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/SKILL.md
```

Say **"save"** to journal. Say **"read the latest journal"** to resume.

---

## 9 MCP Tools

| Tool | Purpose |
|------|---------|
| `journal_read` | Read entry by date or "latest". Filter by section. |
| `journal_write` | Write or update journal content |
| `journal_capture` | Lightweight L1 Q&A capture |
| `journal_list` | List recent entries |
| `journal_search` | Full-text search across history |
| `journal_projects` | List all tracked projects |
| `alignment_check` | Record confidence + understanding + human corrections |
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

## Three-Layer Memory

```
L1: Working Memory    [per-turn, ~50 tokens]    "What happened"
    ↓ synthesized into
L2: Episodic Memory   [daily journal, ~800 tok]  "What it means"
    ↓ synthesized into
L3: Semantic Memory   [cross-session, ~200 tok]  "What's true across sessions"
    (contradiction detection + goal evolution tracking)
```

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

Validated over **20+ sessions** across production projects:
- Cold-start: **5 min → 2 seconds**
- Decision history: **0% → 100% retained**
- Misunderstanding caught before wrong work: **4 instances** in first week
- Quality loop caught **4 code review gaps** that would have shipped

---

## Contributing

1. **Use the protocol** for a week → [report](https://github.com/Goldentrii/AgentRecall/issues)
2. **Implement it** in a new agent → PR welcome
3. **Improve the spec** → [protocol doc](docs/intelligent-distance-protocol.md)

## License

MIT — *Concept & Design: [Tongwu](https://github.com/Goldentrii)*
