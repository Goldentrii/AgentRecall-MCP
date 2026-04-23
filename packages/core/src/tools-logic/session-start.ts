/**
 * session_start — combined cold-start in one call.
 *
 * Replaces: journal_cold_start + palace_walk + recall_insight
 * Target: <400 tokens output. No awareness duplication.
 */

import { resolveProject } from "../storage/project.js";
import { ensurePalaceInitialized, listRooms } from "../palace/rooms.js";
import { readIdentity } from "../palace/identity.js";
import { readAwarenessState } from "../palace/awareness.js";
import { recallInsights, readInsightsIndex } from "../palace/insights-index.js";
import { journalDirs, palaceDir } from "../storage/paths.js";
import { extractSection } from "../helpers/sections.js";
import { todayISO } from "../storage/fs-utils.js";
import { readAlignmentLog, extractWatchPatterns, type WatchForPattern } from "../helpers/alignment-patterns.js";
import { readP0Corrections, type CorrectionRecord } from "../storage/corrections.js";
import { extractKeywords } from "../helpers/auto-name.js";
import * as fs from "node:fs";
import * as path from "node:path";

/** Slice text at the nearest word boundary, avoiding mid-word truncation. */
function sliceAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const sliced = text.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(" ");
  return lastSpace > maxLen * 0.6 ? sliced.slice(0, lastSpace) : sliced;
}

export interface SessionStartInput {
  project?: string;
  context?: string;
}

export interface SessionStartResult {
  project: string;
  identity: string;
  insights: Array<{ title: string; confirmed: number; severity: string }>;
  active_rooms: Array<{ name: string; salience: number; one_liner: string; topics?: string[] }>;
  cross_project: Array<{ title: string; from_project: string; relevance: number }>;
  recent: { today: string | null; yesterday: string | null; older_count: number };
  watch_for: WatchForPattern[];
  corrections: CorrectionRecord[];
}

export async function sessionStart(input: SessionStartInput): Promise<SessionStartResult> {
  const slug = await resolveProject(input.project);
  ensurePalaceInitialized(slug);

  // 1. Identity — first meaningful lines, skipping YAML frontmatter keys and empty template stubs
  const rawIdentity = readIdentity(slug);
  const identityLines = rawIdentity.split("\n").filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith("---")) return false;
    if (t.startsWith(">")) return false;
    // Skip raw YAML frontmatter key-value lines like "project: foo" or "created: ..."
    if (/^[a-z_]+:\s/.test(t)) return false;
    // Skip unfilled template stubs
    if (t.startsWith("_(fill in")) return false;
    return true;
  });
  const identity = identityLines.slice(0, 2).map((l) => l.trim().replace(/^#+\s*/, "")).join(" ").trim() || slug;

  // 2. Top insights from awareness state — sort by confirmations DESC, recency DESC
  const state = readAwarenessState();
  const sortedInsights = (state?.topInsights ?? []).slice().sort((a, b) => {
    if (b.confirmations !== a.confirmations) return b.confirmations - a.confirmations;
    // Tiebreak: most recently confirmed first
    return (b.lastConfirmed ?? "").localeCompare(a.lastConfirmed ?? "");
  });
  const insights = sortedInsights.slice(0, 5).map((i) => ({
    title: sliceAtWord(i.title, 100),
    confirmed: i.confirmations ?? 1,
    severity: "important",
  }));

  // 3. Active rooms — top 3 by salience
  const rooms = listRooms(slug).slice(0, 3);
  const active_rooms: Array<{ name: string; salience: number; one_liner: string; topics?: string[] }> = rooms.map((r) => ({
    name: r.name,
    salience: r.salience,
    one_liner: sliceAtWord(r.description, 100),
  }));

  // 3b. Enhance rooms with topic keywords from room content
  const pd = palaceDir(slug);
  for (const room of active_rooms) {
    try {
      const roomPath = path.join(pd, "rooms", room.name.toLowerCase().replace(/\s+/g, "-"));
      if (fs.existsSync(roomPath)) {
        const files = fs.readdirSync(roomPath).filter(f => f.endsWith(".md") && f !== "README.md");
        const allContent = files.slice(0, 5).map(f =>
          fs.readFileSync(path.join(roomPath, f), "utf-8").slice(0, 200)
        ).join(" ");
        if (allContent.length > 0) {
          const topics = extractKeywords(allContent, 4);
          if (topics.length > 0) room.topics = topics;
        }
      }
    } catch { /* non-blocking — topics are best-effort */ }
  }

  // 4. Cross-project insights matching current context
  const context = input.context ?? slug;
  const matched = recallInsights(context, 3);
  const cross_project = matched.map((i) => ({
    title: sliceAtWord(i.title, 100),
    from_project: (i.source ?? "unknown").slice(0, 30),
    relevance: Math.round((i.relevance ?? 0) * 100) / 100,
  }));

  // 5. Recent journal briefs — today + yesterday only
  const dirs = journalDirs(slug);
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let todayBrief: string | null = null;
  let yesterdayBrief: string | null = null;
  let olderCount = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse();
    for (const file of files) {
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;
      const d = dateMatch[1];
      if (d === today && !todayBrief) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const brief = extractSection(content, "brief");
        todayBrief = brief ? sliceAtWord(brief, 200) : sliceAtWord(content.split("\n").slice(0, 3).join(" "), 200);
      } else if (d === yesterday && !yesterdayBrief) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const brief = extractSection(content, "brief");
        yesterdayBrief = brief ? sliceAtWord(brief, 200) : sliceAtWord(content.split("\n").slice(0, 3).join(" "), 200);
      } else if (d < yesterday) {
        olderCount++;
      }
    }
  }

  // 6. Watch for — predictive warnings from past corrections
  const alignLog = readAlignmentLog(slug);
  const watch_for = extractWatchPatterns(alignLog, 2);

  // 7. P0 corrections — always-load behavioral rules (max 5 most recent)
  const corrections = readP0Corrections(slug).slice(0, 5);

  return {
    project: slug,
    identity,
    insights,
    active_rooms,
    cross_project,
    recent: { today: todayBrief, yesterday: yesterdayBrief, older_count: olderCount },
    watch_for,
    corrections,
  };
}
