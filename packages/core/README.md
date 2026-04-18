<h1 align="center">AgentRecall — Core</h1>

<p align="center"><strong>Your agent doesn't just remember. It learns how you think.</strong></p>
<p align="center">Core engine for AgentRecall. Use this package if you're building with the SDK — calling functions directly from LangChain, CrewAI, Vercel AI SDK, or your own agent framework.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-recall-core"><img src="https://img.shields.io/npm/v/agent-recall-core?style=flat-square&label=core&color=5D34F2" alt="core npm"></a>
  <a href="https://github.com/Goldentrii/AgentRecall/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/cloud-zero-blue?style=flat-square" alt="Zero Cloud">
  <img src="https://img.shields.io/badge/scoring-RRF_(Cormack_2009)-7C3AED?style=flat-square" alt="RRF scoring">
  <img src="https://img.shields.io/badge/decay-Ebbinghaus%2BZipf-3B82F6?style=flat-square" alt="Ebbinghaus+Zipf decay">
  <img src="https://img.shields.io/badge/feedback-Bayesian_Beta-F59E0B?style=flat-square" alt="Beta distribution">
</p>

<p align="center">
  <a href="#install"><b>Install</b></a> ·
  <a href="#sdk-api-reference"><b>SDK API</b></a> ·
  <a href="#example-session-lifecycle"><b>Example</b></a> ·
  <a href="#scoring-architecture"><b>Scoring</b></a> ·
  <a href="#storage-layout"><b>Storage</b></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#agent-recall-core中文文档">中文</a>
</p>

> **Not building an app?** If you want to add memory to Claude Code, Cursor, or any MCP-compatible agent, use [`agent-recall-mcp`](../mcp-server/README.md) instead.

---

## Install

```bash
npm install agent-recall-core
```

This package is the shared business logic layer used by `agent-recall-mcp`, `agent-recall-sdk`, and `agent-recall-cli`. Import it directly when you want low-level access to palace operations, scoring, awareness, and corrections.

---

## SDK API Reference

### Session Lifecycle

| Function | Signature | Description |
|----------|-----------|-------------|
| `sessionStart(project, opts?)` | `Promise<SessionStartResult>` | Load project context: identity, insights, active rooms, cross-project matches, `watch_for` warnings |
| `sessionEnd(summary, insights, trajectory, opts?)` | `Promise<SessionEndResult>` | Save everything: journal + awareness + palace consolidation |
| `check(goal, confidence, opts?)` | `Promise<CheckResult>` | Record what you think the human wants; get `watch_for` patterns from past corrections |

### Memory Storage

| Function | Signature | Description |
|----------|-----------|-------------|
| `smartRemember(content, opts?)` | `Promise<RememberResult>` | Auto-classify and route to the right store (journal / palace / awareness / knowledge) |
| `smartRecall(query, opts?)` | `Promise<RecallResult>` | RRF-ranked search across all stores; accepts `feedback` to adjust future rankings |
| `generateTags(content)` | `string[]` | Rule-based multi-label tag generation for new memories |

### Palace Operations

| Function | Signature | Description |
|----------|-----------|-------------|
| `createRoom(project, room, opts?)` | `Promise<RoomMeta>` | Create a new palace room |
| `listRooms(project)` | `Promise<RoomMeta[]>` | List all rooms with salience scores |
| `fanOut(project, room, content, opts?)` | `Promise<FanOutResult>` | Write to a room; auto-update cross-references in related rooms |
| `palaceSearch(project, query, opts?)` | `Promise<SearchResult[]>` | Tag-union + keyword search across palace rooms |
| `ensurePalaceInitialized(project)` | `Promise<void>` | Initialize palace structure if not present |
| `recordAccess(project, room)` | `Promise<void>` | Update room access time for salience scoring |

### Awareness

| Function | Signature | Description |
|----------|-----------|-------------|
| `readAwareness()` | `Promise<string>` | Read the 200-line compounding awareness document |
| `writeAwareness(content)` | `Promise<void>` | Overwrite awareness document |
| `addInsight(insight, opts?)` | `Promise<void>` | Add insight; triggers merge-or-replace against existing entries |
| `detectCompoundInsights(project)` | `Promise<CompoundInsight[]>` | Detect patterns across multiple sessions |
| `renderAwareness()` | `Promise<string>` | Render structured awareness for context injection |

### Corrections Store

| Function | Signature | Description |
|----------|-----------|-------------|
| `writeCorrection(rule, why, howToApply, opts?)` | `Promise<void>` | Write a behavioral correction; P0 (never/always/don't) auto-detected |
| `readP0Corrections(project, limit?)` | `Promise<Correction[]>` | Read highest-priority corrections (max 5, loaded on every session start) |

### Insights Index

| Function | Signature | Description |
|----------|-----------|-------------|
| `recallInsights(context, opts?)` | `Promise<IndexedInsight[]>` | Cross-project insight recall; ranked by severity × confirmation count |
| `addIndexedInsight(insight, opts?)` | `Promise<void>` | Add insight to the global index |

### Scoring Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `computeSalience(room)` | `number` | `recency(0.30) + access(0.25) + connections(0.20) + urgency(0.15) + importance(0.10)` |

---

## Example: Session Lifecycle

```typescript
import {
  sessionStart,
  smartRemember,
  smartRecall,
  sessionEnd,
  writeCorrection,
  readP0Corrections,
  setRoot,
} from "agent-recall-core";

// Optional: override storage root (default: ~/.agent-recall)
setRoot("/custom/path");

// --- Session Start ---
const ctx = await sessionStart("my-project");
console.log(ctx.identity);    // Project identity card
console.log(ctx.insights);    // Cross-project insights matched to this project
console.log(ctx.watch_for);   // Past corrections that apply — agent should heed these

// Load highest-priority behavioral corrections
const corrections = await readP0Corrections("my-project");
// e.g. [{ rule: "no black backgrounds", severity: "P0", ... }]

// --- During Work ---
await smartRemember("We switched from REST to GraphQL for the API layer", {
  project: "my-project",
  importance: "high",
});

const results = await smartRecall("API design decisions", {
  project: "my-project",
});
// results.items: ranked list from journal + palace + knowledge stores

// If human corrects the agent:
await writeCorrection(
  "Always ask before choosing a framework",
  "Human was surprised by the GraphQL choice",
  "When picking a framework, present options and get explicit approval",
  { project: "my-project" }
);

// --- Session End ---
await sessionEnd(
  "Switched API layer to GraphQL. Documented reasoning in architecture room.",
  ["GraphQL reduces over-fetching on dashboard queries"],
  "Next: wire authentication middleware",
  { project: "my-project" }
);
```

---

## LangChain / CrewAI Integration

```typescript
import { sessionStart, smartRecall, smartRemember, sessionEnd } from "agent-recall-core";

// Before your agent runs
const ctx = await sessionStart("langchain-app");
const insights = await smartRecall("current task", { project: "langchain-app" });

const systemPrompt = `You have persistent memory:\n${ctx.identity}\n\nRelevant:\n${
  insights.items.map((i) => i.content).join("\n")
}`;

// Run your agent with systemPrompt injected...

// After your agent runs
await smartRemember(agentOutput, { project: "langchain-app" });
await sessionEnd("Agent completed task.", ["Key decision from this run"], "Next: ...", {
  project: "langchain-app",
});
```

---

## Scoring Architecture

AgentRecall uses three scoring algorithms layered together:

**1. Reciprocal Rank Fusion (RRF) — Cormack 2009**
Each memory store (journal, palace, knowledge, awareness) ranks results internally. RRF merges the position lists: `score = Σ 1/(k + rank_i)` where `k=60`. No store dominates by default. Tag-union matches get a +0.3 bonus, capped at 1.0.

**2. Ebbinghaus Forgetting Curve with Zipf Adjustment**
`R(t) = e^(−t/S)` where S is memory-type-specific:

| Memory type | S (days) | 1-day retention |
|-------------|:--------:|:---------------:|
| Journal (episodic) | 2 | 60% |
| Knowledge / bug fix | 180 | 99% |
| Palace / decisions | 9,999 | ≈100% |

Digest cache half-life is Zipf-adjusted: frequently-accessed digests decay slower.

**3. Bayesian Beta Distribution**
`E[Beta(α,β)] = (pos+1)/(pos+neg+2)` — optimal estimate of true usefulness from binary feedback. Feedback is query-aware; rating a result "useless" for one query doesn't penalize it for different queries.

Full rationale: [docs/SCORING.md](../../docs/SCORING.md)

---

## Storage Layout

```
~/.agent-recall/
  awareness.md                    # 200-line global compounding document
  awareness-state.json            # Structured awareness data
  awareness-archive.json          # Demoted insights (preserved, not deleted)
  insights-index.json             # Cross-project insight matching
  projects/
    <project>/
      journal/
        YYYY-MM-DD.md             # Daily journal
        YYYY-MM-DD-log.md         # L1 captures (hook entries)
        index.jsonl               # Fast machine-scannable index
      palace/
        identity.md               # ~50 token project identity card
        palace-index.json          # Room catalog + salience scores
        graph.json                 # Cross-reference edges
        feedback-log.json          # Per-query feedback scores
        alignment-log.json         # Past corrections for watch_for
        corrections.json           # P0/P1 behavioral corrections store
        rooms/
          goals/
          architecture/
          blockers/
          alignment/
          knowledge/
          <custom>/               # Agents create rooms on demand
```

Everything is markdown + JSON on disk. Obsidian-compatible (YAML frontmatter + `[[wikilinks]]`). Version with git, grep in terminal, browse in Obsidian.

---

## Links

- **MCP server:** [agent-recall-mcp](../mcp-server/README.md) — use this for Claude Code / Cursor / Windsurf
- **CLI:** [agent-recall-cli](../cli/README.md) — `ar` command for terminal and CI
- **Full documentation:** [Main README](../../README.md)
- **Scoring rationale:** [docs/SCORING.md](../../docs/SCORING.md)
- **GitHub:** [Goldentrii/AgentRecall](https://github.com/Goldentrii/AgentRecall)
- **Issues:** [GitHub Issues](https://github.com/Goldentrii/AgentRecall/issues)

---

---

# agent-recall-core（中文文档）

> **Core 引擎包。** 如果你在用 SDK 直接集成 AgentRecall（LangChain、CrewAI、Vercel AI SDK、自定义 agent），使用这个包。
>
> 如果你只是想给 Claude Code / Cursor 添加记忆，请用 [`agent-recall-mcp`](../mcp-server/README.md)。

---

## 安装

```bash
npm install agent-recall-core
```

---

## 核心函数速查

### 会话生命周期

| 函数 | 说明 |
|------|------|
| `sessionStart(project, opts?)` | 加载项目上下文：身份、洞察、活跃房间、`watch_for` 警告 |
| `sessionEnd(summary, insights, trajectory, opts?)` | 一次调用保存所有内容 |
| `check(goal, confidence, opts?)` | 记录对用户意图的理解，返回历史纠正模式 |

### 记忆存储

| 函数 | 说明 |
|------|------|
| `smartRemember(content, opts?)` | 自动分类，路由到正确存储 |
| `smartRecall(query, opts?)` | RRF 融合搜索，可反馈调权 |
| `generateTags(content)` | 规则驱动的多标签生成 |

### 纠正存储

| 函数 | 说明 |
|------|------|
| `writeCorrection(rule, why, how, opts?)` | 写入行为纠正；自动检测 P0 级别（never/always/don't） |
| `readP0Corrections(project, limit?)` | 读取最高优先级纠正（每次 session_start 自动加载） |

### 感知系统

| 函数 | 说明 |
|------|------|
| `readAwareness()` | 读取 200 行复合感知文档 |
| `addInsight(insight, opts?)` | 添加洞察，触发合并或替换逻辑 |
| `recallInsights(context, opts?)` | 跨项目洞察召回 |

---

## 会话示例

```typescript
import { sessionStart, smartRemember, smartRecall, sessionEnd } from "agent-recall-core";

const ctx = await sessionStart("my-project");
// ctx.watch_for — 历史纠正警告

await smartRemember("改用 GraphQL 替代 REST", { project: "my-project", importance: "high" });

const results = await smartRecall("API 设计决策", { project: "my-project" });

await sessionEnd("完成 API 层切换", ["GraphQL 减少 dashboard 过度请求"], "下一步：认证中间件", {
  project: "my-project",
});
```

---

## 评分架构（简述）

- **RRF（Cormack 2009）** — 各存储内部排名，RRF 融合位置列表，任何存储不独占排名
- **Ebbinghaus 遗忘曲线 + Zipf 调整** — 日志 2 天衰减，宫殿决策永久保留，高频访问的 digest 衰减更慢
- **贝叶斯 Beta 分布** — 从用户反馈估计记忆真实有用性，按查询上下文学习，不跨查询污染

详细说明：[docs/SCORING.md](../../docs/SCORING.md)

---

## 相关链接

- **MCP 服务器：** [agent-recall-mcp](../mcp-server/README.md)
- **完整文档：** [主 README](../../README.md)
- **GitHub：** [Goldentrii/AgentRecall](https://github.com/Goldentrii/AgentRecall)
