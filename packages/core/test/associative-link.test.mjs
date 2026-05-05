import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TEST_ROOT = path.join(os.tmpdir(), "ar-associative-link-test-" + Date.now());
const PROJECT = "assoc-proj";

describe("Associative linking", () => {
  let core;
  let associative;

  before(async () => {
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;
    core = await import("../dist/index.js");
    associative = await import("../dist/helpers/associative-link.js");
    core.setRoot(TEST_ROOT);
  });

  beforeEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    core.setRoot(TEST_ROOT);
  });

  after(() => {
    core.resetRoot();
    delete process.env.AGENT_RECALL_ROOT;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("linkToSimilar creates bidirectional edges in graph.json when similar content exists", async () => {
    await seedSimilarMemory(core);

    await associative.linkToSimilar(
      PROJECT,
      "Architecture decision: semantic recall links related memory graph entries for retrieval.",
      "architecture/new-semantic-recall"
    );

    const edges = readEdges(core);
    const forward = edges.find((e) =>
      e.from === "architecture/new-semantic-recall" &&
      e.to.startsWith("architecture/") &&
      e.type === "semantic_similar"
    );
    assert.ok(forward, `Expected forward semantic edge, got ${JSON.stringify(edges, null, 2)}`);

    const backward = edges.find((e) =>
      e.from === forward.to &&
      e.to === "architecture/new-semantic-recall" &&
      e.type === "semantic_similar"
    );
    assert.ok(backward, `Expected backward semantic edge, got ${JSON.stringify(edges, null, 2)}`);
  });

  it("linkToSimilar does not throw when project has no memories yet", async () => {
    await assert.doesNotReject(() =>
      associative.linkToSimilar(
        "empty-assoc-proj",
        "A standalone architecture decision with no prior memories.",
        "architecture/standalone"
      )
    );
  });

  it("graph edges are bidirectional after one linkToSimilar call", async () => {
    await seedSimilarMemory(core);

    await associative.linkToSimilar(
      PROJECT,
      "Architecture decision: semantic recall links related memory graph entries for retrieval.",
      "architecture/new-memory-graph-link"
    );

    const edges = readEdges(core);
    for (const edge of edges.filter((e) => e.from === "architecture/new-memory-graph-link")) {
      const reverse = edges.find((e) =>
        e.from === edge.to &&
        e.to === edge.from &&
        e.type === edge.type
      );
      assert.ok(reverse, `Missing reverse edge for ${JSON.stringify(edge)}`);
    }
  });
});

async function seedSimilarMemory(core) {
  await core.palaceWrite({
    room: "architecture",
    topic: "existing-semantic-recall",
    project: PROJECT,
    content: [
      "Architecture decision: semantic recall links related memory graph entries for retrieval.",
      "Semantic recall should connect related architecture memory graph entries.",
      "Memory graph retrieval uses semantic recall links between related entries.",
    ].join("\n"),
  });
}

function readEdges(core) {
  const graphPath = path.join(core.palaceDir(PROJECT), "graph.json");
  assert.ok(fs.existsSync(graphPath), "Expected graph.json to exist");
  return JSON.parse(fs.readFileSync(graphPath, "utf-8")).edges;
}
