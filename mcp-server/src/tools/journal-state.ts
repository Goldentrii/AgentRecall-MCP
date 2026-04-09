import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProject } from "../storage/project.js";
import { journalDir } from "../storage/paths.js";
import { ensureDir, todayISO } from "../storage/fs-utils.js";
import { VERSION } from "../types.js";
import type { SessionState } from "../types.js";

export function stateFilePath(project: string, date: string): string {
  return path.join(journalDir(project), `${date}.state.json`);
}

export function readState(project: string, date: string): SessionState | null {
  const fp = stateFilePath(project, date);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return null;
  }
}

export function register(server: McpServer): void {
  server.registerTool("journal_state", {
    title: "Read/Write Session State (JSON)",
    description:
      "Layer 1: structured JSON session state. Faster than markdown for cold-start. " +
      "Read mode: returns today's state as JSON. Write mode: merges new data into state. " +
      "Use this for agent-to-agent handoffs — no prose parsing needed.",
    inputSchema: {
      action: z.enum(["read", "write"]).describe("'read' returns state, 'write' merges new data"),
      data: z.string().optional().describe("JSON string to merge into state (write mode only)"),
      date: z.string().default("latest").describe("ISO date or 'latest'"),
      project: z.string().default("auto"),
    },
  }, async ({ action, data, date, project }) => {
    const slug = await resolveProject(project);
    let targetDate = date;

    if (targetDate === "latest") {
      const dir = journalDir(slug);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith(".state.json"))
          .sort()
          .reverse();
        targetDate = files.length > 0 ? files[0].replace(".state.json", "") : todayISO();
      } else {
        targetDate = todayISO();
      }
    }

    if (action === "read") {
      const state = readState(slug, targetDate);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(state ?? { empty: true, date: targetDate, project: slug }),
        }],
      };
    }

    // Write: merge into existing state
    const existing = readState(slug, todayISO()) ?? {
      version: VERSION,
      date: todayISO(),
      project: slug,
      timestamp: new Date().toISOString(),
      completed: [],
      failures: [],
      state: {},
      next_actions: [],
      insights: [],
      counts: {},
    };

    if (data) {
      try {
        const incoming = JSON.parse(data);
        if (incoming.completed) existing.completed.push(...incoming.completed);
        if (incoming.failures) existing.failures.push(...incoming.failures);
        if (incoming.next_actions) existing.next_actions = incoming.next_actions;
        if (incoming.insights) existing.insights.push(...incoming.insights);
        if (incoming.state) Object.assign(existing.state, incoming.state);
        if (incoming.counts) Object.assign(existing.counts, incoming.counts);
        existing.timestamp = new Date().toISOString();
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid JSON: ${e}` }) }],
          isError: true,
        };
      }
    }

    const fp = stateFilePath(slug, todayISO());
    ensureDir(path.dirname(fp));
    fs.writeFileSync(fp, JSON.stringify(existing, null, 2), "utf-8");

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, date: todayISO(), entries: {
          completed: existing.completed.length,
          failures: existing.failures.length,
          insights: existing.insights.length,
        }}),
      }],
    };
  });
}
