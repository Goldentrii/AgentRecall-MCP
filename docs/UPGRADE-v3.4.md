# AgentRecall v3.4.0 — Upgrade Plan

> **Goal:** Make the journal pipeline work harder so old journals naturally become archival.
> **Principle:** No new layers. Strengthen existing L2→L3/L4 promotion + add auto-compaction.

## Changes (3 steps, in order)

### Step 1: Weekly Roll-Up (`journal_rollup` tool)
**File:** `src/tools/journal-rollup.ts` (NEW)

New tool: `journal_rollup` — automatically condenses 7 daily journals into one weekly summary.

- Scans for weeks with 3+ daily entries that are 7+ days old
- Synthesizes: brief, decisions, blockers, completed, next → one `YYYY-WNN.md` file
- Moves originals to `archive/` (reuses existing archive logic)
- Updates index
- Can be called manually or triggered by `journal_cold_start` when cold count is high

**Why:** This is the #1 fix for journal accumulation. After 30 days, instead of 30 files you have 4 weekly summaries + this week's dailies.

### Step 2: Palace-First Cold Start (upgrade `journal_cold_start`)
**File:** `src/tools/journal-cold-start.ts` (MODIFY)

Change cold-start to load palace context FIRST, journal SECOND:

```
Current:  journal entries (hot/warm/cold) → that's it
New:      palace identity + awareness summary + top rooms → THEN journal (hot only)
```

- Add `palace_context` to the return: identity (~50 tokens) + awareness summary (~100 tokens) + top 3 rooms by salience
- Warm/cold journals reduced to counts only (no more reading briefs for 2-7 day entries)
- Net effect: cold-start costs ~200 tokens from palace instead of ~800 from journals

**Why:** Palace is the curated, compressed source. Journals are raw logs. Cold-start should prefer curated.

### Step 3: Promotion Verification in `/arsave` (upgrade command)
**File:** `commands/arsave.md` (MODIFY)

Add a verification step after consolidation:

```
Current /arsave:
  1. journal_write
  2. context_synthesize(consolidate=true)
  3. awareness_update

New /arsave:
  1. journal_write
  2. context_synthesize(consolidate=true)
  3. awareness_update
  4. VERIFY: check palace rooms were actually updated
     - architecture room has today's decisions? If not, extract from journal and write.
     - blockers room current? If not, sync.
     - At least 1 insight in awareness? If not, extract.
  5. Auto-trigger journal_rollup if cold count > 14
```

**Why:** Agents skip consolidation or do it superficially. Verification makes promotion mandatory.

## Test Plan

Each step gets tests before implementation:
- Step 1: rollup creates weekly summary, archives originals, handles edge cases (partial weeks, already rolled up)
- Step 2: cold-start returns palace context, reduces token cost
- Step 3: verification detects missing promotions

## Version Bump

All 3 steps → v3.4.0 (single bump at the end)
