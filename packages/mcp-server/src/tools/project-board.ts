import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { projectBoard, renderBoard } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool("project_board", {
    title: "Project Status Board",
    description: "Use when the user asks to show/list AgentRecall projects, /arstatus, project status board, or what work is active.",
    inputSchema: {
      format: z.enum(["json", "text"]).default("json"),
    },
  }, async (args) => {
    const result = await projectBoard();
    if (args.format === "text") {
      const boardWidth = process.stdout.columns
        ? Math.min(110, Math.max(80, process.stdout.columns))
        : 100;
      const text = renderBoard(result, { boardWidth });
      return { content: [{ type: "text" as const, text }] };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });
}
