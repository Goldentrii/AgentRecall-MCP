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
