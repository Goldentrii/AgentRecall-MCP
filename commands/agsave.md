---
description: "AgentRecall full save — journal + palace + awareness + insights in one shot. End-of-session brain dump."
---

# /agsave — AgentRecall Full Save

One command to save everything. No long prompts needed.

## What This Does

Runs the complete AgentRecall end-of-session flow:

1. **Journal** — write today's daily journal entry (10-section format)
2. **Palace** — consolidate key decisions, goals, blockers into palace rooms
3. **Awareness** — extract 1-3 insights from this session into the compounding system
4. **Git** — push to GitHub if user has configured it

## Process

### Step 1: Gather session context

Before writing anything, review:
- What was discussed, built, decided, and failed this session
- What files were modified (`git diff --stat` if in a git repo)
- Current blockers and next steps
- Any insights or patterns worth remembering

### Step 2: Write the daily journal

Call `journal_write` with a complete session entry. Use the user's language (Chinese if they spoke Chinese, English if English).

Include these sections at minimum:
- **Brief** (cold-start table: project / last done / next step / momentum)
- **Completed** (what got done, with specifics)
- **Blockers** (honest — what's stuck)
- **Next** (prioritized next actions)
- **Decisions** (what was decided and WHY)

If a section is empty, write "None" — don't skip it.

### Step 3: Consolidate to palace

Call `context_synthesize(consolidate=true)` to promote journal content into palace rooms:
- Decisions → architecture room
- Goals/brief → goals/evolution
- Blockers → blockers room

### Step 4: Update awareness

Call `awareness_update` with:
- **insights**: 1-3 key learnings from this session. Each insight should have:
  - `title`: one-line summary
  - `evidence`: what happened that confirmed this
  - `applies_when`: keywords for when this insight is relevant to future tasks
  - `source`: project name + today's date
  - `severity`: critical / important / minor
- **trajectory** (optional): where is the work heading?
- **blind_spots** (optional): what might matter but hasn't been explored?

### Step 5: Confirm and offer git push

Show the user a summary:
```
✅ Journal: written (YYYY-MM-DD.md)
✅ Palace: consolidated (N rooms updated)
✅ Awareness: N insights added (M total)
```

Then ask: "Push to GitHub?" If yes, run:
```bash
cd <project-root> && git add -A && git commit -m "session: YYYY-MM-DD <one-line summary>" && git push
```

## Important Rules

- **Be honest in the journal.** If something broke, write it. If nothing got done, say so.
- **Insights should be reusable.** "Fixed a bug" is not an insight. "API returns null when session expires — always null-check auth responses" is an insight.
- **Don't over-save.** 1-3 insights per session is plenty. Quality over quantity.
- **Match the user's language.** If the session was in Chinese, write in Chinese.
- **One save per session.** If already saved, say so and offer to update instead.
