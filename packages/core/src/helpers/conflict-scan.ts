/**
 * Conflict scanner — detects contradictions between new content and existing memories.
 *
 * Called by smart-remember before saving. Surfaces value token mismatches:
 *   - Version numbers (semver: \d+\.\d+\.\d+)
 *   - Status words (blocked/done/complete/deployed/broken/failed/pending/active)
 *   - Key-value pairs ("key: value", "key is value", "key = value")
 *
 * Never blocks saves — wrapped in try/catch at call sites.
 * Only runs when content.length > 20.
 */

import { smartRecall } from "../tools-logic/smart-recall.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConflictMatch {
  existingId: string;
  existingTitle: string;
  existingExcerpt: string;
  existingDate: string;
  conflictingValues: { existing: string; incoming: string }[];
}

export interface ConflictScanResult {
  hasConflict: boolean;
  matches: ConflictMatch[];
}

// ---------------------------------------------------------------------------
// Token extractors
// ---------------------------------------------------------------------------

/** Extract semver-style version tokens: "1.2.3", "v1.2.3", "version 1.2.3" */
export function extractVersionTokens(text: string): Map<string, string> {
  const result = new Map<string, string>();
  // Capture the word/context before the version number as the key
  const pattern = /(\w[\w.-]{0,30})\s*(?:v|@|version\s+)?(\d+\.\d+\.\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const key = m[1].toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (key.length > 0) {
      result.set(key, m[2]);
    }
  }
  return result;
}

/** Canonical status category for a word, or null. */
const STATUS_WORD_MAP: Record<string, string> = {
  blocked: "blocked", suspended: "blocked", paused: "blocked", waiting: "blocked", stuck: "blocked",
  done: "done", complete: "done", completed: "done", finished: "done",
  deployed: "active", live: "active", running: "active", active: "active", published: "active", shipped: "active",
  broken: "broken", failed: "broken", failing: "broken", down: "broken",
  pending: "pending",
};

/** Return [statusWord, category] pairs found in text. */
export function extractStatusTokens(text: string): Map<string, string> {
  const result = new Map<string, string>();
  const lower = text.toLowerCase();
  for (const [word, category] of Object.entries(STATUS_WORD_MAP)) {
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(lower)) {
      result.set(word, category);
    }
  }
  return result;
}

/**
 * Extract key-value pairs from patterns like:
 *   "status: blocked", "version is 3.4.1", "env = production"
 * Returns a Map<normalised_key, value>.
 */
export function extractKVTokens(text: string): Map<string, string> {
  const result = new Map<string, string>();

  // "key: value" or "key = value"
  const colonEq = /\b([\w][\w -]{0,30})\s*[:=]\s*([^\s,;.!?\n]{1,50})/g;
  let m: RegExpExecArray | null;
  while ((m = colonEq.exec(text)) !== null) {
    const k = m[1].trim().toLowerCase().replace(/\s+/g, "_");
    const v = m[2].trim().toLowerCase();
    if (k.length > 1 && v.length > 0) {
      result.set(k, v);
    }
  }

  // "key is value"
  const isPattern = /\b([\w][\w -]{0,30})\s+is\s+([^\s,;.!?\n]{1,50})/g;
  while ((m = isPattern.exec(text)) !== null) {
    const k = m[1].trim().toLowerCase().replace(/\s+/g, "_");
    const v = m[2].trim().toLowerCase();
    if (k.length > 1 && v.length > 0 && !result.has(k)) {
      result.set(k, v);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Scan existing memories for conflicts with newContent.
 *
 * Uses smartRecall to find related memories (limit 5), then compares
 * version tokens, status tokens, and key-value tokens.
 *
 * Returns hasConflict=false immediately if content is too short or recall fails.
 */
export async function scanForConflicts(
  newContent: string,
  project: string | undefined
): Promise<ConflictScanResult> {
  const empty: ConflictScanResult = { hasConflict: false, matches: [] };

  if (newContent.length <= 20) return empty;

  // Recall related memories
  let recallResult;
  try {
    recallResult = await smartRecall({ query: newContent, project, limit: 5 });
  } catch {
    return empty;
  }

  if (!recallResult.results || recallResult.results.length === 0) return empty;

  // Extract tokens from new content once
  const newVersions = extractVersionTokens(newContent);
  const newStatuses = extractStatusTokens(newContent);
  const newKV = extractKVTokens(newContent);

  const matches: ConflictMatch[] = [];

  for (const r of recallResult.results) {
    if (r.score < 0.05) continue;

    const existingText = `${r.title} ${r.excerpt}`;
    const conflictingValues: { existing: string; incoming: string }[] = [];

    // 1. Version token conflicts
    if (newVersions.size > 0) {
      const existingVersions = extractVersionTokens(existingText);
      for (const [key, newVer] of newVersions) {
        const existingVer = existingVersions.get(key);
        if (existingVer && existingVer !== newVer) {
          conflictingValues.push({
            existing: `${key} is ${existingVer}`,
            incoming: `${key} is ${newVer}`,
          });
        }
      }
    }

    // 2. Status token conflicts — compare categories, not raw words
    if (newStatuses.size > 0) {
      const existingStatuses = extractStatusTokens(existingText);
      // Collect unique categories from each side
      const newCategories = new Set(newStatuses.values());
      const existingCategories = new Set(existingStatuses.values());
      for (const cat of existingCategories) {
        if (!newCategories.has(cat)) {
          // Find a representative word from each side
          const exWord = [...existingStatuses.entries()].find(([, c]) => c === cat)?.[0] ?? cat;
          const newCat = [...newCategories][0];
          if (newCat) {
            const newWord = [...newStatuses.entries()].find(([, c]) => c === newCat)?.[0] ?? newCat;
            conflictingValues.push({
              existing: `status is ${exWord}`,
              incoming: `status is ${newWord}`,
            });
          }
        }
      }
    }

    // 3. Key-value token conflicts
    if (newKV.size > 0) {
      const existingKV = extractKVTokens(existingText);
      for (const [key, newVal] of newKV) {
        const existingVal = existingKV.get(key);
        if (existingVal && existingVal !== newVal) {
          conflictingValues.push({
            existing: `${key} is ${existingVal}`,
            incoming: `${key} is ${newVal}`,
          });
        }
      }
    }

    if (conflictingValues.length > 0) {
      matches.push({
        existingId: r.id,
        existingTitle: r.title,
        existingExcerpt: r.excerpt.slice(0, 120),
        existingDate: r.date ?? "unknown",
        conflictingValues,
      });
    }
  }

  return {
    hasConflict: matches.length > 0,
    matches,
  };
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Format conflict matches into a human-readable warning string.
 * Example: "⚠ Possible conflict: [novada-proxy] existing says 'version is 0.8.0' (2026-05-09), you're saving 'version is 0.7.4'. New saved as current."
 */
export function formatConflictWarning(
  matches: ConflictMatch[],
  project: string | undefined
): string {
  const projectLabel = project ? `[${project}] ` : "";
  const lines: string[] = [];

  for (const match of matches) {
    for (const cv of match.conflictingValues) {
      const dateLabel = match.existingDate !== "unknown" ? ` (${match.existingDate})` : "";
      lines.push(
        `⚠ Possible conflict: ${projectLabel}existing says '${cv.existing}'${dateLabel}, ` +
        `you're saving '${cv.incoming}'. New saved as current.`
      );
    }
  }

  return lines.join("\n");
}
