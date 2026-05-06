# AAM Brief — Dreaming Enhancement: Stale Insight Pruning

**Role:** Implementer (AAM agent)
**Review by:** tongwu
**Task:** Add Step 7.5 to `~/.aam/dreams/dream-prompt.md`. This step surfaces awareness insights that have gone stale — old, rarely confirmed, and unsupported by recent journal evidence — so the human can decide to archive or retire them.

## Background

Human memory prunes: connections not used for extended periods weaken and eventually fade. Without pruning, the awareness system accumulates stale insights from old projects, obsolete tool behaviors, or outdated patterns. This poisons future agents who trust all awareness equally. Step 7.5 does NOT delete anything — it flags candidates for human review and surfaces them in the dream report.

## What to Modify

File: `~/.aam/dreams/dream-prompt.md`

Insert **Step 7.5** — after Step 7 (Journal Write), before Step 8 (Dream Report generation).

Do NOT remove or modify any existing steps.

---

## Step 7.5 — Stale Insight Pruning (insert after Step 7)

Add this verbatim after the `---` separator that closes Step 7:

```
---

## Step 7.5: Stale Insight Pruning
STALE_FLAGGED_COUNT = 0   ← initialize here

**Purpose:** Surface awareness insights that no longer appear in recent activity.
Humans decide what to retire — this step only identifies candidates.

### Phase A: Read current awareness

  /Users/tongwu/.npm-global/bin/ar --project AgentRecall awareness read

For each insight, extract:
  - title
  - applies_when keywords
  - confirmation count (N in "Nx" or "[Nx]" notation)
  - source date (from --source field if present; else treat as "unknown")

### Phase B: Read recent journal evidence (last 14 days)

  /Users/tongwu/.npm-global/bin/ar --project AgentRecall rollup --dry-run

Also read any journal files from the last 14 days across the projects checked in Step 3.
Build a keyword corpus: all words appearing in recent journal content (case-folded, no stopwords).

Stopwords to exclude: a an the and or but in on at to for of with is are was were has have had be been being that this it its i we you he she they

### Phase C: Score each insight for staleness

For each insight, compute a staleness score:

  stale_score = 0

  If confirmation_count == 1: stale_score += 2
  If source date is known and days_since_source >= 30: stale_score += 2
  If source date is known and days_since_source >= 60: stale_score += 2 (additive)

  For each applies_when keyword:
    If keyword NOT in recent journal corpus: stale_score += 1

  STALE if stale_score >= 5 AND insight does NOT have prefix:
    "CRITICAL:", "GLOBAL:", "CRYSTALLIZED:", "UPDATED:"
  (These prefixed insights are protected — never flag them as stale)

### Phase D: Write findings to dream report only

For each insight where STALE == true:
  Record: title, confirmation_count, days_since_source (or "unknown"), missing keywords count.
  Increment STALE_FLAGGED_COUNT.

Do NOT write to awareness. Do NOT delete or archive any insight.
This step is observation-only — the human decides what to do.

### Hard limits
- Maximum 5 stale candidates per report. If more qualify, show top 5 by highest stale_score.
- If Phase A returns no insights or parsing fails: skip entirely, log in What Was Skipped.
- If recent journal corpus is empty (no journals read tonight): skip Phase C, log reason.

**Add to Variable Initialization block at top of prompt:**
  STALE_FLAGGED_COUNT = 0

**Add to Dream Report (Step 8) under new section before Index Issues:**
## Stale Insight Candidates
| Insight | Confirmations | Age | Missing Keywords | Stale Score | Action |
|---------|--------------|-----|-----------------|-------------|--------|
[one row per stale candidate, or "none (all insights recently active)"]

_Human action: review stale candidates above. To archive: `ar awareness archive --insight "{title}"`_

**Add to AR CLI Writes tally:**
  (no writes — observation only)
```

---

## Verification

After editing, verify:
1. `grep -n "Step 7.5\|Step 7:\|Step 8:" ~/.aam/dreams/dream-prompt.md`
   — Step 7 line < Step 7.5 line < Step 8 line
2. `grep -n "STALE_FLAGGED_COUNT" ~/.aam/dreams/dream-prompt.md`
   — should appear in Variable Initialization and Phase D
3. `grep -n "Stale Insight Candidates" ~/.aam/dreams/dream-prompt.md`
   — should appear in the dream report template in Step 8

## DO NOT
- Delete any existing steps
- Write to awareness — this step is observation-only
- Modify Steps 7 or 8
- Run the dream process — only modify the prompt file
