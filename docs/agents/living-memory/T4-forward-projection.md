# AAM Brief — Dreaming Enhancement: Forward Projection

**Role:** Implementer (AAM agent)
**Review by:** tongwu
**Task:** Add a "Predictions for Tomorrow" section to the Step 8 dream report template in `~/.aam/dreams/dream-prompt.md`. This section uses tonight's pending patterns + active projects' Next sections to predict what agents are likely to get wrong tomorrow — surfacing them as pre-emptive watch_for items.

## Background

Human sleep isn't only backward-looking: the brain also uses rest to simulate upcoming scenarios, anticipate obstacles, and rehearse responses (prospective memory). Currently the dreaming agent only consolidates past experience — it never asks "what is likely to go wrong tomorrow?" This enhancement adds that forward-looking pass. It does NOT write to awareness — it writes only to the dream report and to a `predictions` palace room in AgentRecall. The human reads it in the Telegram notification.

## What to Modify

File: `~/.aam/dreams/dream-prompt.md`

Two changes:
1. Add a forward projection computation block to **Step 8** (the dream report generation step), just before the agent writes the report to file.
2. Add a "Predictions for Tomorrow" section to the dream report template inside Step 8.

Do NOT add a new numbered step. Append to Step 8's instructions.

---

## Addition to Step 8 (append before the report write block)

Find the Step 8 section in dream-prompt.md. Locate the line where the agent begins composing the report text. Add the following BEFORE that composition block:

```
### Forward Projection (compute before writing report)

PREDICTED_RISKS = []   ← temporary list, not a persisted counter

**Phase A: Collect tomorrow's likely topics**

For each project where status = "active" (days_inactive ≤ 7) in the Project Status table
built in Step 6:
  Read the ## Next section from the latest journal already loaded in Step 3.
  Extract up to 3 action items or topic keywords per project.

Build TOMORROW_TOPICS: flat list of all extracted keywords (deduplicated, lowercased).

**Phase B: Match pending patterns to tomorrow's topics**

From the Pending Patterns section built in Step 3 (confidence 0.50–0.79):
  For each pending pattern:
    Count how many TOMORROW_TOPICS keywords appear in the pattern's observed projects
    or in the pattern's own description.
    If 2+ matches: this pattern is relevant to tomorrow's work.

**Phase C: Match watch_for corrections to tomorrow's topics**

Read the active corrections:
  cat ~/.agent-recall/projects/*/corrections/*.json 2>/dev/null

For each correction:
  Extract keywords from .rule field.
  If 2+ keywords overlap with TOMORROW_TOPICS: this correction is relevant.

**Phase D: Compose predictions**

From Phase B + Phase C matches, select up to 3 most relevant items.
Priority order: corrections > pending patterns (corrections are confirmed failures; patterns are hypotheses).

For each selected item, write one prediction line:
  "⚠ {tomorrow topic or context}: {risk description from pattern/correction} — watch for: {specific trigger phrase}"

Store in PREDICTED_RISKS list.

**Phase E: Write predictions to palace**

If PREDICTED_RISKS is non-empty:
  /Users/tongwu/.npm-global/bin/ar --project AgentRecall palace write predictions \
    "{TODAY_DATE} predictions:
{PREDICTED_RISKS[0]}
{PREDICTED_RISKS[1] if exists}
{PREDICTED_RISKS[2] if exists}"
  Increment AR_WRITE_COUNT.
```

---

## Section to add to Dream Report template (inside Step 8)

Add this section immediately before the `## AR CLI Writes` section:

```
## Predictions for Tomorrow
| Context | Risk | Watch For |
|---------|------|-----------|
[one row per prediction, or "none (no active patterns match tomorrow's topics)"]

_Generated from: {N} pending patterns + {M} active corrections cross-referenced against active projects' Next sections._
```

---

## Verification

After editing, verify:
1. `grep -n "Forward Projection\|PREDICTED_RISKS\|Predictions for Tomorrow" ~/.aam/dreams/dream-prompt.md`
   — all 3 should appear, within the Step 8 block
2. `grep -n "palace write predictions" ~/.aam/dreams/dream-prompt.md`
   — should appear exactly once
3. Step 8 line count increases by ~40 lines

## DO NOT
- Add a new numbered step (e.g. Step 8.5) — this belongs INSIDE Step 8
- Write predictions to awareness (only palace `predictions` room)
- Delete any existing content in Step 8
- Modify Steps 7 or 9
- Run the dream process — only modify the prompt file
