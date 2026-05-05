# Codex Brief — T4: Add pgvector to Memories Table

**Role:** Implementer (Codex)
**Review by:** Claude (orchestrator)
**Task:** Apply a Supabase migration to add a `vector(1536)` column to the `memories` table and create a `match_memories()` RPC function.

## Context

Supabase project: `fjdtuyflvgylrllujpnc` (eu-west-1)
Table: `memories` — currently has columns: id, slug, name, description, type, body, created_at, updated_at
Goal: add semantic search capability using pgvector

This is a MIGRATION task — you will apply SQL via the Supabase MCP tool `mcp__claude_ai_Supabase__apply_migration`.

## Migration SQL

Apply this migration (in two parts if needed):

```sql
-- Part 1: Enable pgvector and add column
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Part 2: Create index (after column exists)
CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

Note: If the table has fewer than 1000 rows, use `lists = 10` instead of 100 for the ivfflat index. With 98 rows, use `lists = 10`.

```sql
-- Correct index for small tables:
CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);
```

```sql
-- Part 3: RPC function for semantic search
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

## Steps

1. **Apply migration using Supabase MCP tool**

Use `mcp__claude_ai_Supabase__apply_migration` with:
- project_id: `fjdtuyflvgylrllujpnc`
- name: `add_memories_pgvector`
- query: the SQL above (apply in one call if possible, or split into 3 calls)

2. **Verify column exists**
```sql
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'memories' 
  AND column_name = 'embedding';
```

Expected: returns 1 row with `udt_name = 'vector'`

Use `mcp__claude_ai_Supabase__execute_sql` to run verification queries.

3. **Verify RPC function exists**
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'match_memories';
```

Expected: returns 1 row

4. **Test RPC function with dummy embedding**
```sql
SELECT * FROM match_memories(
  array_fill(0::float, ARRAY[1536])::vector,
  5, 
  0.0  -- threshold 0.0 to match any embedding
) LIMIT 3;
```

Expected: returns 0 rows (no embeddings stored yet — that's correct, T5 fills them)

5. **Report to Claude**: migration output, verification results

## Success Criteria

- `memories.embedding` column exists with type `vector(1536)`
- `match_memories()` RPC function exists and callable
- ivfflat index exists on `memories.embedding`
- No data loss (existing 98 rows still present)

## Do NOT

- Modify any local files
- Run any npm commands
- Drop or truncate any tables
- Apply any migration that deletes existing data
