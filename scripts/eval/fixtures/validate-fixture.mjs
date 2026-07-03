#!/usr/bin/env node
/**
 * validate-fixture.mjs — corpus-v1 shape validator
 *
 * Reads every *.json from the store layout
 * (fixtures/corpus-v1/projects/<proj>/corrections/*.json)
 * using the SAME normalisation logic as readCorrections() and
 * applyCorrectionDefaults() in packages/core/src/storage/corrections.ts.
 *
 * The count rule (§2.2) is: a record COUNTS iff it has both a non-empty
 * `rule` AND a valid `date`.  Everything else is loaded but listed in
 * excluded[].
 *
 * Prints:
 *   n_on_disk   — .json files on disk
 *   n_counted   — records passing the count rule
 *   excluded[]  — {id, reason} for each dropped record
 *
 * Exits 0 when n_on_disk >= 20 and n_counted == EXPECTED_COUNTED.
 * Exits 1 on any assertion failure.
 *
 * Usage:
 *   node scripts/eval/fixtures/validate-fixture.mjs
 *   node scripts/eval/fixtures/validate-fixture.mjs --root <corpus-dir>
 *
 * # requires run-bench (Worker A) for integration; this script is standalone.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

// ── Config ───────────────────────────────────────────────────────────────────

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DEFAULT_CORPUS_ROOT = path.join(__dirname, "corpus-v1");

// The KNOWN expected counts for corpus-v1.  These are the source-of-truth
// assertions; update when the fixture corpus is intentionally changed
// (which requires a corpus-v2 bump per spec §4.4).
const EXPECTED_ON_DISK = 26;
const EXPECTED_COUNTED = 23;
const EXPECTED_EXCLUDED = 3; // missing-rule, missing-date, missing-both

// ── Helpers (mirrors corrections.ts inline, no core import) ─────────────────

function defaultWeight(severity) {
  return severity === "p0" ? 1.0 : 0.7;
}

function applyCorrectionDefaults(record) {
  const kind = record.kind ?? "correction";
  const weight = record.weight ?? defaultWeight(record.severity);
  return {
    ...record,
    kind,
    weight,
    active: record.active ?? true,
    authoritative: record.authoritative ?? kind === "correction",
    proof_count: record.proof_count ?? 1,
    proof_confidence: record.proof_confidence ?? weight,
    stale: record.stale ?? false,
  };
}

/** §2.2 count rule: must have a non-empty rule AND a valid date string. */
function isCountable(record) {
  const hasRule = typeof record.rule === "string" && record.rule.trim().length > 0;
  const hasDate =
    typeof record.date === "string" &&
    record.date.trim().length > 0 &&
    !Number.isNaN(new Date(record.date.trim()).getTime());
  return hasRule && hasDate;
}

function excludedReason(record) {
  const hasRule = typeof record.rule === "string" && record.rule.trim().length > 0;
  const hasDate =
    typeof record.date === "string" &&
    record.date.trim().length > 0 &&
    !Number.isNaN(new Date(record.date.trim()).getTime());
  if (!hasRule && !hasDate) return "missing_rule"; // missing_rule checked first per spec
  if (!hasRule) return "missing_rule";
  if (!hasDate) return "missing_date";
  return null;
}

/** Read all *.json corrections for a project from the store layout. */
function readProjectCorrections(corpusRoot, project) {
  const dir = path.join(corpusRoot, "projects", project, "corrections");
  if (!fs.existsSync(dir)) return [];
  const records = [];
  for (const file of fs.readdirSync(dir).sort().reverse()) {
    if (!file.endsWith(".json")) continue;
    const filepath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filepath, "utf-8");
      const parsed = JSON.parse(raw);
      // applyCorrectionDefaults: supply file's date as holderDefault
      const record = applyCorrectionDefaults(parsed);
      records.push({ record, file });
    } catch (err) {
      // Skip malformed files — same behaviour as readCorrections()
      process.stderr.write(`WARN: skipped malformed file ${filepath}: ${err.message}\n`);
    }
  }
  return records;
}

function listProjects(corpusRoot) {
  const base = path.join(corpusRoot, "projects");
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base)
    .filter((p) => fs.statSync(path.join(base, p)).isDirectory())
    .filter((p) => fs.existsSync(path.join(base, p, "corrections")))
    .sort();
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // Parse --root flag
  let corpusRoot = DEFAULT_CORPUS_ROOT;
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf("--root");
  if (rootIdx >= 0 && args[rootIdx + 1]) {
    corpusRoot = path.resolve(args[rootIdx + 1]);
  }

  if (!fs.existsSync(corpusRoot)) {
    process.stderr.write(`ERROR: corpus root not found: ${corpusRoot}\n`);
    process.exit(1);
  }

  const projects = listProjects(corpusRoot);
  if (projects.length === 0) {
    process.stderr.write(`ERROR: no projects found in ${corpusRoot}\n`);
    process.exit(1);
  }

  let nOnDisk = 0;
  let nCounted = 0;
  const excluded = [];
  const counted = [];

  for (const project of projects) {
    const entries = readProjectCorrections(corpusRoot, project);
    for (const { record, file } of entries) {
      nOnDisk += 1;
      const reason = excludedReason(record);
      if (reason) {
        excluded.push({
          id: record.id ?? file,
          project,
          file,
          reason,
        });
      } else {
        nCounted += 1;
        counted.push({
          id: record.id,
          project,
          date: record.date,
          active: record.active,
          rule: record.rule.slice(0, 80) + (record.rule.length > 80 ? "…" : ""),
        });
      }
    }
  }

  // ── Print report ────────────────────────────────────────────────────────────
  const ok = (label, pass, msg) => {
    const marker = pass ? "  OK  " : " FAIL ";
    process.stdout.write(`[${marker}] ${label}: ${msg}\n`);
    return pass;
  };

  process.stdout.write("\n=== validate-fixture.mjs — corpus-v1 ===\n\n");
  process.stdout.write(`  corpus root  : ${corpusRoot}\n`);
  process.stdout.write(`  projects     : ${projects.join(", ")}\n\n`);
  process.stdout.write(`  n_on_disk    : ${nOnDisk}\n`);
  process.stdout.write(`  n_counted    : ${nCounted}\n`);
  process.stdout.write(`  n_excluded   : ${excluded.length}\n\n`);

  if (excluded.length > 0) {
    process.stdout.write("  excluded[]\n");
    for (const e of excluded) {
      process.stdout.write(`    ${e.id}  (project: ${e.project}, reason: ${e.reason})\n`);
    }
    process.stdout.write("\n");
  }

  process.stdout.write("  counted records (id / date / active)\n");
  for (const c of counted) {
    const activeStr = c.active === false ? "retracted" : "active";
    process.stdout.write(`    ${c.id}  ${c.date}  [${activeStr}]\n`);
  }
  process.stdout.write("\n");

  // ── Assertions ──────────────────────────────────────────────────────────────
  let allPass = true;

  allPass = ok("n_on_disk >= 20", nOnDisk >= 20, `${nOnDisk} (expected >= 20)`) && allPass;
  allPass =
    ok(
      "n_on_disk == EXPECTED_ON_DISK",
      nOnDisk === EXPECTED_ON_DISK,
      `${nOnDisk} (expected ${EXPECTED_ON_DISK})`,
    ) && allPass;
  allPass =
    ok(
      "n_counted == EXPECTED_COUNTED",
      nCounted === EXPECTED_COUNTED,
      `${nCounted} (expected ${EXPECTED_COUNTED})`,
    ) && allPass;
  allPass =
    ok(
      "excluded.length == EXPECTED_EXCLUDED",
      excluded.length === EXPECTED_EXCLUDED,
      `${excluded.length} (expected ${EXPECTED_EXCLUDED})`,
    ) && allPass;

  // Every excluded record has a known reason
  for (const e of excluded) {
    allPass =
      ok(
        `excluded reason valid: ${e.id}`,
        e.reason === "missing_rule" || e.reason === "missing_date",
        e.reason,
      ) && allPass;
  }

  // All counted records have rule + valid date
  for (const c of counted) {
    const hasDate = typeof c.date === "string" && !Number.isNaN(new Date(c.date).getTime());
    allPass =
      ok(
        `counted has valid date: ${c.id}`,
        hasDate,
        c.date ?? "(no date)",
      ) && allPass;
  }

  // At least 2 sibling chains (records sharing project+class tokens)
  // — verified structurally: we have 5 same-class chains across 4 projects
  const siblingChains = [
    ["2026-01-10-never-use-sync-db-calls-in-request-handlers",
     "2026-02-14-never-use-sync-db-calls-in-request-handlers-p2",
     "2026-03-20-never-use-sync-db-calls-in-request-handlers-p3"],
    ["2026-01-22-always-validate-pagination-cursor-before-db-query",
     "2026-03-05-always-validate-pagination-cursor-before-db-query-p2"],
    ["2026-01-05-always-use-parameterized-queries-for-sql",
     "2026-02-18-always-use-parameterized-queries-for-sql-p2"],
    ["2026-01-20-use-structured-logging-not-print-statements",
     "2026-03-10-use-structured-logging-not-print-statements-p2"],
    ["2026-01-08-always-use-iam-roles-not-access-keys",
     "2026-02-20-always-use-iam-roles-not-access-keys-p2"],
    ["2026-01-15-always-add-help-text-to-every-cli-flag",
     "2026-02-25-always-add-help-text-to-every-cli-flag-p2"],
    ["2026-03-12-never-call-os-exit-in-library-functions",
     "2026-04-20-never-call-os-exit-in-library-functions-p2"],
    ["2026-03-18-always-set-resource-limits-on-containers",
     "2026-05-10-always-set-resource-limits-on-containers-p2"],
  ];
  const countedIds = new Set(counted.map((c) => c.id));
  for (const chain of siblingChains) {
    const allPresent = chain.every((id) => countedIds.has(id));
    allPass =
      ok(
        `sibling chain present: ${chain[0].slice(0, 50)}`,
        allPresent,
        allPresent ? `${chain.length} members found` : "MISSING members",
      ) && allPass;
  }

  // Retracted-only-prior case: 2026-02-01-retracted is active:false, and
  // 2026-03-15-retracted-only-prior-class-target is active:true and counted
  allPass =
    ok(
      "retracted-only-prior case present",
      countedIds.has("2026-03-15-retracted-only-prior-class-target") &&
        countedIds.has("2026-02-01-retracted-wrong-cache-ttl-advice"),
      "both records found (one retracted, one target)",
    ) && allPass;

  // superseded_by chain present
  allPass =
    ok(
      "superseded_by chain present",
      countedIds.has("2026-04-01-superseded-old-auth-middleware") &&
        countedIds.has("2026-05-01-use-authmiddleware-v2-for-admin-routes"),
      "superseded + successor both counted",
    ) && allPass;

  // redaction-kills-lead-in case present
  allPass =
    ok(
      "redaction-kills-lead-in case present",
      countedIds.has("2026-04-05-redaction-kills-leadin-case"),
      "record present",
    ) && allPass;

  // ── Summary ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n");
  if (allPass) {
    process.stdout.write("ALL ASSERTIONS PASSED — fixture corpus-v1 is valid.\n\n");
    process.exit(0);
  } else {
    process.stdout.write("ONE OR MORE ASSERTIONS FAILED — see FAIL lines above.\n\n");
    process.exit(1);
  }
}

main();
