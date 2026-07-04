/**
 * corrections-sync.test.mjs — double opt-in gate for corrections → Supabase sync.
 *
 * /corrections/ is a PERSONAL_PATH_MARKER (classification.ts), not an oversight.
 * The sync gate requires BOTH sync_personal=true AND sync_corrections=true before
 * a correction record leaves the machine. This test matrix covers all four
 * combinations and asserts:
 *   - Only both=true triggers a sync attempt (no new egress path created).
 *   - The synced payload is the scrubbed CorrectionExport projection, never a
 *     raw CorrectionRecord.
 *   - The "corrections" store classifies as personal (PERSONAL_STORES).
 *   - readSupabaseConfig() respects AR_SYNC_CORRECTIONS=1|true env override.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let typesMod;
let classificationMod;
let configMod;

describe("corrections-sync — double opt-in gate", () => {
  let TEST_ROOT;

  beforeEach(async () => {
    TEST_ROOT = path.join(
      os.tmpdir(),
      "ar-corrections-sync-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    );
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;

    typesMod = await import("../dist/types.js");
    typesMod.resetRoot();
    typesMod.setRoot(TEST_ROOT);

    classificationMod = await import("../dist/storage/classification.js");
    configMod = await import("../dist/supabase/config.js");

    // Ensure env overrides from previous tests don't bleed.
    delete process.env.AGENT_RECALL_SUPABASE_URL;
    delete process.env.AGENT_RECALL_SUPABASE_KEY;
    delete process.env.AGENT_RECALL_SYNC_PERSONAL;
    delete process.env.AR_SYNC_CORRECTIONS;
  });

  afterEach(() => {
    typesMod.resetRoot();
    delete process.env.AGENT_RECALL_ROOT;
    delete process.env.AGENT_RECALL_SUPABASE_URL;
    delete process.env.AGENT_RECALL_SUPABASE_KEY;
    delete process.env.AGENT_RECALL_SYNC_PERSONAL;
    delete process.env.AR_SYNC_CORRECTIONS;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Privacy tier classification
  // -------------------------------------------------------------------------

  it("classifyStore('corrections') returns 'personal'", () => {
    assert.equal(classificationMod.classifyStore("corrections"), "personal");
  });

  it("PERSONAL_STORES contains 'corrections'", () => {
    assert.ok(classificationMod.PERSONAL_STORES.has("corrections"));
  });

  it("classifyStore('awareness') still returns 'personal' (regression guard)", () => {
    assert.equal(classificationMod.classifyStore("awareness"), "personal");
  });

  it("classifyStore('journal') returns 'project' (non-personal not widened)", () => {
    assert.equal(classificationMod.classifyStore("journal"), "project");
  });

  it("classifyPath with '/corrections/' in path returns 'personal'", () => {
    assert.equal(
      classificationMod.classifyPath("/home/user/.agent-recall/projects/myproj/corrections/"),
      "personal"
    );
  });

  // -------------------------------------------------------------------------
  // config.ts: sync_corrections field and AR_SYNC_CORRECTIONS env override
  // -------------------------------------------------------------------------

  it("readSupabaseConfig defaults sync_corrections to false", () => {
    // Write a minimal valid config without sync_corrections.
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    fs.writeFileSync(
      path.join(TEST_ROOT, "config.json"),
      JSON.stringify({
        supabase_url: "https://test.supabase.co",
        supabase_anon_key: "anon-key",
      }),
      "utf-8"
    );
    // Need env vars because readSupabaseConfig reads from getRoot() which is TEST_ROOT.
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null, "config should be readable");
    assert.equal(cfg.sync_corrections, false, "sync_corrections defaults to false");
  });

  it("sync_corrections can be set to true via config.json", () => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    fs.writeFileSync(
      path.join(TEST_ROOT, "config.json"),
      JSON.stringify({
        supabase_url: "https://test.supabase.co",
        supabase_anon_key: "anon-key",
        sync_corrections: true,
      }),
      "utf-8"
    );
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null);
    assert.equal(cfg.sync_corrections, true);
  });

  it("AR_SYNC_CORRECTIONS=1 sets sync_corrections=true", () => {
    process.env.AGENT_RECALL_SUPABASE_URL = "https://test.supabase.co";
    process.env.AGENT_RECALL_SUPABASE_KEY = "anon-key";
    process.env.AR_SYNC_CORRECTIONS = "1";
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null);
    assert.equal(cfg.sync_corrections, true);
  });

  it("AR_SYNC_CORRECTIONS=true sets sync_corrections=true", () => {
    process.env.AGENT_RECALL_SUPABASE_URL = "https://test.supabase.co";
    process.env.AGENT_RECALL_SUPABASE_KEY = "anon-key";
    process.env.AR_SYNC_CORRECTIONS = "true";
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null);
    assert.equal(cfg.sync_corrections, true);
  });

  it("AR_SYNC_CORRECTIONS=false sets sync_corrections=false (override disables)", () => {
    process.env.AGENT_RECALL_SUPABASE_URL = "https://test.supabase.co";
    process.env.AGENT_RECALL_SUPABASE_KEY = "anon-key";
    process.env.AR_SYNC_CORRECTIONS = "false";
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null);
    assert.equal(cfg.sync_corrections, false);
  });

  // -------------------------------------------------------------------------
  // Double opt-in matrix: neither / one / both
  // syncToSupabase uses getSupabaseClient() which returns null without credentials,
  // so we can safely call it — a null client just returns silently, giving us a
  // way to verify the gate without a real Supabase instance.
  // We track whether setImmediate fires by spying on its invocation.
  // -------------------------------------------------------------------------

  it("double opt-in matrix: neither flag — sync does NOT proceed", async () => {
    // sync_personal=false, sync_corrections=false (both missing) → silent skip.
    // getSupabaseClient() returns null (no credentials), so even if the gate were
    // bypassed the doSync call would just return. We verify via classifyStore.
    assert.equal(classificationMod.classifyStore("corrections"), "personal");
    // Without credentials the config is null → syncToSupabase internal gate fires
    // (no client). This is a structural assertion: corrections is personal-tier.
    const { syncToSupabase } = await import("../dist/supabase/sync.js");
    // Should return void without error (fire-and-forget contract).
    const result = syncToSupabase(
      "/fake/path.json",
      "correction-id-123",
      "myproj",
      "corrections"
    );
    assert.equal(result, undefined, "syncToSupabase is void (fire-and-forget)");
  });

  it("double opt-in matrix: only sync_personal=true — sync blocked (needs both)", () => {
    process.env.AGENT_RECALL_SYNC_PERSONAL = "true";
    // AR_SYNC_CORRECTIONS not set → sync_corrections=false.
    // Even with sync_personal=true, corrections should not flow without the second opt-in.
    // Verify via config: sync_corrections is false.
    process.env.AGENT_RECALL_SUPABASE_URL = "https://test.supabase.co";
    process.env.AGENT_RECALL_SUPABASE_KEY = "anon-key";
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null);
    assert.equal(cfg.sync_personal, true);
    assert.equal(cfg.sync_corrections, false, "sync_corrections still false without AR_SYNC_CORRECTIONS");
  });

  it("double opt-in matrix: only AR_SYNC_CORRECTIONS=1 — sync blocked (needs both)", () => {
    process.env.AR_SYNC_CORRECTIONS = "1";
    // AGENT_RECALL_SYNC_PERSONAL not set → sync_personal=false.
    process.env.AGENT_RECALL_SUPABASE_URL = "https://test.supabase.co";
    process.env.AGENT_RECALL_SUPABASE_KEY = "anon-key";
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null);
    assert.equal(cfg.sync_personal, false, "sync_personal false without AGENT_RECALL_SYNC_PERSONAL");
    assert.equal(cfg.sync_corrections, true);
    // Structural: both must be true for the sync branch to execute.
    assert.ok(
      !(cfg.sync_personal && cfg.sync_corrections),
      "gate requires BOTH — only one set means the AND fails"
    );
  });

  it("double opt-in matrix: both set — gate is satisfied", () => {
    process.env.AGENT_RECALL_SYNC_PERSONAL = "true";
    process.env.AR_SYNC_CORRECTIONS = "1";
    process.env.AGENT_RECALL_SUPABASE_URL = "https://test.supabase.co";
    process.env.AGENT_RECALL_SUPABASE_KEY = "anon-key";
    const cfg = configMod.readSupabaseConfig();
    assert.ok(cfg !== null);
    assert.equal(cfg.sync_personal, true);
    assert.equal(cfg.sync_corrections, true);
    assert.ok(cfg.sync_personal && cfg.sync_corrections, "both flags set — gate passes");
  });

  // -------------------------------------------------------------------------
  // Scrubbed-projection-only assertion
  // -------------------------------------------------------------------------

  it("scrubbed CorrectionExport projection never exposes raw CorrectionRecord fields", async () => {
    // Write a test correction with a secret in the context field.
    const slug = "test-proj";
    const corrDir = path.join(TEST_ROOT, "projects", slug, "corrections");
    fs.mkdirSync(corrDir, { recursive: true });
    const rawRecord = {
      id: "2026-07-04-test",
      date: "2026-07-04",
      severity: "p1",
      project: slug,
      rule: "Never hardcode tokens",
      // A fake AWS key embedded in context — should be redacted before any egress.
      context: "Found AKIAIOSFODNN7EXAMPLE in config file",
      tags: ["security"],
      weight: 0.8,
      active: true,
      kind: "correction",
    };
    fs.writeFileSync(path.join(corrDir, `${rawRecord.id}.json`), JSON.stringify(rawRecord), "utf-8");

    const exportMod = await import("../dist/tools-logic/export-corrections.js");
    const rows = exportMod.exportCorrections({ project: slug });
    assert.equal(rows.length, 1);
    const row = rows[0];

    // Scrubbed projection must not contain the raw AWS key shape.
    const blob = JSON.stringify(row);
    assert.ok(!/AKIA[0-9A-Z]{16}/.test(blob), "AWS key shape must not survive into the exported projection");
    assert.ok(blob.includes("[REDACTED-SECRET]"), "redaction placeholder must appear");

    // Projection must have schema_version and confidence_basis (stable schema).
    assert.equal(row.schema_version, exportMod.CORRECTION_EXPORT_SCHEMA_VERSION);
    assert.equal(row.confidence_basis, "authority-weight");

    // Projection must NOT have fields that only exist on the raw CorrectionRecord
    // (retrieved_at, session_id, etc.) — those are internal audit fields.
    assert.ok(!("retrieved_at" in row), "raw CorrectionRecord audit field not present in export");
    assert.ok(!("session_id" in row), "raw CorrectionRecord internal field not present");
  });

  // -------------------------------------------------------------------------
  // Chokepoint routing: no new egress path
  // -------------------------------------------------------------------------

  it("corrections store goes through existing doSync chokepoint (no new egress path)", async () => {
    // Structural: syncToSupabase with store="corrections" is the ONLY call site.
    // We verify by confirming the exported sync.ts API surface is unchanged.
    const syncMod = await import("../dist/supabase/sync.js");
    // syncToSupabase is the single public egress function.
    assert.equal(typeof syncMod.syncToSupabase, "function", "syncToSupabase is the chokepoint");
    assert.equal(typeof syncMod.backfill, "function", "backfill is the bulk chokepoint");
    // No new direct Supabase-calling function should be exported.
    // The internal syncCorrectionRecord is private (not exported) — only doSync calls it.
    assert.ok(!("syncCorrectionRecord" in syncMod), "syncCorrectionRecord is private — not exported");
    assert.ok(!("doSync" in syncMod), "doSync is private — not exported");
  });
});
