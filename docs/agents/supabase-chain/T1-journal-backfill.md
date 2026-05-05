# Codex Brief — T1: Journal Backfill

**Role:** Implementer (Codex)
**Review by:** Claude (orchestrator)
**Task:** Run the journal backfill CLI command and verify journal_entries count in Supabase increases from 20 to ≥ 31.

## Scope

- Execute `ar setup supabase --backfill`
- Verify via REST API that journal_entries count increased
- No code changes — this is CLI execution only
- Do NOT touch any source files

## Steps

1. **Verify current count**
```bash
curl -s "https://fjdtuyflvgylrllujpnc.supabase.co/rest/v1/journal_entries?select=id" \
  -H "apikey: sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr" \
  -H "Prefer: count=exact" \
  -o /dev/null -w "%{http_code}\n"

# Then get actual count:
curl -s "https://fjdtuyflvgylrllujpnc.supabase.co/rest/v1/journal_entries?select=count" \
  -H "apikey: sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr"
```

2. **Run backfill**
```bash
/Users/tongwu/.npm-global/bin/ar setup supabase --backfill
```

If the CLI is not found, try:
```bash
node /Users/tongwu/Projects/AgentRecall/packages/cli/dist/index.js setup supabase --backfill
```

3. **Verify new count**

Run the same curl query as step 1. Expected: count ≥ 31.

4. **Report results**

Return:
- Before count
- After count
- Number of new entries synced
- Any errors encountered

## Success Criteria

- `journal_entries` count in Supabase ≥ 31 after backfill
- No crash or unhandled error from CLI

## Do NOT

- Modify any source code
- Bump any versions
- Run npm publish
- Delete any files
