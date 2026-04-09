import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JOURNAL_ROOT } from "../types.js";
import { listAllProjects } from "../storage/project.js";

export function register(server: McpServer): void {
  server.registerTool("journal_projects", {
    title: "List Projects",
    description: "List all projects tracked by agent-recall on this machine.",
    inputSchema: {},
  }, async () => {
    const projects = listAllProjects();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          projects: projects.map((p) => ({
            slug: p.slug,
            last_entry: p.lastEntry,
            entry_count: p.entryCount,
          })),
          journal_root: JOURNAL_ROOT,
        }),
      }],
    };
  });
}
