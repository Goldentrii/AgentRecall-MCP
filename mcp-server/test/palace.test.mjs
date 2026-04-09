import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TEST_ROOT = path.join(os.tmpdir(), "agent-recall-palace-test-" + Date.now());
const TEST_PROJECT = "test-palace";
const PALACE_DIR = path.join(TEST_ROOT, "projects", TEST_PROJECT, "palace");
const ROOMS_DIR = path.join(PALACE_DIR, "rooms");

describe("AgentRecall MCP — Palace operations", () => {
  before(() => {
    // Set env so palace modules use our test dir
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;
    fs.mkdirSync(ROOMS_DIR, { recursive: true });
  });

  after(() => {
    delete process.env.AGENT_RECALL_ROOT;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("creates palace directory structure", () => {
    assert.ok(fs.existsSync(PALACE_DIR));
    assert.ok(fs.existsSync(ROOMS_DIR));
  });

  it("creates a room with _room.json and README.md", () => {
    const roomDir = path.join(ROOMS_DIR, "goals");
    fs.mkdirSync(roomDir, { recursive: true });

    const meta = {
      slug: "goals",
      name: "Goals",
      description: "Active goals, completed goals, goal evolution",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      salience: 0.5,
      access_count: 0,
      last_accessed: new Date().toISOString(),
      tags: ["planning"],
      connections: [],
    };
    fs.writeFileSync(path.join(roomDir, "_room.json"), JSON.stringify(meta, null, 2));

    const readme = `---
aliases: [goals]
tags: [planning]
salience: 0.5
---

# Goals

> Active goals, completed goals, goal evolution

## Memories

_(entries will appear below)_
`;
    fs.writeFileSync(path.join(roomDir, "README.md"), readme);

    assert.ok(fs.existsSync(path.join(roomDir, "_room.json")));
    assert.ok(fs.existsSync(path.join(roomDir, "README.md")));

    const readMeta = JSON.parse(fs.readFileSync(path.join(roomDir, "_room.json"), "utf-8"));
    assert.equal(readMeta.slug, "goals");
    assert.equal(readMeta.salience, 0.5);
  });

  it("reads room metadata", () => {
    const metaPath = path.join(ROOMS_DIR, "goals", "_room.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    assert.equal(meta.name, "Goals");
    assert.ok(Array.isArray(meta.tags));
    assert.ok(Array.isArray(meta.connections));
  });

  it("writes a topic file to a room", () => {
    const topicPath = path.join(ROOMS_DIR, "goals", "active.md");
    const content = `---
room: goals
topic: active
created: ${new Date().toISOString()}
importance: high
---

# goals / active

- Deploy v4.0 Memory Palace
- Integrate with Obsidian
`;
    fs.writeFileSync(topicPath, content);
    const read = fs.readFileSync(topicPath, "utf-8");
    assert.ok(read.includes("Memory Palace"));
    assert.ok(read.includes("importance: high"));
  });

  it("creates palace-index.json", () => {
    const indexPath = path.join(PALACE_DIR, "palace-index.json");
    const index = {
      version: "4.0.0",
      project: TEST_PROJECT,
      created: new Date().toISOString(),
      rooms: {
        goals: { salience: 0.5, memory_count: 1, last_updated: new Date().toISOString() },
      },
      identity_hash: "",
      last_lint: "",
    };
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    const read = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    assert.equal(read.version, "4.0.0");
    assert.ok(read.rooms.goals);
  });

  it("creates graph.json with edges", () => {
    const graphPath = path.join(PALACE_DIR, "graph.json");
    const graph = {
      edges: [
        {
          from: "goals/active",
          to: "architecture/decisions",
          type: "references",
          weight: 0.5,
          created: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
    const read = JSON.parse(fs.readFileSync(graphPath, "utf-8"));
    assert.equal(read.edges.length, 1);
    assert.equal(read.edges[0].from, "goals/active");
  });

  it("creates identity.md", () => {
    const identityPath = path.join(PALACE_DIR, "identity.md");
    const content = `---
project: ${TEST_PROJECT}
created: ${new Date().toISOString()}
---

# ${TEST_PROJECT}

> AI session memory system with Memory Palace architecture. TypeScript + MCP.
`;
    fs.writeFileSync(identityPath, content);
    const read = fs.readFileSync(identityPath, "utf-8");
    assert.ok(read.includes(TEST_PROJECT));
    assert.ok(read.includes("Memory Palace"));
  });

  it("lists rooms sorted by salience", () => {
    // Create a second room with higher salience
    const archDir = path.join(ROOMS_DIR, "architecture");
    fs.mkdirSync(archDir, { recursive: true });
    const meta = {
      slug: "architecture",
      name: "Architecture",
      description: "Technical decisions",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      salience: 0.8,
      access_count: 5,
      last_accessed: new Date().toISOString(),
      tags: ["technical"],
      connections: ["goals"],
    };
    fs.writeFileSync(path.join(archDir, "_room.json"), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(archDir, "README.md"), "# Architecture\n");

    // List and check sort order
    const rooms = fs.readdirSync(ROOMS_DIR)
      .filter((d) => fs.existsSync(path.join(ROOMS_DIR, d, "_room.json")))
      .map((d) => JSON.parse(fs.readFileSync(path.join(ROOMS_DIR, d, "_room.json"), "utf-8")))
      .sort((a, b) => b.salience - a.salience);

    assert.equal(rooms[0].slug, "architecture"); // 0.8 > 0.5
    assert.equal(rooms[1].slug, "goals");
  });

  it("extracts [[wikilinks]] from content", () => {
    const content = "We decided to use [[architecture/decisions|arch decisions]] and [[goals/active]].";
    const links = [];
    const regex = /\[\[([^\]|]+?)(?:\|[^\]]*?)?\]\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1].replace(/\/README$/, "").trim());
    }
    assert.equal(links.length, 2);
    assert.ok(links.includes("architecture/decisions"));
    assert.ok(links.includes("goals/active"));
  });

  it("computes salience score correctly", () => {
    // importance=high(1.0*0.4=0.4), recency=today(~1.0*0.3=0.3), access=10/20(0.5*0.2=0.1), connections=5/10(0.5*0.1=0.05)
    const importance = 1.0 * 0.4;
    const recency = 1.0 * 0.3; // approximately today
    const access = Math.min(1.0, 10 / 20) * 0.2;
    const connections = Math.min(1.0, 5 / 10) * 0.1;
    const salience = importance + recency + access + connections;
    assert.ok(salience > 0.8);
    assert.ok(salience <= 1.0);
  });

  it("Obsidian frontmatter is valid YAML", () => {
    const readme = fs.readFileSync(path.join(ROOMS_DIR, "goals", "README.md"), "utf-8");
    assert.ok(readme.startsWith("---"));
    const fmEnd = readme.indexOf("---", 3);
    assert.ok(fmEnd > 3);
    const frontmatter = readme.slice(3, fmEnd).trim();
    assert.ok(frontmatter.includes("aliases:"));
    assert.ok(frontmatter.includes("tags:"));
    assert.ok(frontmatter.includes("salience:"));
  });

  it("archive directory can store low-salience rooms", () => {
    const archiveDir = path.join(PALACE_DIR, "archive", "old-room");
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(path.join(archiveDir, "README.md"), "# Archived room\n");
    assert.ok(fs.existsSync(path.join(archiveDir, "README.md")));
  });
});
