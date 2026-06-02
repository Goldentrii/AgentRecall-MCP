import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { checkAction } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool(
    "check_action",
    {
      title: "Pre-action Proactive Matcher",
      description:
        "Call BEFORE any non-trivial action (publish, push, deploy, schema change, file delete, " +
        "send message, modify config). Pass a one-sentence description of what you're about to do. " +
        "Returns matching behavior rules + active corrections + high-salience insights — a short " +
        "list of memory items that would otherwise be re-derived or forgotten. Deterministic keyword " +
        "match (no LLM call), runs in <50 ms. If `warning` is non-null, READ IT before acting.",
      inputSchema: {
        action_description: z
          .string()
          .min(3)
          .max(500)
          .describe("What you're about to do — one sentence, specific (e.g. 'publish agent-recall-mcp@3.5.0 to npm')."),
        min_overlap: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(2)
          .describe("Minimum overlapping tokens between action and memory item. Default 2 (signal floor for relevance). Lower to 1 for permissive matching, raise to 3+ for strict."),
        project: z.string().max(100).default("auto"),
      },
    },
    async ({ action_description, min_overlap, project }) => {
      const result = await checkAction({ action_description, min_overlap, project });
      const primary = result.warning
        ? result.warning
        : `No matching rules/corrections/insights for: ${action_description}`;
      return {
        content: [
          { type: "text" as const, text: primary },
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: result.success,
                project: result.project,
                rules_matched: result.matching_rules.length,
                corrections_matched: result.matching_corrections.length,
                insights_matched: result.matching_insights.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
