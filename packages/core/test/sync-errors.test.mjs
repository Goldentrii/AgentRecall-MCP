import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { logSyncError } from "agent-recall-core";

describe("sync error logging", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ar-test-"));
  const recallRoot = path.join(tmpRoot, ".agent-recall");
  const origRecallRoot = process.env.AGENT_RECALL_ROOT;

  before(() => { process.env.AGENT_RECALL_ROOT = recallRoot; });
  after(() => {
    if (origRecallRoot === undefined) delete process.env.AGENT_RECALL_ROOT;
    else process.env.AGENT_RECALL_ROOT = origRecallRoot;
    fs.rmSync(tmpRoot, { recursive: true });
  });

  it("writes error line to sync-errors.log", () => {
    logSyncError("test error message");
    const logPath = path.join(recallRoot, "sync-errors.log");
    assert.ok(fs.existsSync(logPath), "log file should exist");
    const content = fs.readFileSync(logPath, "utf-8");
    assert.ok(content.includes("test error message"), "log should contain the error");
    assert.ok(content.match(/\d{4}-\d{2}-\d{2}T/), "log should include ISO timestamp");
  });

  it("caps log at 500 lines", () => {
    for (let i = 0; i < 510; i++) logSyncError(`line ${i}`);
    const logPath = path.join(recallRoot, "sync-errors.log");
    const lines = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
    assert.ok(lines.length <= 500, `log should be capped at 500 lines, got ${lines.length}`);
  });
});
