import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { sessionStart, type SessionStartResult } from "agent-recall-core";

function formatSessionStart(result: SessionStartResult): string {
  const lines: string[] = [];

  // Resume block — shown first if present
  if (result.resume) {
    lines.push(`## Resume`);
    lines.push(`Last session: ${result.resume.last_date ?? "unknown"} | Sessions: ${result.resume.sessions_count}`);
    if (result.resume.last_trajectory) {
      lines.push(`Trajectory: ${result.resume.last_trajectory}`);
    }
    lines.push("");
  }

  // Warnings — show BEFORE everything else if present
  if (result.watch_for && result.watch_for.length > 0) {
    lines.push(`## ⚠ Watch For`);
    for (const w of result.watch_for) {
      lines.push(`- ${w.pattern}: ${w.suggestion}`);
    }
    lines.push("");
  }

  if (result.corrections && result.corrections.length > 0) {
    lines.push(`## ⛔ HARD RULES — always follow, no exceptions`);
    lines.push(`These are behavioral constraints, not suggestions. Treat violations as errors.`);
    for (const c of result.corrections) {
      const weight = c.weight !== undefined ? ` (weight: ${c.weight})` : "";
      lines.push(`[${c.severity.toUpperCase()}]${weight} ${c.rule}`);
    }
    lines.push("");
  }

  // Context is soft — informs decisions, not mandatory
  lines.push("## Context (informational — use to inform, not to constrain)");
  // Omit corrections from JSON blob to avoid duplication and ambiguity
  const { corrections: _omit, ...contextWithoutCorrections } = result;
  lines.push(JSON.stringify(contextWithoutCorrections, null, 2));

  return lines.join("\n");
}

export function register(server: McpServer): void {
  server.registerTool("session_start", {
    title: "Start Session",
    description: "Load project context for a new session. Returns identity, top insights, active rooms, recent activity, P0 corrections (behavioral rules), and predictive watch_for warnings. One call for cold-start context.",
    inputSchema: {
      project: z.string().default("auto"),
      context: z.string().optional().describe("Optional context for matching cross-project insights"),
    },
  }, async ({ project, context }) => {
    const result = await sessionStart({ project, context });
    return { content: [{ type: "text" as const, text: formatSessionStart(result) }] };
  });
}
