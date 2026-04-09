/**
 * Tool: palace_walk — Progressive context loading for cold-start.
 *
 * Depths:
 *   identity (~50 tokens): project name, purpose, last session
 *   active (~200 tokens): identity + top 3 rooms by salience
 *   relevant (~500 tokens): active + rooms matching focus query + key memories
 *   full (~2000 tokens): all rooms with full content
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as z from "zod/v4";
import type { ServerType } from "../server.js";
import { resolveProject } from "../storage/project.js";
import { palaceDir } from "../storage/paths.js";
import { ensurePalaceInitialized, listRooms, recordAccess } from "../palace/rooms.js";
import { readIdentity } from "../palace/identity.js";
import { readAwareness } from "../palace/awareness.js";
import type { WalkDepth, RoomMeta } from "../types.js";

function roomSummary(meta: RoomMeta): string {
  return `- **${meta.name}** (salience: ${meta.salience}) — ${meta.description}`;
}

function readRoomContent(project: string, room: RoomMeta): string {
  const pd = palaceDir(project);
  const roomPath = path.join(pd, "rooms", room.slug);
  if (!fs.existsSync(roomPath)) return "";

  const files = fs.readdirSync(roomPath)
    .filter((f) => f.endsWith(".md"))
    .sort();

  let content = `### ${room.name}\n\n`;

  for (const file of files) {
    const filePath = path.join(roomPath, file);
    const text = fs.readFileSync(filePath, "utf-8");
    // Truncate individual files at 500 chars for full depth
    const truncated = text.length > 500 ? text.slice(0, 500) + "\n...(truncated)" : text;
    content += truncated + "\n\n";
  }

  return content;
}

export function register(server: ServerType): void {
  server.registerTool("palace_walk", {
    title: "Walk the Memory Palace",
    description:
      "Progressive context loading for cold-start. " +
      "identity (~50 tokens) → active (~200) → relevant (~500) → full (~2000). " +
      "Start at 'identity' and deepen as needed.",
    inputSchema: {
      depth: z.enum(["identity", "active", "relevant", "full"]).default("active")
        .describe("How deep to walk. Start with 'identity' or 'active'."),
      focus: z.string().optional()
        .describe("For 'relevant' depth: focus query to match rooms (e.g., 'authentication', 'deployment')"),
      project: z.string().default("auto"),
    },
  }, async ({ depth, focus, project }) => {
    const slug = await resolveProject(project);
    ensurePalaceInitialized(slug);

    const rooms = listRooms(slug);
    let output = "";

    // Identity: always included
    const identity = readIdentity(slug);
    // Strip YAML frontmatter for token efficiency
    const identityContent = identity.replace(/^---[\s\S]*?---\n*/, "").trim();
    output += identityContent + "\n\n";

    // Awareness: always included (compact — top insights only)
    const awarenessRaw = readAwareness();
    if (awarenessRaw) {
      // Extract just the top insights section (compact)
      const awarenessLines = awarenessRaw.split("\n");
      const topIdx = awarenessLines.findIndex((l) => l.startsWith("## Top Insights"));
      const compIdx = awarenessLines.findIndex((l) => l.startsWith("## Compound") || l.startsWith("## Trajectory"));
      if (topIdx >= 0) {
        const end = compIdx > topIdx ? compIdx : Math.min(topIdx + 30, awarenessLines.length);
        output += awarenessLines.slice(topIdx, end).join("\n").trim() + "\n\n";
      }
    }

    if (depth === "identity") {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project: slug,
            depth,
            rooms_count: rooms.length,
            content: output.trim(),
          }),
        }],
      };
    }

    // Active: top 3 rooms by salience
    const topRooms = rooms.slice(0, 3);
    output += "## Active Rooms\n\n";
    for (const room of topRooms) {
      output += roomSummary(room) + "\n";
      recordAccess(slug, room.slug);
    }
    output += "\n";

    if (depth === "active") {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project: slug,
            depth,
            rooms_count: rooms.length,
            top_rooms: topRooms.map((r) => r.slug),
            content: output.trim(),
          }),
        }],
      };
    }

    // Relevant: active + rooms matching focus
    if (focus) {
      const focusLower = focus.toLowerCase();
      const matchingRooms = rooms.filter(
        (r) =>
          !topRooms.includes(r) &&
          (r.name.toLowerCase().includes(focusLower) ||
            r.description.toLowerCase().includes(focusLower) ||
            r.tags.some((t) => t.toLowerCase().includes(focusLower)))
      );

      if (matchingRooms.length > 0) {
        output += "## Relevant Rooms\n\n";
        for (const room of matchingRooms.slice(0, 5)) {
          output += roomSummary(room) + "\n";
          // Include key content (first 200 chars of README)
          const pd = palaceDir(slug);
          const readmePath = path.join(pd, "rooms", room.slug, "README.md");
          if (fs.existsSync(readmePath)) {
            const readme = fs.readFileSync(readmePath, "utf-8")
              .replace(/^---[\s\S]*?---\n*/, "")
              .trim();
            output += "  " + readme.slice(0, 200) + "\n";
          }
          recordAccess(slug, room.slug);
        }
        output += "\n";
      }
    }

    if (depth === "relevant") {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project: slug,
            depth,
            focus: focus ?? null,
            rooms_count: rooms.length,
            content: output.trim(),
          }),
        }],
      };
    }

    // Full: all rooms with content
    output += "## All Rooms\n\n";
    for (const room of rooms) {
      output += readRoomContent(slug, room);
      recordAccess(slug, room.slug);
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          project: slug,
          depth,
          rooms_count: rooms.length,
          content: output.trim(),
        }),
      }],
    };
  });
}
