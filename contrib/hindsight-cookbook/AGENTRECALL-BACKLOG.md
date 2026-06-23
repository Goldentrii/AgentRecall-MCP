# AgentRecall improvement backlog — revealed by the Hindsight integration

Building the cookbook recipe forced AgentRecall's export/egress surface into the light.
These are the improvements the 12-lens round-table + 4 adversarial reviewers converged on,
ranked. Each is independent of the cookbook PR; together they turn "file-spelunking glue"
into a supported, scrub-enforced integration contract.

| # | Improvement | Effort | Impact |
|---|---|---|---|
| 1 | ✅ **DONE (local, uncommitted)** — `ar corrections export` (scrubbed, active-only, stable schema) | M | high |
| 2 | Disambiguate the three `confidence` meanings via one field + `confidence_basis` | S | high |
| 3 | `MemoryBackend` write interface mirroring the existing `RecallBackend` read seam | M | high |
| 4 | Exported `scrubForCloud` wrapper / `ar scrub` CLI (fail-CLOSED) for third-party sinks | M | high |
| 5 | Promote `corrections` to a sync `store` (remote read path + the existing egress chokepoint) | S | med |
| 6 | Publish a versioned, checked-in `predict-loo` baseline artifact | S | med |
| 7 | Tier-B (Codex/raw-API) explicit session-end + export cell pattern | S | low |

---

### 1. ✅ First-class scrubbed export — `ar corrections export` (IMPLEMENTED locally 2026-06-23, uncommitted)
Shipped as `ar corrections export [--all-projects] [--include-retracted] [--since YYYY-MM-DD]`.
Decision vs the original wording: **dropped `--format hindsight`** — core stays vendor-neutral
(emits a stable `CorrectionExport` schema, `schema_version: "corrections-export/v1"`, with a
`confidence_basis: "authority-weight"` field that also pre-empts backlog #2); vendor mapping
lives in the adapter. New `scrubForExport()` in content-guard.ts is the **fail-CLOSED** scrub
(re-scans output, throws `SecretScanError` on residue) — the reusable core of backlog #4.
Active-only by default. 7 new tests; passed independent code + security review (2 HIGH fixed:
all string fields scrubbed; fail-closed no longer defeated by a swallowed error).
Original ask was:

Today the only correction JSON export is `ar corrections rejected` (rejected-only). Active
records are reachable only by globbing on-disk files (schema-coupled, fragile) or via
`ar recall`, which returns ranked excerpts that **drop `severity`/`weight`/`recurrence`** —
exactly the fields that make the Hindsight framing substantive. A first-class export that
runs the authoritative `scrubForCloud`, honors the personal-tier gate, and emits a stable
schema turns every downstream integration (Hindsight, Mem0, Zep) from file-spelunking into
one supported, scrub-enforced contract. **Converged on by 6 lenses; endorsed by all 4
reviewers.** This recipe had to re-implement the on-disk glob + scrub precisely because this
command doesn't exist.

### 2. Disambiguate `confidence`
`confidence` is overloaded three ways: SmartRecall calibrated **relevance** (floors
0.66/0.4/0.2, `confidence.ts`), CompoundInsight pattern-**strength** (0–1), and
CorrectionRecord.`weight` (**authority**). Any external consumer must hand-map semantics and
will conflate retrieval-relevance with belief — the highest-severity correctness risk in
this integration. Export one `confidence` + a `confidence_basis` discriminator
(`relevance` | `authority-weight` | `earned-precision`). *Evidence it's confusing: the
round-table's own briefing packet shipped stale floors (0.10/0.05/0.03) — careful readers
got it wrong.*

### 3. `MemoryBackend` write seam
AgentRecall has a clean **read** abstraction (`RecallBackend`: search/available, local↔Supabase
via dynamic import) but no symmetric **write/retain** seam — so "target Hindsight/Mem0/Zep"
has no first-class home and lives as out-of-tree glue. A `MemoryBackend` interface
(`retain(records)` / `available()`) + an env-selected factory makes external belief stores a
configured sync destination, reusing the proven dynamic-import pattern.

### 4. Exported fail-closed scrub — `ar scrub`
`scrubForCloud` is wired **only** into the Supabase `doSync` chokepoint and is **fail-OPEN**
(on error it returns the original content — `content-guard.ts`). Any external egress
(Hindsight, future bridges, user scripts) must re-implement the prefix list, which will
drift and leak the next token type AgentRecall adds. A documented `ar scrub` (stdin →
scrubbed stdout, non-zero exit if a secret survives) gives every downstream path the same
guarantee Supabase has. This is the security-hardening half of #1 — the recipe had to ship
its own fail-closed scrub for exactly this reason.

### 5. `corrections` as a sync store
The sync `store` union is `journal|palace|awareness|digest` (`sync.ts`) — `corrections` is
**not** a member, so they never reach any remote and have no chokepoint-guarded egress.
Adding `corrections` is the smallest change that gives them a remote read path and routes
them through the v3.4.33 opt-in cloud guard. *Must respect that `/corrections/` is currently
a `PERSONAL_PATH_MARKER` — a deliberate tier decision, not an oversight.*

### 6. Versioned `predict-loo` baseline
AgentRecall ships the most valuable asset for honest measurement — the anti-self-confirming
LOO eval with a `matchFn` seam — but it lives in `scripts/eval` with **no committed
baseline**. A versioned baseline JSON (corpus hash, N, recall/precision/FP per matcher,
Wilson intervals) lets any integration diff against a stable reference, makes every future
"we improved recall" claim auditable, and turns 5 loops of honest negative results into a
published reproducibility story. *Observed live: keyword 0/13, semantic 2/13 recall,
semantic FP 3.3% (1/30).*

### 7. Tier-B explicit session-end pattern
`HOST-TIERS.md` is honest that no adapter can manufacture a hook the host doesn't provide.
Tier B (Codex/chatbox/raw API) is named across lenses but never built — the integration
needs a documented explicit-call pattern (agent calls `session_end`, then runs export/retain)
so it works beyond Claude Code.

---

_Source: 20-agent round-table workflow `wf_8eaa43b3-3b0`, 2026-06-23. Plywood SOP `8885eac7`._
