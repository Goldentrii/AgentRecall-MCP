# C1 Capture-Density: hooks status (final) + config warning

**Status:** RESOLVED — record of final state; no owner action required  
**Generated:** 2026-07-02 · **Final revision:** 2026-07-03 (post-restore)  
**Worker:** Loop C1 (capture density)

---

## Final truth: the hooks saga

Earlier revisions of this document first claimed hooks were missing (paste-a-block
instruction), then adjudicated the wiring as living only in a workspace patch file.
Both snapshots were taken mid-incident. The resolved timeline:

1. **Hooks WERE wired all along during the M2 audit window.** The 11 durable-correction
   misses (capture recall 35.3%) happened with `ar hook-correction` firing on every
   UserPromptSubmit. The miss cause was the detector patterns, not absent wiring —
   the root-cause analysis below stands.
2. **2026-07-03: `~/.claude/settings.json` was wholesale-replaced mid-session** by a
   provider profile swap (Prismma auth-token routing). The replacement profile carried
   only env/model/permission keys and silently dropped `hooks` **and** `mcpServers`.
   This is why session snapshots taken during the C1/M2 work showed no hooks key.
3. **The orchestrator has RESTORED the hooks block** into `~/.claude/settings.json`
   (schema-validated) and re-added the `aam` and `linear` MCP servers via
   `claude mcp add-json --scope user`.

**Current state: hooks are live again. No action needed from the owner.**

## The one warning to keep

> **Provider profile swaps wholesale-replace `~/.claude/settings.json` and silently
> wipe `hooks` + `mcpServers`.** After any future profile/auth-routing swap (CC Switch,
> Prismma token rotation, etc.), re-check that the hooks block survived — a wiped hooks
> block reduces AgentRecall capture to 0% with no error surfaced anywhere.

Post-swap check:

```bash
python3 -c "import json;d=json.load(open('$HOME/.claude/settings.json'));print('hooks OK' if d.get('hooks') else 'HOOKS WIPED — restore them')"
```

---

## Historical miss cause (stands unchanged)

With hooks firing, all 11 M2 misses trace to the detector inside `ar hook-correction`:

1. **Behavioral gate over-strict** — required frequency language ("again",
   "every time"); durable rules stated once as absolute commands never passed it
   (10/11 misses).
2. **Correction patterns missed indirect phrasing** — "you actually did not",
   "there is no X", "I should have", "this is not a website" (9/11 misses,
   overlapping).

## Code change (applied, in working tree)

- `packages/cli/src/utils/correction-detector.ts` — new shared module.
  **Single-gate invariant** (C1 review 2026-07-03): a pattern lives in exactly one
  gate, or is context-narrowed (accusatory hallucination frame, format-domain scope,
  person-scoped "should have") so generic daily traffic cannot self-capture.
- `packages/cli/src/index.ts` — both hook call sites now route through
  `detectCorrection()`; hook-ambient deliberately uses the correction gate only
  (asymmetry documented at the call site).
- `packages/cli/test/hook-correction-detect.test.mjs` — 18 tests incl. permanent FP
  guards: 31 m2 negatives ≤ 2 FP, and 13 adversarial daily-traffic cases
  (scheduling reminders, research prose, encouragement, scoping) ≤ 2 FP.

| Metric | Pre-fix | Post-fix (revised) |
|--------|---------|--------------------|
| M2 miss texts captured by detector | 0/11 | **8/11** |
| FP on 31 m2 negatives | 0/31 | 0/31 |
| FP on 13 daily-traffic adversarial | 10/13 (first-draft patterns) | **0/13** |
| Test suite | 720 | **738 green** |

Documented non-captures: E10 (pure positive instruction), E41 (autonomy grant) —
regex-hard by nature; E57 (bare "I don't want you to open it") — narrowing casualty,
lost when "i don't want you to" was scoped to the correction gate only to keep
encouragement/scoping phrases ("I don't want you to rush") out.

No version bump, no push — pending orchestrator verify.
