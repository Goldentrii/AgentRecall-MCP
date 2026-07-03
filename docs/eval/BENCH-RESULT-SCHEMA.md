# bench-result/v1 Schema

Every run of `npm run bench` produces a `bench-result/v1` JSON artifact. This
document is the field-by-field reference. The `claim-gates/v1` sub-object is
documented separately in the same file.

---

## Top-level fields

| Field | Type | Notes |
|---|---|---|
| `schema_version` | `"bench-result/v1"` | Literal string. Consumers must reject unknown versions. |
| `benchmark` | `string` | `"predict-loo"` \| `"correction-transfer"` \| `"rmr-report"` |
| `benchmark_version` | `string` | A const declared in the script (e.g. `"loo-v4-2026-07-02"`). Changing the scorer algorithm increments this. Scores are version-scoped; cross-version comparison is forbidden. |
| `generated_utc` | ISO 8601 string | Wall-clock time of generation. Stripped before byte-diff. |

---

## `corpus` object

Exactly the fields from §2.2. Every artifact must emit all of them.

| Field | Type | Notes |
|---|---|---|
| `corpus_hash` | `string` | SHA-256 of sorted record hashes (see canonical-JSON rules). Consumers MUST verify this before trusting any metric. |
| `n_on_disk` | `number` | Count of `.json` files found on disk. |
| `n_counted` | `number` | Records passing the count rule: non-empty `rule` AND valid `date`. This is the denominator universe. |
| `n_active` | `number` | Counted records with `active !== false`. |
| `n_retracted` | `number` | Counted records with `active === false`. |
| `n_projects` | `number` | Distinct project directories containing counted records. |
| `excluded` | `Array<{id: string, reason: "missing_rule" \| "missing_date"}>` | One entry per excluded record. A record missing both fields gets `"missing_rule"` (checked first). |
| `rejected_lines` | `number` | Line count from `corrections/_rejected.jsonl` across all projects. Used for capture-rate accounting. |
| `active_approximation` | `"export-time"` | Always this value in v1. Signals that `active` is the export-time snapshot, not the true as-of-*t* value (§3.3 leak). Full reconstruction requires `corrections-export/v2`. |
| `manifest` | `Array<{project: string, file: string, sha256: string}>` | Per-file hashes. In `--manifest=hash-only` mode (public artifacts) the `file` field is replaced with `"<redacted>"` to avoid leaking internal paths. |

---

## `config` object

Records exactly what was run so a third party can reproduce.

| Field | Type | Notes |
|---|---|---|
| `cli_args` | `string[]` | Argv as passed to `run-bench.mjs`. |
| `semantic` | `boolean` | Whether the semantic-similarity widen was enabled. |
| `MIN_OVERLAP` | `number` | Token-overlap floor for a cluster match. Currently `2`. |
| `MAX_RISKS` | `number` | Maximum risks returned by `predictBlind`. Currently `3`. |
| `NEG_PER_LEADIN` | `number` | Negative pairs evaluated per lead-in. Currently `5`. |
| `matchFn` | `string` | `"keyword-default"` \| `"semantic"` \| a named custom matcher. Changing this requires a new `benchmark_version`. |

---

## `environment` object

Informational. Stripped before byte-diff. Non-comparable across machines
unless all fields are identical.

| Field | Type | Notes |
|---|---|---|
| `node` | `string` | Node.js version string. |
| `platform` | `string` | `os.platform() + "-" + os.arch()` |
| `tz` | `string` | Ambient TZ at run time. Should be `"UTC"` for fixture runs. Real-corpus artifacts record the ambient TZ and are observations only. Artifacts from different TZ are non-comparable unless the benchmark is verified TZ-insensitive. |
| `repo_commit` | `string \| null` | Git SHA of HEAD at time of run, or `null` if not in a git repo. |
| `core_version` | `string` | Version from `packages/core/package.json`. |

---

## `denominators` object

Both denominators, always. Never print one without the other (§2.3).

| Field | Type | Notes |
|---|---|---|
| `theoretical` | `number` | Count of corrections with ≥1 prior same-class sibling (includes retracted priors). |
| `achievable` | `number` | Subset of `theoretical` where ≥1 prior sibling is **active**. This is the honest ceiling for `recall_achievable`. |

---

## `metrics` object

Each metric is an object `{value, num, den, wilson95?, note?, unit?}`.

| Metric key | `value` type | Notes |
|---|---|---|
| `recall_achievable` | `number \| null` | `hits / achievable`. `null` when `den == 0`. The **honest ceiling** — the active-only blind profile cannot represent classes whose only priors are retracted. |
| `recall_theoretical` | `number \| null` | `hits / theoretical`. `null` when `den == 0`. Always reported alongside `recall_achievable`. |
| `precision` | `number \| null` | `hits / predictions_fired`. `null` when no predictions fired. |
| `ffr` | `number \| null` | False-fire rate on negatives. `null` when `den == 0`. See `unit` field. |

All non-null ratios include:

| Sub-field | Type | Notes |
|---|---|---|
| `value` | `number` | The ratio. `null` when denominator is 0. |
| `num` | `number` | Numerator. |
| `den` | `number` | Denominator. |
| `wilson95` | `[number, number]` | 95% Wilson interval, clamped to `[0, 1]`. Present when `den > 0`. |
| `note` | `string?` | `"n/a (uncomputable — 0 in denominator)"` when `value` is `null`. Never `0`. |
| `unit` | `string?` | For `ffr`: `"lead-in"` (the independent claiming unit, §2.4) or `"pair"`. Both levels must be reported; gate claims on the `"lead-in"` level. |

---

## `per_item` array

One entry per scored correction (not per file — excluded records are omitted from
`per_item` but listed in `corpus.excluded`). Sorted by `(project, id)` so ordering
is out of the byte-diff contract.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Correction id. |
| `project` | `string` | Project slug. |
| `date` | `string` | YYYY-MM-DD. |
| `predictable` | `boolean` | Had ≥1 prior same-class sibling (any activity status). |
| `active_predictable` | `boolean` | Had ≥1 ACTIVE prior sibling. False → structurally unpredictable by active-only profile. |
| `redaction_survived` | `boolean` | False → excluded from `predictions_fired`; counted in corpus with honest null. |
| `fired` | `boolean` | Scorer returned ≥1 guidance for this item's redacted lead-in. |
| `via` | `string \| null` | `"keyword"` \| `"semantic"` \| `null` when not fired. |
| `hit` | `boolean` | Top guidance anchors to a prior sibling whose cluster overlaps this item by ≥ `MIN_OVERLAP` tokens. |
| `anchor_id` | `string \| null` | `id` of the anchoring prior correction, or `null`. |
| `anti_self_confirm` | `boolean` | `anchor_id != this.id` — structural by construction for any hit; reported explicitly. |
| `lead_time_days` | `number \| null` | Days from earliest correct active prior sibling to `date`. `null` when no hit. |

---

## `claim-gates/v1` object

Machine-enforced. Rendered by the report printer before any headline figure.
When a claim's `n` is below its gate, the printer outputs the literal string
`"CANNOT CLAIM (n=X < gate Y)"` instead of a number. The gate ledger is
recomputed per run against the live `n_counted`.

| Claim | Gate condition |
|---|---|
| `transfer_recall ±15pp` | `achievable >= 39` |
| `transfer_recall ±10pp` | `achievable >= 93` |
| `transfer_recall ±5pp` | `achievable >= 381` |
| `ffr_leq_5pct` | `neg_independent_units >= 59` zero-fire |
| `ffr_leq_2pct` | `neg_independent_units >= 149` zero-fire |
| `ffr_leq_1pct` | `neg_independent_units >= 299` zero-fire |
| `memory_on_beats_off` | `discordant_pairs >= 6`, all one direction |
| `matcher_a_beats_b` | Fisher exact two-sided `p <= 0.05` |
| `lead_time_summary` | `hits >= 5` |

Example rendered output for the current fixture corpus
(`n_counted=23`, `achievable` will depend on scorer output):

```
transfer_recall ±15pp : CANNOT CLAIM (n=X < gate 39)
ffr_leq_5pct          : CANNOT CLAIM (neg_independent_units=X < gate 59)
lead_time_summary     : CANNOT CLAIM (hits=0 < gate 5)
```

---

## CANNOT-CLAIM footer semantics (§2.7)

The `claim-gates/v1` block is printed as a **fixed footer** on every result,
regardless of corpus size. Its presence is not optional. The footer exists to prevent
the overclaiming failure documented in the Zep/Mem0 dispute.

**CAN claim** at current fixture density (`n_counted=23`):

- The pipeline exists and is anti-gamed by construction.
- Metric definitions are frozen and versioned.
- FFR pair-level bound: Wilson upper bound from `(0, neg_pairs)`.
- The `achievable` recall count as a **diagnostic of corpus density** — a low number
  is a valid result.
- The blind-cut assertion fires correctly (structural guarantee, not a data claim).
- The schema and corpus hash are valid.

**CANNOT claim** at current density:

- Any transfer-recall point estimate as a headline.
- Any system or matcher ranking.
- Any RMR trend over time.
- Any marketing percentage ("X% fewer repeated mistakes").
- FFR ≤ 5% (not claimable at the lead-in unit level until 59 zero-fire independent negatives).

These CANNOT-CLAIM strings must appear verbatim in the artifact and in any
human-readable report derived from it. Removing or softening them requires a
spec update and a new `benchmark_version`.
