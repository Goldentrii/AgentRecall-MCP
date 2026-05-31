/**
 * Corrections store — behavioral rules that persist forever, never roll up.
 * Separate from journal (ephemeral) and palace (semantic). Always loaded at session start.
 *
 * Storage: ~/.agent-recall/projects/{project}/corrections/{date}-{slug}.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getRoot } from "../types.js";
import { ensureDir } from "./fs-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrectionRecord {
  id: string;       // date-slug
  date: string;     // YYYY-MM-DD
  severity: "p0" | "p1";  // p0 = always load, p1 = load if context matches
  project: string;
  rule: string;     // The rule in one sentence
  context: string;  // Full correction text
  tags: string[];
  holder?: string;  // Who recorded this — defaults to date/session proxy
  kind?: "correction" | "insight" | "hunch" | "fact";
  weight?: number;  // Confidence 0-1, defaults from severity
  active?: boolean; // false = archived/superseded
  /**
   * Outcome KPIs — closes the learning loop.
   * V9 (research vantage 9, 2026-05-30): the only KPI that matters is
   * "does the same bug recur after this correction was retrieved?"
   */
  retrieved_count?: number;   // How many times this was surfaced via check/recall
  heeded_count?: number;      // How many times the agent's next action honored it
  recurrence_count?: number;  // How many times the same bug recurred AFTER retrieval
  precision?: number;         // heeded / retrieved (cached, recomputed on outcome)
  last_retrieved?: string;    // ISO timestamp
  last_outcome?: string;      // ISO timestamp of most recent heeded/recurrence event
}

export interface CorrectionOutcome {
  correction_id: string;
  project: string;
  /** "heeded" = agent's action honored the warning. "recurred" = same bug happened again. */
  kind: "retrieved" | "heeded" | "recurred";
  /** ISO timestamp */
  at: string;
  /** Free-text evidence — what made you decide. */
  evidence?: string;
}

export interface CorrectionKPI {
  project: string;
  total: number;
  active: number;
  retrieved: number;
  heeded: number;
  recurred: number;
  /** Aggregate precision = sum(heeded) / sum(retrieved). NaN if retrieved=0. */
  precision: number;
  /** Insights below 0.3 precision — archive candidates. */
  noise_candidates: Array<{ id: string; rule: string; precision: number }>;
  /** Insights above 0.8 precision with ≥3 retrievals — promote candidates. */
  high_signal: Array<{ id: string; rule: string; precision: number; retrieved: number }>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function correctionsDir(project: string): string {
  // Hardened sanitizer — same rule as storage/paths.ts. No dots (prevents ".." escape).
  const safe = (project || "unnamed")
    .replace(/[^a-zA-Z0-9_\-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "unnamed";
  const root = getRoot();
  const resolved = path.join(root, "projects", safe, "corrections");
  const rootSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!resolved.startsWith(rootSep)) {
    throw new Error(`Invalid project (path escape): ${project}`);
  }
  return resolved;
}

function outcomesPath(project: string): string {
  return path.join(correctionsDir(project), "_outcomes.jsonl");
}

/** Auto-detect severity: p0 if uses strong negation/mandate language, else p1. */
function detectSeverity(text: string): "p0" | "p1" {
  const p0Patterns = /\bnever\b|\balways\b|\bdon'?t\b|\bdo not\b|\bmust not\b|\bforbid\b|\bprohibit\b/i;
  return p0Patterns.test(text) ? "p0" : "p1";
}

/** Slugify text for use in filenames (safe, lowercase, hyphenated). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function defaultWeight(severity: "p0" | "p1"): number {
  return severity === "p0" ? 1.0 : 0.7;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function applyCorrectionDefaults(record: CorrectionRecord, holderDefault: string): CorrectionRecord {
  return {
    ...record,
    holder: record.holder ?? holderDefault,
    kind: record.kind ?? "correction",
    weight: record.weight ?? defaultWeight(record.severity),
    active: record.active ?? true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write a correction to persistent storage.
 * Auto-detects severity from the rule/context text.
 */
export function writeCorrection(project: string, correction: CorrectionRecord): void {
  const dir = correctionsDir(project);
  ensureDir(dir);

  // Auto-detect severity if not already set
  const severity = correction.severity ?? detectSeverity(`${correction.rule} ${correction.context}`);
  const record = applyCorrectionDefaults({ ...correction, severity }, todayDate());

  const filename = `${record.date}-${slugify(record.rule || record.id)}.json`;
  const filepath = path.join(dir, filename);

  // Atomic write — tmp + rename, mode 0600
  const tmp = `${filepath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), { encoding: "utf-8", mode: 0o600 });
  fs.renameSync(tmp, filepath);
}

/**
 * Read all corrections for a project, sorted newest first.
 */
export function readCorrections(project: string): CorrectionRecord[] {
  const dir = correctionsDir(project);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const records: CorrectionRecord[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const parsed = JSON.parse(raw) as CorrectionRecord;
      records.push(applyCorrectionDefaults(parsed, parsed.date));
    } catch {
      // Skip malformed files silently
    }
  }

  return records;
}

/**
 * Read only active corrections, sorted newest first.
 */
export function readActiveCorrections(project: string): CorrectionRecord[] {
  return readCorrections(project).filter((r) => r.active !== false);
}

/**
 * Read only P0 corrections (always-load), sorted newest first.
 * Respects active field — archived corrections (active:false) are excluded.
 */
export function readP0Corrections(project: string): CorrectionRecord[] {
  return readCorrections(project).filter((r) => r.severity === "p0" && r.active !== false);
}

/**
 * Record an outcome event for a correction (retrieved / heeded / recurred).
 * Appends to _outcomes.jsonl and also updates the correction JSON's counters
 * + precision cache. Atomic per-write.
 */
export function recordOutcome(outcome: CorrectionOutcome): void {
  const dir = correctionsDir(outcome.project);
  ensureDir(dir);

  // Append jsonl event (audit trail).
  const line = JSON.stringify(outcome) + "\n";
  fs.appendFileSync(outcomesPath(outcome.project), line, "utf-8");

  // Update the per-correction file's counters.
  const target = readCorrections(outcome.project).find((r) => r.id === outcome.correction_id);
  if (!target) return; // outcome can still be replayed later if record is restored

  const updated: CorrectionRecord = {
    ...target,
    retrieved_count: target.retrieved_count ?? 0,
    heeded_count: target.heeded_count ?? 0,
    recurrence_count: target.recurrence_count ?? 0,
  };
  if (outcome.kind === "retrieved") {
    updated.retrieved_count = (updated.retrieved_count ?? 0) + 1;
    updated.last_retrieved = outcome.at;
  } else if (outcome.kind === "heeded") {
    updated.heeded_count = (updated.heeded_count ?? 0) + 1;
    updated.last_outcome = outcome.at;
  } else if (outcome.kind === "recurred") {
    updated.recurrence_count = (updated.recurrence_count ?? 0) + 1;
    updated.last_outcome = outcome.at;
  }
  const r = updated.retrieved_count ?? 0;
  updated.precision = r > 0 ? Number(((updated.heeded_count ?? 0) / r).toFixed(3)) : undefined;

  // Re-write the JSON file atomically (tmp + rename — prevents truncation on SIGTERM).
  const filename = `${updated.date}-${slugify(updated.rule || updated.id)}.json`;
  const filepath = path.join(dir, filename);
  const tmp = `${filepath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(updated, null, 2), { encoding: "utf-8", mode: 0o600 });
  fs.renameSync(tmp, filepath);
}

/**
 * Aggregate KPIs over all corrections for a project — the "is this learning loop working?" view.
 */
export function getCorrectionKPIs(project: string): CorrectionKPI {
  const all = readCorrections(project);
  const active = all.filter((r) => r.active !== false);
  let retrieved = 0;
  let heeded = 0;
  let recurred = 0;
  const noise: CorrectionKPI["noise_candidates"] = [];
  const hot: CorrectionKPI["high_signal"] = [];

  for (const r of all) {
    retrieved += r.retrieved_count ?? 0;
    heeded += r.heeded_count ?? 0;
    recurred += r.recurrence_count ?? 0;
    const p = r.precision ?? null;
    const ret = r.retrieved_count ?? 0;
    if (p !== null && ret >= 3 && p < 0.3) {
      noise.push({ id: r.id, rule: r.rule, precision: p });
    }
    if (p !== null && ret >= 3 && p >= 0.8) {
      hot.push({ id: r.id, rule: r.rule, precision: p, retrieved: ret });
    }
  }

  return {
    project,
    total: all.length,
    active: active.length,
    retrieved,
    heeded,
    recurred,
    precision: retrieved > 0 ? Number((heeded / retrieved).toFixed(3)) : NaN,
    noise_candidates: noise,
    high_signal: hot,
  };
}
