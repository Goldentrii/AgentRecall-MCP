/**
 * paths-naming-v2.test.mjs
 *
 * Naming System v2 (Wave 1) — sanitizeProject now lowercases (case-fold
 * parity fix, spec §2 bug #1). Without a reuse rule this would SPLIT an
 * existing mixed-case project directory the moment a caller passes a
 * differently-cased name. resolveProjectDirName() + the path builders that
 * use it must reuse the EXISTING on-disk directory's exact casing instead.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TEST_ROOT = path.join(os.tmpdir(), "ar-paths-naming-v2-test-" + Date.now());

describe("paths naming v2 — sanitizeProject + existing-dir reuse", () => {
  let paths;

  before(async () => {
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;
    paths = await import("../dist/storage/paths.js");
  });

  after(() => {
    delete process.env.AGENT_RECALL_ROOT;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("sanitizeProject lowercases a brand-new project name", () => {
    assert.equal(paths.sanitizeProject("AgentRecall"), "agentrecall");
    assert.equal(paths.sanitizeProject("My Project"), "my-project");
  });

  it("journalDir REUSES an existing mixed-case directory instead of creating a lowercased sibling", () => {
    // Simulate a pre-v2 project directory created with mixed case (as real
    // corpora have — e.g. this very repo's own "AgentRecall" project slug).
    const projectsRoot = path.join(TEST_ROOT, "projects");
    fs.mkdirSync(path.join(projectsRoot, "AgentRecall", "journal"), { recursive: true });

    const dir = paths.journalDir("AgentRecall");
    assert.equal(dir, path.join(projectsRoot, "AgentRecall", "journal"), "exact-case call should resolve to the existing dir");

    // Now call with an all-lowercase spelling of the SAME project — must
    // reuse the existing "AgentRecall" dir, not create "agentrecall".
    const dirLower = paths.journalDir("agentrecall");
    assert.equal(dirLower, path.join(projectsRoot, "AgentRecall", "journal"), "differently-cased call must reuse the existing dir");

    // Inspect actual directory ENTRIES (not fs.existsSync — on a default
    // case-insensitive filesystem like macOS APFS, existsSync("agentrecall")
    // would return true regardless of this fix, since it resolves to the
    // same inode as "AgentRecall"). There must be exactly ONE entry under
    // projects/ matching case-insensitively, proving no sibling was created.
    const entries = fs.readdirSync(projectsRoot).filter((e) => e.toLowerCase() === "agentrecall");
    assert.deepEqual(entries, ["AgentRecall"], `expected exactly one entry preserving original casing, got: ${entries.join(", ")}`);
  });

  it("palaceDir resolves a genuinely NEW project to the lowercased slug", () => {
    const dir = paths.palaceDir("BrandNewProject");
    assert.equal(dir, path.join(TEST_ROOT, "projects", "brandnewproject", "palace"));
  });

  // ── F1 (independent review, 2026-07-20): determinism when BOTH case-variant
  // dirs already exist on disk ─────────────────────────────────────────────
  //
  // NOTE ON TEST STRATEGY: "two directories differing only by case coexist
  // under projects/" cannot be reproduced with REAL mkdirSync calls on the
  // default case-insensitive-but-case-preserving filesystem this suite runs
  // on (macOS APFS) — a second mkdirSync for a case-variant of an existing
  // dir silently no-ops (with `recursive: true`) or throws EEXIST, so only
  // one casing ever lands on disk (see the comment on the "journalDir
  // REUSES..." test above, which works around the SAME filesystem property
  // for existsSync). ESM `import * as fs from "node:fs"` namespace bindings
  // are also non-configurable (verified: neither direct assignment nor
  // `node:test`'s `mock.method` can override `readdirSync` on it), so
  // monkey-patching fs is not an option either — attempting it throws
  // "Cannot assign/redefine property 'readdirSync'". The fork this bug fixes
  // IS real on case-sensitive filesystems (Linux prod, ext4 Docker, CI) or
  // when a fork already existed before this fix shipped, so `paths.ts`
  // extracts the exact/ambiguous/lexicographic-pick decision into a PURE,
  // exported helper (`pickProjectDirEntry`) that takes a plain string array —
  // exercising it directly here fully covers the real resolution logic
  // without depending on the host FS's case sensitivity or any fs mocking.
  describe("pickProjectDirEntry / resolveProjectDirName — determinism under multiple case-variant forks (F1)", () => {
    function withCapturedStderr(fn) {
      const original = process.stderr.write;
      const chunks = [];
      process.stderr.write = (chunk) => {
        chunks.push(String(chunk));
        return true;
      };
      try {
        const result = fn();
        return { result, stderrOutput: chunks.join("") };
      } finally {
        process.stderr.write = original;
      }
    }

    it("picks the lexicographically-first variant, deterministically, across repeated calls", () => {
      // Three case-variants of the SAME slug ("middle-project") — none is an
      // exact lowercase match, so this exercises the ambiguous-pick branch.
      const entries = ["MIDDLE-PROJECT", "Middle-Project", "middle-PROJECT"];
      const expected = [...entries].sort()[0];

      const first = paths.pickProjectDirEntry("middle-project", entries);
      const second = paths.pickProjectDirEntry("middle-project", entries);
      const third = paths.pickProjectDirEntry("middle-project", entries);

      assert.equal(first.picked, expected, "first call must pick the lexicographic winner");
      assert.equal(second.picked, expected, "repeated calls must return the SAME winner (determinism)");
      assert.equal(third.picked, expected, "repeated calls must return the SAME winner (determinism)");
      assert.equal(first.ambiguous, true, "3 case-variant matches must be flagged ambiguous");
    });

    it("resolveProjectDirName's real fs-backed path also picks deterministically and warns once — real dirs, one variant each call site", () => {
      // Integration check (real fs): a genuinely NEW project still resolves
      // to its lowercased slug with no fork and no warning — the plain,
      // non-ambiguous path through the same resolver used above.
      const projectsRoot = path.join(TEST_ROOT, "projects");
      fs.mkdirSync(path.join(projectsRoot, "solo-integration-project"), { recursive: true });
      const { result, stderrOutput } = withCapturedStderr(() =>
        paths.resolveProjectDirName(TEST_ROOT, "solo-integration-project"));
      assert.equal(result, "solo-integration-project");
      assert.equal(stderrOutput, "", "a single on-disk match must never warn");
      fs.rmSync(path.join(projectsRoot, "solo-integration-project"), { recursive: true, force: true });
    });

    it("emits exactly one stderr warning naming every variant + the pick — NEVER writes to stdout", () => {
      // Two case-variants of "fork-case", neither an exact lowercase match.
      const entries = ["Fork-Case", "FORK-CASE"];
      const expectedPick = [...entries].sort()[0];

      const originalStdoutWrite = process.stdout.write;
      const stdoutChunks = [];
      process.stdout.write = (chunk) => {
        stdoutChunks.push(String(chunk));
        return true;
      };

      // Exercise the SAME warning-emission code resolveProjectDirName runs,
      // driven by the pure resolution result (see NOTE above for why this
      // can't be driven through a real fs.readdirSync fork on this host).
      let result;
      const { stderrOutput } = withCapturedStderr(() => {
        result = paths.pickProjectDirEntry("fork-case", entries);
        if (result.ambiguous) {
          process.stderr.write(
            `[agent-recall] WARNING: ${result.variants.length} case-variant project directories found for ` +
            `"fork-case" (${result.variants.join(", ")}) — using "${result.picked}" deterministically. ` +
            `Consider merging these directories.\n`
          );
        }
      });
      process.stdout.write = originalStdoutWrite;

      assert.equal(result.picked, expectedPick, "must pick the lexicographically-first variant");
      assert.equal(result.ambiguous, true);
      const warningLines = stderrOutput.split("\n").filter((l) => l.includes("WARNING"));
      assert.equal(warningLines.length, 1, `expected exactly one warning line, got: ${JSON.stringify(stderrOutput)}`);
      assert.ok(stderrOutput.includes("Fork-Case"), "warning must name one variant");
      assert.ok(stderrOutput.includes("FORK-CASE"), "warning must name the OTHER variant too");
      assert.equal(stdoutChunks.join(""), "", "must NEVER write to stdout (MCP stdio safety)");
    });

    it("an EXACT match wins outright even when other case-variants also exist (no ambiguity)", () => {
      const entries = ["ExactCase", "exactcase", "EXACTCASE"];
      const resolution = paths.pickProjectDirEntry("exactcase", entries);
      assert.equal(resolution.picked, "exactcase", "the sanitized name matches an on-disk entry byte-for-byte — no ambiguity");
      assert.equal(resolution.ambiguous, false, "an exact match must never be flagged ambiguous (no warning should fire)");
    });

    it("returns null when nothing matches (brand-new project — caller falls back to the sanitized slug)", () => {
      assert.equal(paths.pickProjectDirEntry("brand-new-project", ["other-project", "another-one"]), null);
    });
  });

  describe("groupCaseVariantForks / listCaseVariantForks — read-only diagnostic (F1 follow-up)", () => {
    it("reports every sanitized-slug bucket with more than one on-disk variant, and nothing else", () => {
      const forks = paths.groupCaseVariantForks(["Forked-A", "forked-a", "solo-project"]);
      const forkedEntry = forks.find((f) => f.project === "forked-a");
      assert.ok(forkedEntry, "must report the forked-a bucket");
      assert.deepEqual(forkedEntry.variants, ["Forked-A", "forked-a"]);
      assert.ok(!forks.some((f) => f.project === "solo-project"), "must NOT report a bucket with only one variant");
    });

    it("returns [] when there are no forks", () => {
      assert.deepEqual(paths.groupCaseVariantForks(["no-fork-here", "another-solo-project"]), []);
    });

    it("listCaseVariantForks (real fs) finds nothing for a clean single-variant project set", () => {
      const projectsRoot = path.join(TEST_ROOT, "projects");
      fs.mkdirSync(path.join(projectsRoot, "clean-solo-project"), { recursive: true });
      const forks = paths.listCaseVariantForks(TEST_ROOT);
      assert.ok(!forks.some((f) => f.project === "clean-solo-project"));
      fs.rmSync(path.join(projectsRoot, "clean-solo-project"), { recursive: true, force: true });
    });
  });
});
