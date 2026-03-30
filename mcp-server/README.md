# agent-recall-mcp

> Give your AI agent a brain that survives every session.

[![npm](https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square)](https://www.npmjs.com/package/agent-recall-mcp)
[![License](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)](../LICENSE)
[![MCP](https://img.shields.io/badge/MCP-9_tools-orange?style=flat-square)](#tools)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square)](#requirements)

MCP server for [AgentRecall](https://github.com/Goldentrii/AgentRecall) — two-layer session memory with Think-Execute-Reflect quality loops, alignment detection, and contradiction nudging. Works with any MCP-compatible agent: Claude Code, Cursor, VS Code Copilot, Windsurf, Claude Desktop, and more.

**Zero cloud. Zero telemetry. All data stays local.**

---

## Quick Start

### Claude Code

```bash
claude mcp add agent-recall -- npx -y agent-recall-mcp
```

### Cursor

`.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "agent-recall": {
      "command": "npx",
      "args": ["-y", "agent-recall-mcp"]
    }
  }
}
```

### VS Code

`.vscode/mcp.json`:
```json
{
  "servers": {
    "agent-recall": {
      "command": "npx",
      "args": ["-y", "agent-recall-mcp"]
    }
  }
}
```

### Windsurf / Claude Desktop

Same pattern — add as an MCP server with `npx -y agent-recall-mcp` as the command.

---

## Tools

9 MCP tools across three categories:

### Journal (Session Memory)

| Tool | Description |
|------|-------------|
| `journal_read` | Read entry by date or `"latest"`. Filter by section (`brief`, `qa`, `completed`, `status`, `blockers`, `next`, `decisions`, `reflection`, `files`, `observations`). |
| `journal_write` | Append to or replace today's journal. Target a specific section or use `replace_all` for full overwrite. |
| `journal_capture` | Lightweight Layer 1 Q&A capture — one question + answer pair, tagged, timestamped. Doesn't load the full journal. |
| `journal_list` | List recent entries for a project (date, title, momentum). |
| `journal_search` | Full-text search across all journal entries. Filter by section. |
| `journal_projects` | List all tracked projects on this machine. |

### Alignment (Intelligent Distance)

| Tool | Description |
|------|-------------|
| `alignment_check` | Record what the agent understood, its confidence level, assumptions, and any human correction. Measures the understanding gap. |
| `nudge` | Surface a contradiction between the human's current input and a prior decision. Helps the human clarify their own thinking. |

### Synthesis (Cross-Session Intelligence)

| Tool | Description |
|------|-------------|
| `context_synthesize` | Generate L3 semantic synthesis from recent journals — goal evolution, decision history, active blockers, recurring patterns, contradiction detection. |

---

## Resources

Two MCP resources for browsing without tool calls:

| URI Pattern | Description |
|-------------|-------------|
| `agent-recall://{project}/index` | Project journal index |
| `agent-recall://{project}/{date}` | Specific journal entry |

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

## Project Auto-Detection

When `project = "auto"` (default), the server resolves the project by:

1. `AGENT_RECALL_PROJECT` env var
2. Git remote origin → repo name
3. Git root directory → basename
4. `package.json` → `name` field
5. Basename of current working directory

---

## Storage

```
~/.agent-recall/                    (or $AGENT_RECALL_ROOT)
├── config.json
└── projects/
    └── {project-slug}/
        └── journal/
            ├── index.md              ← auto-generated index
            ├── YYYY-MM-DD.md         ← L2: daily journal
            ├── YYYY-MM-DD-log.md     ← L1: raw Q&A capture
            └── YYYY-MM-DD-alignment.md ← alignment checks + nudges
```

**Legacy support**: automatically reads existing journals from `~/.claude/projects/*/memory/journal/`. New writes go to `~/.agent-recall/`.

---

## CLI

```bash
npx agent-recall-mcp              # Start MCP server (stdio)
npx agent-recall-mcp --help       # Show help
npx agent-recall-mcp --list-tools # List all 9 tools as JSON
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_RECALL_ROOT` | `~/.agent-recall` | Storage root directory |
| `AGENT_RECALL_PROJECT` | (auto-detect) | Override project slug |

---

## Requirements

- Node.js >= 18
- Dependencies: `@modelcontextprotocol/sdk`, `zod`

---

## Part of AgentRecall

This MCP server is one component of the [AgentRecall](https://github.com/Goldentrii/AgentRecall) system:

- **SKILL.md** — Claude Code skill with Think-Execute-Reflect quality loops
- **agent-recall-mcp** — This MCP server (works with any agent)
- **Intelligent Distance Protocol** — The underlying theory

---

## License

MIT — [Tongwu](https://github.com/Goldentrii)

---

---

# agent-recall-mcp（中文文档）

> 给你的 AI 智能体一个跨会话记忆的大脑。

[AgentRecall](https://github.com/Goldentrii/AgentRecall) 的 MCP 服务器 — 双层会话记忆，Think-Execute-Reflect 质量循环，对齐检测，矛盾提醒。兼容所有 MCP 客户端：Claude Code、Cursor、VS Code Copilot、Windsurf、Claude Desktop 等。

**零云端。零遥测。所有数据保存在本地。**

---

## 快速开始

### Claude Code

```bash
claude mcp add agent-recall -- npx -y agent-recall-mcp
```

### Cursor

`.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "agent-recall": {
      "command": "npx",
      "args": ["-y", "agent-recall-mcp"]
    }
  }
}
```

### VS Code

`.vscode/mcp.json`：
```json
{
  "servers": {
    "agent-recall": {
      "command": "npx",
      "args": ["-y", "agent-recall-mcp"]
    }
  }
}
```

---

## 9 个工具

### 日志（会话记忆）

| 工具 | 功能 |
|------|------|
| `journal_read` | 按日期或 `"latest"` 读取日志。支持按章节过滤（`brief`、`qa`、`completed`、`status`、`blockers`、`next`、`decisions`、`reflection`、`files`、`observations`）。 |
| `journal_write` | 追加或替换今日日志。可指定目标章节，或用 `replace_all` 全量覆写。 |
| `journal_capture` | 轻量 Layer 1 问答捕获 — 一个问题+答案，带标签和时间戳。不加载完整日志。 |
| `journal_list` | 列出项目的最近日志条目（日期、标题、状态）。 |
| `journal_search` | 全文搜索所有日志条目，可按章节过滤。 |
| `journal_projects` | 列出本机所有被追踪的项目。 |

### 对齐（智能距离）

| 工具 | 功能 |
|------|------|
| `alignment_check` | 记录智能体的理解、置信度、假设和人类的纠正。量化理解差距。 |
| `nudge` | 检测到人类当前输入与之前的决策矛盾时，主动提问帮助人类理清思路。 |

### 合成（跨会话智能）

| 工具 | 功能 |
|------|------|
| `context_synthesize` | 从近期日志生成 L3 语义合成 — 目标演变、决策历史、活跃阻碍、重复模式、矛盾检测。 |

---

## 资源（Resources）

| URI 模式 | 说明 |
|----------|------|
| `agent-recall://{project}/index` | 项目日志索引 |
| `agent-recall://{project}/{date}` | 指定日期的日志条目 |

---

## 三层记忆架构

```
L1: 工作记忆    [每轮, ~50 tokens]    "发生了什么"
    ↓ 合成为
L2: 情景记忆    [每日日志, ~800 tok]   "这意味着什么"
    ↓ 合成为
L3: 语义记忆    [跨会话, ~200 tok]     "跨会话的真相"
    （矛盾检测 + 目标演变追踪）
```

---

## 项目自动识别

`project = "auto"`（默认）时，按以下优先级识别项目：

1. `AGENT_RECALL_PROJECT` 环境变量
2. Git 远程 origin → 仓库名
3. Git 根目录 → 目录名
4. `package.json` → `name` 字段
5. 当前工作目录的 basename

---

## 存储结构

```
~/.agent-recall/                    （或 $AGENT_RECALL_ROOT）
├── config.json
└── projects/
    └── {project-slug}/
        └── journal/
            ├── index.md              ← 自动生成索引
            ├── YYYY-MM-DD.md         ← L2: 每日日志
            ├── YYYY-MM-DD-log.md     ← L1: 原始问答捕获
            └── YYYY-MM-DD-alignment.md ← 对齐检查 + 矛盾提醒
```

**向后兼容**：自动读取 `~/.claude/projects/*/memory/journal/` 中的旧日志。新写入默认到 `~/.agent-recall/`。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_RECALL_ROOT` | `~/.agent-recall` | 存储根目录 |
| `AGENT_RECALL_PROJECT` | （自动识别） | 覆盖项目标识 |

---

## AgentRecall 生态

此 MCP 服务器是 [AgentRecall](https://github.com/Goldentrii/AgentRecall) 系统的组件之一：

- **SKILL.md** — Claude Code 技能，包含 Think-Execute-Reflect 质量循环
- **agent-recall-mcp** — 本 MCP 服务器（兼容任意智能体）
- **智能距离协议（Intelligent Distance Protocol）** — 底层理论框架

---

## 核心理念

**记忆解决遗忘，AgentRecall 解决误解。**

人类和 AI 之间的理解差距是结构性的 — 人类说话前后矛盾、碎片化、含糊不清；AI 则以完美的自信构建错误的东西。AgentRecall 通过对齐检测、矛盾提醒和跨会话合成来弥合这个「智能距离」。

---

## 许可证

MIT — [Tongwu](https://github.com/Goldentrii)
