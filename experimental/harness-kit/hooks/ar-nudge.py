#!/usr/bin/env python3
"""
ar-nudge.py — UserPromptSubmit hook: surface overdue AgentRecall reflection.

Design principle (owner, 2026-07-14): injection tokens are the cheapest
resource; memory that never resurfaces is a negative asset. This hook makes
the /arreflect cadence impossible to miss even mid-session (the SessionStart
digest only fires at session boundaries).

Fires at most once per 6 hours (guard file). Exit 0 on every path.
"""

import json
import os
import sys
import datetime
from pathlib import Path

AR_ROOT = Path(os.environ.get("AR_ROOT", "~/.agent-recall")).expanduser()
STATE = AR_ROOT / "reflection-state.json"
GUARD = AR_ROOT / ".nudge-state.json"
GUARD_WINDOW_S = 6 * 3600


def emit(msg: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": msg,
        }
    }))


def main() -> None:
    # Consume stdin per hook protocol; content unused, malformed is fine
    try:
        json.load(sys.stdin)
    except Exception:
        pass

    try:
        with open(STATE) as f:
            state = json.load(f)
    except Exception:
        sys.exit(0)

    sessions_since = state.get("sessions_since", 0)
    k = state.get("K", 10)
    if not isinstance(sessions_since, int) or not isinstance(k, int):
        sys.exit(0)
    if sessions_since < k:
        sys.exit(0)

    # 6h anti-nag guard
    now = datetime.datetime.now()
    try:
        with open(GUARD) as f:
            guard = json.load(f)
        last = guard.get("last_reflect_nudge")
        if last:
            last_dt = datetime.datetime.fromisoformat(last)
            if (now - last_dt).total_seconds() < GUARD_WINDOW_S:
                sys.exit(0)
    except Exception:
        guard = {}

    emit(
        f"⚡ AgentRecall: reflection overdue ({sessions_since} sessions ≥ K={k}) "
        f"— run /arreflect to triage recurrence and close the loop."
    )

    try:
        tmp = GUARD.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"last_reflect_nudge": now.isoformat()}, f)
            f.write("\n")
        os.replace(tmp, GUARD)
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
