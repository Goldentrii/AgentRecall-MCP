#!/usr/bin/env node
/**
 * capture-discard-backfill.mjs — Loop 7.
 *
 * THE SURVIVORSHIP-BIAS BACKFILL ESTIMATOR. AgentRecall's whole thesis is
 * "redundancy over time reconstructs intent." But if the capture gate
 * (isLikelyRealCorrection) silently discards soft corrections, the intent
 * sample is biased AT THE SOURCE — we never see what we threw away. This script
 * produces a REAL discard-rate number THIS loop instead of waiting a week for
 * the live _rejected.jsonl to fill.
 *
 * METHOD — replay a real candidate-correction stream through the EXACT same path
 * the live capture takes:
 *   1. SOURCE (default): every `corrections[]` string in the real local
 *      alignment-log.json files under ~/.agent-recall/projects/*. These are the
 *      actual human_correction texts that flowed through tools-logic/check.ts —
 *      i.e. the genuine candidate-correction stream, NOT synthetic.
 *   2. DERIVE the gated `rule` the SAME way check.ts does before calling the
 *      gate:   rule = text.split(/[.\n]/)[0].trim().slice(0,100)   (see
 *      check.ts ~line 125). Replaying the raw text would NOT match production —
 *      the gate only ever sees this first-sentence slice.
 *   3. RUN isLikelyRealCorrection(rule) — the unmodified production gate.
 *   4. REPORT accepted vs rejected, the discard RATE, and a per-reason
 *      breakdown. Buckets by project too.
 *
 * HONESTY — this is an ESTIMATE, and a conservative one. Limitations (printed in
 * the report so they are never hidden):
 *   - alignment-log only retains corrections that ALREADY reached check() with a
 *     human_correction set. Truly soft signals that never triggered the
 *     correction-detection hook (CORRECTION_PATTERNS in cli hook-correction)
 *     never made it into this log at all — so the TRUE discard rate is almost
 *     certainly HIGHER than measured here. This number is a FLOOR.
 *   - The log is capped at the last 50 records per project (check.ts trims), so
 *     older candidates are not represented.
 *   - We replay only the `rule` derivation; we do not re-run severity/tagging.
 *
 * READ-ONLY. Changes no behavior, writes nothing. Measures only.
 *
 * Usage:
 *   node scripts/eval/capture-discard-backfill.mjs            # human report
 *   node scripts/eval/capture-discard-backfill.mjs --json     # machine-readable
 *   node scripts/eval/capture-discard-backfill.mjs --root <d> # explicit corpus root
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

import { isLikelyRealCorrection } from "../../packages/core/dist/storage/corrections.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const rootIdx = argv.indexOf("--root");
const corpusRoot =
  rootIdx >= 0 && argv[rootIdx + 1]
    ? argv[rootIdx + 1]
    : path.join(os.homedir(), ".agent-recall", "projects");

// ── derive the gated rule EXACTLY like tools-logic/check.ts (~line 125) ──────
function deriveRule(corrText) {
  return corrText.split(/[.\n]/)[0]?.trim().slice(0, 100) ?? corrText.slice(0, 100);
}

// ── collect the real candidate-correction stream from alignment logs ─────────
function findAlignmentLogs(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) {
      const log = path.join(p, "alignment-log.json");
      if (fs.existsSync(log)) out.push({ project: e.name, file: log });
    }
  }
  return out;
}

function loadCandidates(root) {
  const logs = findAlignmentLogs(root);
  const candidates = []; // { project, text }
  for (const { project, file } of logs) {
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const rec of arr) {
      if (!rec || !Array.isArray(rec.corrections)) continue;
      for (const c of rec.corrections) {
        if (typeof c === "string" && c.trim()) {
          candidates.push({ project, text: c.trim() });
        }
      }
    }
  }
  return candidates;
}

// ── replay ────────────────────────────────────────────────────────────────
function run() {
  const candidates = loadCandidates(corpusRoot);
  const total = candidates.length;

  const byReason = new Map();
  const byProject = new Map(); // project -> { accepted, rejected }
  let accepted = 0;
  let rejected = 0;
  const rejectedSamples = [];

  for (const { project, text } of candidates) {
    const rule = deriveRule(text);
    const gate = isLikelyRealCorrection(rule);
    const pjt = byProject.get(project) ?? { accepted: 0, rejected: 0 };
    if (gate.ok) {
      accepted++;
      pjt.accepted++;
    } else {
      rejected++;
      pjt.rejected++;
      const reason = gate.reason ?? "unknown";
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
      if (rejectedSamples.length < 12) {
        rejectedSamples.push({ project, rule, reason });
      }
    }
    byProject.set(project, pjt);
  }

  const discardRate = total > 0 ? Number((rejected / total).toFixed(4)) : null;
  const perReason = [...byReason.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
  const perProject = [...byProject.entries()]
    .map(([project, v]) => ({
      project,
      ...v,
      total: v.accepted + v.rejected,
      discard_rate:
        v.accepted + v.rejected > 0
          ? Number((v.rejected / (v.accepted + v.rejected)).toFixed(4))
          : null,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    source: "alignment-log.json corrections[] under ~/.agent-recall/projects/*",
    corpus_root: corpusRoot,
    gate: "isLikelyRealCorrection (production, unmodified) on check.ts-derived rule",
    rule_derivation: "text.split(/[.\\n]/)[0].trim().slice(0,100)",
    is_estimate: true,
    estimate_note:
      "FLOOR, not ceiling — alignment-log only holds candidates that already reached check() with human_correction set; truly soft signals filtered out earlier by the hook's CORRECTION_PATTERNS never appear here. True discard rate is almost certainly higher.",
    sample_size: total,
    accepted,
    rejected,
    discard_rate: discardRate,
    per_reason: perReason,
    per_project: perProject,
    rejected_samples: rejectedSamples,
  };
}

const report = run();

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  const L = [];
  L.push("═══ capture-gate discard backfill (Loop 7) ═══");
  L.push(`source        : ${report.source}`);
  L.push(`corpus root   : ${report.corpus_root}`);
  L.push(`gate          : ${report.gate}`);
  L.push(`rule derive   : ${report.rule_derivation}`);
  L.push(`sample size   : ${report.sample_size} candidate corrections`);
  L.push("");
  if (report.sample_size === 0) {
    L.push("No candidate corrections found — is the corpus root correct?");
  } else {
    L.push(`accepted      : ${report.accepted}`);
    L.push(`rejected      : ${report.rejected}`);
    L.push(
      `DISCARD RATE  : ${(report.discard_rate * 100).toFixed(1)}%  (ESTIMATE — see note)`,
    );
    L.push("");
    L.push("per-reason breakdown:");
    for (const r of report.per_reason) {
      L.push(`  ${String(r.count).padStart(4)}  ${String(r.pct).padStart(5)}%  ${r.reason}`);
    }
    L.push("");
    L.push("top projects by candidate volume:");
    for (const p of report.per_project.slice(0, 10)) {
      const rate = p.discard_rate !== null ? `${(p.discard_rate * 100).toFixed(0)}%` : "—";
      L.push(`  ${p.project.padEnd(28)} ${String(p.total).padStart(4)} cand  ${rate} discarded`);
    }
    L.push("");
    L.push("rejected samples (derived rule → reason):");
    for (const s of report.rejected_samples) {
      L.push(`  [${s.project}] "${s.rule}" → ${s.reason}`);
    }
    L.push("");
    L.push("LIMITATION: " + report.estimate_note);
  }
  process.stdout.write(L.join("\n") + "\n");
}
