#!/usr/bin/env node

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

META:
  ar projects
  ar synthesize [--entries N]
  ar knowledge write --category <cat> --title "t" --what "w" --cause "c" --fix "f"
  ar knowledge read [--category <cat>]

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
