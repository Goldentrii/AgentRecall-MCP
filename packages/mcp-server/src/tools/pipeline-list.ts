import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { pipelineList } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool(
    "pipeline_list",
    {
      title: "List Project Pipeline Phases",
      description:
        "List all project phases (milestones) in order — the project's narrative spine. " +
        "Returns order, phase name, status, opened/closed timestamps, and synthesis (when closed).",
      inputSchema: {
        project: z.string().default("auto"),
      },
    },
    async ({ project }) => {
      const result = await pipelineList({ project });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
