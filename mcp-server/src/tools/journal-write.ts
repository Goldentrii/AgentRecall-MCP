import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDir } from "../storage/paths.js";
import { ensureDir, todayISO } from "../storage/fs-utils.js";
import { appendToSection } from "../helpers/sections.js";
import { updateIndex } from "../helpers/journal-files.js";
import { ensurePalaceInitialized, roomExists, createRoom } from "../palace/rooms.js";
import { fanOut } from "../palace/fan-out.js";
import { palaceDir } from "../storage/paths.js";
import { generateFrontmatter } from "../palace/obsidian.js";
import { updatePalaceIndex } from "../palace/index-manager.js";

export function register(server: McpServer): void {
  server.registerTool("journal_write", {
    title: "Write Journal Entry",
    description:
      "Append content to the current journal entry (creates today's file if absent). " +
      "Optionally also write to a palace room for cross-referenced persistent memory.",
    inputSchema: {
      content: z.string().describe("Markdown content to append or write."),
      section: z
        .enum([
          "qa", "completed", "blockers", "next", "decisions",
          "observations", "replace_all",
        ])
        .optional()
        .describe(
          "Target section. If omitted, appends to end of file. 'replace_all' overwrites entire file."
        ),
      palace_room: z.string().optional()
        .describe("Optional: also write key content to this palace room (e.g., 'goals', 'architecture')"),
      project: z
        .string()
        .default("auto")
        .describe("Project slug. Defaults to auto-detect."),
    },
  }, async ({ content, section, palace_room, project }) => {
    const slug = await resolveProject(project);
    const date = todayISO();
    const dir = journalDir(slug);
    ensureDir(dir);

    const filePath = path.join(dir, `${date}.md`);

    let existing = "";
    if (fs.existsSync(filePath)) {
      existing = fs.readFileSync(filePath, "utf-8");
    } else if (!section || section !== "replace_all") {
      existing = `# ${date} — ${slug}\n`;
    }

    const sectionArg = section ?? null;
    const updated = appendToSection(existing, content, sectionArg);
    fs.writeFileSync(filePath, updated, "utf-8");

    updateIndex(slug);

    // Palace integration: also write to palace room if specified
    let palaceResult = null;
    if (palace_room) {
      ensurePalaceInitialized(slug);

      if (!roomExists(slug, palace_room)) {
        createRoom(slug, palace_room, palace_room.charAt(0).toUpperCase() + palace_room.slice(1), `Auto-created from journal_write`, []);
      }

      const pd = palaceDir(slug);
      const topicFile = section && section !== "replace_all" ? section : "journal";
      const targetPath = path.join(pd, "rooms", palace_room, `${topicFile}.md`);
      ensureDir(path.dirname(targetPath));

      const timestamp = new Date().toISOString();
      const entry = `\n### ${date} (from journal)\n\n${content}\n`;

      if (fs.existsSync(targetPath)) {
        fs.appendFileSync(targetPath, entry, "utf-8");
      } else {
        const fm = generateFrontmatter({ room: palace_room, topic: topicFile, created: timestamp, source: "journal_write" });
        fs.writeFileSync(targetPath, `${fm}# ${palace_room} / ${topicFile}\n${entry}`, "utf-8");
      }

      const fanOutResult = fanOut(slug, palace_room, topicFile, content, [], "medium");
      updatePalaceIndex(slug);

      palaceResult = {
        room: palace_room,
        topic: topicFile,
        fan_out: fanOutResult.updatedRooms,
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, date, file: filePath, palace: palaceResult }),
      }],
    };
  });
}
