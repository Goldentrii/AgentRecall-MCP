# Supabase-AutoMemory-AgentRecall Chain Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Codex-Claude loop:** Codex implements, Claude orchestrates and reviews. Never use Sonnet subagents as implementers. Never use Codex as a reviewer.

**Goal:** Build the Supabase ↔ Claude AutoMemory ↔ AgentRecall chain into a fully functioning memory system — so Supabase is not a passive backup but an active working memory that Claude proactively queries before making decisions.

**Architecture:**
```
Claude AutoMemory (local ~/.claude/projects/.../memory/)
    ↓ auto-sync (PostToolUse → sync-memory.py)
Supabase memories table (FTS + pgvector after T4-T5)
    ↑ proactive recall (session_start hook → supabase-session-start.py after T2)
Claude's decision loop (surfaces relevant past feedback/decisions automatically)

AgentRecall (journal + palace + awareness)
    ↓ session_end → journal_entries table (backfilled by T1)
    ↓ semantic recall (feat/supabase-semantic-recall merged by T3)
```

**Three weak points being fixed:**
1. Journal entries: 20 rows vs 31+ files (T1)
2. Supabase not in Claude's decision loop — memories table never proactively queried (T2)
3. No pgvector on memories table — no semantic search on personal memory (T3 + T4 + T5)

**Tech Stack:** Node.js 22, TypeScript 5, Python 3, Supabase (PostgreSQL + pgvector), agent-recall-mcp

**Codex briefs location:** `~/Projects/AgentRecall/docs/agents/supabase-chain/`

---

## File Map

| File | Action | Purpose |
|------|---------|---------|
| Supabase: journal_entries | Backfill | 11 missing journal entries synced |
| `~/.claude/scripts/supabase-session-start.py` | Modify | Add memories FTS query → surface relevant context at session start |
| `packages/core/` (full branch) | Merge | feat/supabase-semantic-recall → main (careful conflict resolution) |
| `packages/core/package.json` | Bump | v3.4.3 |
| `packages/mcp-server/package.json` | Bump | v3.4.3 |
| Supabase: memories.embedding | Migration | Add vector(1536) column + ivfflat index |
| Supabase: match_memories() | RPC | pgvector similarity search RPC function |
| `~/.claude/scripts/sync-memory.py` | Modify | Generate + store embeddings when syncing memories |

---

## Phase 1 — Quick Wins (T1 + T2)

### Task 1: Journal Backfill

**What:** Run `ar setup supabase --backfill` to sync 11 missing journal entries from local files to Supabase `journal_entries` table.

**Files:**
- No code changes — this is a CLI execution
- Verifies: `journal_entries` row count ≥ 31

**Codex brief:** `docs/agents/supabase-chain/T1-journal-backfill.md`

- [ ] **Step 1: Check current journal_entries count**
```bash
# Codex runs this to establish baseline
node /Users/tongwu/Projects/AgentRecall/packages/cli/dist/index.js setup supabase --status 2>/dev/null || true
```

- [ ] **Step 2: Run backfill**
```bash
/Users/tongwu/.npm-global/bin/ar setup supabase --backfill
```

- [ ] **Step 3: Verify count increased**
```bash
# Query Supabase via CLI or REST API
curl -s "https://fjdtuyflvgylrllujpnc.supabase.co/rest/v1/journal_entries?select=count" \
  -H "apikey: sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr" \
  -H "Prefer: count=exact" | python3 -c "import sys; print(sys.stdin.read())"
```

Expected: count ≥ 31

---

### Task 2: Wire Memories FTS Into Session Start Hook

**What:** Modify `~/.claude/scripts/supabase-session-start.py` to also query the `memories` table using FTS, surfacing the top 5 relevant memories (feedback + project type preferred) based on active project slugs. Emit as `<memory-context>` block.

**Files:**
- Modify: `~/.claude/scripts/supabase-session-start.py`

**Codex brief:** `docs/agents/supabase-chain/T2-memories-hook.md`

**Behavior spec:**
1. After querying `projects` table (already done), extract active project slugs
2. Build FTS query from those slugs: `plainto_tsquery('english', 'agentrecall novada memory ...')`
3. Query memories: `SELECT slug, name, type, body FROM memories WHERE to_tsvector(...) @@ ... ORDER BY updated_at DESC LIMIT 8`
4. Fallback: if FTS returns 0 results, get the 5 most-recently-updated memories (type IN ('feedback', 'project'))
5. Emit after the projects block:
```xml
<memory-context>
## Relevant Memory — {date}

### {type}: {name}
{body — first 300 chars}

...
</memory-context>
```
6. Total added output: ≤ 800 tokens. If memories are long, truncate body at 300 chars.
7. Timeout: 3 seconds (separate from projects query timeout). Silent failure: skip block, don't crash.

- [ ] **Step 1: Write failing test** (`test_memories_hook.py` using mock HTTP)
- [ ] **Step 2: Implement `query_relevant_memories()` function**
- [ ] **Step 3: Wire into `main()` after projects section**
- [ ] **Step 4: Test with real Supabase** (run script, verify output has `<memory-context>`)
- [ ] **Step 5: Verify no regression on existing projects output**

---

## Phase 2 — Semantic Recall Merge + Publish (T3)

### Task 3: Merge feat/supabase-semantic-recall Into main (v3.4.3)

**What:** The `feat/supabase-semantic-recall` branch adds pgvector-based recall to AgentRecall itself (when querying AR's palace/awareness). It must be merged into main carefully — the branch predates the memory pipeline fixes (v3.4.1) so there are known conflicts.

**Known conflicts to resolve:**
| File | Branch removes | Main has | Resolution |
|------|---------------|----------|------------|
| `packages/core/src/supabase/sync.ts` | `logSyncError()` | logSyncError + atomic cap | KEEP main's version (logSyncError stays) |
| `packages/core/src/tools-logic/insight-promotion.ts` | Present on branch (older ver) | Updated version (threshold NaN fix) | KEEP main's version |
| `packages/core/src/helpers/journal-sig-theme.ts` | Not on branch | Added in main | KEEP main's version |
| `packages/core/src/storage/session.ts` | Older sig/theme naming | New {sig}--{theme} format | KEEP main's format |
| README files | Restructured | Less restructured | KEEP branch's version (more complete) |

**Merge strategy:** `git merge --no-ff feat/supabase-semantic-recall` then resolve conflicts keeping main's pipeline fixes and branch's semantic recall features.

**Files:**
- Merge: all files in `packages/core/src/supabase/` (branch adds: client.ts, config.ts, backends/)
- Merge: `packages/core/src/tools-logic/` (keep main's insight-promotion.ts version)
- Merge: `packages/core/src/helpers/` (keep main's journal-sig-theme.ts, journal-name-parser.ts)
- Bump: `packages/core/package.json`, `packages/mcp-server/package.json` → v3.4.3

**Codex brief:** `docs/agents/supabase-chain/T3-merge-semantic-recall.md`

**Success criteria:**
- `npm test` passes in `packages/core/`
- `npm run build` passes in all packages
- `packages/core/src/supabase/backends/` directory exists (semantic recall feature)
- `packages/core/src/tools-logic/insight-promotion.ts` has threshold NaN guard
- `packages/core/src/helpers/journal-sig-theme.ts` exports `autoClassifySig` and `autoClassifyTheme`

- [ ] **Step 1: Switch to main, verify clean state**
```bash
cd ~/Projects/AgentRecall && git checkout main && git status
```
- [ ] **Step 2: Attempt merge**
```bash
git merge --no-ff feat/supabase-semantic-recall
```
- [ ] **Step 3: Resolve each conflict** (per conflict table above)
- [ ] **Step 4: Run tests**
```bash
cd packages/core && npm test
```
- [ ] **Step 5: Bump versions to 3.4.3**
```bash
# In packages/core/package.json and packages/mcp-server/package.json
# Change "version": "3.4.2" → "3.4.3"
```
- [ ] **Step 6: Build all packages**
```bash
npm run build --workspaces
```
- [ ] **Step 7: Commit merge + version bump**
```bash
git add -A && git commit -m "feat: merge semantic recall (pgvector + RRF) — v3.4.3"
```
- [ ] **Step 8: Report to Claude for review** (DO NOT publish — Claude approves first)

---

## Phase 3 — Semantic Search on Claude AutoMemory (T4 + T5)

### Task 4: Add pgvector to Memories Table

**What:** Add a `vector(1536)` column to the existing `memories` table in Supabase, create an ivfflat index, and add a `match_memories()` RPC function for semantic search.

**Files:**
- Supabase migration (SQL) — apply via `mcp__claude_ai_Supabase__apply_migration`
- No code changes to local scripts yet (that's T5)

**Codex brief:** `docs/agents/supabase-chain/T4-pgvector-migration.md`

**Migration SQL:**
```sql
-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to memories table
ALTER TABLE memories ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create ivfflat index (for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);

-- RPC function for semantic search on memories
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  type text,
  body text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.slug,
    m.name,
    m.type,
    m.body,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

- [ ] **Step 1: Apply migration** (via Supabase MCP tool `apply_migration`)
- [ ] **Step 2: Verify column added** (`SELECT column_name FROM information_schema.columns WHERE table_name='memories'`)
- [ ] **Step 3: Verify RPC function exists** (`SELECT routine_name FROM information_schema.routines WHERE routine_name='match_memories'`)
- [ ] **Step 4: Report success to Claude**

---

### Task 5: Wire Embeddings Into sync-memory.py

**What:** Update `~/.claude/scripts/sync-memory.py` to generate embeddings using the OpenAI API and store them in the `embedding` column when upserting memories to Supabase.

**Files:**
- Modify: `~/.claude/scripts/sync-memory.py`

**Codex brief:** `docs/agents/supabase-chain/T5-embeddings-sync.md`

**Behavior spec:**
1. Check if `OPENAI_API_KEY` env var is set. If not: skip embedding generation, sync without embedding (graceful degradation).
2. For each memory being synced, generate embedding using `text-embedding-3-small` (1536 dims, cheap).
3. Input text for embedding: `f"{name}\n{description or ''}\n{body or ''}"` truncated to 8000 chars.
4. Store embedding in `memories.embedding` column.
5. Cache embeddings: if `embedding` column is already populated AND `body` hasn't changed (use existing hash from `hash` column), skip re-embedding.
6. Batch embeddings: process up to 10 memories per API call (OpenAI batch endpoint).
7. Timeout: 10 seconds per batch. Silent failure: log to stderr, sync without embedding.

**OpenAI API call:**
```python
import urllib.request, json

def get_embedding(texts: list[str], api_key: str) -> list[list[float]]:
    payload = json.dumps({"input": texts, "model": "text-embedding-3-small"}).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    return [item["embedding"] for item in data["data"]]
```

Note: `sync-memory.py` already uses `urllib.request` (no new imports needed).

- [ ] **Step 1: Add `get_embedding()` function**
- [ ] **Step 2: Add embedding generation to upsert flow (with OPENAI_API_KEY check)**
- [ ] **Step 3: Add hash-based skip for unchanged memories**
- [ ] **Step 4: Test with `OPENAI_API_KEY` set** — confirm memories table shows non-null embedding
- [ ] **Step 5: Test with `OPENAI_API_KEY` unset** — confirm sync still works without embedding
- [ ] **Step 6: Backfill existing 98 memories** (`python3 ~/.claude/scripts/sync-memory.py --backfill` or run once for all)
- [ ] **Step 7: Report to Claude for review**

---

## Execution Order

```
T1 (backfill)      → can run NOW, 5 minutes
T2 (memories hook) → can run NOW, 30 minutes
T3 (merge + v3.4.3) → after T1+T2 verified, 1-2 hours
T4 (pgvector)      → after T3 merged, 15 minutes
T5 (embeddings)    → after T4 done, 30 minutes
```

T1 and T2 can run in parallel. T3 depends on nothing but should come before T4+T5. T4 must complete before T5.

## Orchestration Loop (Claude-Codex)

For each task:
1. **Claude** hands Codex the brief from `docs/agents/supabase-chain/`
2. **Codex** implements, runs tests, reports output
3. **Claude** reviews output against spec (not Codex)
4. If issues → **Claude** writes improvement brief → **Codex** fixes
5. If approved → next task

NEVER: Sonnet subagent as implementer. NEVER: Codex as reviewer. NEVER: publish without Claude's explicit approval.

## Success Definition

After all 5 tasks:
1. `journal_entries` count ≥ 31 in Supabase
2. Session start injects `<memory-context>` with relevant memories automatically
3. AgentRecall recall uses pgvector for semantic search (not just keyword)
4. Memories table has `embedding` column with non-null values
5. `npm run test` passes in packages/core at v3.4.3
