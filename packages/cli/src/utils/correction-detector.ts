/**
 * correction-detector.ts
 *
 * Shared pattern-matching logic for the hook-correction and hook-ambient
 * commands. Exported so it can be unit-tested without spawning the CLI process.
 *
 * TWO-GATE DESIGN
 * ──────────────
 * A prompt is captured only when BOTH gates fire:
 *   • CORRECTION gate: text contradicts or negates something the agent did
 *   • BEHAVIORAL gate: text implies a durable rule, not a one-time task redirect
 *
 * INVARIANT (C1 review, 2026-07-03): a pattern must live in exactly ONE gate.
 * If the same phrase fires both gates, the two-gate design filters nothing for
 * that phrase and it self-captures — measured 10/13 FP on realistic daily
 * traffic (scheduling reminders, research prose, encouragement). When a signal
 * is genuinely both corrective and durable, narrow it with context (accusatory
 * frame, format-domain scope) so the generic uses stay out.
 *
 * C1 FIX (2026-07-02, revised 2026-07-03): root causes of 11/17 durable misses:
 *   RC1 — Behavioral gate was too strict: required explicit frequency language
 *          ("again", "every time", "you always"). Durable rules stated ONCE as
 *          absolute commands were killed by the behavioral gate. Added signals
 *          for single-occurrence rule forms.
 *   RC2 — Correction patterns missed indirect phrasing: "you actually did
 *          not", "there is no X" (feature denial), "I should have",
 *          "this is not a website".
 * Known regex-hard misses (accepted): pure positive instructions (E10),
 * autonomy grants (E41), bare one-off preference redirects (E57 — lost when
 * "i don't want you to" was scoped to a single gate; see test file).
 */

export interface DetectionResult {
  /** True when both the correction gate and behavioral gate fire (and prompt is non-trivial) */
  captured: boolean;
  /** String form of the correction pattern that fired, or null */
  correctionHit: string | null;
  /** String form of the behavioral pattern that fired, or null */
  behavioralHit: string | null;
}

/**
 * Patterns that indicate the user is negating or correcting an agent output.
 * Necessary but not sufficient — a behavioral signal must also fire to
 * distinguish durable rules from one-time task redirects.
 */
export const CORRECTION_PATTERNS: readonly RegExp[] = [
  // ── Original patterns ────────────────────────────────────────────────────
  /\bthat'?s\s+wrong\b/i,
  /\byou\s+(missed|didn'?t|forgot|skipped)\b/i,
  /\bnot\s+what\s+i\s+(asked|wanted|meant|said)\b/i,
  /\bagain\s+you\b/i,
  /\bstop\s+(doing|adding|making)\b/i,
  /\bwrong\s+(approach|direction|file|function)\b/i,
  /\bi\s+said\b.*\bnot\b/i,
  /\bdon'?t\s+(do\s+that|change|delete|add)\b/i,
  /\bno[,!.]\s+(don'?t|that|you|i\s+meant)\b/i,
  // Chinese — original
  /不对/,
  /错了/,
  /不要这样/,
  /不是这个/,
  /你搞错了/,
  /我说的不是/,
  /别这样做/,
  /重新来/,
  /你忘了/,
  /不是我要的/,
  /搞反了/,
  /方向不对/,

  // ── C1 additions: indirect phrasing missed by original set ──────────────
  // "there is no X" / "there's no X" — denial of a claimed feature (E11)
  /\bthere('?s|\s+is)\s+no\b/i,
  // "you actually did not apply" / "you did not do" (E28)
  /\byou\s+(?:actually\s+)?did\s+not\b/i,
  // "do not do that" — split form; "don't do that" was already covered (E28)
  /\bdo\s+not\s+do\s+that\b/i,
  // "I don't want you to open it" — preference redirect (E57-class).
  // CORRECTION gate ONLY (C1-rev): encouragement/scoping uses ("I don't want
  // you to rush/worry/spend too long") must not self-capture; a behavioral
  // signal must fire independently for this to persist.
  /\bi\s+don'?t\s+want\s+you\s+to\b/i,
  // "this is not a website" / "this is only in the flyer" — format-domain
  // constraint (E26). Scoped to output-medium nouns (C1-rev): the generic
  // "this is only a draft/suggestion" must not fire.
  /\bthis\s+is\s+(?:not\s+a\s+web\s?(?:site|page)|only\s+(?:a\s+|in\s+(?:the\s+|a\s+)?)?(?:flyer|poster|print|document|pdf))\b/i,
  // "there's nothing like this" — feature denial companion (E11)
  /\bnothing\s+like\s+this\b/i,
  // "pipeline/interface/code wrong" (E56)
  /\b(?:pipeline|interface|code)\s+wrong\b|\bwrong\b.*\b(?:pipeline|interface)\b/i,
  // "not really good" / "not good" — quality negation (E12)
  /\bnot\s+(?:really\s+)?good\b/i,
  // "I should have flagged" / "you should have used" — regret/correction
  // frame (E22). Person-scoped (C1-rev): bare "should have" fires on spec
  // language ("each endpoint should have validation").
  /\b(?:i|you)\s+should\s+have\b/i,
  // "you submit everything in 1 PR" — implied wrong action (E47)
  /\byou\s+submit(?:ted)?\s+(?:all|everything)\b/i,
];

/**
 * Patterns that indicate the correction encodes a reusable rule, not a
 * one-time task redirect. Both a correction AND a behavioral signal must fire
 * for the prompt to be stored in the alignment log.
 */
export const BEHAVIORAL_SIGNALS: readonly RegExp[] = [
  // ── Original signals ─────────────────────────────────────────────────────
  /\bagain\b/i,               // "you did it again"
  /\bkeep\s+\w+ing\b/i,       // "you keep doing..."
  /\balways\b/i,               // "you always add..."
  /\bevery\s+time\b/i,         // "every time you..."
  /\byou\s+still\b/i,          // "you still..."
  /\bhow\s+many\s+times\b/i,
  /\bi\s+told\s+you\b/i,       // "I told you already"
  /\bnever\s+do\b/i,            // "never do this" = rule
  /\bdon'?t\s+ever\b/i,
  /\btend\s+to\b/i,             // "you tend to..."
  /\bthis\s+is\s+a\s+(?:rule|pattern)\b/i,
  /\bremember\s+(?:this\s+rule|for\s+next\s+time)\b/i,
  // Chinese frequency / behavioral — original
  /你总是/, /每次/, /又来了/, /反复/, /多少次/, /你老是/, /一直都/, /还是在做/,

  // ── C1 additions: single-occurrence rule forms that imply durability ─────
  // "please remember" — forward-facing durability marker (E26).
  // BEHAVIORAL gate ONLY (C1-rev): scheduling reminders ("please remember
  // standup is at 9:30") must not self-capture; a correction signal must
  // fire independently.
  /\bplease\s+remember\b/i,
  // "you need to learn more" — explicit learning correction (E12)
  /\bneed\s+to\s+learn\b/i,
  // "please do it for every page" — scope-of-always rule (E28)
  /\bfor\s+every\b/i,
  // "everytime" — typo form without space (E56)
  /\beverytime\b/i,
  // "not every time I give feedback and you change" — pattern negation (E12)
  /\bnot\s+every(?:\s+time|time)\b/i,
  // "instead of defaulting to sparse" — names a behavioral pattern (E22)
  /\bdefaulting\s+to\b/i,
  // "one project per PR" — unit rule ("one X per Y") (E47)
  /\bone\s+\w+\s+per\s+\w+\b/i,
  // "don't make mistakes for customers" — quality rule (E35)
  /\bdon'?t\s+make\s+mistakes\b/i,
  // Hallucination ACCUSATION — durable lesson "never invent features" (E11).
  // Accusatory frame required (C1-rev): technical prose that merely mentions
  // the word ("hallucination rate dropped to 3%") must not fire.
  /\b(?:is\s+this|that'?s|another)\s+(?:a\s+)?hallucination\b/i,
];

/**
 * Determine whether a user prompt should be captured as a behavioral correction.
 *
 * Note: `correctionHit`/`behavioralHit` are reported even for prompts of
 * length ≤ 3 (hook-ambient uses the correction gate alone as a feedback
 * signal, e.g. a bare "不对" reply); only `captured` enforces the length floor.
 *
 * @param prompt The raw user message text.
 * @returns DetectionResult with `captured=true` when both gates fire.
 */
export function detectCorrection(prompt: string): DetectionResult {
  if (!prompt) {
    return { captured: false, correctionHit: null, behavioralHit: null };
  }

  const corrPat = CORRECTION_PATTERNS.find((p) => p.test(prompt));
  const behPat = BEHAVIORAL_SIGNALS.find((p) => p.test(prompt));

  return {
    captured: corrPat !== undefined && behPat !== undefined && prompt.length > 3,
    correctionHit: corrPat ? corrPat.toString() : null,
    behavioralHit: behPat ? behPat.toString() : null,
  };
}
