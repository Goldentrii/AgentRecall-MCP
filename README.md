<h1 align="center">AgentRecall</h1>

<p align="center"><strong>Persistent, compounding memory for AI agents. MCP server + SDK + CLI.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-recall-mcp"><img src="https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square&label=MCP&color=5D34F2" alt="MCP npm"></a>
  <a href="https://www.npmjs.com/package/agent-recall-sdk"><img src="https://img.shields.io/npm/v/agent-recall-sdk?style=flat-square&label=SDK&color=0EA5E9" alt="SDK npm"></a>
  <a href="https://www.npmjs.com/package/agent-recall-cli"><img src="https://img.shields.io/npm/v/agent-recall-cli?style=flat-square&label=CLI&color=10B981" alt="CLI npm"></a>
  <a href="https://github.com/Goldentrii/AgentRecall/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP-22_tools-orange?style=flat-square" alt="Tools">
  <img src="https://img.shields.io/badge/cloud-zero-blue?style=flat-square" alt="Zero Cloud">
  <img src="https://img.shields.io/badge/Obsidian-compatible-7C3AED?style=flat-square" alt="Obsidian">
</p>

<p align="center">
  <b>EN:</b>&nbsp;
  <a href="#why-choose-agentrecall">Why</a> ·
  <a href="#three-ways-to-use-it">Use</a> ·
  <a href="#what-is-agentrecall">What</a> ·
  <a href="#quick-start">Install</a> ·
  <a href="#22-mcp-tools">Tools</a> ·
  <a href="#sdk-api">SDK</a> ·
  <a href="#cli-commands">CLI</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#docs">Docs</a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <b>中文:</b>&nbsp;
  <a href="#agentrecall中文文档">简介</a> ·
  <a href="#快速开始">安装</a> ·
  <a href="#22-个-mcp-工具">工具</a> ·
  <a href="#sdk-api-1">SDK</a> ·
  <a href="#cli-命令">CLI</a> ·
  <a href="#架构">架构</a>
</p>

---

## Why Choose AgentRecall

**Your agents forget everything between sessions.** Decisions evaporate. Mistakes repeat. Context rebuilds from scratch every time. AgentRecall fixes this with persistent memory that compounds — getting smarter, not bigger.

- **Near-universal compatibility.** MCP server for any MCP-compatible agent (Claude Code, Cursor, Windsurf, VS Code, Codex). SDK for any JS/TS framework (LangChain, CrewAI, Vercel AI SDK, custom agents). CLI for terminal and CI workflows. One memory system, every surface.

- **Compounding awareness, not infinite logs.** Memory is capped at 200 lines. New insights either merge with existing ones (strengthening them) or replace the weakest. After 100 sessions, your awareness file is still 200 lines — but each line carries the weight of cross-validated, confirmed observations.

- **Cross-project recall.** Lessons learned in one project apply everywhere. Built a rate limiter last month? That lesson surfaces when you're building one today — in a different repo, through a different agent.

- **Zero cloud, zero telemetry, all local.** Everything is markdown on disk. Browse it in Obsidian, grep it in the terminal, version it in git. No accounts, no API keys, no lock-in.

---

## Three Ways to Use It

**MCP** — for AI agents (Claude Code, Cursor, Windsurf, VS Code, Codex):
```bash
claude mcp add agent-recall -- npx -y agent-recall-mcp
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

A **persistent memory system** that gives AI agents **compounding awareness** across sessions. Not a log. Not a database. A second brain that gets smarter the more you use it.

**The problem:** AI agents start from zero every session. They forget your decisions, repeat your mistakes, lose context mid-project, and misunderstand you the same way twice.

**The fix:** AgentRecall stores knowledge in a five-layer memory pyramid — from quick captures to cross-project insights — and forces compression so memory gets more valuable over time, not more bloated.

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
claude mcp add agent-recall -- npx -y agent-recall-mcp

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

## `/arsave` and `/arstart`

> **Two commands. That's all you need for session management.**

| Command | When | What it does |
|---------|------|-------------|
| **`/arsave`** | End of session | Write journal + consolidate to palace + update awareness + optional git push |
| **`/arstart`** | Start of session | Recall cross-project insights + walk palace + load context |

```bash
# Install commands (one-time, Claude Code only)
mkdir -p ~/.claude/commands
curl -o ~/.claude/commands/arsave.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arsave.md
curl -o ~/.claude/commands/arstart.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arstart.md
```

---

## How an Agent Uses AgentRecall

### Session Start (`/arstart`)
```
1. recall_insight(context="current task description")   → relevant cross-project insights
2. palace_walk(depth="active")                           → project context + awareness
```

### During Work
```
3. alignment_check(goal="...", confidence="medium")      → verify understanding before big tasks
4. palace_write(room="architecture", content="...")      → permanent knowledge with cross-refs
5. journal_capture(question="...", answer="...")          → lightweight Q&A log
```

### Session End
```
6. journal_write(content="...", section="decisions")     → daily journal entry
7. awareness_update(insights=[...])                       → compound into awareness system
8. context_synthesize(consolidate=true)                   → promote journal → palace rooms
```

---

## 22 MCP Tools

### Memory Palace (5 tools)

| Tool | Purpose |
|------|---------|
| `palace_read` | Read a room or list all rooms in the Memory Palace |
| `palace_write` | Write memory with fan-out — auto-updates cross-references via `[[wikilinks]]` |
| `palace_walk` | Progressive cold-start: identity (~50 tok) → active (~200) → relevant (~500) → full (~2000) |
| `palace_lint` | Health check: stale, orphan, low-salience rooms. `fix=true` to auto-archive |
| `palace_search` | Search across all rooms, results ranked by salience score |

### Awareness & Insights (2 tools)

| Tool | Purpose |
|------|---------|
| `awareness_update` | Add insights to the compounding awareness system. Merges with existing, detects patterns |
| `recall_insight` | Before starting work, recall cross-project insights relevant to the current task |

### Session Memory (6 tools)

| Tool | Purpose |
|------|---------|
| `journal_read` | Read entry by date or "latest", with section filtering |
| `journal_write` | Write daily journal. Optional `palace_room` for palace integration |
| `journal_capture` | Lightweight L1 Q&A capture. Optional `palace_room` |
| `journal_list` | List recent journal entries |
| `journal_search` | Full-text search across history. `include_palace=true` for palace too |
| `journal_projects` | List all tracked projects |

### Architecture (4 tools)

| Tool | Purpose |
|------|---------|
| `journal_state` | JSON state layer — structured read/write for agent-to-agent handoffs |
| `journal_cold_start` | Palace-first cold start: loads identity + awareness + top rooms (~200 tok), then HOT journals only |
| `journal_archive` | Archive old entries to cold storage with summaries |
| `journal_rollup` | Condense old daily journals into weekly summaries. Prevents accumulation. `dry_run=true` to preview |

### Knowledge (2 tools)

| Tool | Purpose |
|------|---------|
| `knowledge_write` | Write permanent lessons — dynamic categories, auto-creates palace rooms |
| `knowledge_read` | Read lessons by project, category, or search query |

### Alignment (3 tools)

| Tool | Purpose |
|------|---------|
| `alignment_check` | Record confidence + assumptions → human corrects BEFORE work starts |
| `nudge` | Detect contradiction between current and past input → surface before damage |
| `context_synthesize` | L3 synthesis. `consolidate=true` writes results into palace rooms |

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
ar v3.3.4 — AgentRecall CLI

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

**Salience scoring** — Every room has a salience score: `importance(0.4) + recency(0.3) + access_frequency(0.2) + connections(0.1)`. High-salience rooms surface first. Below threshold → auto-archive.

**Compounding awareness** — `awareness.md` is capped at 200 lines. When new insights are added, similar existing ones merge (strengthen), dissimilar ones compete (lowest-confirmation gets replaced). The constraint creates compression. Compression creates compounding.

**Cross-project insight recall** — `insights-index.json` maps insights to situations via keywords. `recall_insight("building quality gates")` returns relevant lessons from any project, ranked by severity x confirmation count.

**Obsidian-compatible** — Every palace file has YAML frontmatter + `[[wikilinks]]`. Open `palace/` as an Obsidian vault → graph view shows room connections. Zero Obsidian dependency.

### Storage Layout

```
~/.agent-recall/
  awareness.md                    # 200-line compounding document (global)
  awareness-state.json            # Structured awareness data
  insights-index.json             # Cross-project insight matching
  projects/
    <project>/
      journal/
        YYYY-MM-DD.md             # Daily journal
        YYYY-MM-DD-log.md         # L1 captures
        YYYY-MM-DD.state.json     # JSON state
      palace/
        identity.md               # ~50 token project identity card
        palace-index.json          # Room catalog + salience scores
        graph.json                 # Cross-reference edges
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

Validated over 30+ sessions across 5 production projects:
- Cold-start: **5 min → 2 seconds** (cache-aware loading)
- Decision retention: **0% → 100%** across sessions
- Misunderstanding caught before wrong work: **6+ instances** via alignment checks
- Repeated mistakes prevented: **3 instances** via cross-project insight recall
- All data local, all files markdown, all tools stateless

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

> **你的 AI 智能体每次对话都从零开始。AgentRecall 解决这个问题。**

---

## 为什么选择 AgentRecall

**你的智能体在会话之间遗忘一切。** 决策蒸发，错误重复，上下文每次从零构建。AgentRecall 用持久记忆修复这个问题 — 记忆会复合增长，而不是无限膨胀。

- **近乎通用的兼容性。** MCP 服务器支持所有 MCP 兼容智能体（Claude Code、Cursor、Windsurf、VS Code、Codex）。SDK 支持任何 JS/TS 框架（LangChain、CrewAI、Vercel AI SDK、自定义智能体）。CLI 支持终端和 CI 工作流。一套记忆系统，覆盖所有场景。

- **复合感知，而非无限日志。** 记忆上限 200 行。新洞察要么与已有的合并（增强），要么替换最弱的。100 个会话后，感知文件仍然是 200 行 — 但每一行都承载着经过交叉验证的确认观察。

- **跨项目召回。** 在一个项目中学到的教训适用于所有项目。上个月做了限流器？今天在另一个项目构建时，那个教训会自动浮现。

- **零云端，零遥测，全部本地。** 一切都是磁盘上的 markdown。在 Obsidian 中浏览，在终端中 grep，在 git 中版本管理。无需账户、API 密钥或锁定。

---

## 三种使用方式

**MCP** — 面向 AI 智能体（Claude Code、Cursor、Windsurf、VS Code、Codex）：
```bash
claude mcp add agent-recall -- npx -y agent-recall-mcp
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

一个**持久记忆系统**，让 AI 智能体拥有**跨会话复合感知**。不是日志，不是数据库——是一个用得越多越聪明的第二大脑。

**问题：** AI 智能体每次会话都是全新开始。忘记你的决策，重复同样的错误，丢失项目上下文，以同样的方式误解你。

**解决方案：** AgentRecall 将知识存储在五层记忆金字塔中——从快速捕获到跨项目洞察——并通过强制压缩让记忆随时间增值，而不是膨胀。

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
claude mcp add agent-recall -- npx -y agent-recall-mcp

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
1. recall_insight(context="当前任务描述")    → 跨项目相关洞察
2. palace_walk(depth="active")               → 项目上下文 + 感知摘要
```

### 工作中
```
3. alignment_check(goal="...", confidence="medium")   → 大任务前确认理解
4. palace_write(room="architecture", content="...")   → 永久知识 + 交叉引用
5. journal_capture(question="...", answer="...")       → 轻量问答记录
```

### 会话结束
```
6. journal_write(content="...", section="decisions")  → 每日日志
7. awareness_update(insights=[...])                    → 洞察复合到感知系统
8. context_synthesize(consolidate=true)                → 日志内容提升到宫殿
```

---

## 22 个 MCP 工具

### 记忆宫殿（5 个）

| 工具 | 功能 |
|------|------|
| `palace_read` | 读取房间内容或列出所有房间 |
| `palace_write` | 写入记忆，自动通过 `[[wikilinks]]` 扇出交叉引用 |
| `palace_walk` | 渐进式冷启动：identity (~50 tok) → active (~200) → relevant (~500) → full (~2000) |
| `palace_lint` | 健康检查：过期、孤立、低显著性房间。`fix=true` 自动归档 |
| `palace_search` | 全房间搜索，按显著性评分排序 |

### 感知与洞察（2 个）

| 工具 | 功能 |
|------|------|
| `awareness_update` | 添加洞察到复合感知系统。自动合并相似洞察，检测跨洞察模式 |
| `recall_insight` | 开始任务前，召回跨项目的相关洞察 |

### 会话记忆（6 个）

| 工具 | 功能 |
|------|------|
| `journal_read` | 按日期读取日志，支持章节过滤 |
| `journal_write` | 写入每日日志。可选 `palace_room` 同步到宫殿 |
| `journal_capture` | 轻量问答捕获 |
| `journal_list` | 列出最近日志 |
| `journal_search` | 全文搜索。`include_palace=true` 同时搜索宫殿 |
| `journal_projects` | 列出所有项目 |

### 架构工具（4 个）

| 工具 | 功能 |
|------|------|
| `journal_state` | JSON 状态层 — agent 间毫秒级结构化交接 |
| `journal_cold_start` | 宫殿优先冷启动：先加载身份+感知+高权重房间(~200 token)，再加载日志 |
| `journal_archive` | 归档旧条目到冷存储 |
| `journal_rollup` | 将旧日志压缩为周报。防止日志无限积累。`dry_run=true` 预览 |

### 知识工具（2 个）

| 工具 | 功能 |
|------|------|
| `knowledge_write` | 写入永久教训 — 动态类别，自动创建宫殿房间 |
| `knowledge_read` | 按项目、类别或搜索词读取教训 |

### 对齐工具（3 个）

| 工具 | 功能 |
|------|------|
| `alignment_check` | 记录置信度 + 假设 → 人类在工作前纠正 |
| `nudge` | 检测与过去决策的矛盾 → 在造成损失前提出 |
| `context_synthesize` | L3 合成。`consolidate=true` 将结果写入宫殿房间 |

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

**显著性评分** — `重要性(0.4) + 时效性(0.3) + 访问频率(0.2) + 连接数(0.1)`。高显著性房间优先展示，低于阈值自动归档。

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
| [智能距离协议](docs/intelligent-distance-protocol.md) | 基础理论 — 人类与 AI 之间的差距是结构性的，如何导航 |
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
