// packages/core/src/tools-logic/local-archive-backend.ts
//
// LocalArchiveMemoryBackend — the reference MemoryBackend implementation.
//
// Purpose (two roles):
//   1. TESTING: round-trip verification of the retain() contract without
//      a live third-party service.
//   2. ADAPTER TEMPLATE: fork this file to build a real backend adapter.
//      Replace the JSON write with a client.retain() call; keep the
//      scrub-upstream assumption and the RetainResult shape unchanged.
//
// Storage layout:
//   <root>/exports/<backend-name>/YYYY-MM-DD.json
//
// Each daily file is an array of CorrectionExport objects. A second call on
// the same day appends (unique by id — the seam is idempotent; a repeated
// `ar corrections export --to-backend` run on the same set does not create
// duplicate entries).

import * as fs from "node:fs";
import * as path from "node:path";
import { getRoot } from "../types.js";
import type { MemoryBackend, RetainResult } from "./memory-backend.js";
import type { CorrectionExport } from "./export-corrections.js";

/** Human-readable name surfaced in CLI output and log lines. */
const BACKEND_NAME = "local-archive";

/**
 * Date string for today (YYYY-MM-DD) in the LOCAL timezone — injectable in
 * tests via the fn arg.
 *
 * NOTE: uses local time, not UTC, so the archive file matches the operator's
 * calendar day. toISOString() returns UTC and would produce the wrong date for
 * operators running past midnight UTC in a positive-offset timezone.
 */
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * LocalArchiveMemoryBackend — writes scrubbed CorrectionExport arrays to
 * <root>/exports/local-archive/YYYY-MM-DD.json.
 *
 * CONTRACT:
 *   - Assumes records are already scrubbed (exportCorrections() upstream).
 *   - Idempotent: re-running with the same IDs does not duplicate entries.
 *   - Never throws into session flow — errors map to rejected entries.
 */
export class LocalArchiveMemoryBackend implements MemoryBackend {
  /** Override in tests via the constructor to pin the date. */
  private readonly _dateFn: () => string;

  constructor(opts: { dateFn?: () => string } = {}) {
    this._dateFn = opts.dateFn ?? todayDateString;
  }

  name(): string {
    return BACKEND_NAME;
  }

  async available(): Promise<boolean> {
    // Always available — only needs a writable filesystem, same guarantee
    // as the rest of the local store.
    try {
      const dir = this._archiveDir();
      fs.mkdirSync(dir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  async retain(records: CorrectionExport[]): Promise<RetainResult> {
    const accepted: string[] = [];
    const rejected: { id: string; reason: string }[] = [];

    if (records.length === 0) {
      return { accepted, rejected };
    }

    try {
      const dir = this._archiveDir();
      fs.mkdirSync(dir, { recursive: true });

      const file = path.join(dir, `${this._dateFn()}.json`);

      // Load existing entries (idempotency — deduplicate by id).
      let existing: CorrectionExport[] = [];
      try {
        if (fs.existsSync(file)) {
          const raw = fs.readFileSync(file, "utf-8");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            existing = parsed as CorrectionExport[];
          }
        }
      } catch {
        // Malformed file — start fresh. A corrupt archive must not block new writes.
        existing = [];
      }

      const existingIds = new Set(existing.map((e) => e.id));
      const toWrite: CorrectionExport[] = [...existing];

      for (const record of records) {
        if (existingIds.has(record.id)) {
          // Already present — idempotent accept (not a rejection).
          accepted.push(record.id);
          continue;
        }
        toWrite.push(record);
        existingIds.add(record.id);
        accepted.push(record.id);
      }

      fs.writeFileSync(file, JSON.stringify(toWrite, null, 2), "utf-8");
    } catch (err) {
      // A filesystem failure rejects ALL records in this batch.
      const reason = `write failed: ${String(err)}`;
      for (const r of records) {
        if (!accepted.includes(r.id)) {
          rejected.push({ id: r.id, reason });
        }
      }
    }

    return { accepted, rejected };
  }

  /** Absolute path of the archive directory for this backend. */
  private _archiveDir(): string {
    return path.join(getRoot(), "exports", BACKEND_NAME);
  }
}
