// packages/core/test/recall-backend.test.mjs
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("RecallBackend interface", () => {
  it("LocalRecallBackend is always available", async () => {
    const { LocalRecallBackend } = await import("agent-recall-core");
    const backend = new LocalRecallBackend();
    assert.equal(backend.available(), true);
  });

  it("getRecallBackend returns LocalRecallBackend when no config", async () => {
    const { setRoot, resetRoot } = await import("agent-recall-core");
    const { getRecallBackend, LocalRecallBackend, resetRecallBackend } = await import("agent-recall-core");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ar-backend-"));
    setRoot(tmpDir);
    resetRecallBackend();
    const backend = await getRecallBackend();
    assert.ok(backend instanceof LocalRecallBackend);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetRoot();
    resetRecallBackend();
  });
});
