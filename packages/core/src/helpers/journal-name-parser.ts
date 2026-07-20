/**
 * Parse journal filenames across all generations:
 *   Legacy:    YYYY-MM-DD.md  (or YYYY-MM-DD-sessionid.md)
 *   Old:       YYYY-MM-DD--type--NL--slug.md  (has {n}L part)
 *   Current:   YYYY-MM-DD--type--sig--theme--slug.md  (fixed 5 parts)
 *   v2:        YYYY-MM-DD--type--[sig]--[theme]--slug.md  (naming-v2 spec §3 —
 *              null sig/theme OMITTED rather than printed as "none", so the
 *              part count varies 3-5; middle segments are classified by ENUM
 *              MEMBERSHIP against SIGNIFICANCE_TAGS/THEME_TAGS, not position,
 *              since a 4-part name is otherwise ambiguous between sig-only
 *              and theme-only).
 *
 * Cross-generation discrimination is purely structural (no in-name version
 * sentinel — see spec §3 "journal parsing note"): a well-formed v2 name that
 * happens to have BOTH sig and theme present is structurally identical to a
 * "current" 5-part name and is parsed by that same branch, byte-identically.
 */

import { SIGNIFICANCE_TAGS, THEME_TAGS } from "./journal-sig-theme.js";

const SIG_SET = new Set<string>(SIGNIFICANCE_TAGS);
const THEME_SET = new Set<string>(THEME_TAGS);

/**
 * v2 save-type anchors (naming-v2 spec §3 journal row). Deliberately
 * duplicated rather than imported from storage/session.ts's `SaveType` union
 * — helpers/ sits below storage/ in the module layering (session.ts already
 * imports FROM helpers/), so importing the other direction here would invert
 * that. storage/session.ts is the source of truth if this list ever grows.
 */
const SAVE_TYPE_SET = new Set([
  "arsave", "arsaveall", "hook-end", "hook-correction", "capture", "hook-archive",
]);

export interface ParsedJournalName {
  date: string;
  saveType: string | null;
  sig: string | null;
  theme: string | null;
  slug: string | null;
  isLegacy: boolean;
}

export function parseJournalFileName(filename: string): ParsedJournalName {
  // Strip directory prefix if present
  const base = filename.split("/").pop()?.replace(/\.md$/, "") ?? filename.replace(/\.md$/, "");

  // Legacy: YYYY-MM-DD (with optional -sessionid suffix, no double-dashes)
  if (/^\d{4}-\d{2}-\d{2}(-[a-f0-9]+)?$/.test(base)) {
    return { date: base.slice(0, 10), saveType: null, sig: null, theme: null, slug: null, isLegacy: true };
  }

  const parts = base.split("--");

  // Must start with a date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    return { date: "", saveType: null, sig: null, theme: null, slug: null, isLegacy: true };
  }

  const date = parts[0];

  // Old format: date--type--NL--slug (part[2] matches /^\d+L$/)
  if (parts.length === 4 && /^\d+L$/.test(parts[2])) {
    return { date, saveType: parts[1], sig: null, theme: null, slug: parts[3], isLegacy: true };
  }

  // v2: date--type--[sig]--[theme]--slug, 3 or 4 parts, sig/theme omitted
  // when absent. seg[1] must be a known SaveType to anchor this branch
  // (distinguishes a v2 write from an unrelated dashed slug that happens to
  // have 3-4 "--" separated parts). A 4-part name's lone middle segment is
  // classified by enum membership: sig if it's a SignificanceTag, theme if
  // it's a ThemeTag. An unrecognized middle segment fails closed (both null)
  // rather than guessing.
  if ((parts.length === 3 || parts.length === 4) && SAVE_TYPE_SET.has(parts[1])) {
    const slug = parts[parts.length - 1];
    let sig: string | null = null;
    let theme: string | null = null;
    if (parts.length === 4) {
      const middle = parts[2];
      if (SIG_SET.has(middle)) sig = middle;
      else if (THEME_SET.has(middle)) theme = middle;
    }
    return { date, saveType: parts[1], sig, theme, slug, isLegacy: false };
  }

  // New format: date--type--sig--theme--slug (5 parts)
  if (parts.length === 5) {
    return { date, saveType: parts[1], sig: parts[2], theme: parts[3], slug: parts[4], isLegacy: false };
  }

  // Anything else: treat as legacy
  return { date, saveType: parts[1] ?? null, sig: null, theme: null, slug: parts[parts.length - 1] ?? null, isLegacy: true };
}
