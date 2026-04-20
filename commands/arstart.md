---
description: "AgentRecall cold start — load full project context + task-specific recall in one shot."
---

# /arstart — AgentRecall Cold Start

One command to load all context at session start. No manual memory reading needed.

## When to Use

**Default: USE IT.** Most projects are long-term and benefit from memory. Memory compounds — a small overhead today saves large context-rebuilding costs across future sessions.

**Skip /arstart only when** the task is truly single-session throwaway work:
- Pure Q&A session (no project context needed)
- Trivial one-off script that won't be revisited
- Quick fix with no decisions worth recalling

## What This Does

Runs AgentRecall session-start in **two MCP calls**:
1. `session_start` — identity + insights + rooms + cross-project matches + recent journal + watch_for
2. `recall` with today's task — surfaces relevant past knowledge (fixes, decisions, patterns)

## Process

### Step 1: Identify the task

Check if the user already stated what we're working on in this conversation.

- **If yes**: Use it directly. Do NOT ask "what are we working on?" — that's friction.
- **If no context yet**: Ask once, briefly: "What are we working on today?"

### Step 2: Load full context

Call `session_start(project="auto")`.

This returns:
- **identity** — who the user is, what the project is about
- **insights** — top awareness insights ranked by confirmation count
- **active_rooms** — top 3 palace rooms by salience
- **cross_project** — insights from other projects matching this context
- **recent** — today/yesterday journal briefs + older count
- **watch_for** — past correction patterns to avoid repeating

### Step 3: Recall past knowledge for today's task

Call `recall(query="<today's task or topic>")`.

This hits the knowledge store for documented fixes, past decisions, and patterns relevant to what we're about to do. Return up to 3 hits if relevant.

This is the step that surfaces: "last time we touched this module, X broke" or "this API returns null on session expiry — always null-check" — things not in the awareness insights but stored as knowledge entries.

### Step 4: Show cold-start brief

Present a compact summary:

```
Project: <name> — <identity>
Last session: <date> — <what was done>
Next: <top priority from journal>

Insights (top 3):
  [N×] <insight>
  [N×] <insight>

Past corrections — watch out:
  - <pattern> (corrected N times)

Relevant past knowledge:
  - <knowledge hit 1>
  - <knowledge hit 2>

Cross-project: N related insights from <project>
```

Skip any section that returned empty — do not say "no insights found."

### Step 5: Ready to work

Say: "Ready. What's first?" and let the user drive.

If the user already stated the task in Step 1, skip this line and just get to work.

## Important Rules

- **Be fast.** Cold start is two tool calls. Don't add extra calls unless recall returned 0 and you want to try a different query.
- **Don't lecture.** Show the brief, offer insights, then get out of the way.
- **Sparse data is fine.** New project with no palace, no journal — just say so briefly and proceed.
- **hook-start already ran.** At session start, a quick preview (insights + recent + watch_for) was auto-loaded into the system context. /arstart completes that with cross-project data, rooms, and the task-specific recall. Don't re-explain what the hook already showed unless it's relevant to today's task.
- **Call check() before significant actions.** If you're about to do something irreversible (publish to npm, push to git, delete files, deploy), call `check(goal="<what you're about to do>", confidence="high")` first. The `watch_for` patterns in the response tell you if you've been corrected on similar things before. This is 1 extra call that prevents repeated mistakes.
- **One cold start per session.** If already ran, say so and offer to re-run if the project context has changed.
- **Use `remember` for manual fixes.** If session_start returned sparse data on a project you know has content, use `remember` to re-surface it.
