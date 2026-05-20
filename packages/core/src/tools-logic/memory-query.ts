/**
 * memory_query — on-demand, intent-scoped recall.
 *
 * Unlike `recall` (general search), this is called mid-task:
 *   "I'm about to do X — what should I know?"
 *
 * Only returns high/medium confidence results. Designed for pull-on-demand
 * retrieval rather than push-on-start injection.
 */

import { smartRecall } from "./smart-recall.js";
import { resolveProject } from "../storage/project.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryQueryInput {
  /** Describe what you're about to do or decide. e.g. "push to npm" or "modify auth middleware" */
  intent: string;
  project?: string;
  /** Minimum confidence to include in results. Default: "medium" */
  min_confidence?: "high" | "medium" | "low";
  /** Max results. Default: 5 */
  limit?: number;
}

export interface MemoryQueryItem {
  id: string;
  source: "palace" | "journal" | "insight";
  title: string;
  excerpt: string;
  confidence: string;
  room?: string;
}

export interface MemoryQueryResult {
  intent: string;
  project: string;
  results: MemoryQueryItem[];
  /** True when no memory is relevant to this intent at the given confidence threshold. */
  empty: boolean;
  guidance?: string;
}

// ---------------------------------------------------------------------------
// Score threshold per confidence level
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD: Record<string, number> = {
  high: 0.10,
  medium: 0.05,
  low: 0.03,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function memoryQuery(input: MemoryQueryInput): Promise<MemoryQueryResult> {
  const project = await resolveProject(input.project);
  const minScore = CONFIDENCE_THRESHOLD[input.min_confidence ?? "medium"] ?? 0.05;
  const limit = input.limit ?? 5;

  const recalled = await smartRecall({
    query: input.intent,
    project,
    limit: limit * 2,  // over-fetch then filter by confidence
  });

  const filtered = recalled.results
    .filter((r) => r.score >= minScore)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      source: r.source,
      title: r.title,
      excerpt: r.excerpt,
      confidence: r.confidence,
      room: r.room,
    }));

  return {
    intent: input.intent,
    project,
    results: filtered,
    empty: filtered.length === 0,
    guidance: filtered.length === 0
      ? `No memory found relevant to: "${input.intent}". This may be a new area — proceed with standard caution.`
      : undefined,
  };
}
