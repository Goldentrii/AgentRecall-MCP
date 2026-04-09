/**
 * Tool: palace_read — Read a room overview or specific topic from the palace.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as z from "zod/v4";
import type { ServerType } from "../server.js";
import { resolveProject } from "../storage/project.js";
import { palaceDir } from "../storage/paths.js";
import { ensurePalaceInitialized, getRoomMeta, listRooms, recordAccess } from "../palace/rooms.js";

export function register(server: ServerType): void {
  server.registerTool("palace_read", {
    title: "Read Palace Room",
    description:
      "Read a room overview or specific topic from the Memory Palace. " +
      "Returns room content with metadata. Use without room param to list all rooms.",
    inputSchema: {
      room: z.string().optional().describe("Room slug (e.g., 'goals', 'architecture'). Omit to list all rooms."),
      topic: z.string().optional().describe("Specific topic file within the room (e.g., 'decisions', 'active'). Omit for room README."),
      project: z.string().default("auto"),
    },
  }, async ({ room, topic, project }) => {
    const slug = await resolveProject(project);
    ensurePalaceInitialized(slug);

    if (!room) {
      // List all rooms
      const rooms = listRooms(slug);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project: slug,
            rooms: rooms.map((r) => ({
              slug: r.slug,
              name: r.name,
              description: r.description,
              salience: r.salience,
              connections: r.connections,
              tags: r.tags,
            })),
          }),
        }],
      };
    }

    // Read specific room
    const meta = getRoomMeta(slug, room);
    if (!meta) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Room '${room}' not found in project '${slug}'` }) }],
        isError: true,
      };
    }

    recordAccess(slug, room);

    const pd = palaceDir(slug);
    const targetFile = topic
      ? path.join(pd, "rooms", room, `${topic}.md`)
      : path.join(pd, "rooms", room, "README.md");

    if (!fs.existsSync(targetFile)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found: ${topic ? topic + '.md' : 'README.md'} in room '${room}'` }) }],
        isError: true,
      };
    }

    const content = fs.readFileSync(targetFile, "utf-8");

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          room: room,
          topic: topic ?? "README",
          project: slug,
          salience: meta.salience,
          connections: meta.connections,
          content,
        }),
      }],
    };
  });
}
