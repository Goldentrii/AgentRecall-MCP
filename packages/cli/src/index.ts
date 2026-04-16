#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { VERSION, setRoot } from "agent-recall-core";
import type { Importance, WalkDepth } from "agent-recall-core";

const args = process.argv.slice(2);

// Global flags
const rootIdx = args.indexOf("--root");
if (rootIdx >= 0 && args[rootIdx + 1]) {
  setRoot(args.splice(rootIdx, 2)[1]);
}

const projectIdx = args.indexOf("--project");
let globalProject: string | undefined;
if (projectIdx >= 0 && args[projectIdx + 1]) {
  globalProject = args.splice(projectIdx, 2)[1];
}

const command = args[0];
const rest = args.slice(1);

function getFlag(flag: string, flagArgs: string[]): string | undefined {
  const idx = flagArgs.indexOf(flag);
  if (idx >= 0 && flagArgs[idx + 1]) return flagArgs[idx + 1];
  return undefined;
}

function hasFlag(flag: string, flagArgs: string[]): boolean {
  return flagArgs.includes(flag);
}

function output(data: unknown): void {
  if (typeof data === "string") process.stdout.write(data + "\n");
  else process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function printHelp(): void {
  output(`ar v${VERSION} — AgentRecall CLI

JOURNAL:
  ar read [--date YYYY-MM-DD] [--section <name>]
  ar write <content> [--section <name>]
  ar capture <question> <answer> [--tags tag1,tag2]
  ar list [--limit N]
  ar search <query> [--include-palace]
  ar state read|write [data]
  ar cold-start
  ar archive [--older-than-days N]
  ar rollup [--min-age-days N] [--dry-run]

PALACE:
  ar palace read [<room>] [--topic <name>]
  ar palace write <room> <content> [--importance high|medium|low]
  ar palace walk [--depth identity|active|relevant|full]
  ar palace search <query>
  ar palace lint [--fix]

AWARENESS:
  ar awareness read
  ar awareness update --insight "title" --evidence "ev" --applies-when kw1,kw2

INSIGHT:
  ar insight <context> [--limit N]

DIGEST (context cache):
  ar digest store --title "t" --scope "s" --content "c" [--ttl 168] [--global]
  ar digest recall <query> [--limit N] [--stale] [--no-global]
  ar digest list [--stale]
  ar digest invalidate <id> [--reason "why"] [--global]

META:
  ar projects
  ar synthesize [--entries N]
  ar knowledge write --category <cat> --title "t" --what "w" --cause "c" --fix "f"
  ar knowledge read [--category <cat>]

HOOKS (auto-fired by Claude Code hooks — no agent discipline needed):
  ar hook-start          Session start: load context, show watch_for warnings
  ar hook-end            Session end: auto-save journal if not already saved today
  ar hook-correction     Read UserPromptSubmit JSON from stdin, capture corrections silently
  ar correct --goal "g" --correction "c" [--delta "d"]  Manually record a correction

GLOBAL FLAGS:
  --root <path>     Storage root (default: ~/.agent-recall)
  --project <slug>  Project override
  --help, -h        Show help
  --version, -v     Show version`);
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    output(VERSION);
    return;
  }

  // Import core functions
  const core = await import("agent-recall-core");
  const project = globalProject;

  switch (command) {
    case "read": {
      const result = await core.journalRead({
        date: getFlag("--date", rest) ?? "latest",
        section: getFlag("--section", rest) ?? "all",
        project,
      });
      output(result);
      break;
    }
    case "write": {
      const content = rest.filter((a) => !a.startsWith("--")).join(" ");
      const result = await core.journalWrite({
        content,
        section: getFlag("--section", rest),
        palace_room: getFlag("--palace-room", rest),
        project,
      });
      output(result);
      break;
    }
    case "capture": {
      const positional = rest.filter((a) => !a.startsWith("--"));
      const question = positional[0] || "";
      const answer = positional[1] || "";
      const tagsStr = getFlag("--tags", rest);
      const tags = tagsStr ? tagsStr.split(",") : undefined;
      const result = await core.journalCapture({
        question,
        answer,
        tags,
        palace_room: getFlag("--palace-room", rest),
        project,
      });
      output(result);
      break;
    }
    case "list": {
      const limit = getFlag("--limit", rest);
      const result = await core.journalList({
        project,
        limit: limit ? parseInt(limit) : 10,
      });
      output(result);
      break;
    }
    case "search": {
      const query = rest.filter((a) => !a.startsWith("--"))[0] || "";
      const result = await core.journalSearch({
        query,
        project,
        section: getFlag("--section", rest),
        include_palace: hasFlag("--include-palace", rest),
      });
      output(result);
      break;
    }
    case "state": {
      const action = (rest[0] as "read" | "write") || "read";
      const data =
        rest[1] && !rest[1].startsWith("--") ? rest[1] : undefined;
      const result = await core.journalState({
        action,
        data,
        date: getFlag("--date", rest) ?? "latest",
        project,
      });
      output(result);
      break;
    }
    case "cold-start": {
      const result = await core.journalColdStart({ project });
      output(result);
      break;
    }
    case "archive": {
      const days = getFlag("--older-than-days", rest);
      const result = await core.journalArchive({
        older_than_days: days ? parseInt(days) : 7,
        project,
      });
      output(result);
      break;
    }
    case "rollup": {
      const minAge = getFlag("--min-age-days", rest);
      const minEntries = getFlag("--min-entries", rest);
      const result = await core.journalRollup({
        min_age_days: minAge ? parseInt(minAge) : 7,
        min_entries: minEntries ? parseInt(minEntries) : 2,
        dry_run: hasFlag("--dry-run", rest),
        project,
      });
      output(result);
      break;
    }
    case "projects": {
      const result = await core.journalProjects();
      output(result);
      break;
    }
    case "palace": {
      const sub = rest[0];
      const palaceRest = rest.slice(1);
      switch (sub) {
        case "read": {
          const room = palaceRest.find((a) => !a.startsWith("--"));
          const result = await core.palaceRead({
            room,
            topic: getFlag("--topic", palaceRest),
            project,
          });
          output(result);
          break;
        }
        case "write": {
          const positional = palaceRest.filter((a) => !a.startsWith("--"));
          const room = positional[0] || "";
          const content = positional.slice(1).join(" ");
          const result = await core.palaceWrite({
            room,
            content,
            topic: getFlag("--topic", palaceRest),
            importance:
              (getFlag("--importance", palaceRest) as Importance) ||
              undefined,
            connections: getFlag("--connections", palaceRest)?.split(","),
            project,
          });
          output(result);
          break;
        }
        case "walk": {
          const result = await core.palaceWalk({
            depth:
              (getFlag("--depth", palaceRest) as WalkDepth) ?? "active",
            focus: getFlag("--focus", palaceRest),
            project,
          });
          output(result);
          break;
        }
        case "search": {
          const query = palaceRest.find((a) => !a.startsWith("--")) || "";
          const result = await core.palaceSearch({
            query,
            room: getFlag("--room", palaceRest),
            project,
          });
          output(result);
          break;
        }
        case "lint": {
          const result = await core.palaceLint({
            fix: hasFlag("--fix", palaceRest),
            project,
          });
          output(result);
          break;
        }
        default:
          process.stderr.write(`Unknown palace subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }
    case "awareness": {
      const sub = rest[0];
      if (sub === "read") {
        if (hasFlag("--json", rest)) {
          output(core.readAwarenessState());
        } else {
          const content = core.readAwareness();
          output(content || "(no awareness file)");
        }
      } else if (sub === "update") {
        const result = await core.awarenessUpdate({
          insights: [
            {
              title: getFlag("--insight", rest) || "",
              evidence: getFlag("--evidence", rest) || "",
              applies_when: (getFlag("--applies-when", rest) || "")
                .split(",")
                .filter(Boolean),
              source: getFlag("--source", rest) || "",
              severity:
                (getFlag("--severity", rest) as "critical" | "important" | "minor") ||
                "important",
            },
          ],
          trajectory: getFlag("--trajectory", rest),
        });
        output(result);
      } else {
        process.stderr.write(`Unknown awareness subcommand: ${sub}\n`);
        process.exit(1);
      }
      break;
    }
    case "insight": {
      const context = rest.filter((a) => !a.startsWith("--")).join(" ");
      const limit = getFlag("--limit", rest);
      const result = await core.recallInsight({
        context,
        limit: limit ? parseInt(limit) : 5,
      });
      output(result);
      break;
    }
    case "synthesize": {
      const entries = getFlag("--entries", rest);
      const result = await core.contextSynthesize({
        entries: entries ? parseInt(entries) : 5,
        focus:
          (getFlag("--focus", rest) as "full" | "decisions" | "blockers" | "goals") ??
          "full",
        include_palace: !hasFlag("--no-palace", rest),
        consolidate: hasFlag("--consolidate", rest),
        project,
      });
      output(result);
      break;
    }
    case "knowledge": {
      const sub = rest[0];
      const knRest = rest.slice(1);
      if (sub === "write") {
        const result = await core.knowledgeWrite({
          category: getFlag("--category", knRest) || "general",
          title: getFlag("--title", knRest) || "",
          what_happened: getFlag("--what", knRest) || "",
          root_cause: getFlag("--cause", knRest) || "",
          fix: getFlag("--fix", knRest) || "",
          severity:
            (getFlag("--severity", knRest) as "critical" | "important" | "minor") ||
            "important",
          project,
        });
        output(result);
      } else if (sub === "read") {
        const result = await core.knowledgeRead({
          project: getFlag("--project", knRest) || project,
          category: getFlag("--category", knRest),
          query: getFlag("--query", knRest),
        });
        output(result);
      } else {
        process.stderr.write(`Unknown knowledge subcommand: ${sub}\n`);
        process.exit(1);
      }
      break;
    }
    // ── Hook commands — fired automatically by Claude Code hooks ──────────────

    case "hook-start": {
      // Fires once per session via SessionStart hook.
      // Loads context and surfaces watch_for warnings for the agent.
      // Uses a per-session lock file to avoid double-firing.
      const lockDir = path.join(os.homedir(), ".agent-recall");
      const lockFile = path.join(lockDir, ".hook-start-lock");
      const sessionId = process.env.CLAUDE_SESSION_ID ?? process.env.SESSION_ID ?? "";
      const lockKey = sessionId || new Date().toISOString().slice(0, 13); // hour-granularity fallback

      try {
        if (fs.existsSync(lockFile) && fs.readFileSync(lockFile, "utf-8").trim() === lockKey) {
          // Already ran this session — silent exit
          process.exit(0);
        }
        fs.writeFileSync(lockFile, lockKey, "utf-8");
      } catch { /* non-blocking */ }

      try {
        const result = await core.sessionStart({ project });
        const lines: string[] = ["[AgentRecall] Session context loaded"];

        // Project + identity — always show so agent knows the project
        lines.push(`Project: ${result.project}${result.identity && result.identity !== result.project ? ` — ${result.identity.slice(0, 100)}` : ""}`);

        // Watch-for warnings — most critical, always first
        if (result.watch_for && result.watch_for.length > 0) {
          lines.push("⚠️  Past corrections — adjust approach:");
          for (const w of result.watch_for) {
            lines.push(`   - ${w.pattern} (×${w.frequency})${w.suggestion ? ` → ${w.suggestion}` : ""}`);
          }
        }

        // Top 3 insights (sorted by confirmations — most proven patterns first)
        if (result.insights.length > 0) {
          lines.push("💡 Awareness insights:");
          for (const ins of result.insights.slice(0, 3)) {
            lines.push(`   [${ins.confirmed}×] ${ins.title.slice(0, 100)}`);
          }
        }

        // Recent context
        const recent = result.recent;
        if (recent.today) {
          lines.push(`📓 Today: ${recent.today.replace(/\n/g, " ").slice(0, 150)}`);
        } else if (recent.yesterday) {
          lines.push(`📓 Yesterday: ${recent.yesterday.replace(/\n/g, " ").slice(0, 150)}`);
        }
        if (recent.older_count > 0) {
          lines.push(`   (${recent.older_count} older entries in journal)`);
        }

        // Cross-project hint — signal that related insights exist
        if (result.cross_project && result.cross_project.length > 0) {
          lines.push(`🔗 Cross-project: ${result.cross_project.length} related insight(s) from other projects — run /arstart for details`);
        }

        process.stdout.write(lines.join("\n") + "\n\n");
      } catch (e) {
        // Never block the session — fail silently
        process.stderr.write(`[AgentRecall hook-start] ${String(e)}\n`);
      }
      break;
    }

    case "hook-end": {
      // Fires at session Stop via Stop hook.
      // Auto-saves a minimal journal entry IF /arsave wasn't called manually.
      // Per-session lock (mirrors hook-start) prevents double-fire within the same session.
      const endSessionId = process.env.CLAUDE_SESSION_ID ?? process.env.SESSION_ID ?? "";
      const endToday = new Date().toISOString().slice(0, 10);
      const endLockKey = `${endSessionId || endToday}-end`;
      const endLockFile = path.join(os.homedir(), ".agent-recall", ".hook-end-lock");

      try {
        if (fs.existsSync(endLockFile) && fs.readFileSync(endLockFile, "utf-8").trim() === endLockKey) {
          process.exit(0);
        }
        fs.writeFileSync(endLockFile, endLockKey, "utf-8");
      } catch { /* non-blocking */ }

      try {
        const today = endToday;

        // Auto-summarize from today's captures if any
        const resolvedJournalDir = path.join(os.homedir(), ".agent-recall", "projects", project ?? "auto", "journal");
        const logFile = path.join(resolvedJournalDir, `${today}-log.md`);
        let summary = "Session ended (auto-saved via hook)";
        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, "utf-8");
          const answers = logContent.match(/\*\*A:\*\*\s*(.+)/g) ?? [];
          if (answers.length > 0) {
            summary = `Auto-saved: ${answers.slice(0, 2).map((a) => a.replace("**A:** ", "").slice(0, 60)).join("; ")}`;
          }
        }

        await core.sessionEnd({ summary, project });
        process.stderr.write(`[AgentRecall] Session auto-saved\n`);
      } catch (e) {
        process.stderr.write(`[AgentRecall hook-end] ${String(e)}\n`);
      }
      break;
    }

    case "hook-correction": {
      // Reads UserPromptSubmit JSON from stdin.
      // Detects correction language and silently captures to alignment-log.
      // Per-session lock prevents duplicate entries from multiple fires in the same session.
      // Always exits 0 — never blocks the conversation.
      const corrSessionId = process.env.CLAUDE_SESSION_ID ?? process.env.SESSION_ID ?? "";
      const corrLockKey = corrSessionId || new Date().toISOString().slice(0, 13); // hour-granularity fallback
      const corrLockFile = path.join(os.homedir(), ".agent-recall", ".hook-correction-lock");
      let corrLockContent = "";
      try { corrLockContent = fs.existsSync(corrLockFile) ? fs.readFileSync(corrLockFile, "utf-8").trim() : ""; } catch { /* non-blocking */ }

      const CORRECTION_PATTERNS = [
        /\bthat'?s\s+wrong\b/i,
        /\byou\s+(missed|didn'?t|forgot|skipped)\b/i,
        /\bnot\s+what\s+i\s+(asked|wanted|meant|said)\b/i,
        /\bagain\s+you\b/i,
        /\bstop\s+(doing|adding|making)\b/i,
        /\bwrong\s+(approach|direction|file|function)\b/i,
        /\bi\s+said\b.*\bnot\b/i,
        /\bdon'?t\s+(do\s+that|change|delete|add)\b/i,
        /\bno[,!.]\s+(don'?t|that|you|i\s+meant)\b/i,
      ];

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString("utf-8").trim();
        if (!raw) process.exit(0);

        let prompt = "";
        let lastGoal = "";
        try {
          const input = JSON.parse(raw);
          // Claude Code UserPromptSubmit format
          prompt = input.prompt ?? input.message ?? input.user_message ?? "";
          // Try to get last assistant action as the "goal"
          const transcript = input.transcript ?? [];
          const lastAssistant = [...transcript].reverse().find((m: {role: string; content: string}) => m.role === "assistant");
          if (lastAssistant?.content) {
            lastGoal = String(lastAssistant.content).replace(/\n/g, " ").slice(0, 100);
          }
        } catch {
          prompt = raw; // fallback: treat raw input as the prompt
        }

        const isCorrection = CORRECTION_PATTERNS.some((p) => p.test(prompt));
        if (isCorrection && prompt.length > 3) {
          // Per-session dedup: only write the first correction per session.
          // Subsequent corrections in the same session would have slightly different text,
          // but the session lock prevents runaway writes from hook re-fires.
          if (corrLockContent === corrLockKey) {
            process.exit(0);
          }
          try { fs.writeFileSync(corrLockFile, corrLockKey, "utf-8"); } catch { /* non-blocking */ }

          await core.check({
            goal: lastGoal || "Unknown — see correction",
            confidence: "high",
            human_correction: prompt.slice(0, 200),
            // Delta describes the gap using actual content so keyword grouping
            // produces meaningful topics (e.g. "deploy-vercel") not "human-corrected"
            delta: `${lastGoal ? `Was: "${lastGoal.slice(0, 60)}"` : "Unknown context"} | Correction: "${prompt.slice(0, 80)}"`,
            project,
          });
          // Silent — no stdout output, correction captured in alignment-log
        }
      } catch (e) {
        process.stderr.write(`[AgentRecall hook-correction] ${String(e)}\n`);
      }
      process.exit(0);
    }

    case "correct": {
      // Manual correction recording — useful when you want to explicitly log a correction.
      const corrGoal = getFlag("--goal", rest) ?? rest.filter((a) => !a.startsWith("--"))[0] ?? "";
      const corrCorrection = getFlag("--correction", rest) ?? rest.filter((a) => !a.startsWith("--"))[1] ?? "";
      const corrDelta = getFlag("--delta", rest) ?? "";
      const result = await core.check({
        goal: corrGoal,
        confidence: "high",
        human_correction: corrCorrection,
        delta: corrDelta || `Manual correction recorded: "${corrCorrection.slice(0, 80)}"`,
        project,
      });
      output(result);
      break;
    }

    case "digest": {
      const sub = rest[0];
      const digRest = rest.slice(1);
      if (sub === "store") {
        const title = getFlag("--title", digRest) ?? digRest.find((a) => !a.startsWith("--")) ?? "";
        const scope = getFlag("--scope", digRest) ?? "";
        const content = getFlag("--content", digRest) ?? "";
        const ttl = getFlag("--ttl", digRest);
        const result = core.createDigest({
          title, scope, content,
          source_agent: getFlag("--agent", digRest),
          source_query: getFlag("--query", digRest),
          ttl_hours: ttl ? parseFloat(ttl) : undefined,
          global: hasFlag("--global", digRest),
          project,
        });
        output(result);
      } else if (sub === "recall") {
        const query = digRest.find((a) => !a.startsWith("--")) ?? "";
        const limit = getFlag("--limit", digRest);
        const proj = project ?? "auto";
        const resolvedProject = await core.resolveProject(proj);
        const digests = core.findMatchingDigests(query, resolvedProject, {
          includeStale: hasFlag("--stale", digRest),
          includeGlobal: !hasFlag("--no-global", digRest),
          limit: limit ? parseInt(limit) : 5,
        });
        output({ query, digests, result_count: digests.length });

      } else if (sub === "list") {
        const entries = core.listDigests(project ?? "auto", { stale: hasFlag("--stale", digRest) ? undefined : false });
        output(entries);
      } else if (sub === "invalidate") {
        const id = digRest.find((a) => !a.startsWith("--")) ?? "";
        const reason = getFlag("--reason", digRest) ?? "manually invalidated";
        core.markStale(project ?? "auto", id, reason, hasFlag("--global", digRest));
        output({ success: true, id });
      } else {
        process.stderr.write(`Usage: ar digest store|recall|list|invalidate [...opts]\n`);
        process.exit(1);
      }
      break;
    }

    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
