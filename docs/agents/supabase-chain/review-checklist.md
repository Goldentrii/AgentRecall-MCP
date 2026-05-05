# Claude Review Checklist — Supabase Chain Integration

Use this after each Codex task completes. Claude reviews, Codex fixes. Never skip.

---

## T1 Review (Journal Backfill)

- [ ] Before count reported
- [ ] After count ≥ 31
- [ ] No errors in backfill output
- [ ] Codex did not modify any source files

---

## T2 Review (Memories Hook)

- [ ] Script still outputs `<supabase-context>` block (no regression)
- [ ] Script outputs `<memory-context>` block with ≥ 1 memory
- [ ] Body truncated to ≤ 300 chars per memory
- [ ] Script exits cleanly (no uncaught exceptions)
- [ ] Script runtime ≤ 5 seconds
- [ ] Graceful failure: if Supabase unreachable, script still completes

**Test command:**
```bash
time python3 ~/.claude/scripts/supabase-session-start.py
```

---

## T3 Review (Merge + v3.4.3)

- [ ] Merge commit exists on main
- [ ] Conflict resolution table applied correctly (verify each file)
- [ ] `packages/core/src/supabase/backends/` exists (semantic recall feature from branch)
- [ ] `packages/core/src/helpers/journal-sig-theme.ts` exists (from main)
- [ ] `packages/core/src/tools-logic/insight-promotion.ts` has NaN guard (main's version)
- [ ] `packages/core/src/supabase/sync.ts` has `logSyncError` function (main's version)
- [ ] All packages at version 3.4.3
- [ ] `npm test` passes in packages/core/ (all tests green)
- [ ] `npm run build --workspaces` succeeds

**Approval required before:** npm publish, git push

---

## T4 Review (pgvector Migration)

- [ ] `memories.embedding` column exists with type `vector(1536)`
- [ ] `match_memories()` RPC function exists
- [ ] ivfflat index created
- [ ] 98 rows still present in memories table (no data loss)
- [ ] `match_memories()` callable with dummy vector (returns 0 rows, no error)

---

## T5 Review (Embeddings Sync)

- [ ] Script works without `OPENAI_API_KEY` (no crash, logs skip message)
- [ ] Script generates embeddings when `OPENAI_API_KEY` is set
- [ ] At least 50% of memories rows have non-null embedding after full run
- [ ] Unchanged files do not re-trigger API calls on second run
- [ ] No new pip dependencies added
- [ ] Script runtime acceptable (< 10 seconds for unchanged files)

---

## Final System Check (After All Tasks)

Run this to verify the full chain:

```bash
# 1. Session start hook produces memory context
python3 ~/.claude/scripts/supabase-session-start.py | grep -A5 "memory-context"

# 2. Journal entries count
curl -s "https://fjdtuyflvgylrllujpnc.supabase.co/rest/v1/journal_entries?select=count" \
  -H "apikey: sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr"

# 3. Memories with embeddings
curl -s "https://fjdtuyflvgylrllujpnc.supabase.co/rest/v1/memories?select=count&embedding=not.is.null" \
  -H "apikey: sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr"

# 4. AgentRecall tests
cd ~/Projects/AgentRecall && npm test --workspace packages/core
```

Expected results:
1. `<memory-context>` block appears with ≥ 1 memory
2. count ≥ 31
3. count ≥ 50 (≥ 50% of 98 memories)
4. All tests pass
