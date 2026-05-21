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

  it("getRecallBackend returns a local backend when no Supabase config", async () => {
    const { setRoot, resetRoot } = await import("agent-recall-core");
    const { getRecallBackend, LocalRecallBackend, LocalVectorRecallBackend, resetRecallBackend } = await import("agent-recall-core");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ar-backend-"));
    setRoot(tmpDir);
    resetRecallBackend();
    const backend = await getRecallBackend();
    // keyword backend (no OPENAI_API_KEY) or vector backend (OPENAI_API_KEY set) — both are local
    assert.ok(
      backend instanceof LocalRecallBackend || backend instanceof LocalVectorRecallBackend,
      `Expected local backend, got ${backend?.constructor?.name}`
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetRoot();
    resetRecallBackend();
  });
});
