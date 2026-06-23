/**
 * export-corrections.ts — the vendor-neutral, fail-closed-scrubbed export of
 * corrections (backlog #1, revealed by the Hindsight integration).
 *
 * WHY: before this, the only way to get active corrections out of AgentRecall was
 * to glob the on-disk JSON directly (schema-coupled, re-implements the scrub that
 * WILL drift) or `ar recall` (drops severity/weight/recurrence). Every external
 * memory backend (Hindsight, Mem0, Zep) had to re-port the egress scrub. This is
 * the ONE supported export contract: a stable versioned schema, scrubbed through
 * the FAIL-CLOSED scrubForExport (a surviving secret aborts the export, never
 * leaks), active-only by default (never teach an external store a retracted
 * belief).
 *
 * DELIBERATELY VENDOR-NEUTRAL: this emits the generic CorrectionExport shape, NOT
 * a Hindsight/Mem0-specific payload — the vendor mapping belongs in the adapter,
 * not in AgentRecall core.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getRoot } from "../types.js";
import { readCorrections } from "../storage/corrections.js";
import type { CorrectionRecord } from "../storage/corrections.js";
import { scrubForExport, SecretScanError } from "../storage/content-guard.js";

/** Bump when the export shape changes — consumers pin/diff against this. */
export const CORRECTION_EXPORT_SCHEMA_VERSION = "corrections-export/v1";

/**
 * One exported correction. A stable, vendor-neutral projection of CorrectionRecord
 * with every free-text field already scrubbed. `confidence_basis` is explicit so a
 * downstream store never mistakes `weight` for retrieval relevance or a truth
 * probability — it is correction AUTHORITY (pre-empts the three-way `confidence`
 * ambiguity, backlog #2).
 */
export interface CorrectionExport {
  schema_version: string;
  id: string;
  date: string;
  project: string;
  severity: "p0" | "p1";
  kind: string;
  rule: string;       // scrubbed
  context: string;    // scrubbed
  tags: string[];     // scrubbed
  weight: number | null;
  confidence_basis: "authority-weight";
  active: boolean;
  authoritative: boolean | null;
  retrieved_count: number;
  heeded_count: number;
  recurrence_count: number;
  last_outcome: string | null;
}

export interface ExportCorrectionsOptions {
  /** A specific project slug. Omit to export across ALL projects. */
  project?: string;
  /** Include retracted (active:false) records. Default false — active-only. */
  includeRetracted?: boolean;
  /** Inclusive lower bound on the correction date (YYYY-MM-DD). */
  since?: string;
}

function toExport(rec: CorrectionRecord): CorrectionExport {
  // scrubForExport throws SecretScanError if a secret survives — let it propagate
  // so the whole export aborts loudly rather than emitting a partial/leaky set.
  // EVERY free-text string field is scrubbed — not just rule/context/tags. A
  // corrupt or hand-edited record could carry a secret in project, kind, or
  // last_outcome too; defense-in-depth scrubs them all. (id/date are structurally
  // constrained auto-generated values and carry no free text.)
  return {
    schema_version: CORRECTION_EXPORT_SCHEMA_VERSION,
    id: rec.id,
    date: rec.date,
    project: scrubForExport(rec.project ?? ""),
    severity: rec.severity,
    kind: scrubForExport(String(rec.kind ?? "correction")),
    rule: scrubForExport(rec.rule ?? ""),
    context: scrubForExport(rec.context ?? ""),
    tags: (rec.tags ?? []).map((t) => scrubForExport(String(t))),
    weight: typeof rec.weight === "number" ? rec.weight : null,
    confidence_basis: "authority-weight",
    active: rec.active !== false,
    authoritative: typeof rec.authoritative === "boolean" ? rec.authoritative : null,
    retrieved_count: rec.retrieved_count ?? 0,
    heeded_count: rec.heeded_count ?? 0,
    recurrence_count: rec.recurrence_count ?? 0,
    last_outcome: rec.last_outcome != null ? scrubForExport(rec.last_outcome) : null,
  };
}

/**
 * Project slugs that actually have a corrections directory with ≥1 record.
 * Deliberately NOT listAllProjects() (which enumerates by journal presence) — a
 * project can have corrections without a journal, and a security export must not
 * silently skip it.
 */
function projectsWithCorrections(): string[] {
  const dir = path.join(getRoot(), "projects");
  const out: string[] = [];
  let slugs: string[] = [];
  try {
    slugs = fs.readdirSync(dir);
  } catch {
    return []; // no projects dir (or unreadable) — nothing to export
  }
  for (const slug of slugs) {
    const cdir = path.join(dir, slug, "corrections");
    try {
      // readdirSync throws ENOENT for a missing corrections dir — the catch makes
      // existsSync redundant and closes the existsSync→readdirSync TOCTOU window.
      if (fs.readdirSync(cdir).some((f) => f.endsWith(".json"))) {
        out.push(slug);
      }
    } catch {
      // no corrections dir, or unreadable — skip, never throw
    }
  }
  return out;
}

/**
 * Export corrections as a stable, scrubbed, vendor-neutral array.
 *
 * Active-only by default (never teach an external store a retracted belief).
 * Fail-closed: if any record holds a secret that cannot be redacted, the entire
 * export throws SecretScanError naming the offending correction id — it never
 * emits a partial set that silently omits the leaky record.
 */
export function exportCorrections(opts: ExportCorrectionsOptions = {}): CorrectionExport[] {
  const slugs = opts.project ? [opts.project] : projectsWithCorrections();

  const out: CorrectionExport[] = [];
  for (const slug of slugs) {
    let records: CorrectionRecord[];
    try {
      records = readCorrections(slug);
    } catch {
      // A project dir that became unreadable between enumeration and read — skip,
      // consistent with projectsWithCorrections()'s never-throw posture.
      continue;
    }
    for (const rec of records) {
      if (!opts.includeRetracted && rec.active === false) continue;
      if (opts.since && rec.date < opts.since) continue;
      try {
        out.push(toExport(rec));
      } catch (e) {
        if (e instanceof SecretScanError) {
          // Re-throw with the offending id so the operator knows exactly which
          // correction to redact or retract before re-running.
          throw new SecretScanError(`${e.label} (in correction ${rec.id})`);
        }
        throw e;
      }
    }
  }
  return out;
}
