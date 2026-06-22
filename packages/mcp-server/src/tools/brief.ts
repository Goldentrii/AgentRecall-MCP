/**
 * brief MCP tool — compact LLM-free re-orientation briefing (≤200 tokens).
 *
 * --full only: registered inside the `if (fullMode)` block in index.ts.
 * Read-only: no session_start side-effects, no writes, no LLM calls.
 *
 * Returns identity, active phase, top corrections/watch_for/rules, the
 * 3-rule lifecycle text verbatim, trigger vocab, and a host-honesty line.
 *
 * AGENT INSTRUCTION:
 *   brief() is a MID-SESSION re-orientation aid for hook-less hosts, NOT a
 *   replacement for session_start. Always call session_start() FIRST at
 *   session entry. Use brief() when you need a quick lifecycle reminder
 *   mid-session without paying the full session_start token cost.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { brief } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool("brief", {
    title: "Brief",
    description:
      "READ-ONLY re-orientation briefing (≤200 tokens). " +
      "Returns: identity, active phase, top P0 corrections, watch_for patterns, behavior rules, " +
      "the 3-rule lifecycle text verbatim, save-trigger vocab, and a host-honesty hint. " +
      "LLM-free, deterministic, no side-effects. " +
      "--full only. " +
      "NOT a replacement for session_start — call session_start FIRST at session entry. " +
      "Use brief() mid-session when you need a lightweight lifecycle reminder.",
    inputSchema: {
      project: z.string().optional().describe("Project slug (default: auto-detected from cwd)"),
    },
    annotations: {
      readOnlyHint: true,
    },
  }, async ({ project }) => {
    const result = await brief({ project });

    // Render as compact human-readable text + structured JSON
    const lines: string[] = [
      `# Brief — ${result.project}`,
      `Identity: ${result.identity}`,
      result.active_phase ? `Phase: ${result.active_phase}` : "Phase: (none active)",
      "",
      "## Lifecycle (3 rules)",
      result.lifecycle_text,
      "",
      "## Save triggers",
      result.trigger_vocab.join(", "),
    ];

    if (result.corrections_top.length > 0) {
      lines.push("", "## Top P0 corrections");
      for (const c of result.corrections_top) {
        lines.push(`  [${c.severity.toUpperCase()}] ${c.rule}`);
      }
    }

    if (result.watch_for_top.length > 0) {
      lines.push("", "## Watch for");
      for (const w of result.watch_for_top) {
        lines.push(`  ${w.pattern} → ${w.suggestion}`);
      }
    }

    if (result.rules_top.length > 0) {
      lines.push("", "## Rules");
      for (const r of result.rules_top) {
        lines.push(`  [${r.name}] WHEN ${r.when} → ${r.do}`);
      }
    }

    if (result.store_health) {
      lines.push("", `Store: ${result.store_health}`);
    }

    lines.push("", result.host_hint);

    return {
      content: [
        { type: "text" as const, text: lines.join("\n") },
        { type: "text" as const, text: JSON.stringify(result) },
      ],
    };
  });
}
