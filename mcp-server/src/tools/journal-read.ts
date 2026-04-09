import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { resolveProject } from "../storage/project.js";
import { listJournalFiles, readJournalFile } from "../helpers/journal-files.js";
import { extractSection } from "../helpers/sections.js";

export function register(server: McpServer): void {
  server.registerTool("journal_read", {
    title: "Read Journal Entry",
    description:
      "Read a journal entry. Returns the full file content for agent cold-start. Use date='latest' for the most recent entry.",
    inputSchema: {
      date: z
        .string()
        .default("latest")
        .describe(
          "ISO date string YYYY-MM-DD. Defaults to 'latest'. Use 'latest' for most recent entry."
        ),
      project: z
        .string()
        .default("auto")
        .describe(
          "Project slug (directory name under ~/.agent-recall/projects/). Defaults to current git repo name."
        ),
      section: z
        .enum([
          "all", "brief", "qa", "completed", "status", "blockers",
          "next", "decisions", "reflection", "files", "observations",
        ])
        .default("all")
        .describe(
          "Which section to return. 'brief' returns only the cold-start summary. 'all' returns full file."
        ),
    },
  }, async ({ date, project, section }) => {
    const slug = await resolveProject(project);
    let targetDate = date;

    if (targetDate === "latest") {
      const entries = listJournalFiles(slug);
      if (entries.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `No journal entries found for project '${slug}'`,
              project: slug,
            }),
          }],
          isError: true,
        };
      }
      targetDate = entries[0].date;
    }

    const fileContent = readJournalFile(slug, targetDate);
    if (!fileContent) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `No journal entry found for ${targetDate} in project '${slug}'`,
            project: slug,
            date: targetDate,
          }),
        }],
        isError: true,
      };
    }

    const extracted = extractSection(fileContent, section);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          content: extracted || "",
          date: targetDate,
          project: slug,
        }),
      }],
    };
  });
}
