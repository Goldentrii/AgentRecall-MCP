/**
 * egress-guard.test.mjs — CI invariant: every syncToSupabase call site must
 * wrap its content argument in scrubForCloud().
 *
 * Models the Lane-1 structural import test in cross-surface-adapter.test.mjs.
 *
 * Approach:
 *   1. Walk every .ts file under packages/core/src and packages/mcp-server/src.
 *   2. Find every line containing `syncToSupabase(` (call sites).
 *   3. Exclude the definition file (supabase/sync.ts) and bare import lines.
 *   4. Assert that each call-site line's content argument is wrapped in
 *      `scrubForCloud(`.
 *
 * A future developer who adds a new syncToSupabase call without scrubbing will
 * see this test fail with the exact file:line that is unguarded.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

// Roots to scan (relative to repo root)
const SCAN_ROOTS = [
  path.join(REPO_ROOT, "packages/core/src"),
  path.join(REPO_ROOT, "packages/mcp-server/src"),
];

// The definition file — exclude it so the function signature itself isn't tested.
const DEFINITION_SUFFIX = path.join("supabase", "sync.ts");

/**
 * Recursively collect all .ts files under a directory.
 */
function collectTsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Given a source file, return all lines that are syncToSupabase call sites:
 *   - Contains `syncToSupabase(`
 *   - Is NOT a bare import line (starts with `import`)
 *   - Is NOT the definition file (supabase/sync.ts)
 */
function findCallSiteLines(filePath, src) {
  if (filePath.endsWith(DEFINITION_SUFFIX)) return [];
  return src
    .split("\n")
    .map((line, idx) => ({ line: line.trimStart(), lineNo: idx + 1, raw: line }))
    .filter(({ line }) => line.includes("syncToSupabase("))
    .filter(({ line }) => !/^\s*import\s/.test(line));
}

describe("egress-guard — every syncToSupabase call must wrap content in scrubForCloud", () => {
  // Collect all call sites once
  const allFiles = SCAN_ROOTS.flatMap(collectTsFiles);
  const callSites = [];

  for (const filePath of allFiles) {
    const src = fs.readFileSync(filePath, "utf-8");
    for (const { line, lineNo } of findCallSiteLines(filePath, src)) {
      callSites.push({ filePath, lineNo, line });
    }
  }

  // Emit the site list (useful when the test runs in CI — paste-able for the report)
  console.log(`\negress-guard: found ${callSites.length} syncToSupabase call site(s):`);
  for (const { filePath, lineNo } of callSites) {
    const rel = path.relative(REPO_ROOT, filePath);
    console.log(`  ${rel}:${lineNo}`);
  }

  it("finds at least one syncToSupabase call site (sanity: scan is working)", () => {
    assert.ok(callSites.length > 0, "Expected at least one syncToSupabase call site — scan may be broken");
  });

  for (const { filePath, lineNo, line } of callSites) {
    const rel = path.relative(REPO_ROOT, filePath);
    const label = `${rel}:${lineNo}`;

    it(`${label} — content argument is wrapped in scrubForCloud(`, () => {
      assert.ok(
        line.includes("scrubForCloud("),
        `UNGUARDED EGRESS at ${label}:\n  ${line.trim()}\n  → wrap the content argument in scrubForCloud(...)`,
      );
    });
  }
});
