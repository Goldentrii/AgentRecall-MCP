#!/usr/bin/env python3
"""PreToolUse hook on the Agent tool — model-field guard.

Enforces CLAUDE.md: "Every dispatch carries explicit `model` (never inherit Fable)."

This hook WARNS only; it never blocks a dispatch and never exits non-zero.
Forks are exempt because they always inherit by design.
"""

from __future__ import annotations

import json
import sys


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    if payload.get("tool_name") != "Agent":
        return 0

    tool_input = payload.get("tool_input") or {}

    # Forks always inherit — exempt by design.
    if tool_input.get("subagent_type") == "fork":
        return 0

    # Non-empty model field satisfies the rule.
    if tool_input.get("model"):
        return 0

    msg = (
        "⚠ C3 guard: Agent dispatch has no explicit `model` — CLAUDE.md requires one on "
        "every dispatch (never inherit Fable). Add model: sonnet (workers/reviewers) | opus/haiku "
        "as appropriate. If this agent type pins a model in its frontmatter, ignore."
    )
    print(json.dumps({
        "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": msg}
    }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
