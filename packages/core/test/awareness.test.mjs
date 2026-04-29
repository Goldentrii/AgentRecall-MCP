import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TEST_ROOT = path.join(os.tmpdir(), "ar-awareness-test-" + Date.now());

describe("Awareness system — module integration", () => {
  let awareness;

  before(async () => {
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;
    awareness = await import("../dist/palace/awareness.js");
  });

  after(() => {
    delete process.env.AGENT_RECALL_ROOT;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("initAwareness creates state and markdown files", () => {
    const state = awareness.initAwareness("tongwu — AI product builder");
    assert.equal(state.identity, "tongwu — AI product builder");
    assert.equal(state.topInsights.length, 0);

    // Check files created
    const mdPath = path.join(TEST_ROOT, "awareness.md");
    const jsonPath = path.join(TEST_ROOT, "awareness-state.json");
    assert.ok(fs.existsSync(mdPath));
    assert.ok(fs.existsSync(jsonPath));
  });

  it("readAwareness returns the markdown content", () => {
    const content = awareness.readAwareness();
    assert.ok(content.includes("# Awareness"));
    assert.ok(content.includes("tongwu"));
  });

  it("addInsight adds a new insight", () => {
    const result = awareness.addInsight({
      title: "Agents skip extraction steps under context pressure",
      evidence: "Seen in novada replication sessions",
      appliesWhen: ["replication", "extraction"],
      source: "proxy-veil session",
    });
    assert.equal(result.action, "added");
    assert.equal(result.insight.confirmations, 1);
  });

  it("addInsight merges similar insight (>50% word overlap)", () => {
    const result = awareness.addInsight({
      title: "Agents skip extraction steps when tired",
      evidence: "Second occurrence in brightdata session",
      appliesWhen: ["extraction", "fatigue"],
      source: "brightdata session",
    });
    assert.equal(result.action, "merged");
    assert.equal(result.insight.confirmations, 2);
    // appliesWhen should include both old and new
    assert.ok(result.insight.appliesWhen.includes("replication"));
    assert.ok(result.insight.appliesWhen.includes("fatigue"));
  });

  it("addInsight adds distinct insights separately", () => {
    awareness.addInsight({
      title: "Rate limiting prevents runaway costs",
      evidence: "proxy-veil Browser API incident",
      appliesWhen: ["cost", "browser"],
      source: "proxy-veil",
    });
    const state = awareness.readAwarenessState();
    assert.equal(state.topInsights.length, 2);
  });

  it("addInsight replaces lowest when over 20", () => {
    // Reset to clean state
    awareness.initAwareness("overflow test");

    // Add 20 completely distinct insights (no word overlap possible)
    const topics = [
      "PostgreSQL indexing strategies",
      "Kubernetes pod autoscaling",
      "WebSocket connection pooling",
      "GraphQL schema stitching",
      "Redis cluster failover",
      "Docker layer caching",
      "Terraform state locking",
      "gRPC streaming deadlines",
      "OAuth PKCE token rotation",
      "WASM sandboxing boundaries",
      "Rust lifetime elision",
      "Erlang supervision trees",
      "eBPF kernel tracing",
      "Cassandra compaction tuning",
      "Nginx upstream health checks",
      "Envoy proxy circuit breaking",
      "ClickHouse columnar storage",
      "Flink watermark semantics",
      "NATS JetStream delivery",
      "Wasm component interface types",
    ];
    for (const title of topics) {
      awareness.addInsight({
        title,
        evidence: `Evidence for ${title}`,
        appliesWhen: [title.split(" ")[0].toLowerCase()],
        source: "test",
      });
    }
    let state = awareness.readAwarenessState();
    assert.equal(state.topInsights.length, 20);

    // 21st should trigger replacement
    const result = awareness.addInsight({
      title: "Completely novel Zig comptime metaprogramming",
      evidence: "Fresh evidence",
      appliesWhen: ["zig"],
      source: "test",
    });
    assert.equal(result.action, "replaced");
    state = awareness.readAwarenessState();
    assert.equal(state.topInsights.length, 20); // still 20, not 21
  });

  it("writeAwareness enforces 200-line max", () => {
    const longContent = Array.from({ length: 300 }, (_, i) => `Line ${i}`).join("\n");
    awareness.writeAwareness(longContent);
    const content = awareness.readAwareness();
    const lineCount = content.split("\n").length;
    assert.ok(lineCount <= 201, `Expected ≤201 lines, got ${lineCount}`);
  });

  it("renderAwareness includes all sections", () => {
    const state = awareness.readAwarenessState();
    awareness.renderAwareness(state);
    const content = awareness.readAwareness();
    assert.ok(content.includes("## Identity"));
    assert.ok(content.includes("## Top Insights"));
    assert.ok(content.includes("## Trajectory"));
    assert.ok(content.includes("## Blind Spots"));
  });

  it("detectCompoundInsights finds patterns across 3+ insights", () => {
    // Reset with fresh state
    awareness.initAwareness("test user");

    // Add 3 distinct insights sharing "deployment" keyword in appliesWhen
    // Titles must be completely different to avoid merge
    awareness.addInsight({
      title: "PostgreSQL migration rollback strategy",
      evidence: "Seen in prod incident",
      appliesWhen: ["deployment", "database"],
      source: "test",
    });
    awareness.addInsight({
      title: "Kubernetes canary release patterns",
      evidence: "From SRE handbook",
      appliesWhen: ["deployment", "kubernetes"],
      source: "test",
    });
    awareness.addInsight({
      title: "Terraform provider version pinning",
      evidence: "Broke staging once",
      appliesWhen: ["deployment", "infrastructure"],
      source: "test",
    });

    const state = awareness.readAwarenessState();
    assert.equal(state.topInsights.length, 3, "Should have 3 distinct insights");

    const compounds = awareness.detectCompoundInsights();
    assert.ok(compounds.length > 0, "Should detect 'deployment' compound");
    assert.ok(compounds[0].sourceInsights.length >= 3);
  });
});
