#!/usr/bin/env node
/**
 * AgentRecall A/B Token Comparison
 *
 * Compares: token cost WITH AgentRecall vs WITHOUT (manual context rebuild).
 *
 * Method:
 *   - "Without AR" = what a human must paste into the prompt to give the agent
 *     equivalent context. We reconstruct this from the actual knowledge stored
 *     by AR, because that IS the context the agent needs.
 *   - "With AR" = measured tool call tokens from benchmark/run.mjs.
 *   - Correction cost = tokens wasted when an agent repeats a known mistake
 *     (wrong output + human correction message + agent redo).
 *
 * Scenarios:
 *   A. Simple project (1-2 sessions, no corrections)
 *   B. Medium project (3-5 sessions, 1 correction)
 *   C. Complex project (10-20 sessions, 3+ corrections, cross-project)
 *   D. Multi-agent (3 agents on same project, handoff context)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const BENCH_ROOT = join(process.env.HOME, ".agent-recall-benchmark");

// --- helpers ---
function countTokens(text) {
  if (!text) return 0;
  const s = typeof text === "string" ? text : JSON.stringify(text);
  return Math.round(s.length / 4);
}

function readFile(path) {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

// ================================================================
// Load actual data from benchmark run
// ================================================================
const report = JSON.parse(readFile(join(BENCH_ROOT, "benchmark-report.json")));

// Actual AR overhead per round (from benchmark)
const arOverheadPerRound = {};
for (const r of report.results) {
  arOverheadPerRound[r.round] = (arOverheadPerRound[r.round] || 0) + r.tokens;
}

// Read actual stored knowledge to calculate "manual context" size
const awareness = readFile(join(BENCH_ROOT, "awareness.md"));
const awarenessTokens = countTokens(awareness);

const saasArch = readFile(join(BENCH_ROOT, "projects/bench-saas-app/palace/rooms/architecture/README.md"));
const saasGoals = readFile(join(BENCH_ROOT, "projects/bench-saas-app/palace/rooms/goals/README.md"));
const saasJournal = readFile(join(BENCH_ROOT, "projects/bench-saas-app/journal/2026-04-14.md"));
const saasLog = readFile(join(BENCH_ROOT, "projects/bench-saas-app/journal/2026-04-14-log.md"));
const saasAlignment = readFile(join(BENCH_ROOT, "projects/bench-saas-app/journal/2026-04-14-alignment.md"));
const saasIdentity = readFile(join(BENCH_ROOT, "projects/bench-saas-app/palace/identity.md"));

const gatewayArch = readFile(join(BENCH_ROOT, "projects/bench-api-gateway/palace/rooms/architecture/README.md"));
const gatewayJournal = readFile(join(BENCH_ROOT, "projects/bench-api-gateway/journal/2026-04-14.md"));

console.log("=" .repeat(70));
console.log("AGENTRECALL A/B TOKEN COMPARISON");
console.log("=" .repeat(70));
console.log(`\nData source: benchmark run (${report.date})`);
console.log(`Projects: ${report.projects.join(", ")}\n`);

// ================================================================
// Measure actual stored knowledge sizes
// ================================================================
console.log("--- Stored Knowledge Sizes (what AR accumulated) ---\n");

const knowledgePieces = {
  "Architecture decisions": countTokens(saasArch),
  "Project goals": countTokens(saasGoals),
  "Session journals (3 sessions)": countTokens(saasJournal) + countTokens(saasLog),
  "Alignment/corrections": countTokens(saasAlignment),
  "Project identity": countTokens(saasIdentity),
  "Cross-project awareness": awarenessTokens,
};

let totalKnowledge = 0;
for (const [name, tok] of Object.entries(knowledgePieces)) {
  totalKnowledge += tok;
  console.log(`  ${name.padEnd(40)} ${tok} tokens`);
}
console.log(`  ${"TOTAL stored knowledge".padEnd(40)} ${totalKnowledge} tokens`);

// ================================================================
// WITHOUT AR: What does "manual context rebuild" actually cost?
// ================================================================
console.log("\n\n--- WITHOUT AgentRecall: Manual Context Cost Model ---\n");

// A human re-explaining context types a prompt like:
// "We're building a SaaS app with Next.js 16, Drizzle, Neon, Clerk v6 (NOT v4),
//  Stripe Checkout. MVP by May 1. Last session we did DB schema. Rate limiting
//  uses sliding window on Upstash Redis. Don't use version inflation..."
//
// This is essentially the SAME information AR stores, but pasted manually.
// The cost: human typing time + tokens in the prompt.

// Conservative estimate: human re-explanation is ~70-80% the size of stored knowledge
// (humans are terser than structured markdown, but also miss things)
const HUMAN_TERSE_RATIO = 0.75;

// When a correction is NOT retained, the cost is:
// 1. Agent does wrong thing (tokens for wrong output) ≈ 300-800 tokens
// 2. Human corrects ("no, use v6 not v4") ≈ 30-50 tokens
// 3. Agent redoes the work ≈ 300-800 tokens
// Conservative: 800 tokens per missed correction
const CORRECTION_MISS_COST = 800;

// When context is NOT loaded, agent asks clarifying questions:
// "What framework?", "What database?", "What auth?"
// Each Q&A round: agent question (~50 tok) + human answer (~100 tok) + agent acknowledgment (~50 tok)
const CLARIFICATION_ROUND_COST = 200;
const AVG_CLARIFICATIONS_PER_SESSION = 2; // conservative — fresh agent asks ~2 questions

console.log("Assumptions (conservative):");
console.log(`  Human re-explanation ratio: ${HUMAN_TERSE_RATIO}x of stored knowledge`);
console.log(`  Correction miss cost: ${CORRECTION_MISS_COST} tokens (wrong output + correction + redo)`);
console.log(`  Clarification round: ${CLARIFICATION_ROUND_COST} tokens (agent asks + human answers)`);
console.log(`  Avg clarifications per cold session: ${AVG_CLARIFICATIONS_PER_SESSION}`);

// ================================================================
// SCENARIO A: Simple project (2 sessions, 0 corrections)
// ================================================================
console.log("\n\n" + "=".repeat(70));
console.log("SCENARIO A: Simple project — 2 sessions, 0 corrections");
console.log("=".repeat(70));

const scenA = {
  sessions: 2,
  corrections: 0,
  crossProject: false,
};

// Session 1: both paths are identical (establishing context)
// Session 2: AR loads context; without AR, human re-explains

// Knowledge accumulated after session 1 (subset of total)
const s1Knowledge = countTokens(saasArch) * 0.5 + countTokens(saasGoals); // partial arch + goals
const s1ManualRebuild = Math.round(s1Knowledge * HUMAN_TERSE_RATIO);

const scenA_withoutAR = {
  s1_overhead: 0,
  s2_context_rebuild: s1ManualRebuild,
  s2_clarifications: AVG_CLARIFICATIONS_PER_SESSION * CLARIFICATION_ROUND_COST,
  s2_corrections: 0,
};
scenA_withoutAR.total = scenA_withoutAR.s2_context_rebuild + scenA_withoutAR.s2_clarifications;

const scenA_withAR = {
  s1_overhead: arOverheadPerRound[1], // round 1 = first session
  s2_overhead: arOverheadPerRound[2], // round 2 = second session with cold start
};
scenA_withAR.total = scenA_withAR.s1_overhead + scenA_withAR.s2_overhead;

console.log(`\n  WITHOUT AR:`);
console.log(`    Session 1: 0 tokens (no prior context to load)`);
console.log(`    Session 2: ${scenA_withoutAR.s2_context_rebuild} tokens (manual re-explanation)`);
console.log(`             + ${scenA_withoutAR.s2_clarifications} tokens (${AVG_CLARIFICATIONS_PER_SESSION} clarification rounds)`);
console.log(`    TOTAL:     ${scenA_withoutAR.total} tokens\n`);

console.log(`  WITH AR:`);
console.log(`    Session 1: ${scenA_withAR.s1_overhead} tokens (writes: palace + journal + awareness)`);
console.log(`    Session 2: ${scenA_withAR.s2_overhead} tokens (cold start + recalls + writes)`);
console.log(`    TOTAL:     ${scenA_withAR.total} tokens\n`);

const scenA_delta = scenA_withoutAR.total - scenA_withAR.total;
const scenA_pct = Math.round((scenA_delta / scenA_withoutAR.total) * 100);
console.log(`  DELTA: ${scenA_delta > 0 ? "AR saves" : "AR costs"} ${Math.abs(scenA_delta)} tokens (${scenA_delta > 0 ? "-" : "+"}${Math.abs(scenA_pct)}%)`);
console.log(`  VERDICT: ${scenA_pct > 0 ? "AR is cheaper" : scenA_pct < -30 ? "AR is overhead" : "roughly break-even"}`);

// ================================================================
// SCENARIO B: Medium project (5 sessions, 1 correction)
// ================================================================
console.log("\n\n" + "=".repeat(70));
console.log("SCENARIO B: Medium project — 5 sessions, 1 correction");
console.log("=".repeat(70));

// Without AR: each session after #1 needs context rebuild
// Context grows each session as more decisions are made
// Correction in session 2 is forgotten → repeated in session 3, 4, 5

const sessionKnowledge = [
  0,                                // session 1: no prior context
  Math.round(s1Knowledge * HUMAN_TERSE_RATIO), // session 2: rebuild S1 context
  Math.round(totalKnowledge * 0.4 * HUMAN_TERSE_RATIO), // session 3: more context
  Math.round(totalKnowledge * 0.6 * HUMAN_TERSE_RATIO), // session 4: growing
  Math.round(totalKnowledge * 0.8 * HUMAN_TERSE_RATIO), // session 5: most context
];

const scenB_withoutAR = {
  context_rebuilds: sessionKnowledge.reduce((a, b) => a + b, 0),
  clarifications: 4 * AVG_CLARIFICATIONS_PER_SESSION * CLARIFICATION_ROUND_COST, // sessions 2-5
  correction_repeats: 3 * CORRECTION_MISS_COST, // correction in S2, repeated in S3, S4, S5
};
scenB_withoutAR.total = scenB_withoutAR.context_rebuilds +
  scenB_withoutAR.clarifications + scenB_withoutAR.correction_repeats;

// With AR: overhead each session, but correction stored once
// Use actual measured overheads for rounds 1-5
const scenB_withAR = {
  total: Object.values(arOverheadPerRound).reduce((a, b) => a + b, 0),
};

console.log(`\n  WITHOUT AR:`);
console.log(`    Context rebuilds (S2-S5): ${scenB_withoutAR.context_rebuilds} tokens`);
for (let i = 1; i < sessionKnowledge.length; i++) {
  console.log(`      Session ${i + 1}: ${sessionKnowledge[i]} tokens`);
}
console.log(`    Clarifications (S2-S5):   ${scenB_withoutAR.clarifications} tokens`);
console.log(`    Correction repeats (×3):  ${scenB_withoutAR.correction_repeats} tokens`);
console.log(`    TOTAL:                    ${scenB_withoutAR.total} tokens\n`);

console.log(`  WITH AR:`);
for (let r = 1; r <= 5; r++) {
  console.log(`    Session ${r}: ${arOverheadPerRound[r]} tokens`);
}
console.log(`    TOTAL:     ${scenB_withAR.total} tokens\n`);

const scenB_delta = scenB_withoutAR.total - scenB_withAR.total;
const scenB_pct = Math.round((scenB_delta / scenB_withoutAR.total) * 100);
console.log(`  DELTA: AR saves ${scenB_delta} tokens (-${scenB_pct}%)`);

// ================================================================
// SCENARIO C: Complex project (20 sessions, 5 corrections, cross-project)
// ================================================================
console.log("\n\n" + "=".repeat(70));
console.log("SCENARIO C: Complex project — 20 sessions, 5 corrections, cross-project");
console.log("=".repeat(70));

// Without AR: context rebuild grows, eventually hits a ceiling
// (human can only paste so much — they start forgetting things too)
// Corrections pile up. Cross-project insights are completely lost.

// Context ceiling: after ~5 sessions, human re-explanation stabilizes
// at ~80% of full knowledge (they forget/skip some things)
const CONTEXT_CEILING = Math.round(totalKnowledge * HUMAN_TERSE_RATIO);

// 20 sessions: first is free, 19 need context rebuild
// First 5 sessions: context grows linearly. After that: ceiling.
let scenC_contextCost = 0;
for (let s = 2; s <= 20; s++) {
  const growth = Math.min(s / 5, 1.0); // linear growth to ceiling by session 5
  scenC_contextCost += Math.round(CONTEXT_CEILING * growth);
}

const scenC_withoutAR = {
  context_rebuilds: scenC_contextCost,
  clarifications: 19 * AVG_CLARIFICATIONS_PER_SESSION * CLARIFICATION_ROUND_COST,
  correction_repeats: 0, // calculate below
  cross_project_miss: 0, // calculate below
};

// 5 corrections: each one repeats in all subsequent sessions until human re-corrects
// Correction 1 at session 3 → repeats in S4-S20 = 17 repeats... but human re-corrects
// Realistically: each correction repeats ~3 times before human catches it again
const CORRECTION_REPEAT_RATE = 3;
scenC_withoutAR.correction_repeats = 5 * CORRECTION_REPEAT_RATE * CORRECTION_MISS_COST;

// Cross-project: 2 insights that would save research time
// Without AR: ~500 tokens per insight (agent researches from scratch)
const CROSS_PROJECT_RESEARCH_COST = 500;
scenC_withoutAR.cross_project_miss = 2 * CROSS_PROJECT_RESEARCH_COST;

scenC_withoutAR.total = scenC_withoutAR.context_rebuilds +
  scenC_withoutAR.clarifications + scenC_withoutAR.correction_repeats +
  scenC_withoutAR.cross_project_miss;

// With AR: ~876 tokens per session (measured average)
const AVG_AR_OVERHEAD = Math.round(report.totalTokens / report.rounds);
const scenC_withAR = {
  total: 20 * AVG_AR_OVERHEAD,
};

console.log(`\n  WITHOUT AR:`);
console.log(`    Context rebuilds (19 sessions):  ${scenC_withoutAR.context_rebuilds} tokens`);
console.log(`    Clarifications (19 × ${AVG_CLARIFICATIONS_PER_SESSION} × ${CLARIFICATION_ROUND_COST}):    ${scenC_withoutAR.clarifications} tokens`);
console.log(`    Correction repeats (5 × ${CORRECTION_REPEAT_RATE} × ${CORRECTION_MISS_COST}):   ${scenC_withoutAR.correction_repeats} tokens`);
console.log(`    Cross-project misses (2 × ${CROSS_PROJECT_RESEARCH_COST}):   ${scenC_withoutAR.cross_project_miss} tokens`);
console.log(`    TOTAL:                           ${scenC_withoutAR.total} tokens\n`);

console.log(`  WITH AR:`);
console.log(`    20 sessions × ${AVG_AR_OVERHEAD} avg overhead: ${scenC_withAR.total} tokens\n`);

const scenC_delta = scenC_withoutAR.total - scenC_withAR.total;
const scenC_pct = Math.round((scenC_delta / scenC_withoutAR.total) * 100);
console.log(`  DELTA: AR saves ${scenC_delta} tokens (-${scenC_pct}%)`);

// ================================================================
// SCENARIO D: Multi-agent (3 agents on same project)
// ================================================================
console.log("\n\n" + "=".repeat(70));
console.log("SCENARIO D: Multi-agent — 3 agents, 5 sessions each, shared context");
console.log("=".repeat(70));

// Without AR: EVERY agent starts cold. Human must re-explain to each.
// Worse: corrections told to Agent 1 are unknown to Agent 2 and 3.

// 3 agents × 5 sessions = 15 sessions total
// Each agent's first session: full context from human
// Each subsequent session: partial rebuild
// Cross-agent corrections: completely lost without AR

const scenD_withoutAR = {
  context_rebuilds: 0,
  clarifications: 0,
  correction_repeats: 0,
};

// Agent 1: 5 sessions (1 free, 4 rebuilds)
// Agent 2: 5 sessions (needs FULL context on session 1 from Agent 1's work + 4 rebuilds)
// Agent 3: 5 sessions (needs FULL context from Agent 1+2 + 4 rebuilds)
for (let agent = 0; agent < 3; agent++) {
  for (let s = 0; s < 5; s++) {
    if (agent === 0 && s === 0) continue; // first ever session is free
    const contextSize = Math.round(CONTEXT_CEILING * Math.min((agent * 5 + s) / 8, 1.0));
    scenD_withoutAR.context_rebuilds += contextSize;
  }
}

scenD_withoutAR.clarifications = 14 * AVG_CLARIFICATIONS_PER_SESSION * CLARIFICATION_ROUND_COST;

// 2 corrections made with Agent 1 → unknown to Agent 2 and 3
// Each repeats at least once per agent = 2 corrections × 2 agents = 4 repeats
scenD_withoutAR.correction_repeats = 4 * CORRECTION_MISS_COST;

scenD_withoutAR.total = scenD_withoutAR.context_rebuilds +
  scenD_withoutAR.clarifications + scenD_withoutAR.correction_repeats;

// With AR: all 3 agents read from same memory store
const scenD_withAR = {
  total: 15 * AVG_AR_OVERHEAD,
};

console.log(`\n  WITHOUT AR:`);
console.log(`    Context rebuilds (14 sessions, 3 agents): ${scenD_withoutAR.context_rebuilds} tokens`);
console.log(`    Clarifications (14 × ${AVG_CLARIFICATIONS_PER_SESSION} × ${CLARIFICATION_ROUND_COST}):         ${scenD_withoutAR.clarifications} tokens`);
console.log(`    Cross-agent correction misses (4 × ${CORRECTION_MISS_COST}):   ${scenD_withoutAR.correction_repeats} tokens`);
console.log(`    TOTAL:                                     ${scenD_withoutAR.total} tokens\n`);

console.log(`  WITH AR (shared memory):`);
console.log(`    15 sessions × ${AVG_AR_OVERHEAD} avg overhead: ${scenD_withAR.total} tokens\n`);

const scenD_delta = scenD_withoutAR.total - scenD_withAR.total;
const scenD_pct = Math.round((scenD_delta / scenD_withoutAR.total) * 100);
console.log(`  DELTA: AR saves ${scenD_delta} tokens (-${scenD_pct}%)`);

// ================================================================
// SUMMARY TABLE
// ================================================================
console.log("\n\n" + "=".repeat(70));
console.log("SUMMARY: Token Savings by Scenario");
console.log("=".repeat(70));
console.log("");
console.log("  Scenario                    Without AR    With AR    Saved    %");
console.log("  " + "-".repeat(66));

function row(name, without, withAR) {
  const saved = without - withAR;
  const pct = Math.round((saved / without) * 100);
  console.log(`  ${name.padEnd(30)} ${String(without).padStart(8)}  ${String(withAR).padStart(8)}  ${String(saved).padStart(7)}  ${pct > 0 ? "-" : "+"}${Math.abs(pct)}%`);
  return { name, without, withAR, saved, pct };
}

const rows = [
  row("A: Simple (2 sess, 0 corr)", scenA_withoutAR.total, scenA_withAR.total),
  row("B: Medium (5 sess, 1 corr)", scenB_withoutAR.total, scenB_withAR.total),
  row("C: Complex (20 sess, 5 corr)", scenC_withoutAR.total, scenC_withAR.total),
  row("D: Multi-agent (3×5 sess)", scenD_withoutAR.total, scenD_withAR.total),
];

console.log("\n  Key: negative % = AR saves tokens, positive % = AR costs more tokens");

console.log("\n\n" + "=".repeat(70));
console.log("BREAKDOWN: Where Do Savings Come From?");
console.log("=".repeat(70));
console.log(`
  1. CONTEXT REBUILD AVOIDANCE
     AR cold start: ~385 tokens (fixed, regardless of project size)
     Manual rebuild: scales with project complexity (${CONTEXT_CEILING} token ceiling)
     → Biggest savings in long projects where context grows

  2. CORRECTION RETENTION
     With AR: correction stored once, never repeated
     Without AR: ~${CORRECTION_MISS_COST} tokens per repeat (wrong output + correction + redo)
     → ${CORRECTION_REPEAT_RATE} repeats per correction × multiple corrections = significant

  3. CROSS-PROJECT INSIGHTS
     With AR: automatic recall from other projects (~350 tokens)
     Without AR: re-research from scratch (~${CROSS_PROJECT_RESEARCH_COST} tokens per insight)
     → Moderate savings, but compounds across many projects

  4. CLARIFICATION AVOIDANCE
     With AR: agent loads context, no questions needed
     Without AR: ~${AVG_CLARIFICATIONS_PER_SESSION} rounds × ${CLARIFICATION_ROUND_COST} tokens per session
     → Steady savings every session
`);

// Save report
const abReport = {
  date: new Date().toISOString(),
  assumptions: {
    humanTerseRatio: HUMAN_TERSE_RATIO,
    correctionMissCost: CORRECTION_MISS_COST,
    clarificationRoundCost: CLARIFICATION_ROUND_COST,
    avgClarificationsPerSession: AVG_CLARIFICATIONS_PER_SESSION,
    correctionRepeatRate: CORRECTION_REPEAT_RATE,
    crossProjectResearchCost: CROSS_PROJECT_RESEARCH_COST,
    avgAROverheadPerSession: AVG_AR_OVERHEAD,
    contextCeiling: CONTEXT_CEILING,
  },
  storedKnowledge: knowledgePieces,
  scenarios: rows,
};

import { writeFileSync } from "node:fs";
writeFileSync(join(BENCH_ROOT, "ab-comparison-report.json"), JSON.stringify(abReport, null, 2));
console.log(`Full A/B report: ${BENCH_ROOT}/ab-comparison-report.json`);
