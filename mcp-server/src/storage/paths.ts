/**
 * Journal and palace directory path resolution.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { JOURNAL_ROOT, LEGACY_ROOT } from "../types.js";

/**
 * Resolve the journal directory for a project.
 * For writes, always use the new location.
 */
export function journalDir(project: string): string {
  const safe = project.replace(/[^a-zA-Z0-9_\-\.]/g, "-");
  const resolved = path.join(JOURNAL_ROOT, "projects", safe, "journal");
  if (!resolved.startsWith(JOURNAL_ROOT)) {
    throw new Error(`Invalid project name: ${project}`);
  }
  return resolved;
}

/**
 * Find all journal directories for a project (new + legacy fallback).
 */
export function journalDirs(project: string): string[] {
  const dirs: string[] = [];
  const primary = journalDir(project);
  if (fs.existsSync(primary)) dirs.push(primary);

  // Legacy: ~/.claude/projects/*/memory/journal/
  if (fs.existsSync(LEGACY_ROOT)) {
    try {
      const entries = fs.readdirSync(LEGACY_ROOT);
      for (const entry of entries) {
        if (entry.includes(project)) {
          const legacyJournal = path.join(
            LEGACY_ROOT,
            entry,
            "memory",
            "journal"
          );
          if (fs.existsSync(legacyJournal)) {
            dirs.push(legacyJournal);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return dirs;
}

/**
 * Resolve the palace directory for a project.
 */
export function palaceDir(project: string): string {
  const safe = project.replace(/[^a-zA-Z0-9_\-\.]/g, "-");
  return path.join(JOURNAL_ROOT, "projects", safe, "palace");
}

/**
 * Resolve a room directory within a project's palace.
 */
export function roomDir(project: string, roomSlug: string): string {
  return path.join(palaceDir(project), "rooms", roomSlug);
}
