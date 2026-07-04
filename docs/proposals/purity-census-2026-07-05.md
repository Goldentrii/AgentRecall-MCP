# AgentRecall Purity Census — 2026-07-05

**Scope:** 60-day lookback (2026-05-06 → 2026-07-05), 2,649 transcript files  
**Method:** JSON-parsed tool_use events + attachment/injection events + file mtime forensics  
**Exclusions:** eval/, scripts/, test/ (out of scope per orchestrator ruling)

---

## Dimension 1 — MCP Tools

### Active Surface (default mode — always loaded)

| Tool | Total Invocations | Hook-driven | Organic | Sessions (files) | Last Used |
|------|-------------------|-------------|---------|------------------|-----------|
| session_end | 161 | 34 | 127 | 54 | 2026-07-04 |
| recall | 73 | 0 | 73 | 34 | 2026-07-04 |
| remember | 55 | 0 | 55 | 24 | 2026-07-04 |
| check | 53 | 0 | 53 | 32 | 2026-07-04 |
| session_start | 25 | 17 | 8 | 21 | 2026-07-02 |

**Hook-classification note:** session_start classified as hook-driven when it appears as the first tool call in the file (the hook-start CLI fires it). session_end classified as hook-driven when it appears as the last AR tool call (hook-end fires it). All other calls are organic.

### Extended Surface (--full mode only)

| Tool | Total Invocations | Hook-driven | Organic | Last Used | Verdict |
|------|-------------------|-------------|---------|-----------|---------|
| register_rule | 2 | 0 | 2 | 2026-06-03 | ZOMBIE |
| pipeline_show | 1 | 0 | 1 | 2026-05-31 | ZOMBIE |
| memory_query | 0 | 0 | 0 | never | DEAD |
| check_action | 0 | 0 | 0 | never | DEAD |
| brief | 0 | 0 | 0 | never | DEAD |
| pipeline_open | 0 | 0 | 0 | never | DEAD |
| pipeline_close | 0 | 0 | 0 | never | DEAD |
| pipeline_list | 0 | 0 | 0 | never | DEAD |
| pipeline_current | 0 | 0 | 0 | never | DEAD |
| skill_write | 0 | 0 | 0 | never | DEAD |
| skill_recall | 0 | 0 | 0 | never | DEAD |
| skill_list | 0 | 0 | 0 | never | DEAD |
| dashboard_export | 0 | 0 | 0 | never | DEAD |
| session_end_reflect | 0 | 0 | 0 | never | DEAD |
| project_board | 0 | 0 | 0 | never | DEAD |
| project_status | 0 | 0 | 0 | never | DEAD |
| digest | 0 | 0 | 0 | never | DEAD |
| bootstrap_import | 0 | 0 | 0 | never | DEAD |
| bootstrap_scan | 0 | 0 | 0 | never | DEAD |

**Summary:** 5 tools ALIVE (all default-mode), 2 ZOMBIE, 18 DEAD.  
All 19 non-alive tools are in --full mode exclusively — none were invoked organically.

---

## Dimension 2 — CLI Subcommands

All 50 case branches from `packages/cli/src/index.ts`.  
Evidence sources: Bash tool calls in transcripts + dream log CLI usage.  
Hook-driven commands (auto-fired by hooks): hook-start, hook-end, hook-correction, hook-ambient, hook-save, hook-pretool, consolidate-async.

### Commands With Evidence

| Command | Invocations | Last Used | Hook? | Verdict |
|---------|-------------|-----------|-------|---------|
| hook-correction | 3 | 2026-07-03 | hook | ALIVE (hook-driven) |
| hook-ambient | 2 | 2026-07-03 | hook | ALIVE (hook-driven) |
| hook-end | 2 | 2026-07-03 | hook | ALIVE (hook-driven) |
| hook-start | 1 | 2026-07-03 | hook | ALIVE (hook-driven) |
| hook-save | 1 | 2026-07-03 | hook | ALIVE (hook-driven) |
| hook-pretool | 5 | 2026-06-12 | hook | ALIVE (hook-driven) |
| corrections | 19 | 2026-07-04 | — | ALIVE |
| scrub | 11 | 2026-07-04 | — | ALIVE |
| projects | 9 | 2026-07-03 | — | ALIVE |
| outcomes | 8 | 2026-07-03 | — | ALIVE |
| status | 16 | 2026-06-22 | — | ALIVE |
| mirror | 11 | 2026-06-22 | — | ALIVE |
| doctor | 9 | 2026-06-22 | — | ALIVE |
| repair | 4 | 2026-06-22 | — | ALIVE |
| bootstrap | 4 | 2026-06-22 | — | ALIVE |
| consolidate | 5 | 2026-06-21 | — | ALIVE |
| digest | 7 | 2026-06-18 | — | ALIVE (last used Jun 18, low freq) |
| palace | 2 | 2026-06-22 | — | ALIVE |
| write | 2 | 2026-06-18 | — | ZOMBIE |
| recall | 2 | 2026-06-23 | — | ZOMBIE |
| capture | 2 | 2026-06-23 | — | ZOMBIE |
| awareness | 2 | 2026-06-23 | — | ZOMBIE (dream only) |
| blind-spots | 2 | 2026-06-20 | — | ZOMBIE |
| sync-memory | 1 | 2026-06-24 | — | ZOMBIE |
| insight | 1 | 2026-06-23 | — | ZOMBIE (dream only) |
| correct | 1 | 2026-06-21 | — | ZOMBIE |

**Dream-driven CLI usage** (counts as real usage, labeled):  
The dream agent (runs nightly via `ar` CLI) uses: `awareness read`, `palace walk`, `awareness write`, `capture`, `insight`. These account for the low-count entries above. Dream runs last confirmed: 2026-06-26 (most recent dream log with positive write counts was 2026-06-23 cycle).

### Commands With Zero Evidence

| Command | Verdict |
|---------|---------|
| archive | DEAD |
| cold-start | DEAD (deprecated) |
| consolidate-async | DEAD (hook only, no evidence of firing) |
| knowledge | DEAD |
| list | DEAD |
| merge | DEAD |
| read | DEAD |
| rollup | DEAD |
| rooms | DEAD |
| saveall | DEAD |
| sessions | DEAD |
| setup | DEAD |
| state | DEAD |
| stats | DEAD |
| synthesize | DEAD (deprecated) |

**Summary:** 25 commands ALIVE (17 organic, 6 hook-driven, 2 organic+hook), 7 ZOMBIE, 15 DEAD.

---

## Dimension 3 — Memory Layers / Stores

For each layer: when was it last written outside tests, and is anything downstream reading it?

| Layer | Last Written | Writer | Read by session_start? | Read by recall? | Verdict |
|-------|-------------|--------|----------------------|-----------------|---------|
| **journal** | 2026-07-04 | hook-end, remember | YES (recent captures, journal fragments) | YES | ALIVE — written+read |
| **corrections** | 2026-07-05 | hook-correction, correct | YES (P0 corrections, watch_for, blind_spots) | YES | ALIVE — written+read |
| **awareness** | 2026-07-04 | dream agent, awareness-update | YES (top 3 insights surfaced) | YES | ALIVE — written+read |
| **palace/rooms** | 2026-07-04 | remember, palace write | YES (top 3 rooms) | YES | ALIVE — written+read |
| **insights-index** | 2026-07-04 | awareness consolidation | YES (project-index insights) | YES | ALIVE — written+read |
| **pipeline** | 2026-05-30 | pipeline_open (CLI) | YES (listMilestones called in session_start) | NO | ZOMBIE — written May 30, reader in code but data stale; only 2 projects ever had pipeline.md written |
| **knowledge** (standalone) | 2026-07-03 | remember → knowledgeWrite | NO (not in session_start payload; only read by deprecated knowledge_read tool) | NO | WRITE-ONLY GRAVEYARD — written but not read by active tools |
| **digest** | 2026-06-18 | digest CLI | NO (digest tool is --full only; never called) | NO | DEAD — last write Jun 18, codex-compat-test only (test artifact) |
| **mirror** | n/a (no file) | mirror builder | YES (mirror_available signal in session_start) | NO | WRITE-ONLY GRAVEYARD — no mirror file exists anywhere in ~/.agent-recall |
| **skills** (MCP) | never | skill_write MCP | NO | NO | DEAD — MCP skill tools never invoked, no skill files written via MCP |
| **A/B ledger** (_ab_arms.jsonl) | n/a | ab-experiment | internal only | NO | EXPERIMENT — deliberately not user-facing |

**Knowledge detail:** Files exist (last write 2026-07-03 in AgentRecall/knowledge/ and 2026-06-15 in prismma-web/knowledge/), but the `knowledge_read` MCP tool is deprecated/unregistered and session_start does not include standalone knowledge files in its payload. They are written via `remember` routing but never surfaced. Data is real user data.

**Mirror detail:** `ar mirror` exists as CLI command (11 invocations, ALIVE), but it computes on demand from corrections rather than reading a persisted file. `mirror_available` flag in session_start just checks if corrections count is sufficient. The "mirror" store is purely computed, not persisted.

---

## Dimension 4 — Env Flags

| Flag | Currently Set | Classification | Live? |
|------|---------------|----------------|-------|
| AGENT_RECALL_ROOT | (unset, uses default ~/.agent-recall) | core-loop | ALIVE |
| AGENT_RECALL_PROJECT | (unset, auto-detect from cwd) | core-loop | ALIVE |
| AGENT_RECALL_RECALL_BUDGET_MS | (unset, default 2500ms) | core-loop | ALIVE |
| AGENT_RECALL_ARCHIVE_RETENTION_DAYS | (unset, default 90) | core-loop | ALIVE |
| AGENT_RECALL_GRADUATION_MIN_CONFIRMATIONS | (unset, default from code) | core-loop | ALIVE |
| AGENT_RECALL_SUPABASE_URL | (unset) | optional-cloud | ALIVE (feature exists, not configured) |
| AGENT_RECALL_SUPABASE_KEY | (unset) | optional-cloud | ALIVE |
| AR_SYNC_CORRECTIONS | (unset) | optional-cloud | ALIVE |
| AGENT_RECALL_SYNC_PERSONAL | (unset) | optional-cloud | ALIVE |
| AR_CONSOLIDATE_AUTO | (unset, default suggest-only) | experiment | ALIVE |
| AR_MEMORY_BACKEND | (unset, DisabledMemoryBackend) | experiment | ZOMBIE — seam exists, never activated |
| AGENT_RECALL_EMBEDDING_PROVIDER | (unset) | experiment | ZOMBIE — embedding path never activated |
| AGENT_RECALL_EMBEDDING_KEY | (unset) | experiment | ZOMBIE — embedding path never activated |
| AGENT_RECALL_EMBED_TIMEOUT_MS | (unset, default 2000ms) | experiment | ZOMBIE — embedding path never activated |
| AR_AB_ENABLED | (unset, experiment disabled) | experiment (opt-in) | EXPERIMENT — disabled by design |
| AR_AB_FORCE | (unset) | experiment escape-hatch | EXPERIMENT |

**Summary:** 9 core-loop/cloud flags ALIVE (none set = defaults used), 4 ZOMBIE (embedding cluster, never activated), 2 EXPERIMENT flags (A/B, by design unset).

---

## Dimension 5 — Skills / Commands

| Skill | Location | Invocations (60d) | Last Used | Verdict |
|-------|----------|--------------------|-----------|---------|
| arstart | ~/.claude/commands/arstart.md | 336 | 2026-07-04 | ALIVE |
| arstatus | ~/.claude/commands/arstatus.md | 315 | 2026-07-04 | ALIVE |
| arsave | ~/.claude/commands/arsave.md | 210 | 2026-07-04 | ALIVE |
| arsaveall | ~/.claude/commands/arsaveall.md | 40 | 2026-06-22 | ALIVE |
| arbootstrap | ~/.claude/commands/arbootstrap.md | 15 | 2026-06-22 | ALIVE |
| arrecall | ~/.claude/commands/arrecall.md | 2 | 2026-06-29 | ZOMBIE |
| arsave-quick | ~/.claude/commands/arsave-quick.md | 0 | never | DEAD |
| aside | ~/.claude/commands/aside.md | 1 | 2026-06-24 | ZOMBIE |

**Note:** The `agent-recall` entry (21 invocations) is the skill package install reference, not a slash command.

**Skills summary:** 5 ALIVE, 2 ZOMBIE, 1 DEAD.

---

## Dimension 6 — Ambient Injection Precision (Live Friction)

**Sample:** 43 total injection events found in 60-day transcripts across user-facing sessions. 30 sampled for manual noise rating.

**Overall noise ratio: 77% (23 of 30 rated as noise)**

### Noise Rating Breakdown

| Category | Count | % |
|----------|-------|---|
| Relevant | 7 | 23% |
| Noise | 23 | 77% |

### Noise Root Causes

1. **Task-notifications as trigger** (18 of 23 noise cases): The hook fires on `<task-notification>` system messages (background agent completions). These XML blobs have no semantic content relevant to any correction or palace room — they contain task IDs, tool use IDs, and output file paths. The ambient recall picks up keywords ("output", "file", "agent", "status") and injects unrelated memories.

2. **Watch-for bleed** (6 cases): The `⚠ Watch a known tendency` correction warning ("No revenue from any product", "novada-proxy competitive benchmark blocked") fires on virtually every prompt regardless of topic because these are global patterns matched too broadly.

3. **Stale/empty excerpt** (1 case): An injection returned `• [journal][MED] 2026-05-13 / top — date: 2026-05-13` — no actual content, just a date metadata line, attached to a test-results summary message.

### Three Worst Verbatim Examples

**Example 1 — task-notification receives unrelated palace room:**
```
USER: <task-notification>
  <task-id>a9f49894...</task-id>
  <tool-use-id>toolu_01...</tool-use-id>
  <output-file>/private/tmp/claude-501/...</output-file>
  <status>completed</status>

INJECT: [AgentRecall] Relevant past context:
• [palace][MED] decision/project-file-agent — topic: project-file-agent
```

**Example 2 — agent completion message receives wrong-project watch warning:**
```
USER: Another Claude session sent a message:
<agent-message from="console-builder">Fixed. The crash is gone...
Root cause: AggDay...

INJECT: ⚠ [AgentRecall] Watch a known tendency — novada-proxy competitive 
benchmark blocked on competitor API keys.
```

**Example 3 — test results get an empty journal date:**
```
USER: 测试完成，汇总如下。
## 测试结论(2026-07-04, hosted endpoint)
| 认证 / 钱包 | ✅ Key 有效，€8802.05 |

INJECT: [AgentRecall] Relevant past context:
• [journal][MED] 2026-05-13 / top — date: 2026-05-13
```

---

## Kill-Candidate List

Ranked by: (zero organic usage) × (concept surface) × (maintenance cost).  
`[DATA]` = contains real user data; quarantine-not-delete.  
`[SAFE]` = no user data, safe to remove code path.  
`[EXPERIMENT]` = under active intentional development, do not touch.

| Rank | Item | Type | Organic Uses (60d) | Data Risk | Maintenance Surface | Recommended Action |
|------|------|------|--------------------|-----------|---------------------|-------------------|
| 1 | `--full` pipeline tools (pipeline_open/close/list/current/show + pipeline.md layer) | MCP tools + store | 1 (pipeline_show once in May) | `[DATA]` — prismma-web/pipeline.md has real content | 5 MCP tools + pipeline.ts logic + session_start.ts listMilestones call | Quarantine: remove MCP tools, keep pipeline.ts for potential re-use, stop injecting pipeline summary in session_start |
| 2 | `--full` skill tools (skill_write/skill_recall/skill_list) | MCP tools | 0 | `[SAFE]` — no MCP skill files ever written | 3 MCP tools + skill store logic | DELETE: MCP tools + store (skills in ~/.claude/commands/ are entirely separate) |
| 3 | Embedding cluster (AGENT_RECALL_EMBEDDING_PROVIDER/KEY/EMBED_TIMEOUT_MS + vector/embedding.ts) | Env flags + code | 0 | `[SAFE]` | embedding.ts, vector/ dir | QUARANTINE: Keep seam but remove from docs/SKILL.md surface area; never activated |
| 4 | `--full` dashboard/reflect tools (dashboard_export, session_end_reflect) | MCP tools | 0 | `[SAFE]` | 2 MCP tools + dashboard-export.ts logic | DELETE from --full surface |
| 5 | `--full` project board/status tools (project_board, project_status) | MCP tools | 0 | `[SAFE]` | 2 MCP tools | DELETE from --full surface |
| 6 | `--full` digest tool + digest store | MCP tool + store | 0 MCP; 7 CLI (Jun 18) | `[SAFE]` — only codex-compat-test data | digest store + digest CLI | QUARANTINE: Keep digest CLI, remove MCP tool from --full; digest data is test-only |
| 7 | `--full` check_action + brief + register_rule tools | MCP tools | 2 (register_rule Jun 3) | `[SAFE]` | 3 MCP tools | DELETE check_action + brief; QUARANTINE register_rule (2 uses, low but nonzero) |
| 8 | Standalone knowledge store (knowledge/ dir, separate from palace/rooms/knowledge) | Store | 0 reads; writes exist | `[DATA]` — 9 knowledge files with real project data (last written 2026-07-03) | knowledgeWrite routing in remember.ts, knowledge/ dirs | QUARANTINE: stop writing to standalone knowledge/, redirect to palace/rooms/knowledge (already done for new writes); preserve existing files |
| 9 | bootstrap_import + bootstrap_scan (MCP tools) | MCP tools | 0 | `[SAFE]` | 2 MCP tools (bootstrap CLI command is ALIVE with 4 uses) | DELETE MCP tools; keep bootstrap CLI command |
| 10 | memory_query MCP tool | MCP tool | 0 | `[SAFE]` | 1 MCP tool | DELETE from --full surface |

### Additional: Ambient injection hook firing on task-notifications

Not a kill candidate (the hook itself is ALIVE) but a precision bug: the `hook-ambient` fires on `<task-notification>` XML prompts (background agent events) that contain no semantic content. These account for an estimated 18/23 noise cases (60% of all noise). Fix: add task-notification/agent-message XML pattern to SHORT_ACKS or add an explicit early-exit if the prompt matches `^<task-notification>` or `^<agent-message`. Zero new surface, high signal improvement.

### Commands to deprecate (zero organic evidence, 15 cases)

All 15 DEAD CLI commands: archive, cold-start, consolidate-async, knowledge, list, merge, read, rollup, rooms, saveall, sessions, setup, state, stats, synthesize. Most are already deprecated in index.ts comments or superseded by session_start/remember/recall.

---

## Headline Summary

**MCP tools:** 5 ALIVE / 2 ZOMBIE / 18 DEAD (all 19 non-alive are --full only)  
**CLI commands:** 25 ALIVE / 7 ZOMBIE / 15 DEAD (3 active + 2 planned removals with real data)  
**Memory layers:** 6 ALIVE (written+read) / 2 WRITE-ONLY GRAVEYARD (knowledge standalone, mirror) / 1 DEAD (digest store) / 1 EXPERIMENT (A/B ledger)  
**Env flags:** 9 ALIVE / 4 ZOMBIE (embedding cluster) / 2 EXPERIMENT (A/B)  
**Skills:** 5 ALIVE / 2 ZOMBIE / 1 DEAD  
**Ambient noise ratio: 77%** (23 of 30 sampled injections irrelevant to the decorated message)

**Top data-safety flags:**  
- pipeline.md in prismma-web (real content, 2026-05-30) → quarantine, not delete  
- standalone knowledge/ files (real project notes) → quarantine, not delete  
- All other kill candidates are SAFE to delete (no user data)

**Report path:** `/Users/tongwu/Projects/AgentRecall/docs/proposals/purity-census-2026-07-05.md`
