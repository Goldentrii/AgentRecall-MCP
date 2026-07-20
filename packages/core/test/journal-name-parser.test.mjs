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

// ── naming-v2 spec §3: sig/theme OMITTED when absent (not printed as "none") ──

test("v2: parses name with BOTH sig and theme present (5 parts, same shape as current-gen)", () => {
  const r = parseJournalFileName("2026-07-20--arsave--critical--publish-gate--v3437-npm-publish.md");
  assert.equal(r.isLegacy, false);
  assert.equal(r.date, "2026-07-20");
  assert.equal(r.saveType, "arsave");
  assert.equal(r.sig, "critical");
  assert.equal(r.theme, "publish-gate");
  assert.equal(r.slug, "v3437-npm-publish");
});

test("v2: parses name with sig ONLY (4 parts, enum-anchored)", () => {
  const r = parseJournalFileName("2026-07-20--arsave--critical--fixed-dream-cron.md");
  assert.equal(r.isLegacy, false);
  assert.equal(r.date, "2026-07-20");
  assert.equal(r.saveType, "arsave");
  assert.equal(r.sig, "critical");
  assert.equal(r.theme, null);
  assert.equal(r.slug, "fixed-dream-cron");
});

test("v2: parses name with theme ONLY (4 parts, enum-anchored)", () => {
  const r = parseJournalFileName("2026-07-20--hook-end--publish-gate--fixed-dream-cron.md");
  assert.equal(r.isLegacy, false);
  assert.equal(r.date, "2026-07-20");
  assert.equal(r.saveType, "hook-end");
  assert.equal(r.sig, null);
  assert.equal(r.theme, "publish-gate");
  assert.equal(r.slug, "fixed-dream-cron");
});

test("v2: parses name with NEITHER sig nor theme (3 parts)", () => {
  const r = parseJournalFileName("2026-07-20--arsave--fixed-dream-cron.md");
  assert.equal(r.isLegacy, false);
  assert.equal(r.date, "2026-07-20");
  assert.equal(r.saveType, "arsave");
  assert.equal(r.sig, null);
  assert.equal(r.theme, null);
  assert.equal(r.slug, "fixed-dream-cron");
});

test("all 3 pre-v2 generations still parse byte-identically", () => {
  // Legacy bare date
  const legacy = parseJournalFileName("2026-04-20.md");
  assert.deepEqual(legacy, { date: "2026-04-20", saveType: null, sig: null, theme: null, slug: null, isLegacy: true });

  // Old format with NL marker
  const old = parseJournalFileName("2026-04-20--arsave--12L--genome-review.md");
  assert.deepEqual(old, { date: "2026-04-20", saveType: "arsave", sig: null, theme: null, slug: "genome-review", isLegacy: true });

  // Current 5-part format
  const current = parseJournalFileName("2026-05-04--arsave--shipped--version-bump--v341-release.md");
  assert.deepEqual(current, { date: "2026-05-04", saveType: "arsave", sig: "shipped", theme: "version-bump", slug: "v341-release", isLegacy: false });
});
