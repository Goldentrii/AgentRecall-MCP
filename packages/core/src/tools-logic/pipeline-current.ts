import { resolveProject } from "../storage/project.js";
import { findActiveMilestone, type Milestone } from "../palace/pipeline.js";

export interface PipelineCurrentInput {
  project?: string;
}

export interface PipelineCurrentResult {
  success: boolean;
  project: string;
  milestone: Milestone | null;
}

export async function pipelineCurrent(input: PipelineCurrentInput): Promise<PipelineCurrentResult> {
  const slug = await resolveProject(input.project);
  const milestone = findActiveMilestone(slug);
  return { success: true, project: slug, milestone };
}
