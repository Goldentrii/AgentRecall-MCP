import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { skillList } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool(
    "skill_list",
    {
      title: "List All Procedural Skills",
      description:
        "List every procedural skill saved for the project. Returns slug/name/topic/triggers — " +
        "use to browse the available how-to library.",
      inputSchema: {
        project: z.string().max(100).default("auto"),
      },
    },
    async (args) => {
      const result = await skillList(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
