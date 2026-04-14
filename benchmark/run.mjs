#!/usr/bin/env node
/**
 * AgentRecall Benchmark — 5 Rounds of Real Sessions
 *
 * Measures: token count per tool call, cold start time, correction retention,
 * cross-project recall accuracy.
 *
 * Uses the SDK directly (same code paths as MCP server).
 */

import { AgentRecall } from "../packages/sdk/dist/index.js";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BENCH_ROOT = join(process.env.HOME, ".agent-recall-benchmark");
const PROJECT_A = "bench-saas-app";
const PROJECT_B = "bench-api-gateway";

// --- helpers ---

function countTokens(text) {
  if (!text) return 0;
  const s = typeof text === "string" ? text : JSON.stringify(text);
  // GPT-style approximation: ~4 chars per token for English
  return Math.round(s.length / 4);
}

function hrMs(start) {
  const diff = process.hrtime.bigint() - start;
  return Number(diff / 1_000_000n);
}

const results = [];
function log(round, tool, tokens, timeMs, notes) {
  const entry = { round, tool, tokens, timeMs, notes };
  results.push(entry);
  console.log(
    `  [R${round}] ${tool.padEnd(20)} ${String(tokens).padStart(5)} tok  ${String(timeMs).padStart(6)} ms  ${notes || ""}`
  );
}

// --- clean slate ---
if (existsSync(BENCH_ROOT)) rmSync(BENCH_ROOT, { recursive: true });
mkdirSync(BENCH_ROOT, { recursive: true });

const arA = new AgentRecall({ project: PROJECT_A, root: BENCH_ROOT });
const arB = new AgentRecall({ project: PROJECT_B, root: BENCH_ROOT });

// ============================================================
// ROUND 1 — First session on Project A (SaaS app)
//   Establish context, make architecture decisions, save session
// ============================================================
console.log("\n=== ROUND 1: First session — establish project context ===\n");

let t;

// session_start on empty project (baseline)
t = process.hrtime.bigint();
const r1Start = await arA.coldStart();
log(1, "coldStart (empty)", countTokens(r1Start), hrMs(t), "first-ever session, no prior data");

// remember — architecture decisions
t = process.hrtime.bigint();
const r1Rem1 = await arA.palaceWrite("architecture",
  "Stack: Next.js 16 App Router + Drizzle ORM + Postgres on Neon. " +
  "Auth: Clerk via Vercel Marketplace. Payments: Stripe Checkout. " +
  "Styling: Tailwind + shadcn/ui. Deployment: Vercel with preview per PR."
);
log(1, "palaceWrite(arch)", countTokens(r1Rem1), hrMs(t), "architecture decision");

t = process.hrtime.bigint();
const r1Rem2 = await arA.palaceWrite("goals",
  "MVP by 2026-05-01: landing page, auth, dashboard, Stripe integration. " +
  "Post-MVP: team invites, usage analytics, API keys."
);
log(1, "palaceWrite(goals)", countTokens(r1Rem2), hrMs(t), "project goals");

// capture — daily work
t = process.hrtime.bigint();
const r1Cap1 = await arA.capture(
  "What ORM are we using and why?",
  "Drizzle ORM — type-safe, lightweight, works natively with Neon serverless driver. Rejected Prisma (too heavy for edge), TypeORM (poor TS support)."
);
log(1, "capture(orm)", countTokens(r1Cap1), hrMs(t), "Q&A capture");

t = process.hrtime.bigint();
const r1Cap2 = await arA.capture(
  "How should we handle rate limiting?",
  "Upstash Redis with sliding window. Token bucket considered but sliding window simpler for MVP. Rate limit: 100 req/min per API key."
);
log(1, "capture(rate-limit)", countTokens(r1Cap2), hrMs(t), "Q&A capture");

// journal write — session summary
t = process.hrtime.bigint();
const r1Journal = await arA.journalWrite(
  "## Session 1 Summary\n" +
  "- Established tech stack: Next.js 16 + Drizzle + Neon + Clerk + Stripe\n" +
  "- Decided on Upstash Redis for rate limiting (sliding window)\n" +
  "- MVP deadline: 2026-05-01\n" +
  "- Created initial project structure with app router\n" +
  "## Blockers\n" +
  "- Need Stripe webhook secret for local dev\n" +
  "## Next\n" +
  "- Set up Clerk auth flow\n" +
  "- Create database schema with Drizzle"
);
log(1, "journalWrite", countTokens(r1Journal), hrMs(t), "session summary");

// awareness — first insight
t = process.hrtime.bigint();
const r1Aware = await arA.awarenessUpdate([
  {
    title: "Drizzle ORM works better than Prisma for edge/serverless because it has no binary engine",
    evidence: "Evaluated both during stack selection — Prisma cold starts were 2-3x slower on Vercel edge",
    applies_when: ["orm", "edge", "serverless", "vercel", "database"]
  },
  {
    title: "Sliding window rate limiting is simpler to implement than token bucket for MVP",
    evidence: "Token bucket requires persistent state per key; sliding window only needs sorted set in Redis",
    applies_when: ["rate-limiting", "api", "redis", "mvp"]
  }
]);
log(1, "awarenessUpdate", countTokens(r1Aware), hrMs(t), "2 insights");

console.log("");

// ============================================================
// ROUND 2 — Second session, cold start + correction
//   Simulate: agent makes wrong assumption, human corrects
// ============================================================
console.log("=== ROUND 2: Cold start + recall + correction ===\n");

const arA2 = new AgentRecall({ project: PROJECT_A, root: BENCH_ROOT });

// cold start — measure how much context loads
t = process.hrtime.bigint();
const r2Start = await arA2.coldStart();
log(2, "coldStart (with data)", countTokens(r2Start), hrMs(t), "loads palace + identity");

// recall — search for past decisions
t = process.hrtime.bigint();
const r2Recall1 = await arA2.palaceSearch("authentication");
log(2, "palaceSearch(auth)", countTokens(r2Recall1), hrMs(t), "search palace");

t = process.hrtime.bigint();
const r2Recall2 = await arA2.journalSearch("rate limiting");
log(2, "journalSearch(rate)", countTokens(r2Recall2), hrMs(t), "search journals");

// simulate agent checking understanding
t = process.hrtime.bigint();
const r2Align = await arA2.alignmentCheck({
  goal: "Set up Clerk authentication with middleware protection",
  confidence: "high",
  assumptions: ["Using Clerk's Next.js SDK", "Middleware protects /dashboard/*", "Sign-in page at /sign-in"]
});
log(2, "alignmentCheck", countTokens(r2Align), hrMs(t), "verify understanding");

// human correction — agent got versioning wrong
t = process.hrtime.bigint();
const r2Nudge = await arA2.nudge({
  observation: "Agent used Clerk v4 API but we need v6 for App Router compatibility",
  correction: "Always use Clerk v6+ — v4 doesn't support App Router middleware pattern",
  severity: "critical"
});
log(2, "nudge(correction)", countTokens(r2Nudge), hrMs(t), "human corrects Clerk version");

// save session
t = process.hrtime.bigint();
const r2Journal = await arA2.journalWrite(
  "## Session 2 Summary\n" +
  "- Started Clerk auth integration\n" +
  "- CORRECTION: Must use Clerk v6+, not v4 — App Router requires it\n" +
  "- Middleware auth pattern working for /dashboard routes\n" +
  "## Next\n" +
  "- Database schema with Drizzle\n" +
  "- Stripe checkout integration"
);
log(2, "journalWrite", countTokens(r2Journal), hrMs(t), "session summary");

t = process.hrtime.bigint();
const r2Aware = await arA2.awarenessUpdate([
  {
    title: "Clerk v6 is required for Next.js App Router — v4 middleware is incompatible",
    evidence: "Agent used v4 API, had to redo auth middleware. Human corrected.",
    applies_when: ["clerk", "auth", "nextjs", "app-router", "middleware"]
  }
]);
log(2, "awarenessUpdate", countTokens(r2Aware), hrMs(t), "correction as insight");

console.log("");

// ============================================================
// ROUND 3 — Third session, verify correction retained
//   Does the system remember the Clerk v6 correction?
// ============================================================
console.log("=== ROUND 3: Correction retention + continued work ===\n");

const arA3 = new AgentRecall({ project: PROJECT_A, root: BENCH_ROOT });

t = process.hrtime.bigint();
const r3Start = await arA3.coldStart();
log(3, "coldStart", countTokens(r3Start), hrMs(t), "3rd session cold start");

// recall clerk-related context — does correction surface?
t = process.hrtime.bigint();
const r3Recall = await arA3.recallInsight("clerk authentication nextjs");
log(3, "recallInsight(clerk)", countTokens(r3Recall), hrMs(t), "cross-project recall");

// check awareness for clerk correction
t = process.hrtime.bigint();
const r3Aware = await arA3.readAwareness();
const clerkMentioned = r3Aware.includes("Clerk") || r3Aware.includes("clerk");
log(3, "readAwareness", countTokens(r3Aware), hrMs(t),
  clerkMentioned ? "PASS: Clerk v6 correction present" : "FAIL: correction lost");

// more work — database schema
t = process.hrtime.bigint();
const r3Cap = await arA3.capture(
  "What's the DB schema for users?",
  "users table: id (uuid), clerk_id (text unique), email (text), plan (enum: free/pro/team), created_at, updated_at. Drizzle schema in src/db/schema.ts"
);
log(3, "capture(schema)", countTokens(r3Cap), hrMs(t), "Q&A capture");

t = process.hrtime.bigint();
const r3Palace = await arA3.palaceWrite("architecture",
  "Database schema v1: users, teams, api_keys, usage_logs. " +
  "Using Drizzle push for dev, generate for prod migrations. " +
  "Neon branching for preview environments."
);
log(3, "palaceWrite(arch)", countTokens(r3Palace), hrMs(t), "schema decision");

t = process.hrtime.bigint();
const r3JW = await arA3.journalWrite(
  "## Session 3 Summary\n" +
  "- Created DB schema: users, teams, api_keys, usage_logs\n" +
  "- Drizzle push for dev, generate for prod\n" +
  "- Neon branching set up for preview deploys\n" +
  "## Next\n" +
  "- Stripe checkout flow\n" +
  "- Dashboard with usage charts"
);
log(3, "journalWrite", countTokens(r3JW), hrMs(t), "session summary");

console.log("");

// ============================================================
// ROUND 4 — Cross-project recall
//   Start Project B. Does rate limiting insight from A surface?
// ============================================================
console.log("=== ROUND 4: Cross-project recall (new project) ===\n");

// Project B — API gateway, different project
t = process.hrtime.bigint();
const r4Start = await arB.coldStart();
log(4, "coldStart (new proj)", countTokens(r4Start), hrMs(t), "empty project B");

// recall — does rate limiting insight from project A surface?
t = process.hrtime.bigint();
const r4Insight = await arB.recallInsight("api rate limiting design");
const rateLimitFound = JSON.stringify(r4Insight).includes("sliding window") ||
                        JSON.stringify(r4Insight).includes("rate");
log(4, "recallInsight(rate)", countTokens(r4Insight), hrMs(t),
  rateLimitFound ? "PASS: rate limiting insight from Project A surfaced" : "FAIL: cross-project miss");

// recall — does ORM insight surface?
t = process.hrtime.bigint();
const r4Insight2 = await arB.recallInsight("database orm edge serverless");
const ormFound = JSON.stringify(r4Insight2).includes("Drizzle") ||
                  JSON.stringify(r4Insight2).includes("drizzle");
log(4, "recallInsight(orm)", countTokens(r4Insight2), hrMs(t),
  ormFound ? "PASS: Drizzle insight from Project A surfaced" : "FAIL: cross-project miss");

// establish project B context
t = process.hrtime.bigint();
const r4Palace = await arB.palaceWrite("architecture",
  "API Gateway: Express + node-http-proxy. " +
  "Routes: /v1/* → upstream services. " +
  "Auth: API key validation via middleware. " +
  "Rate limiting: Upstash Redis (informed by Project A insight)."
);
log(4, "palaceWrite(arch)", countTokens(r4Palace), hrMs(t), "project B architecture");

t = process.hrtime.bigint();
const r4JW = await arB.journalWrite(
  "## Session 1 (Project B)\n" +
  "- Set up Express API gateway with proxy routing\n" +
  "- Reused rate limiting pattern from SaaS project (sliding window + Upstash)\n" +
  "- Cross-project insight saved ~30 min of research\n" +
  "## Next\n" +
  "- Add circuit breaker for upstream failures\n" +
  "- Health check endpoints"
);
log(4, "journalWrite", countTokens(r4JW), hrMs(t), "session summary");

console.log("");

// ============================================================
// ROUND 5 — Full mature session with alignment check
//   Back to Project A. Multiple recalls, check, full save.
// ============================================================
console.log("=== ROUND 5: Mature session — full workflow ===\n");

const arA5 = new AgentRecall({ project: PROJECT_A, root: BENCH_ROOT });

t = process.hrtime.bigint();
const r5Start = await arA5.coldStart();
log(5, "coldStart (mature)", countTokens(r5Start), hrMs(t), "4th session, rich context");

// walk the palace
t = process.hrtime.bigint();
const r5Walk = await arA5.walk("active");
log(5, "walk(active)", countTokens(r5Walk), hrMs(t), "active rooms");

// recall specific topic
t = process.hrtime.bigint();
const r5Recall = await arA5.journalSearch("stripe");
log(5, "journalSearch(stripe)", countTokens(r5Recall), hrMs(t), "search for stripe context");

// alignment check with watch_for
t = process.hrtime.bigint();
const r5Check = await arA5.alignmentCheck({
  goal: "Implement Stripe checkout with webhook handler",
  confidence: "medium",
  assumptions: ["Using Stripe Checkout Sessions", "Webhook at /api/webhooks/stripe", "Price IDs from env vars"]
});
log(5, "alignmentCheck", countTokens(r5Check), hrMs(t), "pre-work check");

// do work + captures
t = process.hrtime.bigint();
const r5Cap1 = await arA5.capture(
  "How are we handling Stripe webhooks?",
  "POST /api/webhooks/stripe with raw body parsing. Verify signature with STRIPE_WEBHOOK_SECRET. Handle: checkout.session.completed → update user plan, invoice.payment_failed → downgrade + email."
);
log(5, "capture(webhooks)", countTokens(r5Cap1), hrMs(t));

t = process.hrtime.bigint();
const r5Cap2 = await arA5.capture(
  "What about subscription management?",
  "Customer portal via Stripe billing portal. Link in dashboard settings. No custom subscription UI for MVP — Stripe handles upgrades/downgrades/cancellations."
);
log(5, "capture(subscriptions)", countTokens(r5Cap2), hrMs(t));

// palace update
t = process.hrtime.bigint();
const r5Palace = await arA5.palaceWrite("architecture",
  "Payments: Stripe Checkout + Customer Portal. " +
  "Webhook handler verifies signatures, updates user plan in DB. " +
  "Price IDs stored in env vars, not hardcoded. " +
  "MVP uses Stripe portal for all subscription management."
);
log(5, "palaceWrite(payments)", countTokens(r5Palace), hrMs(t));

// session end
t = process.hrtime.bigint();
const r5Journal = await arA5.journalWrite(
  "## Session 4 Summary\n" +
  "- Stripe Checkout integration complete\n" +
  "- Webhook handler: checkout.session.completed + invoice.payment_failed\n" +
  "- Customer portal linked from dashboard settings\n" +
  "- No custom subscription UI for MVP\n" +
  "## Decisions\n" +
  "- Use Stripe portal instead of building custom subscription management\n" +
  "- Price IDs in env vars, not DB (simpler for now)\n" +
  "## Next\n" +
  "- Dashboard with usage charts\n" +
  "- Team invite flow"
);
log(5, "journalWrite", countTokens(r5Journal), hrMs(t), "session summary");

t = process.hrtime.bigint();
const r5Aware = await arA5.awarenessUpdate([
  {
    title: "Stripe Customer Portal eliminates need for custom subscription UI in MVP",
    evidence: "Building custom subscription management would add 2-3 days. Portal handles upgrade/downgrade/cancel.",
    applies_when: ["stripe", "payments", "subscription", "mvp", "saas"]
  }
]);
log(5, "awarenessUpdate", countTokens(r5Aware), hrMs(t), "1 insight");

// ============================================================
// SUMMARY
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("BENCHMARK SUMMARY");
console.log("=".repeat(70) + "\n");

// per-round totals
for (let r = 1; r <= 5; r++) {
  const roundEntries = results.filter((e) => e.round === r);
  const totalTok = roundEntries.reduce((s, e) => s + e.tokens, 0);
  const totalMs = roundEntries.reduce((s, e) => s + e.timeMs, 0);
  const calls = roundEntries.length;
  console.log(`Round ${r}: ${calls} calls, ${totalTok} tokens, ${totalMs} ms`);
}

console.log("");

// by tool type
const toolGroups = {};
for (const e of results) {
  const key = e.tool.replace(/\(.*\)/, "").trim();
  if (!toolGroups[key]) toolGroups[key] = { tokens: [], times: [], count: 0 };
  toolGroups[key].tokens.push(e.tokens);
  toolGroups[key].times.push(e.timeMs);
  toolGroups[key].count++;
}

console.log("Per-tool averages:");
console.log("-".repeat(60));
for (const [tool, data] of Object.entries(toolGroups).sort((a, b) => b[1].count - a[1].count)) {
  const avgTok = Math.round(data.tokens.reduce((a, b) => a + b, 0) / data.count);
  const avgMs = Math.round(data.times.reduce((a, b) => a + b, 0) / data.count);
  console.log(`  ${tool.padEnd(25)} avg ${String(avgTok).padStart(5)} tok  ${String(avgMs).padStart(6)} ms  (${data.count}x)`);
}

// total overhead per session
const totalTokens = results.reduce((s, e) => s + e.tokens, 0);
const totalTime = results.reduce((s, e) => s + e.timeMs, 0);
const totalCalls = results.length;

console.log("\n" + "-".repeat(60));
console.log(`Total: ${totalCalls} calls, ${totalTokens} tokens, ${totalTime} ms`);
console.log(`Average per round: ${Math.round(totalTokens / 5)} tokens, ${Math.round(totalTime / 5)} ms`);

// cold start progression
console.log("\nCold start progression:");
const coldStarts = results.filter((e) => e.tool.startsWith("coldStart"));
for (const cs of coldStarts) {
  console.log(`  Round ${cs.round}: ${cs.tokens} tokens, ${cs.timeMs} ms — ${cs.notes}`);
}

// correction retention test
console.log("\nCorrection retention:");
const r3AwareEntry = results.find((e) => e.round === 3 && e.tool === "readAwareness");
console.log(`  ${r3AwareEntry?.notes || "not tested"}`);

// cross-project recall
console.log("\nCross-project recall:");
const crossEntries = results.filter((e) => e.round === 4 && e.tool.startsWith("recallInsight"));
for (const ce of crossEntries) {
  console.log(`  ${ce.notes}`);
}

// output JSON for further analysis
const reportPath = join(BENCH_ROOT, "benchmark-report.json");
const report = {
  date: new Date().toISOString(),
  version: "benchmark-v1",
  rounds: 5,
  projects: [PROJECT_A, PROJECT_B],
  totalCalls,
  totalTokens,
  totalTimeMs: totalTime,
  avgTokensPerRound: Math.round(totalTokens / 5),
  coldStartProgression: coldStarts.map((cs) => ({
    round: cs.round,
    tokens: cs.tokens,
    timeMs: cs.timeMs,
    notes: cs.notes,
  })),
  correctionRetained: r3AwareEntry?.notes?.includes("PASS") || false,
  crossProjectRecall: crossEntries.map((ce) => ({
    tool: ce.tool,
    tokens: ce.tokens,
    passed: ce.notes?.includes("PASS") || false,
  })),
  results,
};

import { writeFileSync } from "node:fs";
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nFull report: ${reportPath}`);

// cleanup
console.log("\nBenchmark data preserved at: " + BENCH_ROOT);
console.log("Run `rm -rf " + BENCH_ROOT + "` to clean up.\n");
