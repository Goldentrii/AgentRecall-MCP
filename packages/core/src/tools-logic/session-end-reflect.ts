/**
 * Reflect — Park-2023-style aggregation step.
 *
 * The V2 finding: AgentRecall only promotes insights from CORRECTIONS.
 * Successful patterns never become semantic knowledge. Generative Agents
 * (Park et al. 2023) showed that periodic LLM-driven distillation of raw
 * memories into "high-level questions + derived insights" is the move
 * that makes memory compound.
 *
 * Design choice: this tool does NOT call an LLM directly. Core is meant
 * to stay deterministic + dependency-free of any model API. Instead, we
 * package the necessary inputs + prompt template into a structured
 * payload that the calling MCP tool returns to the LLM in the loop, and
 * the LLM does the synthesis on its own turn. The result can then be
 * fed back via `skill_write` or `awareness_update`.
 *
 * Why: this matches AgentRecall's "agent-as-author" stance — the agent
 * already in the conversation writes its own reflection, we just give it
 * the inputs.
 */

import { resolveProject } from "../storage/project.js";
import { readCorrections } from "../storage/corrections.js";
import { listJournalFiles } from "../helpers/journal-files.js";
import { listMilestones } from "../palace/pipeline.js";
import * as fs from "node:fs";
import * as path from "node:path";

export interface ReflectInput {
  project?: string;
  /** Look back this many days of journal entries. Default 7. */
  lookback_days?: number;
}

export interface ReflectInputBundle {
  /** Journal entries (file path + first 800 chars) within lookback window. */
  recent_journals: Array<{ date: string; file: string; excerpt: string }>;
  /** Active corrections relevant to the lookback window. */
  active_corrections: Array<{ id: string; rule: string; severity: string; precision: number | null }>;
  /** Last 3 closed pipeline phases with their synthesis. */
  recent_phases: Array<{ order: number; phase: string; synthesis: string }>;
}

export interface ReflectResult {
  success: boolean;
  project: string;
  bundle: ReflectInputBundle;
  /** Ready-to-paste prompt the calling LLM can use to write reflection back. */
  prompt: string;
  /** Suggested follow-up tool calls. */
  next_actions: string[];
}

const EXCERPT_CHARS = 800;

export async function sessionEndReflect(input: ReflectInput): Promise<ReflectResult> {
  const slug = await resolveProject(input.project);
  const lookback = input.lookback_days && input.lookback_days > 0 ? input.lookback_days : 7;
  const cutoff = new Date(Date.now() - lookback * 86400000);

  // Collect recent journal excerpts
  const journals = listJournalFiles(slug);
  const recentJournals: ReflectInputBundle["recent_journals"] = [];
  for (const j of journals) {
    const d = new Date(j.date);
    if (Number.isNaN(d.getTime()) || d < cutoff) continue;
    let excerpt = "";
    try {
      const content = fs.readFileSync(path.join(j.dir, j.file), "utf-8");
      excerpt = content.slice(0, EXCERPT_CHARS);
    } catch {
      // skip unreadable
    }
    recentJournals.push({ date: j.date, file: j.file, excerpt });
    if (recentJournals.length >= 7) break;
  }

  // Active corrections + precision
  const corrections = readCorrections(slug)
    .filter((r) => r.active !== false)
    .slice(0, 20)
    .map((r) => ({
      id: r.id,
      rule: r.rule,
      severity: r.severity,
      precision: r.precision ?? null,
    }));

  // Last 3 closed phases
  const allPhases = listMilestones(slug);
  const recentPhases = allPhases
    .filter((p) => p.meta.status === "closed")
    .slice(-3)
    .map((p) => ({
      order: p.meta.order,
      phase: p.meta.phase,
      synthesis: p.sections.synthesis,
    }));

  const bundle: ReflectInputBundle = {
    recent_journals: recentJournals,
    active_corrections: corrections,
    recent_phases: recentPhases,
  };

  const prompt = buildPrompt(slug, bundle, lookback);
  const nextActions = [
    "After reading the bundle, call skill_write for any IF-THEN production rule worth saving (procedural memory).",
    "Call session_end again with insights[] containing distilled cross-session patterns.",
    "If a correction's precision < 0.3 across ≥3 retrievals, suggest archiving it (set active:false).",
  ];

  return { success: true, project: slug, bundle, prompt, next_actions: nextActions };
}

function buildPrompt(slug: string, bundle: ReflectInputBundle, lookback: number): string {
  const lines: string[] = [];
  lines.push(`# Reflect on ${slug} — last ${lookback} days`);
  lines.push("");
  lines.push("You are the agent reviewing your own recent work. Look at the inputs below and produce:");
  lines.push("");
  lines.push("1. **Three high-level questions** this period raised (Park 2023 style).");
  lines.push("2. **Procedural skills** that crystallized — anything repeated ≥2x is a candidate (call skill_write).");
  lines.push("3. **Cross-session patterns** that aren't yet in awareness — distilled insights worth promoting.");
  lines.push("4. **Noise to archive** — corrections with low precision that should be retired.");
  lines.push("");
  lines.push("Be terse. One bullet per finding. Cite journal dates / phase orders / correction ids as evidence.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## Journals (${bundle.recent_journals.length})`);
  for (const j of bundle.recent_journals) {
    lines.push(`### ${j.date} — ${j.file}`);
    lines.push(j.excerpt);
    lines.push("");
  }
  lines.push(`## Active corrections (${bundle.active_corrections.length})`);
  for (const c of bundle.active_corrections) {
    const p = c.precision !== null ? ` p=${c.precision}` : "";
    lines.push(`- [${c.id}] (${c.severity}${p}) ${c.rule}`);
  }
  lines.push("");
  lines.push(`## Recent closed phases (${bundle.recent_phases.length})`);
  for (const ph of bundle.recent_phases) {
    lines.push(`- Phase ${ph.order} — ${ph.phase}: ${ph.synthesis}`);
  }
  return lines.join("\n");
}
