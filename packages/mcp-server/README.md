<h1 align="center">AgentRecall — MCP Server</h1>

<p align="center"><strong>Your agent doesn't just remember. It learns how you think.</strong></p>
<p align="center">Persistent, compounding memory + automatic correction capture for Claude Code, Cursor, Windsurf, Codex, and any MCP-compatible agent.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-recall-mcp"><img src="https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square&label=MCP&color=5D34F2" alt="MCP npm"></a>
  <a href="https://github.com/Goldentrii/AgentRecall/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License"></a>
  <a href="https://lobehub.com/mcp/goldentrii-agentrecall"><img src="https://lobehub.com/badge/mcp/goldentrii-agentrecall" alt="MCP Badge"></a>
  <img src="https://img.shields.io/badge/MCP-6_tools-orange?style=flat-square" alt="Tools">
  <img src="https://img.shields.io/badge/cloud-zero-blue?style=flat-square" alt="Zero Cloud">
  <img src="https://img.shields.io/badge/saves_up_to-57%25_tokens-FF6B6B?style=flat-square" alt="Token savings">
  <img src="https://img.shields.io/badge/break--even-3--4_sessions-22C55E?style=flat-square" alt="Break-even">
</p>

<p align="center">
  <a href="#quick-start"><b>Install</b></a> ·
  <a href="#three-commands"><b>Commands</b></a> ·
  <a href="#auto-hooks"><b>Hooks</b></a> ·
  <a href="#6-mcp-tools"><b>Tools</b></a> ·
  <a href="#benchmarked-savings"><b>Benchmarks</b></a> ·
  <a href="#architecture"><b>Architecture</b></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#agentrecall-mcp中文文档">中文</a>
</p>

---

## Quick Start

One command to wire AgentRecall into your agent:

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

**Claude Code skill (one-time, recommended):**
```bash
mkdir -p ~/.claude/skills/agent-recall
curl -o ~/.claude/skills/agent-recall/SKILL.md \
  https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/SKILL.md
```

**Install slash commands (Claude Code only):**
```bash
mkdir -p ~/.claude/commands
curl -o ~/.claude/commands/arsave.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arsave.md
curl -o ~/.claude/commands/arstart.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arstart.md
curl -o ~/.claude/commands/arsaveall.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arsaveall.md
```

---

## Three Commands

> That's all you need.

| Command | When | What it does |
|---------|------|-------------|
| **`/arsave`** | End of session | Write journal + consolidate to palace + update awareness |
| **`/arstart`** | Start of session | Recall cross-project insights + walk palace + load context |
| **`/arsaveall`** | End of day (multi-session) | Batch save all parallel sessions at once — scan, merge, deduplicate |

Type `/arsave` after a session. Type `/arstart` next time. Everything loads back.

**Running 5 agents in parallel?** Don't `/arsave` five times. Type **`/arsaveall`** once — it scans all sessions across all projects, merges them into consolidated journals, deduplicates insights. Each session writes to its own file (session-ID scoped), so no conflicts, no data loss.

---

## Auto Hooks

Wire once in `~/.claude/settings.json`. Every session is saved automatically — even without typing `/arsave`:

```json
{
  "hooks": {
    "SessionStart": [{
      "command": "node ~/.local/share/npm/lib/node_modules/agent-recall-cli/dist/index.js hook-start 2>/dev/null || true"
    }],
    "UserPromptSubmit": [{
      "command": "node ~/.local/share/npm/lib/node_modules/agent-recall-cli/dist/index.js hook-correction 2>/dev/null || true"
    }, {
      "command": "node ~/.local/share/npm/lib/node_modules/agent-recall-cli/dist/index.js hook-ambient 2>/dev/null || true"
    }],
    "Stop": [{
      "command": "node ~/.local/share/npm/lib/node_modules/agent-recall-cli/dist/index.js hook-end 2>/dev/null || true"
    }]
  }
}
```

| Hook | Trigger | What it does |
|------|---------|-------------|
| `hook-start` | SessionStart | Prints identity + top insights + `watch_for` warnings |
| `hook-correction` | Every user prompt | Detects corrections (regex) and captures them silently — no agent discretion |
| `hook-ambient` | Every user prompt | Extracts keywords → fires recall → injects top results before agent responds |
| `hook-end` | Session close | Appends lightweight end-of-session log entry |

Hooks move the save burden from agent discretion → harness enforcement. The agent never has to remember to save.

---

## 6 MCP Tools

AgentRecall exposes 6 tools to your agent. Each tool composes multiple subsystems — the agent doesn't need to know about the plumbing.

| Tool | What it does |
|------|-------------|
| `session_start` | Load project context. Returns identity, top insights, active rooms, cross-project matches, and `watch_for` warnings from past corrections. One call, ~400 tokens. |
| `remember` | Save a memory. Auto-classifies and routes to the right store (journal, palace, knowledge, or awareness). Auto-generates semantic names for retrieval. |
| `recall` | Search all memory stores with **Reciprocal Rank Fusion (RRF)**. Returns ranked results. Accepts `feedback` to rate previous results — positive boosts future ranking, negative penalizes. |
| `session_end` | Save everything in one call: journal + awareness update + palace consolidation + archive demoted insights (preserved, not deleted). |
| `check` | Record what you think the human wants. Returns `watch_for` patterns from past corrections. Accepts `human_correction` and `delta` after the human responds. |
| `digest` | **Context cache** — store pre-computed analysis results and recall them instead of recomputing. Supports TTL, global store, and dedup. **83% token savings on repeated analysis.** |

---

## How Memory Compounds

Memory is not a list. It's a compounding system — each layer feeds the next:

1. **Auto-Naming** — Content is saved with semantic slugs. Good naming is the first layer of retrieval.
2. **Indexes** — Every memory has an address in palace index, insights index, and the 200-line awareness document.
3. **Relativity** — Memories that relate to each other are connected automatically via graph edges.
4. **Weight + Decay** — Salience scoring: `recency(0.30) + access(0.25) + connections(0.20) + urgency(0.15) + importance(0.10)`. Architecture decisions persist; blocker noise fades.
5. **Feedback Loop** — Bayesian Beta distribution learns which recalled memories are actually useful. Useful memories rise; noise sinks.

```
Session 1:   Save 3 memories → auto-named, indexed, edges created
Session 5:   Recall surfaces sessions 1-4; feedback refines ranking
Session 10:  watch_for warns agent about past mistakes before they repeat
Session 20:  Awareness has 10 cross-validated insights (merged from 40+ raw)
Session 50:  The agent knows your priorities, blind spots, communication style
```

---

## Benchmarked Savings

> **Honest caveat:** The "without AR" costs are modeled estimates — we estimated what a human would spend re-explaining context. These are not long-term production data. Real savings depend on project complexity and session count. [Let us know](mailto:tong.wu@novada.com) if your results differ.

| Scenario | Without AR | With AR | Saved |
|----------|:----------:|:-------:|:-----:|
| **A: Simple** (2 sessions, 0 corrections) | 567 | 1,131 | **+99% overhead** |
| **B: Medium** (5 sessions, 1 correction) | 6,220 | 4,382 | **-30%** |
| **C: Complex** (20 sessions, 5 corrections) | 40,910 | 17,520 | **-57%** |
| **D: Multi-agent** (3 agents × 5 sessions) | 20,781 | 13,140 | **-37%** |
| **E: Digest cache** (repeated analysis) | ~2,400 | ~400 | **-83%** |

**Break-even: ~3-4 sessions.** For simple throwaway tasks, AR is overhead. For anything with 3+ sessions, corrections, or multiple agents, it pays for itself.

---

## Architecture

```
Agent (Claude Code / Cursor / Windsurf / Codex)
  │
  └─ MCP tools: session_start, remember, recall, session_end, check, digest
       │
       └─ agent-recall-core (local, no cloud)
            │
            ├─ ~/.agent-recall/awareness.md          (200-line global document)
            ├─ ~/.agent-recall/insights-index.json   (cross-project recall)
            └─ ~/.agent-recall/projects/<project>/
                 ├─ journal/          (daily logs)
                 └─ palace/rooms/     (persistent decisions, Obsidian-compatible)
```

Everything is markdown on disk. Browse in Obsidian, grep in terminal, version in git. Zero cloud, zero telemetry.

---

## Links

- **Full documentation:** [Main README](../../README.md)
- **SDK API reference:** [agent-recall-core](../core/README.md)
- **GitHub:** [Goldentrii/AgentRecall](https://github.com/Goldentrii/AgentRecall)
- **Issues:** [GitHub Issues](https://github.com/Goldentrii/AgentRecall/issues)
- **Email:** [tong.wu@novada.com](mailto:tong.wu@novada.com)

---

---

# AgentRecall MCP（中文文档）

> **你的智能体记不清楚？AgentRecall 让它学会理解你的思维方式。**
>
> 持久复合记忆 + 自动纠正捕获。适用于 Claude Code、Cursor、Windsurf、Codex 等 MCP 兼容智能体。

---

## 快速开始

```bash
# Claude Code
claude mcp add --scope user agent-recall -- npx -y agent-recall-mcp

# Cursor — .cursor/mcp.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

**安装斜杠命令（Claude Code）：**
```bash
mkdir -p ~/.claude/commands
curl -o ~/.claude/commands/arsave.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arsave.md
curl -o ~/.claude/commands/arstart.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arstart.md
curl -o ~/.claude/commands/arsaveall.md https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/commands/arsaveall.md
```

---

## 三个命令

| 命令 | 时机 | 功能 |
|------|------|------|
| **`/arsave`** | 会话结束时 | 写入日志 + 整合到记忆宫殿 + 更新感知 |
| **`/arstart`** | 会话开始时 | 召回跨项目洞察 + 遍历宫殿 + 加载上下文 |
| **`/arsaveall`** | 一天结束时（多会话） | 一次性批量保存所有并行会话 |

---

## 自动 Hooks

配置一次，永久自动保存。四个 hook 完全覆盖会话生命周期：

| Hook | 触发时机 | 功能 |
|------|---------|------|
| `hook-start` | 会话开始 | 打印身份 + 洞察 + `watch_for` 警告 |
| `hook-correction` | 每条用户消息 | 静默捕获纠正信号，无需 agent 手动调用 |
| `hook-ambient` | 每条用户消息 | 提取关键词 → 自动召回 → 注入上下文 |
| `hook-end` | 会话关闭 | 追加轻量级结束日志 |

---

## 6 个 MCP 工具

| 工具 | 功能 |
|------|------|
| `session_start` | 加载项目上下文，返回身份、洞察、活跃房间、跨项目匹配、`watch_for` 警告 |
| `remember` | 保存记忆，自动分类路由到正确存储 |
| `recall` | RRF 融合搜索所有存储，结果可反馈调权 |
| `session_end` | 一次调用保存所有：日志 + 感知 + 宫殿整合 |
| `check` | 记录 agent 对用户意图的理解，返回历史纠正的 `watch_for` 模式 |
| `digest` | 上下文缓存——存储预计算分析结果，避免重复推理。**重复分析节省 83% token** |

---

## 基准测试（诚实说明）

> 以下数据为建模估算，并非长期生产数据。简单任务中 AR 是纯开销；3+ 会话后开始回本，随后持续节省。

| 场景 | 无 AR | 有 AR | 节省 |
|------|:-----:|:-----:|:----:|
| A：简单（2 次会话，0 次纠正） | 567 | 1,131 | **+99% 开销** |
| B：中等（5 次会话，1 次纠正） | 6,220 | 4,382 | **-30%** |
| C：复杂（20 次会话，5 次纠正） | 40,910 | 17,520 | **-57%** |
| D：多 agent（3 agent × 5 次） | 20,781 | 13,140 | **-37%** |
| E：Digest 缓存（重复分析） | ~2,400 | ~400 | **-83%** |

**盈亏平衡点：约 3-4 次会话。**

---

## 相关链接

- **完整文档：** [主 README](../../README.md)
- **SDK API：** [agent-recall-core](../core/README.md)
- **GitHub：** [Goldentrii/AgentRecall](https://github.com/Goldentrii/AgentRecall)
- **问题反馈：** [GitHub Issues](https://github.com/Goldentrii/AgentRecall/issues)
