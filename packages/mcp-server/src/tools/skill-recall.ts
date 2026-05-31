import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { skillRecall } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool(
    "skill_recall",
    {
      title: "Recall Procedural Skill by Intent",
      description:
        "Find IF-THEN production rules matching your current intent. Call this before starting a " +
        "non-trivial task — if a past procedure matches, follow its steps instead of re-deriving. " +
        "Returns ranked skills with steps, postconditions, and pitfalls. Trigger-keyword + topic " +
        "match (no LLM call, deterministic ranking).",
      inputSchema: {
        intent: z.string().min(3).max(500).describe("What you're about to do (e.g. 'set up Cloudflare DNS for new domain')."),
        limit: z.number().int().min(1).max(20).default(5),
        project: z.string().max(100).default("auto"),
      },
    },
    async (args) => {
      const result = await skillRecall(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
