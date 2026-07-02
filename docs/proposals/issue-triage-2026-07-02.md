# Issue Triage — 2026-07-02

Repo: Goldentrii/AgentRecall-MCP. 4 open issues fetched. Cross-referenced against UPDATE-LOG.md and current package versions (v3.4.35).

---

## Summary counts

| Category | Count |
|---|---|
| BUG — still open | 2 |
| FEATURE / QUESTION | 1 |
| ALREADY-FIXED | 1 |
| STALE-CLOSE-CANDIDATE | 0 |

---

## Issue table

| # | Title | Category | Priority | Notes |
|---|---|---|---|---|
| 26 | agent-recall-mcp@3.4.21 fails to start via npx: command not found | **BUG — still open** | P0 | `mcp-server/package.json` build script is bare `tsc`, no `chmod +x`. CLI fixed this (see cli package.json `"build": "tsc && chmod +x dist/index.js"`) but mcp-server never got the matching fix. Shebang is present; executable bit is the gap. Affects every `npx` invocation on npm packages built before the bit is set at publish time. Current v3.4.35 has the same bug. |
| 6 | Use real journal filtering in session_end scans | **BUG — still open** | P1 | `session-end.ts` lines 205, 443, 488 use `.filter(f => f.endsWith(".md") && f !== "index.md")` instead of `isJournalFile()`. The helper is exported from core barrel; all other journal scanners (`session-start.ts`, `project-board.ts`, `recognition-builder.ts`) already use it. Capture logs and weekly rollups inflate same-day duplicate detection and save-card counts. PR offer from reporter (zhuhaoxiang1) is reasonable to accept. |
| 4 | Fix stale GitHub links pointing to old AgentRecall repo | **ALREADY-FIXED** | — | Package metadata URLs fixed 2026-07-02 (this session). README and Claude command install snippets may still have raw.githubusercontent.com/Goldentrii/AgentRecall paths — verify and close once confirmed. |
| 1 | Compounding memory + correction capture — question on the reflect loop boundary | **QUESTION** | — | Technical question from a peer builder comparing hook-interception vs self-report. No action item; warrants a thoughtful reply explaining the hook-correction design. Not a bug or feature request. |

---

## Response drafts

### #26 — BUG: npx command not found (P0, answer first)

> Thanks for the detailed repro. Root cause confirmed: the `mcp-server` build script is bare `tsc` — it doesn't run `chmod +x dist/index.js` after compile, so the binary bit is never set when npm packs the dist. The CLI package has the fix; the MCP server package missed it. Fix is a one-line change to `packages/mcp-server/package.json`'s build script (`tsc && chmod +x dist/index.js`). Will land in the next patch. In the meantime the `@3.4.13` workaround you found is correct.

---

### #6 — BUG: session_end journal filtering (P1, answer second)

> Confirmed. `session-end.ts` uses a raw `.endsWith(".md")` filter in three places while every other journal scanner in the codebase already uses `isJournalFile()` from the core barrel. Happy to accept a PR that threads `isJournalFile` through those three call sites and adds the regression test you described. One note: make sure the PR also covers the save-card count path at line 488 — that's the most user-visible symptom (inflated session counts in the board).

---

### #4 — ALREADY-FIXED: stale repo URLs

> Package metadata URLs were updated to `Goldentrii/AgentRecall-MCP` as of v3.4.35. If you spot any remaining raw.githubusercontent.com install snippets in the README please let us know which lines — we'll sweep those in the same pass. Closing this issue; feel free to reopen if you find missed spots.

---

### #1 — QUESTION: reflect loop boundary

> Good question. `hook-correction` runs at the harness level on every `UserPromptSubmit` event — it reads the user's message, matches behavioral-frequency signals ("again", "keep", "every time"), and writes a correction record without any agent involvement. There's no self-report step; the agent never decides whether a correction is worth saving. Your 30% silent-skip observation matches exactly why we went this route. The trade-off is false-positive rate at the classifier level rather than false-negative rate at the agent-discretion level — the classifier now requires frequency words before writing, which cuts noise significantly. Different boundary than hook-interception but similar motivation.

---

## Top 3 to answer first

1. **#26** — affects every Codex/external user on any version after 3.4.13; P0 regression with a clear one-line fix.
2. **#6** — a clean, narrow bug with a PR offer attached; low-risk to accept and closes a real data-quality issue.
3. **#1** — no urgency but a peer builder with public credibility ("Show HN Tuesday"); a short, honest technical reply is worth the 5 minutes.
