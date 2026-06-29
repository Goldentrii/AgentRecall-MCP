/**
 * corrections-supersede.test.mjs — P2 supersession on contradiction.
 * A new correction that contradicts an existing one on a key-value fact is
 * detected; suggest-only by default; retracts with superseded_by under auto.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";

import { writeCorrection, readCorrections, readActiveCorrections } from "../dist/storage/corrections.js";
import { detectCorrectionConflicts, reviewSupersessions } from "../dist/tools-logic/supersession.js";

let testRoot;
const OLD = "Always set env = production for deploys";
const NEW = "Always set env = staging for deploys";

beforeEach(() => {
  testRoot = path.join(tmpdir(), `ar-sup-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(testRoot, { recursive: true });
  process.env.AGENT_RECALL_ROOT = testRoot;
});
afterEach(() => {
  delete process.env.AGENT_RECALL_ROOT;
  delete process.env.AR_CONSOLIDATE_AUTO;
  fs.rmSync(testRoot, { recursive: true, force: true });
});

function seed() {
  writeCorrection("p", { id: "old", date: "2026-05-19", severity: "p0", project: "p", rule: OLD, context: "", tags: [] });
  writeCorrection("p", { id: "new", date: "2026-05-20", severity: "p0", project: "p", rule: NEW, context: "", tags: [] });
}

describe("P2 supersession", () => {
  it("detects a key-value contradiction between two corrections", () => {
    seed();
    const matches = detectCorrectionConflicts("p", { id: "new", rule: NEW });
    assert.ok(matches.some((m) => m.existingId === "old"), "should flag the contradicting older rule");
  });

  it("suggest-only by default: nothing retracted", () => {
    seed();
    const r = reviewSupersessions("p", { id: "new", rule: NEW });
    assert.equal(r.auto, false);
    assert.ok(r.suggestions.length >= 1);
    assert.equal(r.superseded.length, 0);
    assert.equal(readActiveCorrections("p").length, 2, "default must not mutate");
  });

  it("auto retracts the contradicted rule and sets superseded_by", () => {
    seed();
    const r = reviewSupersessions("p", { id: "new", rule: NEW }, { auto: true });
    assert.deepEqual(r.superseded, ["old"]);
    const old = readCorrections("p").find((x) => x.id === "old");
    assert.equal(old.active, false);
    assert.equal(old.superseded_by, "new");
    assert.equal(readActiveCorrections("p").length, 1);
  });

  it("two unrelated corrections produce no supersession", () => {
    writeCorrection("p", { id: "a", date: "2026-05-19", severity: "p0", project: "p", rule: "Never commit secrets to git", context: "", tags: [] });
    writeCorrection("p", { id: "b", date: "2026-05-20", severity: "p1", project: "p", rule: "Prefer functional React components", context: "", tags: [] });
    assert.equal(detectCorrectionConflicts("p", { id: "b", rule: "Prefer functional React components" }).length, 0);
  });
});
