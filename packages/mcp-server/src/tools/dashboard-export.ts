import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { dashboardExport } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool(
    "dashboard_export",
    {
      title: "Export Memory Dashboard (Agent-Readable + Human-Readable)",
      description:
        "Generate ~/.agent-recall/dashboard.json — a structured all-projects snapshot suitable for " +
        "agents to inspect their own memory state in ONE call. Includes per-project pipeline, " +
        "correction KPIs (precision / heeded / recurrence), top insights, room salience, skill " +
        "count, and a canonical naming index. Schema version 1, stable.",
      inputSchema: {
        format: z.enum(["json", "both"]).default("json"),
        inline_index_limit: z.number().int().min(0).max(2000).default(200),
      },
    },
    async (args) => {
      const result = await dashboardExport(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
