import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ensureDir, todayISO } from "../storage/fs-utils.js";
import { resolveProject } from "../storage/project.js";
import { palaceDir } from "../storage/paths.js";
import { ensurePalaceInitialized, roomExists, createRoom } from "../palace/rooms.js";
import { fanOut } from "../palace/fan-out.js";
import { updatePalaceIndex } from "../palace/index-manager.js";

export function register(server: McpServer): void {
  server.registerTool("knowledge_write", {
    title: "Write Knowledge Lesson",
    description:
      "Write a structured lesson to the knowledge palace room. " +
      "Category is now dynamic — any string creates a topic file in the knowledge room. " +
      "Also writes to legacy knowledge/ dir for backward compatibility.",
    inputSchema: {
      project: z.string().default("auto").describe("Project name for scoping"),
      category: z.string().describe("Knowledge category (any string — creates a topic file in the knowledge room)"),
      title: z.string().describe("Short title of the lesson"),
      what_happened: z.string().describe("What went wrong or right"),
      root_cause: z.string().describe("Why it happened"),
      fix: z.string().describe("How to prevent/fix it"),
      severity: z
        .enum(["critical", "important", "minor"])
        .default("important")
        .describe("Severity level of the lesson"),
    },
  }, async ({ project, category, title, what_happened, root_cause, fix, severity }) => {
    const slug = await resolveProject(project);
    const safe = slug.replace(/[^a-zA-Z0-9_\-\.]/g, "-");
    const safeCategory = category.replace(/[^a-zA-Z0-9_\-]/g, "-").toLowerCase();
    const date = todayISO();

    let entry = `### ${title} (${slug}, ${date})\n`;
    entry += `- **What happened:** ${what_happened}\n`;
    entry += `- **Root cause:** ${root_cause}\n`;
    entry += `- **Fix:** ${fix}\n`;
    entry += `- **Severity:** ${severity}\n\n`;

    // Legacy: write to knowledge/ dir
    const baseDir = process.env.AGENT_RECALL_ROOT || path.join(os.homedir(), ".agent-recall");
    const knowledgeDir = path.join(baseDir, "projects", safe, "knowledge");
    ensureDir(knowledgeDir);
    const legacyPath = path.join(knowledgeDir, `${safeCategory}.md`);

    if (!fs.existsSync(legacyPath)) {
      fs.writeFileSync(legacyPath, `# Knowledge — ${category}\n\n${entry}`, "utf-8");
    } else {
      fs.appendFileSync(legacyPath, entry, "utf-8");
    }

    // Palace: write to knowledge room
    let palaceResult = null;
    try {
      ensurePalaceInitialized(slug);
      if (!roomExists(slug, "knowledge")) {
        createRoom(slug, "knowledge", "Knowledge", "Learned lessons by category", ["learning"]);
      }

      const pd = palaceDir(slug);
      const topicPath = path.join(pd, "rooms", "knowledge", `${safeCategory}.md`);
      ensureDir(path.dirname(topicPath));

      if (!fs.existsSync(topicPath)) {
        fs.writeFileSync(topicPath, `# knowledge / ${category}\n\n${entry}`, "utf-8");
      } else {
        fs.appendFileSync(topicPath, entry, "utf-8");
      }

      fanOut(slug, "knowledge", safeCategory, `${title}: ${what_happened}`, [], severity === "critical" ? "high" : "medium");
      updatePalaceIndex(slug);
      palaceResult = { room: "knowledge", topic: safeCategory };
    } catch {
      // Palace integration is optional
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          project: slug,
          category: safeCategory,
          title,
          severity,
          file: legacyPath,
          palace: palaceResult,
        }),
      }],
    };
  });
}
