import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDir } from "../storage/paths.js";
import { ensureDir, todayISO } from "../storage/fs-utils.js";

export function register(server: McpServer): void {
  server.registerTool("nudge", {
    title: "Nudge",
    description:
      "Surface a contradiction between the human's current input and a prior statement/decision. Helps the human clarify their own thinking.",
    inputSchema: {
      past_statement: z.string().describe("What the human said/decided before (with date if known)"),
      current_statement: z.string().describe("What the human is saying now"),
      question: z.string().describe("The clarifying question to ask"),
      category: z.enum(["goal", "scope", "priority", "technical", "aesthetic"]).default("goal"),
      project: z.string().default("auto"),
    },
  }, async ({ past_statement, current_statement, question, category, project }) => {
    const slug = await resolveProject(project);
    const date = todayISO();
    const dir = journalDir(slug);
    ensureDir(dir);

    const time = new Date().toISOString().slice(11, 19);
    let entry = `### Nudge (${time})\n`;
    entry += `**Past**: ${past_statement}\n`;
    entry += `**Now**: ${current_statement}\n`;
    entry += `**Question**: ${question}\n`;
    entry += `**Category**: ${category}\n\n`;

    const logPath = path.join(dir, `${date}-alignment.md`);
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, `# ${date} — Alignment Records\n\n---\n\n${entry}`, "utf-8");
    } else {
      fs.appendFileSync(logPath, entry, "utf-8");
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, date, category, file: logPath }) }],
    };
  });
}
