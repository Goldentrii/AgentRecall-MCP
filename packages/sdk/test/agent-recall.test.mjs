import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TEST_ROOT = path.join(os.tmpdir(), "ar-sdk-test-" + Date.now());

describe("AgentRecall SDK", () => {
  let AgentRecall;
  let ar;

  before(async () => {
    const sdk = await import("../dist/index.js");
    AgentRecall = sdk.AgentRecall;
    ar = new AgentRecall({ root: TEST_ROOT, project: "sdk-test" });
  });

  after(async () => {
    const { resetRoot } = await import("agent-recall-core");
    resetRoot();
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("constructor sets root and project", () => {
    assert.ok(ar instanceof AgentRecall);
  });

  it("capture creates a Q&A entry", async () => {
    const result = await ar.capture("What is Redis?", "An in-memory data store");
    assert.equal(result.success, true);
    assert.equal(result.entry_number, 1);
  });

  it("journalWrite creates an entry", async () => {
    const result = await ar.journalWrite("## Brief\nSDK test entry\n");
    assert.equal(result.success, true);
    assert.ok(result.date);
  });

  it("journalRead reads the latest entry", async () => {
    const result = await ar.journalRead();
    assert.ok(result.content.includes("SDK test"));
  });

  it("journalList returns entries", async () => {
    const result = await ar.journalList();
    assert.ok(result.entries.length >= 1);
  });

  it("journalSearch finds content", async () => {
    const result = await ar.journalSearch("SDK test");
    assert.ok(result.results.length > 0);
  });

  it("state write and read", async () => {
    await ar.state("write", JSON.stringify({ completed: [{ task: "test", result: "pass" }] }));
    const state = await ar.state("read");
    assert.ok(state);
  });

  it("palaceWrite creates a room and memory", async () => {
    const result = await ar.palaceWrite("test-room", "This is a test memory", { importance: "high" });
    assert.equal(result.success, true);
    assert.equal(result.room, "test-room");
  });

  it("palaceRead lists rooms", async () => {
    const result = await ar.palaceRead();
    assert.ok(result.rooms);
    assert.ok(result.rooms.some(r => r.slug === "test-room"));
  });

  it("palaceRead reads specific room", async () => {
    const result = await ar.palaceRead("test-room");
    assert.ok(result.content);
    assert.ok(result.content.includes("test memory"));
  });

  it("walk returns context", async () => {
    const result = await ar.walk("identity");
    assert.ok(result.content);
    assert.equal(result.depth, "identity");
  });

  it("palaceSearch finds content", async () => {
    const result = await ar.palaceSearch("test memory");
    assert.ok(result.results.length > 0);
  });

  it("lint returns health report", async () => {
    const result = await ar.lint();
    assert.ok(typeof result.total_issues === "number");
  });

  it("awarenessUpdate adds insights", async () => {
    const result = await ar.awarenessUpdate([{
      title: "SDK testing is fast",
      evidence: "All tests pass in <1s",
      applies_when: ["testing", "sdk"],
      source: "sdk-test",
      severity: "important",
    }], { identity: "test user" });
    assert.equal(result.success, true);
  });

  it("readAwareness returns markdown", () => {
    const content = ar.readAwareness();
    assert.ok(content.includes("Awareness"));
  });

  it("recallInsight returns insights", async () => {
    const result = await ar.recallInsight("testing SDK");
    assert.ok(typeof result.total_in_index === "number");
  });

  it("projects lists tracked projects", async () => {
    const result = await ar.projects();
    assert.ok(result.projects.some(p => p.slug === "sdk-test"));
  });

  it("coldStart returns palace-first context", async () => {
    const result = await ar.coldStart();
    assert.ok(result.palace_context);
    assert.equal(result.project, "sdk-test");
  });

  it("palace low-level access works", () => {
    const rooms = ar.palace.listRooms();
    assert.ok(rooms.length >= 1);
    assert.ok(ar.palace.roomExists("test-room"));
  });

  it("synthesize generates context", async () => {
    const result = await ar.synthesize();
    assert.ok(result.synthesis.includes("L3 Synthesis"));
  });

  it("archive with high threshold archives nothing", async () => {
    const result = await ar.archive(9999);
    assert.equal(result.archived, 0);
  });

  it("rollup dry run previews", async () => {
    const result = await ar.rollup({ dryRun: true, minAgeDays: 0, minEntries: 1 });
    assert.equal(result.dry_run, true);
  });

  it("alignmentCheck records alignment", async () => {
    const result = await ar.alignmentCheck({ goal: "Test SDK alignment", confidence: "high" });
    assert.equal(result.success, true);
    assert.ok(result.file);
  });

  it("nudge records contradiction", async () => {
    const result = await ar.nudge({
      past_statement: "Use Redis",
      current_statement: "Use Postgres",
      question: "Changed requirements?",
    });
    assert.equal(result.success, true);
  });

  it("knowledgeWrite creates a lesson", async () => {
    const result = await ar.knowledgeWrite({
      category: "testing",
      title: "Test lesson",
      what_happened: "Something happened",
      root_cause: "Root cause",
      fix: "The fix",
    });
    assert.equal(result.success, true);
  });

  it("knowledgeRead returns lessons", async () => {
    const result = await ar.knowledgeRead({ category: "testing" });
    assert.ok(result.includes("Test lesson"));
  });

  it("readAwarenessState returns structured state", () => {
    const state = ar.readAwarenessState();
    assert.ok(state);
    assert.ok(Array.isArray(state.topInsights));
  });

  it("graph accessor exposes graph functions", () => {
    assert.ok(typeof ar.graph.readGraph === "function");
    assert.ok(typeof ar.graph.addEdge === "function");
    assert.ok(typeof ar.graph.getConnectedRooms === "function");
  });
});
