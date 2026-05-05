# Codex Brief — T2: Wire Memories FTS Into Session Start Hook

**Role:** Implementer (Codex)
**Review by:** Claude (orchestrator)
**Task:** Add a `query_relevant_memories()` function to `~/.claude/scripts/supabase-session-start.py` that surfaces the top 5-8 relevant memories from the Supabase `memories` table at session start.

## Context

The file `~/.claude/scripts/supabase-session-start.py` already:
- Queries the `projects` table and emits an orchestrator brief as `<supabase-context>`
- Uses `urllib.request` (standard library only — no requests, no httpx)
- Runs as a SessionStart hook — must complete in < 5 seconds

The `memories` table columns: `id`, `slug`, `name`, `description`, `type`, `body`, `created_at`, `updated_at`
Types used: `user`, `feedback`, `project`, `reference`

## What To Build

Add a new function `query_relevant_memories(active_slugs: list[str]) -> list[dict]` that:

1. Builds a FTS query string from active project slugs:
   - Join slug names with space: `"agentrecall novada memory"`
   - Use Supabase REST FTS syntax

2. Queries Supabase memories table:
```
GET /rest/v1/memories?select=slug,name,type,body
  &body=fts.{query_string}   ← FTS filter (Supabase REST syntax)
  &type=in.(feedback,project,reference)
  &order=updated_at.desc
  &limit=8
```

Supabase REST FTS filter format: `body=fts.keyword1%20keyword2`
Or use the full-text search on the `name` column if body is too large.

3. **Fallback (if FTS returns 0):** Get most-recently-updated memories of type feedback or project:
```
GET /rest/v1/memories?select=slug,name,type,body&type=in.(feedback,project)&order=updated_at.desc&limit=5
```

4. Truncate `body` to 300 chars per memory in the output.

5. Timeout: 3 seconds. On timeout or error: return empty list (silent failure, don't crash hook).

## Output Format

After the existing `</supabase-context>` block, emit:

```
<memory-context>
## Active Memory — {date}

### [feedback] {name}
{body[:300]}

### [project] {name}
{body[:300]}
...
</memory-context>
```

Only emit the block if at least 1 memory was returned. Skip entirely on empty result.

## Files To Modify

- `~/.claude/scripts/supabase-session-start.py`

Read the full file first before modifying.

## Implementation Notes

- Supabase URL: `https://fjdtuyflvgylrllujpnc.supabase.co`
- API key: `sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr`
- The REST FTS syntax for Supabase: use `&{column}=fts.{terms}` (case-insensitive)
  Example: `&name=fts.agentrecall%20novada` filters rows where name contains those terms
- For broad FTS across name+body, Supabase REST doesn't support multi-column FTS directly.
  Use: `&or=(name.fts.{terms},body.fts.{terms})` syntax, or query both columns separately.
- The memories table has 98 rows — this is small enough that fetching all and filtering in Python is also acceptable if REST FTS proves complicated.

## Test

After modification, run:
```bash
python3 ~/.claude/scripts/supabase-session-start.py
```

Expected: output includes both `<supabase-context>` block AND `<memory-context>` block.
Both blocks must appear within 5 seconds.

## Success Criteria

- Script outputs `<memory-context>` block with ≥ 1 memory
- Body truncated to ≤ 300 chars per memory
- No crash on network failure (catches exception, skips block)
- Total script runtime ≤ 5 seconds

## Do NOT

- Change the existing `<supabase-context>` output format
- Add new pip dependencies
- Modify any other files
- Bump any versions
- Run npm publish
