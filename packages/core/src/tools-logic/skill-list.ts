import { resolveProject } from "../storage/project.js";
import { listSkills } from "../palace/skills.js";

export interface SkillListInput {
  project?: string;
}

export interface SkillListItem {
  slug: string;
  name: string;
  topic: string;
  triggers: string[];
  source: string;
  updated: string;
  file_path: string;
}

export interface SkillListResult {
  success: boolean;
  project: string;
  skills: SkillListItem[];
}

export async function skillList(input: SkillListInput): Promise<SkillListResult> {
  const slug = await resolveProject(input.project);
  const skills = listSkills(slug);
  return {
    success: true,
    project: slug,
    skills: skills.map((s) => ({
      slug: s.meta.slug,
      name: s.meta.name,
      topic: s.meta.topic,
      triggers: s.meta.triggers,
      source: s.meta.source ?? "manual",
      updated: s.meta.updated,
      file_path: s.file_path,
    })),
  };
}
