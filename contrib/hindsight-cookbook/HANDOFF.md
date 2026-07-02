# Hindsight Cookbook PR — Agent Handoff

**Project root:** `/Users/tongwu/Projects/AgentRecall/contrib/hindsight-cookbook/`

> You are picking up a ready-to-submit PR contribution to
> [`vectorize-io/hindsight-cookbook`](https://github.com/vectorize-io/hindsight-cookbook).
> Everything has been built, reviewed, and live-run verified. The ONLY thing left is
> submitting — which is a **REDLINE action requiring explicit human GO** before any `git push`
> or `gh pr create`.

---

## 1. What This Is

A cookbook recipe that connects **AgentRecall** (local-first agent correction capture) to
**Hindsight** (open-source agent memory engine). After import, an AI coding agent's
accumulated corrections (mistakes + the rules that fix them) are available via Hindsight's
`recall` / `reflect` API at the start of every new session.

**Honest framing (mandatory for merge — do not weaken):**
- AgentRecall = correction **CAPTURE + GOVERNANCE** (which corrections are durable vs. retracted,
  their severity / weight / recurrence / active status)
- Hindsight = belief **synthesis + recall ENGINE**
- We do NOT claim AgentRecall adds correction-learning — Hindsight's Observations layer does
  that natively

This distinction was the round-table's load-bearing correction. The PR will not merge if this
framing is softened or inverted.

---

## 2. State of the Work

| Item | Status |
|------|--------|
| 20-agent round-table design (`wf_8eaa43b3-3b0`) | ✅ Done |
| Recipe files built + code-reviewed + security-reviewed | ✅ Done |
| Live-run against `ghcr.io/vectorize-io/hindsight:latest` | ✅ Done |
| `document_id` upsert idempotency verified (re-run = no dup) | ✅ Done |
| PR body drafted with honest test-plan | ✅ Done |
| `ar corrections export` (backlog #1) shipped as v3.4.34 | ✅ Done (not yet npm published) |
| **Fork + branch + push + `gh pr create`** | ❌ NOT done — REDLINE |

---

## 3. File Inventory

```
contrib/hindsight-cookbook/
├── HANDOFF.md                      ← this file
├── PR.md                           ← submit instructions + pre-submit checklist
├── PR_BODY.md                      ← the actual PR body to paste / --body-file
├── README_INDEX_ENTRY.md           ← snippet to add to upstream README
├── AGENTRECALL-BACKLOG.md          ← 7-item AR improvement backlog (context only)
└── agentrecall-memory/             ← THE RECIPE (goes to applications/ upstream)
    ├── README.md
    ├── import_corrections.ipynb    ← 16-cell notebook (the recipe)
    ├── import_corrections.py       ← reusable loader (Python module)
    ├── sample_corrections.json     ← 3-record fixture (zero-install demo)
    ├── requirements.txt            ← hindsight-client only
    └── .venv/                      ← local dev venv — DO NOT commit
```

The upstream target is `applications/agentrecall-memory/` (not `notebooks/`) — see §5 below.

---

## 4. Verified Hindsight API Facts

These were adversarially reviewed by 4 agents and live-run verified. Do not change the recipe
calls without re-verifying against live docs first. The round-table's first-draft panel
invented 25 wrong API claims — these are the surviving, verified ones.

| Fact | Verified |
|------|---------|
| `retain` extracts facts — content is never stored verbatim | ✅ live + re-confirmed 2026-06-29 |
| `append` concatenates into ONE re-extracted doc (not N separate facts) | ✅ docs |
| `recall` returns `.results[].text` — **NO per-result confidence score** | ✅ docs (recall is ranked, not scored) |
| `reflect` synthesizes read-only (no writes) — use `.structured_output` when `response_schema` set (`.text` empty) | ✅ docs (note: docs don't use the literal word "read-only"; behavior matches) |
| `document_id` upserts: re-retain with same id replaces old doc + memories | ✅ live |
| `create_bank(bank_id, name, mission, disposition)` — all valid on the Python client (v0.7.2); the recipe uses `bank_id`/`name`/`mission` | ✅ docs re-confirmed 2026-06-29 — **corrects the old row** which wrongly said "mission only (NOT disposition)". `disposition` exists; the recipe simply doesn't use it. |
| Confidence floors 0.66 / 0.4 / 0.2 | ⚠️ **AgentRecall-side mapping values, NOT a Hindsight API fact** — not present anywhere in the shipped recipe (metadata uses `confidence_basis="authority-weight"`). The earlier row presented them as a Hindsight fact; that was wrong. |

**`reflect` caveat (honest, in PR_BODY.md):** Tested via Prismma relay (OpenAI-compatible),
which caused `reflect`'s internal agentic retrieval to degrade ("missing query parameters").
This is a relay confound, not a recipe bug — an OpenAI-native backend resolves it. The
`reflect` call signature in the notebook is correct either way.

---

## 5. Why `applications/` Not `notebooks/`

`notebooks/` is inside the cookbook's nbmake CI glob — every notebook there is auto-executed
against a live Hindsight container on CI. We cannot satisfy that CI contract.

Precedent: `claude-code-memory` and `codex-memory` are both under `applications/` and merged
with live-run boxes unchecked. We follow the same pattern.

---

## 6. Key Design Decisions (do not change without re-review)

- **`document_id = correction["id"]`** — the JSON `id` field, NOT the filename stem. On real
  corpora 69/87 corrections have divergent filename-vs-id. Wrong key = no upsert idempotency.
- **`bank_id = agentrecall-<project>`** — per-project isolation. Tags are query filters only,
  not security boundaries.
- **Fail-closed scrub** — `scrub_for_cloud()` scrubs, then re-scans output, raises
  `SecretLeakError` if any secret pattern survives. The re-scan is what makes it fail-CLOSED
  (not fail-open). Do not change to fail-open.
- **`AR_HINDSIGHT_CLOUD=1` opt-in** — default is localhost. Cloud requires explicit env var.
- **Quality gate** — drops retracted / empty / path-only records. Real corpora are ~74%
  retracted so this gate is doing real work, not decorative.
- **No verbatim storage** — Hindsight extracts facts; the recipe does not try to bypass this.
- **No LongMemEval / recall-% gain claims** — the recipe makes no benchmark claims. Do not
  add any.

---

## 7. Pre-Submit Checklist (verify these before running the submit commands)

- [ ] **Human GO received** (explicit approval to push + open PR)
- [ ] Re-confirm the 4 Hindsight API facts in §4 against current live docs at
      `hindsight.vectorize.io/developer/api/*` — they may have changed since 2026-06-23
- [ ] Live-run: `HINDSIGHT_LIVE=1 python import_corrections.py --sample` against a Hindsight
      at `localhost:8888` — confirm retain ✅, recall ✅, re-run no-dup ✅
- [ ] Docker command to start Hindsight locally (if not running):
      ```bash
      docker run -d --name hindsight -p 8888:8888 -p 9999:9999 \
        -e OPENAI_API_KEY=<your-openai-key> \
        ghcr.io/vectorize-io/hindsight:latest
      ```
      ⚠️ Use a real OpenAI key (not Prismma/relay) — `reflect` internal retrieval degrades
      through OpenAI-compatible relays. The Prismma key lives in `~/.aam/dreams/.env` but that
      gave the `reflect` caveat. For a clean reflect test, use an upstream OpenAI key.
- [ ] Confirm no outbound calls beyond the Hindsight `base_url` (check import_corrections.py
      — there are none currently)
- [ ] If you reference the AgentRecall CLI anywhere in the recipe, pin
      **`agent-recall-cli@3.4.31`** (npm-published) — NOT `3.4.33` or `3.4.34` (local only,
      would 404 on npx). Currently the recipe has no CLI references, only the Python client.
- [ ] Remove `.venv/` from the agentrecall-memory directory before copying upstream
      (it is already gitignored locally but double-check)

---

## 8. Submit Commands (run only after checklist is green + human GO)

```bash
# 1. Fork vectorize-io/hindsight-cookbook to Goldentrii account (one-time)
gh repo fork vectorize-io/hindsight-cookbook --clone --remote
cd hindsight-cookbook

# 2. Create branch
git checkout -b feat/agentrecall-memory

# 3. Copy recipe in — exclude .venv
mkdir -p applications/agentrecall-memory
rsync -av --exclude='.venv' \
  /Users/tongwu/Projects/AgentRecall/contrib/hindsight-cookbook/agentrecall-memory/ \
  applications/agentrecall-memory/

# 4. Add the README index entry (contents in README_INDEX_ENTRY.md) to the cookbook's
#    top-level README.md under the Applications section

# 5. Commit
git add applications/agentrecall-memory README.md
git commit -m "feat(agentrecall-memory): import AgentRecall corrections into a Hindsight bank"

# 6. Push to YOUR fork only (never upstream)
git push -u origin feat/agentrecall-memory

# 7. Open PR against upstream
gh pr create --repo vectorize-io/hindsight-cookbook \
  --title "feat(agentrecall-memory): import AgentRecall corrections into a Hindsight bank" \
  --body-file /Users/tongwu/Projects/AgentRecall/contrib/hindsight-cookbook/PR_BODY.md
```

Address the PR to maintainer **benfrank241**. PR-first is the right channel (Issues tab is
empty all-time on the repo).

---

## 9. What NOT To Do

- **Do not push to Goldentrii/AgentRecall or Goldentrii/AgentRecall-MCP** — this PR is to
  the upstream `vectorize-io/hindsight-cookbook` repo
- **Do not npm publish** `agent-recall-cli@3.4.34` before the owner approves (REDLINE)
- **Do not change the honest framing** (AgentRecall = capture/governance, NOT learning)
- **Do not add benchmark or recall-% gain claims**
- **Do not change `document_id` from `rec["id"]` to filename stem** — they diverge
- **Do not make `scrub_for_cloud()` fail-open** (the re-scan is load-bearing)

---

## 10. AR Backlog Context (not your task, but FYI)

The integration revealed a 7-item AgentRecall improvement backlog in `AGENTRECALL-BACKLOG.md`.
Item #1 (`ar corrections export`) shipped as v3.4.34. Items #2–#7 are pending. These are
separate from this PR — do not conflate them.

---

## 11. Key Paths for Reference

| Resource | Path |
|----------|------|
| This folder | `/Users/tongwu/Projects/AgentRecall/contrib/hindsight-cookbook/` |
| Recipe (upload this) | `agentrecall-memory/` |
| PR body | `PR_BODY.md` |
| Submit instructions | `PR.md` |
| AR repo | `~/Projects/AgentRecall/` |
| Dreams env (Prismma keys) | `~/.aam/dreams/.env` |
| AR local memory | `~/.claude/projects/-Users-tongwu-Projects-AgentRecall/memory/` |

---

*Built 2026-06-23 via 20-agent round-table workflow `wf_8eaa43b3-3b0`. Last updated 2026-06-26.*
