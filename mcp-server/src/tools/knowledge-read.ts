import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export function register(server: McpServer): void {
  server.registerTool("knowledge_read", {
    title: "Read Knowledge Lessons",
    description:
      "Read lessons from knowledge files. Used before starting work to learn from past mistakes. " +
      "Can filter by project, category, and search query.",
    inputSchema: {
      project: z.string().optional().describe("Specific project, or omit for all projects"),
      category: z
        .enum(["extraction", "build", "verification", "tools", "general"])
        .optional()
        .describe("Specific category, or omit for all categories"),
      query: z.string().optional().describe("Search term to filter lessons (case-insensitive)"),
    },
  }, async ({ project, category, query }) => {
    const baseDir = process.env.AGENT_RECALL_DIR || path.join(os.homedir(), ".agent-recall");
    const projectsDir = path.join(baseDir, "projects");

    let projectDirs: Array<{ slug: string; dir: string }> = [];

    if (project) {
      const safe = project.replace(/[^a-zA-Z0-9_\-\.]/g, "-");
      const dir = path.join(projectsDir, safe, "knowledge");
      if (fs.existsSync(dir)) {
        projectDirs.push({ slug: safe, dir });
      }
    } else {
      if (fs.existsSync(projectsDir)) {
        try {
          const entries = fs.readdirSync(projectsDir);
          for (const entry of entries) {
            const dir = path.join(projectsDir, entry, "knowledge");
            if (fs.existsSync(dir)) {
              projectDirs.push({ slug: entry, dir });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (projectDirs.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No knowledge entries found. Start logging lessons with knowledge_write.",
        }],
      };
    }

    const categories = category
      ? [`${category}.md`]
      : ["extraction.md", "build.md", "verification.md", "tools.md", "general.md"];

    let combined = "";

    for (const pd of projectDirs) {
      for (const catFile of categories) {
        const filePath = path.join(pd.dir, catFile);
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");

        if (query) {
          const queryLower = query.toLowerCase();
          const lines = content.split("\n");
          const matchedEntries: string[] = [];
          let currentEntry: string[] = [];

          for (const line of lines) {
            if (line.startsWith("### ")) {
              if (currentEntry.length > 0) {
                const entryText = currentEntry.join("\n");
                if (entryText.toLowerCase().includes(queryLower)) {
                  matchedEntries.push(entryText);
                }
              }
              currentEntry = [line];
            } else {
              currentEntry.push(line);
            }
          }
          if (currentEntry.length > 0) {
            const entryText = currentEntry.join("\n");
            if (entryText.toLowerCase().includes(queryLower)) {
              matchedEntries.push(entryText);
            }
          }

          if (matchedEntries.length > 0) {
            combined += `\n## ${pd.slug} / ${catFile.replace(".md", "")}\n\n`;
            combined += matchedEntries.join("\n") + "\n";
          }
        } else {
          combined += `\n## ${pd.slug} / ${catFile.replace(".md", "")}\n\n`;
          combined += content + "\n";
        }
      }
    }

    if (!combined.trim()) {
      return {
        content: [{
          type: "text" as const,
          text: "No knowledge entries found. Start logging lessons with knowledge_write.",
        }],
      };
    }

    if (combined.length > 5000) {
      combined = combined.slice(0, 5000) + "\n\n...(truncated, narrow your query for more)";
    }

    return {
      content: [{
        type: "text" as const,
        text: combined,
      }],
    };
  });
}
