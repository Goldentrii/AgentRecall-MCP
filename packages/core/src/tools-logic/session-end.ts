/**
 * session_end — combined session save in one call.
 *
 * Replaces: awareness_update + journal_write + palace consolidation
 */

import * as fs from "node:fs";
import { journalWrite } from "./journal-write.js";
import { awarenessUpdate } from "./awareness-update.js";
import { consolidateJournalToPalace } from "../palace/consolidate.js";
import { resolveProject } from "../storage/project.js";
import { ensurePalaceInitialized, listRooms } from "../palace/rooms.js";
import { journalDir } from "../storage/paths.js";
import { readAwarenessState } from "../palace/awareness.js";
import { todayISO } from "../storage/fs-utils.js";
import { getRoot } from "../types.js";
import type { SaveType } from "../storage/session.js";

export interface SessionEndInput {
  summary: string;
  insights?: Array<{
    title: string;
    evidence: string;
    applies_when: string[];
    source?: string;
    severity?: "critical" | "important" | "minor";
  }>;
  trajectory?: string;
  project?: string;
  saveType?: SaveType;
}

export interface SessionEndResult {
  success: boolean;
  journal_written: boolean;
  insights_processed: number;
  awareness_updated: boolean;
  palace_consolidated: boolean;
  card: string;
}

export async function sessionEnd(input: SessionEndInput): Promise<SessionEndResult> {
  const slug = await resolveProject(input.project);
  let journalWritten = false;
  let insightsProcessed = 0;
  let awarenessUpdated = false;
  let palaceConsolidated = false;

  // 1. Write journal summary
  try {
    const journalContent = [
      "## Brief",
      input.summary,
      "",
      input.trajectory ? `## Next\n${input.trajectory}` : "",
    ].filter(Boolean).join("\n");

    await journalWrite({ content: journalContent, project: slug, saveType: input.saveType ?? "arsave" });
    journalWritten = true;
  } catch {
    // Journal write is best-effort
  }

  // 2. Update awareness with insights
  if (input.insights && input.insights.length > 0) {
    try {
      const result = await awarenessUpdate({
        insights: input.insights.map((i) => ({
          title: i.title,
          evidence: i.evidence,
          applies_when: i.applies_when,
          source: i.source ?? `session_end ${new Date().toISOString().slice(0, 10)}`,
          severity: i.severity,
        })),
        trajectory: input.trajectory,
      });
      insightsProcessed = result.insights_processed?.length ?? input.insights.length;
      awarenessUpdated = true;
    } catch {
      // Awareness update is best-effort
    }
  }

  // 3. Consolidate journal to palace
  try {
    ensurePalaceInitialized(slug);
    consolidateJournalToPalace(slug);
    palaceConsolidated = true;
  } catch {
    // Consolidation is best-effort
  }

  // 4. Render save card — server-side, always correct
  const root = getRoot();
  const date = todayISO();
  const jDir = journalDir(slug);
  const journalCount = fs.existsSync(jDir)
    ? fs.readdirSync(jDir).filter(f => f.endsWith(".md") && f !== "index.md").length
    : 0;

  // Get total awareness insights
  let totalInsights = 0;
  try {
    const awareness = readAwarenessState();
    totalInsights = awareness?.topInsights?.length ?? 0;
  } catch { /* non-blocking */ }

  // Get updated rooms
  let roomNames: string[] = [];
  try {
    const rooms = listRooms(slug);
    roomNames = rooms.slice(0, 3).map(r => r.name);
  } catch { /* non-blocking */ }

  // Count corrections for this project
  let correctionCount = 0;
  const corrDir = `${root}/projects/${slug}/corrections`;
  if (fs.existsSync(corrDir)) {
    correctionCount = fs.readdirSync(corrDir).filter(f => f.endsWith(".json")).length;
  }

  const line = "──────────────────────────────────────────────────────────────";
  const cardLines = [
    line,
    `  AgentRecall  ✓ Saved    ${slug}   ${date}   #${journalCount}`,
    line,
    "",
    `  Journal       ${jDir.replace(root, "~/.agent-recall")}/`,
    `                └─ ${date}.md                    ${journalWritten ? "[written]" : "[skipped]"}`,
    "",
    `  Awareness     ${insightsProcessed} insight${insightsProcessed !== 1 ? "s" : ""} added  (${totalInsights} total)`,
    "",
  ];

  if (palaceConsolidated && roomNames.length > 0) {
    const palacePath = `${root}/projects/${slug}/palace/`.replace(root, "~/.agent-recall");
    cardLines.push(`  Palace        ${palacePath}`);
    for (let i = 0; i < roomNames.length; i++) {
      const prefix = i === roomNames.length - 1 ? "└─" : "├─";
      cardLines.push(`                ${prefix} rooms/${roomNames[i]}              [updated]`);
    }
    cardLines.push("");
  }

  if (correctionCount > 0) {
    cardLines.push(`  Corrections   ${correctionCount} stored  (always loaded at session start)`);
    cardLines.push("");
  }

  cardLines.push(line);

  const card = cardLines.join("\n");

  return {
    success: journalWritten || awarenessUpdated,
    journal_written: journalWritten,
    insights_processed: insightsProcessed,
    awareness_updated: awarenessUpdated,
    palace_consolidated: palaceConsolidated,
    card,
  };
}
