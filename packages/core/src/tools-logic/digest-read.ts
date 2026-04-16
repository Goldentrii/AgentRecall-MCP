/**
 * Tool logic: read full content of a specific digest.
 */

import { resolveProject } from "../storage/project.js";
import { readDigest as readDigestFromStore, recordAccess } from "../digest/store.js";
import type { DigestReadInput, DigestReadResult } from "../digest/types.js";

export type { DigestReadInput, DigestReadResult };

export async function digestRead(input: DigestReadInput): Promise<DigestReadResult> {
  const project = await resolveProject(input.project ?? "auto");

  // Try project-scoped first
  let result = readDigestFromStore(project, input.digest_id, false);
  if (result.meta) {
    recordAccess(project, input.digest_id, false);
    return { success: true, ...result };
  }

  // Try global
  result = readDigestFromStore(project, input.digest_id, true);
  if (result.meta) {
    recordAccess("__global__", input.digest_id, true);
    return { success: true, ...result };
  }

  return { success: false, meta: null, content: null };
}
