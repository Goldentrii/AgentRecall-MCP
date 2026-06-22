/**
 * display/board-render.ts — terminal rendering for the project status board.
 *
 * PURE: input only; NO Supabase, NO fs writes, NO network.
 * Port of render_board() + _cw()/_fit() + render_dream_banner() from
 * ~/.claude/scripts/ar-sync-status.py.
 *
 * CJK display-width is the main porting risk (Python unicodedata vs JS).
 * We use Unicode East-Asian-width range tables directly — no npm dep needed.
 */

import type { ProjectBoardResult, ProjectEntry } from "../tools-logic/project-board.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DreamStatus {
  last_success: string | null;
  last_failed: string | null;
  fail_reason: string | null;
  fail_step: string | null;
  any_succeeded_today: boolean;
  failed_runs_today: number;
  last_success_date: string | null;
}

export interface RenderBoardOptions {
  /** Terminal width; clamped to [80, 110]. Default: 100. */
  boardWidth?: number;
  /** Dream health status. If omitted, dream banner is skipped. */
  dreamStatus?: DreamStatus | null;
  /** Today's date string YYYY-MM-DD. Default: today. */
  today?: string;
}

// ── CJK display-width helpers ─────────────────────────────────────────────────
//
// Python: unicodedata.east_asian_width(c) in ("W", "F") → 2 cols, else 1.
// JS has no built-in equivalent.  We check the same Unicode ranges:
//   Wide (W): U+1100–11FF, U+2E80–2EFF, U+2F00–2FDF, U+2FF0–2FFF,
//             U+3000–303F, U+3040–309F, U+30A0–30FF, U+3100–312F,
//             U+3130–318F, U+3190–319F, U+31A0–31BF, U+31C0–31EF,
//             U+31F0–31FF, U+3200–32FF, U+3300–33FF, U+3400–4DBF,
//             U+4E00–9FFF, U+A000–A48F, U+A490–A4CF, U+A960–A97F,
//             U+AC00–D7AF, U+D7B0–D7FF, U+F900–FAFF, U+FE10–FE1F,
//             U+FE30–FE4F, U+FE50–FE6F, U+FF00–FFEF,
//             U+1B000–1B0FF, U+1B100–1B12F, U+1F004, U+1F0CF,
//             U+1F200–1F2FF, U+20000–2A6DF, U+2A700–2CEAF,
//             U+2CEB0–2EBEF, U+2F800–2FA1F, U+30000–3134F
//   FullWidth (F): U+FF01–FF60, U+FFE0–FFE6

/**
 * Display columns for one Unicode code point.
 * East Asian Wide / Fullwidth glyphs take 2 columns; all others take 1.
 * Emoji in the status board icons (🚧🟢💤⭐🧠⚡) are Wide and return 2.
 */
export function charDisplayWidth(cp: number): 1 | 2 {
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) ||   // CJK Radicals, Kangxi, CJK symbols
    (cp >= 0x3040 && cp <= 0x33ff) ||   // Hiragana, Katakana, Bopomofo, CJK compat
    (cp >= 0x3400 && cp <= 0x4dbf) ||   // CJK Ext-A
    (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) ||   // Yi
    (cp >= 0xa960 && cp <= 0xa97f) ||   // Hangul Jamo Ext-A
    (cp >= 0xac00 && cp <= 0xd7ff) ||   // Hangul Syllables + Jamo Ext-B
    (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK Compatibility Ideographs
    (cp >= 0xfe10 && cp <= 0xfe6f) ||   // CJK Compat Forms, Small/Halfwidth
    (cp >= 0xff00 && cp <= 0xff60) ||   // Fullwidth Latin/symbols
    (cp >= 0xffe0 && cp <= 0xffe6) ||   // Fullwidth signs
    (cp >= 0x1b000 && cp <= 0x1b12f) || // Kana Supplement
    (cp >= 0x1f004 && cp <= 0x1f004) || // Mahjong tile
    (cp >= 0x1f0cf && cp <= 0x1f0cf) || // Playing card
    (cp >= 0x1f200 && cp <= 0x1f2ff) || // Enclosed Ideographic Supplement
    (cp >= 0x20000 && cp <= 0x2a6df) || // CJK Ext-B
    (cp >= 0x2a700 && cp <= 0x2ceaf) || // CJK Ext-C/D/E
    (cp >= 0x2ceb0 && cp <= 0x2ebef) || // CJK Ext-F
    (cp >= 0x2f800 && cp <= 0x2fa1f) || // CJK Compat Ideographs Supplement
    (cp >= 0x30000 && cp <= 0x3134f) || // CJK Ext-G
    // Common emoji / symbol blocks used in the board
    (cp >= 0x1f300 && cp <= 0x1f9ff) || // Misc Symbols, Emoticons, transport, etc.
    (cp >= 0x2600 && cp <= 0x27bf) ||   // Misc Symbols (⚡ U+26A1), Dingbats
    (cp >= 0x2b00 && cp <= 0x2bff)      // Misc Symbols and Arrows (⭐ U+2B50)
  ) {
    return 2;
  }
  return 1;
}

/** Display width of a string (CJK counts as 2). */
export function displayWidth(s: string): number {
  let w = 0;
  for (const char of s) {
    const cp = char.codePointAt(0) ?? 0;
    w += charDisplayWidth(cp);
  }
  return w;
}

/**
 * Trim string to a display-width budget.
 * Collapses whitespace, strips light markdown noise.
 * Appends '…' only when clipped (not when it fits exactly).
 *
 * Port of _fit() in ar-sync-status.py (lines 456–471).
 */
export function fitToWidth(s: string, limit: number): string {
  // Collapse whitespace / newlines to one line; strip markdown noise
  let cleaned = (s ?? "").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\*\*|__|`|^#+\s*/gm, "").trim();

  if (displayWidth(cleaned) <= limit) return cleaned;

  let out = "";
  let w = 0;
  for (const char of cleaned) {
    const cp = char.codePointAt(0) ?? 0;
    const cw = charDisplayWidth(cp);
    if (w + cw > limit - 1) break;
    out += char;
    w += cw;
  }
  return out + "…";
}

// ── Dream banner ──────────────────────────────────────────────────────────────

/**
 * Port of render_dream_banner() from ar-sync-status.py (lines 314–355).
 * Returns empty string when dream is healthy / no banner needed.
 */
export function renderDreamBanner(dream: DreamStatus, today: string): string {
  const { last_success, last_failed, fail_reason, fail_step, any_succeeded_today, last_success_date } = dream;
  const reason = fail_reason ?? "unknown error";

  if (!last_success && !last_failed) {
    return "\n  [!] DREAM — no runs recorded\n";
  }

  let stale = true;
  if (last_success_date) {
    try {
      const successDate = new Date(last_success_date);
      const todayDate = new Date(today);
      const diffMs = todayDate.getTime() - successDate.getTime();
      stale = diffMs > 86_400_000; // > 1 day
    } catch {
      // malformed date — treat as stale
    }
  }

  if (any_succeeded_today && !stale) {
    // Check if there's a failure that occurred AFTER today's last success
    if (last_failed && last_failed.slice(0, 10) === today) {
      if (last_failed > (last_success ?? "")) {
        const stepNote = fail_step ? ` (step: ${fail_step})` : "";
        return `\n  [!] DREAM FAILED — ${last_failed} — ${reason}${stepNote}\n`;
      }
    }
    return "";
  }

  if (last_failed) {
    const stepNote = fail_step ? ` (step: ${fail_step})` : "";
    let laterNote = "";
    if (any_succeeded_today || (last_success && last_success > last_failed)) {
      laterNote = " (later run succeeded)";
    }
    return `\n  [!] DREAM FAILED — ${last_failed} — ${reason}${stepNote}${laterNote}\n`;
  }

  if (stale) {
    const lastLabel = last_success ?? "never";
    return `\n  [!] DREAM STALE — last success: ${lastLabel}\n`;
  }

  return "";
}

// ── Main renderer ─────────────────────────────────────────────────────────────

const ICON: Record<string, string> = {
  blocked: "🚧",
  active: "🟢",
  stale: "💤",
  // NOTE: recommended-project highlight (⭐) not ported — depends on the recommendation computation that still lives in the Python layer (arstatus-cache.json). When porting it, add `recommended?: string` to RenderBoardOptions + a conditional icon-swap + a legend entry.
};

/**
 * Render a project status board string from structured data.
 *
 * PURE: no Supabase, no fs, no network.
 * Port of render_board() from ar-sync-status.py (lines 432–541).
 *
 * @param board  Result of projectBoard()
 * @param opts   Optional rendering knobs (width, dream status, date)
 * @returns      Formatted board string ready for terminal or text panel
 */
export function renderBoard(board: ProjectBoardResult, opts?: RenderBoardOptions): string {
  const rawWidth = opts?.boardWidth ?? 100;
  const BOARD_WIDTH = Math.min(110, Math.max(80, rawWidth));
  const today = opts?.today ?? board.date;
  const dreamStatus = opts?.dreamStatus ?? null;

  // Layout constants (match Python)
  const SLUG_W = 22; // longest real slug ("novada-proxy-extension")
  // PREFIX_W: "  NN  " (6) + icon (2) + " " (1) + slug (SLUG_W) + " " (1) + date (10) + "  " (2)
  const PREFIX_W = 6 + 2 + 1 + SLUG_W + 1 + 10 + 2;
  const DETAIL_W = Math.max(24, BOARD_WIDTH - PREFIX_W);

  // Helpers
  const bar = "─".repeat(BOARD_WIDTH);

  function fit(s: string): string {
    return fitToWidth(s, DETAIL_W);
  }

  function padSlug(slug: string): string {
    // Pad slug to SLUG_W display columns (ASCII slugs only, so len === display width)
    return slug.padEnd(SLUG_W);
  }

  function row(num: number, icon: string, slug: string, date: string, detail: string): string {
    const numStr = String(num).padStart(2);
    return `  ${numStr}  ${icon} ${padSlug(slug)} ${date.padEnd(10)}  ${fit(detail)}`.trimEnd();
  }

  // Partition by status (match Python)
  const blocked: ProjectEntry[] = board.projects.filter((p) => p.status === "blocked");
  const active: ProjectEntry[] = board.projects.filter(
    (p) => p.status === "active" || p.status === "complete",
  );
  const stale: ProjectEntry[] = board.projects.filter((p) => p.status === "stale");

  // Dream banner
  const dreamBanner = dreamStatus ? renderDreamBanner(dreamStatus, today) : "";

  const lines: string[] = [];
  lines.push(bar);
  lines.push(`  🧠 AgentRecall · Status Board     ${today} · ${board.total} projects`);
  lines.push(bar);

  if (dreamBanner) {
    lines.push(dreamBanner.trimEnd());
    lines.push("");
  }

  // Column header
  lines.push(`   #   ${"Project".padEnd(SLUG_W)}   ${"Updated".padEnd(10)}  Status · Next`);
  lines.push("  " + "─".repeat(BOARD_WIDTH - 2));

  // Render rows — sequential numbering from board (already sorted + numbered)
  for (const p of blocked) {
    const blocker = p.next || "—";
    const icon = ICON["blocked"];
    lines.push(row(p.number, icon, p.slug, p.date, `BLOCKED · ${blocker}`));
  }

  for (const p of active) {
    const detail = p.next || "(see journal)";
    const icon = ICON["active"];
    lines.push(row(p.number, icon, p.slug, p.date, detail));
  }

  for (const p of stale) {
    const detail = p.next ? `stale · ${p.next}` : "stale";
    lines.push(row(p.number, ICON["stale"], p.slug, p.date, detail));
  }

  // Legend
  lines.push("");
  lines.push(`  ${ICON["active"]} active   ${ICON["stale"]} stale   ${ICON["blocked"]} blocked`);

  lines.push(bar);
  lines.push("  Enter a number · N new (with memory) · X new (clean) · d<N> delete");
  lines.push(bar);

  return lines.join("\n");
}
