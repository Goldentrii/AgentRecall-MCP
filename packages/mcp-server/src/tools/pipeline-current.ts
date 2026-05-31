import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { pipelineCurrent } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool(
    "pipeline_current",
    {
      title: "Get Currently Active Pipeline Phase",
      description:
        "Return the full content of the currently active project phase, or null if none is open. " +
        "Use to ground an agent in 'where the project is right now' at the start of a session.",
      inputSchema: {
        project: z.string().default("auto"),
      },
    },
    async ({ project }) => {
      const result = await pipelineCurrent({ project });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
