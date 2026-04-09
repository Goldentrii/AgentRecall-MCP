<p align="center">
  <h1 align="center">AgentRecall</h1>
  <p align="center"><strong>The Intelligent Distance Protocol for AI Agents</strong></p>
  <p align="center">Minimize information loss between human and AI — across every session, every agent, every project.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-recall-mcp"><img src="https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square&color=5D34F2" alt="npm"></a>
  <a href="https://github.com/NovadaLabs/AgentRecall/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP-19_tools-orange?style=flat-square" alt="Tools">
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

## 19 MCP Tools

### Session Memory (6 tools)

| Tool | Purpose |
|------|---------|
| `journal_read` | Read entry by date or "latest". Filter by section. |
| `journal_write` | Write or update journal content. Optional `palace_room` param for palace integration. |
| `journal_capture` | Lightweight L1 Q&A capture. Optional `palace_room` param. |
| `journal_list` | List recent entries |
| `journal_search` | Full-text search across history. `include_palace=true` to also search palace. |
| `journal_projects` | List all tracked projects |

### Memory Palace (5 tools) — NEW

| Tool | Purpose |
|------|---------|
| `palace_read` | **Read palace rooms** — list rooms or read specific room/topic content |
| `palace_write` | **Write with fan-out** — writes memory to a room, auto-updates cross-references via `[[wikilinks]]` |
| `palace_walk` | **Progressive cold-start** — identity (~50 tok) → active (~200) → relevant (~500) → full (~2000) |
| `palace_lint` | **Health check** — detect stale, orphan, low-salience rooms. `fix=true` to auto-archive. |
| `palace_search` | **Salience-ranked search** — search across all palace rooms, results ordered by importance |

### v3 Architecture (3 tools)

| Tool | Purpose |
|------|---------|
| `journal_state` | **JSON state layer** — structured read/write for agent-to-agent handoffs |
| `journal_cold_start` | **Cache-aware cold start** — HOT (today+yesterday), WARM (2-7 days), COLD (7+ days) |
| `journal_archive` | **Archive old entries** — moves to `archive/` with summaries |

### Knowledge Loop (2 tools)

| Tool | Purpose |
|------|---------|
| `knowledge_write` | **Write permanent lessons** — dynamic categories (any string), auto-creates palace room. |
| `knowledge_read` | **Read past lessons** — filter by project, category, or search query. |

### Alignment & Synthesis (3 tools)

| Tool | Purpose |
|------|---------|
| `alignment_check` | Record confidence + assumptions + human corrections. Auto-writes to palace alignment room. |
| `nudge` | Surface contradiction between current and past input |
| `context_synthesize` | L3 synthesis. `consolidate=true` writes results into palace rooms. |

---

## Memory Palace Architecture

Inspired by the Method of Loci, Karpathy's LLM Wiki, and nashsu/llm_wiki.

```
~/.agent-recall/projects/<project>/
  journal/                    # RAW SOURCES (immutable, backward compatible)
    YYYY-MM-DD.md             # Daily journal
    YYYY-MM-DD-log.md         # L1 captures
  palace/                     # MEMORY PALACE (mutable knowledge wiki)
    identity.md               # ~50 token project identity card
    palace-index.json          # Room catalog with salience scores
    graph.json                # Cross-reference edges
    log.md                    # Operation audit trail
    rooms/
      goals/                  # Active goals, evolution
      architecture/           # Technical decisions, patterns
      blockers/               # Current and resolved
      alignment/              # Human corrections, misunderstandings
      knowledge/              # Learned lessons by category
      <custom>/               # Agents can create any room
```

**Key mechanisms:**
- **Fan-out writes** — writing to one room updates cross-references in related rooms via `[[wikilinks]]`
- **Salience scoring** — `importance(0.4) + recency(0.3) + access(0.2) + connections(0.1)`
- **Obsidian-compatible** — YAML frontmatter + wikilinks. Open `palace/` as an Obsidian vault for graph view.
- **Operation log** — every palace write, lint, and consolidation is logged for audit

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

---

---

# agent-recall-mcp（中文文档）

> 给你的 AI 智能体一个跨会话记忆的大脑。

---

## 智能距离（Intelligent Distance）— 核心理念

> *「人类智能与 AI 智能之间的差距是结构性的、永久的 — 不是一个临时的技术问题。」*

人类是「生出来的」（具身经验、情感、生存压力）。机器是「造出来的」（规则、确定性）。AI 是「训练出来的」（数据上的统计共现）。三种不同的认知起源，产生三种不同的理解方式。这个差距不会随 AI 进步而消失 — 因为差异在于**起源**，而非能力。

```
人类说：「全部点击」
AI 理解：「点击主要的」
差距：「全部」≠「主要的」

人类说：「做完意味着完全一样」
AI 认为：「差不多就行」
差距：「完全一样」≠「差不多」

人类给出：零散、非线性的指令
AI 选择：一条指令，忽略其余
差距：点与点之间的逻辑关联丢失了
```

**AgentRecall 不试图缩小这个差距，而是构建一个协议来导航它。**

---

## AgentRecall 如何弥合差距

| 智能距离缺口 | AgentRecall 工具 | 功能 |
|-------------|-----------------|------|
| 智能体忘了人类昨天说的话 | `journal_read` + `journal_cold_start` | 三层记忆 + 缓存感知冷启动 |
| 智能体误解人类意图 | `alignment_check` | 记录置信度 + 假设 → 人类在工作开始前纠正 |
| 智能体与之前的决策矛盾 | `nudge` | 检测矛盾 → 在造成损失前提出 |
| 智能体说「完成了」但人类不同意 | Think-Execute-Reflect 循环 | 用数字评分（「建了 11 页 35 个标签」），不用感觉（「做得不错」）|
| 智能体凭想象构建，而非基于数据 | `journal_state` (JSON) | agent 间结构化交接 — 毫秒级，无需解析散文 |
| 智能体重复同样的错误 | 失败记录 + `context_synthesize` | 跨会话模式检测 → 提升为永久记忆 |
| 下一个 agent 从零开始 | `journal_cold_start` (v3) | 热/温/冷缓存 — 加载 3 个文件而非 28 个 |

**记忆解决遗忘，AgentRecall 解决误解。**

---

## 快速开始

```bash
# Claude Code
claude mcp add agent-recall -- npx -y agent-recall-mcp

# Cursor — .cursor/mcp.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# VS Code — .vscode/mcp.json
{ "servers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

---

## 14 个工具

### 会话记忆（6 个）

| 工具 | 功能 |
|------|------|
| `journal_read` | 按日期读取日志，支持章节过滤 |
| `journal_write` | 追加或替换今日日志 |
| `journal_capture` | 轻量问答捕获 |
| `journal_list` | 列出最近日志 |
| `journal_search` | 全文搜索 |
| `journal_projects` | 列出所有项目 |

### v3 架构（3 个）— 新增

| 工具 | 功能 |
|------|------|
| `journal_state` | **JSON 状态层** — 结构化读写，agent 间毫秒级交接 |
| `journal_cold_start` | **缓存感知冷启动** — 热（0-1天）/ 温（2-7天）/ 冷（7天+） |
| `journal_archive` | **归档旧条目** — 移至 archive/，保留单行摘要 |

### 知识循环（2 个）— 新增

| 工具 | 功能 |
|------|------|
| `knowledge_write` | **写入永久教训** — 按类别结构化记录（提取、构建、验证、工具、通用）。Agent 从过去的错误中学习。 |
| `knowledge_read` | **读取过去教训** — 按项目、类别或搜索词过滤。Agent 开始工作前检查过去的失败。 |

### 对齐 & 合成（3 个）

| 工具 | 功能 |
|------|------|
| `alignment_check` | 记录理解度、置信度、假设、人类纠正 |
| `nudge` | 检测矛盾，主动提问 |
| `context_synthesize` | 跨会话合成：目标演变、决策历史、模式检测 |

---

## 三层记忆 + v3 缓存

```
┌─────────────────────────────────────────────────────────┐
│ L1: 工作记忆    [每轮, ~50 tok]     「发生了什么」        │
│     ↓ 合成为                                             │
│ L2: 情景记忆    [每日日志, ~800 tok] 「这意味着什么」      │
│     ↓ 合成为                                             │
│ L3: 语义记忆    [跨会话]            「跨会话的真相」       │
│     （矛盾检测 + 目标演变追踪）                           │
├─────────────────────────────────────────────────────────┤
│ v3: JSON 状态层  [每会话]  agent 间结构化数据              │
├─────────────────────────────────────────────────────────┤
│ v3: 缓存层       热（0-1天）→ 温（2-7天）→ 冷（7天+）    │
│     journal_cold_start → 加载 3 个文件而非 28 个          │
└─────────────────────────────────────────────────────────┘
```

---

## Think-Execute-Reflect 质量循环

```
🧠 THINK    → 方法对吗？做了调研吗？
⚡ EXECUTE  → 实际 vs 计划？（用数字，不用感觉）
🔍 REFLECT  → 5 维度质量评分 + 智能距离差距分析
🔄 FEEDBACK → 循环（需要迭代）或 退出（质量足够）
```

**Reflect 步骤显式测量智能距离：**
- 用户意图 vs 我的理解
- 两者之间的差距（或「无 — 已对齐」）
- 下次如何缩小差距

---

## 反馈 & 贡献

由 [tongwu](https://github.com/Goldentrii) 在 [NovadaLabs](https://github.com/NovadaLabs) 构建。

**我们期待你的反馈：**
- 邮箱：tongwu0824@gmail.com
- GitHub Issues：[NovadaLabs/AgentRecall](https://github.com/NovadaLabs/AgentRecall/issues)

---

## 许可证

MIT — [tongwu](https://github.com/Goldentrii) @ [NovadaLabs](https://github.com/NovadaLabs)
