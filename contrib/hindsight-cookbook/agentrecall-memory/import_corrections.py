#!/usr/bin/env python3
"""Import AgentRecall corrections into a Hindsight memory bank.

AgentRecall (https://github.com/Goldentrii/AgentRecall, MIT, local-first) captures
an AI coding agent's *corrections* — a mistake plus the rule that fixes it — and
governs them (which are still active, their severity/weight, how often they recur).
This loader reads those corrections and `retain()`s them into a Hindsight bank, so
`recall`/`reflect` surface the corrected understanding at the start of a new
session and the agent stops repeating the mistake.

Division of labor (honest framing):
  * AgentRecall = correction CAPTURE + GOVERNANCE  (active/weight/recurrence/retraction)
  * Hindsight   = belief synthesis + cross-session RECALL  (the engine)

Run it with the bundled fixture (no AgentRecall install needed):
    pip install -r requirements.txt
    # start Hindsight locally first (see README), then:
    HINDSIGHT_LIVE=1 python import_corrections.py --sample

Or against a real local AgentRecall store:
    HINDSIGHT_LIVE=1 python import_corrections.py --project my-project

Cloud egress is OPT-IN. By default everything targets http://localhost:8888 and
nothing leaves your machine. To target Hindsight Cloud you must set
AR_HINDSIGHT_CLOUD=1 (and HINDSIGHT_API_KEY) — see `resolve_client()`.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# 1. Read corrections — from a real AgentRecall store, or the bundled fixture.
#    Corrections are read from on-disk JSON because that is the only path that
#    preserves severity / weight / recurrence. (`ar recall` returns ranked
#    excerpts that drop those fields; there is no `ar corrections list --json`.)
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_AR_ROOT = Path(os.path.expanduser("~/.agent-recall"))


def load_corrections(
    *, sample: bool = False, project: Optional[str] = None, ar_root: Path = DEFAULT_AR_ROOT
) -> List[Dict[str, Any]]:
    """Return raw CorrectionRecord dicts.

    sample=True reads the self-contained fixture next to this file.
    Otherwise globs <ar_root>/projects/<project|*>/corrections/*.json.
    """
    if sample:
        fixture = Path(__file__).with_name("sample_corrections.json")
        return json.loads(fixture.read_text(encoding="utf-8"))

    proj_glob = project if project else "*"
    # `project` names a single directory segment, never a path. Reject separators
    # and parent refs so a crafted --project can't glob outside <ar_root>/projects/.
    if project and (os.sep in project or (os.altsep and os.altsep in project) or ".." in project):
        sys.exit(f"--project must be a single project name, not a path: {project!r}")
    pattern = str(ar_root / "projects" / proj_glob / "corrections" / "*.json")
    records: List[Dict[str, Any]] = []
    for path in sorted(glob.glob(pattern)):
        try:
            records.append(json.loads(Path(path).read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            # A malformed record is skipped, never fatal — mirror AgentRecall's
            # own never-throw read posture.
            continue
    return records


# ─────────────────────────────────────────────────────────────────────────────
# 2. Quality gate — real correction corpora are noisy.
#    On a live store ~74% of records are retracted (active:false), and a few have
#    empty or path-only `rule` fields. Importing those would teach the bank stale
#    or junk beliefs, so we drop them BEFORE anything is retained.
# ─────────────────────────────────────────────────────────────────────────────

# A rule that is just a file path or an image placeholder carries no learnable
# behavior — drop it.
_PATH_OR_PLACEHOLDER = re.compile(r"^\s*(/|\.{1,2}/|[A-Za-z]:\\|!\[|<image)", re.IGNORECASE)


def is_durable(rec: Dict[str, Any]) -> bool:
    """True if this correction is an active, non-empty, learnable rule with a usable id."""
    if not (rec.get("id") or "").strip():
        return False  # no id → no stable document_id → drop at the gate, never KeyError downstream
    # `active` defaults True: older records predate the field, and AgentRecall only writes
    # active=false on explicit retraction. Junk is caught by the rule checks below.
    if not rec.get("active", True):
        return False
    rule = (rec.get("rule") or "").strip()
    if len(rule) < 8:
        return False
    if _PATH_OR_PLACEHOLDER.match(rule):
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# 3. Fail-CLOSED secret scrub.
#    Corrections are a NET-NEW egress path: AgentRecall's own scrub runs only
#    inside its Supabase sync chokepoint (and is fail-OPEN). Pushing corrections
#    to Hindsight bypasses it entirely, so we re-apply a scrub here — and unlike
#    upstream, this one RE-SCANS its output and RAISES if any secret survives.
# ─────────────────────────────────────────────────────────────────────────────

_SECRET_PATTERNS: List[re.Pattern] = [
    re.compile(r"AKIA[0-9A-Z]{16}"),                       # AWS access key id
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),             # GitHub PAT / OAuth / server / refresh
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),           # GitHub fine-grained PAT
    re.compile(r"sk-[A-Za-z0-9]{20,}"),                    # OpenAI / Anthropic-style secret key
    re.compile(r"xoxb-[A-Za-z0-9-]{10,}"),                 # Slack bot token
    re.compile(r"npm_[A-Za-z0-9]{36}"),                    # npm token
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),  # JWT (incl. Supabase/Clerk)
    re.compile(r"_authToken\s*=\s*\S+"),                   # .npmrc auth token
    re.compile(
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
    ),                                                     # full PEM block
]

_REDACTION = "[REDACTED]"


class SecretLeakError(RuntimeError):
    """Raised when a secret survives scrubbing — the fail-CLOSED guarantee."""


def scrub_for_cloud(text: str) -> str:
    """Redact known secret shapes, then re-scan and RAISE if any survived.

    Fail-closed: it is better to abort the import than to ship a token.
    """
    if not text:
        return text
    scrubbed = text
    for pat in _SECRET_PATTERNS:
        scrubbed = pat.sub(_REDACTION, scrubbed)
    # Re-scan the OUTPUT. If anything still matches, the redaction was incomplete.
    for pat in _SECRET_PATTERNS:
        if pat.search(scrubbed):
            raise SecretLeakError(
                f"secret survived scrub ({pat.pattern[:24]}…) — refusing to retain"
            )
    return scrubbed


# ─────────────────────────────────────────────────────────────────────────────
# 4. Map a CorrectionRecord → retain() kwargs.
#    content = the corrected behavior (Hindsight extracts the fact from it; it is
#    never stored verbatim). document_id = rec["id"] (NOT the filename stem — on a
#    live store 69/87 ids diverge from their stem) so re-importing upserts cleanly.
#    metadata values must be strings.
# ─────────────────────────────────────────────────────────────────────────────


def bank_id_for(project: str) -> str:
    """Per-project hard isolation. Tags are query filters, NOT a security boundary."""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "-", project or "default")
    return f"agentrecall-{safe}"


def to_retain_kwargs(rec: Dict[str, Any]) -> Dict[str, Any]:
    project = rec.get("project") or "default"
    rule = scrub_for_cloud((rec.get("rule") or "").strip())
    context = scrub_for_cloud((rec.get("context") or "").strip()) or None

    # All metadata values are stringified (Hindsight requires Dict[str, str]) AND
    # scrubbed — metadata and tags are outbound too, not just content/context.
    # `confidence_basis` documents what the weight MEANS — it is correction
    # AUTHORITY, not retrieval relevance and not truth-probability.
    metadata = {
        "source": "agentrecall",
        "severity": scrub_for_cloud(str(rec.get("severity", ""))),
        "weight": scrub_for_cloud(str(rec.get("weight", ""))),
        "confidence_basis": "authority-weight",
        "recurrence_count": scrub_for_cloud(str(rec.get("recurrence_count", 0))),
        "first_seen": scrub_for_cloud(str(rec.get("date", ""))),
    }
    tags = [scrub_for_cloud(str(t)) for t in rec.get("tags", [])] + ["correction"]

    kwargs = {
        "bank_id": bank_id_for(project),
        "content": rule,
        "context": context,
        "document_id": rec["id"],          # is_durable() guarantees a non-empty id upstream
        "metadata": metadata,
        "tags": tags,
        "update_mode": "replace",           # a superseded correction replaces the prior version
    }
    # Final fail-closed sweep: NOTHING outbound escapes the scrub. Re-scan every
    # string that will leave the machine; scrub_for_cloud raises if a secret survives.
    for value in [kwargs["content"], kwargs["context"], *kwargs["tags"], *metadata.values()]:
        scrub_for_cloud(value or "")
    return kwargs


# ─────────────────────────────────────────────────────────────────────────────
# 5. Client resolution — localhost by default, cloud only on explicit opt-in.
# ─────────────────────────────────────────────────────────────────────────────


def resolve_client():  # pragma: no cover - requires hindsight_client + a server
    """Build a Hindsight client. Cloud egress requires AR_HINDSIGHT_CLOUD=1."""
    from hindsight_client import Hindsight  # imported lazily so the pure helpers test without it

    if os.environ.get("AR_HINDSIGHT_CLOUD") == "1":
        base_url = os.environ.get("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
        api_key = os.environ.get("HINDSIGHT_API_KEY")
        if not api_key:
            sys.exit("AR_HINDSIGHT_CLOUD=1 but HINDSIGHT_API_KEY is not set — refusing to send corrections to the cloud.")
        return Hindsight(base_url=base_url, api_key=api_key)

    base_url = os.environ.get("HINDSIGHT_BASE_URL", "http://localhost:8888")
    return Hindsight(base_url=base_url)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Orchestration.
# ─────────────────────────────────────────────────────────────────────────────


def import_corrections(records: Iterable[Dict[str, Any]], *, live: bool) -> Dict[str, Any]:
    """Gate → scrub → retain. Returns a summary. Retain only fires when live=True."""
    records = list(records)  # materialize once — safe to iterate repeatedly
    durable = [r for r in records if is_durable(r)]
    plans = [to_retain_kwargs(r) for r in durable]  # scrub happens here; raises on a leak

    summary: Dict[str, Any] = {
        "read": len(records),
        "durable": len(durable),
        "retained": 0,
        "banks": sorted({p["bank_id"] for p in plans}),
        "live": live,
    }

    if not live:
        return summary

    client = resolve_client()
    seen_banks = set()
    for plan in plans:
        if plan["bank_id"] not in seen_banks:
            try:
                client.create_bank(bank_id=plan["bank_id"], name=plan["bank_id"], mission="AgentRecall corrections for this project.")
            except Exception as exc:
                # Best-effort + idempotent: a second run hits an already-existing
                # bank, which must not abort the import. But a *real* failure
                # (auth, network) would otherwise be swallowed while the summary
                # still reported success — so surface it on stderr. If the bank
                # genuinely does not exist, the retain() below raises loudly.
                print(f"  warn: create_bank({plan['bank_id']!r}) failed: {exc}", file=sys.stderr)
            seen_banks.add(plan["bank_id"])
        client.retain(**plan)
        summary["retained"] += 1
    return summary


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = parser.add_mutually_exclusive_group()
    src.add_argument("--sample", action="store_true", help="use the bundled fixture (no AgentRecall install)")
    src.add_argument("--project", help="import one project's corrections from ~/.agent-recall")
    parser.add_argument("--ar-root", default=str(DEFAULT_AR_ROOT), help="AgentRecall store root")
    args = parser.parse_args(argv)

    live = os.environ.get("HINDSIGHT_LIVE") == "1"
    if args.sample:
        records = load_corrections(sample=True)
    elif args.project:
        records = load_corrections(project=args.project, ar_root=Path(args.ar_root))
    else:
        print("(no --project given; using the bundled fixture)\n")
        records = load_corrections(sample=True)  # frictionless first run, no live-store glob

    summary = import_corrections(records, live=live)
    print(json.dumps(summary, indent=2))
    if not live:
        print("\nHINDSIGHT_LIVE is not set — this was a DRY RUN (gate + scrub only, no retain).")
        print("Start Hindsight (see README) and re-run with HINDSIGHT_LIVE=1 to actually import.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
