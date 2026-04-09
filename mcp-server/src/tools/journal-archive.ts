import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDir } from "../storage/paths.js";
import { ensureDir } from "../storage/fs-utils.js";
import { listJournalFiles, updateIndex } from "../helpers/journal-files.js";
import { extractSection } from "../helpers/sections.js";
import { stateFilePath } from "./journal-state.js";

export function register(server: McpServer): void {
  server.registerTool("journal_archive", {
    title: "Archive Old Entries",
    description:
      "Move entries older than N days to cold archive. Keeps a one-line summary per archived entry. " +
      "Use after a project milestone or when journal count gets too high.",
    inputSchema: {
      older_than_days: z.number().int().default(7).describe("Archive entries older than this many days"),
      project: z.string().default("auto"),
    },
  }, async ({ older_than_days, project }) => {
    const slug = await resolveProject(project);
    const entries = listJournalFiles(slug);
    const dir = journalDir(slug);
    const archiveDir = path.join(dir, "archive");
    ensureDir(archiveDir);

    let archived = 0;
    const summaries: string[] = [];

    for (const entry of entries) {
      const ageMs = Date.now() - new Date(entry.date).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (ageDays > older_than_days) {
        const srcPath = path.join(entry.dir, entry.file);
        const content = fs.readFileSync(srcPath, "utf-8");
        const brief = extractSection(content, "brief");
        const firstLine = brief?.split("\n").find(l => l.trim().length > 0) ?? "(no brief)";

        const destPath = path.join(archiveDir, entry.file);
        fs.copyFileSync(srcPath, destPath);
        fs.unlinkSync(srcPath);

        const stateSrc = stateFilePath(slug, entry.date);
        if (fs.existsSync(stateSrc)) {
          const stateDest = path.join(archiveDir, `${entry.date}.state.json`);
          fs.copyFileSync(stateSrc, stateDest);
          fs.unlinkSync(stateSrc);
        }

        summaries.push(`${entry.date}: ${firstLine}`);
        archived++;
      }
    }

    if (summaries.length > 0) {
      const indexPath = path.join(archiveDir, "index.md");
      const existing = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf-8") : "# Archive\n\n";
      fs.writeFileSync(indexPath, existing + summaries.join("\n") + "\n", "utf-8");
    }

    updateIndex(slug);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ archived, summaries, archive_dir: archiveDir }),
      }],
    };
  });
}
