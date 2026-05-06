# AR + AAM + Supabase Integration Audit

**Date:** 2026-05-06
**Workers:** 5 Claude (Sonnet) + 5 Codex — 10 parallel reviewers
**Session:** ar-integration-audit-e26bd91b
**Dimensions:** Agent-First UX, Contradiction & Staleness, Naming System, Folder Structure, Cross-System Sync

---

## Findings

### P0 — Critical (blocks agent reliability)

**P0-1. Ghost project dir explosion from cwd detection**
*Dimension: Naming + Folders | Workers: 3, Codex 3, Codex 4*

`detectProject()` in `storage/project.ts` uses `basename(cwd)` as fallback with no safeguards. This has silently created 13 orphan project dirs: `Downloads`, `Projects`, `phase-1`, `mcp`, `claude`, `default`, `this-project-does-not-exist-xyz`, `x-omnier`, `novada-tech-group`, `.aam`, `APQC-Process-Automation`, `novada-proxy-extension`, `novada-proxy-python`. Each gets a palace structure. Pollutes `project_board`, `list_all_projects`, and any tool that iterates projects.

**Fix:** Add a project validation step — require at least one journal entry or explicit `session_start` before creating a new project dir. Add a blocklist for common non-project names (`Downloads`, `Projects`, `default`).

---

**P0-2. No canonical slug — 4+ names per project across systems**
*Dimension: Naming | Workers: 3, Codex 3*

AgentRecall uses: dir `AgentRecall` (PascalCase), Supabase `agentrecall` (lowercase), npm `agent-recall-mcp`, GitHub `AgentRecall-MCP`. 6 different slug sanitizer functions exist in the codebase with no canonical `normalize()`. `novada-proxy` has 4 AR dirs (`proxy4agent`, `novada-proxy`, `novada-proxy-extension`, `novada-proxy-python`). AutoMemory file is `project_agentproxy.md` — matching none of them.

**Fix:** Single `normalizeSlug()` function in `paths.ts`. All reads/writes go through it. Migration script to merge/alias legacy slugs.

---

**P0-3. Zero `agent_instruction` fields in any error response**
*Dimension: Agent-First UX | Workers: 1, Codex 1*

Codebase-wide grep returns zero `agent_instruction` fields. Every error is either a plain string throw or `{ error: "..." }`. Six critical error paths in digest, bootstrap, and smart-remember give agents no structured next-step guidance. Agents must parse human-readable strings — unreliable for programmatic use.

**Fix:** Define `AgentError` type with mandatory `agent_instruction: string`. Retrofit all error paths. Priority: the 6 identified paths that agents hit most frequently.

---

**P0-4. `remember` tool description references phantom tools**
*Dimension: Agent-First UX | Worker: 1*

Description says "For structured palace rooms use `palace_write` directly" and "For Q&A pairs use `capture`" — neither exists as a registered MCP tool (both deprecated). Guaranteed agent failure loop.

**Fix:** Replace with valid routing guidance: "use `remember` with `context: 'architecture'` for palace routing, `context: 'qa'` for Q&A capture."

---

**P0-5. `ownedFiles` singleton never reset in production**
*Dimension: Cross-System Sync | Workers: 5, Codex 2, Codex 5*

`ownedFiles` is a module-level `Set<string>` at `session.ts:27`. Grows with every file touch in the MCP process. `resetOwnedFiles()` exists at line 141 but grep confirms **no production caller** — only test code. In long-running MCP processes, Session N's entries bleed into Session N+1's file selection. Same root class as the `-log.md` bug fixed today.

**Fix:** Call `resetOwnedFiles()` at the start of every `session_end` and `session_start`. Or: eliminate `ownedFiles` by always using `readdirSync` (the smart path already does this).

---

**P0-6. awareness-state.json and awareness-archive.json never synced to Supabase**
*Dimension: Cross-System Sync | Workers: 5, Codex 5*

`writeAwarenessState()` and `writeAwarenessArchive()` are bare `fs.writeFileSync` — no `syncToSupabase()` call. The structured awareness data (confirmation counts, appliesWhen arrays, compound insights, trajectory) only exists locally. Supabase only gets the rendered `awareness.md` (text). If local files are lost, this structured state cannot be reconstructed.

**Fix:** Add Supabase sync to `writeAwarenessState()` — either inline or via fire-and-forget (with logging). Or: add a new Supabase table `awareness_state` for the structured JSON.

---

**P0-7. session-start.ts resume block has no log/capture file filter**
*Dimension: Folders | Workers: 4, Codex 2, Codex 4*

`session-start.ts:127,175` uses `readdirSync(dir).filter(f => f.endsWith(".md")).sort().reverse()` with no exclusion for `-log.`, `--capture--`, or weekly rollups. When `--capture--` and `--arsave--` files coexist, reverse alpha sort picks `--capture--` first (since `c` > `a`). Agent gets null trajectory. Same bug class as SAME-DAY RULE, just different location.

**Fix:** Apply the same filter pattern used in `session.ts` SAME-DAY RULE: exclude `-log.`, `--capture--`, weekly rollups. Extract into a shared `isJournalFile()` filter.

---

**P0-8. MEMORY.md and project_agentrecall.md are stale and self-contradicting**
*Dimension: Contradiction | Worker: 2*

MEMORY.md says v3.4.3, T4/T5 pending, "ar CLI may be stale v3.3.26". Reality: v3.4.4, T4/T5 complete, ar CLI is 3.4.4. project_agentrecall.md has three contradicting tool counts in the same file: "10 tools", "8 MCP Tools (v3.3.28)", "3 Tools added (NOT published)". Architecture section shows `@3.3.28` — 13 versions behind.

**Fix:** Update MEMORY.md and project_agentrecall.md immediately. Add a dream step or session_end hook that flags when version in memory files diverges from `package.json`.

---

### P1 — Important (degrades quality)

**P1-1. Dream Step 2.7 writes _room.json directly — no lock, no atomic, no sync**
*Workers: 5, Codex 5*
Python `json.dump()` writes directly to `_room.json` bypassing `writeJsonAtomic()`, filelock, and Supabase sync. Three compounding failures: crash corruption, race with MCP, permanent salience divergence.
**Fix:** Dream should call `ar palace-write` (CLI) instead of direct Python file writes.

**P1-2. 12+ read-modify-write paths without filelock**
*Codex 2*
Only digest operations are locked. Unlocked: alignment-log.json, feedback-log.json, .state.json, palace-index.json, _room.json, graph.json, awareness (partial), insights-index.json.
**Fix:** Expand filelock to all JSON read-modify-write operations. Priority: rooms, awareness-update, insights-index.

**P1-3. session_end silently swallows awareness and palace failures**
*Worker: 5*
Three `catch {}` blocks swallow errors. Card shows "0 insights added" with no error text. `palace_consolidated: false` is in JSON but not in card. Agents have no signal their data was dropped.
**Fix:** Surface error summaries in the card output: `[WARN: awareness update failed: {reason}]`.

**P1-4. `check` dual-purpose tool undocumented**
*Worker: 1*
12 parameters, two use cases (goal verification + Bayesian decision trail), undocumented two-call protocol. First-try success: 2/5.
**Fix:** Split into two descriptions or add a "Usage patterns" section to the description.

**P1-5. project-board.ts missing `--capture--` filter**
*Worker: 4*
Line 105 filters `-log.` but not `--capture--`. Smart-named capture files appear as project trajectory.
**Fix:** Add `--capture--` to the filter. Use shared `isJournalFile()`.

**P1-6. CLI bypasses getRoot() in 14+ locations**
*Worker: 4*
`packages/cli/src/index.ts` hardcodes `os.homedir()/.agent-recall` instead of using `getRoot()`. Breaks if `AGENT_RECALL_ROOT` is set.
**Fix:** Import and use `getRoot()` everywhere.

**P1-7. Journal naming: only 2/88 files use current format**
*Worker: 3*
v3.4.1+ smart naming (`{date}--arsave--{sig}--{theme}--{slug}.md`) exists in code but almost never triggers. 40 files use old format, 19 use bare date. Growing divergence.
**Fix:** Audit why smart naming doesn't trigger. Likely: most saves go through legacy path.

**P1-8. supabase-session-start.py skips journal_entries, no freshness check**
*Workers: 5, Codex 5*
Session start hook queries `projects` + `memories` but NOT `journal_entries`. No mtime comparison or `ar_sync_state` check. Stale Supabase → stale agent context.
**Fix:** Add `journal_entries` query. Add sync timestamp check.

**P1-9. Palace room "version stays 3.3.x" is factually false**
*Worker: 2*
`architecture/decisions.md` entries from April say "version stays 3.3.11" — now false (3.4.4). Agents would flag normal version bumps as violations.
**Fix:** Update palace room. Add dream step to reconcile palace facts against package.json.

**P1-10. smart-remember.ts returns wrong file path in feedback**
*Worker: 4*
Returns legacy `-log.md` path when actual file is smart-named. Uses `process.env.HOME` instead of `getRoot()`.
**Fix:** Use actual filename from `captureLogFileName()` and `getRoot()`.

**P1-11. aam.md expects escalations.json file; filesystem has escalations/ directory**
*Worker: 4*
Skill says `escalations.json`; session init created `escalations/` directory. Agent escalation logic errors.
**Fix:** Align — either change skill to `escalations/` or change init to write `escalations.json`.

**P1-12. `recall` returns empty results with no recovery guidance**
*Worker: 1*
`session_start` has `empty_state` guidance; `recall` has nothing. Agents re-query endlessly.
**Fix:** Add `guidance` field when results are empty: "Project may need initialization — try `session_start` or `bootstrap_scan`."

**P1-13. `bootstrap_import` fragile "copy second content block"**
*Worker: 1*
Requires agents to extract raw JSON from a multi-part response. Most agents fail. First-try success: 2/5.
**Fix:** Accept the structured object directly instead of requiring raw string extraction.

---

### P2 — Minor (cleanup)

| # | Finding | Source |
|---|---------|--------|
| P2-1 | Duplicate insight in awareness.md (garbled auto-promote) | Worker 2 |
| P2-2 | `critical_path` room uses underscore, all others use hyphen | Worker 3 |
| P2-3 | 13 orphan project directories need pruning | Codex 4 |
| P2-4 | 6 AAM sessions missing state.json | Codex 4 |
| P2-5 | VERSION constant in types.ts manually duplicated from package.json | Codex 2 |
| P2-6 | "collect real-world usage data" stale loop in 5 consecutive journals | Worker 2 |
| P2-7 | Supabase sync gap: 8 write operations never reach Supabase | Codex 5 |

---

## Systemic Patterns

### 1. Filter Inconsistency (root cause of 3 bugs fixed today + 3 found)
40+ `readdirSync` sites across the codebase, each with a different set of filters. No shared `isJournalFile()` function. Some exclude `-log.`, some don't. Some exclude `--capture--`, some don't. Some exclude weekly rollups, some don't.
**Systemic fix:** Single `isJournalFile(filename)` filter in `helpers/journal-files.ts`, used everywhere.

### 2. Silent Failure Pervasiveness
Fire-and-forget Supabase sync, `catch {}` blocks in session_end, `2>/dev/null || true` in hooks. Agents receive success signals when operations partially failed.
**Systemic fix:** "Fail loud" policy — every catch block must surface a structured warning.

### 3. Naming Fragmentation
6 slug sanitizer functions, no canonical normalize. Projects exist under multiple slugs. Legacy names persist alongside current names.
**Systemic fix:** Single `normalizeSlug()` + migration to merge legacy slugs.

### 4. Supabase Sync Gaps
Only `memories` table is reliably synced. `awareness-state.json`, corrections, knowledge_write, journal_capture, dream reports — none reach Supabase. Session start hook reads stale data.
**Systemic fix:** Sync-or-log policy — every local write either syncs or logs the skip.

### 5. Module-Level Singleton Leakage
`ownedFiles` accumulates across MCP process lifetime. 4 other singletons found (cached clients, providers). Long-running processes drift from correct behavior.
**Systemic fix:** Session-boundary reset for any accumulating state.

---

## Priority Execution Order

| Wave | Items | Theme | Estimated Effort |
|------|-------|-------|-----------------|
| Wave 1 | P0-4, P0-7, P0-8, P1-5, P1-11 | Quick fixes — filter bugs, stale docs, phantom refs | 1-2 hours |
| Wave 2 | P0-1, P0-2, P0-5, P1-10, P1-6 | Structural — shared isJournalFile(), normalizeSlug(), resetOwnedFiles() | 3-4 hours |
| Wave 3 | P0-3, P0-6, P1-1, P1-2, P1-3 | Deep — agent_instruction retrofit, Supabase sync, filelock expansion | 6-8 hours |
| Wave 4 | P1-4, P1-7, P1-8, P1-9, P1-12, P1-13 | UX polish — tool descriptions, session start hook, format migration | 4-6 hours |
| Wave 5 | P2-* | Cleanup — orphans, duplicates, stale loops | 1-2 hours |

---

## Audit Methodology

10 parallel workers audited the same codebase from 5 independent dimensions:

| Worker | Type | Dimension | Files Read | Findings |
|--------|------|-----------|-----------|----------|
| Worker 1 | Claude | Agent-First UX | 16 source files | 5 (2 P0, 3 P1) |
| Worker 2 | Claude | Contradiction | 30+ memory/journal files | 5 (2 P0, 2 P1, 1 P2) |
| Worker 3 | Claude | Naming System | 15 source + runtime files | 5 (2 P0, 2 P1, 1 P2) |
| Worker 4 | Claude | Folder Structure | 12 source files + filesystem | 6 (2 P0, 3 P1, 1 P2) |
| Worker 5 | Claude | Cross-System Sync | 9 source + 3 scripts | 5 (2 P0, 2 P1, 1 P2) |
| Codex 2 | Codex | Contradiction (code) | grep across all .ts | 40+ readdirSync sites, 12 unlocked RMW |
| Codex 3 | Codex | Naming (code) | grep + ls across all systems | 6 sanitizer functions, format distribution |
| Codex 4 | Codex | Folders (code) | 40+ readdirSync sites mapped | 13 orphan dirs, 6 orphan sessions |
| Codex 5 | Codex | Cross-sync (code) | sync scripts + all .ts | 5 singletons, 8 sync gaps, lock coverage map |
| Codex 1 | Codex | Agent-UX (code) | (sandbox limited) | Covered by Worker 1 |

**Cross-worker confirmation:** 6 findings were independently discovered by 2+ workers, increasing confidence. The `session-start.ts` filter bug was found by Workers 4, Codex 2, and Codex 4 independently.
