# taxonomy.json — Error-Class Taxonomy Schema

The recurrence loop's central data file. It groups corrections from the AgentRecall
corrections store into named **error classes**, tracks which members are **phantom
gradient steps** (violations that happened *after* the covering rule was already
encoded), and drives the `/arreflect` re-abstraction cadence.

- **Location:** `$AR_ROOT/taxonomy.json` — default `~/.agent-recall/taxonomy.json`
  (`AR_ROOT` env override is honored by both kit scripts).
- **Written by:** `scripts/ar-recurrence-check.py --scan` (appends provisional members,
  atomic temp-file write) and by the `/arreflect` triage loop (direct JSON edits,
  validated with `python3 -m json.tool`).
- **Read by:** `scripts/ar-recurrence-check.py --report` and
  `scripts/ar-scoreboard.py` (the `reflect` digest line).
- **Must exist before the first `--scan`** — the scanner exits 1 if the file is
  missing. Seed it with the empty skeleton below. (`ar-scoreboard.py` degrades
  gracefully: it prints `taxonomy not seeded`.)

This document describes the **schema only**. Class definitions and members are
owner-curated data — the kit ships none.

## Empty skeleton (seed file)

```json
{
  "version": 1,
  "updated": "2026-07-14",
  "classes": [],
  "unclassified": []
}
```

## Top level

| Field | Type | Meaning |
|---|---|---|
| `version` | int | Schema version. Currently `1`. |
| `updated` | str `YYYY-MM-DD` | Last write date. `--scan` stamps it on every run. |
| `classes` | list | Curated error classes (see below). Classes are **never auto-created** — `--scan` only appends members to existing classes; new classes are proposed during `/arreflect` and added with owner approval. |
| `unclassified` | list | Corrections that matched zero classes, or tied between two or more classes, at scan time. Raw material for Step 3 of `/arreflect` (cluster → propose new class). |

## `classes[]` — one error class

| Field | Type | Meaning |
|---|---|---|
| `id` | str | Short stable id, e.g. `"C1"`. |
| `name` | str | Human-readable class name. |
| `description` | str | What failure pattern this class covers. Used by the `/arreflect` LLM judge when confirming provisional members. |
| `keywords` | list[str] | Case-insensitive **substring** matches against a correction's `rule` + `tags`. Drives `--scan` auto-classification (see scoring below). |
| `rule_ref` | str | Human-readable pointer to the encoded rule that covers this class (e.g. a CLAUDE.md section or `rules/<file>.md` entry). |
| `rule_date` | str `YYYY-MM-DD` | Date the rule was first encoded. The phantom comparison anchor. |
| `rule_date_confidence` | `"exact"` \| `"approx"` | How reliable `rule_date` is. When `"approx"`, phantom members carry the note `"(approx rule date)"`. |
| `members` | list | Corrections assigned to this class (see below). |
| `related` | list[str] | Ids of related classes. Curation aid; not used by the scanner. |
| `status` | `"open"` \| `"re-abstracted"` | `"re-abstracted"` is set when the owner approves a broader rule rewrite for this class (Step 4 of `/arreflect`). |
| `history` | list[{`date`, `action`}] | Append-only audit trail of reflection decisions, e.g. `{"date": "2026-07-14", "action": "re-abstracted: <one-line summary>"}`. |

## `classes[].members[]` — one classified correction

| Field | Type | Meaning |
|---|---|---|
| `id` | str | `"<project_slug>/<filename_stem>"` — the correction file's project directory and filename without `.json`. Uniqueness key across the whole taxonomy (a member id appears at most once, in one class or in `unclassified`). |
| `project` | str | Project directory slug. |
| `date` | str `YYYY-MM-DD` | The correction's own date. |
| `rule_snippet` | str | First ≤100 chars of the correction's rule text. |
| `phantom` | bool | `true` iff the correction date is **strictly after** the class's `rule_date`. Same-day = genesis (the correction that produced the rule), not phantom. Invalid or missing dates → `false` (safe default). A phantom member is a **phantom gradient step**: the rule existed, the violation still happened. |
| `phantom_note` | str | Context for the phantom flag; `"(approx rule date)"` when `rule_date_confidence == "approx"`. Empty otherwise. |
| `provisional` | bool | `true` = auto-classified by `--scan`, awaiting `/arreflect` triage (confirm / reassign / move to unclassified). `false` = human-curated. Reports count confirmed and provisional phantoms separately so headline numbers never mix the two. |
| `retracted_source` | bool *(optional)* | Curation flag observed in live data: the source correction was later retracted *after* this member was classified. Not written by `ar-recurrence-check.py` (the scanner skips already-retracted corrections up front); set during triage to preserve the audit trail instead of deleting the member. |

## `unclassified[]` — one unassigned correction

| Field | Type | Meaning |
|---|---|---|
| `id` | str | Same `"<project_slug>/<filename_stem>"` key as members. |
| `project` | str | Project directory slug. |
| `date` | str `YYYY-MM-DD` | The correction's date. |
| `rule_snippet` | str | First ≤100 chars of rule text. |

## Scan semantics (`ar-recurrence-check.py --scan`)

1. Walk `$AR_ROOT/projects/*/corrections/*.json`. Skipped: files starting with `_`
   (outcome/rejected logs), non-`.json` files, records with empty `rule` text,
   records with `retracted_at` set, corrupt files (warning to stderr, scan continues).
   A file may contain a single record or a list of records.
2. Skip any correction whose member id is already present anywhere in the taxonomy.
3. Score the correction against every class: count how many of the class's
   `keywords` appear (case-insensitive substring) in `rule + " " + tags`.
4. **Single highest scorer wins** → appended to that class's `members` with
   `provisional: true` and the phantom flag computed against the class's `rule_date`.
   **Zero hits or a tie** for the top score → appended to `unclassified`.
5. Stamp `updated`, write atomically (temp file + rename).

## Companion file: reflection-state.json

Sibling state file at `$AR_ROOT/reflection-state.json`, shared by both scripts and
the `ar-nudge.py` hook. Created with defaults on first `ar-scoreboard.py` run.

| Field | Type | Meaning |
|---|---|---|
| `version` | int | Currently `1`. |
| `last_reflection` | str \| null | ISO date of the last completed `/arreflect` (`--mark-reflected` sets it). |
| `sessions_since` | int | Sessions since last reflection. Incremented by the scoreboard digest (30-min dedup guard). Reset to 0 by `--mark-reflected`. |
| `K` | int | Reflection cadence. When `sessions_since >= K`, the digest shows **REFLECT DUE** and `ar-nudge.py` starts nudging (at most once per 6 h). Default 10. |
| `last_increment` | str \| null | ISO datetime of the last `sessions_since` increment (dedup anchor). |

## Minimal synthetic example (1 class)

Illustrative only — not real data. A correction dated 2026-07-08 lands in a class
whose rule was encoded 2026-07-01, so it is a phantom gradient step.

```json
{
  "version": 1,
  "updated": "2026-07-14",
  "classes": [
    {
      "id": "C1",
      "name": "Unapproved externally-visible action",
      "description": "Agent performed a push/publish/deploy-type action without an explicit owner approval in the same session.",
      "keywords": ["push", "publish", "deploy", "approval", "permission"],
      "rule_ref": "CLAUDE.md > Hard Rules > release gate",
      "rule_date": "2026-07-01",
      "rule_date_confidence": "exact",
      "members": [
        {
          "id": "my-app/2026-07-08-never-publish-without-approval",
          "project": "my-app",
          "date": "2026-07-08",
          "rule_snippet": "Never publish without explicit owner approval",
          "phantom": true,
          "phantom_note": "",
          "provisional": false
        }
      ],
      "related": [],
      "status": "open",
      "history": [
        { "date": "2026-07-14", "action": "class created at /arreflect triage" }
      ]
    }
  ],
  "unclassified": []
}
```
