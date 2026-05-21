/**
 * LocalVectorRecallBackend — semantic recall using local vectra index.
 *
 * Selected when OPENAI_API_KEY is set and no Supabase config is present.
 * Falls back to an empty result set (not an error) when embedding fails or
 * the index has no data yet — the caller (smartRecall) will then use
 * keyword search as a safety net.
 */

import { embed } from "./embedding.js";
import { queryVector } from "./local-vector-store.js";
import type { SmartRecallResultItem } from "../tools-logic/smart-recall.js";

function scoreLabel(score: number): string {
  if (score >= 0.80) return "high";
  if (score >= 0.65) return "medium";
  if (score >= 0.50) return "low";
  return "weak";
}

export class LocalVectorRecallBackend {
  available(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async search(
    query: string,
    project: string | undefined,
    limit: number
  ): Promise<SmartRecallResultItem[]> {
    if (!project) return [];

    const embedding = await embed(query);
    if (!embedding) {
      // No API key or embed failed — signal empty so smartRecall uses keyword fallback
      return [];
    }

    const hits = await queryVector(project, embedding, limit);

    return hits.map((h) => ({
      id: h.id,
      source: h.source,
      title: h.title,
      excerpt: h.excerpt,
      score: h.score,
      confidence: scoreLabel(h.score),
    }));
  }
}
