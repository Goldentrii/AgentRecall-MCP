import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(__dirname, "..", "dist", "index.js");

describe("MCP server smoke tests", () => {
  it("--list-tools outputs exactly 22 tools", async () => {
    const { stdout } = await execFileAsync("node", [ENTRY, "--list-tools"]);
    const tools = JSON.parse(stdout);
    assert.equal(tools.length, 22);
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("journal_read"));
    assert.ok(names.includes("palace_write"));
    assert.ok(names.includes("awareness_update"));
    assert.ok(names.includes("recall_insight"));
  });

  it("--version prints a semver string", async () => {
    const { stdout } = await execFileAsync("node", [ENTRY, "--help"]);
    assert.ok(stdout.includes("agent-recall-mcp v"));
    assert.ok(stdout.includes("3.3.5"));
  });

  it("--help shows storage path and usage info", async () => {
    const { stdout } = await execFileAsync("node", [ENTRY, "--help"]);
    assert.ok(stdout.includes("Storage:"));
    assert.ok(stdout.includes("Legacy:"));
    assert.ok(stdout.includes("npx agent-recall-mcp"));
  });

  it("tool names match expected set", async () => {
    const { stdout } = await execFileAsync("node", [ENTRY, "--list-tools"]);
    const tools = JSON.parse(stdout);
    const expected = [
      "journal_read", "journal_write", "journal_capture", "journal_list",
      "journal_projects", "journal_search", "alignment_check", "nudge",
      "context_synthesize", "journal_state", "journal_cold_start",
      "journal_archive", "journal_rollup", "knowledge_write", "knowledge_read",
      "palace_read", "palace_write", "palace_walk", "palace_lint",
      "palace_search", "awareness_update", "recall_insight",
    ];
    for (const name of expected) {
      assert.ok(
        tools.some((t) => t.name === name),
        `Missing tool: ${name}`
      );
    }
  });
});
