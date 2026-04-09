---
description: "AgentRecall cold start — recall insights + walk palace + load context in one shot."
---

# /agstart — AgentRecall Cold Start

One command to load all context at session start. No manual memory reading needed.

## What This Does

Runs the complete AgentRecall session-start flow:

1. **Recall** — surface cross-project insights relevant to today's work
2. **Walk** — progressive palace loading (identity + top rooms + awareness)
3. **Brief** — show cold-start summary to the agent

## Process

### Step 1: Ask what we're working on

Ask the user briefly: "What are we working on today?" (or check if the conversation already has context).

If the user already stated the task, skip asking.

### Step 2: Recall relevant insights

Call `recall_insight(context="<task description>")` to surface cross-project insights.

If insights are returned, display the top 3:
```
💡 Relevant insights:
1. [title] (confirmed Nx) — [applies when]
2. [title] (confirmed Nx) — [applies when]
```

### Step 3: Walk the palace

Call `palace_walk(depth="active")` to load:
- Project identity (~50 tokens)
- Top 3 rooms by salience
- Awareness summary (top insights + trajectory)

If the user mentioned a specific focus, use `palace_walk(depth="relevant", focus="<focus>")` instead.

### Step 4: Show cold-start brief

Present a compact summary:
```
🧠 Project: <name>
📋 Last session: <date> — <what was done>
🔴 Next: <top priority>
⚡ Momentum: <emoji>
💡 Insights: <N relevant to today's task>
🏛️ Palace: <N rooms, top by salience>
```

### Step 5: Ready to work

Say: "Ready. What's first?" and let the user drive.

## Important Rules

- **Be fast.** Cold start should take < 5 seconds. Don't load everything — progressive depth.
- **Don't lecture.** Show the brief, offer insights, then get out of the way.
- **If no palace exists yet**, that's fine — fall back to `journal_cold_start` or `journal_read(date="latest")`.
- **If no insights match**, skip that section silently. Don't say "no insights found."
