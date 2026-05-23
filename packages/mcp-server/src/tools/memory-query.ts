import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { memoryQuery } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool("memory_query", {
    title: "Memory Query",
    description: "Use when the user asks to search across all memory stores with a natural language query.",
    inputSchema: {
      intent: z.string().describe("What you are about to do or decide. Be specific: 'push to npm', 'modify the auth middleware', 'call the Novada search API'."),
      project: z.string().default("auto"),
      min_confidence: z.enum(["high", "medium", "low"]).default("medium").describe("Minimum confidence threshold. 'high' = very relevant only. 'low' = broader, more noise."),
      limit: z.number().int().min(1).max(10).default(5),
    },
  }, async ({ intent, project, min_confidence, limit }) => {
    try {
      const result = await memoryQuery({ intent, project, min_confidence, limit });

      if (result.empty) {
        return {
          content: [{
            type: "text" as const,
            text: result.guidance ?? `No relevant memory found for: "${intent}". Proceed normally.`,
          }],
        };
      }

      const lines: string[] = [];
      for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i];
        const conf = r.confidence.toUpperCase().slice(0, 3);
        const room = r.room ? `/${r.room}` : "";
        const excerpt = r.excerpt ? ` — ${r.excerpt.replace(/\n/g, " ").slice(0, 80)}` : "";
        lines.push(`[${i + 1}][${r.source}${room}][${conf}] ${r.title}${excerpt}`);
      }
      // Feedback nudge
      lines.push("");
      lines.push("— Rate these on next recall() to improve future ranking:");
      lines.push(`  IDs: ${result.results.map((r, i) => `${i + 1}=${r.id}`).join("  ")}`);

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `memory_query failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}
