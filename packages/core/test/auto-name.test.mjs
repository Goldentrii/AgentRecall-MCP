import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import from dist — build before running
const { generateSlug, detectContentType, extractKeywords, generateTopicName } = await import("../dist/index.js");

describe("Auto-naming — detectContentType", () => {
  it("detects bug-fix content", () => {
    // Requires ≥2 signals: "bug" + "error" both match bug-fix patterns
    assert.equal(detectContentType("Fixed a bug: the login form threw an error on submit"), "bug-fix");
  });

  it("detects architecture content", () => {
    assert.equal(detectContentType("The system architecture uses a microservices design with REST API"), "architecture");
  });

  it("detects decision content", () => {
    assert.equal(detectContentType("We decided to use PostgreSQL and chose Drizzle as the ORM"), "decision");
  });

  it("detects insight content", () => {
    assert.equal(detectContentType("I realized that the observation about caching patterns applies broadly"), "insight");
  });

  it("detects tool-config content", () => {
    assert.equal(detectContentType("Install the MCP server plugin and configure the setup"), "tool-config");
  });

  it("detects goal content", () => {
    assert.equal(detectContentType("Our goal is to reach the milestone of 100 users by the target date"), "goal");
  });

  it("detects blocker content", () => {
    assert.equal(detectContentType("Blocked on the dependency — stuck waiting for approval"), "blocker");
  });

  it("detects lesson content", () => {
    assert.equal(detectContentType("Lesson learned: never again deploy on Friday. Always remember to test."), "lesson");
  });

  it("returns general for ambiguous content", () => {
    assert.equal(detectContentType("Hello world this is some random text"), "general");
  });
});

describe("Auto-naming — extractKeywords", () => {
  it("removes stopwords and returns top N", () => {
    const kws = extractKeywords("The quick brown fox jumps over the lazy dog", 3);
    assert.ok(kws.length <= 3);
    assert.ok(!kws.includes("the"));
    assert.ok(!kws.includes("over"));
  });

  it("gives header words higher weight", () => {
    const content = "# Authentication System\n\nThis module handles login and password reset flows.";
    const kws = extractKeywords(content, 3);
    // "authentication" or "system" should appear since headers get 2x weight
    assert.ok(
      kws.some((k) => k.includes("authentication") || k.includes("system")),
      `Expected header words in ${JSON.stringify(kws)}`
    );
  });

  it("returns empty array for empty content", () => {
    const kws = extractKeywords("", 3);
    assert.equal(kws.length, 0);
  });

  it("respects limit parameter", () => {
    const kws = extractKeywords(
      "React components rendering virtual DOM elements with hooks and state management",
      2
    );
    assert.ok(kws.length <= 2);
  });

  it("deduplicates stems — keeps shorter form", () => {
    const kws = extractKeywords(
      "deploy deployment deploying servers server configuration",
      5
    );
    // Should not have both "deploy" and "deployment"
    const deployVariants = kws.filter((k) => k.startsWith("deploy"));
    assert.ok(deployVariants.length <= 1, `Too many deploy variants: ${JSON.stringify(kws)}`);
  });
});

describe("Auto-naming — generateSlug", () => {
  it("generates type-keyword slug for bug-fix content", () => {
    // Requires ≥2 signals: "bug" + "error" both match bug-fix patterns
    const result = generateSlug("A critical bug caused an error in the payment processor");
    assert.equal(result.contentType, "bug-fix");
    assert.ok(result.slug.startsWith("bug-fix-"), `Slug should start with bug-fix-: ${result.slug}`);
    assert.ok(result.keywords.length > 0);
  });

  it("generates type-keyword slug for architecture content", () => {
    const result = generateSlug("The API design uses a REST architecture with schema validation");
    assert.equal(result.contentType, "architecture");
    assert.ok(result.slug.startsWith("architecture-"), `Slug should start with architecture-: ${result.slug}`);
  });

  it("falls back to general for generic content", () => {
    const result = generateSlug("Hello world testing one two three");
    assert.equal(result.contentType, "general");
  });

  it("ensures uniqueness when existingSlugs provided", () => {
    const content = "Fixed a critical bug in the authentication module";
    const first = generateSlug(content);
    const second = generateSlug(content, { existingSlugs: [first.slug] });
    assert.notEqual(first.slug, second.slug);
    assert.ok(second.slug.endsWith("-2"), `Expected -2 suffix: ${second.slug}`);
  });

  it("truncates to 60 characters", () => {
    const longContent =
      "Architecture decision about the distributed microservices authentication " +
      "authorization system design with comprehensive schema validation and " +
      "extensive error handling throughout the application";
    const result = generateSlug(longContent);
    assert.ok(result.slug.length <= 60, `Slug too long (${result.slug.length}): ${result.slug}`);
  });

  it("respects context type override", () => {
    const result = generateSlug("Some generic content about servers", { type: "blocker" });
    assert.equal(result.contentType, "blocker");
    assert.ok(result.slug.startsWith("blocker-"));
  });
});

describe("Auto-naming — generateTopicName", () => {
  it("returns title-case keywords", () => {
    const name = generateTopicName("The authentication system handles login and password reset");
    const words = name.split(" ");
    assert.ok(words.length <= 4, `Too many words: ${name}`);
    // Each word should be title-case
    for (const w of words) {
      assert.ok(
        w[0] === w[0].toUpperCase(),
        `Word not title-case: ${w} in ${name}`
      );
    }
  });

  it("returns max 4 words", () => {
    const name = generateTopicName(
      "React components rendering virtual DOM elements with hooks state management context providers"
    );
    const words = name.split(" ");
    assert.ok(words.length <= 4, `Too many words (${words.length}): ${name}`);
  });

  it("returns Untitled for empty content", () => {
    const name = generateTopicName("");
    assert.equal(name, "Untitled");
  });
});
