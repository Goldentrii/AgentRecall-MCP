import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { listJournalFiles } from "../helpers/journal-files.js";
import { extractSection } from "../helpers/sections.js";
import { todayISO } from "../storage/fs-utils.js";
import { readState } from "./journal-state.js";
import type { SessionState } from "../types.js";

export function register(server: McpServer): void {
  server.registerTool("journal_cold_start", {
    title: "Cold Start Brief (Cache-Aware)",
    description:
      "Returns a cache-aware cold-start package. HOT: today + yesterday (full). " +
      "WARM: 2-7 days (summaries only). COLD: older (count only). " +
      "Designed for minimal context consumption on session start.",
    inputSchema: {
      project: z.string().default("auto"),
    },
  }, async ({ project }) => {
    const slug = await resolveProject(project);
    const entries = listJournalFiles(slug);
    const _today = todayISO();

    const hot: Array<{ date: string; state: SessionState | null; brief: string | null }> = [];
    const warm: Array<{ date: string; brief: string | null }> = [];
    let coldCount = 0;

    for (const entry of entries) {
      const ageMs = Date.now() - new Date(entry.date).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (ageDays <= 1.5) {
        const state = readState(slug, entry.date);
        const fullPath = path.join(entry.dir, entry.file);
        const stats = fs.statSync(fullPath);
        const content = stats.size > 5120
          ? fs.readFileSync(fullPath, "utf-8").slice(0, 5120) + "\n...(truncated, use journal_read for full)"
          : fs.readFileSync(fullPath, "utf-8");
        hot.push({
          date: entry.date,
          state,
          brief: extractSection(content, "brief"),
        });
      } else if (ageDays <= 7) {
        const fullPath = path.join(entry.dir, entry.file);
        const content = fs.readFileSync(fullPath, "utf-8").slice(0, 2048);
        warm.push({
          date: entry.date,
          brief: extractSection(content, "brief"),
        });
      } else {
        coldCount++;
      }
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          project: slug,
          cache: {
            hot: { count: hot.length, entries: hot },
            warm: { count: warm.length, entries: warm },
            cold: { count: coldCount },
          },
          total_entries: entries.length,
          tip: "HOT entries have full state. WARM have briefs only. Use journal_read for COLD entries.",
        }),
      }],
    };
  });
}
