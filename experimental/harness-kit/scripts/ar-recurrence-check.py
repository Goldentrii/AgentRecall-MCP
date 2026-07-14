#!/usr/bin/env python3
"""
ar-recurrence-check.py — Error class taxonomy scanner and reflection driver.

Taxonomy schema (taxonomy.json):
  version: int
  updated: YYYY-MM-DD
  classes[]:
    id: str                         e.g. "C1"
    name: str
    description: str
    keywords: list[str]             case-insensitive substring match against rule+tags
    rule_ref: str                   human-readable reference to the encoded rule
    rule_date: YYYY-MM-DD           date the rule was first encoded
    rule_date_confidence: exact|approx
    members[]:
      id: str                       "<project_slug>/<filename_stem>" (no .json)
      project: str                  directory slug
      date: YYYY-MM-DD
      rule_snippet: str             first ≤100 chars of rule text
      phantom: bool                 true if correction date STRICTLY after rule_date
      phantom_note: str             context; includes "(approx rule date)" when confidence==approx
      provisional: bool             true = auto-classified by --scan; false = human-curated
    related: list[str]              list of related class ids
    status: open|re-abstracted
    history: list[{date, action}]
  unclassified[]:
    id: str
    project: str
    date: YYYY-MM-DD
    rule_snippet: str

Usage:
  python3 ar-recurrence-check.py --scan             classify new corrections
  python3 ar-recurrence-check.py --report           markdown report to stdout
  python3 ar-recurrence-check.py --mark-reflected   reset sessions_since counter
"""

import argparse
import json
import os
import sys
import tempfile
from datetime import date as date_cls
from pathlib import Path


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

def get_ar_root() -> Path:
    raw = os.environ.get("AR_ROOT", "~/.agent-recall")
    return Path(raw).expanduser()


def taxonomy_path(ar_root: Path) -> Path:
    return ar_root / "taxonomy.json"


def reflection_state_path(ar_root: Path) -> Path:
    return ar_root / "reflection-state.json"


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def load_json(path: Path) -> dict | list:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def atomic_write_json(path: Path, data: dict | list) -> None:
    """Write JSON atomically via a temp file in the same directory."""
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    tmp.replace(path)


def load_taxonomy(ar_root: Path) -> dict:
    p = taxonomy_path(ar_root)
    if not p.exists():
        print(f"ERROR: taxonomy.json not found at {p}", file=sys.stderr)
        sys.exit(1)
    return load_json(p)


def load_reflection_state(ar_root: Path) -> dict:
    p = reflection_state_path(ar_root)
    if p.exists():
        try:
            return load_json(p)
        except (json.JSONDecodeError, OSError) as e:
            print(f"WARNING: could not load reflection-state.json: {e}", file=sys.stderr)
    # Return defaults if missing or corrupt
    return {
        "version": 1,
        "last_reflection": None,
        "sessions_since": 0,
        "K": 10,
        "last_increment": None,
    }


# ---------------------------------------------------------------------------
# Correction loading
# ---------------------------------------------------------------------------

def correction_member_id(slug: str, filename_stem: str) -> str:
    return f"{slug}/{filename_stem}"


def load_all_corrections(ar_root: Path) -> list[tuple[str, str, dict]]:
    """
    Yield (slug, filename_stem, record) for every valid correction record.

    Handles:
      - each .json file may contain a dict or a list of dicts
      - files starting with '_' are skipped (outcomes/rejected logs)
      - non-.json files skipped
      - corrupt/unreadable files → stderr warning, scan continues
      - records with empty rule text → skipped silently
    """
    projects_dir = ar_root / "projects"
    if not projects_dir.exists():
        return []

    results = []
    for project_dir in sorted(projects_dir.iterdir()):
        if not project_dir.is_dir():
            continue
        corrections_dir = project_dir / "corrections"
        if not corrections_dir.is_dir():
            continue
        slug = project_dir.name

        for corr_file in sorted(corrections_dir.iterdir()):
            if not corr_file.is_file():
                continue
            if corr_file.name.startswith("_"):
                continue
            if corr_file.suffix.lower() != ".json":
                continue

            filename_stem = corr_file.stem

            try:
                raw = load_json(corr_file)
            except (json.JSONDecodeError, OSError, UnicodeDecodeError) as exc:
                print(
                    f"WARNING: skipping {corr_file} — {exc}",
                    file=sys.stderr,
                )
                continue

            # Normalise to list of records
            if isinstance(raw, dict):
                records = [raw]
            elif isinstance(raw, list):
                records = raw
            else:
                print(
                    f"WARNING: skipping {corr_file} — unexpected type {type(raw).__name__}",
                    file=sys.stderr,
                )
                continue

            for record in records:
                if not isinstance(record, dict):
                    continue
                rule = record.get("rule", "") or ""
                if not rule.strip():
                    continue  # skip records with empty rule text
                if record.get("retracted_at"):
                    continue  # retracted corrections are withdrawn signal, not errors
                results.append((slug, filename_stem, record))

    return results


# ---------------------------------------------------------------------------
# Taxonomy helpers
# ---------------------------------------------------------------------------

def build_known_ids(taxonomy: dict) -> set[str]:
    """Return all member ids already referenced in the taxonomy."""
    known: set[str] = set()
    for cls in taxonomy.get("classes", []):
        for m in cls.get("members", []):
            known.add(m["id"])
    for item in taxonomy.get("unclassified", []):
        known.add(item["id"])
    return known


def keyword_score(record: dict, keywords: list[str]) -> int:
    """Count how many keywords appear (case-insensitive substring) in rule+tags."""
    rule = record.get("rule", "") or ""
    tags = " ".join(record.get("tags", []) or [])
    haystack = (rule + " " + tags).lower()
    return sum(1 for kw in keywords if kw.lower() in haystack)


def is_phantom(correction_date: str, rule_date: str) -> bool:
    """
    Return True iff correction_date STRICTLY after rule_date.
    Same day = genesis, not phantom.
    Invalid/missing dates → False (safe default).
    """
    if not correction_date or not rule_date:
        return False
    try:
        c = date_cls.fromisoformat(correction_date)
        r = date_cls.fromisoformat(rule_date)
        # clamp to today in case of future-dated corrections:
        # phantom comparison is still strict date compare; no crash.
        return c > r
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# --scan
# ---------------------------------------------------------------------------

def cmd_scan(ar_root: Path) -> None:
    taxonomy = load_taxonomy(ar_root)
    classes = taxonomy.setdefault("classes", [])
    unclassified = taxonomy.setdefault("unclassified", [])

    known_ids = build_known_ids(taxonomy)
    all_corrections = load_all_corrections(ar_root)

    new_per_class: dict[str, int] = {cls["id"]: 0 for cls in classes}
    new_unclassified = 0

    for slug, filename_stem, record in all_corrections:
        member_id = correction_member_id(slug, filename_stem)
        if member_id in known_ids:
            continue
        known_ids.add(member_id)

        rule = record.get("rule", "") or ""
        rule_snippet = rule[:100]
        corr_date = record.get("date", "") or ""

        # Score against every class
        scores: list[tuple[int, dict]] = [
            (keyword_score(record, cls.get("keywords", [])), cls)
            for cls in classes
        ]

        # Highest score first for ternary ordering (highest threshold first)
        scores.sort(key=lambda x: -x[0])
        best_score = scores[0][0] if scores else 0

        # Tie check: how many classes share the top score?
        top_count = sum(1 for s, _ in scores if s == best_score)
        if best_score == 0 or top_count > 1:
            # Zero hits or tie → unclassified
            unclassified.append(
                {
                    "id": member_id,
                    "project": slug,
                    "date": corr_date,
                    "rule_snippet": rule_snippet,
                }
            )
            new_unclassified += 1
            continue

        # Single winner
        winning_cls = scores[0][1]
        rule_date = winning_cls.get("rule_date", "") or ""
        rule_date_confidence = winning_cls.get("rule_date_confidence", "approx")

        phantom = is_phantom(corr_date, rule_date)
        phantom_note = ""
        if phantom and rule_date_confidence == "approx":
            phantom_note = "(approx rule date)"

        new_member = {
            "id": member_id,
            "project": slug,
            "date": corr_date,
            "rule_snippet": rule_snippet,
            "phantom": phantom,
            "phantom_note": phantom_note,
            "provisional": True,
        }

        winning_cls.setdefault("members", []).append(new_member)
        new_per_class[winning_cls["id"]] = new_per_class.get(winning_cls["id"], 0) + 1

    # Total phantom count across all classes
    total_phantom = sum(
        1
        for cls in classes
        for m in cls.get("members", [])
        if m.get("phantom", False)
    )

    # Atomic write-back
    taxonomy["updated"] = str(date_cls.today())
    atomic_write_json(taxonomy_path(ar_root), taxonomy)

    # Summary output
    print("New provisional corrections per class:")
    for cls in classes:
        count = new_per_class.get(cls["id"], 0)
        print(f"  {cls['id']} ({cls['name']}): +{count}")
    print(f"New unclassified: +{new_unclassified}")
    print(f"Total phantom count (all classes): {total_phantom}")


# ---------------------------------------------------------------------------
# --report
# ---------------------------------------------------------------------------

def cmd_report(ar_root: Path) -> None:
    taxonomy = load_taxonomy(ar_root)
    state = load_reflection_state(ar_root)

    classes = taxonomy.get("classes", [])
    unclassified = taxonomy.get("unclassified", [])

    # Header stats — confirmed phantoms (non-provisional) headline; provisional
    # phantom candidates counted separately so the two never sum past totals
    total_members = sum(len(cls.get("members", [])) for cls in classes)
    confirmed_phantom = sum(
        1
        for cls in classes
        for m in cls.get("members", [])
        if m.get("phantom", False) and not m.get("provisional", False)
    )
    provisional_phantom = sum(
        1
        for cls in classes
        for m in cls.get("members", [])
        if m.get("phantom", False) and m.get("provisional", False)
    )
    total_provisional = sum(
        1
        for cls in classes
        for m in cls.get("members", [])
        if m.get("provisional", False)
    )

    print("# Error Class Taxonomy Report")
    print(f"\nGenerated: {date_cls.today()}")
    print(f"\n## Stats\n")
    print(f"- Classes: {len(classes)}")
    print(f"- Total members: {total_members}")
    print(f"- Confirmed phantom: {confirmed_phantom} · provisional phantom candidates: {provisional_phantom}")
    print(f"- Provisional members awaiting /reflect triage: {total_provisional}")
    print(f"- Unclassified: {len(unclassified)}")
    print()

    # Per-class tables
    for cls in classes:
        confirmed_ph = sum(
            1 for m in cls.get("members", [])
            if m.get("phantom", False) and not m.get("provisional", False)
        )
        provisional_ph = sum(
            1 for m in cls.get("members", [])
            if m.get("phantom", False) and m.get("provisional", False)
        )
        print(f"## {cls['id']}: {cls['name']}")
        print(f"\nRule: `{cls.get('rule_ref', '')}` (since {cls.get('rule_date', '?')}, {cls.get('rule_date_confidence', '?')})")
        print(f"Status: {cls.get('status', 'open')} | Confirmed phantoms: {confirmed_ph} | Provisional phantom candidates: {provisional_ph}")
        print()
        members = cls.get("members", [])
        if members:
            print("| Date | Project | Rule (≤60 chars) | Phantom | Prov |")
            print("|------|---------|-----------------|---------|------|")
            for m in members:
                snippet = ((m.get("rule_snippet", "") or "")[:60]).replace("|", "\\|")
                phantom_mark = "YES" if m.get("phantom") else "no"
                prov_mark = "prov" if m.get("provisional") else ""
                pnote = (m.get("phantom_note", "") or "").replace("|", "\\|")
                if pnote and m.get("phantom"):
                    phantom_mark = f"YES — {pnote}"
                print(f"| {m.get('date','')} | {m.get('project','')} | {snippet} | {phantom_mark} | {prov_mark} |")
        else:
            print("_(no members)_")
        print()

    # Unclassified list
    print("## Unclassified")
    if unclassified:
        print()
        print("| Date | Project | Rule (≤60 chars) |")
        print("|------|---------|-----------------|")
        for item in unclassified:
            snippet = ((item.get("rule_snippet", "") or "")[:60]).replace("|", "\\|")
            print(f"| {item.get('date','')} | {item.get('project','')} | {snippet} |")
    else:
        print("\n_(none)_")
    print()

    # Footer: reflection cadence
    sessions_since = state.get("sessions_since", 0)
    K = state.get("K", 10)
    last_reflection = state.get("last_reflection") or "never"
    reflect_flag = " — **REFLECT DUE**" if sessions_since >= K else ""
    print("---")
    print(
        f"\nSessions since last reflection: {sessions_since}/{K}"
        f" (last: {last_reflection}){reflect_flag}"
    )


# ---------------------------------------------------------------------------
# --mark-reflected
# ---------------------------------------------------------------------------

def cmd_mark_reflected(ar_root: Path) -> None:
    p = reflection_state_path(ar_root)
    state = load_reflection_state(ar_root)
    today = str(date_cls.today())
    state["last_reflection"] = today
    state["sessions_since"] = 0
    atomic_write_json(p, state)
    print(f"Reflection marked. last_reflection={today}, sessions_since=0")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="ar-recurrence-check — error class taxonomy scanner"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--scan", action="store_true", help="classify new corrections")
    group.add_argument("--report", action="store_true", help="print markdown report to stdout")
    group.add_argument("--mark-reflected", action="store_true", help="reset sessions_since to 0")
    args = parser.parse_args()

    ar_root = get_ar_root()

    if args.scan:
        cmd_scan(ar_root)
    elif args.report:
        cmd_report(ar_root)
    elif args.mark_reflected:
        cmd_mark_reflected(ar_root)


if __name__ == "__main__":
    main()
