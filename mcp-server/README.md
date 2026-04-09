<p align="center">
  <h1 align="center">AgentRecall</h1>
  <p align="center"><strong>Memory Palace for AI Agents — A Second Brain That Compounds</strong></p>
  <p align="center">Room-based knowledge organization · Cross-project insight recall · Salience scoring · Obsidian-compatible</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-recall-mcp"><img src="https://img.shields.io/npm/v/agent-recall-mcp?style=flat-square&color=5D34F2" alt="npm"></a>
  <a href="https://github.com/Goldentrii/AgentRecall/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/MCP-21_tools-orange?style=flat-square" alt="Tools">
  <img src="https://img.shields.io/badge/protocol-Intelligent_Distance-5B2D8E?style=flat-square" alt="Protocol">
  <img src="https://img.shields.io/badge/cloud-zero-blue?style=flat-square" alt="Zero Cloud">
  <img src="https://img.shields.io/badge/Obsidian-compatible-7C3AED?style=flat-square" alt="Obsidian">
</p>

---

## What Is AgentRecall?

AgentRecall is an **MCP server** (Model Context Protocol) that gives AI agents persistent memory, cross-project insight recall, and a self-compounding awareness system. It works with Claude Code, Cursor, VS Code, Windsurf, and any MCP-compatible agent.

**Not just a memory system.** Most agent memory tools store and retrieve. AgentRecall also:
- **Organizes** knowledge into themed rooms (Memory Palace)
- **Compounds** — insights merge and strengthen over time, not just accumulate
- **Cross-references** — writing to one room auto-updates related rooms
- **Recalls** — before starting a task, surfaces relevant lessons from any project
- **Detects misunderstanding** — measures the gap between human intent and agent interpretation

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Quick Capture     journal_capture                  │
│  Layer 2: Daily Journal     journal_write / journal_read     │
│  Layer 3: Memory Palace     palace_write / palace_walk       │
│  Layer 4: Awareness         awareness_update (compounding)   │
│  Layer 5: Insight Index     recall_insight (cross-project)   │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Claude Code
claude mcp add agent-recall -- npx -y agent-recall-mcp

# Cursor — .cursor/mcp.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# VS Code — .vscode/mcp.json
{ "servers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }

# Windsurf — ~/.codeium/windsurf/mcp_config.json
{ "mcpServers": { "agent-recall": { "command": "npx", "args": ["-y", "agent-recall-mcp"] } } }
```

**Skill (Claude Code only):**
```bash
mkdir -p ~/.claude/skills/agent-recall
curl -o ~/.claude/skills/agent-recall/SKILL.md \
  https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/SKILL.md
```

---

## How an Agent Uses AgentRecall

### Session Start
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

## 21 MCP Tools

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

### Architecture (3 tools)

| Tool | Purpose |
|------|---------|
| `journal_state` | JSON state layer — structured read/write for agent-to-agent handoffs |
| `journal_cold_start` | Cache-aware cold start: HOT (0-1d) / WARM (2-7d) / COLD (7d+) |
| `journal_archive` | Archive old entries to cold storage with summaries |

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

## Architecture

### Memory Palace

Inspired by the Method of Loci, Karpathy's LLM Wiki, and nashsu/llm_wiki.

```
~/.agent-recall/
  awareness.md                   # 200-line compounding document (global)
  awareness-state.json           # Structured awareness data
  insights-index.json            # Cross-project insight matching
  projects/
    <project>/
      journal/                   # RAW SOURCES (immutable)
        YYYY-MM-DD.md            # Daily journal
        YYYY-MM-DD-log.md        # L1 captures
        YYYY-MM-DD.state.json    # JSON state
      palace/                    # MEMORY PALACE (mutable wiki)
        identity.md              # ~50 token project identity card
        palace-index.json        # Room catalog + salience scores
        graph.json               # Cross-reference edges
        log.md                   # Operation audit trail
        rooms/
          goals/                 # Active goals, evolution
          architecture/          # Technical decisions, patterns
          blockers/              # Current and resolved
          alignment/             # Human corrections, misunderstandings
          knowledge/             # Learned lessons by category
          <custom>/              # Agents create rooms on demand
```

### Key Mechanisms

**Fan-out writes** — Write to one room, cross-references auto-update in related rooms via `[[wikilinks]]`. Mechanical, zero LLM cost.

**Salience scoring** — Every room has a salience score: `importance(0.4) + recency(0.3) + access_frequency(0.2) + connections(0.1)`. High-salience rooms surface first. Below threshold → auto-archive.

**Compounding awareness** — `awareness.md` is capped at 200 lines. When new insights are added, similar existing ones merge (strengthen), dissimilar ones compete (lowest-confirmation gets replaced). The constraint creates compression. Compression creates compounding.

**Cross-project insight recall** — `insights-index.json` maps insights to situations via keywords. `recall_insight("building quality gates")` returns relevant lessons from any project, ranked by severity × confirmation count.

**Obsidian-compatible** — Every palace file has YAML frontmatter + `[[wikilinks]]`. Open `palace/` as an Obsidian vault → graph view shows room connections. Zero Obsidian dependency.

### Intelligent Distance Protocol

The gap between human intent and agent understanding is structural — different cognitive origins, not a temporary technology problem. AgentRecall doesn't close this gap; it navigates it:

| Gap | Tool | How |
|-----|------|-----|
| Agent misunderstands intent | `alignment_check` | Records confidence + assumptions → human corrects before work |
| Agent contradicts prior decision | `nudge` | Surfaces contradiction → human clarifies |
| Agent forgets across sessions | `palace_walk` | Progressive loading from identity to full context |
| Agent repeats past mistakes | `recall_insight` | Cross-project insights surface before work starts |
| Agent's work quality is unclear | Think-Execute-Reflect | Counts, not feelings ("built 11 pages") |

---

## Supported Agents

| Agent | MCP | Skill | Notes |
|-------|:---:|:-----:|-------|
| Claude Code | ✅ | ✅ | Full support — MCP + SKILL.md |
| Cursor | ✅ | ⚡ | MCP via .cursor/mcp.json |
| VS Code (Copilot) | ✅ | — | MCP via .vscode/mcp.json |
| Windsurf | ✅ | ⚡ | MCP via mcp_config.json |
| Claude Desktop | ✅ | — | MCP server |
| Any MCP agent | ✅ | — | Standard MCP protocol |

---

## Design Philosophy

**Memory is not the goal. Understanding is.**

Most memory systems optimize for retrieval accuracy. AgentRecall optimizes for **alignment accuracy** — reducing the gap between what the human means and what the agent does.

**Compounding over accumulation.** A filing cabinet with better labels is still a filing cabinet. AgentRecall's awareness system forces merge-on-insert: every new insight either strengthens an existing one or replaces the weakest. After 100 sessions, `awareness.md` is still 200 lines — but each line carries the weight of confirmed, cross-validated observations.

**Cross-project by default.** Insights learned in one project apply everywhere. `recall_insight` doesn't care which project produced the lesson — it matches the current situation against the global index.

**Agent-friendly, human-visible.** Everything is markdown on disk. Agents consume it via MCP tools. Humans browse it in Obsidian (or any text editor). Zero cloud, zero telemetry, zero lock-in.

---

## Real Results

Validated over 30+ sessions across 5 production projects:
- Cold-start: **5 min → 2 seconds** (cache-aware loading)
- Decision retention: **0% → 100%** across sessions
- Misunderstanding caught before wrong work: **6+ instances** via alignment checks
- Repeated mistakes prevented: **3 instances** via cross-project insight recall
- All data local, all files markdown, all tools stateless

---

## Contributing

Built by [tongwu](https://github.com/Goldentrii).

- Issues & feedback: [GitHub Issues](https://github.com/Goldentrii/AgentRecall/issues)
- Email: tongwu0824@gmail.com
- Protocol spec: [docs/intelligent-distance-protocol.md](docs/intelligent-distance-protocol.md)

MIT License.

---

---

# AgentRecall（中文文档）

> 给你的 AI 智能体一个会成长的第二大脑。

---

## AgentRecall 是什么？

AgentRecall 是一个 **MCP 服务器**（Model Context Protocol），为 AI 智能体提供持久化记忆、跨项目洞察召回和自复合感知系统。支持 Claude Code、Cursor、VS Code、Windsurf 及所有 MCP 兼容的智能体。

**不只是记忆系统。** 大多数智能体记忆工具只做存储和检索。AgentRecall 还能：
- **组织** — 知识按主题房间分类（记忆宫殿）
- **复合** — 洞察随时间合并增强，不是单纯累积
- **交叉引用** — 写入一个房间时自动更新相关房间
- **召回** — 开始任务前，自动呈现任何项目中的相关经验教训
- **检测误解** — 测量人类意图和智能体理解之间的差距

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

**Claude Code 技能安装：**
```bash
mkdir -p ~/.claude/skills/agent-recall
curl -o ~/.claude/skills/agent-recall/SKILL.md \
  https://raw.githubusercontent.com/Goldentrii/AgentRecall/main/SKILL.md
```

---

## 智能体使用流程

### 会话开始
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

## 21 个 MCP 工具

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

### 架构工具（3 个）

| 工具 | 功能 |
|------|------|
| `journal_state` | JSON 状态层 — agent 间毫秒级结构化交接 |
| `journal_cold_start` | 缓存感知冷启动：热 (0-1天) / 温 (2-7天) / 冷 (7天+) |
| `journal_archive` | 归档旧条目到冷存储 |

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

## 架构

### 五层记忆模型

```
┌──────────────────────────────────────────────────────────────┐
│  L1: 工作记忆     journal_capture          「发生了什么」     │
│  L2: 情景记忆     journal_write            「这意味着什么」   │
│  L3: 记忆宫殿     palace_write / walk      「跨会话的知识」   │
│  L4: 感知系统     awareness_update          「复合的洞察」     │
│  L5: 洞察索引     recall_insight            「跨项目的经验」   │
└──────────────────────────────────────────────────────────────┘
```

### 核心机制

**扇出写入** — 写入一个房间，相关房间通过 `[[wikilinks]]` 自动更新交叉引用。机械式处理，零 LLM 成本。

**显著性评分** — 每个房间有显著性分数：`重要性(0.4) + 时效性(0.3) + 访问频率(0.2) + 连接数(0.1)`。高显著性房间优先展示，低于阈值自动归档。

**复合感知** — `awareness.md` 上限 200 行。新洞察加入时，相似的合并（增强），不相似的竞争（最低确认次数的被替换）。约束创造压缩，压缩创造复合。

**跨项目洞察召回** — `insights-index.json` 通过关键词将洞察映射到场景。`recall_insight("构建质量检查")` 返回来自任何项目的相关教训。

**Obsidian 兼容** — 每个宫殿文件都有 YAML frontmatter + `[[wikilinks]]`。将 `palace/` 作为 Obsidian vault 打开 → 图形视图展示房间连接。零 Obsidian 依赖。

### 智能距离协议

人类意图与智能体理解之间的差距是结构性的 — 源于不同的认知起源，不是临时的技术问题。

| 差距 | 工具 | 机制 |
|------|------|------|
| 智能体误解意图 | `alignment_check` | 记录置信度 + 假设 → 人类在工作前纠正 |
| 智能体与先前决策矛盾 | `nudge` | 发现矛盾 → 人类澄清 |
| 智能体跨会话遗忘 | `palace_walk` | 从身份到完整上下文的渐进式加载 |
| 智能体重复过去的错误 | `recall_insight` | 跨项目洞察在工作前自动呈现 |

---

## 设计理念

**记忆不是目的，理解才是。**

大多数记忆系统优化检索准确性。AgentRecall 优化**对齐准确性** — 缩小人类意图和智能体行为之间的差距。

**复合优于累积。** 贴了更好标签的文件柜还是文件柜。AgentRecall 的感知系统在插入时强制合并：每个新洞察要么增强已有的，要么替换最弱的。100 个会话后，`awareness.md` 仍是 200 行 — 但每一行承载着经过确认和交叉验证的观察。

**默认跨项目。** 在一个项目中学到的洞察适用于所有项目。`recall_insight` 不关心教训来自哪个项目 — 它匹配当前场景和全局索引。

**智能体友好，人类可见。** 一切都是磁盘上的 markdown。智能体通过 MCP 工具消费。人类在 Obsidian（或任何文本编辑器）中浏览。零云端、零遥测、零锁定。

---

## 贡献

由 [tongwu](https://github.com/Goldentrii) 构建。

- Issues & 反馈：[GitHub Issues](https://github.com/Goldentrii/AgentRecall/issues)
- 邮箱：tongwu0824@gmail.com
- 协议规范：[docs/intelligent-distance-protocol.md](docs/intelligent-distance-protocol.md)

MIT 许可证。
