import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { memoryQuery } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool("memory_query", {
    title: "Memory Query",
    description: [
      "On-demand, intent-scoped recall. Call this mid-task when you recognize you're about to make",
      "a decision that may have prior context — e.g. before pushing code, modifying auth, or calling an API.",
      "",
      "Unlike `recall` (general search), memory_query takes a description of what you're ABOUT TO DO",
      "and returns only high/medium confidence results relevant to that intent.",
      "",
      "Examples:",
      "  memory_query({ intent: 'push to npm' })         → surfaces 'never publish without approval'",
      "  memory_query({ intent: 'modify auth middleware' }) → surfaces past auth gotchas",
      "  memory_query({ intent: 'call Novada search API' })  → surfaces API behavior notes",
      "",
      "Use this as a lightweight pre-action check. If empty:true, no prior context exists — proceed normally.",
    ].join("\n"),
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

      const lines: string[] = [
        `[memory_query] Intent: "${result.intent}" | Project: ${result.project}`,
        "",
      ];
      for (const r of result.results) {
        const room = r.room ? ` (${r.room})` : "";
        lines.push(`[${r.source}][${r.confidence.toUpperCase()}]${room} ${r.title}`);
        if (r.excerpt) {
          lines.push(`  ${r.excerpt.replace(/\n/g, " ").slice(0, 150)}`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `memory_query failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}
