import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDirs, palaceDir } from "../storage/paths.js";
import { ensurePalaceInitialized, listRooms } from "../palace/rooms.js";

export function register(server: McpServer): void {
  server.registerTool("journal_search", {
    title: "Search Journals",
    description: "Full-text search across all journal entries for a project.",
    inputSchema: {
      query: z.string().describe("Search term (plain text, case-insensitive)"),
      project: z
        .string()
        .default("auto")
        .describe("Project slug. Defaults to auto-detect."),
      section: z
        .string()
        .optional()
        .describe("Limit search to a specific section type."),
      include_palace: z.boolean().default(false)
        .describe("Also search palace rooms (slower but more comprehensive)"),
    },
  }, async ({ query, project, section, include_palace }) => {
    const slug = await resolveProject(project);
    const dirs = journalDirs(slug);
    const queryLower = query.toLowerCase();

    const results: Array<{
      date: string;
      section: string;
      excerpt: string;
      line: number;
    }> = [];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        let currentSection = "top";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith("## ")) {
            currentSection = line
              .slice(3)
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "_");
          }

          if (section && currentSection !== section.toLowerCase()) {
            continue;
          }

          if (line.toLowerCase().includes(queryLower)) {
            const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : file;

            const start = Math.max(0, line.toLowerCase().indexOf(queryLower) - 40);
            const end = Math.min(
              line.length,
              line.toLowerCase().indexOf(queryLower) + query.length + 40
            );
            let excerpt = line.slice(start, end).trim();
            if (start > 0) excerpt = "..." + excerpt;
            if (end < line.length) excerpt = excerpt + "...";

            results.push({ date, section: currentSection, excerpt, line: i + 1 });
          }
        }
      }
    }

    // Palace search
    if (include_palace) {
      try {
        ensurePalaceInitialized(slug);
        const pd = palaceDir(slug);
        const rooms = listRooms(slug);

        for (const room of rooms) {
          const roomPath = path.join(pd, "rooms", room.slug);
          if (!fs.existsSync(roomPath)) continue;
          const files = fs.readdirSync(roomPath).filter((f) => f.endsWith(".md"));

          for (const file of files) {
            const filePath = path.join(roomPath, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(queryLower)) {
                const start = Math.max(0, lines[i].toLowerCase().indexOf(queryLower) - 40);
                const end = Math.min(lines[i].length, lines[i].toLowerCase().indexOf(queryLower) + query.length + 40);
                let excerpt = lines[i].slice(start, end).trim();
                if (start > 0) excerpt = "..." + excerpt;
                if (end < lines[i].length) excerpt = excerpt + "...";

                results.push({
                  date: `palace:${room.slug}`,
                  section: file.replace(".md", ""),
                  excerpt,
                  line: i + 1,
                });
              }
            }
          }
        }
      } catch {
        // Palace search is optional
      }
    }

    results.sort((a, b) => b.date.localeCompare(a.date));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ results }),
      }],
    };
  });
}
