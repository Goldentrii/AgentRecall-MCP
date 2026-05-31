import { resolveProject } from "../storage/project.js";
import { recallSkillsByIntent, type Skill } from "../palace/skills.js";

export interface SkillRecallInput {
  project?: string;
  /** What the agent is about to do — used for trigger keyword match. */
  intent: string;
  limit?: number;
}

export interface SkillRecallHit {
  slug: string;
  name: string;
  topic: string;
  score: number;
  matched_triggers: string[];
  when: string;
  steps: string[];
  postconditions: string[];
  pitfalls?: string[];
  file_path: string;
}

export interface SkillRecallResult {
  success: boolean;
  project: string;
  intent: string;
  hits: SkillRecallHit[];
}

function toHit(x: { skill: Skill; score: number; matched_triggers: string[] }): SkillRecallHit {
  return {
    slug: x.skill.meta.slug,
    name: x.skill.meta.name,
    topic: x.skill.meta.topic,
    score: x.score,
    matched_triggers: x.matched_triggers,
    when: x.skill.body.when,
    steps: x.skill.body.steps,
    postconditions: x.skill.body.postconditions,
    pitfalls: x.skill.body.pitfalls,
    file_path: x.skill.file_path,
  };
}

export async function skillRecall(input: SkillRecallInput): Promise<SkillRecallResult> {
  const slug = await resolveProject(input.project);
  const intent = (input.intent ?? "").trim();
  if (!intent) {
    return { success: false, project: slug, intent: "", hits: [] };
  }
  const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 20) : 5;
  const ranked = recallSkillsByIntent(slug, intent, limit);
  return {
    success: true,
    project: slug,
    intent,
    hits: ranked.map(toHit),
  };
}
