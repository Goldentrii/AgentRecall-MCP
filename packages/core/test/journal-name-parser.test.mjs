import { test } from "node:test";
import assert from "node:assert/strict";

const { parseJournalFileName } = await import("../dist/index.js");

test("parses legacy YYYY-MM-DD.md", () => {
  const r = parseJournalFileName("2026-04-20.md");
  assert.equal(r.isLegacy, true);
  assert.equal(r.date, "2026-04-20");
  assert.equal(r.sig, null);
  assert.equal(r.theme, null);
});

test("parses old format with lines", () => {
  const r = parseJournalFileName("2026-04-20--arsave--12L--genome-review.md");
  assert.equal(r.isLegacy, true);
  assert.equal(r.date, "2026-04-20");
  assert.equal(r.saveType, "arsave");
  assert.equal(r.sig, null);
  assert.equal(r.slug, "genome-review");
});

test("parses new format", () => {
  const r = parseJournalFileName("2026-05-04--arsave--shipped--version-bump--v341-release.md");
  assert.equal(r.isLegacy, false);
  assert.equal(r.date, "2026-05-04");
  assert.equal(r.saveType, "arsave");
  assert.equal(r.sig, "shipped");
  assert.equal(r.theme, "version-bump");
  assert.equal(r.slug, "v341-release");
});

test("parses legacy session-id variant", () => {
  const r = parseJournalFileName("2026-04-20-abc123.md");
  assert.equal(r.isLegacy, true);
  assert.equal(r.date, "2026-04-20");
});

test("parses new format with none/none tags", () => {
  const r = parseJournalFileName("2026-05-04--hook-end--none--none--genome-review.md");
  assert.equal(r.isLegacy, false);
  assert.equal(r.saveType, "hook-end");
  assert.equal(r.sig, "none");
  assert.equal(r.theme, "none");
  assert.equal(r.slug, "genome-review");
});
