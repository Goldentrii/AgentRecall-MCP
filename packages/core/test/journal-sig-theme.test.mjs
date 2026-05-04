import { test } from "node:test";
import assert from "node:assert/strict";

const { autoClassifySig, autoClassifyTheme } = await import("../dist/index.js");

test("autoClassifySig: shipped", () => {
  assert.equal(autoClassifySig("Published to npm. v3.4.1 shipped."), "shipped");
});

test("autoClassifySig: blocked", () => {
  assert.equal(autoClassifySig("Blockers: SERP endpoint 404."), "blocked");
});

test("autoClassifySig: milestone", () => {
  assert.equal(autoClassifySig("Feature complete. v3.4.1 shipped."), "milestone");
});

test("autoClassifySig: recovery", () => {
  assert.equal(autoClassifySig("Resolved the sync issue. Unblocked after fixing the import path."), "recovery");
});

test("autoClassifySig: default minor", () => {
  assert.equal(autoClassifySig("Did some work today."), "minor");
});

test("autoClassifyTheme: silent-failure", () => {
  assert.equal(autoClassifyTheme("The agent had been failing silently for 4 nights."), "silent-failure");
});

test("autoClassifyTheme: version-bump", () => {
  assert.equal(autoClassifyTheme("Bumped to v3.4.1 and published."), "version-bump");
});

test("autoClassifyTheme: agent-fix", () => {
  assert.equal(autoClassifyTheme("Updated dream-prompt to include rollup step."), "agent-fix");
});

test("autoClassifyTheme: default none", () => {
  assert.equal(autoClassifyTheme("Routine session today."), "none");
});

test("autoClassifySig: critical", () => {
  assert.equal(autoClassifySig("A critical bug was found causing data loss."), "critical");
});

test("autoClassifySig: audit", () => {
  assert.equal(autoClassifySig("Loop 1 complete. Scored 7/10 on quality."), "audit");
});

test("autoClassifySig: decision", () => {
  assert.equal(autoClassifySig("Decisions: chose pgvector over keyword search."), "decision");
});

test("autoClassifySig: research", () => {
  assert.equal(autoClassifySig("Research phase: gathered information on competitors."), "research");
});

test("autoClassifyTheme: cross-project (3+ project names)", () => {
  // Uses agentrecall, novada-web, aam — avoids "mcp" which triggers mcp-unavailable first
  assert.equal(
    autoClassifyTheme("agentrecall and novada-web and aam all affected by this change."),
    "cross-project"
  );
});
