/**
 * supersession.ts — P2: detect when a NEW correction CONTRADICTS an existing
 * active one on a versioned / status / key-value fact, and (suggest-default)
 * supersede the stale one.
 *
 * Reuses AgentRecall's existing conflict-token grammar (helpers/conflict-scan.ts)
 * — pure, NO LLM, NO network, NO key. SCOPE LIMIT (honest): this catches
 * contradictions expressed as a version bump ("X is 1.2.3" → "X is 1.3.0"), a
 * status flip ("status: blocked" → "status: done"), or a key-value change
 * ("env = prod" → "env = staging"). It does NOT catch arbitrary semantic
 * substitutions ("use middleware.ts" → "use proxy.ts") with no key — that needs
 * the optional semantic/LLM path and is intentionally out of scope here.
 *
 * Mutation policy: SUGGEST-ONLY by default. Set AR_CONSOLIDATE_AUTO=1 (or pass
 * { auto: true }) to actually retract the contradicted records (with
 * superseded_by set to the new correction's id). The default mutates NOTHING.
 */
import {
  extractVersionTokens,
  extractStatusTokens,
  extractKVTokens,
} from "../helpers/conflict-scan.js";
import { readActiveCorrections, retractCorrection } from "../storage/corrections.js";

export interface SupersessionMatch {
  existingId: string;
  existingRule: string;
  conflictingValues: Array<{ existing: string; incoming: string }>;
}

export interface SupersessionReview {
  /** Older active corrections the new one contradicts — proposed for supersession. */
  suggestions: SupersessionMatch[];
  /** ids actually retracted (superseded_by set) — non-empty ONLY in auto mode. */
  superseded: string[];
  auto: boolean;
}

/**
 * Pairwise contradiction check over version + status + key-value tokens. Mirrors
 * the comparison in conflict-scan.ts::scanForConflicts so both agree on what a
 * "conflict" is (no fork of the grammar).
 */
function compareForConflicts(
  newText: string,
  existingText: string,
): Array<{ existing: string; incoming: string }> {
  const out: Array<{ existing: string; incoming: string }> = [];

  // 1. Version token conflicts (same key, different semver).
  const newV = extractVersionTokens(newText);
  if (newV.size > 0) {
    const exV = extractVersionTokens(existingText);
    for (const [k, nv] of newV) {
      const ev = exV.get(k);
      if (ev && ev !== nv) out.push({ existing: `${k} is ${ev}`, incoming: `${k} is ${nv}` });
    }
  }

  // 2. Status category conflicts (existing has a category the new text lacks).
  const newS = extractStatusTokens(newText);
  if (newS.size > 0) {
    const exS = extractStatusTokens(existingText);
    const newCats = new Set(newS.values());
    const exCats = new Set(exS.values());
    for (const cat of exCats) {
      if (!newCats.has(cat)) {
        const exWord = [...exS.entries()].find(([, c]) => c === cat)?.[0] ?? cat;
        const newCat = [...newCats][0];
        if (newCat) {
          const newWord = [...newS.entries()].find(([, c]) => c === newCat)?.[0] ?? newCat;
          out.push({ existing: `status is ${exWord}`, incoming: `status is ${newWord}` });
        }
      }
    }
  }

  // 3. Key-value conflicts (same key, different value).
  const newKV = extractKVTokens(newText);
  if (newKV.size > 0) {
    const exKV = extractKVTokens(existingText);
    for (const [k, nv] of newKV) {
      const ev = exKV.get(k);
      if (ev && ev !== nv) out.push({ existing: `${k} is ${ev}`, incoming: `${k} is ${nv}` });
    }
  }

  return out;
}

/** Find active corrections that contradict the candidate on a version/status/kv fact. */
export function detectCorrectionConflicts(
  project: string,
  candidate: { id?: string; rule: string; context?: string },
): SupersessionMatch[] {
  const newText = `${candidate.rule} ${candidate.context ?? ""}`.trim();
  const matches: SupersessionMatch[] = [];
  for (const existing of readActiveCorrections(project)) {
    if (candidate.id && existing.id === candidate.id) continue;
    const existingText = `${existing.rule} ${existing.context ?? ""}`.trim();
    const conflicts = compareForConflicts(newText, existingText);
    if (conflicts.length > 0) {
      matches.push({
        existingId: existing.id,
        existingRule: existing.rule,
        conflictingValues: conflicts,
      });
    }
  }
  return matches;
}

/**
 * Review (and, under auto, apply) supersessions for a newly-written correction.
 * SUGGEST-ONLY by default. With auto (or AR_CONSOLIDATE_AUTO=1) the contradicted
 * older corrections are retracted with superseded_by = the new correction's id.
 */
export function reviewSupersessions(
  project: string,
  newCorrection: { id: string; rule: string; context?: string },
  opts?: { auto?: boolean },
): SupersessionReview {
  const auto = opts?.auto ?? process.env.AR_CONSOLIDATE_AUTO === "1";
  const suggestions = detectCorrectionConflicts(project, newCorrection);
  const superseded: string[] = [];
  if (auto) {
    for (const m of suggestions) {
      const res = retractCorrection(
        project,
        m.existingId,
        `superseded by ${newCorrection.id}`,
        newCorrection.id,
      );
      if (res.success) superseded.push(m.existingId);
    }
  }
  return { suggestions, superseded, auto };
}
