/**
 * FSRS-lite — Free Spaced Repetition Scheduler, simplified for AgentRecall.
 *
 * Inspired by SuperMemo / FSRS-6 (Anki ≥23.10). We don't run actual review
 * sessions, so we track a 2-component model (Stability + Retrievability)
 * instead of the full FSRS 3-component (S, D, R).
 *
 * Core idea:
 *   R = exp(-days_since_lastConfirmed / S)
 *   On confirmation / successful recall: S grows.
 *   On staleness (no confirm for long): R falls; eviction candidate.
 *
 * Used by:
 *   - insights (palace/awareness)
 *   - palace room facts
 *   - palace pipeline syntheses
 *
 * Decisions log:
 *   - We do NOT auto-delete. Retrievability < 0.3 is "archive candidate",
 *     surfaced in dashboard but never removed without explicit action.
 *   - Reinforcement happens on `recall` hit. Every retrieval bumps lastConfirmed
 *     and grows S. Same loop as biological reconsolidation but additive only.
 */

const DEFAULT_INITIAL_STABILITY = 7; // days — new fact "feels fresh" for a week
const STABILITY_GROWTH = 0.3;        // each confirmation grows S by 30%
const ARCHIVE_THRESHOLD = 0.3;       // R below this → archive candidate
const HOT_THRESHOLD = 0.85;          // R above this → strong fact
const MS_PER_DAY = 86_400_000;

export interface FsrsState {
  /** Stability — days. Higher = facts stays "remembered" longer between confirms. */
  stability: number;
  /** ISO timestamp of last successful confirmation/recall hit. */
  last_confirmed: string;
  /** Total confirmation count (monotonic). */
  confirmations: number;
}

export interface FsrsScore {
  /** Retrievability — probability the agent would find this useful today. 0..1. */
  retrievability: number;
  /** Stability (days). */
  stability: number;
  /** Days since lastConfirmed. */
  age_days: number;
  /** Health bucket. */
  status: "hot" | "warm" | "cool" | "archive_candidate";
}

/**
 * Initialize FSRS state for a new fact.
 */
export function initFsrs(now: string = new Date().toISOString()): FsrsState {
  return {
    stability: DEFAULT_INITIAL_STABILITY,
    last_confirmed: now,
    confirmations: 1,
  };
}

/**
 * Compute current retrievability + status from FSRS state.
 */
export function score(state: FsrsState, now: string = new Date().toISOString()): FsrsScore {
  const last = new Date(state.last_confirmed).getTime();
  const cur = new Date(now).getTime();
  const ageMs = Math.max(0, cur - last);
  const ageDays = ageMs / MS_PER_DAY;
  const r = Math.exp(-ageDays / Math.max(0.001, state.stability));
  return {
    retrievability: Number(r.toFixed(4)),
    stability: state.stability,
    age_days: Number(ageDays.toFixed(2)),
    status: bucket(r),
  };
}

function bucket(r: number): FsrsScore["status"] {
  if (r >= HOT_THRESHOLD) return "hot";
  if (r >= 0.6) return "warm";
  if (r >= ARCHIVE_THRESHOLD) return "cool";
  return "archive_candidate";
}

/**
 * Reinforce: a recall or confirmation bumps lastConfirmed and grows stability.
 * Returns updated state. Pure — caller writes back to disk.
 */
export function reinforce(state: FsrsState, now: string = new Date().toISOString()): FsrsState {
  return {
    stability: state.stability * (1 + STABILITY_GROWTH),
    last_confirmed: now,
    confirmations: state.confirmations + 1,
  };
}

/**
 * Penalize: explicit signal that this fact was wrong / unhelpful.
 * Halves stability and keeps lastConfirmed (so age stays the same).
 */
export function penalize(state: FsrsState): FsrsState {
  return {
    ...state,
    stability: Math.max(1, state.stability * 0.5),
  };
}

export { ARCHIVE_THRESHOLD, HOT_THRESHOLD, DEFAULT_INITIAL_STABILITY };
