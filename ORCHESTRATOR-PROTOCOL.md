# Orchestrator Protocol — Multi-Agent Work Loop
> Formalized 2026-04-24 from live novada-mcp + AgentRecall sessions.
> Drag this file into any new session to resume the pattern.

---

## What This Is

A repeatable protocol for running an Opus orchestrator + parallel Sonnet sub-agents to ship improvements to a codebase without losing quality or context. Validated on AgentRecall `feature/agent-feedback-improvements` (4 agents, 1 reviewer, 1 bug caught and fixed before merge).

**Model routing — fixed rule:**
| Role | Model | Reason |
|------|-------|--------|
| Orchestrator (you) | Opus 4.6 | Conflict analysis, agent briefing, synthesis, decisions |
| All sub-agents | Sonnet 4.6 | Coding, reading, testing — high volume, cost-controlled |
| Reviewer agent | Sonnet 4.6 (`code-reviewer` subagent type) | Independent read, catches what implementation agents miss |

Do NOT use Opus for sub-agents. Do NOT use Haiku unless the task is pure read-only exploration with no judgment required.

---

## The Five-Step Loop

```
1. SCOUT     → map the codebase, find file ownership
2. PLAN      → assign agents, detect conflicts before dispatch
3. DISPATCH  → run implementation agents in parallel
4. REVIEW    → fresh reviewer agent, independent
5. FIX+SHIP  → apply fixes, build, commit, report to human
```

---

## Step 1 — Scout (do this yourself, or dispatch a Haiku scout)

Before writing any agent prompt, read the key files. You need:
- Which file contains which function (file → responsibility map)
- Which files each planned change will touch
- Any pre-existing unstaged changes (run `git diff --stat HEAD`)
- Current branch state (`git log --oneline -5`)

**Minimum reads before dispatching:**
- The main logic file for each planned change
- The registration/index file (how tools are wired up)
- One existing tool as a pattern example

Do this yourself to protect your context. If the codebase is large, dispatch a Haiku scout:
> "Read these directories. Return: which file does what, which functions are key touchpoints, which files are likely to be touched by [list of planned changes]. Under 300 words."

---

## Step 2 — Plan (conflict matrix)

Before dispatching, map: **agent → files it will touch**.

If two agents share a file → **merge them into one agent** or run them sequentially. Never let two parallel agents write to the same file. This is the most common failure mode.

```
Example conflict matrix:
Agent 1: project-status.ts (NEW), index.ts         → no conflict
Agent 2: session-start.ts, session-start MCP tool  → owns session-start.ts
Agent 3: rooms.ts, consolidate.ts                  → no conflict
Agent 4: session-end.ts, session-end MCP tool      → no conflict
```

Mark the "owner" agent for each contested file. Only the owner agent touches it.

---

## Step 3 — Dispatch (parallel)

Use `Agent()` tool with `subagent_type` unset (defaults to Sonnet). Pass `isolation: "worktree"` to keep agents from stomping each other during execution.

**The single most important rule: write prompts as if briefing a smart colleague who just walked in with zero context.**

### How to write a good agent prompt

A good prompt has exactly these sections, in this order:

```markdown
## 1. Role + Scope
One sentence: what you are, what you are NOT doing.
"You are implementing X. Do NOT touch Y — another agent owns that."

## 2. Context (codebase orientation)
- Project location
- The 2-3 files most relevant to this task
- The pattern to follow (e.g. "follow the same pattern as tools/session-start.ts")
- Any pre-existing changes the agent must not revert

## 3. What to build (precise spec)
- Function signatures with types
- Interface definitions
- Exact logic (not "handle edge cases" — name the edge cases)
- Where to register / export

## 4. What NOT to do
- Which files to leave alone
- Which patterns to avoid
- No npm publish, no git push, no commits unless told

## 5. Verification
Exact command to run. What passing looks like.
"Run: cd ~/Projects/X && npm run build 2>&1 | tail -10
Pass = zero TypeScript errors."

## 6. Report back (structured)
Tell the agent exactly what format to use:
- Files created/modified (paths)
- Build: PASS / FAIL
- Specific thing to confirm (e.g. "confirm quality_warnings is empty when no insights provided")
```

**Token discipline in prompts:**
- Include file paths, not file contents. The agent will read the file.
- Include function signatures, not implementations. The agent will write the implementation.
- If you paste code, paste only the interface / skeleton, not the full example.
- Every line in the prompt should be load-bearing. Cut anything the agent can figure out from reading the code.

**Prompt length guide:**
- Simple file change (1-2 functions): ~200 words
- New tool (new file + registration): ~400 words
- Complex multi-file feature: ~600 words max

If your prompt exceeds 600 words, you are probably writing the implementation for the agent. Stop. Write the interface and let the agent do the implementation.

---

## Step 4 — Review

After all implementation agents complete, dispatch **one reviewer agent** using `subagent_type: "code-reviewer"`.

The reviewer prompt must:
1. List every file that was changed
2. List specific edge cases to check (you write these — you know the domain)
3. Ask for a structured output:
   ```
   ## Summary: PASS / NEEDS FIXES / FAIL
   ## Per-feature: Rating + Bugs + Missing edge cases
   ## Issues requiring fix before merge (numbered, HIGH only)
   ## Minor issues (numbered, LOW)
   ## What worked well (3-5 bullets)
   ## Compound lessons (exactly 3)
   ```

The reviewer works best when given specific questions. "Is this correct?" produces vague output. "Does `touchRoom()` handle `_room.json` missing?" produces a precise answer.

### Compound rule — mandatory knowledge extraction

Every reviewer MUST output exactly 3 reusable lessons at the end of their review. This is not optional — it is a required output field, like `Summary` or `Issues`.

Each lesson must be:
```
- title: <imperative rule, ≥3 words>
  evidence: <what happened in THIS review that proves it>
  applies_when: [keyword1, keyword2, keyword3]
```

**What qualifies as a lesson:**
- A pattern that will recur in future work (not a one-off fix)
- A mistake that could have been prevented by a rule
- An approach that worked well and should be repeated

**What does NOT qualify:**
- "Fixed a bug" (not reusable — what's the RULE that prevents the bug?)
- Project-specific facts ("we use PostgreSQL") — that's palace, not a lesson
- Vague advice ("write better tests") — must be specific and actionable

**After the review completes**, the orchestrator feeds these 3 lessons into AgentRecall:
```
session_end({
  insights: reviewer.compound_lessons.map(l => ({
    title: l.title,
    evidence: l.evidence,
    applies_when: l.applies_when,
    severity: "important"
  })),
  ...
})
```

This is the compound engine: every loop makes the next loop smarter. Reviews that don't produce lessons are wasted learning.

---

## Step 5 — Fix + Ship

For each HIGH issue from the reviewer:
- If it's a 1-line fix: fix it yourself (faster than dispatching an agent)
- If it's a 5+ line fix: dispatch a targeted micro-agent with the exact line, exact fix, nothing else
- Re-run build after every fix

Commit pattern:
```bash
git add <specific files>
git commit -m "feat: [feature name] — [one line summary]

Agent 1 — [what it did]
Agent 2 — [what it did]
...
Reviewer fix — [what was caught and fixed]"
```

Report to human before any push. Human decides: merge to main + push, or more iteration.

---

## Agent Templates

### Implementation agent (standard)
```
subagent_type: (omit — defaults to general-purpose = Sonnet)
isolation: "worktree"
prompt: [use the 6-section structure above]
```

### Reviewer agent
```
subagent_type: "code-reviewer"
prompt: [list changed files, specific edge cases to check, structured output format]

MANDATORY: End your review with exactly 3 compound lessons.
Each lesson = { title (imperative rule), evidence (from THIS review), applies_when (2-4 keywords) }.
These feed into the project's memory system. A review without lessons is wasted learning.
```

### Scout agent (Haiku, read-only)
```
model: "haiku"
prompt: "Read [directories]. Return: file → responsibility map. Which files will [list of planned changes] touch? Under 300 words."
```

### Micro-fix agent (post-review)
```
subagent_type: (omit)
prompt: "Fix ONE issue. File: X. Line: Y. Current code: [paste]. Fix: [paste]. Run build. Confirm pass."
```

---

## Current AgentRecall State (as of 2026-04-24)

**Version:** v3.3.27 (local) | npm: v3.3.23
**Branch:** `feature/agent-feedback-improvements` — ready to merge to main
**Tests:** build passes, all 4 packages clean

### What was just shipped (feature branch, not yet merged)

| Feature | File | Status |
|---------|------|--------|
| `project_status` MCP tool | `tools-logic/project-status.ts` (new) | ✅ Reviewer: GOOD |
| `session_start` resume block | `tools-logic/session-start.ts` | ✅ Bug fixed (trajectory key was "next" not "trajectory") |
| `session_start` watch_for prominence | `mcp-server/tools/session-start.ts` | ✅ Reviewer: GOOD |
| Palace staleness (`touchRoom`, `isRoomStale`) | `palace/rooms.ts`, `consolidate.ts` | ✅ Reviewer: GOOD |
| Insight quality gate | `tools-logic/session-end.ts` | ✅ Reviewer: GOOD |

### Minor issues left open (not blocking merge)

1. `isRoomStale()` exported but callers inline the same logic — 7-day threshold defined in 3 places. Refactor to use the exported helper.
2. `project_status` MCP returns raw JSON. Should add `formatProjectStatus()` like `session_start` has `formatSessionStart()`.
3. `sessions_count` counts files not unique days — cosmetic inflation on heavy-save days.

### Remaining open work (from palace/goals)

- Context cache + pre-digest summaries for token savings (AR v3.4 direction)
- Validate genome on a new live site
- LobeHub marketplace submission
- Consider wiring `resurrectFromArchive()` into `addInsight()` (implemented but never called)
- Consider wiring `getConnectedRooms()` into `palaceSearch()` (implemented but never called)

### Key architecture decisions (do not reverse)

- **5-tool MCP surface:** `session_start`, `remember`, `recall`, `session_end`, `check`. Legacy tools exist but are not registered by default.
- **RRF scoring** for recall (Reciprocal Rank Fusion across journal + palace + insights).
- **Palace rooms are Obsidian-compatible** — YAML frontmatter + `[[wikilinks]]`. Do not change file format.
- **Advisory-only quality gates** — insight quality warnings never block saves. Human/agent is always in control.
- **`/arsave` not `/agsave`** — `ar` prefix is the namespace. Do not rename commands.

---

## Handoff Checklist for the Next Agent

Before starting work on AgentRecall, do this in order:

- [ ] Read `ORCHESTRATOR-PROTOCOL.md` (this file) — you are here
- [ ] Run `cd ~/Projects/AgentRecall && git log --oneline -5` — confirm branch state
- [ ] Run `npm run build` — confirm clean build
- [ ] Call `session_start({ project: "AgentRecall" })` via MCP — load current context
- [ ] Decide: merge feature branch first, or start new work on top of it?
- [ ] Pick the next improvement from "Remaining open work" above
- [ ] Run the 5-step loop: Scout → Plan → Dispatch → Review → Fix+Ship

---

## What This Pattern Solves

| Old problem | How the protocol solves it |
|-------------|---------------------------|
| Agent gets lost mid-session | `session_start` resume block + `project_status` tool |
| Two agents corrupt same file | Pre-flight conflict matrix — merge agents before dispatch |
| Reviewer misses bugs | Independent fresh agent with specific edge case questions |
| Orchestrator burns context reading files | Scout agent + briefing maps passed to implementation agents |
| Vague insights that don't help future agents | Quality gate warns on shallow titles + missing evidence |
| No audit trail of what each agent did | Per-agent commit messages with agent attribution |

---

*This protocol was formalized from a live session. It will improve over time — update this file when you discover a better pattern.*
