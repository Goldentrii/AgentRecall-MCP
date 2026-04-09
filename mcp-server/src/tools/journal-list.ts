import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { listJournalFiles, extractTitle, extractMomentum } from "../helpers/journal-files.js";

export function register(server: McpServer): void {
  server.registerTool("journal_list", {
    title: "List Journal Entries",
    description: "List available journal entries for a project.",
    inputSchema: {
      project: z
        .string()
        .default("auto")
        .describe("Project slug. Defaults to auto-detect."),
      limit: z
        .number()
        .int()
        .default(10)
        .describe("Return the N most recent entries. 0 = all."),
    },
  }, async ({ project, limit }) => {
    const slug = await resolveProject(project);
    let entries = listJournalFiles(slug);

    if (limit > 0) {
      entries = entries.slice(0, limit);
    }

    const result = entries.map((e) => {
      const content = fs.readFileSync(path.join(e.dir, e.file), "utf-8");
      return {
        date: e.date,
        title: extractTitle(content),
        momentum: extractMomentum(content),
      };
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ project: slug, entries: result }),
      }],
    };
  });
}
