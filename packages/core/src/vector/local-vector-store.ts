/**
 * Local vector store backed by vectra (pure TypeScript, stores as JSON files).
 * Index location: ~/.agent-recall/projects/<slug>/vector-index/
 */

import { LocalIndex } from "vectra";
import { projectSubPath } from "../storage/paths.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VectorItem {
  id: string;
  source: "palace" | "journal" | "insight";
  title: string;
  excerpt: string;
}

type VectorMetadata = VectorItem & Record<string, string | number | boolean>;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Returns the vector index folder path for a project.
 * Stored at: ~/.agent-recall/projects/<slug>/vector-index/
 */
export function vectorIndexPath(project: string): string {
  // F2 fix (independent review, 2026-07-20): was a local naive sanitizer with
  // no existing-dir reuse — routes through paths.ts's projectSubPath so the
  // vector index lives alongside journal/palace for the SAME resolved dir.
  return projectSubPath(project, "vector-index");
}

// ---------------------------------------------------------------------------
// Index cache (one instance per project path within the process)
// ---------------------------------------------------------------------------

const _indexCache = new Map<string, LocalIndex<VectorMetadata>>();

function getIndex(project: string): LocalIndex<VectorMetadata> {
  const indexDir = vectorIndexPath(project);
  const cached = _indexCache.get(indexDir);
  if (cached) return cached;
  const index = new LocalIndex<VectorMetadata>(indexDir);
  _indexCache.set(indexDir, index);
  return index;
}

async function ensureIndex(project: string): Promise<LocalIndex<VectorMetadata>> {
  const index = getIndex(project);
  const exists = await index.isIndexCreated();
  if (!exists) {
    await index.createIndex({ version: 1 });
  }
  return index;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert or replace a vector item in the project's local index.
 * Fire-and-forget safe — errors are swallowed by the caller.
 */
export async function upsertVector(
  project: string,
  item: VectorItem,
  embedding: number[]
): Promise<void> {
  const index = await ensureIndex(project);
  await index.upsertItem({
    id: item.id,
    vector: embedding,
    metadata: item as VectorMetadata,
  });
}

/**
 * Query the project's local vector index for the top-k nearest items.
 * Returns an empty array when the index does not exist or is empty.
 */
export async function queryVector(
  project: string,
  embedding: number[],
  topK: number
): Promise<Array<VectorItem & { score: number }>> {
  const index = getIndex(project);

  const exists = await index.isIndexCreated();
  if (!exists) return [];

  const results = await index.queryItems(embedding, "", topK);
  return results.map((r) => ({
    id: r.item.metadata.id,
    source: r.item.metadata.source,
    title: r.item.metadata.title,
    excerpt: r.item.metadata.excerpt,
    score: r.score,
  }));
}
