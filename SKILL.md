---
name: agent-recall
description: >-
  Two-layer AI session memory with Think-Execute-Reflect quality loop.
  Layer 1: hook-driven auto-capture. Layer 2: 10-section daily journal.
  v2.0: Section 7 is now a structured quality loop — Think (research+plan),
  Execute (plan vs actual), Reflect (5-dimension self-score + external
  review + Intelligent Distance gap analysis), Feedback (loop or exit).
  Exit condition: quality passes threshold, no reflection needed.
  Memory Lifecycle: auto-promotion (3+ journal appearances → permanent
  memory), confidence scoring (high/medium/low), verification dates,
  cross-references, deprecation protocol.
  Includes Handoff Protocol for multi-agent pipelines.
  Designed with Intelligent Distance principle. Emoji vocabulary for
  high-density, low-token semantic markers.
origin: community
version: 2.0.0
author: Goldentrii
platform: clawhub
tags: [productivity, memory, journal, multi-session, reflection, two-layer, agent-observations, intelligent-distance]
trigger:
  - "save"
  - "save session"
  - "保存"
  - "写日志"
  - "记录"
  - "/journal"
  - "checkpoint"
  - "log this"
  - "存一下"
  - "update journal"
  - "记录一下"
  - "log today"
skip:
  - "don't save"
  - "skip"
  - "不用记"
  - "no journal"
  - "skip journal"
  - "no need"
  - "算了"
---

# AgentRecall — Agent Instructions

> Read completely before acting. Two systems: QUICK CAPTURE and DAILY JOURNAL.

---

## ⚠️ CRITICAL RULES — never violate, even in long sessions

These 5 rules have the highest priority. If context is running low,
follow these before all other instructions.

1. 🔒 COLD-START BRIEF = structured table (项目/上次做了/下一步/动量). No exceptions.
2. 🔒 SECTION ORDER = 1→2→3→4→5→6→7→8→9→10. Never reorder, never skip.
3. 🔒 HONEST ISSUES = Section 4: if broken, write it. Never hide problems.
4. 🔒 LANGUAGE MATCH = follow user's language. 用户说中文就写中文。
5. 🔒 SAVE ONCE = only suggest saving ONCE per session. Never repeat.

---

## Instruction Priority

> When context window is constrained, follow this hierarchy:

**🔒 MUST** (violation = broken journal):
cold-start brief format, fixed section order, exact file paths,
honest issues, language match, save-once rule

**⚡ SHOULD** (strong preference, degrade only under pressure):
emoji status markers, Section 9 observations,
decision record with WHY, descoped items tracking

**💡 Layer 1 is OPTIONAL** (bonus, not expected):
Layer 1 capture per turn — nice to have, but agent often forgets
during high-density work. If Layer 1 has 0 entries at save time,
that's normal — note it in footer, don't treat as failure.

**💡 MAY** (helpful but flexible):
suggestion timing nuances, reflection depth, index.md auto-repair,
token cost annotations

---

## Emoji Vocabulary — Built-in (high-density, low-token status markers)

> Each emoji below is a semantic anchor: 1–2 tokens carrying meaning that
> would otherwise cost 5–10 tokens in text. Use consistently across all
> journal entries. This table serves as a cross-agent enum definition —
> any agent reading a journal produced by another agent can rely on
> these meanings being stable.
>
> Primary meaning is always the default. Context variant applies only
> in the specific sections noted.
>
> **These are FIXED — users cannot redefine them. Custom additions go in Emoji Playground below.**

| Emoji | Primary meaning | 主要含义 | Context variant | 上下文次义 | Where used |
|-------|----------------|----------|----------------|-----------|------------|
| 🔴 | Critical / blocking | 紧急/阻塞 | Momentum: stopped/stalled | 动量：停滞 | Section 4 5 9; 动量行 |
| 🟡 | Important / this week | 重要/本周 | Momentum: stable | 动量：稳定 | Section 4 5 9; 动量行 |
| 🟢 | Optional / low priority | 可选/低优先级 | Momentum: accelerating | 动量：加速 | Section 4 5 9; 动量行 |
| ✅ | Done | 已完成 | — | — | Section 3 |
| ❌ | Broken | 故障 | — | — | Section 3 |
| 🚧 | In progress | 进行中 | — | — | Section 3 |
| 🔒 | Must-follow rule | 必须遵守 | — | — | Critical Rules |
| ⚡ | Should-follow rule | 建议遵守 | — | — | Instruction Priority |
| 💡 | May-follow rule | 可选遵守 | — | — | Instruction Priority |
| 🔧 | Technical observation | 技术观察 | — | — | Section 9 |
| 🧠 | Context observation | 上下文观察 | — | — | Section 9 |
| ⬚ | Descoped | 已放弃 | — | — | Section 5 |
| ⏱ | Repetition counter | 重复计数器 | — | — | Section 5; Section 9 |

---

## Emoji Playground — User-Defined Vocabulary

Custom emoji → meaning mappings stored in `journal/emoji-vocab.md`. Loaded at session start.
Say `emoji 🚀 = shipped` to add, `show emojis` to list, `emoji help` for palette suggestions.
Custom emoji CANNOT override built-in emoji above. See `journal/emoji-vocab.md` for full spec.

---

## Alignment Detection Protocol

> When confused or unsure about human intent: **check alignment before acting.**
> A 5-second check beats 30 minutes of wrong work.

### When to check
- **Before** starting a complex task (>10 min estimated work)
- **When** the human's request is ambiguous or contradicts a prior decision
- **After** receiving scattered, non-linear input (restructurize + confirm)

### Alignment Check format
```
ALIGNMENT CHECK:
- Goal: [agent's understanding in one line]
- Confidence: [high/medium/low]
- Assumptions: [what agent is assuming without being told]
- Unclear: [what agent can't figure out from context]
```

Wait for human response. Record the delta (if any) via `alignment_check` MCP tool.

### Nudge Protocol

When the agent detects the human contradicts a prior decision:
```
NUDGE:
- Past: [what was decided, with date]
- Now: [what's being asked now]
- Question: [one clarifying question]
```

**Rules**: Max 2 nudges per session. Frame as curiosity, not correction. If human confirms the change, update the decision record. If human didn't realize the contradiction, they'll thank you.
4. If an emoji is unknown (not in either table): note it as undefined in Section 9

---

## SYSTEM OVERVIEW

```
Layer 1: Quick Capture (hybrid: hook-driven + manual)
  → Auto-capture: hooks log file edits and errors passively
  → Manual capture: agent logs meaningful Q&A after exchanges
  → File: journal/YYYY-MM-DD-log.md (append only)
  → Format: [HH:MM] 📝/❌/Q:/A: ... (see LAYER 1 section)
  → Cost: ~50–100 tokens per entry

Layer 2: Daily Journal
  → Runs when user explicitly saves OR end-of-session
  → File: journal/YYYY-MM-DD.md (full 9-section report)
  → Synthesizes Layer 1 log + conversation context
  → Cost: ~800 tokens to generate, once per day

Layer 3: Memory Palace (persistent knowledge)
  → Room-based knowledge organization (goals, architecture, blockers, alignment, knowledge)
  → Fan-out: writing to one room auto-updates cross-references in related rooms
  → Salience scoring: recency(0.30) + access(0.25) + connections(0.20) + urgency(0.15) + importance(0.10)
  → Obsidian-compatible: YAML frontmatter + [[wikilinks]]
  → File: palace/rooms/<room>/README.md + <topic>.md
  → Cost: ~50 tokens per palace_walk(identity), ~200 for active depth
```

### Palace Cold-Start Protocol

On session start, use progressive loading instead of reading full journal:

```
1. palace_walk(depth="active")         → ~200 tokens: identity + top 3 rooms
2. palace_walk(depth="relevant", focus="<task>")  → ~500 tokens if needed
3. palace_read(room="<specific>")      → deep dive into one room
```

### Palace Tools (5)

| Tool | Purpose |
|------|---------|
| `palace_read` | Read room content or list all rooms |
| `palace_write` | Write memory + fan-out cross-refs. Use `[[wikilinks]]` in content. |
| `palace_walk` | Progressive loading: identity → active → relevant → full |
| `palace_lint` | Health check: stale, orphans, low salience |
| `palace_search` | Search across rooms, ranked by salience |

### Enhanced Journal Tools (palace integration)

| Tool | New param | Effect |
|------|-----------|--------|
| `journal_write` | `palace_room` | Also writes to palace room with fan-out |
| `journal_capture` | `palace_room` | Routes Q&A to palace room |
| `journal_search` | `include_palace` | Also searches palace rooms |
| `context_synthesize` | `consolidate` | Writes synthesis into palace rooms |
| `knowledge_write` | _(dynamic)_ | Any category string → palace knowledge room |

### End-of-Session Palace Update

After writing the daily journal, consolidate key learnings:
```
context_synthesize(consolidate=true)  → promotes decisions, goals, blockers to palace
```

---

## TRIGGER DECISION TREE

```
Step 1 — Check for explicit SKIP signal
  Signals: "don't save" | "skip" | "不用记" | "no journal"
           "skip journal" | "no need" | "算了"
  → If matched: STOP. Do nothing.

Step 2 — Check for explicit SAVE signal
  Strong triggers (save immediately, no confirmation):
    "save" | "save session" | "保存" | "写日志" | "记录"
    "/journal" | "checkpoint" | "log this" | "存一下"
    "update journal" | "记录一下" | "log today"
  → If matched: run DAILY JOURNAL now

  Soft triggers (ask first, then save if confirmed):
    "done for today" | "今天就这样了" | "收工" | "我要去了"
    "I'm done" | "that's all" | "就这样" | "结束了"
    "continue tomorrow" | "明天继续" | "下次继续"
    "we just finished [X]" | "刚做完了" | "[feature] is done"
  → Ask: "要保存今天的日志吗？[yes/no]"
  → If yes: run DAILY JOURNAL

Step 3 — Auto-suggest (no explicit signal)
  Suggest ONCE, at natural end of session, IF ALL of:
    - Session has 10+ turns
    - At least one file was modified or decision was made
    - User's LAST message is a standalone closing signal with NO follow-up
      question or instruction in the same message.
      ✅ Closing signals: just "ok" / just "thanks" / just "谢谢" /
         just "好的" / just "嗯" (as the entire message)
      ❌ NOT closing: "ok, what about X?" / "thanks, now let's..." /
         "好的，那数据库呢？"
  Suggest with: "这次做了不少，要保存日志吗？[yes/no]"

  DO NOT suggest if:
    - Under 5 turns
    - No files changed, no decisions made
    - Already saved this session
    - Mid-conversation (user is still actively working)
    - User's last message contains a question or new instruction
      (even if it starts with "ok" or "thanks")
```

---

## LAYER 1: QUICK CAPTURE PROTOCOL

**When:** After any exchange where something meaningful happened.
Meaningful = file written, decision made, problem solved, important answer given.

**How:**
```
1. Check if journal/ exists → create if not
2. Check if journal/YYYY-MM-DD-log.md exists → create if not (with header)
3. APPEND one entry (do not rewrite the whole file)
```

**Entry formats:**

Hook-driven (automatic — agent does NOT need to remember):
```
[HH:MM] 📝 {file_path} — {edit summary}
[HH:MM] ❌ {command} — exit {code}: {first line of error}
[HH:MM] ✅ {command} — success
```

Manual (agent writes after meaningful exchange):
```
[HH:MM] Q: [what user asked — keep to one short line]
[HH:MM] A: [key answer — one line, focus on conclusion] | Decision: [if any]
```

**Log file header (first time only):**
```markdown
# {YYYY-MM-DD} Raw Session Log
> Auto-captured Q&A. Used to generate daily journal.

---
```

**Examples of good entries:**
```
[14:32] Q: How to deploy to Vercel prod?
[14:32] A: Run `vercel --prod` from project root | Decision: use Vercel CLI not GitHub action

[15:01] Q: Why is hydration error happening?
[15:01] A: process.env on server vs client mismatch, fixed with static string | Decision: never use env vars in client components

[15:45] Q: Should we use admin key or user key for research API?
[15:45] A: Admin key — research does 3-5 searches, user key rate limits | Decision: request General/Admin key tomorrow
```

**When NOT to capture:**
- Simple clarification questions ("what does X mean?")
- Back-and-forth within the same topic (only capture the final decision)
- Casual conversation not related to the project

---

## LAYER 2: DAILY JOURNAL PROTOCOL

Execute in order. Do not skip sections.

### Setup
```
IF journal/ not exist → create
IF journal/index.md not exist → create with INDEX TEMPLATE
```

### Generate
```
date = today YYYY-MM-DD
file = journal/{date}.md
IF exists → update (preserve cold-start brief, update all sections)
IF not exists → create with JOURNAL TEMPLATE
```

**Sources to use (in priority order):**
1. `journal/{date}-log.md` — Layer 1 quick captures (if exists)
2. Current conversation context — for anything not in the log
3. Project files — for accurate file paths and current state
4. ⚠️ DECAY COMPENSATION: If Layer 1 log is incomplete or missing,
   reconstruct key Q&A from full conversation history.
   Add footer note: "⚠️ Layer 1 was incomplete; reconstructed from conversation."
   This is expected in long sessions — not an error.

---

## JOURNAL TEMPLATE

**Section order is FIXED. Heading names are FIXED. Language follows user.**

> **Agent writing guide for cold-start table (internal — do not expose structure to human):**
> - 项目行: what is it + who owns it (one tight phrase)
> - 大图行: project's position in overall goals — OKR score, biggest gap, or current phase (one line). Helps zero-context agents orient immediately.
> - 上次做了: most important thing completed last session
> - 下一步: THE single most important next action (🔴 level only)
> - 动量: pick one of 🟢加速/🟡稳定/🔴停滞 + one-line reason
> - ⏱模式 row: include ONLY if Section 9 has items marked ⏱3+. Omit row if none.

```markdown
# {YYYY-MM-DD} 对话日志

> **冷启动简报**
>
> | 🧠 项目 | [project name] — [what it does in one phrase] |
> |---------|------------------------------------------------|
> | 🗺️ 大图 | [project's position: OKR score / biggest gap / current phase] |
> | 📋 上次做了 | [most important thing completed last session] |
> | 🔴 下一步 | [single most critical next action] |
> | ⚡ 动量 | 🟢 加速 / 🟡 稳定 / 🔴 停滞 — [one-line reason] |
> | ⏱ 模式 | [only include this row if Section 9 has ⏱3+ items] |

---

## 1、关键问答记录

> Extracted from today's raw log + conversation. Only include meaningful decisions.
> 从今天的原始记录和对话中提取。只包含有实质意义的决策，不记录过程性问答。

| 用户问 | 核心回答 | 决策/结论 |
|--------|----------|-----------|
| [question] | [answer] | [decision made] |

---

## 2、今日完成的工作

### [Feature/Task Name]
**文件**: `exact/file/path.ts`
**做了什么**: [specific description]
**为什么这样做**: [reasoning — this is the valuable part / 决策理由，这是最有价值的部分]
**已知限制**: [caveats, if any / 注意事项，没有则省略]

---

## 2.5、今日失败记录 / Key Failures

> Failures are MORE valuable than successes for learning. Record what was ATTEMPTED and FAILED.
> A session with zero failures either went perfectly (rare) or isn't being honest (common).

| What was attempted | What went wrong | Root cause | Fix applied? |
|-------------------|----------------|------------|-------------|
| [task attempted] | [what failed — be specific] | [why it failed — structural, not "tried harder"] | ✅ fixed / ❌ unfixed / 🔄 delegated to next session |

> Examples of honest failure recording:
> - "Built dashboard from imagination instead of extraction" → Root cause: context fatigue after 8h → Fix: dispatched fresh agent
> - "Said done 3x without verifying" → Root cause: optimizing for completion, not quality → Fix: added verifier gate
> - "Captured 13 pages but missed all sub-tabs" → Root cause: "click all" interpreted as "click main things" → Fix: genome v3.2 depth-first walk

---

## 3、当前项目状态

| 模块 | 状态 | 说明 |
|------|------|------|
| [module name] | ✅/❌/🚧 | [one line] |

> ✅ done · ❌ broken · 🚧 in progress

---

## 4、已知问题

| 优先级 | 问题 | 阻塞原因 | 解决方案 |
|--------|------|----------|----------|
| 🔴 | [issue] | [blocking reason] | [how to fix] |
| 🟡 | [issue] | [why matters] | [how to fix] |
| 🟢 | [issue] | [low priority] | [how to fix] |

---

## 5、下次待做清单

> The 🔴 item is where the next session starts. / 🔴 任务是下次会话的起点。
> ⏱ N = number of sessions this task has appeared without progress. / 出现 N 次无进展时标记为可能真的被卡住。

### 🔴 必做 (blocking — can't continue without this)
- [ ] [task] — 依赖: [dependency if any]  ⏱ 出现 N 次

### 🟡 重要 (this week)
- [ ] [task]

### 🟢 可选 (when time allows)
- [ ] [task]

### ⬚ 已放弃 (descoped this session)
- [task] — 原因: [why dropped] → 见决策记录

---

## 6、决策记录

> Most valuable for long-term reference. Capture the WHY, not just the WHAT.
> 长期价值最高的一节。记录为什么这样决策，而不只是决策了什么。

| 决策 | 源自 | 考虑过的方案 | 选择理由 | 什么情况下会改变 | ⚠️ 常见误解 |
|------|------|-------------|----------|-----------------|------------|
| [decision] | [date or "new"] | [alternatives] | [why chosen] | [what would change this] | [what a new agent might misread] |

> **格式选择 / Format rule:**
> 如果单个决策的任何字段超过 15 个字（或 ~30 tokens），改用键值对格式：
> If any field in a single decision exceeds ~30 tokens, use key-value format:
>
> ### 决策: [decision name]
> - **源自**: [date of upstream decision, or "new" if first appearance]
> - **考虑过**: [alternatives]
> - **选择理由**: [why chosen]
> - **什么情况下会改变**: [conditions for reversal]
> - **⚠️ 常见误解**: [what a new agent might misread]

---

## 7、Think-Execute-Reflect Loop (质量循环)

> **Principle:** Quality comes from structured loops, not from trying harder.
> Every significant task this session should map to one Think→Execute→Reflect cycle.
> If everything went perfectly (result = goal), the Reflect section can be one line: "No gap. Goal achieved."
> The loop is the protocol — the Intelligent Distance fix applied to work quality.

### 7a. 🧠 THINK (before action — was the approach right?)

| Task | Goal (SMART) | Research Done? | Plan | Risks Identified |
|------|-------------|----------------|------|-----------------|
| [task] | [measurable result] | [yes/no — what was searched] | [steps taken] | [what could go wrong] |

> If no research was done: flag it. This is the #1 source of wasted work.
> If no plan existed: note whether the task was exploratory (acceptable) or should have been planned.

### 7b. ⚡ EXECUTE (what actually happened vs what was planned — use COUNTS)

| Task | Planned | Actual | Gap (with numbers) |
|------|---------|--------|-----|
| [task] | [what was supposed to happen] | [what actually happened] | [quantify: "planned 13 pages, built 13, but only 3/5 tabs per page"] |

> CRITICAL: Use numbers, not feelings. "Built the dashboard" is useless.
> "Built 11 pages, 35 tabs, 4 shared components, verified 82/91 routes return 200" is useful.
> The next agent can verify these numbers. It can't verify "went well."

### 7c. 🔍 REFLECT (quality assessment — be objective, not defensive)

**会话质量**: [productive · exploratory · blocked]

**Quality score (self-assessed):**
| Dimension | Score (1-5) | Evidence |
|-----------|-------------|----------|
| Research before building | [1-5] | [did I search GitHub/docs/competitors first?] |
| Plan quality | [1-5] | [was the plan specific enough to execute?] |
| Execution vs plan alignment | [1-5] | [did I follow the plan or drift?] |
| Verification before shipping | [1-5] | [did I test/review before calling it done?] |
| Code quality (if applicable) | [1-5] | [typed, modular, tested?] |

**External review (if available):**
- Reviewer: [code-reviewer agent / other agent / tongwu]
- Score/verdict: [what they said]
- Issues found: [count and severity]

**Intelligent Distance gap (if any):**
- What user meant: [their actual intent]
- What I interpreted: [my understanding]
- Gap: [the mismatch, or "none — aligned"]

### 7d. 🔄 FEEDBACK (what changes from this cycle)

**Loop decision:** [EXIT: quality sufficient] or [LOOP: needs iteration]

**If LOOP — what to change:**
- [ ] [specific change for next iteration]

**Persistent learnings (should this become a memory?):**
- [ ] [insight] → [if seen 3+ times across sessions, promote to memory/feedback_*.md]

**SOP/rule updates needed:**
- [ ] [SOP change] → [file path]

**用户关注点变化**:
- [priority shifts, frustrations, or excitement observed in conversation]

---

## 8、文件 & 命令速查

```
[description]: [full absolute path]
```

```bash
# [description]
[command]
```

---

## 9、机器观察 / Agent Observations

> **智能距离原则 (Intelligent Distance)**:
> Human intelligence and artificial intelligence do not differ in level —
> they differ in kind. Humans perceive through vision, emotion, and physical
> intuition. Agents perceive through token streams, file structures, and
> logical dependencies. These are two fundamentally different modes of
> understanding the same reality. This section captures what the agent's
> mode of perception reveals that the human's mode may not.
>
> Rules:
> - Write what YOU noticed, not what you said out loud.
> - If user says "feels wrong" or "something's off" — that IS a 🔴 item here, even with no error logs.
> - If user mentions stress, deadline, or frustration — capture it. Invisible context shapes decisions.
> - If this observation echoes a previous session's Section 9, mark it with ⏱. Three ⏱ marks = pattern — include in next cold-start brief.
> - At next session START: surface 🔴 items before asking what to work on.

> 类型标记：
> - 🔧 技术：代码结构、依赖关系、静默错误、状态漂移、架构风险
> - 🧠 上下文：截止日期、压力信号、优先级变化、用户直觉、情绪线索

| 类型 | 观察 | 重要性 | 用户是否知道 | 建议行动 |
|------|------|--------|-------------|----------|
| 🔧/🧠 | [what I noticed] | 🔴/🟡/🟢 | 已知/未知/不确定 | [what to do about it] |

---

## 10、跨项目输出 / Cross-Project Artifacts

> **智能距离原则**: 方法论、架构决策、工作偏好等认知不属于单个项目。
> 如果本次会话产生了跨项目适用的产出，记录在这里并同步到全局记忆。
> 这样其他项目的 agent 也能获取这些认知，而不是被锁在当前项目的 journal 里。

| 产出 | 写入位置 | 类型 | 说明 |
|------|----------|------|------|
| [artifact name] | [file path — memory/rules/skills] | [concept/feedback/rule] | [one line] |

> Agent 保存规则：
> - 如果产出是方法论/概念 → 写入 `memory/concept_*.md` + 更新 `MEMORY.md`
> - 如果产出是工作偏好/反馈 → 写入 `memory/feedback_*.md` + 更新 `MEMORY.md`
> - 如果产出是硬性规则 → 写入 `~/.claude/rules/*.md`
> - 如果没有跨项目产出 → 写"本次无跨项目输出"，不留空

> Examples:
> - 🔧 "Project is more complete than user realizes — admin/dashboard already existed"
> - 🔧 "Mock data is silently returning 200, user may think real API is working"
> - 🔧 "Decision made in session 1 now contradicts current direction"
> - 🔧 "User's mental model of how X works doesn't match the actual implementation"
> - 🧠 "This 🔴 task has appeared 3 sessions without progress — likely actually blocked"
> - 🧠 "User said 'feels off' about the auth flow — no errors yet, but worth investigating"
> - 🧠 "User mentioned needing to ship by Thursday — deadline not tracked anywhere else"

---
*保存时间: {YYYY-MM-DD HH:MM} · 质量: [productive/exploratory/blocked]*
*Layer 1 log: journal/{date}-log.md ({N} entries)*
*恢复: 说「读一下最新的日志」*

<!-- MACHINE-READABLE SUMMARY
project: {project-name}
date: {YYYY-MM-DD}
momentum: green/yellow/red  (text form of 🟢/🟡/🔴)
quality: productive/exploratory/blocked
milestone: true/false  (true = breakthrough day — direction change, new capability unlocked, methodology shift)
okr_linkage: [{which KR this session advanced: KR1/KR2/KR3/none}]
blockers: [{blocker-1}, {blocker-2}]
completed: [{task-1}, {task-2}]
next_critical: {top-red-task}
decisions_made: {N}
open_issues: {red: N, yellow: N, green: N}
section_nine_red: {N}
layer1_entries: {N}
cross_project_artifacts: {N}
decisions_oldest: {YYYY-MM-DD}
decisions_newest: {YYYY-MM-DD}
stale_check_needed: true/false
quality_scores: {research: N, plan: N, execution: N, verification: N, code: N}
quality_average: N
external_review: true/false
loop_decision: exit/loop
insights_to_promote: N
-->
```

---

## INDEX TEMPLATE

```markdown
# [Project Name] 日志索引

> 读最新一行 → 打开文件 → 看冷启动简报 → 继续

## 日志

| 日期 | 摘要 | 质量 | 动量 | L1条目 |
|------|------|------|------|--------|
| [YYYY-MM-DD](./YYYY-MM-DD.md) | [summary] | [quality] | 🟢/🟡/🔴 | [N entries] |

## 项目信息

- **地址**: [URL]
- **路径**: [local path]
- **技术栈**: [stack]
- **阶段**: [current phase]
```

---

## GAP PROTOCOL — Intelligent Distance in Action

> These two patterns turn the Intelligent Distance principle into executable behavior.
> When a user message matches a trigger, apply the response immediately — don't skip.

### Scope Gap

**Trigger signals** (中文 / EN):
- 中文: 改一下、优化一下、小改、调整一下、微调、稍微改、顺手改、弄一下、随便改
- EN: tweak, adjust, fix it up, clean it up, quick fix, slight change, touch up, make it better

**Response**: Execute immediately, but state your scope assumption in one line first:
> "理解为小改：[具体范围]，不动[结构/接口/逻辑]。"

Example:
> User: "优化一下这个函数"
> Agent: "理解为小改：只动函数内部实现，不改接口签名。"
> → [proceeds with edit]

Why: "小改" means the human has a boundary in mind. Surfacing the assumption lets them catch mismatches in 2 seconds, not 2 minutes.

---

### Aesthetic Gap

**Trigger signals** (中文 / EN):
- 中文: 更好看、好看一点、感觉不对、感觉怪、不协调、不够好、视觉上不对、看着不舒服
- EN: looks off, feels wrong, make it prettier, more polished, doesn't look right, better looking, nicer

**Response**: Do NOT execute. Ask for one specific dimension:
> "能描述一下具体哪里？（颜色 / 间距 / 字体 / 布局 / 对比度 / 结构 / 其他）"

Wait for answer before touching anything.

Why: Aesthetic inputs are open-ended to the point of being unexecutable. "更好看" could mean 10 different things. A single clarifying question costs 5 tokens; guessing wrong costs the user's time and trust.

---

## RESUME PROTOCOL

When user says: "read the latest journal" / "读一下最新的日志" / "resume" / "继续上次"

```
0. Load emoji vocabulary:
   - Read journal/emoji-vocab.md (if exists) → load custom definitions silently
   - Combined vocabulary = built-in table + custom definitions
   - Do NOT announce this step to the user

1. Read journal/index.md → find latest date
1b. ALSO list all journal/YYYY-MM-DD.md files in directory
    → If any file is newer than index.md's latest entry:
      - Use the newer file as the actual latest
      - Repair index.md: append the missing entry row
      - Note: "index.md was out of date, repaired."
2. Read journal/{date}.md
3. Read 冷启动简报 first (top of file)
4. Check Section 9 (机器观察) for any 🔴 items
4b. Check MACHINE-READABLE SUMMARY: if `stale_check_needed: true`, note once:
    "有些决策是 N 天前做的，context 可能已变。要 review 吗？"
5. Report ONCE at session start — do not repeat during the session.
   Output as markdown table:

   | 🧠 项目 | {project} · {date} · {quality} |
   |---------|-------------------------------|
   | 🗺️ 大图 | {from cold-start brief 大图 row} |
   | 📋 上次做了 | {Section 2 summary, 1–2 lines} |
   | 🔴 下一步 | {top 🔴 from Section 5} |
   | ⚡ 动量 | {🟢/🟡/🔴} {momentum reason} |

   IF Section 9 has 🔴 item: add one line below the table:
   "有一件事想先提: {observation}"

6. Ask: "从 🔴 [{task}] 开始，还是有其他优先项？"

AFTER this briefing:
  → Do NOT repeat historical summaries during the session
  → Do NOT remind user of past progress unless they ask
  → Only surface new observations as they arise naturally
  → Suggest saving only at natural session end (soft triggers or auto-suggest rules)
```

---

## HANDOFF PROTOCOL — Agent-to-Agent Transfer

> **When to use**: Work is being passed from one agent role to another
> (e.g., Research → PM, Dev → QA). This is NOT the same as session resume
> (same agent continuing). Handoff is a compressed, role-scoped context
> transfer that gives the receiving agent exactly what it needs — no more.

### Handoff Template

```markdown
# Handoff: {source_role} → {target_role}

| 字段 | 内容 |
|------|------|
| 来源 | {source_agent_role}，session {date} |
| 交给 | {target_agent_role} |
| 你的任务 | {一句话：接收方要做什么} |
| 输入材料 | {文件路径列表，接收方需要读的} |
| 约束 | {接收方不能做什么 / scope boundary} |
| 验收标准 | {怎么判断做完了 — measurable} |
| 上下文 | {3-5 行背景，不是全部历史} |
| 已知风险 | {来源 agent 发现但未解决的问题} |
```

### Handoff Rules

1. **Handoff file** → `journal/handoff-{date}-{source}-to-{target}.md`
2. **上下文 field** = 接收方 **必须知道的最少信息**，不是完整历史
3. **输入材料** = 具体文件路径，不是"看一下 journal"
4. **验收标准** = SMART（可衡量），不是"做好一点"
5. **来源 agent 不规定 How** — 只定义 What 和 Done 标准，让接收方自己选路径
6. After handoff, source agent writes Section 9 observation about what it couldn't finish and why

---

## QUALITY RULES

| Rule | Detail |
|------|--------|
| Exact paths | `app/api/research/route.ts` not "the research file" |
| Honest issues | Section 4: if broken, write it. No hiding. |
| Real decisions | Section 6: WHY not just WHAT + common misreads |
| Decision format | 短决策用表格行，长决策（任意字段 >30 tokens）用键值对。避免 agent 在宽表格中列错位。 |
| Actionable todos | Every 🔴 must be doable in one session |
| Track repetition | Count sessions a 🔴 appears. ⏱3+ = flag as likely blocked. |
| Track descoped items | 任务被主动放弃时，记录在 Section 5 "已放弃" 区 + Section 6决策记录。不允许静默消失。 |
| Real reflection | Section 7 is a structured loop (Think→Execute→Reflect→Feedback), not a flat list. If quality is perfect, Reflect can be one line. |
| Quality self-score | Section 7c: score 5 dimensions 1-5. Be honest — this is for calibration, not performance review. |
| Promotion rule | If a Section 7d insight appears 3+ times across sessions, promote it to a permanent memory (feedback_*.md). |
| Loop or exit | Section 7d must explicitly say EXIT or LOOP. No ambiguous endings. |
| Agent observations | Section 9: write what you noticed, not what you said. |
| Cold-start brief | Structured table (项目/上次做了/下一步/动量) + optional ⏱模式 row. Written for zero-context agent. |
| One file/day | Multiple sessions → update same daily file |
| Language match | Follow user's language throughout |
| Layer 1 first | Check -log.md before reconstructing from memory |
| Decay compensation | If Layer 1 incomplete, reconstruct from conversation. Note in footer. Expected, not an error. |
| Report once | Session-start briefing happens ONCE. Never repeat mid-session. |
| Trust intuition | User's "feels wrong" = 🔴 in Section 9. Don't dismiss without error logs. |
| Capture invisible context | Deadlines, stress, priority shifts mentioned in passing → Section 9. |
| Machine summary | 日志末尾的 `<!-- MACHINE-READABLE SUMMARY -->` 必须填充。momentum 用 green/yellow/red（emoji 的文字形式）。 |
| Emoji consistency | Always use emoji from the Emoji Vocabulary table. Never substitute text for emoji status markers. |
| Decision chain | Section 6: every decision must have a `源自` field — either a date reference to an upstream decision, or "new". |
| Cross-project check | Before saving: if session produced methodology, preferences, or rules applicable beyond this project → Section 10 + write to global memory/rules. |
| Handoff when needed | If work is being passed to a different agent role → generate HANDOFF PROTOCOL file, not just a journal entry. |
| Stale decision alert | Resume protocol: if `decisions_oldest` is >7 days old, mention it once: "有些决策是 N 天前做的，context 可能已变。" |
| Layer 1 hybrid | Layer 1 combines hook-driven auto-capture with manual Q&A capture. Layer 1 is OPTIONAL — if 0 entries at save time, note in footer. Not a failure. |
| Milestone marking | In MACHINE-READABLE SUMMARY: set `milestone: true` only for breakthrough days (direction change, new capability, methodology shift). Default false. |

---

## MEMORY LIFECYCLE — How Memories are Born, Live, and Die

> Memories are not write-once. They have a lifecycle: created → verified → updated → maybe deprecated.
> This section defines the rules for managing memory quality over time.

### Memory Creation (when journal saves)

**Auto-promotion rule:** During Section 7d (Feedback), if an insight has appeared 3+ times across sessions:
```
Check: has this insight appeared in previous journals' Section 7?
  IF count ≥ 3: PROMOTE to permanent memory
    → Write to memory/feedback_*.md or memory/concept_*.md
    → Update MEMORY.md index
    → In journal, note: "🔺 Promoted to memory: [filename]"
  IF count < 3: keep in journal only
    → In journal, note the count: "⏱ Seen N times"
```

### Memory Metadata

Every memory file should have these frontmatter fields:
```yaml
---
name: [descriptive name]
description: [one-line — used for relevance matching]
type: user | feedback | project | reference | concept
confidence: high | medium | low
last_verified: YYYY-MM-DD
related: [list of other memory filenames]
---
```

- **confidence: high** — verified by external review, testing, or user confirmation
- **confidence: medium** — based on observation, not yet externally verified
- **confidence: low** — hypothesis or assumption, needs validation
- **last_verified** — date when this memory was last confirmed still accurate
- **related** — cross-references to other memory files (enables graph navigation)

### Memory Verification (on resume)

During Resume Protocol, when reading memories:
```
FOR EACH memory referenced in MEMORY.md:
  IF last_verified is > 14 days ago:
    → Flag once: "📋 [memory name] hasn't been verified in N days"
    → Don't delete — just flag for human awareness
  IF confidence is "low":
    → Mention in cold-start brief: "有一个未验证的假设: [name]"
```

### Memory Deprecation

A memory should be deprecated (not deleted) when:
1. The underlying fact has changed (e.g., API endpoint moved)
2. A newer memory contradicts it
3. The project it describes is no longer active

```yaml
# Deprecated memory — add to frontmatter:
deprecated: true
deprecated_reason: "Superseded by [newer_memory.md]"
deprecated_date: YYYY-MM-DD
```

Deprecated memories stay in the file system (for history) but are removed from MEMORY.md index.

### Memory Graph (optional — for advanced use)

The `related` field in frontmatter creates an implicit graph:
```
concept_intelligent_distance.md
  → related: [feedback_100_percent_replication.md, feedback_why_what_how_gap.md]

feedback_why_what_how_gap.md
  → related: [concept_intelligent_distance.md, concept_agent_five_pillars.md]
```

When reading one memory, the agent can follow `related` links to build a richer understanding.
This is NOT mandatory — it's a "use when helpful" feature.
| OKR linkage | In MACHINE-READABLE SUMMARY: set `okr_linkage` to the KR(s) this session advanced. Helps weekly summary correlate daily work to goals. |
