# Codex Brief — T3: Merge feat/supabase-semantic-recall Into main (v3.4.3)

**Role:** Implementer (Codex)
**Review by:** Claude (orchestrator) — DO NOT publish until Claude approves
**Task:** Merge the `feat/supabase-semantic-recall` branch into main, resolving all conflicts in favor of the resolution table below, run tests, bump version to 3.4.3.

## Context

Repository: `~/Projects/AgentRecall/`
Current main: v3.4.2 (includes memory pipeline fixes — logSyncError, insight-promotion, sig/theme naming)
Branch to merge: `feat/supabase-semantic-recall` (adds pgvector recall backend, RRF scoring, embeddings)

The branch was created before the memory pipeline fixes, so conflicts exist. The branch REMOVES some functions that main ADDED — you must keep main's additions.

## Conflict Resolution Table

| File | What branch does | What main has | KEEP |
|------|-----------------|---------------|------|
| `packages/core/src/supabase/sync.ts` | Removes `logSyncError()` function | logSyncError with atomic 500-line cap | **KEEP main's logSyncError** |
| `packages/core/src/tools-logic/insight-promotion.ts` | Has older version (no NaN guard) | Updated with NaN guard + threshold validation | **KEEP main's version** |
| `packages/core/src/helpers/journal-sig-theme.ts` | Not present on branch | Added in main (autoClassifySig, autoClassifyTheme) | **KEEP main's file** |
| `packages/core/src/helpers/journal-name-parser.ts` | Not present on branch | Added in main (parseJournalFileName) | **KEEP main's file** |
| `packages/core/src/storage/session.ts` | Has older sig/theme format | Has {date}--{saveType}--{sig}--{theme}--{slug}.md | **KEEP main's format** |
| `packages/core/src/tools-logic/session-end.ts` | Older version | Calls promoteConfirmedInsights(3) at end | **KEEP main's version + merge branch's supabase sync additions** |
| `packages/core/src/index.ts` | Exports different symbols | Exports promoteConfirmedInsights etc. | **Merge both — keep all exports from both** |
| `README.md`, `packages/core/README.md`, `packages/cli/README.md` | More complete (restructured) | Less complete | **KEEP branch's versions** |
| `packages/cli/src/index.ts` | Has ar setup supabase backend command | Has ar awareness rollup + NaN guard | **Merge both — keep all commands** |

## Steps

1. **Verify clean state**
```bash
cd ~/Projects/AgentRecall
git status  # must be clean
git checkout main
git log --oneline -3  # confirm on v3.4.2
```

2. **Attempt merge**
```bash
git merge --no-ff feat/supabase-semantic-recall
# Expect conflicts — that's OK
```

3. **Resolve conflicts** per the table above

For each conflicted file:
- Read what main has (their side)
- Read what branch has (incoming side)
- Apply the resolution from the table
- Stage the resolved file: `git add <file>`

4. **Run tests**
```bash
cd packages/core && npm test
```
All tests must pass. Fix any failures before proceeding.

5. **Run build**
```bash
cd ~/Projects/AgentRecall && npm run build --workspaces
```
Must complete with 0 errors.

6. **Bump version to 3.4.3**

In `packages/core/package.json`:
```json
"version": "3.4.3"
```

In `packages/mcp-server/package.json`:
```json
"version": "3.4.3"
```

In `packages/cli/package.json`:
```json
"version": "3.4.3"
```

Also update `packages/core/src/types.ts`:
  Change: export const VERSION = "3.4.2";
  To:     export const VERSION = "3.4.3";

7. **Commit**
```bash
git add -A
git commit -m "feat: merge semantic recall (pgvector + RRF) — v3.4.3

- Adds pgvector-based recall backend with Reciprocal Rank Fusion
- Adds embedding provider abstraction (OpenAI + Voyage)  
- Adds Supabase client, config, migration SQL
- Adds auto-backfill on session_start when Supabase configured
- Preserves memory pipeline fixes from v3.4.1:
  - logSyncError with atomic 500-line cap
  - insight-promotion NaN guard
  - journal-sig-theme naming format (sig/theme replace lines)"
```

8. **Report to Claude for review** — include:
   - List of conflicts and how each was resolved
   - Test output (pass/fail counts)
   - Build output
   - Final `git diff HEAD~1 --stat`
   - DO NOT run npm publish

## Success Criteria

- `git log --oneline -1` shows the merge commit
- `npm test` passes in `packages/core/`
- `npm run build --workspaces` succeeds
- `packages/core/src/supabase/backends/` directory exists (from branch)
- `packages/core/src/helpers/journal-sig-theme.ts` exists (from main)
- `packages/core/src/tools-logic/insight-promotion.ts` has the NaN guard (main's version)
- `packages/core/src/supabase/sync.ts` has `logSyncError` function (main's version)
- All three packages at version 3.4.3

## Do NOT

- Run `npm publish` — Claude approves first
- Delete any files
- Run `git push` — Claude approves first
- Skip tests
- Squash the merge commit
