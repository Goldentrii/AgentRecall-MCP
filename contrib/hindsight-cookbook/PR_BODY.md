## Summary

Adds `applications/agentrecall-memory/` — a notebook + helper that loads an AI coding
agent's **corrections** from [AgentRecall](https://github.com/Goldentrii/AgentRecall) (an
MIT, local-first agent-memory tool) into a Hindsight memory bank. After import,
`recall` / `reflect` surface the corrected understanding at the start of a new session so
the agent stops repeating past mistakes.

Mirrors the existing `claude-code-memory` / `codex-memory` layout: a host-memory data source
with Hindsight as the engine. **AgentRecall owns capture + governance** (which corrections
are durable vs. retracted, their severity / weight / recurrence); **Hindsight owns belief
synthesis and cross-session recall.** We do *not* claim AgentRecall adds correction-learning
— Hindsight's Observations layer already does that natively.

## Files

- `README.md` — walkthrough + YAML frontmatter (`sdk: hindsight-agentrecall`, `topic: Agents`)
- `import_corrections.ipynb` — the cell-by-cell recipe (capture → gate → scrub → retain → recall/reflect)
- `import_corrections.py` — reusable loader (reads AgentRecall on-disk JSON or the bundled fixture)
- `sample_corrections.json` — 3 example corrections so the recipe runs with zero AgentRecall install
- `requirements.txt` — `hindsight-client`

## Design decisions (verified against the live API docs)

- `document_id = correction["id"]` (the JSON `id`, **not** the filename stem — they diverge
  for most records on a real store) for idempotent upsert; `update_mode="replace"` so a
  superseded correction cleanly replaces the prior version.
- Corrections are read from AgentRecall's on-disk JSON — the only path that preserves
  `severity` / `weight` / `recurrence`.
- A **fail-closed** secret scrub runs before every `retain()` — corrections are a net-new
  egress path that bypasses AgentRecall's normal sync scrub.
- Per-project `bank_id = agentrecall-<project>` (hard isolation); tags are query filters,
  not a security boundary.
- A quality gate filters retracted / empty / path-only corrections (real corpora are
  ~74% retracted).
- `recall` is treated as ranked-not-scored (no per-result confidence); `reflect` is used
  read-only with `response_schema` → `structured_output`.

## Test plan

- [x] `python -m py_compile import_corrections.py` — clean
- [x] every Hindsight call checked against the published client signatures
      (`create_bank`, `retain`, `recall`, `reflect`)
- [x] offline assertions: quality gate drops the retracted record; fail-closed scrub
      redacts an AWS key before any `retain`
- [x] notebook validates as nbformat 4.5; every code cell parses
- [ ] `pip install -r requirements.txt && HINDSIGHT_LIVE=1 python import_corrections.py --sample`
      against a running Hindsight — **not run in this PR** (authored without a live instance;
      same posture as the merged `claude-code-memory` recipe)
- [ ] confirm `document_id` upsert is idempotent across separate calls (re-run does not duplicate)

> Live-run boxes intentionally unchecked — happy to wire this into the notebook test harness
> if you'd prefer it under `notebooks/`.
