/**
 * agent-recall-core — shared business logic for AgentRecall.
 *
 * All types, palace operations, storage utilities, and helper functions
 * are re-exported from this barrel.
 */

// Types & constants
export {
  VERSION,
  SECTION_HEADERS,
  DEFAULT_PALACE_ROOMS,
  setRoot,
  resetRoot,
  getRoot,
  getLegacyRoot,
} from "./types.js";
export type {
  JournalEntry,
  ProjectInfo,
  SessionState,
  RoomMeta,
  PalaceIndex,
  GraphEdge,
  PalaceGraph,
  Importance,
  Confidence,
  WalkDepth,
} from "./types.js";

// Palace — rooms
export {
  createRoom,
  getRoomMeta,
  updateRoomMeta,
  listRooms,
  roomExists,
  ensurePalaceInitialized,
  recordAccess,
} from "./palace/rooms.js";

// Palace — graph
export {
  readGraph,
  writeGraph,
  addEdge,
  removeEdgesFor,
  getConnectionCount,
  getConnectedRooms,
} from "./palace/graph.js";

// Palace — fan-out
export { fanOut } from "./palace/fan-out.js";
export type { FanOutResult } from "./palace/fan-out.js";

// Palace — awareness
export {
  readAwareness,
  writeAwareness,
  readAwarenessState,
  writeAwarenessState,
  initAwareness,
  addInsight,
  detectCompoundInsights,
  renderAwareness,
} from "./palace/awareness.js";
export type {
  Insight,
  CompoundInsight,
  AwarenessState,
} from "./palace/awareness.js";

// Palace — salience
export {
  computeSalience,
  ARCHIVE_THRESHOLD,
  AUTO_ARCHIVE_THRESHOLD,
} from "./palace/salience.js";

// Palace — insights index
export {
  readInsightsIndex,
  writeInsightsIndex,
  addIndexedInsight,
  recallInsights,
} from "./palace/insights-index.js";
export type {
  IndexedInsight,
  InsightsIndex,
} from "./palace/insights-index.js";

// Palace — identity
export { readIdentity, writeIdentity } from "./palace/identity.js";

// Palace — index manager
export { readPalaceIndex, updatePalaceIndex } from "./palace/index-manager.js";

// Palace — obsidian
export {
  extractWikilinks,
  addBackReference,
  generateFrontmatter,
  roomReadmeContent,
} from "./palace/obsidian.js";

// Palace — log
export { appendToLog } from "./palace/log.js";

// Palace — consolidate
export { consolidateJournalToPalace } from "./palace/consolidate.js";
export type { ConsolidationResult } from "./palace/consolidate.js";

// Storage
export { journalDir, journalDirs, palaceDir, roomDir } from "./storage/paths.js";
export { ensureDir, todayISO, readJsonSafe, writeJsonAtomic } from "./storage/fs-utils.js";
export { detectProject, resolveProject, listAllProjects } from "./storage/project.js";

// Helpers
export {
  listJournalFiles,
  readJournalFile,
  extractTitle,
  extractMomentum,
  countLogEntries,
  updateIndex,
} from "./helpers/journal-files.js";
export { extractSection, appendToSection } from "./helpers/sections.js";

// Helpers — rollup
export { isoWeek, weekKey, groupByWeek, synthesizeWeek } from "./helpers/rollup.js";

// Tool logic functions (extracted from MCP tool handlers)
export { journalRead, type JournalReadInput, type JournalReadResult } from "./tools-logic/journal-read.js";
export { journalWrite, type JournalWriteInput, type JournalWriteResult } from "./tools-logic/journal-write.js";
export { journalCapture, type JournalCaptureInput, type JournalCaptureResult } from "./tools-logic/journal-capture.js";
export { journalList, type JournalListInput, type JournalListResult } from "./tools-logic/journal-list.js";
export { journalProjects, type JournalProjectsResult } from "./tools-logic/journal-projects.js";
export { journalSearch, type JournalSearchInput, type JournalSearchResult } from "./tools-logic/journal-search.js";
export { journalState, stateFilePath, readState, type JournalStateInput, type JournalStateResult } from "./tools-logic/journal-state.js";
export { journalColdStart, type JournalColdStartInput, type JournalColdStartResult } from "./tools-logic/journal-cold-start.js";
export { journalArchive, type JournalArchiveInput, type JournalArchiveResult } from "./tools-logic/journal-archive.js";
export { journalRollup, type JournalRollupInput, type JournalRollupResult } from "./tools-logic/journal-rollup.js";
export { alignmentCheck, type AlignmentCheckInput, type AlignmentCheckResult } from "./tools-logic/alignment-check.js";
export { nudge, type NudgeInput, type NudgeResult } from "./tools-logic/nudge.js";
export { contextSynthesize, type ContextSynthesizeInput, type ContextSynthesizeResult } from "./tools-logic/context-synthesize.js";
export { knowledgeWrite, type KnowledgeWriteInput, type KnowledgeWriteResult } from "./tools-logic/knowledge-write.js";
export { knowledgeRead, type KnowledgeReadInput } from "./tools-logic/knowledge-read.js";
export { palaceRead, type PalaceReadInput, type PalaceReadResult } from "./tools-logic/palace-read.js";
export { palaceWrite, type PalaceWriteInput, type PalaceWriteResult } from "./tools-logic/palace-write.js";
export { palaceWalk, roomSummary, readRoomContent, type PalaceWalkInput, type PalaceWalkResult } from "./tools-logic/palace-walk.js";
export { palaceLint, type PalaceLintInput, type PalaceLintResult, type LintIssue } from "./tools-logic/palace-lint.js";
export { palaceSearch, type PalaceSearchInput, type PalaceSearchResult } from "./tools-logic/palace-search.js";
export { awarenessUpdate, type AwarenessUpdateInput, type AwarenessUpdateResult } from "./tools-logic/awareness-update.js";
export { recallInsight, type RecallInsightInput, type RecallInsightResult } from "./tools-logic/recall-insight.js";
