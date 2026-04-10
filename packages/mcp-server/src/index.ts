#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION, getRoot, getLegacyRoot } from "agent-recall-core";
import { server } from "./server.js";

// Import all tool registrations
import { register as registerJournalRead } from "./tools/journal-read.js";
import { register as registerJournalWrite } from "./tools/journal-write.js";
import { register as registerJournalCapture } from "./tools/journal-capture.js";
import { register as registerJournalList } from "./tools/journal-list.js";
import { register as registerJournalProjects } from "./tools/journal-projects.js";
import { register as registerJournalSearch } from "./tools/journal-search.js";
import { register as registerJournalState } from "./tools/journal-state.js";
import { register as registerJournalColdStart } from "./tools/journal-cold-start.js";
import { register as registerJournalArchive } from "./tools/journal-archive.js";
import { register as registerJournalRollup } from "./tools/journal-rollup.js";
import { register as registerAlignmentCheck } from "./tools/alignment-check.js";
import { register as registerNudge } from "./tools/nudge.js";
import { register as registerContextSynthesize } from "./tools/context-synthesize.js";
import { register as registerKnowledgeWrite } from "./tools/knowledge-write.js";
import { register as registerKnowledgeRead } from "./tools/knowledge-read.js";
import { register as registerPalaceRead } from "./tools/palace-read.js";
import { register as registerPalaceWrite } from "./tools/palace-write.js";
import { register as registerPalaceWalk } from "./tools/palace-walk.js";
import { register as registerPalaceLint } from "./tools/palace-lint.js";
import { register as registerPalaceSearch } from "./tools/palace-search.js";
import { register as registerAwarenessUpdate } from "./tools/awareness-update.js";
import { register as registerRecallInsight } from "./tools/recall-insight.js";
import { register as registerJournalResources } from "./resources/journal-resources.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(
    `agent-recall-mcp v${VERSION}

Two-layer AI session memory — read, write, and navigate project journals via MCP.

Usage:
  npx agent-recall-mcp            Start the MCP server (stdio transport)
  npx agent-recall-mcp --help     Show this help
  npx agent-recall-mcp --list-tools  List available MCP tools

Storage: ${getRoot()}
Legacy:  ${getLegacyRoot()}

All data stays local. No cloud, no telemetry.
`
  );
  process.exit(0);
}

if (args.includes("--list-tools")) {
  const tools = [
    { name: "journal_read", description: "Read a journal entry (supports date=latest, section filtering)" },
    { name: "journal_write", description: "Append or replace content in journal" },
    { name: "journal_capture", description: "Lightweight Layer 1 Q&A capture" },
    { name: "journal_list", description: "List recent journal entries" },
    { name: "journal_projects", description: "List all tracked projects" },
    { name: "journal_search", description: "Full-text search across journals" },
    { name: "alignment_check", description: "Record confidence + understanding + human corrections" },
    { name: "nudge", description: "Surface contradiction between current and past input" },
    { name: "context_synthesize", description: "L3 synthesis: patterns, contradictions, goal evolution" },
    { name: "journal_state", description: "Layer 1 JSON state: read/write structured session data (v3)" },
    { name: "journal_cold_start", description: "Cache-aware cold start: hot/warm/cold entries (v3)" },
    { name: "journal_archive", description: "Archive old entries to cold storage (v3)" },
    { name: "journal_rollup", description: "Condense old daily journals into weekly summaries (v3.4)" },
    { name: "knowledge_write", description: "Write a structured lesson to a category-specific knowledge file" },
    { name: "knowledge_read", description: "Read lessons from knowledge files, optionally filtered by project/category/query" },
    { name: "palace_read", description: "Read a room or list all rooms in the Memory Palace" },
    { name: "palace_write", description: "Write memory to a palace room with fan-out cross-referencing" },
    { name: "palace_walk", description: "Progressive context loading: identity → active → relevant → full" },
    { name: "palace_lint", description: "Health check: stale, orphans, low salience, missing refs" },
    { name: "palace_search", description: "Search across palace rooms, ranked by salience" },
    { name: "awareness_update", description: "Update awareness with new insights (call at session end)" },
    { name: "recall_insight", description: "Recall cross-project insights relevant to current task" },
  ];
  process.stdout.write(JSON.stringify(tools, null, 2) + "\n");
  process.exit(0);
}

registerJournalRead(server);
registerJournalWrite(server);
registerJournalCapture(server);
registerJournalList(server);
registerJournalProjects(server);
registerJournalSearch(server);
registerJournalState(server);
registerJournalColdStart(server);
registerJournalArchive(server);
registerJournalRollup(server);
registerAlignmentCheck(server);
registerNudge(server);
registerContextSynthesize(server);
registerKnowledgeWrite(server);
registerKnowledgeRead(server);
registerPalaceRead(server);
registerPalaceWrite(server);
registerPalaceWalk(server);
registerPalaceLint(server);
registerPalaceSearch(server);
registerAwarenessUpdate(server);
registerRecallInsight(server);
registerJournalResources(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
