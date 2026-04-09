/**
 * Tool: awareness_update — Update the awareness system with new insights.
 *
 * Called at end of session. Merges new insights into the living awareness.md.
 * The 200-line constraint forces compression and compounding.
 */

import * as z from "zod/v4";
import type { ServerType } from "../server.js";
import {
  readAwarenessState,
  initAwareness,
  addInsight,
  detectCompoundInsights,
  renderAwareness,
} from "../palace/awareness.js";
import { addIndexedInsight } from "../palace/insights-index.js";

export function register(server: ServerType): void {
  server.registerTool("awareness_update", {
    title: "Update Awareness",
    description:
      "Add insights to the awareness system. Call at end of session. " +
      "New insights are merged with existing ones (strengthening confirmed patterns) " +
      "or added (demoting least-relevant if over 10). " +
      "Also updates the cross-project insights index.",
    inputSchema: {
      insights: z.array(z.object({
        title: z.string().describe("One-line insight title"),
        evidence: z.string().describe("What happened that confirmed this insight"),
        applies_when: z.array(z.string()).describe("Situations where this insight is relevant (keywords)"),
        source: z.string().describe("Where this was learned (project name, date, context)"),
        severity: z.enum(["critical", "important", "minor"]).default("important"),
      })).describe("1-5 insights from this session"),
      trajectory: z.string().optional().describe("Where is the work heading? One line."),
      blind_spots: z.array(z.string()).optional().describe("What might matter but hasn't been explored?"),
      identity: z.string().optional().describe("Update user identity (only on first use or major change)"),
    },
  }, async ({ insights, trajectory, blind_spots, identity }) => {
    // Initialize if needed
    let state = readAwarenessState();
    if (!state) {
      state = initAwareness(identity || "(unknown user)");
    }

    // Update identity if provided
    if (identity) {
      state.identity = identity;
    }

    // Process each insight
    const results: Array<{ title: string; action: string }> = [];
    for (const insight of insights) {
      const result = addInsight({
        title: insight.title,
        evidence: insight.evidence,
        appliesWhen: insight.applies_when,
        source: insight.source,
      });
      results.push({ title: insight.title, action: result.action });

      // Also add to cross-project insights index
      addIndexedInsight({
        title: insight.title,
        source: insight.source,
        applies_when: insight.applies_when,
        file: undefined,
        severity: insight.severity,
      });
    }

    // Update trajectory
    if (trajectory) {
      state = readAwarenessState()!;
      state.trajectory = trajectory;
    }

    // Update blind spots
    if (blind_spots && blind_spots.length > 0) {
      state = readAwarenessState()!;
      state.blindSpots = blind_spots.slice(0, 5);
    }

    // Save and render
    if (state) {
      state.lastUpdated = new Date().toISOString();
      const { writeAwarenessState } = await import("../palace/awareness.js");
      writeAwarenessState(state);
      renderAwareness(state);
    }

    // Detect compound insights
    const compounds = detectCompoundInsights();

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          insights_processed: results,
          compound_insights_detected: compounds.length,
          total_insights: readAwarenessState()?.topInsights.length ?? 0,
        }),
      }],
    };
  });
}
