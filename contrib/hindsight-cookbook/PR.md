# Hindsight Cookbook PR — handover (NOT YET SUBMITTED)

> **REDLINE.** Nothing here has been pushed or opened. No `git push`, no `gh pr create` has
> run. This directory is staged locally for your review. Submitting is a human decision.

## What this is

A ready-to-submit contribution to [`vectorize-io/hindsight-cookbook`](https://github.com/vectorize-io/hindsight-cookbook):
a notebook + loader that imports AgentRecall corrections into a Hindsight bank. Built by a
12-lens round-table (20 agents) with an adversarial review pass that corrected the design
against Hindsight's live API docs.

**Staged recipe:** `contrib/hindsight-cookbook/agentrecall-memory/`
→ targets `applications/agentrecall-memory/` in the cookbook.

## Why `applications/` and not `notebooks/`

`notebooks/` is inside the cookbook's nbmake CI glob — every notebook there is auto-executed
against a live Hindsight container on CI. We cannot satisfy that in this session (no live
instance verified). The existing `claude-code-memory` recipe set the precedent: a
host-memory data-source recipe lives under `applications/` and merged with its live-run
boxes unchecked.

## Pre-submit checklist (do these BEFORE submitting)

- [ ] **HUMAN GO (REDLINE):** explicit approval to push + open the PR.
- [ ] **Re-fetch the Hindsight API** from live docs and re-confirm the four facts the
      round-table corrected: `append` concatenates (not accumulates); `recall` has **no**
      per-result score; `reflect.text` is empty when `response_schema` is set; `retain`
      extracts facts (never verbatim). *(All four were confirmed against
      `hindsight.vectorize.io/developer/api/*` during the build — re-verify they haven't
      changed.)*
- [ ] **Live-run** `HINDSIGHT_LIVE=1 python import_corrections.py --sample` against a real
      Hindsight at `localhost:8888`; confirm retain succeeds, recall returns a result, and a
      **re-run does not duplicate** (document_id upsert durable across calls).
- [ ] Confirm the recipe makes **no LongMemEval / recall-% gain claim** (it doesn't).
- [ ] Confirm no outbound calls beyond the Hindsight `base_url` (no telemetry).
- [ ] If you reference the AgentRecall CLI anywhere, pin **`agent-recall-cli@3.4.31`** (the
      npm-published version) — never `3.4.33` (local/unpublished; would 404 on npx).

## Submit (only after the checklist is green)

```bash
# 1. Fork vectorize-io/hindsight-cookbook to your account (one-time), then:
gh repo fork vectorize-io/hindsight-cookbook --clone --remote
cd hindsight-cookbook
git checkout -b feat/agentrecall-memory

# 2. Copy the staged recipe in:
mkdir -p applications/agentrecall-memory
cp -r /Users/tongwu/Projects/AgentRecall/contrib/hindsight-cookbook/agentrecall-memory/* \
      applications/agentrecall-memory/

# 3. Add the index entry from README_INDEX_ENTRY.md to the cookbook's top-level README.

# 4. Push to YOUR fork (never upstream) and open the PR:
git add applications/agentrecall-memory
git commit -m "feat(agentrecall-memory): import AgentRecall corrections into a Hindsight bank"
git push -u origin feat/agentrecall-memory
gh pr create --repo vectorize-io/hindsight-cookbook \
  --title "feat(agentrecall-memory): import AgentRecall corrections into a Hindsight bank" \
  --body-file /Users/tongwu/Projects/AgentRecall/contrib/hindsight-cookbook/PR_BODY.md
```

PR-first is the de-facto channel (the repo's Issues tab is empty all-time). Address the PR
to maintainer **benfrank241**.
