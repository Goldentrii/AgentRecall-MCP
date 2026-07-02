---
title: AgentRecall Memory
sdk: hindsight-agentrecall
topic: Agents
---

# AgentRecall Memory

Import an AI coding agent's accumulated **corrections** — a mistake plus the rule that
fixes it — from [AgentRecall](https://github.com/Goldentrii/AgentRecall) (MIT, local-first)
into a Hindsight memory bank, so `recall` / `reflect` surface the corrected understanding in
a fresh session and the agent stops repeating the mistake.

**Division of labor (kept honest):**

| | owns |
|---|---|
| **AgentRecall** | correction **capture + governance** — `active` / `weight` / `recurrence` / retraction |
| **Hindsight** | belief synthesis + cross-session **recall** — the engine |

This recipe does **not** claim AgentRecall adds correction-learning; Hindsight's
Observations layer already consolidates corroborating facts natively. AgentRecall decides
*what is worth remembering and still true*; Hindsight decides *what it means and surfaces it
later*.

## Run it

```bash
pip install -r requirements.txt
# Start a local Hindsight server first (see the Hindsight quickstart). Then:
HINDSIGHT_LIVE=1 python import_corrections.py --sample
```

`--sample` uses the bundled `sample_corrections.json`, so it runs with **zero AgentRecall
install**. To import a real local store instead:

```bash
HINDSIGHT_LIVE=1 python import_corrections.py --project my-project
```

Without `HINDSIGHT_LIVE=1` it is a dry run — the quality gate and secret scrub execute, but
nothing is retained.

The notebook `import_corrections.ipynb` walks the full loop cell by cell:
**capture → quality gate → fail-closed scrub → retain → recall / reflect.**

## How it works

- **Corrections are read from on-disk JSON** (`~/.agent-recall/projects/<project>/corrections/*.json`).
  That is the only path that preserves `severity` / `weight` / `recurrence`; `recall` returns
  ranked excerpts that drop them.
- **`document_id = correction["id"]`** (the JSON `id`, not the filename stem — on a live
  store the two diverge for most records). Re-importing the same id upserts, so the import
  is idempotent and a superseded correction replaces the prior version.
- **Per-project `bank_id = agentrecall-<project>`** for hard isolation. Tags are query
  filters, not a security boundary.
- **A quality gate** drops retracted (`active: false`) and empty/path-only rules — real
  corpora are ~74% retracted.

## Security

Corrections can quote secrets or PII, and they are a **net-new egress path** — they do not
flow through AgentRecall's normal sync scrub. So this recipe:

- runs a **fail-closed** secret scrub before every `retain()` (redacts known AWS / GitHub /
  OpenAI / Slack / npm / PEM shapes, then re-scans and raises if any survive);
- defaults to **`http://localhost:8888`** — nothing leaves your machine;
- requires an explicit **`AR_HINDSIGHT_CLOUD=1`** (plus `HINDSIGHT_API_KEY`) before any
  cloud egress.

The scrub catches known token *shapes*, not free-form PII (emails, hostnames, JWTs). The
localhost default is the primary protection. Matching on *shapes* also makes it deliberately
aggressive in the other direction: a correction that merely *discusses* a key (text that
contains an `sk-…`-shaped string) is redacted too. That is the fail-closed trade-off — it
would rather blunt a rule than leak a secret.

## Limitations

- **Hindsight extracts facts; it never stores your rule text verbatim.** Treat `recall` as
  *what the bank believes*, not a transcript.
- **`recall` returns no per-result score** — results are ranked, not scored, so don't write
  confidence-gating logic against its output. Reinforcement of repeated corrections is
  Hindsight's native Observations behavior, not something this recipe adds.
- **Retraction is a one-way door.** The quality gate only skips `active: false` records *on
  the way in*. A correction retracted in AgentRecall *after* it was already retained is **not**
  removed by re-running the import — the gate drops it, so it is never re-sent and the upsert
  never fires. To purge an already-pushed fact, delete it explicitly via Hindsight's directive
  API (deleting belief is left as a deliberate act, especially for a secret-bearing correction).

## Files

| file | purpose |
|---|---|
| `import_corrections.ipynb` | the cell-by-cell recipe |
| `import_corrections.py` | reusable loader (on-disk store or bundled fixture) |
| `sample_corrections.json` | 3 example corrections, so the recipe runs with no AgentRecall install |
| `requirements.txt` | `hindsight-client` |
