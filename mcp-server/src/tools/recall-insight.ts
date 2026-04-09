/**
 * Tool: recall_insight — Recall relevant insights for the current task.
 *
 * Cross-project: searches the global insights index.
 * Returns insights ranked by relevance to the given context.
 */

import * as z from "zod/v4";
import type { ServerType } from "../server.js";
import { recallInsights } from "../palace/insights-index.js";
import { readAwareness } from "../palace/awareness.js";

export function register(server: ServerType): void {
  server.registerTool("recall_insight", {
    title: "Recall Relevant Insights",
    description:
      "Before starting a task, recall cross-project insights that apply. " +
      "Matches your task description against the insights index. " +
      "Also returns the current awareness summary.",
    inputSchema: {
      context: z.string().describe("Describe the current task or situation (1-2 sentences)"),
      limit: z.number().int().default(5).describe("Max insights to return"),
      include_awareness: z.boolean().default(true).describe("Also return the awareness.md summary"),
    },
  }, async ({ context, limit, include_awareness }) => {
    const insights = recallInsights(context, limit);

    let awareness: string | null = null;
    if (include_awareness) {
      const raw = readAwareness();
      if (raw) {
        // Return first 100 lines (identity + top insights + trajectory)
        awareness = raw.split("\n").slice(0, 100).join("\n");
      }
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          context,
          matching_insights: insights.map((i) => ({
            title: i.title,
            relevance: Math.round(i.relevance * 100) / 100,
            severity: i.severity,
            applies_when: i.applies_when,
            confirmed: i.confirmed_count,
            file: i.file ?? null,
          })),
          total_in_index: (await import("../palace/insights-index.js")).readInsightsIndex().insights.length,
          awareness: awareness,
        }),
      }],
    };
  });
}
