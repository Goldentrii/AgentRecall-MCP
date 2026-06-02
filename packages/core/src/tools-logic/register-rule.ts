import { resolveProject } from "../storage/project.js";
import { registerBehaviorRule } from "../storage/behavior-policies.js";

export interface RegisterRuleToolInput {
  project?: string;
  name: string;
  when: string;
  do: string;
}

export interface RegisterRuleToolResult {
  success: boolean;
  project: string;
  rule_id?: string;
  total_rules?: number;
  error?: string;
}

export async function registerRule(input: RegisterRuleToolInput): Promise<RegisterRuleToolResult> {
  const slug = await resolveProject(input.project);
  const r = registerBehaviorRule({
    project: slug,
    name: input.name,
    when: input.when,
    do: input.do,
  });
  return { ...r, project: slug };
}
