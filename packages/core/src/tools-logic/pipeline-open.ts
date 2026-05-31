import * as fs from "node:fs";
import { resolveProject } from "../storage/project.js";
import { withLock } from "../storage/filelock.js";
import { syncToSupabase } from "../supabase/sync.js";
import {
  findActiveMilestone,
  nextOrder,
  writeMilestone,
  PLACEHOLDER,
  type Milestone,
} from "../palace/pipeline.js";

/**
 * Fire-and-forget Supabase sync. Reads the just-written file back inside the
 * caller's lock window; the actual upload is deferred via setImmediate inside
 * syncToSupabase, so this never blocks.
 */
function syncPipelineFile(filePath: string, project: string): void {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    syncToSupabase(filePath, content, project, "palace", "pipeline");
  } catch {
    // Best-effort — Supabase sync failures must never break a write.
  }
}

export interface PipelineOpenInput {
  project?: string;
  phase_name: string;
  goal: string;
  close_previous_with_synthesis?: string;
  /** Mark this phase as auto-drafted (background process). Default false. */
  auto?: boolean;
}

export interface PipelineOpenResult {
  success: boolean;
  project: string;
  order: number;
  phase: string;
  file_path: string;
  closed_previous?: { order: number; phase: string; file_path: string };
  error?: string;
}

function autoCloseActive(
  project: string,
  active: Milestone,
  synthesis: string,
): { order: number; phase: string; file_path: string } {
  const closedAt = new Date().toISOString();
  const updatedMeta = { ...active.meta, status: "closed" as const, closed: closedAt };
  const sections = {
    goal: active.sections.goal,
    what_was_hard:
      active.sections.what_was_hard && active.sections.what_was_hard !== PLACEHOLDER
        ? active.sections.what_was_hard
        : "(not captured at close)",
    how_solved:
      active.sections.how_solved && active.sections.how_solved !== PLACEHOLDER
        ? active.sections.how_solved
        : "(not captured at close)",
    synthesis,
  };
  const filePath = writeMilestone(project, updatedMeta, sections, active.file_path);
  syncPipelineFile(filePath, project);
  return { order: active.meta.order, phase: active.meta.phase, file_path: filePath };
}

export async function pipelineOpen(input: PipelineOpenInput): Promise<PipelineOpenResult> {
  const slug = await resolveProject(input.project);
  const phaseName = (input.phase_name ?? "").trim();
  const goal = (input.goal ?? "").trim();
  if (!phaseName) {
    return {
      success: false,
      project: slug,
      order: 0,
      phase: "",
      file_path: "",
      error: "phase_name is required (non-empty after trim).",
    };
  }
  if (!goal) {
    return {
      success: false,
      project: slug,
      order: 0,
      phase: phaseName,
      file_path: "",
      error: "goal is required (non-empty after trim).",
    };
  }

  return withLock(`pipeline-${slug}`, (): PipelineOpenResult => {
    const active = findActiveMilestone(slug);
    let closedPrev: { order: number; phase: string; file_path: string } | undefined;

    if (active) {
      if (input.close_previous_with_synthesis && input.close_previous_with_synthesis.trim()) {
        closedPrev = autoCloseActive(slug, active, input.close_previous_with_synthesis.trim());
      } else {
        return {
          success: false,
          project: slug,
          order: active.meta.order,
          phase: active.meta.phase,
          file_path: active.file_path,
          error: `Phase ${active.meta.order} (${active.meta.phase}) is still active. Close it with pipeline_close, or pass close_previous_with_synthesis to auto-close.`,
        };
      }
    }

    const order = nextOrder(slug);
    const openedAt = new Date().toISOString();
    const meta = {
      phase: phaseName,
      order,
      status: "active" as const,
      opened: openedAt,
      closed: null,
      auto: input.auto === true,
    };
    const sections = {
      goal,
      what_was_hard: PLACEHOLDER,
      how_solved: PLACEHOLDER,
      synthesis: PLACEHOLDER,
    };
    const filePath = writeMilestone(slug, meta, sections);
    syncPipelineFile(filePath, slug);

    const result: PipelineOpenResult = {
      success: true,
      project: slug,
      order,
      phase: phaseName,
      file_path: filePath,
    };
    if (closedPrev) result.closed_previous = closedPrev;
    return result;
  });
}
