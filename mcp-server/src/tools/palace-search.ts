/**
 * Tool: palace_search — Search across palace rooms, ranked by salience.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as z from "zod/v4";
import type { ServerType } from "../server.js";
import { resolveProject } from "../storage/project.js";
import { palaceDir } from "../storage/paths.js";
import { ensurePalaceInitialized, listRooms, recordAccess } from "../palace/rooms.js";

interface SearchResult {
  room: string;
  file: string;
  salience: number;
  excerpt: string;
  line: number;
}

export function register(server: ServerType): void {
  server.registerTool("palace_search", {
    title: "Search Memory Palace",
    description:
      "Full-text search across all palace rooms. Results are ranked by room salience. " +
      "Optionally filter to a specific room.",
    inputSchema: {
      query: z.string().describe("Search term (case-insensitive)"),
      room: z.string().optional().describe("Limit search to a specific room"),
      project: z.string().default("auto"),
    },
  }, async ({ query, room, project }) => {
    const slug = await resolveProject(project);
    ensurePalaceInitialized(slug);

    const rooms = listRooms(slug);
    const pd = palaceDir(slug);
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    const targetRooms = room
      ? rooms.filter((r) => r.slug === room)
      : rooms;

    for (const roomMeta of targetRooms) {
      const roomPath = path.join(pd, "rooms", roomMeta.slug);
      if (!fs.existsSync(roomPath)) continue;

      const files = fs.readdirSync(roomPath).filter((f) => f.endsWith(".md"));

      for (const file of files) {
        const filePath = path.join(roomPath, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            const line = lines[i];
            const matchIdx = line.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, matchIdx - 40);
            const end = Math.min(line.length, matchIdx + query.length + 40);
            let excerpt = line.slice(start, end).trim();
            if (start > 0) excerpt = "..." + excerpt;
            if (end < line.length) excerpt = excerpt + "...";

            results.push({
              room: roomMeta.slug,
              file: file.replace(".md", ""),
              salience: roomMeta.salience,
              excerpt,
              line: i + 1,
            });
          }
        }
      }

      if (results.some((r) => r.room === roomMeta.slug)) {
        recordAccess(slug, roomMeta.slug);
      }
    }

    // Sort by salience descending, then by line number
    results.sort((a, b) => b.salience - a.salience || a.line - b.line);

    // Limit to 20 results
    const limited = results.slice(0, 20);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          project: slug,
          query,
          results: limited,
          total_matches: results.length,
        }),
      }],
    };
  });
}
