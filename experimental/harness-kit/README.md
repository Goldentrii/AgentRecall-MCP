# Recurrence & Reflection Harness Kit

> ## ⚠️ EXPERIMENTAL
>
> This kit is **validated on exactly one power-user harness** (2026-07-14: 8 error
> classes, 18 confirmed phantom gradient steps found in 109 corrections). It is not
> wired into the AgentRecall npm packages, has no test suite of its own beyond the
> defensive coding in the scripts, and its conventions may change without a
> deprecation path. Paths assume the default `~/.agent-recall`; both Python scripts
> and the nudge hook honor an `AR_ROOT` env override. Read the whole file before
> installing.

The self-improvement loop we run on AgentRecall itself, packaged as copyable files.
It closes the gap that plain correction capture leaves open: corrections accumulate,
but nothing tells you when the *same class* of mistake keeps happening after you
already encoded a rule against it.

## The loop

```
scoreboard digest            SessionStart hook injects a ≤8-line health digest
      │                      (corrections/7d, insight promotion, REFLECT-DUE countdown)
      ▼
correction capture           normal AgentRecall flow — check() / session_end record
      │                      corrections as you work
      ▼
taxonomy scan                ar-recurrence-check.py --scan classifies new corrections
      │                      into error classes; flags PHANTOMS (violation dated
      │                      strictly AFTER the covering rule was encoded)
      ▼
periodic /arreflect triage   every K sessions (default 10; ar-nudge.py makes an
      │                      overdue reflection impossible to miss mid-session):
      │                      confirm provisional members, cluster unclassified,
      ▼                      draft re-abstractions for phantom-heavy classes
owner-gated re-abstraction   the agent PROPOSES a broader rule; only the owner
      │                      applies edits to CLAUDE.md / rules/ — never autonomous
      ▼
M4 metric                    post-re-abstraction phantom rate must converge to 0.
                             A re-abstracted class that still produces new phantoms
                             means the abstraction is still too narrow — escalate.
```

A **phantom gradient step** is a correction dated strictly after its class's
`rule_date`: the rule existed, the violation happened anyway — the encoded gradient
step didn't take. Phantoms are the loop's target variable.

## Contents

| Path | What | Installs to |
|---|---|---|
| `commands/arstart.md` | Session opener: status board / project loader / bootstrap | `~/.claude/commands/` |
| `commands/arsave.md` | Session save: journal + palace + insights, or batch `all` mode | `~/.claude/commands/` |
| `commands/arrecall.md` | Mid-session targeted recall (explicit query or contextual scan) | `~/.claude/commands/` |
| `commands/arreflect.md` | The reflection SOP: triage, cluster, re-abstract (owner-gated) | `~/.claude/commands/` |
| `scripts/ar-scoreboard.py` | Health snapshots + the SessionStart digest; increments the reflection counter | `~/.claude/scripts/` |
| `scripts/ar-recurrence-check.py` | Taxonomy scanner (`--scan` / `--report` / `--mark-reflected`) | `~/.claude/scripts/` |
| `hooks/ar-nudge.py` | UserPromptSubmit hook: nudges when reflection is overdue (6 h anti-nag guard) | `~/.claude/hooks/` |
| `hooks/dispatch-model-guard.py` | PreToolUse(Agent) hook: warns when a subagent dispatch has no explicit `model` | `~/.claude/hooks/` |
| `TAXONOMY-SCHEMA.md` | Full schema for `taxonomy.json` + `reflection-state.json`, with a synthetic example | (reference doc) |

## Requirements

- **Claude Code** — the commands are Claude Code slash commands; the hooks use the
  Claude Code hooks protocol (`SessionStart` / `UserPromptSubmit` / `PreToolUse`).
- **AgentRecall MCP server** (`npx -y agent-recall-mcp`) — the commands call
  `session_start` / `session_end` / `recall` / `check`; the scripts read the
  `~/.agent-recall` store it maintains. The batch-save path also uses the `ar` CLI
  (`npm i -g agent-recall-cli`, or `npx agent-recall-cli`).
- **python3** — standard library only. No pip installs.

## Install

1. **Copy the files:**

   ```bash
   KIT=path/to/experimental/harness-kit
   mkdir -p ~/.claude/commands ~/.claude/scripts ~/.claude/hooks
   cp "$KIT"/commands/*.md  ~/.claude/commands/
   cp "$KIT"/scripts/*.py   ~/.claude/scripts/
   cp "$KIT"/hooks/*.py     ~/.claude/hooks/
   ```

2. **Seed the taxonomy** (the scanner exits 1 without it; the scoreboard shows
   `taxonomy not seeded`):

   ```bash
   cat > ~/.agent-recall/taxonomy.json << 'EOF'
   {
     "version": 1,
     "updated": "2026-07-14",
     "classes": [],
     "unclassified": []
   }
   EOF
   ```

   Classes are never auto-created — run `python3 ~/.claude/scripts/ar-recurrence-check.py --scan`
   once to populate `unclassified`, then let your first `/arreflect` propose classes
   from the clusters. Schema reference: [`TAXONOMY-SCHEMA.md`](TAXONOMY-SCHEMA.md).
   `reflection-state.json` self-initializes on the first scoreboard run.

3. **Wire the hooks** — merge into `~/.claude/settings.json` (`hooks` key):

   ```json
   {
     "hooks": {
       "SessionStart": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "python3 $HOME/.claude/scripts/ar-scoreboard.py --digest 2>/dev/null || true"
             }
           ]
         }
       ],
       "UserPromptSubmit": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "python3 $HOME/.claude/hooks/ar-nudge.py 2>/dev/null || true"
             }
           ]
         }
       ],
       "PreToolUse": [
         {
           "matcher": "Agent",
           "hooks": [
             {
               "type": "command",
               "command": "python3 $HOME/.claude/hooks/dispatch-model-guard.py 2>/dev/null || true"
             }
           ]
         }
       ]
     }
   }
   ```

   All three commands end in `|| true` deliberately — a broken hook must never block
   a session. The scripts also exit 0 on every internal failure path.

4. **Smoke-test:**

   ```bash
   python3 ~/.claude/scripts/ar-scoreboard.py --digest      # prints the digest
   python3 ~/.claude/scripts/ar-recurrence-check.py --report # prints the taxonomy report
   ```

   Then open a new Claude Code session — the digest should appear at session start.

## Substitutions made while packaging (vs. the source harness)

These files are copied from a live harness; the following were genericized. Logic is
otherwise verbatim.

| File | Change |
|---|---|
| `commands/arsave.md` | Dev-checkout CLI path `node ~/Projects/AgentRecall/packages/cli/dist/index.js …` → installed-package equivalent `ar saveall` / `ar sessions` / `ar saveall --dry-run` (fallback: `npx agent-recall-cli saveall`). |
| `commands/arrecall.md` | Cross-project recall slug `"tongwu"` (the source harness owner's personal/home project) → `"<your-username>"` placeholder. Use the slug of your own catch-all personal project. |
| `commands/arstart.md` | Same username → `<your-username>` placeholder in the fallback scan's skip-list. |

## Known caveats

- **`commands/arstart.md` board mode references `~/.claude/scripts/ar-sync-status.py`,
  which is NOT part of this kit** (it belongs to the source harness's status-board
  machinery). The command has a documented fallback: a manual scan of
  `~/.agent-recall/projects/` that needs no extra script. Board mode degrades to the
  fallback; PROJECT LOAD, BOOTSTRAP, and every other command work without it.
- **Command examples retain the source harness's project slugs** (e.g. `novada-site`,
  `prismma-gateway`, `agentrecall` in illustrative snippets). They are examples inside
  verbatim-preserved command logic — substitute your own project names when reading.
- **`hooks/dispatch-model-guard.py` encodes an owner policy**, not an AgentRecall
  requirement: "every subagent dispatch carries an explicit `model`". It is warn-only
  (never blocks, always exits 0) and independent of the memory loop — skip it if you
  don't run a multi-model orchestration policy.
- **`/arreflect` never edits your rules autonomously.** Step 4 drafts re-abstractions
  and presents them; applying an edit to CLAUDE.md or `rules/` is owner-gated by
  design. Keep it that way.
- **The reflection counter increments via the SessionStart digest** (30-minute dedup),
  so "K sessions" ≈ K session starts more than 30 minutes apart, not K distinct
  workdays.
