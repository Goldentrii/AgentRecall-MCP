import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * export-corrections.test.mjs — the vendor-neutral, fail-closed-scrubbed export
 * of active corrections (backlog #1). The export is the single supported egress
 * contract for external memory backends (Hindsight/Mem0/Zep) — so it must:
 *   1. emit a stable, versioned schema (schema_version + confidence_basis);
 *   2. scrub rule/context/tags through a FAIL-CLOSED scrub (unlike scrubForCloud,
 *      which is fail-open) — a surviving secret aborts the export, never leaks;
 *   3. default to ACTIVE-only (never teach an external store a retracted belief);
 *   4. honor --since and per-project / all-project selection.
 */

let core;
let typesMod;
let corr;
let guard;
let TEST_ROOT;

const PROJECT = "export-proj";

function writeCorrectionFile(root, slug, rec) {
  const dir = path.join(root, "projects", slug, "corrections");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${rec.id}.json`), JSON.stringify(rec), "utf-8");
}

describe("export-corrections (vendor-neutral fail-closed correction export)", () => {
  beforeEach(async () => {
    TEST_ROOT = path.join(os.tmpdir(), "ar-export-" + process.pid + "-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;

    typesMod = await import("../dist/types.js");
    typesMod.resetRoot();
    typesMod.setRoot(TEST_ROOT);

    core = await import("../dist/tools-logic/export-corrections.js");
    corr = await import("../dist/storage/corrections.js");
    guard = await import("../dist/storage/content-guard.js");

    // 2 active + 1 retracted, plus one whose context quotes a (fake) AWS key.
    writeCorrectionFile(TEST_ROOT, PROJECT, {
      id: "2026-05-12-no-push", date: "2026-05-12", severity: "p0", project: PROJECT,
      rule: "Never push without explicit human approval.", context: "Agent pushed unasked.",
      tags: ["git", "redline"], weight: 1.0, active: true, kind: "correction",
      recurrence_count: 2, heeded_count: 3,
    });
    writeCorrectionFile(TEST_ROOT, PROJECT, {
      id: "2026-04-01-old-rule", date: "2026-04-01", severity: "p1", project: PROJECT,
      rule: "An older but still active rule about naming.", context: "ctx",
      tags: ["style"], weight: 0.6, active: true, kind: "correction",
    });
    writeCorrectionFile(TEST_ROOT, PROJECT, {
      id: "2026-04-30-retracted", date: "2026-04-30", severity: "p1", project: PROJECT,
      rule: "A retracted rule.", context: "ctx", tags: [], active: false, kind: "correction",
    });
  });

  afterEach(() => {
    typesMod.resetRoot();
    delete process.env.AGENT_RECALL_ROOT;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("emits a stable versioned schema with confidence_basis on every row", () => {
    const rows = core.exportCorrections({ project: PROJECT });
    assert.ok(rows.length >= 1);
    for (const r of rows) {
      assert.equal(r.schema_version, core.CORRECTION_EXPORT_SCHEMA_VERSION);
      assert.equal(r.confidence_basis, "authority-weight");
      assert.ok(typeof r.id === "string" && r.id.length > 0);
      assert.ok("rule" in r && "context" in r && Array.isArray(r.tags));
    }
  });

  it("defaults to ACTIVE-only — the retracted record is excluded", () => {
    const rows = core.exportCorrections({ project: PROJECT });
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes("2026-05-12-no-push"));
    assert.ok(!ids.includes("2026-04-30-retracted"), "retracted record must not be exported by default");
  });

  it("includeRetracted:true brings the retracted record back", () => {
    const rows = core.exportCorrections({ project: PROJECT, includeRetracted: true });
    assert.ok(rows.map((r) => r.id).includes("2026-04-30-retracted"));
  });

  it("--since filters by date (inclusive lower bound)", () => {
    const rows = core.exportCorrections({ project: PROJECT, since: "2026-05-01" });
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes("2026-05-12-no-push"));
    assert.ok(!ids.includes("2026-04-01-old-rule"), "pre-since record excluded");
  });

  it("a secret-bearing record is exported with the secret REDACTED (no key shape survives)", () => {
    // A record whose context holds a real AWS-key shape. The export redacts it;
    // the row must contain NO 'AKIA…' shape. (This is the normal path — redaction,
    // not the fail-closed throw, which is a defense-in-depth guard; see below.)
    writeCorrectionFile(TEST_ROOT, PROJECT, {
      id: "2026-05-20-secret", date: "2026-05-20", severity: "p1", project: PROJECT,
      rule: "Do not hardcode keys.", context: "leaked AKIAIOSFODNN7EXAMPLE in config",
      tags: ["security", "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], active: true, kind: "correction",
    });
    const rows = core.exportCorrections({ project: PROJECT });
    const row = rows.find((r) => r.id === "2026-05-20-secret");
    assert.ok(row, "the secret-bearing record is still exported (after redaction)");
    const blob = JSON.stringify(row);
    assert.ok(!/AKIA[0-9A-Z]{16}/.test(blob), "no AWS key shape survives into the export");
    assert.ok(!/ghp_[A-Za-z0-9]{20}/.test(blob), "no GitHub token shape survives (tags are scrubbed too)");
  });

  it("scrubForExport: clean passes unchanged; a secret is redacted, never emitted", () => {
    // Clean content is returned verbatim.
    assert.equal(guard.scrubForExport("totally clean text"), "totally clean text");
    // A real secret is REDACTED by the underlying scrub → returns cleanly, secret gone.
    const out = guard.scrubForExport("token ghp_" + "a".repeat(36) + " end");
    assert.ok(!out.includes("ghp_a"), "secret redacted out of the export string");
    // SecretScanError is a proper typed Error subclass callers can catch.
    const e = new guard.SecretScanError("AWS access key");
    assert.ok(e instanceof Error && e.name === "SecretScanError" && /AWS access key/.test(e.message));
    // NOTE: scrubForExport's THROW branch is a fail-closed defense-in-depth guard
    // that fires only if scrubForCloud regresses to fail-open (returns content a
    // secret pattern still matches). Under the current scrub contract a successful
    // redaction leaves no residue, so the throw is unreachable via normal string
    // input and is intentionally not asserted here (it would require mocking
    // scrubForCloud to return unredacted content).
  });

  it("project omitted → exports across all projects", () => {
    writeCorrectionFile(TEST_ROOT, "other-proj", {
      id: "2026-05-15-other", date: "2026-05-15", severity: "p1", project: "other-proj",
      rule: "A rule in another project.", context: "ctx", tags: [], active: true, kind: "correction",
    });
    const rows = core.exportCorrections();
    const projects = new Set(rows.map((r) => r.project));
    assert.ok(projects.has(PROJECT) && projects.has("other-proj"), "all projects exported");
  });
});
