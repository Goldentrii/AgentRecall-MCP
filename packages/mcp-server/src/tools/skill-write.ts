import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { skillWrite } from "agent-recall-core";

const SHORT = z.string().min(1).max(200);
const TEXT = z.string().min(1).max(4096);

export function register(server: McpServer): void {
  server.registerTool(
    "skill_write",
    {
      title: "Write a Procedural Skill",
      description:
        "Save a reusable IF-THEN production rule (procedural memory). Use when you've solved a problem " +
        "via a multi-step procedure that's likely to recur (e.g. Cloudflare 4-step DNS+Proxy+OriginRule+SSL, " +
        "git rm --cached for untracked cleanup, OAuth refresh pre-check). Triggers should be intent keywords " +
        "another agent would use when asking 'how do I X'. Storage: palace/skills/NNNN-<slug>.md.",
      inputSchema: {
        name: SHORT.describe("Short human-readable name (e.g. 'Cloudflare 4-step routing')."),
        topic: z.string().min(1).max(30).regex(/^[a-z0-9-]+$/, "lowercase kebab-case").describe(
          "Topic / category, kebab-case (e.g. 'deploy', 'git', 'auth').",
        ),
        triggers: z.array(z.string().min(1).max(80)).min(1).max(20).describe(
          "Intent keywords that should match this skill — used by skill_recall.",
        ),
        file_globs: z.array(z.string().max(120)).max(10).optional().describe(
          "Optional file-path globs that boost relevance (e.g. ['**/Cloudflare/*.tf']).",
        ),
        when: TEXT.describe("1-sentence trigger condition — when to use this skill."),
        preconditions: z.array(z.string().max(400)).max(20).optional().describe("Things that must be true before applying."),
        steps: z.array(z.string().min(1).max(400)).min(1).max(50).describe("Ordered steps to execute."),
        postconditions: z.array(z.string().max(400)).max(20).optional().describe("Falsifiable success criteria."),
        pitfalls: z.array(z.string().max(400)).max(20).optional().describe("Known failure modes."),
        evidence: z.array(z.string().max(200)).max(20).optional().describe("Journal dates / commit SHAs / correction ids that led to this."),
        source: z.enum(["manual", "promoted_from_correction", "promoted_from_pipeline", "auto_reflection"]).default("manual"),
        project: z.string().max(100).default("auto"),
      },
    },
    async (args) => {
      const result = await skillWrite(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
