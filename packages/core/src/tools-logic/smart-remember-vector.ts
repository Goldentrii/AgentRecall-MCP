/**
 * Fire-and-forget vector indexing helper for smart-remember.
 * Imported dynamically so the vector machinery is never loaded in the main
 * save path when OPENAI_API_KEY is absent.
 */

import { embed } from "../vector/embedding.js";
import { upsertVector, type VectorItem } from "../vector/local-vector-store.js";

/**
 * Embed content and upsert into the project's local vector index.
 * Silently swallows all errors — caller must never await this.
 */
export async function indexRemembered(
  project: string,
  id: string,
  source: "palace" | "journal" | "insight",
  title: string,
  excerpt: string,
  content: string
): Promise<void> {
  const embedding = await embed(content);
  if (!embedding) return;

  const item: VectorItem = { id, source, title, excerpt };
  await upsertVector(project, item, embedding);
}
