/**
 * Journal file listing, reading, and index maintenance.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { journalDir, journalDirs } from "../storage/paths.js";
import { ensureDir } from "../storage/fs-utils.js";
import type { JournalEntry } from "../types.js";

/**
 * List all .md journal files across all directories for a project.
 * Returns sorted array with most recent first.
 */
export function listJournalFiles(project: string): JournalEntry[] {
  const dirs = journalDirs(project);
  const entries: JournalEntry[] = [];
  const seen = new Set<string>();

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        entries.push({ date: match[1], file, dir });
      }
    }
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

/**
 * Read a journal file. Checks primary dir first, then legacy.
 */
export function readJournalFile(project: string, date: string): string | null {
  const filename = `${date}.md`;
  const dirs = journalDirs(project);
  const primaryDir = journalDir(project);
  const allDirs = [primaryDir, ...dirs.filter((d) => d !== primaryDir)];

  for (const dir of allDirs) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  }
  return null;
}

/**
 * Extract title from journal file content.
 */
export function extractTitle(content: string): string {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : "(untitled)";
}

/**
 * Extract momentum indicator from journal content.
 */
export function extractMomentum(content: string): string {
  const patterns = [/[🟢🟡🔴⚪]\s*\S+/];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[0];
  }
  return "";
}

/**
 * Count entries in a log file (for journal_capture entry numbering).
 */
export function countLogEntries(logPath: string): number {
  if (!fs.existsSync(logPath)) return 0;
  const content = fs.readFileSync(logPath, "utf-8");
  const matches = content.match(/^### Q\d+/gm);
  return matches ? matches.length : 0;
}

/**
 * Update the index.md for a project.
 */
export function updateIndex(project: string): void {
  const dir = journalDir(project);
  ensureDir(dir);
  const indexPath = path.join(dir, "index.md");

  const entries = listJournalFiles(project);

  let index = `# ${project} — Journal Index\n\n`;
  index += `> Auto-generated. ${entries.length} entries.\n\n`;
  index += `| Date | Title | Momentum |\n`;
  index += `|------|-------|----------|\n`;

  for (const entry of entries) {
    const content = fs.readFileSync(
      path.join(entry.dir, entry.file),
      "utf-8"
    );
    const title = extractTitle(content);
    const momentum = extractMomentum(content);
    index += `| ${entry.date} | ${title} | ${momentum} |\n`;
  }

  fs.writeFileSync(indexPath, index, "utf-8");
}
