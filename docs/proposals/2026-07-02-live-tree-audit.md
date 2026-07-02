# AgentRecall Live-Tree Audit — 2026-07-02

> Scope: `packages/core/src/` only (stale `src/` root excluded).
> All citations are file:line against the live tree.
> This document is the ground truth for v4 belief-semantics field design.

---

## 1. Record Shapes

Every record-shaped interface/type in the live tree, with canonical location.

### 1.1 Shared primitive types (`packages/core/src/types.ts`)

| Type | Line | Values |
|------|------|--------|
| `Importance` | 143 | `"high" \| "medium" \| "low"` |
| `Urgency` | 144 | `"today" \| "this-week" \| "eventual" \| "none"` |
| **`Confidence`** | **145** | `"high" \| "medium" \| "low"` |
| `WalkDepth` | 146 | `"identity" \| "active" \| "relevant" \| "full"` |
| `MemoryCategory` | 149 | `"goal" \| "architecture" \| "decision" \| "blocker" \| "observation" \| "lesson" \| "general"` |

### 1.2 Session / journal

| Interface | File:line | Key fields |
|-----------|-----------|------------|
| `JournalEntry` | types.ts:71 | `date`, `file`, `dir` |
| `SessionState` | types.ts:83 | `insights[{claim, confidence:string, evidence}]`, `completed`, `failures`, `state`, `next_actions` |

Note: `SessionState.insights[].confidence` is a plain `string` field — NOT typed as the `Confidence` union (types.ts:145). It is written by session tooling as a free-text assertion.

### 1.3 Palace room & index

| Interface | File:line | Key fields |
|-----------|-----------|------------|
| `RoomMeta` | types.ts:96 | `slug`, `name`, `salience:number`, `access_count`, `last_accessed`, `tags`, `connections`, `keystone?:boolean`, `archived?:boolean` |
| `PalaceIndex` | types.ts:122 | `version`, `project`, `rooms: Record<slug,{salience,memory_count,last_updated}>`, `identity_hash`, `last_lint` |
| `GraphEdge` | types.ts:131 | `from`, `to`, `type`, `weight`, `created` |
| `PalaceGraph` | types.ts:139 | `edges: GraphEdge[]` |
| `PinStatus` | types.ts:152 | `pinned:boolean`, `reason?`, `pinned_at?` |

`RoomMeta` does NOT carry `FsrsState`. Rooms decay via salience (not FSRS). This is enforced at decay-pass.ts:10-13.

### 1.4 FSRS state (`packages/core/src/palace/fsrs.ts`)

| Interface | File:line | Key fields |
|-----------|-----------|------------|
| `FsrsState` | fsrs.ts:31 | `stability:number`, `last_confirmed:string`, `confirmations:number` |
| `FsrsScore` | fsrs.ts:40 | `retrievability:number`, `stability:number`, `age_days:number`, `status:"hot"\|"warm"\|"cool"\|"archive_candidate"` |

Used by: `skills` records (decay-pass.ts:72 — `skill.meta.fsrs`). NOT used by rooms.

### 1.5 Corrections (`packages/core/src/storage/corrections.ts`)

| Interface | File:line | Key fields |
|-----------|-----------|------------|
| `CorrectionRecord` | corrections.ts:17 | `id`, `date`, `severity:"p0"\|"p1"`, `project`, `rule`, `context`, `tags`, `kind?:"correction"\|"insight"\|"hunch"\|"fact"`, `weight?:number`, `active?:boolean`, `authoritative?:boolean`, `proof_count?:number`, `proof_confidence?:number`, `superseded_by?:string`, `merged_from?:string[]`, `stale?:boolean`, `retrieved_count?`, `heeded_count?`, `recurrence_count?`, `precision?` |
| `RejectedCorrectionRecord` | corrections.ts:84 | `ts`, `project`, `rule`, `reason`, `gate_version` |
| `CorrectionOutcome` | corrections.ts:92 | `correction_id`, `project`, `kind:"retrieved"\|"heeded"\|"recurred"\|"predicted"\|"predict_hit"`, `at`, `evidence?` |
| `CorrectionKPI` | corrections.ts:108 | aggregate counts + `noise_candidates`, `high_signal`, `stale_candidates` |

`superseded_by` already exists on `CorrectionRecord` (corrections.ts:70). `retractCorrection()` writes it atomically (corrections.ts:668). `supersession.ts` builds on this for contradiction detection.

### 1.6 Awareness / insights (`packages/core/src/palace/awareness.ts`, `palace/insights-index.ts`)

| Interface | File:line | Key fields |
|-----------|-----------|------------|
| `Insight` | awareness.ts:111 | `id`, `title`, `evidence`, `confirmations`, `lastConfirmed`, `appliesWhen`, `source`, `source_project?`, `severity?`, `trend?:InsightTrend` |
| `CompoundInsight` | awareness.ts:124 | `id`, `title`, `sourceInsights`, `pattern`, `confidence:number` |
| `AwarenessState` | awareness.ts:132 | `identity`, `topInsights:Insight[]`, `compoundInsights:CompoundInsight[]`, `trajectory`, `blindSpots`, `lastUpdated` |
| `IndexedInsight` | insights-index.ts:92 | `id`, `title`, `source`, `applies_when`, `skill_tags?`, `projects?`, `file?`, `severity`, `confirmed_count`, `last_confirmed` |
| `InsightsIndex` | insights-index.ts:105 | `version`, `updated`, `insights:IndexedInsight[]` |

`CompoundInsight.confidence` (awareness.ts:129) is a `number` (0..1), not the `Confidence` string union from types.ts:145.

### 1.7 Retrieval result types (`packages/core/src/tools-logic/smart-recall.ts`)

| Interface | File:line | Key fields |
|-----------|-----------|------------|
| `SmartRecallResultItem` | smart-recall.ts:87 | `id`, `source`, `title`, `excerpt`, `score:number`, `confidence:string`, `calibrated:number`, `verbatimKey?`, `room?`, `date?`, `severity?` |

`confidence:string` here is the human-readable label from `calibratedConfidence()` — NOT the `Confidence` union from types.ts:145 (though values overlap).

---

## 2. Retrieval Pipeline (Actual, Cited)

**Verdict: the pipeline is `BM25-analog + Ebbinghaus-RRF (three sources) + hot-window boost + Beta feedback multiplier + graph-walk expansion`. Hopfield is NOT on the default path.**

### 2.1 Entry point

`smartRecall()` in `tools-logic/smart-recall.ts` (line ~530+). It calls `localRecallSearch()` (smart-recall.ts:322) as the primary path. A Supabase/vector backend runs in parallel with a timeout budget (RECALL_BUDGET_MS = 2500ms, smart-recall.ts:528) and falls back to local on timeout.

### 2.2 `localRecallSearch()` pipeline (smart-recall.ts:322-522)

1. **Source 1 — Palace** (smart-recall.ts:336-373)
   - `palaceSearch({query, project})` returns keyword-matched excerpts with `keyword_score` and `salience`.
   - Internal score: `keyScore × 0.65 + salience × 0.35` (salience floored at 0.4).
   - Confidence scale: `"cosine"` (already 0..1).

2. **Source 2 — Journal** (smart-recall.ts:375-410)
   - `journalSearch({query, project})` returns date-stamped sections.
   - Internal score: `ebbinghaus(days, S=2) × 0.50 + keywordExactness × 0.50`.
   - Journal decays to ~7% in 1 week (S=2 days).

3. **Source 3 — Insights** (smart-recall.ts:411-446)
   - `recallInsight({context, limit})` returns `IndexedInsight` rows.
   - Internal score: `relevance × 0.40 + exactness × 0.35 + log2(confirmed+1)/3 × 0.25`.

4. **RRF merge** (smart-recall.ts:448-458)
   - Each source ranks internally, then `applyRRF()` with `RRF_K = 60` (Cormack et al. 2009).
   - Formula: `score += 1 / (60 + rank)`.

5. **Hot-window boost** (smart-recall.ts:460-478)
   - Applied post-RRF: `<6h → ×3.0`, `<24h → ×2.0`, `<72h → ×1.3`.
   - Palace items (date=undefined) are unaffected.

6. **Calibrated confidence** (smart-recall.ts:488-489, confidence.ts:68)
   - Set at scoring time: `calibratedConfidence(score, "rrf-local")` where `RRF_LOCAL_MAX=0.12`.
   - Bins: `≥0.66 high · ≥0.40 medium · ≥0.20 low · else weak`.

7. **Beta feedback multiplier** (smart-recall.ts:605-615)
   - Applied in `smartRecall()` AFTER RRF: `score × (betaUtility(pos, neg) × 2)`.
   - Neutral (no feedback) = ×1.0.

8. **Graph-walk expansion** (smart-recall.ts:495-519)
   - Top result's room → 1-hop linked rooms via `getConnectedRooms()`.
   - Score of linked room = `top.score × 0.6`.

### 2.3 Hopfield status

`palace/hopfield.ts` implements the full Ramsauer et al. 2020 modern Hopfield network with numerically-stable softmax (hopfield.ts:131). MATH.md:183-200 explicitly states: **"it is a pure scoring primitive that nothing on the default recall path calls."** Confirmed by grepping — `hopfieldRecall` / `hopfieldRerank` appear only in hopfield.ts itself; no import in smart-recall.ts or recall-backend.ts.

### 2.4 Correction retrieval (separate path)

Corrections are NOT RRF-ranked — they bypass `localRecallSearch()` entirely and are surfaced by a dedicated ranker.

- **`session_start` loads ONLY P0 corrections.** session-start.ts:18 imports `readP0Corrections` (not `readActiveCorrections`); the call site is session-start.ts:331: `rankCorrections(readP0Corrections(slug), 10)`. Only P0 (always-load) corrections are auto-injected at session start, capped at 10.
- `readActiveCorrections()` (defined corrections.ts:624) serves OTHER paths: on-write consolidation inside `writeCorrection()` (corrections.ts:566), `check_action` (check-action.ts:143), `predictCorrection` (predict-correction.ts:108), `session_start_lite` (session-start-lite.ts:54), and `brief` (brief.ts:205). It is never called on the session_start path. (`check.ts` itself calls none of the corrections readers.)
- **Ranking formula** (corrections.ts:1070): `sev × 100 + conf × 10 + recency × 3 + proof`, where `sev = severity === "p0" ? 1 : 0` (corrections.ts:1062), `conf = proof_confidence ?? weight ?? 0` (1063), `recency = exp(-days/180)` (1067), and `proof = min(1, proof_count/5)` (1068) — a normalized float, NOT the raw counter.
- **The `sev × 100` term is load-bearing for the v4 confidence design.** It unconditionally ranks ALL p0 corrections above ALL p1: the maximum non-severity contribution is `10 + 3 + 1 = 14 < 100` (source comment at corrections.ts:1069: "severity dominates the ordering; the rest breaks ties within a severity tier"). Any new v4 `confidence` field that feeds this ranker sits UNDER the severity tier — it can reorder within p0 or within p1, but it cannot lift a p1 above a p0 without breaking this guarantee.

---

## 3. Write Path

### 3.1 Journal writes

`journalWrite()` called from `session_end.ts`. Journal files: YAML frontmatter (`type`, `project`, `date`, `tags`, `created`) + markdown body. Filename: `{date}--{saveType}--{sig}--{theme}--{slug}.md` (storage/session.ts:69, confirmed on disk: `2026-06-11--arsave--shipped--mcp-unavailable--bug-fix-release-high-agent.md`). No provenance field is captured at write time.

### 3.2 Correction writes

`writeCorrection()` in corrections.ts:523. Runs capture-quality gate first (isLikelyRealCorrection). Applies consolidation (normalizeRule match → merge into existing). Writes JSON file `{date}-{slug}.json` atomically (tmp+rename, mode 0600). Fields include `authoritative?`, `proof_count?`, `superseded_by?` — all set at write time. No `observed|told` provenance field exists; the `holder?` field (corrections.ts:25) captures who recorded it (defaults to date).

### 3.3 Palace writes

`palaceWrite()` calls `palace/rooms.ts` writers. Room memories land as `###`-prefixed blocks appended to `README.md` within the room dir. Room metadata lives in `_room.json` (`RoomMeta`). No frontmatter on individual memory blocks — metadata is in `_room.json`.

### 3.4 Insight writes

`addIndexedInsight()` in palace/insights-index.ts:147. Confirm-first: containment overlap ≥0.6 → strengthen existing; else create new entry in `insights-index.json`. No per-record provenance field.

### 3.5 Where `observed|told` provenance would attach

The earliest reliable capture point is `writeCorrection()` (corrections.ts:523) and `addIndexedInsight()` (insights-index.ts:147). Both are synchronous, single-call writers. The `holder?` field on `CorrectionRecord` (corrections.ts:25) is the nearest existing analog for "who told this to the agent" but is underpopulated (defaults to date string). For journal entries, the YAML frontmatter `created` timestamp is the only source attribution available today.

---

## 4. Collision Points

### 4.1 `Confidence` type: two incompatible usages

**Critical collision.** The `Confidence` type at types.ts:145 is `"high" | "medium" | "low"`. The v4 proposal reuses it for belief assertion confidence (same three values). However, there are two OTHER confidence mechanisms in the codebase:

1. `calibratedConfidence()` in tools-logic/confidence.ts:68 — returns `ConfidenceLabel = "high" | "medium" | "low" | "weak"` (four values, adds `"weak"`). Exported as `ConfidenceLabel`, distinct from `Confidence`. Used by ALL retrieval backends (smart-recall.ts:60, supabase/recall-backend.ts:5, vector/local-vector-backend.ts:13).
2. `CompoundInsight.confidence:number` (awareness.ts:129) — a float 0..1, not the string union.
3. `SessionState.insights[].confidence:string` (types.ts:92) — untyped free-text string.

V4 `confidence: high|medium|low` on a record is the same shape as `Confidence` (types.ts:145) and MUST reuse it. The naming collision with `calibratedConfidence()` / `ConfidenceLabel` is a documentation risk but not a type conflict since they are separate types. The `"weak"` fourth value in `ConfidenceLabel` is retrieval-time only — it should NOT appear on stored assertion metadata.

### 4.2 `decay_class` vs existing salience categories: partially overlapping axes

`MemoryCategory` (types.ts:149) drives per-category Ebbinghaus decay constants in `salience.ts:37-45`. The proposed `decay_class: static|slow|volatile` is a coarser 3-level grouping that would operate on a DIFFERENT axis (truth decay = "is this fact still TRUE") vs the existing category-based decay (surfacibility decay = "should this be shown").

These are genuinely orthogonal **if** properly separated. The risk is accidental coupling: if `decay_class = volatile` is interpreted as "recency-weight this more," it collides with the `MemoryCategory.blocker` → `CATEGORY_DECAY[blocker] = 0.90` path in salience.ts:43. Recommendation: `decay_class` must NOT modify `computeSalience()` inputs — it belongs on a separate truth-decay pass that answers "is this still true," not "is this worth surfacing."

### 4.3 `superseded_by` on corrections vs v4 global correction chains

`CorrectionRecord.superseded_by?: string` (corrections.ts:70) already exists and is wired into `retractCorrection()` (corrections.ts:668) and `supersession.ts:116`. The v4 `superseded_by` for beliefs must build on this, not re-invent it. **Collision surface**: if v4 adds `superseded_by` to palace room memories or insights, it would be a separate mechanism with no shared infrastructure. The field name would collide visually with corrections' `superseded_by` while being entirely different in semantics (corrections have explicit `retract` logic; palace memories currently do not).

### 4.4 `proof_confidence` vs the proposed belief `confidence`

`CorrectionRecord.proof_confidence` (corrections.ts:69) is already a `number` 0..1 computed as `betaPosterior(heeded, recurrence)`. It is labeled "NOT named `confidence`" in the code comment explicitly to avoid collision with the export's `confidence_basis:"authority-weight"`. V4's per-record `confidence: high|medium|low` (string) would sit alongside `proof_confidence: number` on the same `CorrectionRecord`. These are different axes (assertion confidence vs evidence-grounded posterior) and must be documented as distinct fields — the code already anticipates this tension.

---

## 5. Migration Surface

### 5.1 On-disk record classes and their current metadata encoding

| Class | Location | Encoding today | Has YAML frontmatter? |
|-------|----------|----------------|----------------------|
| Journal entries | `journal/{date}--*.md` | YAML frontmatter: `type`, `project`, `date`, `tags`, `created` | YES |
| Corrections | `corrections/{date}-{slug}.json` | JSON (all fields flat) | NO (JSON) |
| Palace room meta | `palace/rooms/{slug}/_room.json` | JSON (`RoomMeta` fields) | NO (JSON) |
| Palace room memories | `palace/rooms/{slug}/README.md` | Markdown `###`-blocks, no per-memory frontmatter | NO |
| Knowledge entries | `knowledge/*.md` | Markdown sections, no frontmatter on individual entries | NO |
| Insights index | `insights-index.json` (root) | JSON array (`IndexedInsight` fields) | NO (JSON) |
| Awareness state | `awareness-state.json` (root) | JSON (`AwarenessState`) | NO (JSON) |
| Skills | `palace/skills/*.json` | JSON with `fsrs:FsrsState` | NO (JSON) |

### 5.2 Per-class migration recommendation for v4 fields

**Corrections (`CorrectionRecord` JSON):**
`confidence`, `decay_class`, `provenance` as NEW optional fields on the existing JSON object. Already pattern-established by `proof_count?`, `superseded_by?` (corrections.ts:67-72): optional fields default on `applyCorrectionDefaults()` (corrections.ts:239) — zero migration needed for existing records. Recommendation: **JSON fields, same file, optional with defaults**. `superseded_by` already exists; extend it rather than adding a parallel field.

**Palace room memories (README.md `###`-blocks):**
Individual memory blocks have NO per-entry frontmatter today. Adding inline YAML to each `###` block would require parsing changes in `palace/rooms.ts`. Recommendation: **filename-based or room-level JSON index** for per-memory assertion metadata, NOT inline frontmatter in the markdown. Alternatively, promote the most important memories to individual `.md` files (like `Codex-vs-Claude-model-routing.md` in the alignment room) which CAN carry YAML frontmatter.

**Insights (`insights-index.json` entries):**
Currently `IndexedInsight` has no `confidence` or `provenance`. Add as optional fields to `IndexedInsight` (insights-index.ts:92). No migration needed — `addIndexedInsight()` already uses `Omit<IndexedInsight, "id" | "confirmed_count" | "last_confirmed">` pattern; old records without the fields will read as `undefined`. Recommendation: **JSON fields, optional with defaults**.

**Journal entries:**
Journal files carry YAML frontmatter already. `provenance` (observed|told) could be added as a frontmatter field at write time with minimal disruption. Recommendation: **YAML frontmatter field** for journal entries — it is the natural home.

---

## 6. Open Questions for the Field-Design Session

1. **`confidence` scope**: Should `confidence: high|medium|low` be added only to `CorrectionRecord` and `IndexedInsight`, or also to palace room memories? Room memories lack a write API that has a natural caller-supplied confidence — it would need to be inferred or default to "medium". Is "medium" a safe default for ALL existing palace memories?

2. **`decay_class` vs `MemoryCategory`**: `MemoryCategory` (types.ts:149) already partitions records by truth-halflife-like semantics (architecture=0.98, blocker=0.90, etc.). Can `decay_class: static|slow|volatile` be a computed mapping FROM `MemoryCategory` rather than a separate stored field? This would avoid a new field on every record while still enabling truth-decay routing.

3. **`provenance.observed|told` write-time capture**: The correction capture path (`writeCorrection`) does not currently know whether the user *told* the agent a fact or the agent *observed* it. The `holder?` field exists but is unpopulated (defaults to a date string). What is the caller-side API change required to capture this? (MCP tool parameter? Hook-based context?) The tooling must change, not just the storage.

4. **`superseded_by` on non-corrections**: Palace room memories and insights have no retraction mechanism today. If v4 adds `superseded_by` to insights, does the insights index need a `retractInsight()` analog to `retractCorrection()`? Or is `superseded_by` purely an audit pointer with no active/inactive lifecycle management for insights?

5. **Truth-decay pass vs FSRS**: FSRS (fsrs.ts) tracks *retrievability* (will the agent find this useful?). Truth-decay tracks *truthfulness* (is this still correct?). The decay-pass (decay-pass.ts) currently runs FSRS on skills and salience on rooms. Should a truth-decay pass be a THIRD scheduled pass, or should it reuse the FSRS reinforce/penalize hooks (penalize when a fact is observed to be wrong, reinforce when verified still true)?

6. **Migration gate**: `applyCorrectionDefaults()` (corrections.ts:239) normalizes old records at read time. New fields (`confidence`, `decay_class`, `provenance`) should follow the same pattern. What are the safe defaults? `confidence: "medium"`, `decay_class: "slow"` (matching MemoryCategory.general), `provenance: {source:"unknown", mode:"told"}` are sensible but should be confirmed against the correction corpus distribution.
