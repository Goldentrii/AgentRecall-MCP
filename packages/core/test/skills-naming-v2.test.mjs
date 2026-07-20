/**
 * skills-naming-v2.test.mjs
 *
 * Naming System v2 (Wave 1) — palace/skills/ store. Skills already had a
 * reasonable ordinal grammar ("{NNNN}-{slug}.md", same shape as pipeline) —
 * NOT the topic-keyed "{topic}--{slug}.md" the spec's per-store table
 * describes. Wave 1 minimally aligns delimiter ("--") + sanitizer
 * (sanitizeName) rather than restructuring the store around topic-keyed
 * filenames; see the worker report for the full rationale.
 *
 * REWRITE SAFETY: writeSkill is also the REWRITE path (reinforceSkillFsrs,
 * setSkillArchived call it with an existing `order`) — it must reuse the
 * on-disk filename at that order rather than recomputing one, or a rewrite
 * of a pre-v2 (single-dash) skill would silently duplicate into a new
 * v2-named file at the same order.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TEST_ROOT = path.join(os.tmpdir(), "ar-skills-naming-v2-test-" + Date.now());

describe("skills naming v2 — dual delimiter + rewrite safety", () => {
  let skills;
  const PROJECT = "skills-v2-proj";

  before(async () => {
    process.env.AGENT_RECALL_ROOT = TEST_ROOT;
    skills = await import("../dist/palace/skills.js");
  });

  after(() => {
    delete process.env.AGENT_RECALL_ROOT;
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("writeSkill produces the v2 double-dash form for a brand-new skill", () => {
    const filePath = skills.writeSkill(
      PROJECT,
      { slug: "deploy-cloudflare", name: "Deploy via Cloudflare", topic: "deploy", triggers: ["deploy"], created: new Date().toISOString(), updated: new Date().toISOString(), source: "manual" },
      { when: "w", preconditions: [], steps: ["s"], postconditions: ["p"] },
      1,
    );
    assert.equal(path.basename(filePath), "0001--deploy-cloudflare.md");
  });

  it("listSkills reads a LEGACY single-dash file", () => {
    const dir = skills.skillsDir(PROJECT);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "0002-legacy-skill.md"),
      `---\nslug: "legacy-skill"\nname: "Legacy Skill"\ntopic: "git"\ntriggers: ["legacy"]\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"\nsource: "manual"\n---\n\n# Legacy Skill\n\n## When\nw\n\n## Preconditions\n- _(none)_\n\n## Steps\n- s\n\n## Postconditions\n- p\n`,
      "utf-8",
    );
    const list = skills.listSkills(PROJECT);
    const legacy = list.find((s) => s.meta.slug === "legacy-skill");
    assert.ok(legacy, "legacy single-dash skill should be listed");
  });

  it("parseSkillFile falls back to a correct slug for a double-dash filename with no frontmatter slug", () => {
    const dir = skills.skillsDir(PROJECT);
    const filePath = path.join(dir, "0003--no-frontmatter-slug.md");
    fs.writeFileSync(
      filePath,
      `---\nname: "No Slug"\ntopic: "misc"\ntriggers: []\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"\nsource: "manual"\n---\n\n# No Slug\n\n## When\nw\n\n## Preconditions\n- _(none)_\n\n## Steps\n- s\n\n## Postconditions\n- p\n`,
      "utf-8",
    );
    const parsed = skills.parseSkillFile(filePath);
    // Must NOT retain a stray leading "-" (the split/join bug this fixes).
    assert.equal(parsed.meta.slug, "no-frontmatter-slug");
  });

  it("REWRITE SAFETY: writing back to an existing LEGACY single-dash skill reuses its filename (no orphan)", () => {
    const dir = skills.skillsDir(PROJECT);
    // Pre-seed a v1 (single-dash) skill file directly at order 5.
    fs.writeFileSync(
      path.join(dir, "0005-old-style-skill.md"),
      `---\nslug: "old-style-skill"\nname: "Old Style"\ntopic: "auth"\ntriggers: ["auth"]\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"\nsource: "manual"\n---\n\n# Old Style\n\n## When\nw\n\n## Preconditions\n- _(none)_\n\n## Steps\n- s\n\n## Postconditions\n- p\n`,
      "utf-8",
    );

    // Rewrite it (as reinforceSkillFsrs/setSkillArchived would) by calling
    // writeSkill again with the SAME order.
    skills.writeSkill(
      PROJECT,
      { slug: "old-style-skill", name: "Old Style (updated)", topic: "auth", triggers: ["auth"], created: "2026-01-01T00:00:00.000Z", updated: new Date().toISOString(), source: "manual" },
      { when: "w2", preconditions: [], steps: ["s"], postconditions: ["p"] },
      5,
    );

    const filesAtOrder5 = fs.readdirSync(dir).filter((f) => f.startsWith("0005-"));
    assert.equal(filesAtOrder5.length, 1, `expected exactly 1 file at order 5, got ${filesAtOrder5.length}: ${filesAtOrder5.join(", ")}`);
    assert.equal(filesAtOrder5[0], "0005-old-style-skill.md");

    const content = fs.readFileSync(path.join(dir, filesAtOrder5[0]), "utf-8");
    assert.ok(content.includes("Old Style (updated)"));
  });

  // ── F3 (independent review, 2026-07-20): reinforceSkillFsrs case-insensitive
  // lookup ──────────────────────────────────────────────────────────────────
  describe("reinforceSkillFsrs — case-insensitive legacy-file lookup (F3)", () => {
    it("reinforces a legacy skill whose ON-DISK slug preserves its original (uppercase) case", () => {
      const dir = skills.skillsDir(PROJECT);
      fs.mkdirSync(dir, { recursive: true });

      // Legacy (pre-v2) skill file: single-dash delimiter, filename slug
      // preserves original case ("Cloudflare-DNS-Setup"), and an FSRS state
      // stale enough that its retrievability has decayed measurably (30 days
      // since last_confirmed against the default 7-day initial stability).
      const staleConfirmed = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const filePath = path.join(dir, "0009-Cloudflare-DNS-Setup.md");
      fs.writeFileSync(
        filePath,
        `---\nslug: "Cloudflare-DNS-Setup"\nname: "Cloudflare DNS Setup"\ntopic: "deploy"\ntriggers: ["cloudflare", "dns"]\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"\nsource: "manual"\nfsrs: {"stability":7,"last_confirmed":"${staleConfirmed}","confirmations":1}\n---\n\n# Cloudflare DNS Setup\n\n## When\nw\n\n## Preconditions\n- _(none)_\n\n## Steps\n- s\n\n## Postconditions\n- p\n`,
        "utf-8",
      );

      const before = skills.parseSkillFile(filePath);
      assert.ok(before.meta.fsrs.stability === 7 && before.meta.fsrs.confirmations === 1, "sanity: seeded stale FSRS state");

      // Reinforce using the SAME slug the frontmatter/filename carry
      // (uppercase) — this is the call site that had no `order` to reuse
      // findExistingSkillFile with directly (F3's fix: case-insensitive
      // fallback match instead).
      skills.reinforceSkillFsrs(PROJECT, "Cloudflare-DNS-Setup", new Date().toISOString());

      const filesAtOrder9 = fs.readdirSync(dir).filter((f) => f.startsWith("0009-") || f.startsWith("0009--"));
      assert.equal(filesAtOrder9.length, 1, `expected exactly 1 file at order 9 (no orphan duplicate), got ${filesAtOrder9.length}: ${filesAtOrder9.join(", ")}`);

      const after = skills.parseSkillFile(path.join(dir, filesAtOrder9[0]));
      assert.equal(after.meta.fsrs.confirmations, 2, "reinforcement must bump confirmations (proves the file was actually found and rewritten)");
      assert.ok(after.meta.fsrs.stability > before.meta.fsrs.stability, "reinforcement must grow stability");
      assert.notEqual(after.meta.fsrs.last_confirmed, staleConfirmed, "last_confirmed must advance to the reinforcement time");

      // Retrievability at the moment of reinforcement is exp(0) = 1 (fresh) —
      // strictly greater than the pre-reinforcement retrievability computed
      // against the same "now", proving the bump actually landed.
      const ageDaysBefore = (Date.now() - new Date(staleConfirmed).getTime()) / 86_400_000;
      const retrievabilityBefore = Math.exp(-ageDaysBefore / before.meta.fsrs.stability);
      const retrievabilityAfter = Math.exp(-0 / after.meta.fsrs.stability); // last_confirmed ~= now
      assert.ok(retrievabilityAfter > retrievabilityBefore, "retrievability must bump upward after reinforcement");
    });

    it("still reinforces when called with the already-lowercase slug (regression guard — must not require exact case)", () => {
      const dir = skills.skillsDir(PROJECT);
      fs.mkdirSync(dir, { recursive: true });

      const staleConfirmed = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const filePath = path.join(dir, "0010-Uppercase-Slug-Example.md");
      fs.writeFileSync(
        filePath,
        `---\nslug: "Uppercase-Slug-Example"\nname: "Example"\ntopic: "misc"\ntriggers: []\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"\nsource: "manual"\nfsrs: {"stability":7,"last_confirmed":"${staleConfirmed}","confirmations":1}\n---\n\n# Example\n\n## When\nw\n\n## Preconditions\n- _(none)_\n\n## Steps\n- s\n\n## Postconditions\n- p\n`,
        "utf-8",
      );

      // Caller passes the LOWERCASE spelling this time.
      skills.reinforceSkillFsrs(PROJECT, "uppercase-slug-example", new Date().toISOString());

      const filesAtOrder10 = fs.readdirSync(dir).filter((f) => f.startsWith("0010-"));
      assert.equal(filesAtOrder10.length, 1, `expected exactly 1 file, got ${filesAtOrder10.length}: ${filesAtOrder10.join(", ")}`);
      const after = skills.parseSkillFile(path.join(dir, filesAtOrder10[0]));
      assert.equal(after.meta.fsrs.confirmations, 2, "reinforcement must fire regardless of caller's casing");
    });
  });
});
