# AgentRecall v3.4 — Supabase Semantic Recall

**Date:** 2026-04-29
**Status:** Design approved
**Deadline:** 2026-05-18 (KR-4 milestone)
**Scope:** Add optional Supabase backend for semantic vector search via pgvector

---

## Problem

AgentRecall's recall quality hits a keyword ceiling. Current search is keyword-only with RRF ranking across palace/journal/insights. This causes:

- Conceptual mismatches (e.g., "core product priorities" returns a marketing session because both contain "AgentRecall")
- No semantic understanding — synonyms, paraphrases, and intent are invisible
- Cross-project search is weak (file globbing, no unified index)
- Compound insight synthesis relies on string-matching thresholds that rarely fire

## Solution

Add Supabase (PostgreSQL + pgvector) as an optional **read enhancer** for recall. Local filesystem remains the only write target. Supabase is a derived index — if it's down, local keyword search still works.

### Architecture: Approach C — Thin Read Abstraction + Sync Layer

```
Write path (unchanged):
  agent → local files (journal, palace, awareness, digest)
            ↓ async post-write hook (non-blocking)
          sync to Supabase → generate embedding → upsert

Read path (enhanced):
  recall(query)
    → RecallBackend.search(query, project, limit)
        ├─ SupabaseRecallBackend (pgvector cosine + FTS + RRF)
        └─ LocalRecallBackend (current keyword search, fallback)
```

### Design Principles

1. **Zero new human actions.** Daily routine stays `/arstart` → work → `/arsave`. One-time setup: `ar setup supabase`.
2. **Agent handles complexity.** Backfill, sync, retry, embedding generation — all automatic and invisible.
3. **Local files are source of truth.** Supabase is a derived read index. Delete the database, re-run backfill, lose nothing.
4. **Graceful degradation.** No Supabase config = local-only (current behavior). Supabase down = fallback to local keyword search.

---

## Schema (3 tables)

All tables use `ar_` prefix to avoid collision with existing tables in the shared Supabase project (`fjdtuyflvgylrllujpnc`).

### ar_entries

Core content table. Every memory entry (journal, palace room, awareness, digest) becomes one row.

```sql
CREATE TABLE ar_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project     text NOT NULL,
  store       text NOT NULL,        -- 'journal' | 'palace' | 'awareness' | 'digest'
  room        text,                 -- palace room slug (null for non-palace)
  slug        text NOT NULL,        -- file-derived identifier
  title       text,
  body        text NOT NULL,
  tags        text[] DEFAULT '{}',
  metadata    jsonb DEFAULT '{}',   -- salience, access_count, severity, etc.
  file_path   text,                 -- local source file path
  file_hash   text,                 -- SHA-256 for change detection
  embedding   vector(1536),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(project, store, slug)
);

CREATE INDEX idx_ar_entries_project ON ar_entries(project);
CREATE INDEX idx_ar_entries_store ON ar_entries(project, store);
CREATE INDEX idx_ar_entries_tags ON ar_entries USING gin(tags);
CREATE INDEX idx_ar_entries_fts ON ar_entries
  USING gin(to_tsvector('english', coalesce(title,'') || ' ' || body));
CREATE INDEX idx_ar_entries_embedding ON ar_entries
  USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
```

### ar_insights

Awareness insights. Separate table for fast cross-project queries and confirmation tracking.

```sql
CREATE TABLE ar_insights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL UNIQUE,
  severity    text DEFAULT 'important',
  confirmed   int DEFAULT 1,
  projects    text[] DEFAULT '{}',
  tags        text[] DEFAULT '{}',
  embedding   vector(1536),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_ar_insights_embedding ON ar_insights
  USING ivfflat(embedding vector_cosine_ops) WITH (lists = 50);
```

### ar_sync_state

Tracks sync + backfill progress per file. Enables resumable backfill and change detection.

```sql
CREATE TABLE ar_sync_state (
  file_path    text PRIMARY KEY,
  file_hash    text NOT NULL,
  entry_id     uuid REFERENCES ar_entries(id) ON DELETE SET NULL,
  status       text DEFAULT 'synced',  -- 'pending' | 'synced' | 'embedded' | 'failed'
  error        text,
  synced_at    timestamptz DEFAULT now()
);
```

### Embedding Dimensions

`vector(1536)` accommodates both providers:
- OpenAI `text-embedding-3-small`: 1536 native
- Voyage `voyage-3-lite`: 512 dims, zero-padded to 1536

This avoids needing to rebuild indexes when switching providers.

---

## RecallBackend Interface

Added to `packages/core/src/tools-logic/recall-backend.ts`:

```typescript
export interface RecallResult {
  id: string;
  source: 'palace' | 'journal' | 'insight';
  title: string;
  excerpt: string;
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'weak';
  room?: string;
  date?: string;
}

export interface RecallBackend {
  search(query: string, project: string, limit: number): Promise<RecallResult[]>;
  available(): boolean;
}
```

### LocalRecallBackend

Wraps current `smart-recall.ts` logic (keyword + RRF + Ebbinghaus). Extracted from existing code — no behavior change.

### SupabaseRecallBackend

```typescript
async search(query, project, limit): Promise<RecallResult[]> {
  // 1. Generate embedding for query
  const queryEmbedding = await this.embed(query);

  // 2. Three parallel Supabase queries:
  //    a) pgvector cosine similarity on ar_entries (project-scoped)
  //    b) pgvector cosine similarity on ar_insights (cross-project)
  //    c) PostgreSQL FTS on ar_entries (keyword backup)

  // 3. RRF merge across all three result sets (same k=60 constant)

  // 4. Return top N with confidence derived from score thresholds
}
```

### Backend Selection (in smart-recall.ts)

```typescript
function getRecallBackend(): RecallBackend {
  const config = readConfig();  // ~/.agent-recall/config.json
  if (config?.supabase_url && config?.sync_enabled) {
    try {
      return new SupabaseRecallBackend(config);
    } catch {
      return new LocalRecallBackend();  // fallback
    }
  }
  return new LocalRecallBackend();
}
```

---

## Sync Pipeline

### Post-Write Hook

After any local file write (journal, palace, awareness, digest), fire async sync. Non-blocking — caller returns immediately.

```typescript
function syncToSupabase(filePath: string, project: string, store: string): void {
  // Fire and forget — errors logged, not thrown
  setImmediate(async () => {
    const config = readConfig();
    if (!config?.supabase_url || !config?.sync_enabled) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    const hash = sha256(content);

    // Skip if unchanged
    const existing = await supabase.from('ar_sync_state')
      .select('file_hash').eq('file_path', filePath).single();
    if (existing?.data?.file_hash === hash) return;

    // Parse markdown → title, body, tags, metadata
    const parsed = parseMemoryFile(content);

    // Upsert to ar_entries
    const { data: entry } = await supabase.from('ar_entries')
      .upsert({ project, store, slug: deriveSlug(filePath), ...parsed, file_path: filePath, file_hash: hash })
      .select('id').single();

    // Generate + store embedding
    const embedding = await generateEmbedding(parsed.title + ' ' + parsed.body);
    await supabase.from('ar_entries')
      .update({ embedding }).eq('id', entry.id);

    // Update sync state
    await supabase.from('ar_sync_state')
      .upsert({ file_path: filePath, file_hash: hash, entry_id: entry.id, status: 'embedded' });
  });
}
```

### Where Hooks Are Inserted

- `journalWrite()` → `syncToSupabase(path, project, 'journal')`
- `palaceWrite()` / `createRoom()` → `syncToSupabase(path, project, 'palace')`
- `awarenessUpdate()` → sync insights to `ar_insights`
- `digestStore()` → `syncToSupabase(path, project, 'digest')`

### Backfill (Automatic After Setup)

After `ar setup supabase` completes, backfill starts automatically:

1. Scan all files in `~/.agent-recall/projects/*/`
2. For each file not in `ar_sync_state` (or hash changed): add to queue
3. Process queue in batches (50 files at a time)
4. Embedding generation batched (reduce API calls)
5. Progress tracked in `ar_sync_state` — resumable if interrupted
6. Runs silently. Agent can check status via internal `backfillStatus()` function.

---

## Embedding Generation

### Provider Abstraction

```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

class OpenAIEmbedding implements EmbeddingProvider {
  // model: text-embedding-3-small, 1536 dims
}

class VoyageEmbedding implements EmbeddingProvider {
  // model: voyage-3-lite, 512 dims → zero-pad to 1536
}
```

### Configuration

Provider selected via `config.json`:

```json
{
  "embedding_provider": "openai",
  "embedding_api_key": "sk-..."
}
```

Default: `openai` (most users already have a key).

### Cost Estimate

Typical AgentRecall installation: ~500 files, avg 500 tokens each.
- Initial backfill: ~250K tokens = $0.005
- Daily sync: ~20 files = $0.0004/day
- Per-recall query embedding: ~50 tokens = negligible

---

## User-Facing Commands

### Human commands (1 total)

| Command | What | When |
|---------|------|------|
| `ar setup supabase` | Interactive: paste URL + keys. Creates tables. Starts backfill. | One time |

### Agent-internal operations (no human action needed)

| Operation | Trigger |
|-----------|---------|
| Sync on write | Automatic after any local file write |
| Backfill resume | Automatic on next `session_start` if incomplete |
| Enhanced recall | Automatic when Supabase config exists |
| Retry failed syncs | Automatic, exponential backoff, max 3 retries |
| Status check | Agent calls `backfillStatus()` if recall seems sparse |

---

## Configuration

### Config File: `~/.agent-recall/config.json`

```json
{
  "supabase_url": "https://fjdtuyflvgylrllujpnc.supabase.co",
  "supabase_anon_key": "eyJ...",
  "embedding_provider": "openai",
  "embedding_api_key": "sk-...",
  "sync_enabled": true
}
```

No config file = local-only mode. Zero behavior change from v3.3.x.

### Environment Variable Overrides

```bash
AGENT_RECALL_SUPABASE_URL=https://...
AGENT_RECALL_SUPABASE_KEY=eyJ...
AGENT_RECALL_EMBEDDING_PROVIDER=openai
AGENT_RECALL_EMBEDDING_KEY=sk-...
```

Env vars take precedence over config.json.

---

## Testing Strategy

- **Unit tests:** RecallBackend interface, embedding provider abstraction, sync hash detection
- **Integration tests:** Supabase queries against a test project (seeded data)
- **Fallback tests:** Supabase unavailable → graceful degradation to local
- **Quality comparison:** Same 20 recall queries, compare keyword vs. semantic results — measure relevance improvement

---

## What This Does NOT Include (v3.5+)

- Compound insight synthesis via SQL aggregation
- Cold-start bootstrap (scan git repos → populate Supabase)
- Full StorageBackend abstraction (write path)
- Cross-user shared insights
- SDK/CLI npm publish

---

## File Changes Summary

| File | Change |
|------|--------|
| `packages/core/src/tools-logic/recall-backend.ts` | NEW — RecallBackend interface + implementations |
| `packages/core/src/tools-logic/smart-recall.ts` | Refactor to use RecallBackend |
| `packages/core/src/storage/supabase.ts` | NEW — Supabase client, sync pipeline |
| `packages/core/src/storage/embedding.ts` | NEW — EmbeddingProvider interface + OpenAI/Voyage |
| `packages/core/src/storage/config.ts` | NEW — config.json reader |
| `packages/core/src/tools-logic/journal-write.ts` | Add post-write sync hook |
| `packages/core/src/tools-logic/palace-write.ts` | Add post-write sync hook |
| `packages/core/src/palace/awareness.ts` | Add post-write sync hook |
| `packages/core/src/digest/store.ts` | Add post-write sync hook |
| `packages/cli/src/commands/setup-supabase.ts` | NEW — interactive setup command |
| `packages/core/package.json` | Add deps: @supabase/supabase-js, openai |
| `migration.sql` | NEW — table creation + indexes |
