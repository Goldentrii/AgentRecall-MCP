/**
 * projects-literal-bypass-guard.test.mjs — F2 durable fix (independent
 * review, 2026-07-20).
 *
 * F2 finding: 9+ call sites across packages/core/src built a per-project path
 * via `path.join(<root-ish>, "projects", <slug>, ...)` (or, in one case, a
 * template literal `` `${root}/projects/${slug}/...` ``) WITHOUT routing
 * through storage/paths.ts's `resolveProjectDirName` EXISTING-DIR reuse rule —
 * silently reintroducing the case-fold directory-split bug that rule exists
 * to prevent, for that ONE call site's store. A follow-up grep (this fix)
 * found MORE such sites beyond the reviewer's original list (storage/project.ts,
 * helpers/activity-feed.ts's outcomeEvents, tools-logic/session-start.ts's
 * autoBackfill, tools-logic/session-end.ts's two template-literal sites,
 * naming.ts's canonicalPath, and several pure enumeration-root call sites).
 *
 * The fix (see storage/paths.ts: PROJECTS_DIRNAME / projectsRootDir() /
 * projectSubPath()) routes EVERY site that builds a "projects/..." path
 * through paths.ts — including plain enumeration-root reads, so the literal
 * "projects" directory-name segment now lives in exactly ONE file.
 *
 * This test is the DURABLE guard: it scans every packages/core/src/**\/*.ts
 * source file (paths.ts itself allowlisted — it is the ONE place the literal
 * is allowed to live) for any `path.join(...)` call or template-literal path
 * segment containing the literal "projects" — the shape that, historically,
 * has always meant "a new bypass of the case-fold-divergence fix". Two
 * narrow, deliberate exceptions (see EXCLUDED below) are carved out for
 * things that are NOT this bug class at all.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CORE_SRC = path.resolve(__dirname, "../src");

// Only paths.ts (the canonical implementation) may contain the literal.
const ALLOWLIST_RELATIVE_PATHS = new Set([
  path.join("storage", "paths.ts"),
]);

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
 * Strip `//` line comments and `/* *\/` block comments so a doc comment that
 * merely DESCRIBES the bypass in prose (as several of this fix's own
 * explanatory comments do — including this file's own header above) is never
 * mistaken for a real occurrence. Not a full tokenizer (does not special-case
 * `//`/`/*` inside string literals), but sufficient for this codebase —
 * verified empirically to produce zero false positives against the fixed tree.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Find every `path.join(...)` call in `src` (by matching balanced parens
 * starting at each `path.join(` occurrence — handles nested calls like
 * `path.join(getRoot(), "projects", safe)`) and every backtick template
 * literal, returning each span's raw text for inspection.
 */
function extractPathJoinCallsAndTemplates(src) {
  const spans = [];

  const joinRe = /path\.join\(/g;
  let m;
  while ((m = joinRe.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = m.index;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    spans.push(src.slice(start, i));
  }

  // Backtick template literals (non-nested-backtick, which is all this
  // codebase uses for path-like templates).
  const templateRe = /`[^`]*`/g;
  while ((m = templateRe.exec(src))) {
    spans.push(m[0]);
  }

  return spans;
}

// EXCLUDED (deliberately NOT the bypass class this guard is for):
//   - any span that also contains ".claude" — the legacy `~/.claude/projects/`
//     tree (types.ts's getLegacyRoot, bootstrap.ts's Claude AutoMemory import
//     path) is a COMPLETELY different, unrelated directory (Claude's own
//     project-memory encoding) that AgentRecall only ever READS, never
//     creates — it carries none of the case-fold-divergence risk this guard
//     exists for.
function isExcludedSpan(span) {
  return span.includes(".claude");
}

describe("F2 guard — no file outside storage/paths.ts may build a \"projects\"-segment path", () => {
  const allFiles = collectTsFiles(CORE_SRC);
  assert.ok(allFiles.length > 20, `sanity: expected to find many .ts files under ${CORE_SRC}, found ${allFiles.length}`);

  it("storage/paths.ts itself DOES still contain the literal (sanity: the allowlist entry is meaningful)", () => {
    const pathsTs = fs.readFileSync(path.join(CORE_SRC, "storage", "paths.ts"), "utf-8");
    assert.ok(pathsTs.includes('"projects"'), "expected paths.ts to be the one file defining PROJECTS_DIRNAME etc.");
  });

  it("no other packages/core/src/**/*.ts file has a path.join(...) call or template literal containing \"projects\"", () => {
    const offenders = [];
    for (const file of allFiles) {
      const rel = path.relative(CORE_SRC, file);
      if (ALLOWLIST_RELATIVE_PATHS.has(rel)) continue;
      const src = stripComments(fs.readFileSync(file, "utf-8"));
      const spans = extractPathJoinCallsAndTemplates(src);
      for (const span of spans) {
        if (!span.includes('"projects"') && !span.includes("projects/${")) continue;
        if (isExcludedSpan(span)) continue;
        offenders.push(`${rel}: ${span.replace(/\s+/g, " ").trim()}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Found ${offenders.length} bypass site(s) — route these through paths.ts's projectSubPath()/projectsRootDir() instead:\n${offenders.join("\n")}`,
    );
  });
});
