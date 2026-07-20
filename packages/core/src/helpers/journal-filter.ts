/**
 * Returns true if a filename is a "real" journal entry (not a capture log,
 * weekly rollup, index, or merged file). Use this everywhere readdirSync
 * scans journal directories.
 *
 * W2-2 (naming-v2 spec §4, 2026-07-20): also excludes any underscore-prefixed
 * file (`_index.md` and any future materialized-index/marker file). Without
 * this, the new `journal/_index.md` machine fast-path would itself be counted
 * as a journal entry by every consumer of this filter — reproducing the
 * exact v3.4.26 "inflated session count" bug class. Verified call sites:
 *   - tools-logic/session-start.ts (session/resume counting) — already safe
 *     by construction (each loop also requires a leading YYYY-MM-DD date
 *     match before counting, and "_index.md" never matches that), but the
 *     underscore guard is added here too as the single source of truth.
 *   - tools-logic/project-board.ts — NOT independently safe: it takes
 *     `files[0]` after `.sort().reverse()` with NO secondary date-match
 *     check. Since "_" (0x5F) sorts AFTER any digit, an un-excluded
 *     "_index.md" would become `files[0]` post-reverse, its date-match would
 *     fail, and the project would be silently DROPPED from the board — a
 *     worse regression than miscounting. This guard is the actual fix for
 *     that path (see regression test in materialized-indexes.test.mjs).
 *   - tools-logic/recognition-builder.ts — safe by construction (same
 *     per-item date-match pattern as session-start.ts) but covered anyway.
 *   - storage/project.ts's own local `isJournalFile` copy already requires a
 *     leading date match (`/^\d{4}-\d{2}-\d{2}/.test(f)`), so it is
 *     independently safe and was intentionally left unchanged.
 */
export function isJournalFile(filename: string): boolean {
  return (
    filename.endsWith(".md") &&
    filename !== "index.md" &&
    !filename.startsWith("_") &&
    !filename.includes("-log.") &&
    !filename.includes("--capture--") &&
    !filename.endsWith(".merged.md") &&
    !/^\d{4}-W\d+/.test(filename)
  );
}
