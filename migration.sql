-- migration.sql — AgentRecall Supabase schema
-- Run once via: ar setup supabase (or manually in Supabase SQL editor)

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

-- Awareness insights
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

-- Sync state
CREATE TABLE IF NOT EXISTS ar_sync_state (
  file_path    text PRIMARY KEY,
  file_hash    text NOT NULL,
  entry_id     uuid REFERENCES ar_entries(id) ON DELETE SET NULL,
  status       text DEFAULT 'synced',
  error        text,
  synced_at    timestamptz DEFAULT now()
);

-- Vector indexes (created after initial data load for better performance)
-- Run these AFTER backfill completes:
-- CREATE INDEX idx_ar_entries_embedding ON ar_entries
--   USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX idx_ar_insights_embedding ON ar_insights
--   USING ivfflat(embedding vector_cosine_ops) WITH (lists = 50);

-- RPC function for semantic search
CREATE OR REPLACE FUNCTION ar_semantic_search(
  query_embedding vector(1536),
  match_project text,
  match_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  project text,
  store text,
  room text,
  slug text,
  title text,
  body text,
  tags text[],
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.id, e.project, e.store, e.room, e.slug, e.title, e.body, e.tags, e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM ar_entries e
  WHERE e.project = match_project
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_limit;
$$;

-- Cross-project semantic search (for insights)
CREATE OR REPLACE FUNCTION ar_insight_search(
  query_embedding vector(1536),
  match_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  severity text,
  confirmed int,
  projects text[],
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    i.id, i.title, i.severity, i.confirmed, i.projects,
    1 - (i.embedding <=> query_embedding) AS similarity
  FROM ar_insights i
  WHERE i.embedding IS NOT NULL
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_limit;
$$;
