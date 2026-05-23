import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { projectBoard } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool("project_board", {
    title: "Project Status Board",
    description: "Use when the user asks to show/list AgentRecall projects, /arstatus, project status board, or what work is active.",
    inputSchema: {},
  }, async () => {
    const result = await projectBoard();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });
}
