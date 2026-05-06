# AAM Brief — Dreaming Enhancements: Salience Decay + Memory Crystallization

**Role:** Implementer (AAM agent)
**Review by:** tongwu
**Task:** Add two new steps to `~/.aam/dreams/dream-prompt.md` — salience decay and memory crystallization. These make the nightly dream process actively reshape the memory graph instead of only adding to it.

## What to Modify

File: `~/.aam/dreams/dream-prompt.md`

Insert **Step 2.7** (after Step 2.5, before Step 3) and **Step 4.5** (after Step 4, before Step 5).

Do NOT remove or modify any existing steps. Append the new steps in the right positions by editing the file.

---

## Step 2.7 — Salience Decay (insert after Step 2.5)

Add this verbatim after the `---` separator that closes Step 2.5:

```
---

## Step 2.7: Salience Decay Pass
DECAYED_COUNT = 0       ← initialize here
ARCHIVED_COUNT = 0      ← initialize here

Apply the Ebbinghaus forgetting curve to all palace rooms across all active projects.

**For each project in ~/.agent-recall/projects/:**

1. List all room _room.json files:
   find ~/.agent-recall/projects/{slug}/palace/rooms -name "_room.json" 2>/dev/null

2. For each _room.json, read: slug, salience, last_accessed, access_count

3. Calculate days_inactive:
   days_inactive = (today_date - last_accessed_date).days
   If last_accessed is missing or unparseable: treat as 30 days inactive.

4. Apply decay formula:
   new_salience = max(0.05, current_salience * (0.95 ^ days_inactive))
   Round to 4 decimal places.

5. If new_salience differs from current by more than 0.005 (avoid micro-writes):
   Write updated _room.json with new salience value.
   Use direct file write (not ar CLI — rooms _room.json has no ar write command):
     python3 -c "
     import json, sys
     path = '{_room_json_path}'
     data = json.load(open(path))
     data['salience'] = {new_salience}
     json.dump(data, open(path, 'w'), indent=2)
     "
   Increment DECAYED_COUNT.

6. If new_salience <= 0.05:
   Add "archived": true to the _room.json (do NOT delete the file or room).
   Log the room slug + project in dream report under "Archived Rooms."
   Increment ARCHIVED_COUNT.

**Skip decay for:**
- Rooms with slug = "corrections" or "critical_path" (these never decay)
- Rooms where access_count >= 10 (frequently accessed — skip decay this cycle)
- Any _room.json that fails to parse (log in What Was Skipped, continue)

**Add to Variable Initialization block at top of prompt:**
  DECAYED_COUNT = 0
  ARCHIVED_COUNT = 0

**Add to AR CLI Writes section in Step 8:**
  decay_updated: {DECAYED_COUNT}, archived: {ARCHIVED_COUNT}

**Add to Dream Report (Step 8) under a new section:**
## Salience Decay
| Project | Room | Old Salience | New Salience | Days Inactive | Archived? |
|---------|------|-------------|-------------|---------------|-----------|
[one row per room where decay was applied, or "none (all rooms recently active)"]
```

---

## Step 4.5 — Memory Crystallization (insert after Step 4, before Step 5)

Add this verbatim after the `---` separator that closes Step 4:

```
---

## Step 4.5: Memory Crystallization
CRYSTALLIZED_COUNT = 0  ← initialize here

**Purpose:** When 3+ awareness insights share overlapping applies_when tags AND have
combined confirmation_count ≥ 5, compress them into a single higher-abstraction principle.
Like how repeated experiences become intuition.

**Phase A — Read current awareness:**
  /Users/tongwu/.npm-global/bin/ar --project AgentRecall awareness read

Parse the output. For each insight, extract:
  - title
  - applies_when keywords (the tag list)
  - confirmation count (number after "×" or "[Nx]" in the output)

**Phase B — Find crystallization candidates:**
Build clusters: group insights where at least 2 applies_when keywords overlap.
A cluster qualifies when:
  - 3+ insights in the cluster
  - Sum of confirmation_counts across the cluster >= 5
  - No insight in the cluster has "CRYSTALLIZED:" or "GLOBAL:" prefix (skip already-promoted)
  - No insight in the cluster has "CRITICAL:" prefix (those don't crystallize — they stay sharp)

**Phase C — For each qualifying cluster:**

1. Derive the crystallized principle:
   - Find the single most-confirmed insight in the cluster as the seed
   - Synthesize: "When {common trigger across all}: {unified action}" — max 15 words
   - Evidence: list all source insight titles + confirmation counts

2. Check dedup — scan awareness for existing insight with >60% keyword overlap:
   If duplicate exists: skip crystallization for this cluster, increment nothing.

3. Write crystallized insight to awareness:
   /Users/tongwu/.npm-global/bin/ar --project AgentRecall awareness update \
     --insight "CRYSTALLIZED: {synthesized principle}" \
     --evidence "compressed from {N} insights (total {M}× confirmed): {source titles}" \
     --applies-when {union of all applies_when tags from cluster},crystallized
   Increment AR_WRITE_COUNT.
   Increment CRYSTALLIZED_COUNT.

4. Write to shortcuts room as a permanent shortcut (highest salience):
   /Users/tongwu/.npm-global/bin/ar --project AgentRecall palace write shortcuts \
     "CRYSTALLIZED [{M}× confirmed] {common trigger} → {unified action}"
   Increment AR_WRITE_COUNT.

**Hard limits:**
- Maximum 3 crystallizations per night. If more qualify, pick top-3 by total confirmation_count.
- Never crystallize insights from different categories (e.g. don't merge a "supabase" cluster with a "git" cluster even if 2 tags overlap).
- If Phase A returns no insights or parsing fails: skip this step entirely, log in What Was Skipped.

**Add to Variable Initialization block:**
  CRYSTALLIZED_COUNT = 0

**Add to Step 7 journal write:**
  "Critical: {CRITICAL_COUNT}. Global: {GLOBAL_GRADUATED}. Crystallized: {CRYSTALLIZED_COUNT}. Skills: {PROPOSED_SKILL_COUNT}. Briefs: {BRIEFS_GENERATED}."

**Add to Dream Report under a new section:**
## Memory Crystallization
| Source Insights (N) | Total Confirmations | Crystallized Principle | Written? |
|--------------------|--------------------|----------------------|---------|
[one row per crystallization, or "none (no clusters met threshold tonight)"]
```

---

## Verification

After editing dream-prompt.md, verify:
1. Step 2.7 appears between Step 2.5 and Step 3 — grep: `grep -n "Step 2.7\|Step 3:" ~/.aam/dreams/dream-prompt.md`
2. Step 4.5 appears between Step 4 and Step 5 — grep: `grep -n "Step 4.5\|Step 5:" ~/.aam/dreams/dream-prompt.md`
3. Variable initializations added to the block at the top
4. No existing steps removed or renamed

Report back: confirmation that both steps were inserted, with line numbers of each insertion point.

## DO NOT
- Delete any existing steps
- Rename existing steps
- Modify Step 3, Step 4, Step 5 content
- Run the dream process tonight — only modify the prompt
