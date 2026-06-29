/**
 * corrections-rank.test.mjs — P5 local ranking for capped surfacing.
 * severity (p0 first) dominates; within a tier, higher proof_confidence wins;
 * limit slices.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankCorrections } from "../dist/storage/corrections.js";

const rec = (over) => ({
  id: "x", date: "2026-05-19", severity: "p1", project: "p", rule: "r", context: "", tags: [], ...over,
});

describe("P5 rankCorrections", () => {
  it("p0 ranks above p1 regardless of confidence", () => {
    const out = rankCorrections([
      rec({ id: "p1hi", severity: "p1", proof_confidence: 0.99 }),
      rec({ id: "p0lo", severity: "p0", proof_confidence: 0.1 }),
    ]);
    assert.equal(out[0].id, "p0lo");
  });

  it("within a severity tier, higher proof_confidence ranks first", () => {
    const out = rankCorrections([
      rec({ id: "lo", severity: "p0", proof_confidence: 0.5 }),
      rec({ id: "hi", severity: "p0", proof_confidence: 0.9 }),
    ]);
    assert.equal(out[0].id, "hi");
  });

  it("limit slices the ranked list", () => {
    const out = rankCorrections([rec({ id: "a" }), rec({ id: "b" }), rec({ id: "c" })], 2);
    assert.equal(out.length, 2);
  });

  it("does not mutate the input array", () => {
    const input = [rec({ id: "a", severity: "p1" }), rec({ id: "b", severity: "p0" })];
    const before = input.map((r) => r.id);
    rankCorrections(input);
    assert.deepEqual(input.map((r) => r.id), before);
  });
});
