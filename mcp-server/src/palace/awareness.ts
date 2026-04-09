/**
 * Awareness system — a living 200-line document that compounds insights.
 *
 * Unlike the palace (room-based storage) or journal (temporal log),
 * awareness.md is a SELF-REWRITING document. Every update forces the
 * system to merge, compress, or demote — creating compounding knowledge.
 *
 * Structure:
 *   ## Identity (5 lines)         — who is the user, what matters
 *   ## Top Insights (10 items)    — ranked by relevance + confirmation count
 *   ## Compound Insights (5 max)  — patterns spanning 3+ individual insights
 *   ## Trajectory (3 lines)       — where is the work heading
 *   ## Blind Spots (3 lines)      — what the system suspects matters but hasn't confirmed
 *
 * Max 200 lines enforced. Overflow triggers merge/demote.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { JOURNAL_ROOT } from "../types.js";
import { ensureDir } from "../storage/fs-utils.js";

const MAX_LINES = 200;

function awarenessPath(): string {
  return path.join(JOURNAL_ROOT, "awareness.md");
}

export function readAwareness(): string {
  const p = awarenessPath();
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf-8");
}

export function writeAwareness(content: string): void {
  const p = awarenessPath();
  ensureDir(path.dirname(p));

  // Enforce 200-line max
  const lines = content.split("\n");
  if (lines.length > MAX_LINES) {
    const truncated = lines.slice(0, MAX_LINES).join("\n");
    fs.writeFileSync(p, truncated + "\n", "utf-8");
  } else {
    fs.writeFileSync(p, content, "utf-8");
  }
}

export interface Insight {
  id: string;
  title: string;
  evidence: string;
  confirmations: number;
  lastConfirmed: string;
  appliesWhen: string[];
  source: string;
}

export interface CompoundInsight {
  id: string;
  title: string;
  sourceInsights: string[];
  pattern: string;
  confidence: number;
}

export interface AwarenessState {
  identity: string;
  topInsights: Insight[];
  compoundInsights: CompoundInsight[];
  trajectory: string;
  blindSpots: string[];
  lastUpdated: string;
}

const AWARENESS_JSON_PATH = () => path.join(JOURNAL_ROOT, "awareness-state.json");

export function readAwarenessState(): AwarenessState | null {
  const p = AWARENESS_JSON_PATH();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export function writeAwarenessState(state: AwarenessState): void {
  const p = AWARENESS_JSON_PATH();
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Initialize awareness from scratch.
 */
export function initAwareness(identity: string): AwarenessState {
  const state: AwarenessState = {
    identity,
    topInsights: [],
    compoundInsights: [],
    trajectory: "",
    blindSpots: [],
    lastUpdated: new Date().toISOString(),
  };
  writeAwarenessState(state);
  renderAwareness(state);
  return state;
}

/**
 * Add or merge an insight into the awareness state.
 * If similar insight exists (by title keyword overlap), merge and strengthen.
 * If new, add and demote lowest if over 10.
 */
export function addInsight(
  newInsight: Omit<Insight, "id" | "confirmations" | "lastConfirmed">
): { action: "merged" | "added" | "replaced"; insight: Insight } {
  let state = readAwarenessState();
  if (!state) {
    state = initAwareness("(unknown user)");
  }

  const now = new Date().toISOString();
  const titleWords = newInsight.title.toLowerCase().split(/\s+/);

  // Check for similar existing insight (>50% word overlap)
  let bestMatch: { idx: number; overlap: number } | null = null;
  for (let i = 0; i < state.topInsights.length; i++) {
    const existing = state.topInsights[i];
    const existingWords = existing.title.toLowerCase().split(/\s+/);
    const overlap = titleWords.filter((w) => existingWords.includes(w) && w.length > 3).length;
    const ratio = overlap / Math.max(titleWords.length, existingWords.length);
    if (ratio > 0.5 && (!bestMatch || ratio > bestMatch.overlap)) {
      bestMatch = { idx: i, overlap: ratio };
    }
  }

  if (bestMatch) {
    // Merge: strengthen existing insight
    const existing = state.topInsights[bestMatch.idx];
    existing.confirmations++;
    existing.lastConfirmed = now;
    existing.evidence += ` | ${newInsight.evidence}`;
    // Merge appliesWhen
    for (const aw of newInsight.appliesWhen) {
      if (!existing.appliesWhen.includes(aw)) {
        existing.appliesWhen.push(aw);
      }
    }
    writeAwarenessState(state);
    renderAwareness(state);
    return { action: "merged", insight: existing };
  }

  // New insight
  const insight: Insight = {
    id: `insight-${Date.now()}`,
    title: newInsight.title,
    evidence: newInsight.evidence,
    confirmations: 1,
    lastConfirmed: now,
    appliesWhen: newInsight.appliesWhen,
    source: newInsight.source,
  };

  if (state.topInsights.length < 10) {
    state.topInsights.push(insight);
    writeAwarenessState(state);
    renderAwareness(state);
    return { action: "added", insight };
  }

  // Over 10: replace lowest-confirmation insight
  state.topInsights.sort((a, b) => b.confirmations - a.confirmations);
  const demoted = state.topInsights.pop()!;
  state.topInsights.push(insight);

  writeAwarenessState(state);
  renderAwareness(state);
  return { action: "replaced", insight };
}

/**
 * Detect compound insights — patterns spanning 3+ individual insights.
 * Looks for shared appliesWhen keywords across insights.
 */
export function detectCompoundInsights(): CompoundInsight[] {
  const state = readAwarenessState();
  if (!state || state.topInsights.length < 3) return [];

  // Group insights by shared appliesWhen keywords
  const keywordMap = new Map<string, Insight[]>();
  for (const insight of state.topInsights) {
    for (const aw of insight.appliesWhen) {
      const key = aw.toLowerCase();
      if (!keywordMap.has(key)) keywordMap.set(key, []);
      keywordMap.get(key)!.push(insight);
    }
  }

  const compounds: CompoundInsight[] = [];
  for (const [keyword, insights] of keywordMap) {
    if (insights.length >= 3) {
      const id = `compound-${keyword}`;
      // Don't duplicate
      if (state.compoundInsights.some((c) => c.id === id)) continue;

      compounds.push({
        id,
        title: `Pattern: "${keyword}" appears across ${insights.length} insights`,
        sourceInsights: insights.map((i) => i.id),
        pattern: insights.map((i) => i.title).join(" + "),
        confidence: Math.min(1.0, insights.length * 0.25),
      });
    }
  }

  if (compounds.length > 0) {
    state.compoundInsights = [...state.compoundInsights, ...compounds].slice(0, 5);
    writeAwarenessState(state);
    renderAwareness(state);
  }

  return compounds;
}

/**
 * Render awareness state into the 200-line markdown document.
 */
export function renderAwareness(state: AwarenessState): void {
  const lines: string[] = [];

  lines.push("# Awareness");
  lines.push(`> Last updated: ${state.lastUpdated}`);
  lines.push("");

  // Identity
  lines.push("## Identity");
  lines.push(state.identity || "_(not set)_");
  lines.push("");

  // Top insights (sorted by confirmations)
  lines.push("## Top Insights");
  lines.push("");
  const sorted = [...state.topInsights].sort((a, b) => b.confirmations - a.confirmations);
  for (const insight of sorted) {
    lines.push(`### ${insight.title} (${insight.confirmations}x confirmed)`);
    lines.push(`- Evidence: ${insight.evidence.slice(0, 150)}`);
    lines.push(`- Applies when: ${insight.appliesWhen.join(", ")}`);
    lines.push(`- Source: ${insight.source} | Last: ${insight.lastConfirmed.slice(0, 10)}`);
    lines.push("");
  }

  // Compound insights
  if (state.compoundInsights.length > 0) {
    lines.push("## Compound Insights");
    lines.push("");
    for (const ci of state.compoundInsights) {
      lines.push(`### ${ci.title} (confidence: ${ci.confidence.toFixed(2)})`);
      lines.push(`- Pattern: ${ci.pattern.slice(0, 200)}`);
      lines.push(`- Sources: ${ci.sourceInsights.length} insights`);
      lines.push("");
    }
  }

  // Trajectory
  lines.push("## Trajectory");
  lines.push(state.trajectory || "_(not set — will emerge after 3+ sessions)_");
  lines.push("");

  // Blind spots
  lines.push("## Blind Spots");
  if (state.blindSpots.length > 0) {
    for (const bs of state.blindSpots) {
      lines.push(`- ${bs}`);
    }
  } else {
    lines.push("_(none detected yet)_");
  }

  writeAwareness(lines.join("\n"));
}
