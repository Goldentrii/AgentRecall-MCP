import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { sessionEndReflect } from "agent-recall-core";

export function register(server: McpServer): void {
  server.registerTool(
    "session_end_reflect",
    {
      title: "Reflect — Park-style aggregation pass",
      description:
        "Bundle recent journals + active corrections + recent phase syntheses into a " +
        "ready-to-use prompt the calling LLM can read to produce: (1) three high-level questions " +
        "this period raised, (2) procedural skills to crystallize via skill_write, (3) cross-session " +
        "patterns worth promoting, (4) low-precision corrections to archive. " +
        "Returns the structured bundle + prompt — does NOT call an LLM itself.",
      inputSchema: {
        lookback_days: z.number().int().min(1).max(60).default(7),
        project: z.string().max(100).default("auto"),
      },
    },
    async (args) => {
      const result = await sessionEndReflect(args);
      return {
        content: [
          { type: "text" as const, text: result.prompt },
          { type: "text" as const, text: JSON.stringify({ success: result.success, project: result.project, next_actions: result.next_actions, bundle_size: { journals: result.bundle.recent_journals.length, corrections: result.bundle.active_corrections.length, phases: result.bundle.recent_phases.length } }, null, 2) },
        ],
      };
    },
  );
}
