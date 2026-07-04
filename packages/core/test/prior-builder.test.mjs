import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Wave 4 — prior-injection (target #2).
// buildPriors(prompt, corrections, blindSpots) returns the early-prior lines to
// emit ABOVE the recalled fact list in hook-ambient. Pure + exported so it is
// unit-testable without spawning the CLI.

describe("Wave 4 — buildPriors", () => {
  let mod;

  it("module loads + exposes buildPriors", async () => {
    mod = await import("../dist/tools-logic/prior-builder.js");
    assert.equal(typeof mod.buildPriors, "function");
  });

  it("a prompt overlapping a P0 correction emits an instinct line", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const corrections = [
      { id: "c1", rule: "never push without explicit approval", severity: "p0", tags: ["push", "approval"] },
    ];
    // overlaps on "push" + "approval" (>=2 content tokens) → fires
    const priors = buildPriors(
      "let me push this to npm without waiting for approval",
      corrections,
      [],
    );
    assert.ok(priors.length >= 1, "should emit at least one prior");
    assert.match(priors[0], /AgentRecall instinct/);
    assert.match(priors[0], /past correction/i);
    assert.match(priors[0], /never push without explicit approval/);
  });

  it("requires >=2 token overlap (strict) — single-word overlap does not fire", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const corrections = [
      { id: "c1", rule: "never push without explicit approval", severity: "p0", tags: ["push", "approval"] },
    ];
    // only "push" overlaps → 1 token → below the >=2 floor
    const priors = buildPriors("can you push this button", corrections, []);
    assert.equal(priors.length, 0, "single-token overlap must not fire");
  });

  it("blind spots get a softer line (not the correction-override phrasing)", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const blindSpots = ["infrastructure over revenue: building tooling instead of shipping features"];
    const priors = buildPriors(
      "let me build more infrastructure tooling for the revenue dashboard",
      [],
      blindSpots,
    );
    assert.ok(priors.length >= 1, "blind-spot prior should fire");
    assert.match(priors[0], /AgentRecall/);
    // softer: must NOT claim a hard correction override
    assert.doesNotMatch(priors[0], /past correction/i);
  });

  it("caps at 2 priors", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const corrections = [
      { id: "c1", rule: "do not push without approval", severity: "p0", tags: ["push", "approval"] },
      { id: "c2", rule: "do not deploy without approval", severity: "p0", tags: ["deploy", "approval"] },
      { id: "c3", rule: "do not delete files after approval push", severity: "p0", tags: ["delete", "push", "approval"] },
    ];
    const priors = buildPriors(
      "push deploy delete approval push approval deploy",
      corrections,
      [],
    );
    assert.ok(priors.length <= 2, "must cap at 2 priors");
  });

  it("empty inputs return no priors and never throw", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    assert.deepEqual(buildPriors("", [], []), []);
    assert.deepEqual(buildPriors("some unrelated prompt text here", [], []), []);
  });
});

// FIX 2 — domain-noise filter for blind-spot matching (MIN_OVERLAP threshold).
//
// Two global blind spots in awareness-state.json were identified as overmatching:
//
// ID:   global-blind-spot-no-revenue  (no correction .json file — lives in awareness-state.json)
// Rule: "No revenue from any product — 17 projects, 0 paying customers"
// Why:  Tokens: customers, paying, product, projects, revenue.
//       'product' and 'projects' are extremely common in any engineering session,
//       causing the prior to fire on prompts like "how are the product and projects
//       going?" — 2-token overlap met by generic terms, not genuine context.
//
// ID:   global-blind-spot-novada-proxy-competitive  (awareness-state.json)
// Rule: "novada-proxy competitive benchmark blocked on competitor API keys"
// Why:  Tokens: api, benchmark, blocked, competitive, competitor, keys, novada-proxy.
//       'api' and 'keys' co-occur in virtually every auth/integration prompt
//       ("check the API keys", "update API keys in env"), triggering a warning
//       about novada-proxy competitor access when the prompt is unrelated.
//
// Code-level fix in prior-builder.ts: BLIND_SPOT_DOMAIN_NOISE set strips
// high-frequency dev tokens (api, keys, product, projects, ...) from both sides
// before the MIN_OVERLAP count. Correction priors are NOT affected — they use
// the full tokenizer (correction rules are specific enough by construction).

describe("FIX 2 — domain-noise filter for blind-spot matching", () => {
  const OVERMATCH_BLIND_SPOTS = [
    "No revenue from any product — 17 projects, 0 paying customers",
    "novada-proxy competitive benchmark blocked on competitor API keys",
  ];

  it("'check the API keys are configured correctly' does not fire novada-proxy blind spot", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const priors = buildPriors("check the API keys are configured correctly", [], OVERMATCH_BLIND_SPOTS);
    const novadaPrior = priors.find((p) => p.includes("novada-proxy"));
    assert.equal(novadaPrior, undefined, `novada-proxy should not fire on generic API keys prompt, got: ${novadaPrior}`);
  });

  it("'update the API keys in the environment configuration' does not fire novada-proxy blind spot", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const priors = buildPriors("update the API keys in the environment configuration", [], OVERMATCH_BLIND_SPOTS);
    const novadaPrior = priors.find((p) => p.includes("novada-proxy"));
    assert.equal(novadaPrior, undefined, `novada-proxy must not fire on generic API keys prompt, got: ${novadaPrior}`);
  });

  it("'how are the product and projects going?' does not fire no-revenue blind spot", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const priors = buildPriors("how are the product and projects going?", [], OVERMATCH_BLIND_SPOTS);
    const revenuePrior = priors.find((p) => p.includes("revenue"));
    assert.equal(revenuePrior, undefined, `no-revenue must not fire on generic project-status prompt, got: ${revenuePrior}`);
  });

  it("'check the product metrics and projects status' does not fire no-revenue blind spot", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const priors = buildPriors("check the product metrics and projects status", [], OVERMATCH_BLIND_SPOTS);
    const revenuePrior = priors.find((p) => p.includes("revenue"));
    assert.equal(revenuePrior, undefined, `no-revenue must not fire on project-metrics prompt, got: ${revenuePrior}`);
  });

  it("genuinely matching prompt still fires no-revenue blind spot (revenue + paying customers)", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const priors = buildPriors(
      "we have no revenue and zero paying customers yet",
      [],
      OVERMATCH_BLIND_SPOTS
    );
    const revenuePrior = priors.find((p) => p.includes("revenue"));
    assert.ok(revenuePrior, "genuine no-revenue context must still fire the blind-spot prior");
  });

  it("genuinely matching prompt still fires novada-proxy blind spot (novada-proxy + benchmark)", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    const priors = buildPriors(
      "the novada-proxy benchmark keeps failing on the competitor endpoint",
      [],
      OVERMATCH_BLIND_SPOTS
    );
    const novadaPrior = priors.find((p) => p.includes("novada-proxy"));
    assert.ok(novadaPrior, "genuine novada-proxy benchmark context must still fire the prior");
  });

  it("domain-noise filter does NOT affect correction priors (corrections use full tokenizer)", async () => {
    const { buildPriors } = await import("../dist/tools-logic/prior-builder.js");
    // A correction with 'api' + 'keys' in its rule still fires when a prompt
    // matches — because corrections are ground-truth and use the full tokenizer.
    const corrections = [
      {
        id: "c-test",
        rule: "Do NOT put API key secrets in KV — safety first",
        severity: "p0",
        tags: ["api", "keys", "secrets"],
      },
    ];
    // Prompt overlaps on 'api', 'keys', 'secrets' (3 tokens, though api+keys are
    // in domain noise, corrections bypass the noise filter)
    const priors = buildPriors(
      "can I store the API keys and secrets directly in KV storage?",
      corrections,
      []
    );
    // For corrections: 'secrets' alone surviving the noise filter still gives
    // 1-token overlap, but we're not filtering corrections. The original full
    // tokenizer gets api+keys+secrets+storage+store from the prompt and
    // api+api-key+secrets+kv+first+put+safety from the rule.
    // secrets overlaps → 1 hit, api overlaps → 1 hit, keys overlaps → 1 hit = 3 total >= 2
    assert.ok(priors.length >= 1, "correction prior must still fire for relevant API-key prompt");
    assert.match(priors[0], /AgentRecall instinct/);
  });
});
