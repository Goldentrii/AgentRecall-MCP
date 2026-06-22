/**
 * retention.ts — single source of truth for the raw-archive retention window.
 *
 * Both the PRUNE pass (safety-consolidation.ts) and the integrity CHECK
 * (store-doctor.ts) must agree on "how old is too old" for a raw segment.
 * Each used to hard-code 90; that let the doctor flag a stall at a DIFFERENT
 * threshold than the pruner actually used once an operator set a config
 * override — the config-divergence the round-table caught. Lifting the knob
 * here keeps them in lockstep.
 *
 * Resolution order: explicit arg > AGENT_RECALL_ARCHIVE_RETENTION_DAYS env >
 * config.json `archive_retention_days` > DEFAULT_ARCHIVE_RETENTION_DAYS.
 *
 * Defensive by contract: a config read failure falls back to the default. The
 * store-doctor calls this on the read-only session_start hot path and must
 * never throw, so this function never throws either.
 */

import { readSupabaseConfig } from "../supabase/config.js";

/** Default raw-archive retention window (days): segments older than this AND
 *  distilled are pruned/gzipped, and the doctor flags them if still unconsumed. */
export const DEFAULT_ARCHIVE_RETENTION_DAYS = 90;

/** Resolve the effective retention window. See file header for the order. */
export function resolveRetentionDays(explicit?: number): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const env = process.env.AGENT_RECALL_ARCHIVE_RETENTION_DAYS;
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // config.json may carry an optional archive_retention_days (not part of the
  // typed SupabaseConfig, so read the raw shape defensively).
  try {
    const cfg = readSupabaseConfig() as unknown as {
      archive_retention_days?: number;
    } | null;
    if (
      cfg &&
      typeof cfg.archive_retention_days === "number" &&
      cfg.archive_retention_days > 0
    ) {
      return cfg.archive_retention_days;
    }
  } catch {
    // best-effort — fall through to default (never throw on the hot path)
  }
  return DEFAULT_ARCHIVE_RETENTION_DAYS;
}
