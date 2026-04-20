---
description: "AgentRecall full save — journal + palace + awareness + insights in one shot."
---

# /arsave — AgentRecall Full Save (v3.3.20)

One command to save everything. No long prompts needed.

## When to Use

**Default: USE IT.** Most projects are long-term. Memory compounds — insights saved today prevent repeated mistakes and rebuild costs across future sessions.

**Skip /arsave only when** the session was truly throwaway:
- Pure Q&A with no decisions made
- Trivial one-off task that won't be revisited
- Nothing non-obvious happened worth recalling

## What This Does

Runs the complete AgentRecall end-of-session flow:

1. **Gather** — review what happened this session
2. **Save** — one `session_end` call writes journal + awareness + consolidation
3. **Verify** — check that key content was promoted
4. **Git** — push to GitHub if user has configured it

## Process

### Step 1: Gather session context

**Start with machine-captured facts, not memory.** At long context windows your memory of early decisions is compressed and unreliable. Ground truth comes first:

1. **Read today's capture log** — `~/.agent-recall/projects/<slug>/journal/YYYY-MM-DD-log.md` (if it exists). This file contains incremental Q&A captures logged during the session. Pull out the key facts from it.

2. **Check git diff** — if in a git repo, run `git diff --stat HEAD` or `git log --oneline -5` to see what files actually changed.

3. **Supplement with memory** — now recall what happened that isn't in the log: decisions made in conversation, things we discussed but didn't act on, blockers identified, next steps.

Combine all three into a 2-3 sentence summary. The log anchors you; memory fills the gaps.

### Step 2: Record corrections

If the human corrected your understanding during this session — "no not that", "I meant X not Y", "wrong priority" — record each significant correction:

```
check({
  goal: "<what you originally understood>",
  confidence: "high",
  human_correction: "<what the human actually wanted>",
  delta: "<the gap — e.g. 'assumed technical priority, human meant business priority'>"
})
```

This feeds the predictive warning system. Future agents on this project will get `watch_for` warnings like: "You tend to misinterpret X — corrected N times."

If no corrections happened this session, skip this step.

### Step 3: Save everything in one call

Call `session_end` with:

```
session_end({
  summary: "<2-3 sentence session summary>",
  insights: [
    {
      title: "<one-line insight>",
      evidence: "<what happened that confirmed this>",
      applies_when: ["keyword1", "keyword2"],
      severity: "critical" | "important" | "minor"
    }
    // 1-3 insights max
  ],
  trajectory: "<where is the work heading — one line>"
})
```

This single call:
- Writes the daily journal entry
- Updates awareness with new insights (merge or add)
- Consolidates decisions/goals/blockers into palace rooms
- Archives demoted insights (not deleted — moved to awareness-archive.json)

### Step 4: Verify promotion

After `session_end`, verify that content actually made it to the right places. Use `recall` to spot-check:

1. Call `recall(query="<key decision from today>")` — confirm it appears in palace results
2. Check the session_end response: `insights_processed` should match what you sent

Report the verification result:
```
Promotion verified:
  - Journal: written (YYYY-MM-DD)
  - Awareness: N insights processed
  - Palace: consolidated
```

Or if gaps found, use `remember` to manually save the missing content:
```
remember({
  content: "<the missing decision/insight>",
  context: "architecture decision"  // hints the router
})
```

### Step 5: Confirm and offer git push

Show the user a summary:
```
Journal: written
Awareness: N insights added (M total)
Palace: consolidated
```

Then ask: "Push to GitHub?" If yes, run:
```bash
cd <project-root> && git add -A && git commit -m "session: YYYY-MM-DD <one-line summary>" && git push
```

## Important Rules

- **Be honest in the journal.** If something broke, write it. If nothing got done, say so.
- **Verify, don't trust.** Step 3 exists because consolidation can be superficial. Check the result.
- **Insights should be reusable.** "Fixed a bug" is not an insight. "API returns null when session expires — always null-check auth responses" is an insight.
- **Don't over-save.** 1-3 insights per session is plenty. Quality over quantity.
- **Match the user's language.** If the session was in Chinese, write in Chinese.
- **One save per session.** If already saved, say so and offer to update instead.
- **Use `remember` for manual fixes.** If session_end missed something, use `remember` to route it to the right store.
