/**
 * pipeline_show — render a project's narrative spine on demand.
 *
 * Reads existing pipeline/*.md milestones + journal entries + corrections.
 * No writes, no LLM. Lazy reconstruction view of "where is this project."
 */

import { resolveProject } from "../storage/project.js";
import { listJournalFiles } from "../helpers/journal-files.js";
import { readCorrections } from "../storage/corrections.js";
import {
  listMilestones,
  summarize,
  type MilestoneSummary,
  type Milestone,
} from "../palace/pipeline.js";

export interface PipelineShowInput {
  project?: string;
  /** Render full sections (what_was_hard, how_solved) for the last N phases. Default 3. */
  detail_last_n?: number;
}

export interface SubstrateStats {
  sessions: {
    count: number;
    first_iso: string | null;
    last_iso: string | null;
    days_span: number;
  };
  corrections: { count: number };
}

export interface PipelineShowResult {
  success: boolean;
  project: string;
  substrate: SubstrateStats;
  spine: MilestoneSummary[];
  active: MilestoneSummary | null;
  /** Pretty-printed combined view, suitable for direct display. */
  view: string;
}

function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24)));
}

function formatDuration(opened: string, closed: string | null, status: string): string {
  if (status === "active") {
    const d = daysBetween(opened, new Date().toISOString());
    return d > 0 ? `${d}d open` : "open today";
  }
  if (!closed) return "";
  const d = daysBetween(opened, closed);
  return d > 0 ? `${d}d` : "same-day";
}

function gatherSubstrate(slug: string): SubstrateStats {
  const journals = listJournalFiles(slug);
  const dates = journals.map((j) => j.date).filter(Boolean).sort();
  const first = dates[0] ?? null;
  const last = dates[dates.length - 1] ?? null;
  const corrections = readCorrections(slug);
  return {
    sessions: {
      count: journals.length,
      first_iso: first,
      last_iso: last,
      days_span: first && last ? daysBetween(first, last) : 0,
    },
    corrections: { count: corrections.length },
  };
}

function renderPhase(m: Milestone, detailed: boolean): string[] {
  const lines: string[] = [];
  const statusLabel =
    m.meta.status === "active" ? "ACTIVE" : m.meta.status === "abandoned" ? "abandoned" : "closed";
  const autoFlag = m.meta.auto ? " ⚠auto" : "";
  const dur = formatDuration(m.meta.opened, m.meta.closed ?? null, m.meta.status);
  const opened = m.meta.opened?.slice(0, 10) ?? "?";
  const datePart = dur ? `${opened}, ${dur}` : opened;
  lines.push(`  ${String(m.meta.order).padStart(2, "0")} ${m.meta.phase}  (${statusLabel} ${datePart}${autoFlag})`);

  const realGoal = m.sections.goal && m.sections.goal !== "(in progress)" ? m.sections.goal : null;
  if (realGoal) lines.push(`     Goal: ${realGoal}`);

  if (detailed) {
    const hard = m.sections.what_was_hard && m.sections.what_was_hard !== "(in progress)" ? m.sections.what_was_hard : null;
    const how = m.sections.how_solved && m.sections.how_solved !== "(in progress)" ? m.sections.how_solved : null;
    if (hard) lines.push(`     Hard: ${hard}`);
    if (how) lines.push(`     Solved by: ${how}`);
  }

  if (m.meta.status !== "active" && m.sections.synthesis && m.sections.synthesis !== "(in progress)") {
    lines.push(`     → ${m.sections.synthesis}`);
  }
  if (m.meta.status === "active") {
    lines.push(`     (in progress — no synthesis yet)`);
  }
  lines.push("");
  return lines;
}

function renderView(
  slug: string,
  substrate: SubstrateStats,
  milestones: Milestone[],
  active: Milestone | null,
  detailLastN: number,
): string {
  const lines: string[] = [];
  lines.push(`=== ${slug} ===`);

  const { sessions, corrections } = substrate;
  if (sessions.count > 0) {
    if (sessions.count === 1 || sessions.days_span === 0) {
      lines.push(`Sessions: ${sessions.count} (${sessions.first_iso})`);
    } else {
      lines.push(
        `Sessions: ${sessions.count} over ${sessions.days_span} day${sessions.days_span === 1 ? "" : "s"} (${sessions.first_iso} → ${sessions.last_iso})`,
      );
    }
  }
  if (corrections.count > 0) {
    lines.push(`Corrections logged: ${corrections.count}`);
  }

  const closed = milestones.filter((m) => m.meta.status === "closed").length;
  const abandoned = milestones.filter((m) => m.meta.status === "abandoned").length;
  const activeCount = milestones.filter((m) => m.meta.status === "active").length;
  if (milestones.length > 0) {
    const parts = [`${closed} closed`];
    if (abandoned > 0) parts.push(`${abandoned} abandoned`);
    parts.push(`${activeCount} active`);
    lines.push(`Phases: ${milestones.length} (${parts.join(", ")})`);
  } else {
    lines.push(`Phases: 0`);
  }
  lines.push("");

  if (milestones.length === 0) {
    lines.push("[No phases yet. Open one with pipeline_open or wait for v1.5 auto-detection.]");
    return lines.join("\n").trimEnd();
  }

  // Render. Detail (hard/solved) only for the last N phases — keeps output bounded.
  const detailStart = Math.max(0, milestones.length - detailLastN);
  milestones.forEach((m, i) => {
    lines.push(...renderPhase(m, i >= detailStart));
  });

  if (active) {
    lines.push(`▶ Currently active: Phase ${active.meta.order} — ${active.meta.phase}`);
    if (active.sections.goal && active.sections.goal !== "(in progress)") {
      lines.push(`  Goal: ${active.sections.goal}`);
    }
  }

  return lines.join("\n").trimEnd();
}

export async function pipelineShow(input: PipelineShowInput): Promise<PipelineShowResult> {
  const slug = await resolveProject(input.project);
  const substrate = gatherSubstrate(slug);
  const milestones = listMilestones(slug);
  const active = milestones.find((m) => m.meta.status === "active") ?? null;
  const detailLastN = typeof input.detail_last_n === "number" && input.detail_last_n >= 0 ? input.detail_last_n : 3;
  const view = renderView(slug, substrate, milestones, active, detailLastN);
  return {
    success: true,
    project: slug,
    substrate,
    spine: milestones.map(summarize),
    active: active ? summarize(active) : null,
    view,
  };
}
