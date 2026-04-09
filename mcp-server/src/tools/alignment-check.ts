import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDir, palaceDir } from "../storage/paths.js";
import { ensureDir, todayISO } from "../storage/fs-utils.js";
import { ensurePalaceInitialized, roomExists } from "../palace/rooms.js";
import { updatePalaceIndex } from "../palace/index-manager.js";

export function register(server: McpServer): void {
  server.registerTool("alignment_check", {
    title: "Alignment Check",
    description:
      "Record what the agent understood, its confidence, and any human correction. Measures the Intelligent Distance gap.",
    inputSchema: {
      goal: z.string().describe("Agent's understanding of the goal"),
      confidence: z.enum(["high", "medium", "low"]).describe("Agent's confidence"),
      assumptions: z.array(z.string()).optional().describe("What agent assumed"),
      unclear: z.string().optional().describe("What agent is unsure about"),
      human_correction: z.string().optional().describe("Human's correction or 'confirmed'"),
      delta: z.string().optional().describe("The gap, or 'none'"),
      category: z.enum(["goal", "scope", "priority", "technical", "aesthetic"]).default("goal"),
      project: z.string().default("auto"),
    },
  }, async ({ goal, confidence, assumptions, unclear, human_correction, delta, category, project }) => {
    const slug = await resolveProject(project);
    const date = todayISO();
    const dir = journalDir(slug);
    ensureDir(dir);

    const time = new Date().toISOString().slice(11, 19);
    const assumeStr = assumptions?.length ? assumptions.map(a => `  - ${a}`).join("\n") : "  (none)";

    let entry = `### Alignment (${time})\n`;
    entry += `**Goal**: ${goal}\n**Confidence**: ${confidence}\n**Category**: ${category}\n`;
    entry += `**Assumptions**:\n${assumeStr}\n`;
    if (unclear) entry += `**Unclear**: ${unclear}\n`;
    if (human_correction) entry += `**Human**: ${human_correction}\n**Delta**: ${delta || "not specified"}\n`;
    entry += "\n";

    const logPath = path.join(dir, `${date}-alignment.md`);
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, `# ${date} — Alignment Records\n\n---\n\n${entry}`, "utf-8");
    } else {
      fs.appendFileSync(logPath, entry, "utf-8");
    }

    // Palace integration: also write to alignment room
    try {
      ensurePalaceInitialized(slug);
      if (roomExists(slug, "alignment")) {
        const pd = palaceDir(slug);
        const alignFile = path.join(pd, "rooms", "alignment", `${category}.md`);
        ensureDir(path.dirname(alignFile));

        const palaceEntry = `\n### ${date} ${time} — ${confidence}\n**Goal**: ${goal}\n`;
        if (human_correction) {
          const corrEntry = palaceEntry + `**Human correction**: ${human_correction}\n**Delta**: ${delta || "pending"}\n`;
          if (fs.existsSync(alignFile)) {
            fs.appendFileSync(alignFile, corrEntry, "utf-8");
          } else {
            fs.writeFileSync(alignFile, `# alignment / ${category}\n${corrEntry}`, "utf-8");
          }
        }
        updatePalaceIndex(slug);
      }
    } catch {
      // Palace integration is optional
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, date, confidence, delta: delta || "pending", file: logPath }) }],
    };
  });
}
