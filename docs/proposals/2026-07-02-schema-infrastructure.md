# Schema Infrastructure — Linked but Independent

**Status:** PROPOSAL — awaiting Tongwu approval. Nothing here is implemented.
**Date:** 2026-07-02
**Context:** HANDOFF "Household Memory Layer" (2026-07-02) + Tongwu's decision: the schema links to AgentRecall-MCP but is independent of it; its eventual home is a separate repository. This doc defines the infrastructure to get there without destabilizing Phase 1.

## 1. What already exists (verified against live code, 2026-07-02)

- Live code lives in `packages/*` workspaces (`core`, `mcp-server`, `sdk`, `cli`). The root `src/` tree is a stale May-era copy — see §7.
- Retrievability machinery is real and matches the handoff: `packages/core/src/palace/fsrs.ts`, `decay-pass.ts`, `hopfield.ts`, `salience.ts`; scoring math in `packages/core/src/MATH.md`. The handoff's integration note (FSRS = retrievability; do not duplicate it for truth decay) is confirmed.
- `Confidence = "high" | "medium" | "low"` already exists at `packages/core/src/types.ts:145`. The new assertion confidence MUST reuse this discrete scale — no parallel `float 0-1` (uncalibrated LLM floats are false precision; the codebase already chose discrete).
- **A proto-spec already exists:** `~/.agent-recall/projects/<project>/MEMORY-PROTOCOL.md` — "self-describing, substrate-independent memory layout… readable and writable by convention alone. Local-first." The open schema is a *formalization* of this document plus the L2 assertion layer — not an invention from zero.

## 2. End-state topology (three artifacts)

```
┌─────────────────────────────────────────────────┐
│ SPEC REPO (separate repo; name parked — coined  │
│ inside the Phase 2 spec doc, locked decision #1)│
│   types + JSON Schema + serialization spec      │
│   + invariants + conformance fixtures           │
│   NO runtime intelligence                       │
└───────────────▲─────────────────────────────────┘
                │ npm dependency
┌───────────────┴─────────────────────────────────┐
│ AgentRecall-MCP = REFERENCE IMPLEMENTATION      │
│   retrieval scoring, FSRS, Hopfield, salience,  │
│   corrections pipeline, MCP tools               │
└───────────────▲─────────────────────────────────┘
                │ conformance suite (must pass 100%)
     any other implementation self-certifies
```

Strategic split, same shape as MCP-vs-Claude: **the format is open** (the portability promise), **the intelligence stays in AgentRecall** (retrieval quality + corrections pipeline = the moat). The spec repo must never absorb the moat.

## 3. Staged path

**Stage 0 — now, inside Phase 1: `packages/schema` in this monorepo.**
- Own `package.json`, own semver, own CHANGELOG from day 1 — independence is enforced by the dependency graph, not by a repo boundary.
- Hard rule, CI-enforced: `packages/schema` imports **nothing** from sibling packages; `core`/`sdk`/`mcp-server`/`cli` import schema. One-way edge only.
- Why not a new repo immediately: schema churn peaks exactly now (Phase 1 field design). Two repos during peak churn = publish→bump→install on every field tweak. A package boundary gives 100% of the independence semantics at 0% of the coordination tax.

**Stage 1 — extraction. Gate: v4 shipped + no breaking schema change for 4 weeks + conformance green.**
- `git subtree split` `packages/schema` → **new repository** (history preserved), publish to npm, AgentRecall-MCP swaps the workspace dep for the npm dep. Mechanical, zero migration.
- This is where Tongwu's "new repository" decision lands. Repo creation + npm publish = REDLINE, explicit approval at that moment.

**Stage 2 — promotion. Gate: adoption signal (proposed: ≥N external AgentRecall users or ≥2 third-party integrations).**
- Public positioning, spec prose document written, spec name coined there.
- Rationale: extraction can be activity-gated, but *promotion* must be adoption-gated — publishing a spec with zero adopters only hands the roadmap to Mem0.

## 4. What `packages/schema` contains — and must never contain

**Contains:**
- L2 `Assertion` types (TypeScript) + generated JSON Schema (so non-TS implementations can validate)
- L0/L1/L3/L4 design-stub types — nullable slots only (locked decisions #2/#3)
- Serialization spec: markdown files + YAML frontmatter — field names, allowed values, semantics
- Invariants: supersession chains append-only and acyclic; corrections never delete; `observed` vs `told` provenance sets default confidence
- Conformance fixtures (valid/invalid sample documents + expected outcomes) and a tiny validator CLI
- Migration helpers: `MemoryCategory → decay_class` default mapping, seeded from the `salience.ts` category coefficient table

**Never contains:**
- Retrieval scoring, FSRS/Hopfield, salience, storage engines, MCP tool definitions, Supabase sync. Implementation smarts stay in AgentRecall-MCP.

## 5. The spec's unit is a FILE FORMAT, not an API

"vCard for agent memory." The portable artifact is a **directory of markdown files with YAML frontmatter** — restore-a-new-phone = copy the directory. Grounding: AgentRecall already stores exactly this (local markdown, git-backable), and MEMORY-PROTOCOL.md already promises convention-only readability.

- The assertion layer is **frontmatter annotation on existing records** — the markdown body stays free-form. No triple-store rewrite of prose memories.
- `schema_version` in frontmatter from day 1; absent = legacy v0 (pre-schema records stay valid forever).
- Assertion metadata fields: `confidence` (high|medium|low, reusing the types.ts:145 scale), `decay_class` (static|slow|volatile), `provenance` ({source_device, source_member?, observed|told}), `superseded_by` (record ID, nullable).

## 6. Open items routed to the L2 working session (HANDOFF Open Question 1)

1. Journal records encode metadata in **filenames** (`2026-06-12--arsave--minor--none--slug.md`); knowledge/corrections layouts differ. Decide per record class: frontmatter, filename convention, or both.
2. Composition of truth-confidence with FSRS retrievability at recall time (Open Question 2). Standing recommendation: two-stage — relevance ranks, confidence annotates + optional floor filter; options doc to follow after the full audit (HANDOFF First Action 1).
3. Whether `decay-pass.ts` (retrievability decay) and the new confidence auto-decay job (truth decay, P1) share a scheduler or run as separate passes.

## 7. Housekeeping flags (approval needed — NOT done)

- Root `src/` tree is a stale May-era duplicate of `packages/` and already caused a wrong-tree audit this session. Propose: verify nothing references it, then `git rm -r src/` — REDLINE, needs explicit yes.
- Fixed this session (reversible hygiene): local git remote `origin` → renamed URL `Goldentrii/AgentRecall-MCP`; both CLAUDE.md "Key Repos" lines corrected. `NovadaLabs/AgentRecall` (org remote) is NOT renamed on GitHub — left untouched.

## 8. Approval asks

1. Stage 0/1/2 gates as defined — extraction at stability, promotion at adoption?
2. `packages/schema` as the internal home now (internal name, disposable at extraction)?
3. File-format-as-spec-unit — markdown + frontmatter annotation layer, no triple rewrite?
4. Discrete confidence reusing the existing scale — no floats?
