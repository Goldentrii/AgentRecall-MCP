/**
 * Integration smoke tests for `ar awareness rollup [--threshold N]`
 *
 * Strategy: invoke the compiled CLI against an isolated temp root.
 * Since the temp root has no insights-index, promoteConfirmedInsights
 * returns { promoted: [], skipped: [] } and the CLI outputs the
 * "No new insights" message — exit code 0.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "dist", "index.js");
const TEST_ROOT = path.join(os.tmpdir(), "ar-rollup-test-" + Date.now());

/**
 * Run the CLI with an isolated root so no real awareness state is touched.
 * Returns { stdout, stderr, code }.
 */
async function runRollup(...extraArgs) {
  return new Promise((resolve) => {
    execFile(
      "node",
      [CLI, "--root", TEST_ROOT, "awareness", "rollup", ...extraArgs],
      { timeout: 10000 },
      (err, stdout, stderr) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code: err?.code ?? 0,
        });
      }
    );
  });
}

test("awareness rollup exits 0 with empty insights-index", async () => {
  const { code, stdout, stderr } = await runRollup();
  assert.equal(code, 0, `Expected exit code 0, got ${code}. stderr: ${stderr}`);
  // Should print either "No new insights" or "Promoted N insight(s)"
  const combined = stdout + stderr;
  const hasExpectedOutput =
    combined.includes("No new insights") || combined.includes("Promoted");
  assert.ok(
    hasExpectedOutput,
    `Expected "No new insights" or "Promoted" in output. Got: ${combined}`
  );
});

test("awareness rollup --threshold 99 exits 0", async () => {
  const { code, stdout, stderr } = await runRollup("--threshold", "99");
  assert.equal(code, 0, `Expected exit code 0, got ${code}. stderr: ${stderr}`);
  const combined = stdout + stderr;
  assert.ok(
    combined.includes("No new insights") || combined.includes("Promoted"),
    `Unexpected output: ${combined}`
  );
});

test("awareness rollup --threshold 99 output contains threshold value", async () => {
  const { stdout } = await runRollup("--threshold", "99");
  assert.ok(
    stdout.includes("99"),
    `Expected threshold 99 in output. Got: ${stdout}`
  );
});

test("awareness rollup help text includes rollup subcommand", async () => {
  const { stdout } = await execFileAsync("node", [CLI, "--help"], {
    timeout: 10000,
  });
  assert.ok(
    stdout.includes("awareness rollup"),
    `Expected 'awareness rollup' in help output`
  );
});
