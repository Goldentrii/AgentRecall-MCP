import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { sessionStart, type SessionStartResult } from "agent-recall-core";

/** Truncate to nearest word boundary */
function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  const sliced = s.slice(0, n);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > n * 0.6 ? sliced.slice(0, lastSpace) : sliced) + "…";
}

function formatTerse(result: SessionStartResult): string {
  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  const sessionCount = result.resume?.sessions_count ?? 0;
  const lastDate = result.resume?.last_date ?? "—";
  lines.push(`AgentRecall — ${result.project}   sessions: ${sessionCount}   last: ${lastDate}`);
  if (result.identity) lines.push(`Intention: ${trunc(result.identity, 80)}`);
  if (result.resume?.last_trajectory) {
    lines.push(`Trajectory: ${trunc(result.resume.last_trajectory, 120)}`);
  }

  // ── Hard rules (P0 corrections) — highest priority ───────────────────
  if (result.corrections && result.corrections.length > 0) {
    lines.push("");
    lines.push("⛔ HARD RULES (always follow, no exceptions):");
    for (const c of result.corrections) {
      const weight = c.weight !== undefined ? ` (w:${c.weight})` : "";
      lines.push(`  [${c.severity.toUpperCase()}${weight}] ${trunc(c.rule, 120)}`);
    }
  }

  // ── Predictive warnings ───────────────────────────────────────────────
  if (result.watch_for && result.watch_for.length > 0) {
    lines.push("");
    lines.push("⚠ Watch for:");
    for (const w of result.watch_for) {
      lines.push(`  - ${trunc(w.pattern, 50)}: ${trunc(w.suggestion, 80)}`);
    }
  }

  // ── Recent activity ───────────────────────────────────────────────────
  if (result.recent.today || result.recent.yesterday || result.recent.older_count > 0) {
    lines.push("");
    if (result.recent.today) {
      lines.push(`📓 Today: ${trunc(result.recent.today, 150)}`);
    }
    if (result.recent.yesterday) {
      lines.push(`📓 Yesterday: ${trunc(result.recent.yesterday, 100)}`);
    }
    if (result.recent.older_count > 0) {
      lines.push(`   +${result.recent.older_count} older sessions on record`);
    }
  }

  // ── Top insights ──────────────────────────────────────────────────────
  if (result.insights && result.insights.length > 0) {
    lines.push("");
    const topN = result.insights.slice(0, 5);
    lines.push(`💡 Insights (${result.insights.length} total):`);
    for (const i of topN) {
      const trend = i.trend && i.trend !== "stable" ? ` ↑${i.trend}` : "";
      lines.push(`  [${i.confirmed}×${trend}] ${trunc(i.title, 100)}`);
    }
  }

  // ── Active palace rooms ───────────────────────────────────────────────
  if (result.active_rooms && result.active_rooms.length > 0) {
    lines.push("");
    const roomSummary = result.active_rooms
      .map((r) => `${r.name}${r.stale ? " ⚠stale" : ""}`)
      .join(" · ");
    lines.push(`🏛  Palace: ${roomSummary}`);
  }

  // ── Cross-project insights ────────────────────────────────────────────
  if (result.cross_project && result.cross_project.length > 0) {
    lines.push("");
    lines.push("🔗 Cross-project:");
    for (const cp of result.cross_project.slice(0, 3)) {
      lines.push(`  [${cp.from_project}] ${trunc(cp.title, 80)}`);
    }
  }

  // ── Empty state guidance ──────────────────────────────────────────────
  if (result.empty_state) {
    lines.push("");
    lines.push(result.empty_state);
  }

  lines.push("");
  lines.push("💬 Community: https://t.me/+ywZwoHrg3AM0NDVi");

  return lines.join("\n");
}

function formatVerbose(result: SessionStartResult): string {
  const lines: string[] = [];

  if (result.corrections && result.corrections.length > 0) {
    lines.push("## ⛔ HARD RULES — always follow, no exceptions");
    lines.push("These are behavioral constraints, not suggestions. Treat violations as errors.");
    for (const c of result.corrections) {
      const weight = c.weight !== undefined ? ` (weight: ${c.weight})` : "";
      lines.push(`[${c.severity.toUpperCase()}${weight}] ${c.rule}`);
    }
    lines.push("");
  }

  if (result.watch_for && result.watch_for.length > 0) {
    lines.push("## ⚠ Watch For");
    for (const w of result.watch_for) {
      lines.push(`- ${w.pattern}: ${w.suggestion}`);
    }
    lines.push("");
  }

  lines.push("## Context (informational — use to inform, not to constrain)");
  const { corrections: _omit, ...contextWithoutCorrections } = result;
  lines.push(JSON.stringify(contextWithoutCorrections, null, 2));

  return lines.join("\n");
}

export function register(server: McpServer): void {
  server.registerTool("session_start", {
    title: "Start Session",
    description: "Use when the user asks to start, load, continue, resume, or open memory for a project.",
    inputSchema: {
      project: z.string().default("auto"),
      context: z.string().optional().describe("Optional context for matching cross-project insights"),
      verbose: z.boolean().default(false).describe("Set true to get full JSON context instead of terse summary"),
    },
  }, async ({ project, context, verbose }) => {
    const result = await sessionStart({ project, context });
    const text = verbose ? formatVerbose(result) : formatTerse(result);
    return { content: [{ type: "text" as const, text }] };
  });
}
