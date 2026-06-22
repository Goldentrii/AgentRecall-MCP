import * as fs from "node:fs";
import { resolveProject } from "../storage/project.js";
import { withLock } from "../storage/filelock.js";
import { syncToSupabase } from "../supabase/sync.js";
import { scrubForCloud } from "../storage/content-guard.js";
import { findActiveMilestone, writeMilestone, type PhaseStatus } from "../palace/pipeline.js";

function syncPipelineFile(filePath: string, project: string): void {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    syncToSupabase(filePath, scrubForCloud(content), project, "palace", "pipeline");
  } catch {
    // Best-effort — Supabase sync failures must never break a write.
  }
}

export interface PipelineCloseInput {
  project?: string;
  what_was_hard: string;
  how_solved: string;
  synthesis: string;
  /** Final phase status. "closed" (default), "abandoned" (gave up), "pivoted" (reversed direction). */
  status?: "closed" | "abandoned" | "pivoted";
  related_journal?: string[];
  related_insights?: string[];
}

export interface PipelineCloseResult {
  success: boolean;
  project: string;
  order?: number;
  phase?: string;
  file_path?: string;
  status?: PhaseStatus;
  error?: string;
}

export async function pipelineClose(input: PipelineCloseInput): Promise<PipelineCloseResult> {
  const slug = await resolveProject(input.project);

  const what_was_hard = (input.what_was_hard ?? "").trim();
  const how_solved = (input.how_solved ?? "").trim();
  const synthesis = (input.synthesis ?? "").trim();
  if (!what_was_hard || !how_solved || !synthesis) {
    return {
      success: false,
      project: slug,
      error: "what_was_hard, how_solved, and synthesis are all required (non-empty after trim).",
    };
  }

  // "pivoted" is rendered as a closed phase with a marker in synthesis;
  // the underlying status enum is still active|closed|abandoned for parser stability.
  const finalStatus: PhaseStatus = input.status === "abandoned" ? "abandoned" : "closed";
  const isPivot = input.status === "pivoted";

  return withLock(`pipeline-${slug}`, (): PipelineCloseResult => {
    const active = findActiveMilestone(slug);
    if (!active) {
      return {
        success: false,
        project: slug,
        error: "No active phase to close. Open one with pipeline_open first.",
      };
    }

    const closedAt = new Date().toISOString();
    const updatedMeta = {
      ...active.meta,
      status: finalStatus,
      closed: closedAt,
      related_journal: input.related_journal ?? active.meta.related_journal,
      related_insights: input.related_insights ?? active.meta.related_insights,
    };
    const sections = {
      goal: active.sections.goal,
      what_was_hard,
      how_solved,
      synthesis: isPivot ? `[pivot] ${synthesis}` : synthesis,
    };
    const filePath = writeMilestone(slug, updatedMeta, sections, active.file_path);
    syncPipelineFile(filePath, slug);

    return {
      success: true,
      project: slug,
      order: active.meta.order,
      phase: active.meta.phase,
      file_path: filePath,
      status: finalStatus,
    };
  });
}
