import { resolveProject } from "../storage/project.js";
import { listMilestones, summarize, type MilestoneSummary } from "../palace/pipeline.js";

export interface PipelineListInput {
  project?: string;
}

export interface PipelineListResult {
  success: boolean;
  project: string;
  milestones: MilestoneSummary[];
}

export async function pipelineList(input: PipelineListInput): Promise<PipelineListResult> {
  const slug = await resolveProject(input.project);
  const milestones = listMilestones(slug).map(summarize);
  return { success: true, project: slug, milestones };
}
