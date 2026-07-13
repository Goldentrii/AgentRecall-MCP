#!/usr/bin/env node
/**
 * loop-runner.mjs — a minimal agent harness whose stop condition is an
 * *externally executable predicate*, never the agent's own "STATUS: done".
 *
 * Same thesis as this repo's design principle #1 ("hooks over discretion"):
 * critical outcomes are harness-enforced, not agent-decided. The whole point
 * lives in runLoop(): the ONLY success exit is checkDone() returning true.
 * The model's text is never parsed for a stop signal. It can scream
 * "STATUS: done" every turn and the loop will not care.
 *
 * The five load-bearing parts (everything else is decoration):
 *   1. spec          — the task + a machine-checkable doneCheck command
 *                      (shell command run BY THE HARNESS; exit code 0 == done;
 *                      make it re-run real evidence — tests, a curl, a
 *                      checksum — never a grep for the word "done").
 *                      See spec.example.json.
 *   2. state on disk — <stateDir>/: transcript.jsonl + scratch/ the agent
 *                      writes to
 *   3. loop runner   — a hard iteration budget + a file-based kill switch,
 *                      both checked every turn
 *   4. verifier      — the harness RE-RUNS doneCheck itself and reads the
 *                      exit code; it never reads claims
 *   5. human gate    — outward / irreversible actions block on typed y/N
 *                      (fail-closed: no TTY means no approval)
 *
 * Ported 1:1 from a tested Python reference (loop.py, 2026-07-11) to this
 * repo's tooling conventions: ES module under scripts/, `node --test` for the
 * acceptance tests, zero new dependencies (JSON spec instead of YAML, fetch
 * instead of an SDK). The API-touching code is isolated in the real* adapters
 * at the bottom, behind dependency injection, so the loop logic is tested
 * with a mock model and no network.
 *
 * Real run:
 *   AR_LOOP_MODEL=<model-id> ANTHROPIC_API_KEY=... \
 *     node scripts/agent-loop/loop-runner.mjs scripts/agent-loop/spec.example.json
 *   ANTHROPIC_BASE_URL is honored (gateway routing). The model id is always
 *   read from AR_LOOP_MODEL — never hardcoded here.
 *   Kill a run mid-flight: `touch STOP` (spec.stopFile) in the working dir.
 *
 * Acceptance tests (offline, mock model):
 *   node --test scripts/agent-loop/loop-runner.test.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Pure, independently checkable pieces (no network, no heavy imports)
// ---------------------------------------------------------------------------

// Tune this list. Over-gating causes confirmation fatigue -> rubber-stamping,
// which turns the gate into theater. Kept to this repo's genuinely high-stakes
// actions: the REDLINE set (push / publish / version-bump / delete) plus
// outbound network and privilege escalation.
export const DEFAULT_OUTWARD_PATTERNS = Object.freeze([
  "git push", "git reset --hard", "npm publish", "npm version",
  "rm -rf", "curl", "wget", "ssh ", "scp ", "sudo ",
]);

/**
 * 1. SPEC — a task plus a doneCheck shell command (exit 0 means done).
 * @returns frozen spec object; unknown fields are the caller's problem —
 *          loadSpec() filters file input to known keys.
 */
export function makeSpec(overrides = {}) {
  return Object.freeze({
    task: "",
    doneCheck: "",              // shell command; exit code 0 == done
    maxIterations: 25,          // the budget: hard cap, no self-extension
    stopFile: "STOP",           // touch this file to kill the run
    stateDir: "state",
    outwardPatterns: DEFAULT_OUTWARD_PATTERNS,
    ...overrides,
  });
}

/**
 * 4. VERIFIER — runs the predicate; true iff exit code 0. Reads no claims.
 * An empty predicate can never mean done (fail closed).
 */
export function checkDone(doneCheck) {
  if (!doneCheck || !doneCheck.trim()) return false;
  // timeout: a hung predicate would block the (synchronous) event loop, which
  // would also freeze the STOP-file kill switch. Timeout -> status null -> not done.
  return spawnSync(doneCheck,
                   { shell: true, stdio: "ignore", timeout: 120_000 })
    .status === 0;
}

/** 5. HUMAN GATE — classifier. Case-insensitive substring match. */
export function isOutward(command, patterns) {
  const c = command.toLowerCase();
  return patterns.some((p) => c.includes(p.toLowerCase()));
}

// ---------------------------------------------------------------------------
// 2. State on disk
// ---------------------------------------------------------------------------

export function initState(spec) {
  fs.mkdirSync(path.join(spec.stateDir, "scratch"), { recursive: true });
  const tp = path.join(spec.stateDir, "transcript.jsonl");
  if (!fs.existsSync(tp)) fs.writeFileSync(tp, "");
}

export function logEvent(spec, record) {
  const line = JSON.stringify({ ...record, ts: Date.now() / 1000 });
  fs.appendFileSync(path.join(spec.stateDir, "transcript.jsonl"), line + "\n");
}

// ---------------------------------------------------------------------------
// 3. The loop. This function is the entire point; read the two ALL-CAPS
//    comments.
// ---------------------------------------------------------------------------

/**
 * @param spec      makeSpec()/loadSpec() result
 * @param modelFn   (spec, history) -> {text, toolCalls:[{name, command, raw?}]}
 * @param executeFn (call) -> result string
 * @param confirmFn (call) -> boolean (may be async; false blocks the call)
 * @returns {reason, iterations} — reason is one of:
 *          done_predicate_passed | budget_exhausted | kill_switch
 */
export async function runLoop(spec, modelFn, executeFn, confirmFn) {
  initState(spec);
  const history = [];

  for (let i = 1; i <= spec.maxIterations; i++) {
    // kill switch — checked every turn, before any work
    if (fs.existsSync(spec.stopFile)) {
      logEvent(spec, { event: "halt", reason: "kill_switch", iter: i });
      return { reason: "kill_switch", iterations: i };
    }

    // VERIFIER == STOP CONDITION. The harness establishes "done" as a fact
    // by re-running the predicate. This is the whole design: success is
    // something the harness proves, not a string the agent emits.
    if (checkDone(spec.doneCheck)) {
      logEvent(spec, { event: "halt", reason: "done_predicate_passed", iter: i });
      return { reason: "done_predicate_passed", iterations: i };
    }

    const reply = await modelFn(spec, history);
    history.push({ role: "assistant", content: reply.text || "(no text)" });
    logEvent(spec, { event: "model", iter: i, text: reply.text });
    // NOTE: reply.text may literally say "STATUS: done, all tests pass!".
    // We do not read it as a stop signal. Only checkDone() above can end
    // the loop successfully. The agent cannot grade its own homework.

    for (const call of reply.toolCalls) {
      if (isOutward(call.command, spec.outwardPatterns)) {
        if (!(await confirmFn(call))) {
          logEvent(spec, { event: "gate_denied", iter: i, cmd: call.command });
          history.push({ role: "user",
                         content: `[BLOCKED by human] ${call.command}` });
          continue;
        }
      }
      const result = await executeFn(call);
      history.push({ role: "user", content: `[tool:${call.name}] ${result}` });
      logEvent(spec, { event: "tool", iter: i,
                       cmd: call.command, result: String(result).slice(0, 2000) });
    }
  }

  logEvent(spec, { event: "halt", reason: "budget_exhausted",
                   iter: spec.maxIterations });
  return { reason: "budget_exhausted", iterations: spec.maxIterations };
}

// ---------------------------------------------------------------------------
// Real adapters. Swap these freely; runLoop() above never changes.
// ---------------------------------------------------------------------------

export function loadSpec(specPath) {
  const raw = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const known = ["task", "doneCheck", "maxIterations",
                 "stopFile", "stateDir", "outwardPatterns"];
  const picked = Object.fromEntries(
    Object.entries(raw).filter(([k]) => known.includes(k)));
  return makeSpec(picked);
}

export async function realModelReply(spec, history) {
  const model = process.env.AR_LOOP_MODEL;
  if (!model) {
    throw new Error(
      "AR_LOOP_MODEL is not set. Export it with your model id " +
      "(current names: docs.claude.com) — model ids are never hardcoded here.");
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const baseUrl =
    (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com")
      .replace(/\/+$/, "");
  const system =
    "You are an agent working toward the task below. Act only through the " +
    "`shell` tool. Do NOT announce completion or say you are done — a " +
    "separate verifier re-runs the acceptance check and decides that.\n\n" +
    `TASK:\n${spec.task}\n`;
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: history.length ? history : [{ role: "user", content: "Begin." }],
      tools: [{
        name: "shell",
        description: "Run one shell command in the working directory.",
        input_schema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      }],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const blocks = data.content || [];
  const text = blocks.filter((b) => b.type === "text")
                     .map((b) => b.text).join("");
  const toolCalls = blocks.filter((b) => b.type === "tool_use")
    .map((b) => ({ name: "shell", command: b.input.command, raw: b.input }));
  return { text, toolCalls };
}

export async function realExecute(call) {
  const p = spawnSync(call.command,
                      { shell: true, encoding: "utf8", timeout: 120_000 });
  if (p.error?.code === "ETIMEDOUT") return "exit=timeout (>120s)";
  const exit = `${p.status}${p.signal ? ` (signal=${p.signal})` : ""}`;
  return `exit=${exit}\nstdout:\n${p.stdout ?? ""}\nstderr:\n${p.stderr ?? ""}`;
}

export async function realConfirm(call) {
  // Fail closed: no human at the terminal means no approval, not a default yes.
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin,
                                        output: process.stdout });
  const ans = await new Promise((resolve) => rl.question(
    `\n[GATE] outward/irreversible action:\n  ${call.command}\nApprove? (y/N) `,
    resolve));
  rl.close();
  return ans.trim().toLowerCase() === "y";
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const specPath = process.argv[2] || path.join(here, "spec.example.json");
  const spec = loadSpec(specPath);
  const halt = await runLoop(spec, realModelReply, realExecute, realConfirm);
  console.log(`\nHALT: ${halt.reason} after ${halt.iterations} iteration(s).`);
  process.exit(halt.reason === "done_predicate_passed" ? 0 : 1);
}

if (process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(2);
  });
}
