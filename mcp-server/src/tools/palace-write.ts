/**
 * Tool: palace_write — Write a memory to a room with fan-out cross-referencing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as z from "zod/v4";
import type { ServerType } from "../server.js";
import { resolveProject } from "../storage/project.js";
import { palaceDir } from "../storage/paths.js";
import { ensureDir } from "../storage/fs-utils.js";
import { ensurePalaceInitialized, createRoom, roomExists, updateRoomMeta } from "../palace/rooms.js";
import { fanOut } from "../palace/fan-out.js";
import { updatePalaceIndex } from "../palace/index-manager.js";
import { generateFrontmatter } from "../palace/obsidian.js";
import type { Importance } from "../types.js";
import { appendToLog } from "../palace/log.js";

export function register(server: ServerType): void {
  server.registerTool("palace_write", {
    title: "Write to Palace Room",
    description:
      "Write a memory to a palace room. Triggers fan-out: cross-references are updated in connected rooms. " +
      "Use [[wikilinks]] in content to create connections, or pass explicit connections.",
    inputSchema: {
      room: z.string().describe("Target room slug (e.g., 'goals', 'architecture'). Auto-created if doesn't exist."),
      topic: z.string().optional().describe("Topic file within the room (e.g., 'decisions'). Omit to append to README."),
      content: z.string().describe("Markdown content to write. Use [[room/topic]] for cross-references."),
      connections: z.array(z.string()).optional().describe("Explicit room connections (e.g., ['goals', 'blockers'])"),
      importance: z.enum(["high", "medium", "low"]).default("medium").describe("Memory importance for salience scoring"),
      project: z.string().default("auto"),
    },
  }, async ({ room, topic, content, connections, importance, project }) => {
    const slug = await resolveProject(project);
    ensurePalaceInitialized(slug);

    // Auto-create room if it doesn't exist
    if (!roomExists(slug, room)) {
      createRoom(slug, room, room.charAt(0).toUpperCase() + room.slice(1), `Auto-created room for ${room}`, []);
    }

    const pd = palaceDir(slug);
    const targetTopic = topic ?? "README";
    const targetFile = path.join(pd, "rooms", room, `${targetTopic}.md`);
    ensureDir(path.dirname(targetFile));

    const timestamp = new Date().toISOString();

    if (targetTopic === "README") {
      // Append to README under the Memories section
      let existing = fs.existsSync(targetFile)
        ? fs.readFileSync(targetFile, "utf-8")
        : "";

      const entry = `\n### ${timestamp.slice(0, 10)} — ${importance}\n\n${content}\n`;

      if (existing.includes("## Memories")) {
        // Append after the Memories section header
        const idx = existing.indexOf("## Memories");
        const afterHeader = existing.indexOf("\n", idx);
        existing =
          existing.slice(0, afterHeader + 1) +
          entry +
          existing.slice(afterHeader + 1);
      } else {
        existing += `\n## Memories\n${entry}`;
      }

      fs.writeFileSync(targetFile, existing, "utf-8");
    } else {
      // Write to topic file (create or append)
      if (fs.existsSync(targetFile)) {
        const existing = fs.readFileSync(targetFile, "utf-8");
        const entry = `\n### ${timestamp.slice(0, 10)} — ${importance}\n\n${content}\n`;
        fs.writeFileSync(targetFile, existing + entry, "utf-8");
      } else {
        const fm = generateFrontmatter({
          room,
          topic: targetTopic,
          created: timestamp,
          importance,
        });
        fs.writeFileSync(targetFile, `${fm}# ${room} / ${targetTopic}\n\n${content}\n`, "utf-8");
      }
    }

    // Update room metadata
    updateRoomMeta(slug, room, { updated: timestamp });

    // Fan-out: update cross-references
    const fanOutResult = fanOut(
      slug,
      room,
      targetTopic,
      content,
      connections ?? [],
      importance as Importance
    );

    // Update palace index
    updatePalaceIndex(slug);

    // Log the operation
    appendToLog(slug, "palace_write", {
      room,
      topic: targetTopic,
      importance,
      fan_out_rooms: fanOutResult.updatedRooms,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          room,
          topic: targetTopic,
          project: slug,
          importance,
          fan_out: {
            updated_rooms: fanOutResult.updatedRooms,
            new_edges: fanOutResult.newEdges,
          },
        }),
      }],
    };
  });
}
