#!/usr/bin/env node
/**
 * correction-triage.mjs — one-time correction quality sweep
 *
 * Walks all projects/<slug>/corrections/<id>.json, classifies each correction with
 * isLikelyRealCorrection, and prints a table of verdicts.
 *
 * Usage:
 *   node scripts/correction-triage.mjs             # dry-run (prints table only)
 *   node scripts/correction-triage.mjs --apply     # retract noise records
 *
 * Never deletes files. Retracted records get active:false + retract_reason.
 * Import source: packages/core/dist/ (run `npm run build` first).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Resolve the core dist — prefer local build, fall back to installed package
const coreDist = path.join(repoRoot, "packages", "core", "dist", "index.js");
if (!fs.existsSync(coreDist)) {
  console.error(
    `ERROR: ${coreDist} not found.\nRun \`npm run build\` from the repo root first.`
  );
  process.exit(1);
}

const { isLikelyRealCorrection, retractCorrection, getRoot } = await import(coreDist);

const APPLY = process.argv.includes("--apply");
const TRIAGE_REASON = "triage-2026-06-12: capture noise";

// Walk ~/.agent-recall/projects/*/corrections/*.json
const root = getRoot();
const projectsDir = path.join(root, "projects");

if (!fs.existsSync(projectsDir)) {
  console.log(`No projects directory found at ${projectsDir}. Nothing to triage.`);
  process.exit(0);
}

const projects = fs.readdirSync(projectsDir).filter((p) => {
  const full = path.join(projectsDir, p);
  return fs.statSync(full).isDirectory();
});

/** @type {Array<{slug: string, id: string, verdict: "ok"|"noise", reason?: string, rulePreview: string, active: boolean}>} */
const rows = [];

for (const slug of projects) {
  const corrDir = path.join(projectsDir, slug, "corrections");
  if (!fs.existsSync(corrDir)) continue;

  const files = fs.readdirSync(corrDir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  for (const file of files) {
    let record;
    try {
      record = JSON.parse(fs.readFileSync(path.join(corrDir, file), "utf-8"));
    } catch {
      continue; // skip malformed
    }

    const active = record.active !== false;
    const gateText = `${record.rule ?? ""} ${record.context ?? ""}`.trim();
    const gate = isLikelyRealCorrection(gateText);

    rows.push({
      slug,
      id: record.id ?? file,
      verdict: gate.ok ? "ok" : "noise",
      reason: gate.reason,
      rulePreview: (record.rule ?? "(no rule)").slice(0, 60),
      active,
    });
  }
}

// Print table
const colW = [20, 36, 7, 60, 50];
const header = ["slug", "id", "active", "verdict/reason", "rule-preview"];
const divider = colW.map((w) => "-".repeat(w)).join(" | ");

function padRight(s, w) {
  const str = String(s);
  return str.length >= w ? str.slice(0, w) : str + " ".repeat(w - str.length);
}

console.log("");
console.log(header.map((h, i) => padRight(h, colW[i])).join(" | "));
console.log(divider);

for (const r of rows) {
  const verdictCell = r.verdict === "noise" ? `NOISE: ${r.reason ?? ""}` : "ok";
  console.log(
    [
      padRight(r.slug, colW[0]),
      padRight(r.id, colW[1]),
      padRight(r.active ? "yes" : "no", colW[2]),
      padRight(verdictCell, colW[3]),
      padRight(r.rulePreview, colW[4]),
    ].join(" | ")
  );
}

console.log(divider);

const total = rows.length;
const noiseRows = rows.filter((r) => r.verdict === "noise");
const noiseActive = noiseRows.filter((r) => r.active);
const ok = rows.filter((r) => r.verdict === "ok").length;

console.log(`\nSummary: ${total} corrections — ${ok} ok, ${noiseRows.length} noise (${noiseActive.length} currently active)`);

if (!APPLY) {
  if (noiseActive.length > 0) {
    console.log(`\nDry-run. Pass --apply to retract ${noiseActive.length} active noise correction(s).`);
  } else {
    console.log("\nDry-run. No active noise corrections to retract.");
  }
  process.exit(0);
}

// Apply: retract active noise records
let retracted = 0;
let errors = 0;
for (const r of noiseActive) {
  try {
    const result = retractCorrection(r.slug, r.id, TRIAGE_REASON);
    if (result.success) {
      retracted++;
      console.log(`  retracted: [${r.slug}] ${r.id}`);
    } else {
      errors++;
      console.error(`  ERROR retracting [${r.slug}] ${r.id}: ${result.error}`);
    }
  } catch (err) {
    errors++;
    console.error(`  EXCEPTION retracting [${r.slug}] ${r.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\nApplied: ${retracted} retracted, ${errors} errors.`);
