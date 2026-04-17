import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { sessionStart } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool("session_start", {
    title: "Start Session",
    description: "Load project context for a new session. Returns identity, insights, active rooms, and recent activity in one call.",
    inputSchema: {
      project: z.string().default("auto"),
      context: z.string().optional().describe("Optional context for matching cross-project insights"),
    },
  }, async ({ project, context }) => {
    const result = await sessionStart({ project, context });
    // Include corrections in the MCP output so agents see P0 rules at session start
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  });
}
