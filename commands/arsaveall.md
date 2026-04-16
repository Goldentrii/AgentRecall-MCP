---
description: "AgentRecall batch save — save this session + sweep all projects for unsaved captures + consolidate cross-project insights."
---

# /arsaveall — AgentRecall Save All

One command to close all VS Code sessions cleanly. Saves this session, rescues orphaned captures from parallel agents, and consolidates cross-project patterns into the palace.

## When to Use

- Closing VS Code or ending a multi-agent work session
- After running parallel agents across multiple projects simultaneously
- End-of-day memory sync across everything you worked on

## What This Does

1. **Save current session** — full /arsave for this tab (journal + palace + awareness + corrections)
2. **Sweep all projects** — scan for capture logs from today that weren't closed cleanly
3. **Rescue orphaned sessions** — for each unsaved project, auto-save from its capture log
4. **Cross-project consolidation** — surface patterns that appeared in multiple projects, promote to palace
5. **Report** — show exactly what was saved and where

## Process

### Step 1: Save current session (same as /arsave)

1. **Gather ground truth first** — do NOT rely on memory:
   - Read today's capture log: `~/.agent-recall/projects/<slug>/journal/<today>-log.md`
   - Check git diff: `git diff --stat HEAD` or `git log --oneline -5`
   - Supplement with conversation memory for decisions not in the log

2. **Record corrections** — for each time the human corrected your direction this session:
   ```
   check({ goal: "<what you understood>", confidence: "high",
           human_correction: "<what they actually meant>",
           delta: "<the gap>" })
   ```
   Skip if no corrections happened.

3. **Save via `session_end`**:
   ```
   session_end({
     summary: "<2-3 sentences: what happened, what changed>",
     insights: [{ title, evidence, applies_when, severity }],  // 1-3 max
     trajectory: "<where this is heading>"
   })
   ```

4. **Verify**: spot-check via `recall(query="<today's key decision>")` — confirm it landed.

### Step 2: Sweep all projects for unsaved sessions

List all known projects:
```bash
node ~/Projects/AgentRecall/packages/cli/dist/index.js projects
```

For each project in the list:
1. Check if today's journal file exists: `~/.agent-recall/projects/{slug}/journal/<YYYY-MM-DD>*.md`
   - If a dated journal file exists → already saved, skip
2. Check if a capture log exists: `~/.agent-recall/projects/{slug}/journal/<YYYY-MM-DD>-log.md`
   - If yes → unsaved session with captured Q&A data → rescue it

### Step 3: Rescue each unsaved session

For each project with a capture log but no journal entry:

1. Read the capture log:
   ```bash
   cat ~/.agent-recall/projects/{slug}/journal/<YYYY-MM-DD>-log.md
   ```

2. Synthesize a summary from the Q&A pairs (look for `**Q:**` / `**A:**` blocks)

3. Save via session_end with explicit project:
   ```
   session_end({
     project: "{slug}",
     summary: "<synthesized from capture log>",
     insights: [],   // only add if log reveals genuine reusable patterns
     trajectory: "Auto-rescued from orphaned capture log"
   })
   ```

4. Note the project slug and number of captures rescued.

### Step 4: Cross-project consolidation

After all individual sessions are saved, look for patterns that span projects:

1. Run recall across each active project:
   ```
   recall(query="decisions mistakes blockers insights today", project="{slug}")
   ```

2. Look for themes that appear in 2+ projects (e.g., same API issue, same architectural decision pattern)

3. For each cross-project pattern found:
   - If it's an insight: save as global digest via `digest(action="store", global=true, ...)`
   - If it's a correction/mistake: record via `check()` with clear `delta` field
   - If it's architectural: use `remember()` with the `architecture` context hint

4. Skip this step if all projects are isolated with no shared themes.

### Step 5: Report

Show a clean summary:

```
/arsaveall complete

Sessions saved:
  ✓ {project-1} — journal written, N insights, N palace entries
  ✓ {project-2} — auto-rescued from capture log (N captures)
  ~ {project-3} — no activity today, skipped

Cross-project:
  N patterns consolidated
  M cross-project digests stored

Total: X sessions saved, Y cross-project insights
```

## Important Rules

- **Order matters**: save current session FIRST before sweeping others. If this session crashes mid-sweep, at least the current one is safe.
- **Don't over-synthesize orphaned logs.** If a capture log has 2 Q&A pairs, just summarize them. Don't invent insights from thin data.
- **Cross-project promotion is optional.** If nothing connects across projects, skip Step 4. Quality > quantity.
- **Global digests for genuinely cross-cutting knowledge only.** "Fixed a bug in project X" is not cross-project. "API pagination always requires cursor, not offset" is.
- **One /arsaveall per close.** Don't re-run if already completed. If you need to add something, use `/arsave` or `remember()` directly.
- **Always verify the current session** was actually saved before sweeping others (check Step 1's session_end response).
