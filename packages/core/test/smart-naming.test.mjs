import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { journalFileName, captureLogFileName, resetOwnedFiles } = await import("../dist/index.js");

describe("Smart naming — journalFileName", () => {
  it("generates smart name with saveType and content", () => {
    resetOwnedFiles();
    const name = journalFileName("2026-04-20", false, {
      saveType: "arsave",
      content: "AgentRecall Phase 2.5 intelligent file naming system implemented.",
    });
    assert.ok(name.startsWith("2026-04-20--arsave--"));
    assert.ok(name.includes("L--"));
    assert.ok(name.endsWith(".md"));
  });

  it("includes correct line count", () => {
    resetOwnedFiles();
    const multiLine = "Line one\nLine two\nLine three\nLine four\nLine five";
    const name = journalFileName("2026-04-20", false, {
      saveType: "arsaveall",
      content: multiLine,
    });
    assert.ok(name.includes("--5L--"), `Expected 5L in: ${name}`);
  });

  it("uses hook-end saveType", () => {
    resetOwnedFiles();
    const name = journalFileName("2026-04-20", false, {
      saveType: "hook-end",
      content: "Auto-saved: genome review completed",
    });
    assert.ok(name.includes("--hook-end--"));
  });

  it("uses capture saveType via captureLogFileName", () => {
    resetOwnedFiles();
    const name = captureLogFileName("2026-04-20", false, {
      saveType: "capture",
      content: "Q: What is Next.js?\nA: A React framework.",
    });
    assert.ok(name.includes("--capture--"));
    assert.ok(name.includes("--2L--"));
  });

  it("falls back to legacy naming without opts", () => {
    resetOwnedFiles();
    const name = journalFileName("2026-04-20", false);
    assert.equal(name, "2026-04-20.md");
  });

  it("falls back to legacy session-id naming when base exists", () => {
    resetOwnedFiles();
    const name = journalFileName("2026-04-20", true);
    assert.ok(name.startsWith("2026-04-20-"));
    assert.ok(name.endsWith(".md"));
    assert.ok(!name.includes("--")); // legacy format, no double-dash
  });

  it("slug is capped at 40 chars", () => {
    resetOwnedFiles();
    const longContent = "This is a very long content about architecture decisions for the new microservices platform redesign involving kubernetes deployment strategies and load balancing configurations";
    const name = journalFileName("2026-04-20", false, {
      saveType: "arsave",
      content: longContent,
    });
    // Extract slug: split by -- and take last part minus .md
    const parts = name.replace(".md", "").split("--");
    const slug = parts[parts.length - 1];
    assert.ok(slug.length <= 40, `Slug too long: ${slug} (${slug.length} chars)`);
  });

  it("parseable by split('--')", () => {
    resetOwnedFiles();
    const name = journalFileName("2026-04-20", false, {
      saveType: "arsave",
      content: "Genome OS review completed. Gateway skill created.",
    });
    const base = name.replace(".md", "");
    const parts = base.split("--");
    assert.equal(parts.length, 4, `Expected 4 parts, got ${parts.length}: ${parts}`);
    assert.equal(parts[0], "2026-04-20");
    assert.equal(parts[1], "arsave");
    assert.ok(parts[2].endsWith("L"));
    assert.ok(parts[3].length > 0);
  });
});
