/**
 * Dream health — count consecutive failure days from AAM dream logs.
 *
 * Solves the "silent cron failures rot for days" pain: dream auth has been
 * failing for 6 consecutive nights but only surfaces in stray `arstatus` output,
 * never at session_start. This helper lets session_start emit a red banner.
 *
 * Log location: ~/.aam/dreams/run-YYYY-MM-DD.log  (AAM-orchestrated dreams)
 * Pattern: a day's log "succeeded" if it contains "Dream complete" or
 *          "Dream run complete"; otherwise it "failed".
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface DreamHealth {
  consecutive_failures: number;
  last_failed_date: string | null;
  last_success_date: string | null;
  banner: string | null;  // Ready-to-render string, or null if healthy
}

const DREAMS_DIR = path.join(os.homedir(), ".aam", "dreams");
const LOOKBACK_DAYS = 7;
const BANNER_THRESHOLD = 2;  // surface when N or more consecutive failures

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isSuccess(logPath: string): boolean {
  try {
    const content = fs.readFileSync(logPath, "utf-8");
    return /Dream(?:\s+run)?\s+complete/i.test(content);
  } catch {
    return false;
  }
}

export function getDreamHealth(): DreamHealth {
  const out: DreamHealth = {
    consecutive_failures: 0,
    last_failed_date: null,
    last_success_date: null,
    banner: null,
  };
  if (!fs.existsSync(DREAMS_DIR)) return out;

  // Walk yesterday → 7 days ago. Today is in-progress so we don't count it.
  for (let i = 1; i <= LOOKBACK_DAYS; i++) {
    const dateStr = dateNDaysAgo(i);
    const logPath = path.join(DREAMS_DIR, `run-${dateStr}.log`);
    if (!fs.existsSync(logPath)) {
      // No log = no run that night; treat as a failure (cron didn't fire OR
      // it crashed before writing). Stops the streak if we'd been counting,
      // since "no log" + "missing" are both signs of unhealthy automation.
      if (out.last_success_date === null) {
        out.consecutive_failures++;
        if (out.last_failed_date === null) out.last_failed_date = dateStr;
      } else {
        break;
      }
      continue;
    }
    if (isSuccess(logPath)) {
      if (out.last_success_date === null) out.last_success_date = dateStr;
      break;  // streak ended
    } else {
      out.consecutive_failures++;
      if (out.last_failed_date === null) out.last_failed_date = dateStr;
    }
  }

  if (out.consecutive_failures >= BANNER_THRESHOLD) {
    const lastSuccess = out.last_success_date ?? `>${LOOKBACK_DAYS} days ago`;
    out.banner =
      `⚠ Dream cron failed ${out.consecutive_failures} nights in a row ` +
      `(last success: ${lastSuccess}). The awareness backfill is broken — ` +
      `check ~/.aam/dreams/run-${out.last_failed_date}.log for auth or network errors.`;
  }
  return out;
}
