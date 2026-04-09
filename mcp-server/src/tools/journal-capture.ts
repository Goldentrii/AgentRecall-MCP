import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDir } from "../storage/paths.js";
import { ensureDir, todayISO } from "../storage/fs-utils.js";
import { countLogEntries } from "../helpers/journal-files.js";

export function register(server: McpServer): void {
  server.registerTool("journal_capture", {
    title: "Capture Q&A",
    description:
      "Layer 1: lightweight Q&A capture. Appends to today's log file without loading the full journal.",
    inputSchema: {
      question: z
        .string()
        .describe("The human's question or request (summarized, 1 sentence)"),
      answer: z
        .string()
        .describe(
          "The agent's key answer or decision (summarized, 1-2 sentences)"
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          "Optional tags for this entry (e.g. ['decision', 'bug-fix', 'architecture'])"
        ),
      palace_room: z.string().optional()
        .describe("Optional: also capture this Q&A into a palace room"),
      project: z
        .string()
        .default("auto")
        .describe("Project slug. Defaults to auto-detect."),
    },
  }, async ({ question, answer, tags, palace_room, project }) => {
    const slug = await resolveProject(project);
    const date = todayISO();
    const dir = journalDir(slug);
    ensureDir(dir);

    const logPath = path.join(dir, `${date}-log.md`);

    const entryNum = countLogEntries(logPath) + 1;
    const tagStr = tags && tags.length > 0 ? ` [${tags.join(", ")}]` : "";
    const timestamp = new Date().toISOString().slice(11, 19);

    let entry = `### Q${entryNum} (${timestamp})${tagStr}\n\n`;
    entry += `**Q:** ${question}\n\n`;
    entry += `**A:** ${answer}\n\n`;

    if (!fs.existsSync(logPath)) {
      const header = `# ${date} — ${slug} — Session Log\n\n`;
      fs.writeFileSync(logPath, header + entry, "utf-8");
    } else {
      fs.appendFileSync(logPath, entry, "utf-8");
    }

    // Palace integration
    let palaceResult = null;
    if (palace_room) {
      try {
        const { ensurePalaceInitialized, roomExists, createRoom } = await import("../palace/rooms.js");
        const { palaceDir } = await import("../storage/paths.js");
        const { fanOut } = await import("../palace/fan-out.js");
        const { updatePalaceIndex } = await import("../palace/index-manager.js");

        ensurePalaceInitialized(slug);
        if (!roomExists(slug, palace_room)) {
          createRoom(slug, palace_room, palace_room.charAt(0).toUpperCase() + palace_room.slice(1), "Auto-created from capture", []);
        }

        const pd = palaceDir(slug);
        const targetPath = path.join(pd, "rooms", palace_room, "captures.md");
        ensureDir(path.dirname(targetPath));

        const captureEntry = `\n### Q${entryNum} (${date})\n**Q:** ${question}\n**A:** ${answer}\n`;
        if (fs.existsSync(targetPath)) {
          fs.appendFileSync(targetPath, captureEntry, "utf-8");
        } else {
          fs.writeFileSync(targetPath, `# ${palace_room} / captures\n${captureEntry}`, "utf-8");
        }

        fanOut(slug, palace_room, "captures", `${question} ${answer}`, [], "medium");
        updatePalaceIndex(slug);
        palaceResult = { room: palace_room };
      } catch {
        // Palace integration is optional, don't fail the capture
      }
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, entry_number: entryNum, palace: palaceResult }),
      }],
    };
  });
}
