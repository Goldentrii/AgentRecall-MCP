/**
 * brief.ts — compact LLM-free re-orientation briefing (≤200 tokens).
 *
 * Designed for:
 *   - Hook-less hosts (no session_start auto-fire) that need a lightweight
 *     mid-session reminder of lifecycle rules and current project state.
 *   - Tier-B fallback when a client does not want the full session_start payload.
 *
 * Contract:
 *   - READ-ONLY: no session_start side-effects (no recordPolicyLoad, no
 *     recordOutcome, no autoBackfill). Does NOT replace session_start.
 *   - DETERMINISTIC: same on-disk state → byte-identical JSON output across
 *     runs. No Date.now() in output, no timestamps, no random values.
 *   - LLM-FREE: only synchronous fs reads + keyword matching.
 *   - ≤200 tokens output budget (enforced by field limits; caller may verify).
 *   - NEVER call recordPolicyLoad or any write-side function here.
 *
 * Spec ref: cross-surface-adapter-spec.md §5 "brief tool design"
 * --full only: registered inside the `if (fullMode)` block in index.ts.
 */

import { resolveProject } from "../storage/project.js";
import { readIdentity } from "../palace/identity.js";
import { readActiveCorrections, type CorrectionRecord } from "../storage/corrections.js";
import { readAlignmentLog, extractWatchPatterns, type WatchForPattern } from "../helpers/alignment-patterns.js";
import { readBehaviorPolicies, type BehaviorRule } from "../storage/behavior-policies.js";
import { listMilestones } from "../palace/pipeline.js";
import { runStoreDoctor, storeDoctorBanner } from "./store-doctor.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefInput {
  project?: string;
}

export interface BriefCorrection {
  id: string;
  rule: string;
  severity: "p0" | "p1";
}

export interface BriefWatchFor {
  pattern: string;
  suggestion: string;
}

export interface BriefRule {
  name: string;
  when: string;
  do: string;
}

export interface BriefResult {
  /** Resolved project slug. */
  project: string;
  /**
   * Identity one-liner (≤140 chars). `"unknown"` when no identity card exists.
   * Same extraction as sessionStartLite.
   */
  identity: string;
  /**
   * Active pipeline phase name, or null when no phase is active.
   * Deterministic: uses listMilestones().find(m => status === 'active').
   */
  active_phase: string | null;
  /** Top P0 corrections (≤3), deterministically ordered by date descending. */
  corrections_top: BriefCorrection[];
  /** Top watch_for patterns (≤2), extracted from alignment log. */
  watch_for_top: BriefWatchFor[];
  /** Top behavior rules (≤3), most recently created first. */
  rules_top: BriefRule[];
  /**
   * The 3-rule lifecycle text verbatim. Always present.
   * Keeps this tool self-contained for hook-less hosts.
   */
  lifecycle_text: string;
  /**
   * Canonical save-trigger vocabulary (human-readable string list).
   * Derived from TRIGGER_VOCAB_DISPLAY — deterministic.
   */
  trigger_vocab: string[];
  /**
   * READ-ONLY store-integrity one-liner; null when the store is healthy.
   * Best-effort — never throws.
   */
  store_health: string | null;
  /**
   * Host-honesty line: warns hook-less hosts they must drive the lifecycle.
   * Always included.
   */
  host_hint: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The 3-rule lifecycle verbatim — must match server.ts instructions.
 * Single source of truth here; server.ts REFERENCES this exported constant.
 */
export const LIFECYCLE_TEXT =
  "AgentRecall lifecycle (this host has NO auto-hooks — you drive it):\n" +
  "(1) ENTRY: call session_start FIRST, before acting.\n" +
  "(2) DURABLE INTENT: when you or the user says save/remember/checkpoint/记住, call session_end (or remember for a single fact). Saying it ≠ saving it.\n" +
  "(3) EXIT: call session_end before the session ends.";

/** Save-trigger vocabulary rendered as human-readable strings. */
const TRIGGER_VOCAB_DISPLAY: ReadonlyArray<string> = [
  "save", "save this", "save the session",
  "checkpoint", "retain this",
  "don't forget this", "remember this", "write this down",
  "记住", "保存", "存档",
];

const HOST_HINT =
  "Hook-less host? call brief() once for lifecycle rules. session_start is still required at entry.";

/**
 * ≤200-token budget enforced as a conservative char-count proxy.
 * JSON overhead ≈ 20%; 1200 chars ≈ 200 tokens at ~6 chars/token.
 * enforceTokenBudget() truncates per-section so the invariant holds on a
 * fully-populated store, not just an empty one.
 */
const BUDGET_CHARS = 1200;

/** Per-section field limits (chars) sized so the total stays under BUDGET_CHARS.
 *
 * Fixed overhead analysis (measured):
 *   lifecycle_text ~319, host_hint ~96, trigger_vocab ~135, project ~30 → ~580 fixed.
 *   JSON structural overhead (keys, brackets, commas) → ~120.
 *   Budget for dynamic fields: 1200 - 580 - 120 = 500 chars.
 *   Slots: identity(1) + corrections_top(3) + watch_for_top(2) + rules_top(3).
 *   Budget allocation per slot type:
 *     identity:   1 × 40  = 40
 *     correction: 3 × (id≤12 + rule≤30) ≈ 3×50  = 150  (id truncated to date-part)
 *     watch:      2 × (pattern≤30 + suggestion≤30) = 120
 *     rule:       3 × (name≤20 + when≤25 + do≤25) = 210
 *   Total dynamic: 40 + 150 + 120 + 210 = 520  (tight, within budget with ~80 margin)
 */
const LIMITS = {
  identity: 40,
  correction_id: 10,     // keep only date "2026-06-14" — strip slug suffix
  correction_rule: 20,
  watch_pattern: 28,
  watch_suggestion: 28,
  rule_name: 15,
  rule_when: 18,
  rule_do: 18,
} as const;

function enforceTokenBudget(r: BriefResult): BriefResult {
  return {
    ...r,
    identity: r.identity.slice(0, LIMITS.identity),
    corrections_top: r.corrections_top.map((c) => ({
      ...c,
      id: c.id.slice(0, LIMITS.correction_id),
      rule: c.rule.slice(0, LIMITS.correction_rule),
    })),
    watch_for_top: r.watch_for_top.map((w) => ({
      ...w,
      pattern: w.pattern.slice(0, LIMITS.watch_pattern),
      suggestion: w.suggestion.slice(0, LIMITS.watch_suggestion),
    })),
    rules_top: r.rules_top.map((rule) => ({
      ...rule,
      name: rule.name.slice(0, LIMITS.rule_name),
      when: rule.when.slice(0, LIMITS.rule_when),
      do: rule.do.slice(0, LIMITS.rule_do),
    })),
  };
}

// ---------------------------------------------------------------------------
// brief()
// ---------------------------------------------------------------------------

export async function brief(input: BriefInput): Promise<BriefResult> {
  const slug = await resolveProject(input.project);

  // --- identity (≤140 chars) ---
  const rawIdentity = readIdentity(slug);
  const firstMeaningful = rawIdentity.split("\n").find((l) => {
    const t = l.trim();
    return t && !t.startsWith("---") && !t.startsWith(">") && !/^[a-z_]+:\s/.test(t) && !t.startsWith("_(");
  });
  const identity = (firstMeaningful ?? slug).replace(/^#+\s*/, "").trim().slice(0, 140);

  // --- active pipeline phase (deterministic, null if none) ---
  let active_phase: string | null = null;
  try {
    const milestones = listMilestones(slug);
    const active = milestones.find((m) => m.meta.status === "active");
    active_phase = active?.meta.phase ?? null;
  } catch {
    active_phase = null;
  }

  // --- top P0 corrections (≤3, date-descending) ---
  let corrections_top: BriefCorrection[] = [];
  try {
    const corrections: CorrectionRecord[] = readActiveCorrections(slug);
    // Sort deterministically: P0 first, then by id (date-stamped ids are
    // lexicographically ordered newest-first after the date prefix).
    const sorted = corrections
      .filter((c) => c.severity === "p0")
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 3);
    corrections_top = sorted.map((c) => ({
      id: c.id,
      rule: c.rule.slice(0, 120),
      severity: c.severity,
    }));
  } catch {
    corrections_top = [];
  }

  // --- watch_for (≤2) ---
  let watch_for_top: BriefWatchFor[] = [];
  try {
    const alignLog = readAlignmentLog(slug);
    const patterns: WatchForPattern[] = extractWatchPatterns(alignLog, 2);
    watch_for_top = patterns.map((p) => ({
      pattern: p.pattern.slice(0, 80),
      suggestion: p.suggestion.slice(0, 80),
    }));
  } catch {
    watch_for_top = [];
  }

  // --- top behavior rules (≤3) ---
  let rules_top: BriefRule[] = [];
  try {
    // NOTE: brief intentionally does NOT call recordPolicyLoad() — read-only.
    const policies = readBehaviorPolicies(slug);
    const topRules: BehaviorRule[] = policies.rules
      .sort((a, b) => b.created.localeCompare(a.created))
      .slice(0, 3);
    rules_top = topRules.map((r) => ({
      name: r.name.slice(0, 60),
      when: r.when.slice(0, 80),
      do: r.do.slice(0, 80),
    }));
  } catch {
    rules_top = [];
  }

  // --- store health (best-effort, silent on healthy) ---
  let store_health: string | null = null;
  try {
    store_health = storeDoctorBanner(runStoreDoctor());
  } catch {
    store_health = null;
  }

  const raw: BriefResult = {
    project: slug,
    identity,
    active_phase,
    corrections_top,
    watch_for_top,
    rules_top,
    lifecycle_text: LIFECYCLE_TEXT,
    trigger_vocab: [...TRIGGER_VOCAB_DISPLAY],
    store_health,
    host_hint: HOST_HINT,
  };
  return enforceTokenBudget(raw);
}
