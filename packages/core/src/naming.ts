/**
 * AgentRecall Naming System v1
 * ============================
 *
 * Unified naming grammar so any agent (Claude, Codex, GPT, future) can
 * retrieve memory by composing predictable paths instead of grepping
 * five inconsistent conventions.
 *
 * # Grammar
 *
 *   <scope>/<type>/[<topic>/]<temporal>--<slug>.md
 *
 *   scope    project | global
 *   type     episodic | semantic | procedural | narrative | correction | insight
 *   topic    optional sub-category (e.g. "deploy" for procedural skills)
 *   temporal ISO date (YYYY-MM-DD), ISO datetime, or ordered NNNN
 *   slug     kebab-case, lowercase, <= 40 chars
 *
 * # Examples
 *
 *   prismma-gateway/episodic/2026-05-30--cloudflare-dns-fix.md
 *   prismma-gateway/semantic/routing--cloudflare-zone-config.md
 *   prismma-gateway/procedural/deploy--cloudflare-4step-pattern.md
 *   prismma-gateway/narrative/0007--ssl-regression-fix.md
 *   prismma-gateway/correction/2026-05-29T11:00--no-push-without-permission.md
 *   global/insight/correction-first-memory-pattern.md
 *
 * # Why this grammar
 *
 *   1. Type maps to formal memory taxonomy (episodic/semantic/procedural)
 *      so layers carve at canonical joints (Squire 2004, Tulving 1972).
 *   2. Temporal prefix sorts numerically/chronologically by default.
 *   3. Slug is grep-friendly: `grep -r "cloudflare" ~/.agent-recall/projects/`
 *      finds every reference regardless of layer.
 *   4. Compositional: an agent can construct paths from intent without
 *      asking "what room does this go in?"
 *
 * # Legacy compatibility
 *
 * Existing paths (palace/rooms/*, palace/pipeline/*, journal/*) continue
 * to work. New writes can opt into this grammar via canonicalPath();
 * readers should fall back from new → legacy.
 */

import { sanitizeName } from "./storage/sanitize.js";
import { PROJECTS_DIRNAME } from "./storage/paths.js";

export type MemoryScope = "project" | "global";
export type MemoryType = "episodic" | "semantic" | "procedural" | "narrative" | "correction" | "insight";

export interface CanonicalName {
  scope: MemoryScope;
  project?: string;        // required when scope = "project"
  type: MemoryType;
  topic?: string;          // optional sub-category
  temporal: string;        // ISO date, ISO datetime, or NNNN
  slug: string;            // kebab-case
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * Temporal accepts:
 *   YYYY-MM-DD              — calendar date
 *   YYYY-MM-DDTHH:MM[:SS]   — calendar datetime
 *   NNNN with leading zero  — 4-digit ordinal (0001..0999)
 *     restricted to leading-zero to prevent collision with bare YYYY years.
 *     pipeline / skill ordinals realistically won't exceed 999.
 */
const TEMPORAL_REGEX = /^(?:\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?|0\d{3})$/;

/**
 * Convert any input to a safe kebab-case slug, byte-capped at `maxBytes`
 * (naming-v2 spec §2 — was a UTF-16 char-slice, now byte-safe so a CJK/emoji
 * slug can't exceed the filesystem's byte-budget). No dots (prevents
 * traversal), no upper, no special chars. Delegates to the shared v2
 * sanitizer (storage/sanitize.ts) so this grammar can't call-site-diverge
 * from paths.ts/session.ts/corrections.ts.
 *
 * Param renamed maxLen → maxBytes (v2): existing positional callers are
 * unaffected since the argument is still "a length cap in the 30-100 range".
 */
export function toSlug(input: string, maxBytes = 40): string {
  return sanitizeName(input, maxBytes);
}

/**
 * Build a canonical filesystem-safe path fragment from a CanonicalName.
 * Returns just the relative path under the agent-recall root.
 */
export function canonicalPath(name: CanonicalName): string {
  validateCanonicalName(name);
  const parts: string[] = [];
  if (name.scope === "global") {
    parts.push("global", name.type);
  } else {
    if (!name.project) throw new Error("project required for scope=project");
    // F2 guard-test hygiene (independent review, 2026-07-20): route the
    // "projects" directory-name literal through paths.ts's shared constant.
    // Note: canonicalPath is a pure string builder (no fs access, no root) —
    // there is no resolveProjectDirName concern here since nothing is
    // written; this is purely about not re-inlining the literal.
    parts.push(PROJECTS_DIRNAME, toSlug(name.project, 100), name.type);
  }
  // topic--temporal--slug.md or temporal--slug.md
  const fileParts: string[] = [];
  if (name.topic) fileParts.push(toSlug(name.topic, 30));
  fileParts.push(name.temporal);
  fileParts.push(name.slug);
  parts.push(fileParts.join("--") + ".md");
  return parts.join("/");
}

/**
 * Parse a canonical filename back into its components.
 * Returns null if the filename does not match the canonical grammar.
 */
export function parseCanonicalName(filePath: string): CanonicalName | null {
  // Strip leading projects/<x>/<type>/ or global/<type>/ + .md
  const m = filePath.match(/^(?:projects\/([^/]+)|global)\/([^/]+)\/([^/]+)\.md$/);
  if (!m) return null;
  const project = m[1] ?? undefined;
  const type = m[2] as MemoryType;
  if (!isValidType(type)) return null;
  const filename = m[3];
  const segments = filename.split("--");
  if (segments.length < 2 || segments.length > 3) return null;

  let topic: string | undefined;
  let temporal: string;
  let slug: string;
  if (segments.length === 3) {
    [topic, temporal, slug] = segments;
  } else {
    [temporal, slug] = segments;
  }
  if (!TEMPORAL_REGEX.test(temporal)) return null;
  if (!SLUG_REGEX.test(slug)) return null;
  if (topic && !SLUG_REGEX.test(topic)) return null;
  return {
    scope: project ? "project" : "global",
    project,
    type,
    topic,
    temporal,
    slug,
  };
}

/**
 * Validate a CanonicalName, throwing with a precise reason if invalid.
 */
export function validateCanonicalName(name: CanonicalName): void {
  if (!isValidType(name.type)) {
    throw new Error(`Invalid memory type: ${name.type}`);
  }
  if (name.scope === "project" && !name.project) {
    throw new Error("project required when scope=project");
  }
  if (!TEMPORAL_REGEX.test(name.temporal)) {
    throw new Error(`Invalid temporal segment: ${name.temporal} (use YYYY-MM-DD, YYYY-MM-DDTHH:MM, or 4-digit ordinal)`);
  }
  if (!SLUG_REGEX.test(name.slug)) {
    throw new Error(`Invalid slug: ${name.slug} (use kebab-case lowercase)`);
  }
  if (name.topic && !SLUG_REGEX.test(name.topic)) {
    throw new Error(`Invalid topic: ${name.topic} (use kebab-case lowercase)`);
  }
}

export function isValidType(t: string): t is MemoryType {
  return ["episodic", "semantic", "procedural", "narrative", "correction", "insight"].includes(t);
}

/**
 * Index entry used by dashboard.json and Supabase mirror.
 * Stable shape any agent can query.
 *
 * IMPORTANT: `canonical_path` is a VIRTUAL KEY, not necessarily a real file
 * path on disk today. AgentRecall still stores under legacy paths (e.g.
 * `palace/pipeline/0001-Discovery.md`); the canonical view is synthesized at
 * read time. Use `legacy_path` (when present) to actually open the file.
 * The canonical view is for indexing, querying, and ranking — not direct fs.
 */
export interface NamingIndexEntry {
  canonical_path: string;
  /** Real on-disk path if it differs from canonical_path (during legacy → canonical transition). */
  legacy_path?: string;
  scope: MemoryScope;
  project: string | null;
  type: MemoryType;
  topic: string | null;
  temporal: string;
  slug: string;
  /** Free-text title/headline if available */
  headline?: string;
  /** ISO timestamp of last write */
  updated_at?: string;
}

/**
 * Build a NamingIndexEntry from a canonical filename + headline.
 * Returns null if filename does not match the canonical grammar.
 */
export function buildIndexEntry(filePath: string, headline?: string, updatedAt?: string): NamingIndexEntry | null {
  const parsed = parseCanonicalName(filePath);
  if (!parsed) return null;
  return {
    canonical_path: filePath,
    scope: parsed.scope,
    project: parsed.project ?? null,
    type: parsed.type,
    topic: parsed.topic ?? null,
    temporal: parsed.temporal,
    slug: parsed.slug,
    headline,
    updated_at: updatedAt,
  };
}

/**
 * Map a legacy AgentRecall path to its closest canonical type.
 * Used during migration scanning.
 */
export function legacyToCanonicalType(legacyPath: string): MemoryType | null {
  if (legacyPath.includes("/journal/")) return "episodic";
  if (legacyPath.includes("/palace/pipeline/")) return "narrative";
  if (legacyPath.includes("/palace/awareness")) return "insight";
  if (legacyPath.includes("/palace/rooms/")) return "semantic";
  if (legacyPath.includes("/corrections/")) return "correction";
  if (legacyPath.includes("/palace/skills/")) return "procedural";
  return null;
}
