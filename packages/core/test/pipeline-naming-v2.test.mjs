/**
 * pipeline-naming-v2.test.mjs
 *
 * Naming System v2 (Wave 1) — palace/pipeline/ store: new writes use
 * "{NNNN}--{slug}.md" (double-dash); listMilestones/parseMilestoneFile must
 * still read pre-existing "{NNNN}-{slug}.md" (single-dash) files untouched.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TEST_ROOT = path.join(os.tmpdir(), "ar-pipeline-naming-v2-test-" + Date.now());

describe("pipeline naming v2 — dual delimiter", () => {
  let pipeline;
  const PROJECT = "pipeline-v2-proj";

  before(async () => {
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;
    pipeline = await import("../dist/palace/pipeline.js");
  });

  after(() => {
    delete process.env.AGENT_RECALL_ROOT;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("milestoneFileName produces the v2 double-dash form", () => {
    const name = pipeline.milestoneFileName(7, "RD-1 cross-project recurrence");
    assert.equal(name, "0007--rd-1-cross-project-recurrence.md");
  });

  it("writeMilestone + listMilestones round-trips a new (double-dash) file", () => {
    pipeline.writeMilestone(
      PROJECT,
      { phase: "New phase", order: 1, status: "active", opened: new Date().toISOString() },
      { goal: "g", what_was_hard: "h", how_solved: "s", synthesis: "sy" },
    );
    const list = pipeline.listMilestones(PROJECT);
    assert.equal(list.length, 1);
    assert.equal(list[0].meta.phase, "New phase");
    assert.ok(path.basename(list[0].file_path).includes("--"));
  });

  it("listMilestones + parseMilestoneFile still read a LEGACY single-dash file", () => {
    const dir = pipeline.pipelineDir(PROJECT);
    fs.mkdirSync(dir, { recursive: true });
    const legacyPath = path.join(dir, "0002-legacy-phase.md");
    fs.writeFileSync(
      legacyPath,
      `---\nphase: "Legacy phase"\norder: 2\nstatus: "closed"\nopened: "2026-01-01T00:00:00.000Z"\nclosed: "2026-01-02T00:00:00.000Z"\n---\n\n# Phase 0002 — Legacy phase\n\n## Goal\ng\n\n## What was hard\nh\n\n## How solved\ns\n\n## Synthesis\nsy\n`,
      "utf-8",
    );

    const list = pipeline.listMilestones(PROJECT);
    const legacy = list.find((m) => m.meta.phase === "Legacy phase");
    assert.ok(legacy, "legacy single-dash file should be listed");
    assert.equal(legacy.meta.order, 2);
    assert.equal(legacy.meta.status, "closed");

    const parsed = pipeline.parseMilestoneFile(legacyPath);
    assert.equal(parsed.meta.order, 2);
    assert.equal(parsed.sections.synthesis, "sy");
  });

  it("nextOrder is correct across mixed legacy + v2 files", () => {
    // From the two prior tests: order 1 (v2, double-dash) and order 2 (legacy,
    // single-dash) already exist on disk.
    assert.equal(pipeline.nextOrder(PROJECT), 3);
  });
});
