/**
 * Shared types, interfaces, and constants for agent-recall-mcp.
 */

import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VERSION = "3.3.1";

export const JOURNAL_ROOT =
  process.env.AGENT_RECALL_ROOT || path.join(os.homedir(), ".agent-recall");

export const LEGACY_ROOT = path.join(os.homedir(), ".claude", "projects");

export const SECTION_HEADERS: Record<string, string> = {
  brief: "## Brief",
  qa: "## Q&A Log",
  completed: "## Completed",
  status: "## Status",
  blockers: "## Blockers",
  next: "## Next",
  decisions: "## Decisions",
  reflection: "## Reflection",
  files: "## Files Changed",
  observations: "## Observations",
};

export const DEFAULT_PALACE_ROOMS = [
  { slug: "goals", name: "Goals", description: "Active goals, completed goals, goal evolution", tags: ["planning"] },
  { slug: "architecture", name: "Architecture", description: "Technical decisions, patterns, tech stack", tags: ["technical"] },
  { slug: "blockers", name: "Blockers", description: "Current and resolved blockers", tags: ["status"] },
  { slug: "alignment", name: "Alignment", description: "Frequently misunderstood areas, human corrections", tags: ["communication"] },
  { slug: "knowledge", name: "Knowledge", description: "Learned lessons by category", tags: ["learning"] },
] as const;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface JournalEntry {
  date: string;
  file: string;
  dir: string;
}

export interface ProjectInfo {
  slug: string;
  lastEntry: string;
  entryCount: number;
}

export interface SessionState {
  version: string;
  date: string;
  project: string;
  timestamp: string;
  completed: Array<{ task: string; result: string; files_changed?: string[] }>;
  failures: Array<{ task: string; what_went_wrong: string; root_cause: string; fixed: boolean }>;
  state: Record<string, { status: string; details: string }>;
  next_actions: Array<{ priority: string; task: string }>;
  insights: Array<{ claim: string; confidence: string; evidence: string }>;
  counts: Record<string, number>;
}

export interface RoomMeta {
  slug: string;
  name: string;
  description: string;
  created: string;
  updated: string;
  salience: number;
  access_count: number;
  last_accessed: string;
  tags: string[];
  connections: string[];
}

export interface PalaceIndex {
  version: string;
  project: string;
  created: string;
  rooms: Record<string, { salience: number; memory_count: number; last_updated: string }>;
  identity_hash: string;
  last_lint: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  weight: number;
  created: string;
}

export interface PalaceGraph {
  edges: GraphEdge[];
}

export type Importance = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";
export type WalkDepth = "identity" | "active" | "relevant" | "full";
