# AgentRecall v4 — Belief-Semantics Field Design Options
**Date:** 2026-07-02  
**Status:** DECISION DOCUMENT — awaiting Tongwu approval. [AUDIT §N] = live-tree audit (2026-07-02-live-tree-audit.md).

---

## A. Field Definitions Per Record Class

### Governing constraints (do not re-argue)
- `confidence` MUST be `Confidence = "high" | "medium" | "low"` (types.ts:145). Floats banned.
- `superseded_by` already exists on `CorrectionRecord` (corrections.ts:70); corrections already use `retractCorrection()` (corrections.ts:647) and `reviewSupersessions()` (supersession.ts:118). Extend that pattern — do not reinvent.
- `rankCorrections()` formula (corrections.ts:1070): `sev×100 + conf×10 + recency×3 + proof`. The `sev×100` term is load-bearing — any new `confidence` signal feeding this ranker can only reorder within a severity tier, never lift a p1 above a p0 [AUDIT §2.4].
- `decay_class` MUST NOT modify `computeSalience()` inputs. It belongs on a separate truth-decay pass only [AUDIT §4.2].

---

### A.1 Corrections (`CorrectionRecord`, corrections.ts:17)

**Applicable fields:** `confidence`, `provenance`, `superseded_by` (stored); `decay_class` derived, not stored (§A.5)

```typescript
// Add to CorrectionRecord (corrections.ts:17) — all optional, defaulted in
// applyCorrectionDefaults() (corrections.ts:239) like existing optional fields.
confidence?: Confidence;            // "high" | "medium" | "low"  (types.ts:145)
decay_class_override?: DecayClass;  // escape hatch only — class normally derived (§A.5)
provenance?: {
  source: string;                   // session id, tool name, or "unknown"
  mode: "observed" | "told";        // agent inferred vs. user stated
};
// superseded_by?: string — ALREADY EXISTS at corrections.ts:70. No change needed.
```

**Defaults for legacy records** (added to `applyCorrectionDefaults()`, corrections.ts:239):
- `confidence`: derive from existing `weight`/severity: `weight >= 0.8 → "high"`, `>= 0.5 → "medium"`, else `"low"`. Falls back to `"medium"` when `weight` is absent.
- `decay_class` (derived, nothing stored): corrections carry no `MemoryCategory`, so the per-class default is `"slow"` at read time (behavioral rules rarely become false — corrections.ts:2: "persist forever").
- `provenance`: `{ source: holder ?? "unknown", mode: "told" }` — corrections are always user-initiated; "told" is the safe default.

**Write path:** `writeCorrection()` (corrections.ts:523). The capture path already resolves `holder?`; provenance.mode must be supplied by the MCP tool caller (session_end, check_action) or default to `"told"`.

**Ranking impact:** `confidence` on a `CorrectionRecord` maps to the ranker's `conf` slot at corrections.ts:1063 (`r.proof_confidence ?? r.weight ?? 0`). The v4 `confidence` string must be converted to a numeric signal at rank time. Proposed mapping: `"high"→1.0`, `"medium"→0.6`, `"low"→0.3`. This value feeds `conf×10` — maximum contribution 10, safely within the p0/p1 tier boundary enforced by `sev×100`.

---

### A.2 Palace Room Memories (README.md `###`-blocks within `palace/rooms/{slug}/`)

**Applicable fields:** `confidence`, `provenance`, `superseded_by` (stored); `decay_class` derived from room category (§A.5)

**Problem:** Individual `###`-blocks carry no per-entry frontmatter today [AUDIT §3.3, §5.1]. There is no per-memory write API — memories are appended as markdown blocks; `RoomMeta` (_room.json) is room-level, not memory-level.

**Recommended encoding:** Add a companion `_memories.json` index per room (alongside `_room.json`) with an entry keyed by memory-block stable id (hash of title + first 80 chars). This avoids retrofitting inline YAML into the markdown body (which would require parser changes in palace/rooms.ts) while enabling per-memory metadata.

```typescript
// packages/schema — new type, NOT in packages/core yet
export interface PalaceMemoryMeta {
  id: string;                            // stable hash of "### <title>" + excerpt prefix
  confidence?: Confidence;               // types.ts:145
  decay_class_override?: DecayClass;     // escape hatch — normally derived (§A.5)
  provenance?: { source: string; mode: "observed" | "told" };
  superseded_by?: string;                // id of the superseding memory block
  superseded_at?: string;                // ISO timestamp
}
```

**Defaults for legacy records:** All fields absent = inferred at read time: `confidence: "medium"`, `decay_class` derived (room category; absent → `general` → `"slow"`), `provenance: { source: "unknown", mode: "observed" }`. No backfill required — the companion file starts empty; metadata accumulates as rooms are accessed.

**`superseded_by` on palace memories:** Unlike corrections (which have `retractCorrection()` and `active:false`), palace memories today have no retraction mechanism. The proposal: `superseded_by` is an audit pointer only — the superseded block stays in the markdown for history, the superseding entry references it. A `retractPalaceMemory()` function analogous to `retractCorrection()` is a Phase 2 item; do not block field design on it.

**Write path:** `palaceWrite()` → palace/rooms.ts writers. The companion `_memories.json` would be written in the same call, after the markdown block is appended.

---

### A.3 Insights (`IndexedInsight`, insights-index.ts:92)

**Applicable fields:** `confidence`, `provenance`, `superseded_by` (stored); `decay_class` derived (§A.5)

```typescript
// Extend IndexedInsight (insights-index.ts:92) — all optional
confidence?: Confidence;                 // types.ts:145
decay_class_override?: DecayClass;       // escape hatch — normally derived (§A.5)
provenance?: { source: string; mode: "observed" | "told" };
superseded_by?: string;                  // id of the insight that replaced this one
```

**Note on `CompoundInsight.confidence`:** That is a float (awareness.ts:129) tracking pattern strength — a different semantic. Do not change it. The new `confidence` field here is on `IndexedInsight`, not `CompoundInsight`.

**Defaults for legacy records:** `addIndexedInsight()` uses `Omit<IndexedInsight, "id" | "confirmed_count" | "last_confirmed">` (insights-index.ts:147) — existing records without the new fields read as `undefined`; no migration needed. Default at read time: `confidence: "medium"`, `decay_class` derived (class default `"slow"`), `provenance: { source: "unknown", mode: "observed" }` (insights are agent-inferred by default).

**Write path:** `addIndexedInsight()` (insights-index.ts:147). The caller (currently session_end tooling) must pass `provenance.mode`. The confirm-first path (containment overlap ≥ 0.6) merges into an existing entry — on merge, if the incoming confidence is higher, upgrade the stored value; never downgrade on merge.

**`superseded_by` on insights:** No `retractInsight()` exists today. Same recommendation as palace memories: audit pointer only in v4; active lifecycle management is Phase 2.

---

### A.4 Journal Entries (`JournalEntry` / YAML frontmatter, storage/session.ts)

**Applicable fields:** `provenance` only; `confidence` and `decay_class` do not apply; `superseded_by` does not apply.

**Rationale:**
- Journal entries are narrative records of what happened, not factual assertions about the world. Truth-decay semantics do not apply to "what we did on 2026-07-02." `confidence` and `decay_class` are meaningless on a journal entry.
- `superseded_by` is also inapplicable: journals are append-only audit logs by design; corrections to past journal entries are made via new entries.
- `provenance.mode` (observed|told) is useful: entries written at `session_end` by the agent = `"observed"`; entries written by a human-directed `arsave` = `"told"`.

```yaml
# YAML frontmatter addition to journal files
provenance_mode: "observed"    # or "told"
provenance_source: "session_end"  # tool name or session id
```

**Write path:** `journalWrite()` called from session_end.ts. Journal files already carry YAML frontmatter (`type`, `project`, `date`, `tags`, `created` — [AUDIT §3.1]); two new keys, no parser change.

**Defaults for legacy records:** Absent = `provenance_mode: "observed"`, `provenance_source: "unknown"`. No backfill needed — the YAML parser already treats absent keys as undefined.

---

### A.5 `decay_class`: Two Options (required by brief)

**Option 1 — Stored field on the record**

Each record carries `decay_class?: "static" | "slow" | "volatile"` explicitly. The caller sets it at write time; it persists unchanged.

- **User overridability:** Full — any record can be individually marked "static" regardless of category.
- **Migration cost:** Zero for corrections and insights (optional field, defaults at read time). Medium for palace memories (requires the companion `_memories.json` introduced above).
- **Drift risk:** HIGH. `decay_class` on a correction can diverge from the correction's `MemoryCategory` if a correction is recategorized but `decay_class` is not updated. Two conflicting signals on the same record.

**Option 2 — Computed mapping from `MemoryCategory` (audit's lean, [AUDIT §4.2, §6.2])**

No stored field. At read time, derive from the actual `CATEGORY_DECAY` coefficients (salience.ts:37-45) with explicit cutoffs on coefficient `c`: **`c ≥ 0.98 → "static"` · `0.95 ≤ c < 0.98 → "slow"` · `c < 0.95 → "volatile"`**. Monotonic by construction — higher coefficient ⇒ slower class, equal coefficients ⇒ same class, no inversions possible:

```typescript
const CATEGORY_TO_DECAY_CLASS: Record<MemoryCategory, DecayClass> = {
  goal:         "static",   // 0.99 (salience.ts:38)
  architecture: "static",   // 0.98 (salience.ts:39)
  decision:     "slow",     // 0.97 (salience.ts:40)
  lesson:       "slow",     // 0.97 (salience.ts:41)
  observation:  "slow",     // 0.95 (salience.ts:42)
  general:      "slow",     // 0.95 (salience.ts:44)
  blocker:      "volatile", // 0.90 (salience.ts:43)
};
```

The table buckets coefficients the codebase already chose — nothing invented. Truth-volatile facts whose category under-signals it (e.g. a location fact filed as `observation`) use the `decay_class_override?` escape hatch.

- **User overridability:** Partial — user changes `MemoryCategory`; `decay_class` follows. Individual override requires adding a stored field back as an escape hatch (`decay_class_override?: DecayClass`).
- **Migration cost:** ZERO — no field added to existing records; the mapping lives in `packages/schema`.
- **Drift risk:** LOW — single source of truth. If the category is correct, the decay class is correct.

**Recommendation:** Option 2, with an escape hatch. The `MemoryCategory` values in the live codebase (types.ts:149) already encode the truth-halflife semantics implicitly (architecture decisions outlast blockers). Making this mapping explicit and computable eliminates a new write-time field on every record, removes migration cost, and prevents the drift problem. The escape hatch (`decay_class_override?: DecayClass`) handles the rare case where a user has strong reason to override.

**Trade-off summary:**

| Dimension | Option 1 (stored) | Option 2 (computed) |
|-----------|-------------------|---------------------|
| Override granularity | Per record | Via category + escape hatch |
| Migration cost | ~0 (optional) | 0 (no field) |
| Drift risk | High (two fields can disagree) | Low (one source of truth) |
| Schema surface area | +1 field on 3 record classes | +1 mapping table in schema pkg |
| Audit legibility | Field visible in JSON | Requires schema lookup |

---

## B. Worked Example

### Primary: coding-agent, "repo uses Next.js 15"

**Event 1 — initial record (told, high, slow)**

The user states: "This repo uses Next.js 15." Agent writes a correction via `writeCorrection()`.

```json
{
  "id": "2026-07-01-repo-framework-nextjs15",
  "date": "2026-07-01",
  "severity": "p1",
  "project": "apqc-platform",
  "rule": "This repo uses Next.js 15",
  "context": "User stated during setup. Framework version is Next.js 15.",
  "tags": ["framework", "nextjs"],
  "kind": "fact",
  "active": true,
  "confidence": "high",  "provenance": { "source": "session_setup_2026-07-01", "mode": "told" },
  "proof_count": 1,
  "proof_confidence": 0.8
}
```

**Event 2 — contradiction ("migrated to Next.js 16")**

Three sessions later, the user states: "We migrated to Next.js 16 last week."  
Agent calls `writeCorrection()` for the new fact, then `retractCorrection()` (corrections.ts:647) on the old record, which sets `superseded_by` (the spread at corrections.ts:668) and rewrites the file atomically.

Old record after `retractCorrection()`:
```json
{
  "id": "2026-07-01-repo-framework-nextjs15",
  "active": false,
  "superseded_by": "2026-07-02-repo-framework-nextjs16",
  "retracted_at": "2026-07-02T09:14:00Z",
  "retract_reason": "Contradicted by user: migrated to Next.js 16"
}
```

New record:
```json
{
  "id": "2026-07-02-repo-framework-nextjs16",
  "date": "2026-07-02",
  "severity": "p1",
  "project": "apqc-platform",
  "rule": "This repo uses Next.js 16",
  "context": "User stated migration completed last week. Replaces 'uses Next.js 15'.",
  "tags": ["framework", "nextjs"],
  "kind": "fact",
  "active": true,
  "confidence": "high",  "provenance": { "source": "session_2026-07-02", "mode": "told" },
  "proof_count": 1,
  "proof_confidence": 0.8
}
```

**What recall returns for "what framework does this repo use":**

Corrections bypass `localRecallSearch()` entirely [AUDIT §2.4]. Being `p1`, neither record is auto-injected at `session_start` (that path loads only P0s via `readP0Corrections` [AUDIT §2.4]); the fact surfaces on the `check_action`/`brief` paths, whose `readActiveCorrections()` filters `active !== false` — so the old Next.js 15 record is invisible there. `rankCorrections()` (corrections.ts:1059) ranks the new record. The agent sees the Next.js 16 fact with `confidence: "high"`, `provenance.mode: "told"`, plus the recall-time DERIVED annotation `decay_class: "slow"` (corrections class default, §A.5) — note neither JSON record above stores a `decay_class` field; the annotation is computed at read time, which is the Option 2 recommendation in action.

If the query reaches `localRecallSearch()` (for palace/journal/insight results), any palace rooms or journal entries that mention "Next.js 15" will surface with their original RRF scores. The agent must reconcile these with the active correction — this is the annotation-flagging problem addressed in Section C.

---

**Sidebar (portability, 5 lines max):** The same JSON shape carries "keys are in the hallway bowl" in a household context: `confidence: "high"`, `provenance: { source: "home-session", mode: "told" }`, and `decay_class_override: "volatile"` (location facts go stale daily — the one case needing the §A.5 escape hatch). If the keys move, `retractCorrection()` on the bowl record, new record for the new location. No new fields required.

---

## C. Retrieval Composition — The Key Open Decision

**Invariant from the brief:** A memory that ranks high but is probably false MUST be visibly flagged so the agent re-verifies. Hiding staleness inside a blended score fails.

### C.1 Option 1 — Two-Stage: Relevance Ranks Unchanged, Confidence Annotates

**Mechanism against the real pipeline:**

`localRecallSearch()` (smart-recall.ts:322) runs identically to today — palace (line 336), journal (line 375), insights (line 412), RRF merge (line 448), hot-window boost (line 460), calibrated confidence set at line 489 via `calibratedConfidence()` (confidence.ts:68; `RRF_LOCAL_MAX = 0.12` at confidence.ts:48). No change to any score.

After RRF, a post-processing step reads the new `confidence` and `decay_class` from the result's source record and attaches them to `SmartRecallResultItem`:

```typescript
// Addition to SmartRecallResultItem (smart-recall.ts:87):
belief_confidence?: Confidence;    // "high"|"medium"|"low" from the stored record
decay_class?: "static"|"slow"|"volatile";  // computed via Option 2 mapping
stale_flag?: boolean;              // true when decay_class="volatile" and record age > threshold
```

An optional `min_confidence` floor filter (caller-supplied) lets session tooling exclude `"low"` confidence records for factual queries without touching the ranker.

**Wall-clock/complexity cost:** Negligible — one JSON field lookup per result item after RRF. Zero change to the O(n log n) RRF sort.

**Benchmark-regression risk:** ZERO. Ranking is untouched; the repo's replay benchmark (`benchmark/replay-results.json`: recall / precision / staleness / correction-correctness — the gate `benchmark/replay-benchmark.mjs` declares "changes must not lower these scores") is unaffected.

**How the agent SEES staleness:** `stale_flag: true` and `belief_confidence: "low"` appear as visible fields on the result item. The MCP tool surfaces these in the response; the calling agent reads them and decides to re-verify. No information is hidden inside a blended score.

---

### C.2 Option 2 — Multiplicative Blend into the RRF Score

**Mechanism against the real pipeline:**

After RRF (smart-recall.ts:448), multiply each item's score by a confidence weight: `score *= confidenceWeight(belief_confidence)` where the mapping is e.g. `"high"→1.0`, `"medium"→0.85`, `"low"→0.6`, absent→1.0.

This would be inserted between the RRF merge (line 448) and the hot-window boost (line 460), or after hot-window but before the Beta feedback section (smart-recall.ts:597, inside `smartRecall()`).

**Wall-clock/complexity cost:** O(n) multiplication after RRF — still negligible.

**Benchmark-regression risk:** HIGH. Any coefficient that departs from 1.0 for existing records (which have no `confidence` field and would default to absent→1.0) is safe for legacy data. But newly written records with `confidence: "medium"` (the default) at 0.85 multiplier would rank 15% lower than legacy records — a systematic bias favoring old over new. This will shift benchmark percentile distributions.

**How the agent SEES staleness:** Poorly. A volatile, low-confidence item that happened to score high before the multiplier will now score lower — but the agent has no visibility into WHY it dropped. It cannot distinguish "less relevant" from "probably stale." The brief's invariant is violated.

---

### C.3 Option 3 — Intent-Aware: Factual Queries Weight Confidence, Audit/Historical Queries Ignore It

**Mechanism against the real pipeline:**

Query classification runs before `localRecallSearch()`. If the query is classified as `"factual"` (pattern: "what is X", "does X use Y", "what version of"), apply Option 1's floor filter with `min_confidence: "medium"`. If classified as `"historical"` ("what happened on X", "when did we"), skip the filter entirely and surface all results including low-confidence ones.

**Wall-clock/complexity cost:** Adds one LLM call (or regex classifier) per query on the `smartRecall()` path (smart-recall.ts:544). An LLM classifier adds 200-800ms latency; the RECALL_BUDGET_MS is 2500ms (smart-recall.ts:528) — a regex classifier is required to keep within budget.

**Benchmark-regression risk:** MEDIUM. The classification itself introduces a new failure mode (misclassified queries). The floor filter, when applied, changes result sets for factual queries.

**How the agent SEES staleness:** Same as Option 1 (annotations are still attached). The intent-routing adds filtering on top; annotations remain visible.

---

### Recommendation: Option 1, with Option 3 as an evolution gate

**Option 1 now.** It is the only option with zero benchmark-regression risk and full compliance with the brief's staleness-visibility invariant. The implementation is a post-RRF annotation pass — safe to ship independently of any ranker change.

**Option 3 later** (Phase 2), gated on: (a) a regex-based intent classifier that reaches ≥95% precision on a held-out query set, (b) at least 4 weeks of Option 1 data showing which query types produce high-confidence vs. low-confidence top results. Option 3 adds value only when the intent signal is reliable enough to gate filtering.

**Option 2 is rejected.** Multiplying confidence into the RRF score hides staleness information from the calling agent, risks regression against the replay-benchmark gate (`benchmark/replay-results.json`), and provides no upgrade path to Option 3.

---

## D. Migration Plan Per Record Class

### D.1 Corrections

- **New fields:** `confidence?`, `provenance?`, rare `decay_class_override?` — `decay_class` itself is computed (§A.5 Option 2), never migrated.
- **`superseded_by`:** Already exists (corrections.ts:70). No change.
- **Default values for legacy records:** Applied in `applyCorrectionDefaults()` (corrections.ts:239), same read-time pattern as the existing `proof_count`/`proof_confidence` defaults: `confidence` derived from `weight`/severity (§A.1), `provenance` from `holder` with `mode: "told"`.
- **Backfill strategy:** None required. `applyCorrectionDefaults()` normalizes at read time; on-disk JSON is not rewritten. The next `writeCorrection()` call for any record will persist the defaults.
- **Rollback note:** All fields are optional. Rolling back v4 leaves these fields as unknown keys in the JSON — parsers that use `strictNullChecks` may warn but will not throw. Zero risk.

### D.2 Palace Room Memories

- **New fields:** Stored in companion `_memories.json` per room dir, not in the markdown blocks.
- **Default values for legacy records:** All absent on first read. Inferred at read time: `confidence: "medium"`, `decay_class: derived from MemoryCategory of the room`, `provenance: { source: "unknown", mode: "observed" }`.
- **Backfill strategy:** Explicit "no backfill needed." The companion file is created on first write after v4 ships; pre-existing rooms operate without it and receive defaults.
- **Rollback note:** Delete the `_memories.json` companion files. The markdown blocks are unmodified; rollback is a file deletion, not a schema migration.

### D.3 Insights

- **New fields:** `confidence?`, `provenance?`, `superseded_by?`, rare `decay_class_override?` added to `IndexedInsight` (insights-index.ts:92).
- **Default values for legacy records:** `undefined` reads as the defined defaults at query time. No migration of the JSON file.
- **Backfill strategy:** None required. The next `addIndexedInsight()` call will write the new fields for new records; existing records in `insights-index.json` are read with defaults applied in the query layer.
- **Rollback note:** The new fields are optional. Remove them from the TypeScript interface and the JSON serializer ignores unknown keys on re-read.

### D.4 Journal Entries

- **New fields:** `provenance_mode` and `provenance_source` in YAML frontmatter.
- **Default values for legacy records:** Absent keys = `provenance_mode: "observed"`, `provenance_source: "unknown"`. The YAML parser already handles absent keys.
- **Backfill strategy:** None. New journal files get the fields; old ones do not. Journal entries are append-only and immutable after creation.
- **Rollback note:** Remove the two frontmatter key writes from session_end.ts. Existing files with the keys are unaffected (extra YAML keys are ignored by the reader).

### D.5 schema_version gating

Per the schema infrastructure proposal (2026-07-02-schema-infrastructure.md §5): add `schema_version` to all frontmatter and JSON records. Absent = v0 (legacy). V4 fields land at schema_version = "4.0". This is the gate for `packages/schema` to validate conformance.

---

## E. Decision Matrix

| Decision | Options | Recommendation | What it blocks |
|---|---|---|---|
| `confidence` type | (A) `Confidence = "high"\|"medium"\|"low"` (reuse types.ts:145); (B) float 0-1 | **A — aligned with schema-infrastructure.md §1** (upstream itself still a pending proposal) | Blocks float fields on all new records |
| `decay_class` storage | (1) Stored field per record; (2) Computed from `MemoryCategory` + optional override | **Option 2** (computed mapping + `decay_class_override?` escape hatch) | Blocks adding a stored `decay_class` field to every record class; requires mapping table in `packages/schema` |
| `provenance.mode` capture | (A) Default `"told"` for corrections, `"observed"` for insights; (B) Require explicit caller-supplied value | **A for now** (safe defaults reduce friction); B as Phase 2 after tooling is updated | Phase 2: requires MCP tool parameter changes in session_end.ts and check_action.ts |
| `superseded_by` on palace/insights | (A) Audit pointer only, no `retract*()` function in v4; (B) Full lifecycle with `retractPalaceMemory()` / `retractInsight()` in v4 | **A** — audit pointer now, lifecycle in Phase 2. Corrections already demonstrate the pattern. | Blocks active/inactive filtering for palace memories and insights in v4; deferred to Phase 2 |
| Retrieval composition | (1) Two-stage: relevance unchanged, confidence annotates; (2) Multiplicative blend into RRF; (3) Intent-aware routing | **Option 1 now; Option 3 as Phase 2 evolution gate** | Blocks Option 2 (hidden staleness, benchmark regression risk). Option 3 gated on intent-classifier precision ≥95% |
| `packages/schema` location | (A) Internal `packages/schema` workspace now, extraction later; (B) New repo immediately | **A** (schema-infrastructure.md §3) | Blocks separate repo creation until extraction gate: v4 shipped + 4 weeks stable + conformance green |
| `rankCorrections()` confidence feed | (A) Map new string `confidence` to numeric: `high→1.0, medium→0.6, low→0.3` replacing `weight` fallback; (B) Keep `weight`/`proof_confidence` as primary, new `confidence` is annotation only | **B** — do not touch the ranker formula. `proof_confidence` (corrections.ts:1063) is already evidence-grounded; the new `confidence` string is assertion-time metadata, not a recency-adjusted posterior. | Blocks using v4 `confidence` as a ranking signal in v4. Revisit if outcome data shows string confidence is more predictive than `proof_confidence`. |
