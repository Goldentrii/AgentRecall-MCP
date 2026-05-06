# AAM Brief — Dreaming Enhancement: Correction-Aware Reconsolidation

**Role:** Implementer (AAM agent)
**Review by:** tongwu
**Task:** Add Step 2.6 to `~/.aam/dreams/dream-prompt.md`. This step detects when recent corrections contradict existing awareness insights and writes an updated version — preventing stale insights from misleading future agents.

## Background

Human memory reconsolidates: when a recalled memory is contradicted by new evidence, it is updated in place, not just shadowed by a competing entry. Currently, corrections are stored separately and awareness insights are never updated. A future agent can read both and be confused about which one to trust. This step bridges that gap.

## What to Modify

File: `~/.aam/dreams/dream-prompt.md`

Insert **Step 2.6** — after Step 2.5 (Critical Path Detection), before Step 2.7 (Salience Decay, added by T1).

Do NOT remove or modify any existing steps.

---

## Step 2.6 — Correction-Aware Reconsolidation (insert after Step 2.5)

Add this verbatim after the `---` separator that closes Step 2.5:

```
---

## Step 2.6: Correction-Aware Reconsolidation
RECONSOLIDATED_COUNT = 0   ← initialize here

**Purpose:** When a correction contradicts an existing awareness insight, write an updated
version so future agents don't act on stale knowledge.

### Phase A: Load corrections seen tonight

Use the same CORRECTIONS set already read in Step 2.5.
If no corrections were found in Step 2.5: skip this step entirely.

For each correction already evaluated in Step 2.5 (including non-critical ones):
  Extract: rule text, context text, project slug.

### Phase B: Read current awareness

  /Users/tongwu/.npm-global/bin/ar --project AgentRecall awareness read

Parse and store each insight: title, evidence summary, applies_when keywords.

### Phase C: Find contradicting pairs

For each correction, check every awareness insight using this heuristic:

  CONTRADICTION if ALL of:
    1. At least 2 keywords from the correction's rule/context appear in the
       insight's applies_when list OR title (case-insensitive, stem match ok)
    2. The correction's rule asserts something that contradicts the insight's title
       (contradiction signals: "not", "don't", "never", "incorrect", "wrong",
       "actually", "instead", "should be", "must not")
    3. The insight does NOT already have prefix "UPDATED:", "CRITICAL:", "GLOBAL:", or "CRYSTALLIZED:"

  If match found: record the pair (correction, insight).

### Phase D: Write updated awareness insight

For each contradicting pair found in Phase C:

  1. Derive the updated principle:
     Keep the core domain from the original insight's title.
     Restate it incorporating the correction: "When {trigger}: {corrected action}"
     Prefix with "UPDATED: "

  2. Check dedup — scan awareness for existing "UPDATED:" insight with >60% keyword overlap:
     If duplicate exists: skip this pair (already reconsolidated), increment nothing.

  3. Write to awareness:
     /Users/tongwu/.npm-global/bin/ar --project AgentRecall awareness update \
       --insight "UPDATED: {corrected principle, ≤15 words}" \
       --evidence "Supersedes: '{original title}'. Correction from {project} ({date}): {correction rule, ≤100 chars}" \
       --applies-when {original applies_when keywords},reconsolidated,updated
     Increment AR_WRITE_COUNT.
     Increment RECONSOLIDATED_COUNT.

### Hard limits
- Maximum 5 reconsolidations per night. Pick highest-salience insight if more qualify.
- Never reconsolidate insights with CRITICAL: prefix (those are permanent records).
- If Phase B parsing fails (ar returns no insights): skip entirely, log in What Was Skipped.
- If contradiction signal is ambiguous: skip. False reconsolidation is worse than missing one.

**Add to Variable Initialization block at top of prompt:**
  RECONSOLIDATED_COUNT = 0

**Add to Dream Report (Step 8) under new section after Critical Path Updates:**
## Reconsolidations
| Original Insight | Correction Source | Updated Insight Written |
|-----------------|-------------------|------------------------|
[one row per reconsolidation, or "none"]

**Add to AR CLI Writes tally:**
  reconsolidations: {RECONSOLIDATED_COUNT}
```

---

## Verification

After editing, verify:
1. `grep -n "Step 2.6\|Step 2.5\|Step 2.7" ~/.aam/dreams/dream-prompt.md`
   — Step 2.5 line number < Step 2.6 line number < Step 2.7 line number
2. `grep -n "RECONSOLIDATED_COUNT" ~/.aam/dreams/dream-prompt.md`
   — should appear 3 times: Variable Initialization, Phase D increment, AR Writes tally

## DO NOT
- Delete any existing steps
- Modify Steps 2.5 or 2.7
- Write to any path other than `~/.aam/dreams/dream-prompt.md`
- Run the dream process — only modify the prompt file
