import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { stem, getSynonyms, expandQuery } = await import("../dist/index.js");

describe("Normalize — stem", () => {
  it("strips -ing", () => {
    assert.equal(stem("building"), "build");
    assert.equal(stem("running"), "run");
  });

  it("strips -tion", () => {
    assert.equal(stem("extraction"), "extrac");
  });

  it("strips -ment", () => {
    assert.equal(stem("deployment"), "deploy");
  });

  it("strips -ed", () => {
    assert.equal(stem("configured"), "configur");
  });

  it("strips -s", () => {
    assert.equal(stem("components"), "component");
  });

  it("strips -ies → y", () => {
    assert.equal(stem("queries"), "query");
  });

  it("preserves short words", () => {
    assert.equal(stem("api"), "api");
    assert.equal(stem("db"), "db");
  });

  it("lowercases", () => {
    assert.equal(stem("Deploy"), "deploy");
  });
});

describe("Normalize — synonyms", () => {
  it("finds synonyms for deploy", () => {
    const syns = getSynonyms("deploy");
    assert.ok(syns.has(stem("deployment")));
    assert.ok(syns.has(stem("ship")));
    assert.ok(syns.has(stem("release")));
  });

  it("finds synonyms for error", () => {
    const syns = getSynonyms("error");
    assert.ok(syns.has(stem("bug")));
    assert.ok(syns.has(stem("crash")));
  });

  it("finds synonyms for auth", () => {
    const syns = getSynonyms("auth");
    assert.ok(syns.has(stem("login")));
    assert.ok(syns.has(stem("session")));
  });

  it("returns self for unknown words", () => {
    const syns = getSynonyms("xyzzy");
    assert.ok(syns.has("xyzzy"));
    assert.equal(syns.size, 1);
  });
});

describe("Normalize — expandQuery", () => {
  it("expands with stems and synonyms", () => {
    const expanded = expandQuery(["deploying", "errors"]);
    assert.ok(expanded.includes(stem("deploy")));
    assert.ok(expanded.includes(stem("ship")));
    assert.ok(expanded.includes(stem("bug")));
    assert.ok(expanded.includes(stem("crash")));
  });

  it("deduplicates", () => {
    const expanded = expandQuery(["deploy", "deployment"]);
    const unique = new Set(expanded);
    assert.equal(expanded.length, unique.size);
  });

  it("handles empty input", () => {
    assert.deepEqual(expandQuery([]), []);
  });
});
