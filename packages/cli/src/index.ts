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

DIAGNOSTICS:
  ar stats             Show memory system health: corrections, feedback, insights, graph edges
  ar rooms             Show palace rooms with entry counts and topic keywords
  ar sync-memory       Sync AgentRecall → Claude auto-memory (corrections + insights + rooms)

MULTI-SESSION:
  ar sessions                List all Claude Code sessions active today (diagnostic)
  ar saveall [--dry-run]     Save all today's sessions to AgentRecall automatically

HOOKS (auto-fired by Claude Code hooks — no agent discipline needed):
  ar hook-start          Session start: load context, show watch_for warnings
  ar hook-end            Session end: auto-save journal if not already saved today
  ar hook-correction     Read UserPromptSubmit JSON from stdin, capture corrections silently
  ar hook-ambient        Read UserPromptSubmit JSON from stdin, inject relevant memories into context
  ar correct --goal "g" --correction "c" [--delta "d"]  Manually record a correction
  ar merge <target> <source>   Merge two journal files (append source into target, backup source)

DIAGNOSTICS:
  ar stats             Show memory system health: corrections, feedback, insights, graph edges

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

        // Active rooms with topics — help agent navigate the palace
        if (result.active_rooms && result.active_rooms.length > 0) {
          lines.push("🏛️  Palace rooms:");
          for (const room of result.active_rooms) {
            const topicStr = room.topics && room.topics.length > 0 ? ` — ${room.topics.join(", ")}` : "";
            lines.push(`   - ${room.name} (salience ${room.salience.toFixed(2)})${topicStr}`);
          }
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

        // Only save if there's actual capture data from this session.
        // If nothing was captured, don't create a useless stub file.
        const resolvedJournalDir = path.join(os.homedir(), ".agent-recall", "projects", project ?? "auto", "journal");
        const logFile = path.join(resolvedJournalDir, `${today}-log.md`);

        // Check for captures
        let summary = "";
        if (fs.existsSync(logFile)) {
          const logContent = fs.readFileSync(logFile, "utf-8");
          const answers = logContent.match(/\*\*A:\*\*\s*(.+)/g) ?? [];
          if (answers.length > 0) {
            summary = `Auto-saved: ${answers.slice(0, 2).map((a) => a.replace("**A:** ", "").slice(0, 60)).join("; ")}`;
          }
        }

        // Also check if any smart-named journal was already written today (by /arsave)
        const existingToday = fs.existsSync(resolvedJournalDir)
          ? fs.readdirSync(resolvedJournalDir).some(f => f.startsWith(today) && f.endsWith(".md") && f !== "index.md")
          : false;

        if (!summary && existingToday) {
          // /arsave already ran today — no stub needed
          process.exit(0);
        }

        if (!summary) {
          // No captures, no existing journal — nothing worth saving. Skip silently.
          process.exit(0);
        }

        await core.sessionEnd({ summary, project, saveType: "hook-end" });
        process.stderr.write(`[AgentRecall] Session auto-saved\n`);
      } catch (e) {
        process.stderr.write(`[AgentRecall hook-end] ${String(e)}\n`);
      }
      break;
    }

    case "hook-correction": {
      // Reads UserPromptSubmit JSON from stdin.
      // Detects correction language (English + Chinese) and silently captures to alignment-log.
      // Per-message hash dedup prevents duplicate entries from hook re-fires.
      // Always exits 0 — never blocks the conversation.
      const corrLockFile = path.join(os.homedir(), ".agent-recall", ".hook-correction-seen");

      // Read existing seen entries (array of {hash, keywords} for semantic dedup)
      let seenEntries: Array<{ hash: string; keywords: string[] }> = [];
      try {
        if (fs.existsSync(corrLockFile)) {
          const parsed = JSON.parse(fs.readFileSync(corrLockFile, "utf-8"));
          if (Array.isArray(parsed)) {
            // Migrate from old format (string[] of hashes) to new format ({hash, keywords}[])
            if (parsed.length > 0 && typeof parsed[0] === "string") {
              seenEntries = parsed.map((h: string) => ({ hash: h, keywords: [] }));
            } else {
              seenEntries = parsed;
            }
          }
        }
      } catch { seenEntries = []; }

      function quickHash(text: string): string {
        let h = 0;
        for (let i = 0; i < text.length; i++) {
          h = ((h << 5) - h) + text.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h).toString(36).slice(0, 8);
      }

      const CORRECTION_PATTERNS = [
        // English patterns
        /\bthat'?s\s+wrong\b/i,
        /\byou\s+(missed|didn'?t|forgot|skipped)\b/i,
        /\bnot\s+what\s+i\s+(asked|wanted|meant|said)\b/i,
        /\bagain\s+you\b/i,
        /\bstop\s+(doing|adding|making)\b/i,
        /\bwrong\s+(approach|direction|file|function)\b/i,
        /\bi\s+said\b.*\bnot\b/i,
        /\bdon'?t\s+(do\s+that|change|delete|add)\b/i,
        /\bno[,!.]\s+(don'?t|that|you|i\s+meant)\b/i,
        // Chinese patterns
        /不对/,
        /错了/,
        /不要这样/,
        /不是这个/,
        /你搞错了/,
        /我说的不是/,
        /别这样做/,
        /重新来/,
        /你忘了/,
        /不是我要的/,
        /搞反了/,
        /方向不对/,
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
          // Per-message dedup: skip if exact same prompt was already processed
          const promptHash = quickHash(prompt);
          if (seenEntries.some(e => e.hash === promptHash)) {
            process.exit(0);
          }

          // Semantic dedup: skip if >60% keyword overlap with a recent correction
          const promptKeywords = core.extractKeywords(prompt, 8);
          if (promptKeywords.length > 0) {
            for (const entry of seenEntries) {
              if (entry.keywords.length === 0) continue;
              const overlapCount = promptKeywords.filter(kw => entry.keywords.includes(kw)).length;
              const overlapRatio = overlapCount / Math.max(promptKeywords.length, 1);
              if (overlapRatio > 0.6) {
                // Same correction, different wording — skip
                process.exit(0);
              }
            }
          }

          // Record this entry; keep only last 20 to prevent unbounded growth
          seenEntries.push({ hash: promptHash, keywords: promptKeywords });
          if (seenEntries.length > 20) seenEntries = seenEntries.slice(-20);
          try { fs.writeFileSync(corrLockFile, JSON.stringify(seenEntries), "utf-8"); } catch { /* non-blocking */ }

          // Extract agent context from transcript (what was the agent doing?)
          let agentContext = "";
          try {
            const input = JSON.parse(raw);
            const transcript = input.transcript ?? [];
            // Find last 3 assistant messages with tool use
            const recentActions = [...transcript]
              .reverse()
              .filter((m: {role: string; content?: string}) => m.role === "assistant")
              .slice(0, 3)
              .map((m: {role: string; content?: string}) => {
                const text = String(m.content ?? "").replace(/\n/g, " ").slice(0, 80);
                return text;
              })
              .filter(Boolean);
            if (recentActions.length > 0) {
              agentContext = recentActions.join(" | ");
            }
          } catch { /* non-blocking — context is best-effort */ }

          await core.check({
            goal: lastGoal || "Unknown — see correction",
            confidence: "high",
            human_correction: prompt.slice(0, 200),
            // Delta describes the gap using actual content so keyword grouping
            // produces meaningful topics (e.g. "deploy-vercel") not "human-corrected"
            delta: `${lastGoal ? `Was: "${lastGoal.slice(0, 60)}"` : "Unknown context"} | Correction: "${prompt.slice(0, 80)}"${agentContext ? ` | Agent was: ${agentContext.slice(0, 120)}` : ""}`,
            project,
          });
          // Silent — no stdout output, correction captured in alignment-log
        }
      } catch (e) {
        process.stderr.write(`[AgentRecall hook-correction] ${String(e)}\n`);
      }
      process.exit(0);
    }

    case "hook-ambient": {
      // Reads UserPromptSubmit JSON from stdin.
      // Two-step flow: (1) submit feedback for previous recall, (2) inject new recall.
      // Always exits 0 — never blocks the conversation.
      const HIGH_VALUE_PATTERNS = /error|bug|fix|crash|broken|wrong|how|why|implement|build|create|design|architecture|correction|remember|recall|what was|last time/i;

      const SHORT_ACKS = /^(ok|yes|done|sure|got it|thanks|k|yep|nope|no|maybe|yup|alright|cool|great|perfect|sounds good|noted|understood|agreed|fine|right)\.?$/i;

      // Communication file for feedback loop (defined at top of case for both steps)
      const surfacedFile = path.join(os.homedir(), ".agent-recall", ".ambient-last-surfaced.json");

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString("utf-8").trim();
        if (!raw) process.exit(0);

        let prompt = "";
        let sessionId = process.env.CLAUDE_SESSION_ID ?? process.env.SESSION_ID ?? "default";
        try {
          const parsed = JSON.parse(raw);
          prompt = parsed.prompt ?? parsed.message ?? parsed.user_message ?? "";
          if (parsed.session_id) sessionId = String(parsed.session_id);
        } catch {
          prompt = raw;
        }

        // --- READ PREVIOUS SURFACED DATA (used by feedback + topic drift + dedup) ---
        let prevSurfaced: { items?: { id: string; title: string }[]; query?: string; timestamp?: string; history?: string[] } | null = null;
        try {
          if (fs.existsSync(surfacedFile)) {
            prevSurfaced = JSON.parse(fs.readFileSync(surfacedFile, "utf-8"));
          }
        } catch { prevSurfaced = null; }

        // --- FEEDBACK STEP (always runs, no rate limit) ---
        try {
          if (prevSurfaced) {
            const age = Date.now() - new Date(prevSurfaced.timestamp ?? 0).getTime();

            // Only process feedback if surfaced items are recent (< 10 min)
            if (age < 600_000 && Array.isArray(prevSurfaced.items) && prevSurfaced.items.length > 0) {
              // Reuse the same CORRECTION_PATTERNS from hook-correction
              const CORRECTION_PATTERNS = [
                // English
                /\bthat'?s\s+wrong\b/i, /\byou\s+(missed|didn'?t|forgot|skipped)\b/i,
                /\bnot\s+what\s+i\s+(asked|wanted|meant|said)\b/i, /\bagain\s+you\b/i,
                /\bstop\s+(doing|adding|making)\b/i, /\bwrong\s+(approach|direction|file|function)\b/i,
                /\bi\s+said\b.*\bnot\b/i, /\bdon'?t\s+(do\s+that|change|delete|add)\b/i,
                /\bno[,!.]\s+(don'?t|that|you|i\s+meant)\b/i,
                // Chinese
                /不对/, /错了/, /不要这样/, /不是这个/, /你搞错了/,
                /我说的不是/, /别这样做/, /重新来/, /你忘了/, /不是我要的/,
                /搞反了/, /方向不对/,
              ];

              const isCorrection = CORRECTION_PATTERNS.some(p => p.test(prompt));

              // Build feedback array
              const feedback = prevSurfaced.items!.map((item: { id: string; title: string }) => ({
                id: item.id,
                title: item.title,
                useful: !isCorrection,  // correction after recall = negative; no correction = positive
              }));

              // Submit feedback via smartRecall (which processes feedback param)
              try {
                await core.smartRecall({
                  query: prevSurfaced.query || "feedback",
                  project,
                  limit: 1,
                  feedback,
                });
              } catch { /* best-effort */ }
            }
          }
        } catch { /* non-blocking — feedback is best-effort */ }
        // --- END FEEDBACK STEP ---

        // --- TOPIC DRIFT DETECTION + DEDUP HISTORY ---
        // Read history from previous surfaced data. If topic changed (keyword
        // overlap < 30%), clear history to allow fresh results on new topics.
        let surfacedHistory: string[] = [];
        try {
          if (prevSurfaced) {
            surfacedHistory = Array.isArray(prevSurfaced.history) ? prevSurfaced.history : [];
            const prevQuery = prevSurfaced.query ?? "";
            if (prevQuery && prompt) {
              const prevWords = new Set(prevQuery.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2));
              const currWords = prompt.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
              if (prevWords.size > 0 && currWords.length > 0) {
                const overlap = currWords.filter((w: string) => prevWords.has(w)).length / currWords.length;
                if (overlap < 0.3) {
                  // Topic changed — clear dedup history to allow fresh results
                  surfacedHistory = [];
                }
              }
            }
          }
        } catch { /* non-blocking */ }
        // --- END TOPIC DRIFT DETECTION ---

        // Skip: too short, slash commands, short acks
        if (prompt.length < 25) process.exit(0);
        if (prompt.startsWith("/")) process.exit(0);
        if (SHORT_ACKS.test(prompt.trim())) process.exit(0);

        // Rate limiting: counter file per session
        const counterFile = path.join(os.homedir(), ".agent-recall", `.ambient-counter-${sessionId.replace(/[^a-z0-9_-]/gi, "_")}`);
        let counter = 0;
        try {
          const raw2 = fs.existsSync(counterFile) ? fs.readFileSync(counterFile, "utf-8").trim() : "0";
          counter = parseInt(raw2, 10) || 0;
        } catch { /* non-blocking */ }
        counter++;
        try { fs.writeFileSync(counterFile, String(counter), "utf-8"); } catch { /* non-blocking */ }

        const isHighValue = HIGH_VALUE_PATTERNS.test(prompt);
        const shouldFire = counter === 1 || counter % 5 === 0 || isHighValue;
        if (!shouldFire) process.exit(0);

        // Extract keywords and do smart recall
        const keywords = core.extractKeywords(prompt, 6);
        if (keywords.length === 0) process.exit(0);

        const recalled = await core.smartRecall({ query: keywords.join(" "), project, limit: 3 });

        // Format output — filter below minimum relevance threshold (silence over noise)
        const allItems = (recalled.results ?? []).filter(item => item.score >= 0.03);
        if (allItems.length === 0) process.exit(0);

        // Dedup window: filter out items already surfaced in recent fires
        const historySet = new Set(surfacedHistory);
        const items = allItems.filter(item => !historySet.has(item.id));
        if (items.length === 0) process.exit(0);

        let out = "[AgentRecall] Relevant past context:\n";
        for (const item of items) {
          const source = item.source ?? "memory";
          const title = (item.title ?? item.excerpt ?? "").slice(0, 80).replace(/\n/g, " ");
          out += `• [${source}] ${title}\n`;
        }
        process.stdout.write(out);

        // Save surfaced items for feedback loop + update dedup history
        try {
          // Append new item IDs to rolling history (max 15, drop oldest)
          const newIds = items.map(item => item.id);
          const updatedHistory = [...surfacedHistory, ...newIds].slice(-15);

          const surfacedData = {
            items: items.map(item => ({ id: item.id, title: item.title })),
            query: keywords.join(" "),
            timestamp: new Date().toISOString(),
            history: updatedHistory,
          };
          fs.writeFileSync(surfacedFile, JSON.stringify(surfacedData), "utf-8");
        } catch { /* non-blocking */ }
      } catch (e) {
        process.stderr.write(`[AgentRecall hook-ambient] ${String(e)}\n`);
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

    // -----------------------------------------------------------------------
    // ar sessions — list today's VS Code sessions (diagnostic)
    // -----------------------------------------------------------------------
    case "sessions": {
      const { readTodaySessions } = await import("./utils/transcript-reader.js");
      const sessions = readTodaySessions();
      const today = new Date().toISOString().slice(0, 10);

      if (sessions.length === 0) {
        output(`No Claude Code sessions found today (${today}).`);
        break;
      }

      output(`Claude Code sessions — ${today} (${sessions.length} found)\n`);
      for (const s of sessions) {
        const t = s.lastModified.toTimeString().slice(0, 5);
        const proj = s.projectGuess ?? "(unknown)";
        const mb = s.sizeMb.toFixed(1);
        const first = (s.firstUserMessage ?? "(no message found)")
          .replace(/\n/g, " ")
          .slice(0, 100);
        output(`  ${t}  ${mb.padStart(6)}MB  ${proj}`);
        output(`         ${first}`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // ar saveall — save all today's sessions to AgentRecall
    // -----------------------------------------------------------------------
    case "saveall": {
      const { readTodaySessions } = await import("./utils/transcript-reader.js");
      const dryRun = hasFlag("--dry-run", rest);
      const today = new Date().toISOString().slice(0, 10);
      const arRoot = path.join(os.homedir(), ".agent-recall", "projects");

      const sessions = readTodaySessions();
      if (sessions.length === 0) {
        output(`No Claude Code sessions found for today (${today}).`);
        break;
      }

      // Deduplicate by project — each project gets one session_end call
      // combining all sessions that share the same projectGuess.
      const byProject = new Map<string, typeof sessions>();
      for (const s of sessions) {
        const key = s.projectGuess ?? `unknown-${s.lastModified.toTimeString().slice(0, 5).replace(":", "")}`;
        if (!byProject.has(key)) byProject.set(key, []);
        byProject.get(key)!.push(s);
      }

      const saved: string[] = [];
      const skipped: string[] = [];
      const failed: { proj: string; err: string }[] = [];

      for (const [proj, projSessions] of byProject) {
        // Check if already journaled today (any .md that isn't -log.md or -alignment.md)
        const journalDir = path.join(arRoot, proj, "journal");
        let alreadyJournaled = false;
        if (fs.existsSync(journalDir)) {
          alreadyJournaled = fs.readdirSync(journalDir).some((f) => {
            if (!f.startsWith(today)) return false;
            if (f.endsWith("-log.md") || f.endsWith("-alignment.md")) return false;
            return f.endsWith(".md");
          });
        }

        if (alreadyJournaled) {
          skipped.push(proj);
          continue;
        }

        // Synthesize summary from all sessions for this project
        const largest = projSessions.sort((a, b) => b.sizeMb - a.sizeMb)[0];
        const firstMsg = projSessions
          .map((s) => s.firstUserMessage)
          .find((m) => m != null);

        // Pull last few assistant lines from the largest session as "what was done"
        const recentLines = largest.recentExchanges
          .split("\n")
          .filter((l) => l.startsWith("ASSISTANT:"))
          .slice(-4)
          .map((l) => l.replace("ASSISTANT:", "").trim().slice(0, 150))
          .join(" | ");

        const totalMb = projSessions.reduce((acc, s) => acc + s.sizeMb, 0).toFixed(1);
        const lastTime = projSessions[0].lastModified.toTimeString().slice(0, 5);

        const summary = [
          firstMsg
            ? `Task: ${firstMsg.replace(/\n/g, " ").slice(0, 200)}`
            : `Session in ${proj}`,
          recentLines ? `Recent: ${recentLines.slice(0, 300)}` : null,
          `(Auto-saved by ar saveall — ${totalMb}MB across ${projSessions.length} session${projSessions.length > 1 ? "s" : ""}, last active ${lastTime})`,
        ]
          .filter(Boolean)
          .join("\n\n");

        if (dryRun) {
          output(`[DRY RUN] Would save: ${proj}\n  ${summary.slice(0, 120)}\n`);
          saved.push(proj);
          continue;
        }

        try {
          await core.sessionEnd({ summary, project: proj, insights: [] });
          saved.push(proj);
        } catch (e) {
          failed.push({ proj, err: String(e) });
        }
      }

      // Report
      output(`\nar saveall — ${today}\n`);
      for (const p of saved) output(`  ✓ ${p}`);
      for (const p of skipped) output(`  ~ ${p} — already journaled, skipped`);
      for (const f of failed) output(`  ✗ ${f.proj} — ${f.err}`);
      output(`\nTotal: ${saved.length} saved, ${skipped.length} skipped, ${failed.length} failed`);
      break;
    }

    case "merge": {
      // Merge two journal files: append source into target, backup source
      const mergeTarget = rest[0];
      const mergeSource = rest[1];
      if (!mergeTarget || !mergeSource) {
        output("Usage: ar merge <target-file> <source-file>\nExample: ar merge 2026-04-18.md 2026-04-19.md");
        break;
      }
      const mergeResult = await core.journalMerge({
        target_file: mergeTarget,
        source_file: mergeSource,
        project,
      });
      output(mergeResult.card);
      break;
    }

    case "stats": {
      // Diagnostic: show memory system health numbers
      const statsRoot = path.join(os.homedir(), ".agent-recall");
      const statsProject = project ?? "auto";

      // Resolve project
      const resolvedProject = await core.resolveProject(statsProject);
      const projectDir = path.join(statsRoot, "projects", resolvedProject);

      let correctionCount = 0;
      let journalCount = 0;
      let insightCount = 0;
      let graphEdges = 0;
      let feedbackCount = 0;
      let roomCount = 0;
      let totalConfirmations = 0;

      // Count corrections
      const corrDir = path.join(projectDir, "corrections");
      if (fs.existsSync(corrDir)) {
        correctionCount = fs.readdirSync(corrDir).filter(f => f.endsWith(".json")).length;
      }

      // Count journal entries
      const jDir = path.join(projectDir, "journal");
      if (fs.existsSync(jDir)) {
        journalCount = fs.readdirSync(jDir).filter(f => f.endsWith(".md") && f !== "index.md").length;
      }

      // Count insights from awareness
      try {
        const awareness = core.readAwarenessState();
        if (awareness?.topInsights) {
          insightCount = awareness.topInsights.length;
          totalConfirmations = awareness.topInsights.reduce((sum: number, i: { confirmations?: number }) => sum + (i.confirmations ?? 1), 0);
        }
      } catch { /* non-blocking */ }

      // Count graph edges
      try {
        const graph = core.readGraph(resolvedProject);
        graphEdges = graph.edges?.length ?? 0;
      } catch { /* non-blocking */ }

      // Count feedback entries
      const feedbackFile = path.join(statsRoot, "feedback-log.json");
      if (fs.existsSync(feedbackFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(feedbackFile, "utf-8"));
          feedbackCount = Array.isArray(data) ? data.length : 0;
        } catch { /* non-blocking */ }
      }

      // Count rooms
      try {
        const rooms = core.listRooms(resolvedProject);
        roomCount = rooms.length;
      } catch { /* non-blocking */ }

      output(`AgentRecall Stats — ${resolvedProject}

  Corrections:    ${correctionCount}
  Feedback:       ${feedbackCount} signals
  Journal:        ${journalCount} entries
  Insights:       ${insightCount} (${totalConfirmations} total confirmations)
  Palace rooms:   ${roomCount}
  Graph edges:    ${graphEdges}
${correctionCount === 0 ? "\n  Warning: No corrections captured yet. Use the tool for a few sessions." : ""}${feedbackCount === 0 ? "\n  Warning: No feedback signals yet. The ambient hook will start collecting after recalls." : ""}${graphEdges < 3 ? "\n  Warning: Few graph connections. Palace rooms will connect as you write to them." : ""}`);
      break;
    }

    // -----------------------------------------------------------------------
    // ar sync-memory — generate Claude auto-memory file from AgentRecall data
    // -----------------------------------------------------------------------
    case "sync-memory": {
      const syncProject = project ?? "auto";
      const resolvedSync = await core.resolveProject(syncProject);

      // 1. Read P0 corrections
      let corrections: Array<{rule: string; date: string; severity: string}> = [];
      try {
        const allCorr = core.readP0Corrections(resolvedSync);
        corrections = allCorr.slice(0, 5).map(c => ({ rule: c.rule, date: c.date, severity: c.severity }));
      } catch { /* non-blocking */ }

      // 2. Read top awareness insights
      let insights: Array<{title: string; confirmed: number}> = [];
      try {
        const state = core.readAwarenessState();
        if (state?.topInsights) {
          insights = state.topInsights
            .sort((a: {confirmations?: number}, b: {confirmations?: number}) => (b.confirmations ?? 1) - (a.confirmations ?? 1))
            .slice(0, 8)
            .map((i: {title: string; confirmations?: number}) => ({ title: i.title.slice(0, 100), confirmed: i.confirmations ?? 1 }));
        }
      } catch { /* non-blocking */ }

      // 3. Read recent journal brief
      let recentBrief = "";
      try {
        const journalEntries = core.listJournalFiles(resolvedSync);
        if (journalEntries.length > 0) {
          const latest = core.readJournalFile(resolvedSync, journalEntries[0].date);
          if (latest) {
            // Extract ## Brief section
            const briefMatch = latest.match(/## Brief\n([\s\S]*?)(?=\n##|$)/);
            recentBrief = briefMatch ? briefMatch[1].trim().slice(0, 300) : latest.split("\n").slice(0, 3).join(" ").slice(0, 300);
          }
        }
      } catch { /* non-blocking */ }

      // 4. Read room summaries
      let syncRooms: Array<{name: string; topKeywords: string[]}> = [];
      try {
        const roomList = core.listRooms(resolvedSync);
        for (const r of roomList.slice(0, 5)) {
          try {
            const pd = core.palaceDir(resolvedSync);
            const readmePath = path.join(pd, "rooms", r.slug, "README.md");
            if (fs.existsSync(readmePath)) {
              const content = fs.readFileSync(readmePath, "utf-8").slice(0, 300);
              const kw = core.extractKeywords(content, 3);
              syncRooms.push({ name: r.name, topKeywords: kw });
            }
          } catch { /* non-blocking */ }
        }
      } catch { /* non-blocking */ }

      // 5. Build the markdown
      const syncLines: string[] = [
        `---`,
        `name: AgentRecall sync — ${resolvedSync}`,
        `description: Auto-generated from AgentRecall. P0 corrections, top insights, recent context, palace rooms.`,
        `type: reference`,
        `---`,
        ``,
        `# AgentRecall Context — ${resolvedSync}`,
        `> Auto-synced. Do not edit manually. Regenerate with: \`ar sync-memory --project ${resolvedSync}\``,
        ``,
      ];

      if (corrections.length > 0) {
        syncLines.push(`## Corrections (always follow)`);
        for (const c of corrections) {
          syncLines.push(`- **[${c.severity.toUpperCase()}]** ${c.rule}`);
        }
        syncLines.push(``);
      }

      if (insights.length > 0) {
        syncLines.push(`## Insights (${insights.length} top, by confirmation)`);
        for (const i of insights) {
          syncLines.push(`- [${i.confirmed}x] ${i.title}`);
        }
        syncLines.push(``);
      }

      if (recentBrief) {
        syncLines.push(`## Recent`);
        syncLines.push(recentBrief);
        syncLines.push(``);
      }

      if (syncRooms.length > 0) {
        syncLines.push(`## Palace Rooms`);
        for (const r of syncRooms) {
          syncLines.push(`- **${r.name}**: ${r.topKeywords.join(", ")}`);
        }
        syncLines.push(``);
      }

      const syncContent = syncLines.join("\n");

      // Write to Claude's memory directory
      const memDir = path.join(os.homedir(), ".claude", "projects", `-Users-${os.userInfo().username}`, "memory");
      const arRoot = path.join(os.homedir(), ".agent-recall");
      if (fs.existsSync(memDir)) {
        const syncPath = path.join(memDir, `ar_sync_${resolvedSync.toLowerCase()}.md`);
        fs.writeFileSync(syncPath, syncContent, "utf-8");
        output(`Synced to ${syncPath} (${syncContent.split("\n").length} lines)`);
      } else {
        // Fallback: write to AR directory
        const projectSyncDir = path.join(arRoot, "projects", resolvedSync);
        core.ensureDir(projectSyncDir);
        const syncPath = path.join(projectSyncDir, "SYNC.md");
        fs.writeFileSync(syncPath, syncContent, "utf-8");
        output(`Synced to ${syncPath} (${syncContent.split("\n").length} lines)`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // ar rooms — show palace rooms with entry counts and topic keywords
    // -----------------------------------------------------------------------
    case "rooms": {
      const roomProject = project ?? "auto";
      const resolvedRoom = await core.resolveProject(roomProject);
      const roomList = core.listRooms(resolvedRoom);
      const pd = core.palaceDir(resolvedRoom);

      output(`Palace rooms — ${resolvedRoom}\n`);
      for (const r of roomList) {
        const roomPath = path.join(pd, "rooms", r.slug);
        let entryCount = 0;
        if (fs.existsSync(roomPath)) {
          const files = fs.readdirSync(roomPath).filter(f => f.endsWith(".md") && f !== "README.md");
          entryCount = files.length;
        }
        output(`  ${r.name} (${entryCount} entries, salience ${r.salience.toFixed(2)})`);
        if (r.description) output(`    ${r.description}`);
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
