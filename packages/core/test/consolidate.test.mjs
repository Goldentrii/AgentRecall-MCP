import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

describe("consolidate helpers", () => {
  let isTechnicalBrief;
  let formatTechnicalBrief;

  before(async () => {
    const mod = await import("../dist/palace/consolidate.js");
    isTechnicalBrief = mod.isTechnicalBrief;
    formatTechnicalBrief = mod.formatTechnicalBrief;
  });

  describe("isTechnicalBrief", () => {
    it("returns false for simple briefs", () => {
      assert.equal(isTechnicalBrief("Fixed a bug. Deployed."), false);
    });

    it("returns true for briefs with 3+ **Phase N patterns", () => {
      const brief =
        "**Phase 1 — Research:** did X\n**Phase 2 — Build:** did Y\n**Phase 3 — Test:** did Z";
      assert.equal(isTechnicalBrief(brief), true);
    });

    it("returns false for only 2 phases", () => {
      const brief = "**Phase 1 — A:** x\n**Phase 2 — B:** y";
      assert.equal(isTechnicalBrief(brief), false);
    });

    it("returns true for bare Phase N (word boundary) patterns", () => {
      const brief = "Phase 1 setup\nPhase 2 coding\nPhase 3 testing";
      assert.equal(isTechnicalBrief(brief), true);
    });

    it("returns true for ## Phase N patterns", () => {
      const brief = "## Phase 1\nwork\n## Phase 2\nmore\n## Phase 3\ndone";
      assert.equal(isTechnicalBrief(brief), true);
    });
  });

  describe("formatTechnicalBrief", () => {
    it("includes a Phases summary list", () => {
      const brief =
        "**Phase 1 — Research:** did X\n**Phase 2 — Build:** did Y\n**Phase 3 — Test:** did Z";
      const result = formatTechnicalBrief(brief);
      assert.ok(result.includes("**Phases:**"), "should contain Phases header");
      assert.ok(result.includes("Phase 1: Research"), "should contain Phase 1 title");
      assert.ok(result.includes("Phase 2: Build"), "should contain Phase 2 title");
    });

    it("includes Full brief label and original content", () => {
      const brief =
        "**Phase 1 — Research:** did X\n**Phase 2 — Build:** did Y\n**Phase 3 — Test:** did Z";
      const result = formatTechnicalBrief(brief);
      assert.ok(result.includes("**Full brief:**"), "should contain Full brief label");
      assert.ok(result.includes("did X"), "should contain original brief content");
    });

    it("preserves up to 6000 chars of brief content", () => {
      const brief = "**Phase 1 — A:** " + "x".repeat(7000);
      const result = formatTechnicalBrief(brief);
      // summary header + 6000 content chars; allow some slack for summary text
      assert.ok(
        result.length <= 6200,
        `result length ${result.length} exceeds 6200`
      );
    });

    it("omits Phases header when no Phase N — Title patterns present", () => {
      const brief = "Phase 1 done\nPhase 2 done\nPhase 3 done";
      const result = formatTechnicalBrief(brief);
      assert.ok(!result.includes("**Phases:**"), "should not have Phases header when no titles");
      assert.ok(result.includes("Phase 1 done"), "should include content");
    });

    it("content portion does not exceed 6000 chars", () => {
      const longBrief =
        "**Phase 1 — A:** start\n**Phase 2 — B:** mid\n**Phase 3 — C:** end\n" +
        "y".repeat(8000);
      const result = formatTechnicalBrief(longBrief);
      const marker = "**Full brief:**\n";
      const markerIdx = result.indexOf(marker);
      const contentPart = markerIdx >= 0 ? result.slice(markerIdx + marker.length) : result;
      assert.ok(
        contentPart.length <= 6000,
        `content part length ${contentPart.length} exceeds 6000`
      );
    });
  });
});
