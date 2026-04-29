# Supabase Semantic Recall — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Supabase pgvector backend to AgentRecall for semantic recall, replacing keyword-only search when configured.

**Architecture:** Local files remain the only write target. A post-write sync hook mirrors content to Supabase asynchronously. `smart-recall.ts` uses a `RecallBackend` interface — `SupabaseRecallBackend` (pgvector + FTS) when configured, `LocalRecallBackend` (current keyword search) as fallback.

**Tech Stack:** TypeScript, @supabase/supabase-js, OpenAI/Voyage embedding APIs, pgvector, node:crypto (SHA-256)

**Spec:** `docs/superpowers/specs/2026-04-29-supabase-semantic-recall-design.md`

---

## File Structure

```
packages/core/src/
├── supabase/                          ← NEW directory
│   ├── config.ts                      — read/write ~/.agent-recall/config.json
│   ├── client.ts                      — Supabase client singleton
│   ├── embedding.ts                   — EmbeddingProvider interface + OpenAI/Voyage
│   ├── sync.ts                        — post-write sync hook (hash, upsert, embed)
│   └── recall-backend.ts              — SupabaseRecallBackend (pgvector + FTS search)
├── tools-logic/
│   ├── recall-backend.ts              ← NEW — RecallBackend interface + LocalRecallBackend
│   └── smart-recall.ts                ← MODIFY — use RecallBackend instead of hardcoded search
├── index.ts                           ← MODIFY — export new modules
packages/cli/src/
│   └── index.ts                       ← MODIFY — add `ar setup supabase` command
packages/core/test/
│   ├── config.test.mjs                ← NEW
│   ├── embedding.test.mjs             ← NEW
│   ├── sync.test.mjs                  ← NEW
│   ├── recall-backend.test.mjs        ← NEW
│   └── smart-recall.test.mjs          ← MODIFY — add backend selection tests
migration.sql                          ← NEW — Supabase table creation
```

---

### Task 1: Config Module

**Files:**
- Create: `packages/core/src/supabase/config.ts`
- Test: `packages/core/test/config.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// packages/core/test/config.test.mjs
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Supabase config", () => {
  let tmpDir;
  let origEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ar-config-"));
    origEnv = { ...process.env };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.env = origEnv;
  });

  it("returns null when no config exists", async () => {
    const { setRoot } = await import("agent-recall-core");
    const { readSupabaseConfig } = await import("agent-recall-core");
    setRoot(tmpDir);
    const config = readSupabaseConfig();
    assert.equal(config, null);
  });

  it("reads config from config.json", async () => {
    const { setRoot } = await import("agent-recall-core");
    const { readSupabaseConfig } = await import("agent-recall-core");
    setRoot(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({
        supabase_url: "https://test.supabase.co",
        supabase_anon_key: "eyJ-test",
        embedding_provider: "openai",
        embedding_api_key: "sk-test",
        sync_enabled: true,
      })
    );
    const config = readSupabaseConfig();
    assert.equal(config.supabase_url, "https://test.supabase.co");
    assert.equal(config.sync_enabled, true);
  });

  it("env vars override config.json", async () => {
    const { setRoot } = await import("agent-recall-core");
    const { readSupabaseConfig } = await import("agent-recall-core");
    setRoot(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({
        supabase_url: "https://file.supabase.co",
        supabase_anon_key: "file-key",
        embedding_provider: "openai",
        embedding_api_key: "sk-file",
        sync_enabled: true,
      })
    );
    process.env.AGENT_RECALL_SUPABASE_URL = "https://env.supabase.co";
    process.env.AGENT_RECALL_SUPABASE_KEY = "env-key";
    const config = readSupabaseConfig();
    assert.equal(config.supabase_url, "https://env.supabase.co");
    assert.equal(config.supabase_anon_key, "env-key");
  });

  it("returns null when sync_enabled is false", async () => {
    const { setRoot } = await import("agent-recall-core");
    const { readSupabaseConfig } = await import("agent-recall-core");
    setRoot(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({
        supabase_url: "https://test.supabase.co",
        supabase_anon_key: "key",
        embedding_provider: "openai",
        embedding_api_key: "sk-test",
        sync_enabled: false,
      })
    );
    const config = readSupabaseConfig();
    assert.equal(config, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/AgentRecall/packages/core && node --test test/config.test.mjs`
Expected: FAIL — `readSupabaseConfig` not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/core/src/supabase/config.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { getRoot } from "../types.js";

export interface SupabaseConfig {
  supabase_url: string;
  supabase_anon_key: string;
  embedding_provider: "openai" | "voyage";
  embedding_api_key: string;
  sync_enabled: boolean;
}

function configPath(): string {
  return path.join(getRoot(), "config.json");
}

/**
 * Read Supabase config. Returns null if not configured or sync disabled.
 * Env vars override config.json values.
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  let config: Partial<SupabaseConfig> = {};

  const p = configPath();
  if (fs.existsSync(p)) {
    try {
      config = JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      return null;
    }
  }

  // Env var overrides
  if (process.env.AGENT_RECALL_SUPABASE_URL) {
    config.supabase_url = process.env.AGENT_RECALL_SUPABASE_URL;
  }
  if (process.env.AGENT_RECALL_SUPABASE_KEY) {
    config.supabase_anon_key = process.env.AGENT_RECALL_SUPABASE_KEY;
  }
  if (process.env.AGENT_RECALL_EMBEDDING_PROVIDER) {
    config.embedding_provider = process.env.AGENT_RECALL_EMBEDDING_PROVIDER as "openai" | "voyage";
  }
  if (process.env.AGENT_RECALL_EMBEDDING_KEY) {
    config.embedding_api_key = process.env.AGENT_RECALL_EMBEDDING_KEY;
  }

  if (!config.supabase_url || !config.supabase_anon_key) return null;
  if (config.sync_enabled === false) return null;

  return {
    supabase_url: config.supabase_url,
    supabase_anon_key: config.supabase_anon_key,
    embedding_provider: config.embedding_provider ?? "openai",
    embedding_api_key: config.embedding_api_key ?? "",
    sync_enabled: config.sync_enabled ?? true,
  };
}

export function writeSupabaseConfig(config: SupabaseConfig): void {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf-8");
}
```

- [ ] **Step 4: Export from barrel**

Add to `packages/core/src/index.ts`:
```typescript
// Supabase — config
export { readSupabaseConfig, writeSupabaseConfig } from "./supabase/config.js";
export type { SupabaseConfig } from "./supabase/config.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/config.test.mjs`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/supabase/config.ts packages/core/test/config.test.mjs packages/core/src/index.ts
git commit -m "feat: add Supabase config module with env var overrides"
```

---

### Task 2: Supabase Client Singleton

**Files:**
- Create: `packages/core/src/supabase/client.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// packages/core/src/supabase/client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config.js";

let _client: SupabaseClient | null = null;

/**
 * Get a Supabase client. Returns null if not configured.
 * Singleton — created once, reused for the process lifetime.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;

  const config = readSupabaseConfig();
  if (!config) return null;

  _client = createClient(config.supabase_url, config.supabase_anon_key);
  return _client;
}

/** Reset client (for testing). */
export function resetSupabaseClient(): void {
  _client = null;
}
```

- [ ] **Step 2: Add @supabase/supabase-js dependency**

Run: `cd ~/Projects/AgentRecall/packages/core && npm install @supabase/supabase-js`

- [ ] **Step 3: Export from barrel**

Add to `packages/core/src/index.ts`:
```typescript
// Supabase — client
export { getSupabaseClient, resetSupabaseClient } from "./supabase/client.js";
```

- [ ] **Step 4: Build to verify no type errors**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/supabase/client.ts packages/core/src/index.ts packages/core/package.json package-lock.json
git commit -m "feat: add Supabase client singleton"
```

---

### Task 3: Embedding Provider

**Files:**
- Create: `packages/core/src/supabase/embedding.ts`
- Test: `packages/core/test/embedding.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// packages/core/test/embedding.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Embedding provider", () => {
  it("OpenAI provider returns 1536-dim vector", async () => {
    // Unit test: mock the fetch call
    const { OpenAIEmbedding } = await import("agent-recall-core");
    const provider = new OpenAIEmbedding("sk-test");

    // We test the padding/dimension logic, not the API call
    // The actual API is tested in integration tests
    assert.equal(provider.dimensions, 1536);
    assert.equal(provider.model, "text-embedding-3-small");
  });

  it("Voyage provider zero-pads to 1536 dims", async () => {
    const { VoyageEmbedding } = await import("agent-recall-core");
    const provider = new VoyageEmbedding("pa-test");

    assert.equal(provider.dimensions, 1536);
    assert.equal(provider.nativeDimensions, 512);
  });

  it("zeroPad pads short vectors to target length", async () => {
    const { zeroPad } = await import("agent-recall-core");
    const short = [1.0, 2.0, 3.0];
    const padded = zeroPad(short, 6);
    assert.deepEqual(padded, [1.0, 2.0, 3.0, 0, 0, 0]);
  });

  it("zeroPad returns original if already correct length", async () => {
    const { zeroPad } = await import("agent-recall-core");
    const exact = [1.0, 2.0, 3.0];
    const padded = zeroPad(exact, 3);
    assert.deepEqual(padded, [1.0, 2.0, 3.0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/embedding.test.mjs`
Expected: FAIL — exports not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/core/src/supabase/embedding.ts

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}

export function zeroPad(vec: number[], target: number): number[] {
  if (vec.length >= target) return vec;
  const padded = new Array(target).fill(0);
  for (let i = 0; i < vec.length; i++) padded[i] = vec[i];
  return padded;
}

export class OpenAIEmbedding implements EmbeddingProvider {
  readonly dimensions = 1536;
  readonly model = "text-embedding-3-small";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI embedding failed: ${res.status}`);
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`OpenAI batch embedding failed: ${res.status}`);
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}

export class VoyageEmbedding implements EmbeddingProvider {
  readonly dimensions = 1536;
  readonly nativeDimensions = 512;
  readonly model = "voyage-3-lite";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: [text] }),
    });
    if (!res.ok) throw new Error(`Voyage embedding failed: ${res.status}`);
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return zeroPad(data.data[0].embedding, this.dimensions);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`Voyage batch embedding failed: ${res.status}`);
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => zeroPad(d.embedding, this.dimensions));
  }
}

/** Create the right provider from config. */
export function createEmbeddingProvider(
  provider: "openai" | "voyage",
  apiKey: string
): EmbeddingProvider {
  if (provider === "voyage") return new VoyageEmbedding(apiKey);
  return new OpenAIEmbedding(apiKey);
}
```

- [ ] **Step 4: Export from barrel**

Add to `packages/core/src/index.ts`:
```typescript
// Supabase — embedding
export { OpenAIEmbedding, VoyageEmbedding, zeroPad, createEmbeddingProvider } from "./supabase/embedding.js";
export type { EmbeddingProvider } from "./supabase/embedding.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/embedding.test.mjs`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/supabase/embedding.ts packages/core/test/embedding.test.mjs packages/core/src/index.ts
git commit -m "feat: add embedding provider abstraction (OpenAI + Voyage)"
```

---

### Task 4: Migration SQL

**Files:**
- Create: `migration.sql` (project root)

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add migration.sql
git commit -m "feat: add Supabase migration SQL (3 tables + RPC functions)"
```

---

### Task 5: Sync Pipeline

**Files:**
- Create: `packages/core/src/supabase/sync.ts`
- Test: `packages/core/test/sync.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// packages/core/test/sync.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";

describe("Sync utilities", () => {
  it("contentHash produces consistent SHA-256", async () => {
    const { contentHash } = await import("agent-recall-core");
    const hash1 = contentHash("hello world");
    const hash2 = contentHash("hello world");
    const hash3 = contentHash("different");
    assert.equal(hash1, hash2);
    assert.notEqual(hash1, hash3);
    assert.equal(hash1.length, 64); // SHA-256 hex = 64 chars
  });

  it("parseMemoryFile extracts frontmatter and body", async () => {
    const { parseMemoryFile } = await import("agent-recall-core");
    const content = `---
type: journal
project: test
date: 2026-04-29
tags: ["journal", "test"]
---
# 2026-04-29 — test

## Brief
Did some work today.

## Next
Continue tomorrow.`;

    const parsed = parseMemoryFile(content);
    assert.equal(parsed.title, "2026-04-29 — test");
    assert.ok(parsed.body.includes("Did some work today"));
    assert.ok(parsed.metadata.type === "journal");
  });

  it("parseMemoryFile handles files without frontmatter", async () => {
    const { parseMemoryFile } = await import("agent-recall-core");
    const content = `# Simple Note\n\nSome content here.`;
    const parsed = parseMemoryFile(content);
    assert.equal(parsed.title, "Simple Note");
    assert.ok(parsed.body.includes("Some content here"));
  });

  it("deriveSlug creates stable slug from file path", async () => {
    const { deriveSlug } = await import("agent-recall-core");
    const slug1 = deriveSlug("/home/user/.agent-recall/projects/myproj/journal/2026-04-29.md");
    const slug2 = deriveSlug("/home/user/.agent-recall/projects/myproj/journal/2026-04-29.md");
    assert.equal(slug1, slug2);
    assert.ok(slug1.includes("2026-04-29"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/sync.test.mjs`
Expected: FAIL — exports not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/core/src/supabase/sync.ts
import * as crypto from "node:crypto";
import * as path from "node:path";
import { getSupabaseClient } from "./client.js";
import { readSupabaseConfig } from "./config.js";
import { createEmbeddingProvider, type EmbeddingProvider } from "./embedding.js";

// ---------------------------------------------------------------------------
// Utilities (exported for testing)
// ---------------------------------------------------------------------------

export function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

export interface ParsedMemoryFile {
  title: string;
  body: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export function parseMemoryFile(content: string): ParsedMemoryFile {
  let body = content;
  let metadata: Record<string, unknown> = {};

  // Extract YAML frontmatter
  if (content.startsWith("---")) {
    const endIdx = content.indexOf("---", 3);
    if (endIdx > 0) {
      const fm = content.slice(3, endIdx).trim();
      body = content.slice(endIdx + 3).trim();
      // Simple YAML parsing (key: value pairs)
      for (const line of fm.split("\n")) {
        const match = line.match(/^(\w+):\s*(.+)/);
        if (match) {
          const val = match[2].trim();
          // Handle arrays like ["a", "b"]
          if (val.startsWith("[")) {
            try { metadata[match[1]] = JSON.parse(val); } catch { metadata[match[1]] = val; }
          } else {
            metadata[match[1]] = val;
          }
        }
      }
    }
  }

  // Extract title from first heading
  const titleMatch = body.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : body.slice(0, 80).trim();

  // Extract tags from metadata or content
  const tags: string[] = Array.isArray(metadata.tags) ? metadata.tags : [];

  return { title, body, tags, metadata };
}

export function deriveSlug(filePath: string): string {
  // Extract meaningful parts: journal/2026-04-29.md → journal--2026-04-29
  const parts = filePath.split(path.sep);
  const fileName = path.basename(filePath, ".md");

  // Find the store type (journal, palace, etc.)
  const journalIdx = parts.indexOf("journal");
  const palaceIdx = parts.indexOf("rooms");

  if (journalIdx >= 0) return `journal--${fileName}`;
  if (palaceIdx >= 0) {
    const room = parts[palaceIdx + 1] ?? "unknown";
    return `palace--${room}--${fileName}`;
  }
  return `other--${fileName}`;
}

// ---------------------------------------------------------------------------
// Sync (fire-and-forget)
// ---------------------------------------------------------------------------

let _embeddingProvider: EmbeddingProvider | null = null;

function getEmbeddingProvider(): EmbeddingProvider | null {
  if (_embeddingProvider) return _embeddingProvider;
  const config = readSupabaseConfig();
  if (!config?.embedding_api_key) return null;
  _embeddingProvider = createEmbeddingProvider(config.embedding_provider, config.embedding_api_key);
  return _embeddingProvider;
}

/**
 * Sync a local file to Supabase. Non-blocking — errors are logged, not thrown.
 * Call after any local file write.
 */
export function syncToSupabase(
  filePath: string,
  content: string,
  project: string,
  store: "journal" | "palace" | "awareness" | "digest",
  room?: string
): void {
  // Fire and forget
  setImmediate(() => {
    void doSync(filePath, content, project, store, room);
  });
}

async function doSync(
  filePath: string,
  content: string,
  project: string,
  store: string,
  room?: string
): Promise<void> {
  try {
    const client = getSupabaseClient();
    if (!client) return;

    const hash = contentHash(content);

    // Check if already synced with same hash
    const { data: existing } = await client
      .from("ar_sync_state")
      .select("file_hash")
      .eq("file_path", filePath)
      .single();

    if (existing?.file_hash === hash) return; // unchanged

    const parsed = parseMemoryFile(content);
    const slug = deriveSlug(filePath);

    // Upsert entry
    const { data: entry, error: upsertErr } = await client
      .from("ar_entries")
      .upsert(
        {
          project,
          store,
          room: room ?? null,
          slug,
          title: parsed.title,
          body: parsed.body,
          tags: parsed.tags,
          metadata: parsed.metadata,
          file_path: filePath,
          file_hash: hash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project,store,slug" }
      )
      .select("id")
      .single();

    if (upsertErr || !entry) return;

    // Generate and store embedding
    const provider = getEmbeddingProvider();
    if (provider) {
      const textForEmbedding = (parsed.title + " " + parsed.body).slice(0, 8000);
      const embedding = await provider.embed(textForEmbedding);
      await client
        .from("ar_entries")
        .update({ embedding })
        .eq("id", entry.id);
    }

    // Update sync state
    await client.from("ar_sync_state").upsert({
      file_path: filePath,
      file_hash: hash,
      entry_id: entry.id,
      status: provider ? "embedded" : "synced",
      synced_at: new Date().toISOString(),
    });
  } catch {
    // Silent failure — local files are source of truth
  }
}

/**
 * Backfill: scan all files in a project and sync unsynced ones.
 * Returns progress info for agent diagnostics.
 */
export async function backfill(project: string, files: Array<{ path: string; content: string; store: "journal" | "palace" | "awareness" | "digest"; room?: string }>): Promise<{ synced: number; skipped: number; failed: number }> {
  const client = getSupabaseClient();
  if (!client) return { synced: 0, skipped: 0, failed: 0 };

  let synced = 0, skipped = 0, failed = 0;

  for (const file of files) {
    try {
      const hash = contentHash(file.content);
      const { data: existing } = await client
        .from("ar_sync_state")
        .select("file_hash")
        .eq("file_path", file.path)
        .single();

      if (existing?.file_hash === hash) {
        skipped++;
        continue;
      }

      await doSync(file.path, file.content, project, file.store, file.room);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, skipped, failed };
}
```

- [ ] **Step 4: Export from barrel**

Add to `packages/core/src/index.ts`:
```typescript
// Supabase — sync
export { syncToSupabase, backfill, contentHash, parseMemoryFile, deriveSlug } from "./supabase/sync.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/sync.test.mjs`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/supabase/sync.ts packages/core/test/sync.test.mjs packages/core/src/index.ts
git commit -m "feat: add sync pipeline with hash-based change detection"
```

---

### Task 6: RecallBackend Interface + LocalRecallBackend

**Files:**
- Create: `packages/core/src/tools-logic/recall-backend.ts`
- Test: `packages/core/test/recall-backend.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// packages/core/test/recall-backend.test.mjs
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("RecallBackend interface", () => {
  it("LocalRecallBackend is always available", async () => {
    const { LocalRecallBackend } = await import("agent-recall-core");
    const backend = new LocalRecallBackend();
    assert.equal(backend.available(), true);
  });

  it("getRecallBackend returns LocalRecallBackend when no config", async () => {
    const { setRoot } = await import("agent-recall-core");
    const { getRecallBackend, LocalRecallBackend } = await import("agent-recall-core");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ar-backend-"));
    setRoot(tmpDir);
    const backend = getRecallBackend();
    assert.ok(backend instanceof LocalRecallBackend);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/recall-backend.test.mjs`
Expected: FAIL — exports not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/core/src/tools-logic/recall-backend.ts
import type { SmartRecallResultItem } from "./smart-recall.js";

/**
 * RecallBackend — thin read abstraction for recall search.
 * LocalRecallBackend wraps current keyword + RRF logic.
 * SupabaseRecallBackend adds pgvector semantic search.
 */
export interface RecallBackend {
  search(
    query: string,
    project: string | undefined,
    limit: number
  ): Promise<SmartRecallResultItem[]>;
  available(): boolean;
}

/**
 * LocalRecallBackend — delegates to the existing smartRecall internals.
 * This is a pass-through wrapper to satisfy the interface; the actual
 * logic stays in smart-recall.ts (no code duplication).
 */
export class LocalRecallBackend implements RecallBackend {
  available(): boolean {
    return true;
  }

  async search(
    query: string,
    project: string | undefined,
    limit: number
  ): Promise<SmartRecallResultItem[]> {
    // Import lazily to avoid circular dependency
    const { localRecallSearch } = await import("./smart-recall.js");
    return localRecallSearch(query, project, limit);
  }
}

/**
 * Get the configured RecallBackend.
 * Returns SupabaseRecallBackend if configured and reachable, else Local.
 */
import { readSupabaseConfig } from "../supabase/config.js";
import { SupabaseRecallBackend } from "../supabase/recall-backend.js";

let _cachedBackend: RecallBackend | null = null;

export function getRecallBackend(): RecallBackend {
  if (_cachedBackend) return _cachedBackend;

  try {
    const config = readSupabaseConfig();
    if (config) {
      const backend = new SupabaseRecallBackend(config);
      if (backend.available()) {
        _cachedBackend = backend;
        return backend;
      }
    }
  } catch {
    // Supabase not configured or module not available
  }

  _cachedBackend = new LocalRecallBackend();
  return _cachedBackend;
}
```

- [ ] **Step 4: Export from barrel**

Add to `packages/core/src/index.ts`:
```typescript
// RecallBackend
export { LocalRecallBackend, getRecallBackend } from "./tools-logic/recall-backend.js";
export type { RecallBackend } from "./tools-logic/recall-backend.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/recall-backend.test.mjs`
Expected: PASS (both tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tools-logic/recall-backend.ts packages/core/test/recall-backend.test.mjs packages/core/src/index.ts
git commit -m "feat: add RecallBackend interface + LocalRecallBackend"
```

---

### Task 7: Refactor smart-recall.ts to use RecallBackend

**Files:**
- Modify: `packages/core/src/tools-logic/smart-recall.ts`

This is the key integration task. We extract the existing search logic into a `localRecallSearch()` function (called by LocalRecallBackend), and modify `smartRecall()` to route through `getRecallBackend()`.

- [ ] **Step 1: Extract localRecallSearch from smartRecall**

In `packages/core/src/tools-logic/smart-recall.ts`, add a new exported function that contains the existing palace + journal + insight search + RRF merge logic. The existing `smartRecall()` will call it.

Add this function just before the `smartRecall` function (around line 275):

```typescript
/**
 * Core local search logic — extracted for RecallBackend interface.
 * Runs palace + journal + insight search with RRF merge.
 * Called by LocalRecallBackend.search().
 */
export async function localRecallSearch(
  query: string,
  project: string | undefined,
  limit: number
): Promise<SmartRecallResultItem[]> {
  const queryWords = expandQuery(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

  const palaceItems: SmartRecallResultItem[] = [];
  const journalItems: SmartRecallResultItem[] = [];
  const insightItems: SmartRecallResultItem[] = [];

  // Palace search (copy existing logic from lines 293-329)
  try {
    const palaceResults = await palaceSearch({ query, project, limit: limit * 2 });
    for (const r of palaceResults.results) {
      const title = `${r.room}/${r.file}`;
      const id = stableId("palace", title);
      const keyScore = r.keyword_score ?? keywordExactness(query, r.excerpt);
      const salience = Math.max(0.4, r.salience);
      const internalScore = keyScore * 0.65 + salience * 0.35;
      let palaceDate: string | undefined;
      const datePattern = r.excerpt.match(/(\d{4}-\d{2}-\d{2})/);
      if (datePattern) palaceDate = datePattern[1];
      palaceItems.push({ id, source: "palace", title, excerpt: r.excerpt, score: internalScore, confidence: scoreLabel(internalScore), room: r.room, date: palaceDate });
    }
  } catch { /* palace may not be initialized */ }

  // Journal search (copy existing logic from lines 334-363)
  try {
    const journalResults = await journalSearch({ query, project, include_palace: false, limit: Math.ceil(limit * 1.5) });
    for (const r of journalResults.results) {
      const title = `${r.date} / ${r.section}`;
      const id = stableId("journal", title);
      const days = daysSince(r.date);
      const recency = ebbinghaus(days, EBBINGHAUS_S.journal);
      const exactness = keywordExactness(query, r.excerpt);
      const internalScore = recency * 0.50 + exactness * 0.50;
      journalItems.push({ id, source: "journal", title, excerpt: r.excerpt, score: internalScore, confidence: scoreLabel(internalScore), date: r.date });
    }
  } catch { /* journal may not exist */ }

  // Insight search (copy existing logic from lines 369-398)
  try {
    const insightResults = await recallInsight({ context: query, limit: limit * 2, include_awareness: false });
    const maxRelevance = Math.max(1, ...insightResults.matching_insights.map((i) => i.relevance));
    for (const i of insightResults.matching_insights) {
      const id = stableId("insight", i.title);
      const relevance = i.relevance / maxRelevance;
      const exactness = keywordExactness(query, i.title);
      const confirmation = Math.min(1.0, Math.log2(i.confirmed + 1) / 3);
      const internalScore = relevance * 0.40 + exactness * 0.35 + confirmation * 0.25;
      const rawExcerpt = `[${i.severity}] ${i.applies_when.join(", ")}`;
      insightItems.push({ id, source: "insight", title: i.title, excerpt: rawExcerpt.length > 300 ? rawExcerpt.slice(0, 300) + "..." : rawExcerpt, score: internalScore, confidence: scoreLabel(internalScore), severity: i.severity });
    }
  } catch { /* insights may be empty */ }

  // RRF merge
  palaceItems.sort((a, b) => b.score - a.score);
  journalItems.sort((a, b) => b.score - a.score);
  insightItems.sort((a, b) => b.score - a.score);

  const rrfMap = new Map<string, { score: number; item: SmartRecallResultItem }>();
  applyRRF(palaceItems, rrfMap);
  applyRRF(journalItems, rrfMap);
  applyRRF(insightItems, rrfMap);

  // Hot-window recency boost
  for (const entry of rrfMap.values()) {
    if (entry.item.date) {
      const hoursAgo = (Date.now() - new Date(entry.item.date).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 6) entry.score *= 3.0;
      else if (hoursAgo < 24) entry.score *= 2.0;
      else if (hoursAgo < 72) entry.score *= 1.3;
    }
  }

  // Dedup
  const seen = new Set<string>();
  const deduped: SmartRecallResultItem[] = [];
  for (const { score, item } of rrfMap.values()) {
    const key = item.excerpt.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...item, score, confidence: scoreLabel(score) });
  }

  deduped.sort((a, b) => b.score - a.score);
  return deduped.slice(0, limit);
}
```

- [ ] **Step 2: Modify smartRecall to use RecallBackend**

Replace the body of `smartRecall()` (lines 278-470) with:

```typescript
export async function smartRecall(input: SmartRecallInput): Promise<SmartRecallResult> {
  // Process feedback first
  const feedbackLog = (input.feedback && input.feedback.length > 0)
    ? processFeedback(input.feedback, input.query)
    : readFeedbackLog();

  const limit = input.limit ?? 10;
  const queryWords = expandQuery(input.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

  // Use configured backend (Supabase or Local)
  const { getRecallBackend } = await import("./recall-backend.js");
  const backend = getRecallBackend();
  const results = await backend.search(input.query, input.project, limit);

  // Apply Beta feedback multiplier (shared across all backends)
  for (const item of results) {
    const { positives, negatives } = getFeedbackCounts(item.id, item.title, queryWords, feedbackLog);
    if (positives > 0 || negatives > 0) {
      const multiplier = betaUtility(positives, negatives) * 2;
      item.score *= multiplier;
      item.confidence = scoreLabel(item.score);
    }
  }

  // Re-sort after feedback adjustment
  results.sort((a, b) => b.score - a.score);

  return {
    query: input.query,
    results: results.slice(0, limit),
    total_searched: results.length,
    sources_queried: [...new Set(results.map((r) => r.source))],
  };
}
```

- [ ] **Step 3: Run existing tests to verify no regression**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/smart-recall.test.mjs`
Expected: PASS (all existing tests still pass)

- [ ] **Step 4: Run full test suite**

Run: `cd ~/Projects/AgentRecall/packages/core && node --test test/*.test.mjs`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools-logic/smart-recall.ts
git commit -m "refactor: extract localRecallSearch, route through RecallBackend"
```

---

### Task 8: SupabaseRecallBackend

**Files:**
- Create: `packages/core/src/supabase/recall-backend.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// packages/core/src/supabase/recall-backend.ts
import type { RecallBackend } from "../tools-logic/recall-backend.js";
import type { SmartRecallResultItem } from "../tools-logic/smart-recall.js";
import { getSupabaseClient } from "./client.js";
import { createEmbeddingProvider, type EmbeddingProvider } from "./embedding.js";
import type { SupabaseConfig } from "./config.js";

/** RRF constant (same as local backend). */
const RRF_K = 60;

function scoreLabel(score: number): string {
  if (score >= 0.10) return "high";
  if (score >= 0.05) return "medium";
  if (score >= 0.03) return "low";
  return "weak";
}

export class SupabaseRecallBackend implements RecallBackend {
  private config: SupabaseConfig;
  private embedding: EmbeddingProvider | null;

  constructor(config: SupabaseConfig) {
    this.config = config;
    this.embedding = config.embedding_api_key
      ? createEmbeddingProvider(config.embedding_provider, config.embedding_api_key)
      : null;
  }

  available(): boolean {
    return !!getSupabaseClient() && !!this.embedding;
  }

  async search(
    query: string,
    project: string | undefined,
    limit: number
  ): Promise<SmartRecallResultItem[]> {
    const client = getSupabaseClient();
    if (!client || !this.embedding || !project) {
      // Fallback to local
      const { localRecallSearch } = await import("../tools-logic/smart-recall.js");
      return localRecallSearch(query, project, limit);
    }

    const queryEmbedding = await this.embedding.embed(query);

    // Three parallel queries
    const [semanticResults, insightResults, ftsResults] = await Promise.all([
      // 1. pgvector cosine similarity on ar_entries
      client.rpc("ar_semantic_search", {
        query_embedding: queryEmbedding,
        match_project: project,
        match_limit: limit * 2,
      }),
      // 2. pgvector on ar_insights (cross-project)
      client.rpc("ar_insight_search", {
        query_embedding: queryEmbedding,
        match_limit: limit,
      }),
      // 3. PostgreSQL FTS (keyword backup)
      client
        .from("ar_entries")
        .select("id, project, store, room, slug, title, body, tags, metadata")
        .eq("project", project)
        .textSearch("body", query.split(/\s+/).join(" & "), { type: "plain" })
        .limit(limit),
    ]);

    // Convert to SmartRecallResultItem and rank per source
    const semanticItems: SmartRecallResultItem[] = (semanticResults.data ?? []).map(
      (r: { id: string; store: string; room: string | null; slug: string; title: string; body: string; similarity: number }) => ({
        id: r.id,
        source: (r.store === "journal" ? "journal" : "palace") as "palace" | "journal" | "insight",
        title: r.title ?? r.slug,
        excerpt: (r.body ?? "").slice(0, 300),
        score: r.similarity,
        confidence: scoreLabel(r.similarity),
        room: r.room ?? undefined,
      })
    );

    const insightItemsList: SmartRecallResultItem[] = (insightResults.data ?? []).map(
      (r: { id: string; title: string; severity: string; confirmed: number; similarity: number }) => ({
        id: r.id,
        source: "insight" as const,
        title: r.title,
        excerpt: `[${r.severity}] confirmed ${r.confirmed}x`,
        score: r.similarity,
        confidence: scoreLabel(r.similarity),
        severity: r.severity,
      })
    );

    const ftsItems: SmartRecallResultItem[] = (ftsResults.data ?? []).map(
      (r: { id: string; store: string; room: string | null; slug: string; title: string; body: string }, idx: number) => ({
        id: r.id,
        source: (r.store === "journal" ? "journal" : "palace") as "palace" | "journal" | "insight",
        title: r.title ?? r.slug,
        excerpt: (r.body ?? "").slice(0, 300),
        score: 1 / (idx + 1), // rank-based score for RRF
        confidence: scoreLabel(1 / (idx + 1)),
        room: r.room ?? undefined,
      })
    );

    // RRF merge across all three
    semanticItems.sort((a, b) => b.score - a.score);
    insightItemsList.sort((a, b) => b.score - a.score);
    ftsItems.sort((a, b) => b.score - a.score);

    const rrfMap = new Map<string, { score: number; item: SmartRecallResultItem }>();

    for (const [items] of [[semanticItems], [insightItemsList], [ftsItems]]) {
      (items as SmartRecallResultItem[]).forEach((item, idx) => {
        const rank = idx + 1;
        const contribution = 1 / (RRF_K + rank);
        const existing = rrfMap.get(item.id);
        if (existing) {
          existing.score += contribution;
        } else {
          rrfMap.set(item.id, { score: contribution, item });
        }
      });
    }

    // Dedup and sort
    const seen = new Set<string>();
    const deduped: SmartRecallResultItem[] = [];
    for (const { score, item } of rrfMap.values()) {
      const key = item.excerpt.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({ ...item, score, confidence: scoreLabel(score) });
    }

    deduped.sort((a, b) => b.score - a.score);
    return deduped.slice(0, limit);
  }
}
```

- [ ] **Step 2: Export from barrel**

Add to `packages/core/src/index.ts`:
```typescript
// Supabase — recall backend
export { SupabaseRecallBackend } from "./supabase/recall-backend.js";
```

- [ ] **Step 3: Build to verify**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/supabase/recall-backend.ts packages/core/src/index.ts
git commit -m "feat: add SupabaseRecallBackend (pgvector + FTS + RRF)"
```

---

### Task 9: Wire Sync Hooks into Write Paths

**Files:**
- Modify: `packages/core/src/tools-logic/journal-write.ts`
- Modify: `packages/core/src/tools-logic/palace-write.ts`
- Modify: `packages/core/src/palace/awareness.ts`
- Modify: `packages/core/src/tools-logic/digest-store.ts`

- [ ] **Step 1: Add sync hook to journal-write.ts**

At the top of `packages/core/src/tools-logic/journal-write.ts`, add import:
```typescript
import { syncToSupabase } from "../supabase/sync.js";
```

At the end of the `journalWrite` function, just before `return`, add:
```typescript
  // Async sync to Supabase (non-blocking)
  syncToSupabase(filePath, updated, slug, "journal");
```

- [ ] **Step 2: Add sync hook to palace-write.ts**

At the top of `packages/core/src/tools-logic/palace-write.ts`, add import:
```typescript
import { syncToSupabase } from "../supabase/sync.js";
```

After the file is written (after the `fs.writeFileSync` or `fs.appendFileSync` call for the target file), add:
```typescript
  // Async sync to Supabase (non-blocking)
  const writtenContent = fs.readFileSync(targetFile, "utf-8");
  syncToSupabase(targetFile, writtenContent, slug, "palace", input.room);
```

- [ ] **Step 3: Add sync hook to awareness.ts**

At the top of `packages/core/src/palace/awareness.ts`, add import:
```typescript
import { syncToSupabase } from "../supabase/sync.js";
```

At the end of `writeAwareness()`, after `fs.writeFileSync`, add:
```typescript
    // Async sync to Supabase (non-blocking)
    const written = fs.readFileSync(p, "utf-8");
    syncToSupabase(p, written, "global", "awareness");
```

- [ ] **Step 4: Add sync hook to digest-store.ts**

Read `packages/core/src/tools-logic/digest-store.ts` to find the write location, then add at the top:
```typescript
import { syncToSupabase } from "../supabase/sync.js";
```

After the digest file is written, add:
```typescript
  syncToSupabase(digestFilePath, content, project, "digest");
```

- [ ] **Step 5: Build and run full test suite**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/*.test.mjs`
Expected: All tests pass (sync is fire-and-forget, no Supabase in test = no-op)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tools-logic/journal-write.ts packages/core/src/tools-logic/palace-write.ts packages/core/src/palace/awareness.ts packages/core/src/tools-logic/digest-store.ts
git commit -m "feat: wire sync hooks into all write paths"
```

---

### Task 10: CLI Setup Command

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Add setup supabase command**

In `packages/cli/src/index.ts`, add a new case in the command dispatcher (after the existing commands):

```typescript
  } else if (command === "setup" && rest[0] === "supabase") {
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    output("AgentRecall Supabase Setup\n");

    const url = await ask("Supabase URL (https://xxx.supabase.co): ");
    const key = await ask("Supabase anon key: ");
    const embeddingProvider = await ask("Embedding provider (openai/voyage) [openai]: ") || "openai";
    const embeddingKey = await ask(`${embeddingProvider === "voyage" ? "Voyage" : "OpenAI"} API key: `);

    rl.close();

    const { writeSupabaseConfig } = await import("agent-recall-core");
    writeSupabaseConfig({
      supabase_url: url.trim(),
      supabase_anon_key: key.trim(),
      embedding_provider: embeddingProvider.trim() as "openai" | "voyage",
      embedding_api_key: embeddingKey.trim(),
      sync_enabled: true,
    });

    output("\nConfig saved to ~/.agent-recall/config.json");
    output("Run migration.sql in your Supabase SQL editor to create tables.");
    output("Backfill will start automatically on next session_start.\n");
```

- [ ] **Step 2: Add setup to help text**

In the `printHelp()` function, add:
```
SETUP:
  ar setup supabase              — Configure Supabase for semantic recall
```

- [ ] **Step 3: Build and verify**

Run: `cd ~/Projects/AgentRecall/packages/cli && npm run build`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat: add 'ar setup supabase' CLI command"
```

---

### Task 11: Auto-Backfill on Session Start

**Files:**
- Modify: `packages/core/src/tools-logic/session-start.ts`

- [ ] **Step 1: Add auto-backfill trigger**

At the top of `packages/core/src/tools-logic/session-start.ts`, add:
```typescript
import { readSupabaseConfig } from "../supabase/config.js";
import { backfill } from "../supabase/sync.js";
import { getRoot } from "../types.js";
```

At the end of `sessionStart()`, before the return statement, add:
```typescript
  // Trigger backfill if Supabase is configured and there are unsynced files
  // Runs in background — does not block session_start
  const sbConfig = readSupabaseConfig();
  if (sbConfig) {
    setImmediate(() => {
      void autoBackfill(slug);
    });
  }
```

Add the helper function:
```typescript
async function autoBackfill(project: string): Promise<void> {
  try {
    const root = getRoot();
    const projectDir = path.join(root, "projects", project);
    if (!fs.existsSync(projectDir)) return;

    const files: Array<{ path: string; content: string; store: "journal" | "palace" | "awareness" | "digest"; room?: string }> = [];

    // Scan journal
    const jDir = path.join(projectDir, "journal");
    if (fs.existsSync(jDir)) {
      for (const f of fs.readdirSync(jDir).filter((f) => f.endsWith(".md"))) {
        const fp = path.join(jDir, f);
        files.push({ path: fp, content: fs.readFileSync(fp, "utf-8"), store: "journal" });
      }
    }

    // Scan palace rooms
    const roomsDir = path.join(projectDir, "palace", "rooms");
    if (fs.existsSync(roomsDir)) {
      for (const room of fs.readdirSync(roomsDir)) {
        const roomPath = path.join(roomsDir, room);
        if (!fs.statSync(roomPath).isDirectory()) continue;
        for (const f of fs.readdirSync(roomPath).filter((f) => f.endsWith(".md"))) {
          const fp = path.join(roomPath, f);
          files.push({ path: fp, content: fs.readFileSync(fp, "utf-8"), store: "palace", room });
        }
      }
    }

    if (files.length > 0) {
      await backfill(project, files);
    }
  } catch {
    // Silent — backfill failure must not break session_start
  }
}
```

- [ ] **Step 2: Build and run tests**

Run: `cd ~/Projects/AgentRecall/packages/core && npm run build && node --test test/*.test.mjs`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/tools-logic/session-start.ts
git commit -m "feat: auto-backfill on session_start when Supabase configured"
```

---

### Task 12: Integration Test + Build Verification

**Files:**
- Modify: `packages/core/test/smart-recall.test.mjs`

- [ ] **Step 1: Add backend selection test**

Append to `packages/core/test/smart-recall.test.mjs`:

```javascript
describe("RecallBackend selection", () => {
  it("uses LocalRecallBackend when no Supabase config", async () => {
    const { setRoot } = await import("agent-recall-core");
    const { getRecallBackend, LocalRecallBackend } = await import("agent-recall-core");
    const tmpDir = (await import("node:fs")).mkdtempSync(
      (await import("node:path")).join((await import("node:os")).tmpdir(), "ar-sel-")
    );
    setRoot(tmpDir);
    const backend = getRecallBackend();
    assert.ok(backend instanceof LocalRecallBackend);
    (await import("node:fs")).rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Full build across all packages**

Run:
```bash
cd ~/Projects/AgentRecall
cd packages/core && npm run build
cd ../mcp-server && npm run build
cd ../sdk && npm run build
cd ../cli && npm run build
```
Expected: 0 errors across all 4 packages

- [ ] **Step 3: Full test suite**

Run: `cd ~/Projects/AgentRecall/packages/core && node --test test/*.test.mjs`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/core/test/smart-recall.test.mjs
git commit -m "test: add backend selection tests, verify full build"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Config module | `supabase/config.ts` + test |
| 2 | Supabase client singleton | `supabase/client.ts` |
| 3 | Embedding providers | `supabase/embedding.ts` + test |
| 4 | Migration SQL | `migration.sql` |
| 5 | Sync pipeline | `supabase/sync.ts` + test |
| 6 | RecallBackend interface | `tools-logic/recall-backend.ts` + test |
| 7 | Refactor smart-recall.ts | Modify `smart-recall.ts` |
| 8 | SupabaseRecallBackend | `supabase/recall-backend.ts` |
| 9 | Wire sync hooks | Modify 4 write-path files |
| 10 | CLI setup command | Modify `cli/src/index.ts` |
| 11 | Auto-backfill on session start | Modify `session-start.ts` |
| 12 | Integration test + build | Modify tests, verify build |

**Total new files:** 7
**Total modified files:** 8
**Estimated commits:** 12
