# AgentRecall v3.4.7 — Security Audit Summary

**Release date:** 2026-05-08
**Patch commit:** `fed3ded` (fix) + `1d9d9b9` (version bump)
**Disclosure source:** Harout Parseghian (`github.com/haroutp`) — responsible disclosure
**Severity scope:** 21 security issues + 19 consistency issues across 24 files

---

## Background

On or before 2026-05-08, Harout Parseghian conducted an independent security review of AgentRecall's MCP tool surface and submitted a responsible disclosure. The primary finding was that the `journal_read` tool accepted a raw `z.string()` date parameter without format constraints, allowing unsanitized input to flow into `path.join()` calls in `readJournalFile()`. A crafted date value (e.g., `"../../etc/passwd"`) could traverse outside the project's journal directory.

A broader audit triggered by this disclosure found additional attack surfaces: regex injection via `new RegExp(date)` in file-listing logic, prototype pollution via unrestricted `Object.assign`-style merges in `journal_state`, insufficient path boundary checks in palace rooms and corrections storage, and an overly permissive `bootstrap_scan` that would follow caller-supplied `scan_dirs` outside the user's home directory.

The v3.4.7 patch addresses all identified issues across both the MCP schema layer and the core logic layer, following a defense-in-depth approach.

---

## Findings

| # | Severity | Issue | File(s) | Fix Applied |
|---|----------|-------|---------|-------------|
| 1 | **CRITICAL** | Path traversal via unsanitized `date` param in `journal_read` — raw `z.string()` flowed into `path.join` and `new RegExp(date)` | `packages/mcp-server/src/tools/journal-read.ts`, `packages/core/src/helpers/journal-files.ts` | Added `.regex(/^(\d{4}-\d{2}-\d{2}\|latest)$/)` constraint at MCP schema layer; added `if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null` at core entry; replaced `new RegExp(date)` with safe `startsWith()` + static regex |
| 2 | **CRITICAL** | Regex injection — `new RegExp(date)` constructed from caller input in `readJournalFile()` | `packages/core/src/helpers/journal-files.ts` | Replaced all dynamic regex construction with `f.startsWith(date + "-")` + `/^[a-f0-9]{6}\.md$/` static test for session suffix |
| 3 | **HIGH** | Path traversal via slug parameters — room, topic, palace_room params passed unsanitized to `path.join` in palace read/write | `packages/core/src/tools-logic/palace-read.ts`, `packages/core/src/tools-logic/palace-write.ts` | All slug/topic values now pass through `sanitizeSlug()` before any `path.join` call |
| 4 | **HIGH** | Path traversal via `category` param in `alignment_check` — value flowed into palace file path | `packages/core/src/tools-logic/alignment-check.ts` | Added `VALID_CATEGORIES` enum set; core entry now rejects any value not in the set before `path.join` |
| 5 | **HIGH** | Path boundary not checked in `correctionsDir()` and `alignmentLogPath()` | `packages/core/src/storage/corrections.ts`, `packages/core/src/helpers/alignment-patterns.ts` | Added `if (!resolved.startsWith(root)) throw` boundary check in both functions, matching the existing pattern in `paths.ts` |
| 6 | **HIGH** | Slug sanitization was performed ad-hoc at individual call sites with no central enforcement — dots could survive inline handling and enable `..` traversal | `packages/core/src/storage/paths.ts` | Added `sanitizeSlug()` as a new centralized function using pattern `[^a-zA-Z0-9_\-]` (dots excluded); an adversarial audit pass found the initial version of this new function still permitted dots and it was corrected before release; empty-string guard returns `"unnamed"`; length capped at 100 characters |
| 7 | **HIGH** | Fan-out connections passed to `path.join` without sanitization | `packages/core/src/palace/fan-out.ts` | All wikilink targets and explicit connection slugs now pass through `sanitizeSlug()` before being used in `path.join` |
| 8 | **MEDIUM** | Prototype pollution in `journal_state` write path — arbitrary JSON object merged into session state with no key filtering | `packages/core/src/tools-logic/journal-state.ts` | Added `safeAssign()` with `DANGEROUS_KEYS = Set(["__proto__", "constructor", "prototype"])`; arrays capped at 100 items in / 500 items stored |
| 9 | **MEDIUM** | `bootstrap_scan` accepted arbitrary `scan_dirs` — could be used to exfiltrate files from outside `$HOME` | `packages/core/src/tools-logic/bootstrap.ts`, `packages/mcp-server/src/tools/bootstrap.ts` | `scan_dirs` values now filtered to `d.startsWith(home)` before use; `max_depth` capped at 5; `source_path` validated against `home` prefix before any file read |
| 10 | **LOW** | SSH private key patterns missing from secret detection in bootstrap | `packages/core/src/tools-logic/bootstrap.ts` | Added `id_rsa`, `id_ed25519`, `id_ecdsa`, `authorized_keys`, `.pub` to `SECRET_PATTERNS` array |
| 11 | **LOW** | `computeDecisionCalibration()` lacked path boundary check on `decisionsDir` | `packages/core/src/helpers/alignment-patterns.ts` | Added `if (!decisionsDir.startsWith(root)) return []` guard |

---

## Defense in Depth

Security fixes were applied at two independent layers so that a bypass at one layer is blocked by the other.

**MCP Schema Layer (outer boundary)**
- `journal_read`: `date` constrained to `.regex(/^(\d{4}-\d{2}-\d{2}|latest)$/)` — rejects any non-date string before it enters core logic.
- `bootstrap_scan`: MCP schema was reviewed; core-side filtering provides the boundary guard.
- All enum parameters (e.g., `section`, `action`) remain typed Zod enums — these were already safe.

**Core Logic Layer (inner boundary)**
- `readJournalFile()`: explicit `if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null` guard at function entry, independent of what the MCP layer passed.
- `sanitizeSlug()`: centralised in `packages/core/src/storage/paths.ts`; strips dots, separators, and non-alphanumeric characters; enforces 100-char max; called before every `path.join` on user-supplied slugs.
- `correctionsDir()`, `alignmentLogPath()`, `journalDir()`, `palaceDir()`, `roomDir()`, `digestDir()`: all now include `if (!resolved.startsWith(root)) throw` boundary checks.
- `safeAssign()` in `journal-state.ts`: blocks `__proto__`, `constructor`, and `prototype` key injection at merge time.
- Bootstrap import path: `item.source_path.startsWith(home)` validated before any `fs.readFileSync`.

This layered approach means an attacker who somehow bypasses Zod validation still hits the core-layer guard.

---

## Verification

After applying fixes, the following adversarial tests were run against the patched build:

1. **Path traversal via date** — Passed `"../../etc/passwd"` as `date` to `journal_read`. MCP schema rejected with Zod validation error before reaching core. Direct core call returned `null` (regex guard). No file read occurred.

2. **Regex injection via date** — Passed `"2026-01-01(.*)"` as date. MCP schema rejected (regex constraint). Core function matched zero files because `startsWith()` literal comparison does not interpret regex metacharacters.

3. **Slug with `..` component** — Passed `"../../../etc"` as room slug. `sanitizeSlug()` transformed to `"----------etc"` (all non-alphanumeric except `_-` replaced by `-`); dots eliminated. Resulting `path.join` resolved inside palace directory.

4. **Prototype pollution** — Passed `{"__proto__": {"isAdmin": true}}` as JSON data to `journal_state` write. `safeAssign()` skipped the `__proto__` key. `({}).isAdmin` remained `undefined`.

5. **Bootstrap escape** — Called `bootstrap_scan` with `scan_dirs: ["/etc"]`. The filter `d.startsWith(home)` removed `/etc` from the effective scan list. No files outside `$HOME` were read.

6. **SSH key detection** — Created a test file named `id_rsa` in a temp project directory. Bootstrap correctly classified it as a secret and excluded it from importable items.

Build: clean (`tsc` + `eslint` — no regressions). Existing test suite: all passing. No room-slug regressions on existing valid slugs (alphanumeric + underscore + hyphen).

---

## Credit

**Harout Parseghian** (`github.com/haroutp`) identified the initial path traversal and regex injection vulnerabilities in `journal_read` through responsible disclosure. This disclosure triggered a broader security audit that surfaced the remaining 19 issues fixed in this patch.

Responsible disclosure was handled professionally: findings were reported directly to the maintainer, not published publicly before a fix was available. The AgentRecall project thanks Harout for the thorough and responsible report.
