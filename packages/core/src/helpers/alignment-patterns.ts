/**
 * Shared alignment pattern detection — used by both check.ts and session-start.ts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getRoot } from "../types.js";
import { extractKeywords } from "./auto-name.js";

export interface AlignmentRecord {
  date: string;
  goal: string;
  confidence: string;
  assumptions: string[];
  corrections?: string[];
  delta?: string;
}

export interface WatchForPattern {
  pattern: string;
  frequency: number;
  suggestion: string;
}

export function readAlignmentLog(project: string): AlignmentRecord[] {
  const p = path.join(getRoot(), "projects", project, "alignment-log.json");
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return []; }
}

/**
 * Extract a clean, actionable rule from raw correction text.
 * Raw: 'Was: "Adding CSS classes" | Correction: "no don't use black backgrounds"'
 * Clean: "Don't use black backgrounds"
 */
function cleanRule(raw: string): string {
  // Try to extract the "Correction:" part from delta format
  const corrMatch = raw.match(/Correction:\s*"?([^"|]+)/i);
  if (corrMatch) {
    return capitalizeFirst(corrMatch[1].trim().slice(0, 80));
  }

  // Try to extract "Human correction:" from check format
  const humanMatch = raw.match(/Human correction:\s*"?([^"|]+)/i);
  if (humanMatch) {
    return capitalizeFirst(humanMatch[1].trim().slice(0, 80));
  }

  // Strip "Was: ..." prefix if present
  const wasStripped = raw.replace(/^Was:\s*"[^"]*"\s*\|\s*/i, "").trim();
  if (wasStripped.length > 5 && wasStripped !== raw) {
    return capitalizeFirst(wasStripped.slice(0, 80));
  }

  // Fallback: use first sentence, cleaned up
  const firstSentence = raw.split(/[.!?\n]/)[0]?.trim() ?? raw;
  return capitalizeFirst(firstSentence.slice(0, 80));
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function extractWatchPatterns(records: AlignmentRecord[], limit: number = 3): WatchForPattern[] {
  const correctionCounts = new Map<string, { count: number; rules: string[] }>();

  for (const past of records) {
    // Prefer human_correction (direct), fall back to delta (may have Was:/Correction: format)
    const corrections = [...(past.corrections ?? [])];
    if (past.delta) corrections.push(past.delta);
    for (const c of corrections) {
      const cKeywords = extractKeywords(c, 2);
      const key = cKeywords.join("-") || "general";
      const entry = correctionCounts.get(key) ?? { count: 0, rules: [] };
      entry.count++;
      if (entry.rules.length < 2) entry.rules.push(cleanRule(c));
      correctionCounts.set(key, entry);
    }
  }

  const patterns: WatchForPattern[] = [];
  for (const [, { count, rules }] of correctionCounts) {
    // P0 corrections (never/always/don't) surface after 1 occurrence; others need 2
    const isP0 = /\bnever\b|\balways\b|\bdon'?t\b|\bno\b.*\bshould\b/i.test(rules[0]);
    if (count >= 2 || (count >= 1 && isP0)) {
      patterns.push({
        pattern: rules[0],
        frequency: count,
        suggestion: count === 1
          ? `P0 correction — follow this rule strictly`
          : `Corrected ${count} times — review your approach before proceeding`,
      });
    }
  }

  return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, limit);
}
