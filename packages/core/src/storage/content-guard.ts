/**
 * content-guard.ts — pre-sync content scrubbing for opt-in cloud users.
 *
 * Applied BEFORE any journalWrite → syncToSupabase call so that secrets and
 * prompt-injection attempts do not reach Supabase or the embedding API.
 *
 * Two-layer scrub:
 *   1. scrubPromptInjection — strip XML system-marker tags, bidi overrides,
 *      null bytes, and explicit injection phrases. Extracted from bootstrap.ts
 *      and re-exported here so journal-write/palace-write can import from a
 *      single source of truth.
 *   2. scrubSecretContent — redact known secret token prefixes (AKIA…, ghp_…,
 *      gho_…, ghs_…, sk-…, xoxb-…, PEM markers). Operates on content, not
 *      filenames (bootstrap.ts isSecretFile() handles filename-level rejection).
 *
 * scrubForCloud(content) = scrubSecretContent(scrubPromptInjection(content))
 *
 * Design guarantees:
 *   - Never throws — any failure returns the original content unchanged.
 *   - Pure function, no I/O, no Supabase imports.
 *   - Returns a SecretScanResult so callers can log/block if desired.
 *
 * Usage: call scrubForCloud(content) in journal-write.ts and palace-write.ts
 * before passing content to syncToSupabase.
 */

// ---------------------------------------------------------------------------
// Layer 1 — prompt-injection scrub (re-export from bootstrap logic)
// ---------------------------------------------------------------------------

/**
 * Strip prompt-injection patterns from content before it leaves the machine.
 * Same logic as bootstrap.ts:scrubPromptInjection but exported here for
 * journal-write and palace-write to use at sync time.
 */
export function scrubPromptInjection(s: string): string {
  try {
    return s
      .replace(
        /<\/?\s*(system[-_]?(reminder|prompt|message|instruction)|important|critical)\b[^>]*>/gi,
        "[stripped tag]",
      )
      .replace(/<\|im_(start|end)\|>/gi, "[stripped]")
      .replace(
        /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|messages?)/gi,
        "[stripped injection attempt]",
      )
      .replace(/[‪-‮⁦-⁩]/g, "") // bidi override chars
      .replace(/\0/g, ""); // null bytes
  } catch {
    return s;
  }
}

// ---------------------------------------------------------------------------
// Layer 2 — content-level secret scan
// ---------------------------------------------------------------------------

/**
 * Patterns that match known secret token prefixes / PEM markers in CONTENT.
 * Complements isSecretFile() in bootstrap.ts which tests filenames only.
 *
 * Prefix list (grounding: packages/core/src/supabase/sync.ts risk analysis):
 *   AKIA…        — AWS access key
 *   ghp_…        — GitHub personal access token
 *   gho_…        — GitHub OAuth token
 *   ghs_…        — GitHub app installation token
 *   sk-…         — OpenAI / Anthropic secret key (≥20 chars to avoid false-positives)
 *   xoxb-…       — Slack bot token
 *   xoxp-…       — Slack user token
 *   -----BEGIN … KEY/CERTIFICATE— PEM markers
 */
// NOTE: generic `Authorization: Bearer <jwt>` is intentionally NOT scanned here.
// JWTs are short-lived and the pattern has a very high false-positive rate on
// normal journal content. This is a documented scope decision, not a silent gap.
const SECRET_CONTENT_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\bAKIA[0-9A-Z]{16,}\b/g,          label: "AWS access key" },
  { re: /\bghp_[A-Za-z0-9_]{20,}\b/g,      label: "GitHub PAT (ghp_)" },
  { re: /\bgho_[A-Za-z0-9_]{20,}\b/g,      label: "GitHub OAuth token (gho_)" },
  { re: /\bghs_[A-Za-z0-9_]{20,}\b/g,      label: "GitHub app token (ghs_)" },
  { re: /\bsk-[A-Za-z0-9\-_]{20,}\b/g,     label: "OpenAI/Anthropic secret key (sk-)" },
  { re: /\bxoxb-[A-Za-z0-9\-]{20,}\b/g,    label: "Slack bot token (xoxb-)" },
  { re: /\bxoxp-[A-Za-z0-9\-]{20,}\b/g,    label: "Slack user token (xoxp-)" },
  { re: /\bnpm_[A-Za-z0-9]{20,}\b/g,        label: "npm registry token" },
  { re: /_authToken=[^\s"'\r\n]{8,}/g,       label: "npm _authToken (.npmrc)" },
  {
    re: /-----BEGIN\s+(?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?-----END\s+(?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?(?:PRIVATE KEY|CERTIFICATE)-----/g,
    label: "PEM private key/certificate block",
  },
];

const REDACTED_PLACEHOLDER = "[REDACTED-SECRET]";

export interface SecretScanResult {
  /** Content after redaction (same as input if nothing was found). */
  content: string;
  /** Number of secret patterns found and redacted. */
  redactedCount: number;
  /** Which labels were found (for logging). */
  labels: string[];
}

/**
 * Scan content for known secret token patterns and redact them in-place.
 * Returns the redacted content and a count of how many matches were replaced.
 */
export function scrubSecretContent(content: string): SecretScanResult {
  try {
    let result = content;
    let redactedCount = 0;
    const labels: string[] = [];

    for (const { re, label } of SECRET_CONTENT_PATTERNS) {
      // Reset lastIndex for global regexes (they carry state across calls if reused).
      re.lastIndex = 0;
      const matches = result.match(re);
      if (matches && matches.length > 0) {
        re.lastIndex = 0;
        result = result.replace(re, REDACTED_PLACEHOLDER);
        redactedCount += matches.length;
        labels.push(label);
      }
    }

    return { content: result, redactedCount, labels };
  } catch {
    // Never throw — return original content on error.
    return { content, redactedCount: 0, labels: [] };
  }
}

// ---------------------------------------------------------------------------
// Composite scrub — the single call site for journal-write / palace-write
// ---------------------------------------------------------------------------

/**
 * scrubForCloud(content) applies both layers in order:
 *   1. scrubPromptInjection  — removes injection/override attempts
 *   2. scrubSecretContent    — redacts known secret token patterns
 *
 * Returns the sanitised string. Never throws.
 */
export function scrubForCloud(content: string): string {
  try {
    const afterInjection = scrubPromptInjection(content);
    const { content: afterSecrets } = scrubSecretContent(afterInjection);
    return afterSecrets;
  } catch {
    return content;
  }
}
