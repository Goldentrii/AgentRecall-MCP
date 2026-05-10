# AgentRecall — Supabase Setup

> **Supabase is optional.** AgentRecall works fully without it — journals, palace rooms, corrections, recall, all hooks. Supabase adds semantic search (meaning-based, not keyword) and `/arstatus` cross-project intelligence. Set it up when keyword search hits its ceiling.

---

## What You Get

| Without Supabase | With Supabase |
|-----------------|--------------|
| Keyword recall (stemming + synonyms) | + Semantic recall via pgvector cosine similarity |
| `/arstatus` filesystem scan | + `[score]` relevance badges + `★` recommended project + cross-project insight alerts |
| hook-start loads palace context | + Pre-loaded semantic context from last session |
| `ar_insights` empty | + 22+ cross-project patterns searchable by meaning |

Graceful degradation is built in — if Supabase is unreachable or unconfigured, every AR feature works as before. Zero errors, zero behavior change.

---

## Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Note your **Project URL** and **anon/public key** (Settings → API)
3. You'll also need an **OpenAI API key** for embeddings (`text-embedding-3-small`)

---

## Step 2 — Apply the Migration

Open your Supabase project → **SQL Editor** → **New query** → paste the migration below → **Run**:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Core content table
CREATE TABLE IF NOT EXISTS ar_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project     text NOT NULL,
  store       text NOT NULL,
  room        text,
  slug        text NOT NULL,
  title       text,
  body        text NOT NULL,
  tags        text[] DEFAULT '{}',
  metadata    jsonb DEFAULT '{}',
  file_path   text,
  file_hash   text,
  embedding   vector(1536),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(project, store, slug)
);

CREATE INDEX IF NOT EXISTS idx_ar_entries_project ON ar_entries(project);
CREATE INDEX IF NOT EXISTS idx_ar_entries_store ON ar_entries(project, store);
CREATE INDEX IF NOT EXISTS idx_ar_entries_tags ON ar_entries USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_ar_entries_fts ON ar_entries
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || body));

-- Cross-project insights
CREATE TABLE IF NOT EXISTS ar_insights (
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

-- Sync state (hash-based dedup)
CREATE TABLE IF NOT EXISTS ar_sync_state (
  file_path    text PRIMARY KEY,
  file_hash    text NOT NULL,
  entry_id     uuid REFERENCES ar_entries(id) ON DELETE SET NULL,
  status       text DEFAULT 'synced',
  error        text,
  synced_at    timestamptz DEFAULT now()
);

-- Semantic search within one project
CREATE OR REPLACE FUNCTION ar_semantic_search(
  query_embedding vector(1536),
  match_project text,
  match_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid, project text, store text, room text, slug text,
  title text, body text, tags text[], metadata jsonb, similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT e.id, e.project, e.store, e.room, e.slug, e.title, e.body, e.tags, e.metadata,
         1 - (e.embedding <=> query_embedding) AS similarity
  FROM ar_entries e
  WHERE e.project = match_project AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_limit;
$$;

-- Cross-project insight search
CREATE OR REPLACE FUNCTION ar_insight_search(
  query_embedding vector(1536),
  match_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid, title text, severity text, confirmed int, projects text[], similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT i.id, i.title, i.severity, i.confirmed, i.projects,
         1 - (i.embedding <=> query_embedding) AS similarity
  FROM ar_insights i
  WHERE i.embedding IS NOT NULL
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_limit;
$$;

-- Cross-project ranking for /arstatus (best match per project)
CREATE OR REPLACE FUNCTION ar_cross_project_search(
  query_embedding vector(1536),
  match_limit integer DEFAULT 30
)
RETURNS TABLE (project text, best_slug text, best_title text, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (e.project)
    e.project, e.slug AS best_slug, e.title AS best_title,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM ar_entries e
  WHERE e.embedding IS NOT NULL
  ORDER BY e.project, e.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
```

Or use the raw file: [`migration.sql`](../migration.sql)

---

## Step 3 — Configure AR

```bash
ar setup supabase
```

The wizard prompts for:
- Supabase Project URL (e.g. `https://abcdef.supabase.co`)
- Supabase anon/public key
- OpenAI API key (for `text-embedding-3-small` embeddings)

Writes to `~/.agent-recall/config.json` — never committed to git.

---

## Step 4 — Backfill

```bash
ar setup supabase --backfill
```

Syncs all local `~/.agent-recall/` files (journals, palace rooms, awareness) to Supabase. Hash-based — skips files already in sync. Safe to re-run anytime.

Expected output:
```
Backfilling my-project (42 files)...
  synced: 38, skipped: 4, failed: 0
...
Backfill complete — synced: 140, skipped: 380, failed: 0
```

---

## Step 5 — Seed Cross-Project Insights

```bash
python3 ~/.claude/scripts/ar-populate-insights.py
```

Parses `~/.agent-recall/awareness.md` and palace alignment rooms → embeds each insight → upserts to `ar_insights`. Safe to re-run (idempotent via `UNIQUE(title)`).

---

## How It Works

```
remember() / session_end()
  → writes to local ~/.agent-recall/  ← source of truth, always
  → async: syncs to ar_entries (hash-dedup via ar_sync_state)
      → text-embedding-3-small (1536 dims)
      → pgvector stores embedding

recall(query)
  → Supabase configured?
      YES → 3-way parallel RRF:
              1. ar_semantic_search   (pgvector cosine on ar_entries)
              2. ar_insight_search    (pgvector on ar_insights, cross-project)
              3. FTS on ar_entries    (PostgreSQL keyword backup)
            → Reciprocal Rank Fusion → ranked results
      NO  → local keyword search (unchanged behavior)

/arstatus (at session end, async)
  → embeds last session summary
  → ar_cross_project_search → ranks all projects by relevance
  → fetches top ar_insights by confirmation count
  → writes ~/.agent-recall/arstatus-cache.json
  → next /arstatus render: [score] badges + ★ recommendation + insight alerts
```

---

## Storage Layout (Supabase)

| Table | Purpose | Rows grow when |
|-------|---------|----------------|
| `ar_entries` | All palace/journal/awareness content with embeddings | Every `remember()` / `session_end()` |
| `ar_insights` | Cross-project patterns from awareness.md | Run `ar-populate-insights.py` |
| `ar_sync_state` | Hash-based dedup tracker | Every sync |

---

## Rebuild / Reset

```bash
# Re-embed everything (after changing embedding model or corrupted rows)
ar setup supabase --backfill

# Re-embed only missing embeddings
python3 ~/.claude/scripts/ar-embed.py --upsert

# Re-seed insights after awareness.md changes
python3 ~/.claude/scripts/ar-populate-insights.py

# Regenerate /arstatus cache manually
echo "my recent work context" > ~/.agent-recall/.last-session-summary.txt
python3 ~/.claude/scripts/ar-arstatus-cache.py
```

---

## Notes

- **pgvector ivfflat indexes** require `maintenance_work_mem ≥ 64MB` — not available on Supabase free tier. AR works without them (sequential scan, fast up to ~10K rows).
- **Embedding provider:** OpenAI `text-embedding-3-small` (1536 dims). Voyage `voyage-3-lite` also supported (512 dims, zero-padded to 1536).
- **Local files are always the source of truth.** Supabase is a derived read index — delete and rebuild anytime with `--backfill`.
