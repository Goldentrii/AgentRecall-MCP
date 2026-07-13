#!/usr/bin/env node
/**
 * loop-runner.test.mjs — proves the one claim that matters: SELF-REPORT
 * CANNOT END THE LOOP. Only the harness-run doneCheck predicate can.
 *
 * Ported 1:1 from the Python reference test_loop.py (cases A–E), plus F/G
 * covering this port's env-var model-id guard and the verifier's
 * exit-code-only contract. Mock model, no network, no new dependencies.
 *
 * Run (fresh shell, repo root):
 *   node --test scripts/agent-loop/loop-runner.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_OUTWARD_PATTERNS, makeSpec, runLoop,
  isOutward, checkDone, realModelReply,
} from "./loop-runner.mjs";

function tmpSpec(tmp, overrides = {}) {
  return makeSpec({
    task: "t",
    doneCheck: "false",
    maxIterations: 6,
    stopFile: path.join(tmp, "STOP"),
    stateDir: path.join(tmp, "state"),
    ...overrides,
  });
}

const noopExec = () => "ok";
const deny = () => false;
const approve = () => true;

async function withTmp(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loop-runner-test-"));
  try {
    return await fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// --- A: the killer. Model shouts "STATUS: done" every turn; predicate never
//        passes. The loop must run to budget_exhausted, NOT stop early. ------
test("A: 'STATUS: done' every turn is ignored; loop runs to budget", () =>
  withTmp(async (tmp) => {
    const spec = tmpSpec(tmp, { doneCheck: "false" }); // predicate always fails
    const liar = () => ({ text: "STATUS: done, all tests pass!", toolCalls: [] });
    const halt = await runLoop(spec, liar, noopExec, approve);
    assert.equal(halt.reason, "budget_exhausted");
    assert.equal(halt.iterations, 6);
  }));

// --- B: predicate-driven stop. A tool call creates PROOF on the 3rd turn;
//        doneCheck tests for PROOF. Loop stops the turn AFTER it appears. ----
test("B: loop halts on the predicate becoming true, at the right turn", () =>
  withTmp(async (tmp) => {
    const proof = path.join(tmp, "PROOF");
    const spec = tmpSpec(tmp, {
      doneCheck: `test -f ${proof}`,
      maxIterations: 10,
    });
    let n = 0;
    const model = () => {
      n += 1;
      const cmd = n === 3 ? `touch ${proof}` : "echo working";
      return { text: "", toolCalls: [{ name: "shell", command: cmd }] };
    };
    const exec = (call) => {
      spawnSync(call.command, { shell: true });
      return "ran";
    };
    const halt = await runLoop(spec, model, exec, approve);
    assert.equal(halt.reason, "done_predicate_passed");
    assert.equal(halt.iterations, 4); // created on 3, seen on 4
  }));

// --- C: kill switch beats everything. ---------------------------------------
test("C: STOP file halts the run immediately", () =>
  withTmp(async (tmp) => {
    const spec = tmpSpec(tmp, { maxIterations: 100 });
    fs.writeFileSync(spec.stopFile, "");
    const halt = await runLoop(
      spec, () => ({ text: "", toolCalls: [] }), noopExec, approve);
    assert.equal(halt.reason, "kill_switch");
    assert.equal(halt.iterations, 1);
  }));

// --- D: the human gate actually blocks the outward action. -------------------
test("D: denied outward action never executes", () =>
  withTmp(async (tmp) => {
    const proof = path.join(tmp, "PUSHED");
    const spec = tmpSpec(tmp, { maxIterations: 2 });
    const model = () => ({
      text: "",
      toolCalls: [{ name: "shell", command: `git push && touch ${proof}` }],
    });
    const executed = [];
    const exec = (call) => { executed.push(call.command); return "ran"; };
    await runLoop(spec, model, exec, deny); // human denies
    assert.deepEqual(executed, [], "outward command ran despite denial!");
    assert.equal(fs.existsSync(proof), false);
  }));

// --- E: outward classifier. ---------------------------------------------------
test("E: outward classifier separates push/publish/rm from ls/node", () => {
  const pats = DEFAULT_OUTWARD_PATTERNS;
  assert.equal(isOutward("git push origin main", pats), true);
  assert.equal(isOutward("rm -rf /tmp/x", pats), true);
  assert.equal(isOutward("npm publish --access public", pats), true);
  assert.equal(isOutward("npm version patch", pats), true);
  assert.equal(isOutward("ls -la", pats), false);
  assert.equal(isOutward("node test.mjs", pats), false);
});

// --- F: no hardcoded model id — the real adapter refuses to run without the
//        env var, before touching the network. --------------------------------
test("F: real model adapter requires AR_LOOP_MODEL from the environment", async () => {
  const saved = process.env.AR_LOOP_MODEL;
  delete process.env.AR_LOOP_MODEL;
  try {
    await assert.rejects(
      realModelReply(makeSpec({ task: "t", doneCheck: "false" }), []),
      /AR_LOOP_MODEL/);
  } finally {
    if (saved !== undefined) process.env.AR_LOOP_MODEL = saved;
  }
});

// --- G: the verifier reads exit codes only; an empty predicate is never done. -
test("G: checkDone is exit-code-only and fails closed on empty predicate", () => {
  assert.equal(checkDone("true"), true);
  assert.equal(checkDone("false"), false);
  assert.equal(checkDone(""), false);
  assert.equal(checkDone("   "), false);
  // a command that PRINTS done but exits 1 is not done — output is not parsed
  assert.equal(checkDone("echo done && exit 1"), false);
});
