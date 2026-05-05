# AgentRecall Memory Pipeline Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five structural gaps that cause AgentRecall's memory pipeline to silently fail: unreachable error states, untraced cross-project insights, an unimplemented CLI backfill command, unsynced insights index, and patterns that accumulate without ever reaching awareness.

**Architecture:** All fixes are in-layer — core logic stays in `packages/core/src/`, CLI changes stay in `packages/cli/src/index.ts`, no new packages or dependencies. The auto-promotion fix introduces one new module (`insight-promotion.ts`) with a clean one-directional import chain. Every fix is idempotent and safe to run in the nightly dream agent.

**Tech Stack:** Node.js, TypeScript, `node:test` (test runner), Supabase client (`@supabase/supabase-js`), no new deps.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/supabase/sync.ts` | Modify | Replace silent catch with structured error log |
| `packages/core/src/tools-logic/awareness-update.ts` | Modify | Ensure `source_project` is never null |
| `packages/core/src/palace/insights-index.ts` | Modify | Sync `insights-index.json` to Supabase after every write |
| `packages/core/src/tools-logic/insight-promotion.ts` | **Create** | `promoteConfirmedInsights()` — batch-promote insights from index → awareness |
| `packages/core/src/tools-logic/session-end.ts` | Modify | Call `promoteConfirmedInsights()` at end of every session |
| `packages/core/src/index.ts` | Modify | Export `promoteConfirmedInsights` |
| `packages/cli/src/index.ts` | Modify | (1) `ar setup supabase --backfill`; (2) `ar awareness rollup` |
| `packages/core/test/insight-promotion.test.mjs` | **Create** | Tests for promotion logic |
| `packages/core/test/sync-errors.test.mjs` | **Create** | Tests for error logging |
| `~/.aam/dreams/dream-prompt.md` | Modify | Add `ar awareness rollup` to Step 3 |

---

## Task 1: Replace silent sync error catch with structured log

**Problem:** `catch { // Silent failure }` in `sync.ts:160` means Supabase failures are invisible. The nightly dream agent, session_end, and every write silently drop errors. You can't diagnose broken sync.

**Structural fix:** Write errors to `~/.agent-recall/sync-errors.log` (append, capped at 500 lines). This preserves the fire-and-forget pattern (local files stay source of truth) while making failures observable.

**Files:**
- Modify: `packages/core/src/supabase/sync.ts:96–163`
- Create: `packages/core/test/sync-errors.test.mjs`

- [ ] **Step 1.1: Write the failing test**

Create `packages/core/test/sync-errors.test.mjs`:

```javascript
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// We test that doSync writes to sync-errors.log on failure by importing
// the exported logSyncError function directly.
import { logSyncError } from "agent-recall-core";

describe("sync error logging", () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "ar-test-"));
  const origHome = process.env.HOME;

  before(() => { process.env.HOME = tmpHome; });
  after(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true });
  });

  it("writes error line to sync-errors.log", () => {
    logSyncError("test error message");
    const logPath = path.join(tmpHome, ".agent-recall", "sync-errors.log");
    assert.ok(fs.existsSync(logPath), "log file should exist");
    const content = fs.readFileSync(logPath, "utf-8");
    assert.ok(content.includes("test error message"), "log should contain the error");
    assert.ok(content.match(/\d{4}-\d{2}-\d{2}T/), "log should include ISO timestamp");
  });

  it("caps log at 500 lines", () => {
    for (let i = 0; i < 510; i++) logSyncError(`line ${i}`);
    const logPath = path.join(tmpHome, ".agent-recall", "sync-errors.log");
    const lines = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
    assert.ok(lines.length <= 500, `log should be capped at 500 lines, got ${lines.length}`);
  });
});
```

- [ ] **Step 1.2: Run test — expect FAIL**

```bash
cd ~/Projects/AgentRecall
npm test -w packages/core 2>&1 | grep -A3 "sync-errors"
```

Expected: `TypeError: logSyncError is not a function` (not yet exported)

- [ ] **Step 1.3: Add `logSyncError` to sync.ts and fix the catch block**

In `packages/core/src/supabase/sync.ts`, add after the imports (after line ~10):

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export function logSyncError(message: string): void {
  const logPath = path.join(os.homedir(), ".agent-recall", "sync-errors.log");
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${message}\n`;

  // Append the new line
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, line, "utf-8");

  // Cap at 500 lines
  const content = fs.readFileSync(logPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  if (lines.length > 500) {
    fs.writeFileSync(logPath, lines.slice(-500).join("\n") + "\n", "utf-8");
  }
}
```

Then replace the two silent catches:

Line ~160 (inside `doSync`):
```typescript
  } catch (err) {
    logSyncError(`doSync failed for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
```

Line ~190 (inside `backfill` loop):
```typescript
    } catch (err) {
      logSyncError(`backfill failed for ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
```

Export `logSyncError` from `packages/core/src/index.ts`:
```typescript
export { syncToSupabase, backfill, contentHash, parseMemoryFile, deriveSlug, logSyncError } from "./supabase/sync.js";
```

- [ ] **Step 1.4: Run test — expect PASS**

```bash
cd ~/Projects/AgentRecall && npm run build -w packages/core 2>&1 | tail -3 && npm test -w packages/core 2>&1 | grep -E "PASS|FAIL|sync-errors"
```

Expected: all `sync-errors` tests PASS

- [ ] **Step 1.5: Commit**

```bash
cd ~/Projects/AgentRecall
git add packages/core/src/supabase/sync.ts packages/core/src/index.ts packages/core/test/sync-errors.test.mjs
git commit -m "fix: replace silent sync catch with structured error log (sync-errors.log)"
```

---

## Task 2: Fix source_project never null in awareness updates

**Problem:** `source_project: insight.source_project ?? input.project` resolves to `undefined` when neither is set. Awareness insights become untraceable — you can't tell which projects contributed a pattern or clean up after project deletion.

**Structural fix:** Fall through to `"global"` so `source_project` is always a non-null string. This enables future cross-project rollup and cleanup logic.

**Files:**
- Modify: `packages/core/src/tools-logic/awareness-update.ts:50`

- [ ] **Step 2.1: Apply the fix**

In `packages/core/src/tools-logic/awareness-update.ts`, line 50:

```typescript
// BEFORE:
source_project: insight.source_project ?? input.project,

// AFTER:
source_project: insight.source_project ?? input.project ?? "global",
```

- [ ] **Step 2.2: Verify existing awareness test still passes**

```bash
cd ~/Projects/AgentRecall && npm run build -w packages/core 2>&1 | tail -3 && npm test -w packages/core 2>&1 | grep -E "awareness|PASS|FAIL"
```

Expected: no regression in awareness tests

- [ ] **Step 2.3: Commit**

```bash
cd ~/Projects/AgentRecall
git add packages/core/src/tools-logic/awareness-update.ts
git commit -m "fix: source_project falls back to 'global' — never null in awareness insights"
```

---

## Task 3: Sync insights-index.json to Supabase

**Problem:** `insights-index.json` (200 cross-project insights) is never synced to Supabase. It's the richest cross-project learning store but is invisible to remote queries, semantic search, and backup.

**Structural fix:** Add `syncToSupabase()` call in `writeInsightsIndex()`. Use `"_global"` as project (since the index is not per-project) and `"awareness"` as store type (closest semantic match).

**Files:**
- Modify: `packages/core/src/palace/insights-index.ts`

- [ ] **Step 3.1: Read the current writeInsightsIndex function**

The function is at the top of `insights-index.ts`. It calls `fs.writeFileSync(p, ...)`. Add `syncToSupabase` call after the write.

Find the insights-index path:
```bash
grep -n "insights-index\|insightsIndexPath\|const p = " ~/Projects/AgentRecall/packages/core/src/palace/insights-index.ts | head -10
```

- [ ] **Step 3.2: Add syncToSupabase to writeInsightsIndex**

In `packages/core/src/palace/insights-index.ts`, add import at top:
```typescript
import { syncToSupabase } from "../supabase/sync.js";
```

In `writeInsightsIndex()`, after the `fs.writeFileSync` call:
```typescript
// After: fs.writeFileSync(p, JSON.stringify(index, null, 2), "utf-8");
syncToSupabase(p, JSON.stringify(index, null, 2), "_global", "awareness");
```

- [ ] **Step 3.3: Build and verify no type errors**

```bash
cd ~/Projects/AgentRecall && npm run build -w packages/core 2>&1 | tail -5
```

Expected: clean build, no type errors

- [ ] **Step 3.4: Commit**

```bash
cd ~/Projects/AgentRecall
git add packages/core/src/palace/insights-index.ts
git commit -m "fix: sync insights-index.json to Supabase on every write"
```

---

## Task 4: Implement `ar setup supabase --backfill`

**Problem:** `dream.sh` calls `ar setup supabase --backfill` on every nightly run. The CLI has no `--backfill` flag — it exits with `Unknown setup subcommand: --backfill` every night. The `backfill()` core function exists but is unreachable from the CLI.

**Structural fix:** Detect `--backfill` in the setup case. Collect all project files (journal + palace + awareness dirs) and call `backfill(project, files)` per project. Print a summary. Runs silently if Supabase is not configured (no config file).

**Files:**
- Modify: `packages/cli/src/index.ts` — `case "setup":` block (~line 1449)

- [ ] **Step 4.1: Add --backfill handler to setup case**

In `packages/cli/src/index.ts`, replace the `case "setup":` block:

```typescript
case "setup": {
  if (rest[0] === "supabase") {
    const hasBackfill = rest.includes("--backfill");

    if (hasBackfill) {
      // Backfill all projects to Supabase
      const { backfill, logSyncError } = await import("agent-recall-core");
      const homeDir = os.homedir();
      const projectsDir = path.join(homeDir, ".agent-recall", "projects");

      if (!fs.existsSync(projectsDir)) {
        output("No projects found at ~/.agent-recall/projects/");
        break;
      }

      const slugs = fs.readdirSync(projectsDir).filter((s) =>
        fs.statSync(path.join(projectsDir, s)).isDirectory()
      );

      let totalSynced = 0, totalSkipped = 0, totalFailed = 0;

      for (const slug of slugs) {
        const slugDir = path.join(projectsDir, slug);
        const files: Array<{ path: string; content: string; store: "journal" | "palace" | "awareness" | "digest"; room?: string }> = [];

        // Collect journal files
        const journalDir = path.join(slugDir, "journal");
        if (fs.existsSync(journalDir)) {
          for (const f of fs.readdirSync(journalDir).filter((f) => f.endsWith(".md"))) {
            const fp = path.join(journalDir, f);
            files.push({ path: fp, content: fs.readFileSync(fp, "utf-8"), store: "journal" });
          }
        }

        // Collect palace room files
        const roomsDir = path.join(slugDir, "palace", "rooms");
        if (fs.existsSync(roomsDir)) {
          for (const room of fs.readdirSync(roomsDir)) {
            const roomPath = path.join(roomsDir, room);
            if (!fs.statSync(roomPath).isDirectory()) continue;
            for (const f of fs.readdirSync(roomPath).filter((f) => f.endsWith(".md"))) {
              const fp = path.join(roomPath, f);
              files.push({ path: fp, content: fs.readFileSync(fp, "utf-8"), store: "palace", room });
            }
          }
        }

        // Collect awareness file
        const awarenessPath = path.join(homeDir, ".agent-recall", "awareness.md");
        if (fs.existsSync(awarenessPath)) {
          files.push({ path: awarenessPath, content: fs.readFileSync(awarenessPath, "utf-8"), store: "awareness" });
        }

        if (files.length === 0) continue;

        output(`Backfilling ${slug} (${files.length} files)...`);
        const result = await backfill(slug, files);
        totalSynced += result.synced;
        totalSkipped += result.skipped;
        totalFailed += result.failed;
        output(`  synced: ${result.synced}, skipped: ${result.skipped}, failed: ${result.failed}`);
      }

      output(`\nBackfill complete — synced: ${totalSynced}, skipped: ${totalSkipped}, failed: ${totalFailed}`);
      break;
    }

    // --- original interactive setup (no --backfill) ---
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    output("AgentRecall Supabase Setup\n");

    const url = await ask("Supabase URL (https://xxx.supabase.co): ");
    const key = await ask("Supabase anon key: ");
    const embeddingProvider = (await ask("Embedding provider (openai/voyage) [openai]: ")).trim() || "openai";
    const embeddingKey = await ask(`${embeddingProvider === "voyage" ? "Voyage" : "OpenAI"} API key: `);

    rl.close();

    const { writeSupabaseConfig } = await import("agent-recall-core");
    writeSupabaseConfig({
      supabase_url: url.trim(),
      supabase_anon_key: key.trim(),
      embedding_provider: embeddingProvider as "openai" | "voyage",
      embedding_api_key: embeddingKey.trim(),
      sync_enabled: true,
    });

    output("\nConfig saved to ~/.agent-recall/config.json");
    output("Run migration.sql in your Supabase SQL editor to create tables.");
    output("Backfill will start automatically on next session_start.\n");
  } else {
    process.stderr.write(`Unknown setup subcommand: ${rest[0] ?? "(none)"}\nUsage: ar setup supabase [--backfill]\n`);
    process.exit(1);
  }
  break;
}
```

Note: `os` and `path` and `fs` must be imported at the top of the CLI file — verify they're already imported before adding.

- [ ] **Step 4.2: Verify imports exist in CLI index.ts**

```bash
head -20 ~/Projects/AgentRecall/packages/cli/src/index.ts | grep -E "import.*os|import.*path|import.*fs"
```

If missing, add at top of file:
```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
```

- [ ] **Step 4.3: Build and smoke test**

```bash
cd ~/Projects/AgentRecall && npm run build -w packages/core -w packages/cli 2>&1 | tail -5
# Smoke test: should print help and exit 0, not crash
/Users/tongwu/.npm-global/bin/ar setup supabase --backfill 2>&1 | head -5
```

Expected: prints `Backfilling <slug> (N files)...` lines or "No projects found" — does NOT print `Unknown setup subcommand`

- [ ] **Step 4.4: Commit**

```bash
cd ~/Projects/AgentRecall
git add packages/cli/src/index.ts
git commit -m "feat: implement 'ar setup supabase --backfill' — collect + sync all project files to Supabase"
```

---

## Task 5: Create insight-promotion module and wire into session_end

**Problem:** `insights-index.json` accumulates 200 insights with `confirmed_count` but none auto-promote to `awareness-state.json`. Patterns that appear 5+ times never reach awareness unless a human runs `session_end` with those exact insights. Cross-project learning is invisible.

**Structural fix:** New module `insight-promotion.ts` reads the index, finds insights with `confirmed_count >= threshold`, checks they're not already in awareness, and adds them via `addInsight()`. Called at end of every `session_end`. Also exposed as `ar awareness rollup` for the dream agent.

**Import chain (no circular deps):**
```
insight-promotion.ts
  → imports awareness.js (addInsight, readAwarenessState, writeAwarenessState)
  → imports insights-index.js (readInsightsIndex)
  (does NOT import awareness-update.ts — avoids cycle)

session-end.ts
  → imports insight-promotion.js (promoteConfirmedInsights)
```

**Files:**
- Create: `packages/core/src/tools-logic/insight-promotion.ts`
- Modify: `packages/core/src/tools-logic/session-end.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/insight-promotion.test.mjs`

- [ ] **Step 5.1: Write the failing test**

Create `packages/core/test/insight-promotion.test.mjs`:

```javascript
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { promoteConfirmedInsights } from "agent-recall-core";

describe("promoteConfirmedInsights", () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "ar-promote-"));
  const origHome = process.env.HOME;

  before(() => {
    process.env.HOME = tmpHome;
    // Create minimal awareness state
    const arDir = path.join(tmpHome, ".agent-recall");
    fs.mkdirSync(arDir, { recursive: true });
    fs.writeFileSync(path.join(arDir, "awareness-state.json"), JSON.stringify({
      identity: "test",
      topInsights: [],
      trajectory: "",
      lastUpdated: new Date().toISOString(),
    }), "utf-8");
    // Create insights-index with 2 insights: one high-confirmed, one low
    fs.writeFileSync(path.join(arDir, "insights-index.json"), JSON.stringify({
      insights: [
        {
          id: "idx-1",
          title: "Use ar CLI in dream agent not MCP tools",
          source: "session",
          applies_when: ["dream", "nightly"],
          projects: ["AgentRecall"],
          severity: "important",
          confirmed_count: 5,
          last_confirmed: new Date().toISOString(),
        },
        {
          id: "idx-2",
          title: "Low confidence insight",
          source: "session",
          applies_when: ["misc"],
          projects: [],
          severity: "minor",
          confirmed_count: 1,
          last_confirmed: new Date().toISOString(),
        },
      ],
    }), "utf-8");
  });

  after(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpHome, { recursive: true });
  });

  it("promotes insights with confirmed_count >= threshold", () => {
    const result = promoteConfirmedInsights(3);
    assert.strictEqual(result.promoted.length, 1, "should promote exactly 1 insight");
    assert.ok(result.promoted[0].includes("ar CLI"), "should promote the high-confirmed insight");
  });

  it("skips low-confirmed insights", () => {
    const result = promoteConfirmedInsights(3);
    assert.ok(!result.promoted.some((t) => t.includes("Low confidence")), "should not promote low-confirmed insight");
  });

  it("is idempotent — does not double-promote", () => {
    const first = promoteConfirmedInsights(3);
    const second = promoteConfirmedInsights(3);
    assert.strictEqual(second.promoted.length, 0, "second run should promote nothing (already in awareness)");
    assert.strictEqual(second.skipped.length, first.promoted.length, "skipped count should match promoted count from first run");
  });
});
```

- [ ] **Step 5.2: Run test — expect FAIL**

```bash
cd ~/Projects/AgentRecall && npm test -w packages/core 2>&1 | grep -A3 "insight-promotion"
```

Expected: `TypeError: promoteConfirmedInsights is not a function`

- [ ] **Step 5.3: Create insight-promotion.ts**

Create `packages/core/src/tools-logic/insight-promotion.ts`:

```typescript
/**
 * insight-promotion: batch-promote confirmed insights from insights-index → awareness.
 *
 * Called at session_end and via `ar awareness rollup`.
 * Safe to run multiple times — checks awareness before promoting (idempotent).
 * No circular deps: imports from awareness.js and insights-index.js only.
 */

import { addInsight, readAwarenessState } from "../palace/awareness.js";
import { readInsightsIndex } from "../palace/insights-index.js";

export interface PromotionResult {
  promoted: string[];   // insight titles that were promoted
  skipped: string[];    // already in awareness — skipped
}

/**
 * Promote indexed insights with confirmed_count >= threshold into awareness.
 * @param threshold minimum confirmations required (default: 3)
 */
export function promoteConfirmedInsights(threshold = 3): PromotionResult {
  const index = readInsightsIndex();
  const state = readAwarenessState();

  const existingTitles = new Set(
    (state?.topInsights ?? []).map((i: { title: string }) => i.title.toLowerCase())
  );

  const promoted: string[] = [];
  const skipped: string[] = [];

  for (const insight of index.insights) {
    if (insight.confirmed_count < threshold) continue;

    // Deduplicate by title similarity (same logic as addIndexedInsight)
    const words = insight.title.toLowerCase().split(/\s+/);
    const alreadyPresent = [...existingTitles].some((existing) => {
      const existingWords = existing.split(/\s+/);
      const overlap = words.filter((w) => existingWords.includes(w) && w.length > 3).length;
      return overlap / Math.max(existingWords.length, words.length) > 0.5;
    });

    if (alreadyPresent) {
      skipped.push(insight.title);
      continue;
    }

    const result = addInsight({
      title: insight.title,
      evidence: `Auto-promoted from insights-index (confirmed ${insight.confirmed_count}×, projects: ${(insight.projects ?? []).join(", ") || "global"})`,
      appliesWhen: insight.applies_when,
      source: "insight-promotion",
      source_project: (insight.projects ?? [])[0] ?? "global",
    });

    if (!("accepted" in result)) {
      // Accepted (action is "added" | "updated" | "refreshed")
      promoted.push(insight.title);
      existingTitles.add(insight.title.toLowerCase());
    } else {
      skipped.push(insight.title); // rejected by quality gate
    }
  }

  return { promoted, skipped };
}
```

- [ ] **Step 5.4: Export from index.ts**

In `packages/core/src/index.ts`, add:
```typescript
export { promoteConfirmedInsights } from "./tools-logic/insight-promotion.js";
```

- [ ] **Step 5.5: Run test — expect PASS**

```bash
cd ~/Projects/AgentRecall && npm run build -w packages/core 2>&1 | tail -3 && npm test -w packages/core 2>&1 | grep -E "insight-promotion|PASS|FAIL"
```

Expected: all 3 promotion tests PASS

- [ ] **Step 5.6: Wire into session_end**

In `packages/core/src/tools-logic/session-end.ts`, add import:
```typescript
import { promoteConfirmedInsights } from "./insight-promotion.js";
```

At the end of the `sessionEnd` function, before the return statement:
```typescript
// Auto-promote confirmed cross-session insights into awareness
const promotion = promoteConfirmedInsights(3);
if (promotion.promoted.length > 0) {
  // Re-read state after promotion writes
  state = readJournalState?.() ?? state;
}
```

Find the right insertion point by searching for the `return` at the end of `sessionEnd`:
```bash
grep -n "return {" ~/Projects/AgentRecall/packages/core/src/tools-logic/session-end.ts | tail -3
```

Insert `promoteConfirmedInsights(3)` call just before the final `return {` line.

- [ ] **Step 5.7: Build and run all tests**

```bash
cd ~/Projects/AgentRecall && npm run build 2>&1 | tail -5 && npm test -w packages/core 2>&1 | tail -20
```

Expected: clean build, all tests pass

- [ ] **Step 5.8: Commit**

```bash
cd ~/Projects/AgentRecall
git add packages/core/src/tools-logic/insight-promotion.ts \
        packages/core/src/tools-logic/session-end.ts \
        packages/core/src/index.ts \
        packages/core/test/insight-promotion.test.mjs
git commit -m "feat: auto-promote confirmed insights (≥3×) from index → awareness at session_end"
```

---

## Task 6: Add `ar awareness rollup` CLI command

**Problem:** The dream agent and other autonomous agents have no CLI way to trigger insight promotion. `session_end` is only available as MCP. The nightly dream.sh needs a CLI hook.

**Files:**
- Modify: `packages/cli/src/index.ts` — `case "awareness":` block (~line 324)

- [ ] **Step 6.1: Add `rollup` subcommand to awareness case**

In `packages/cli/src/index.ts`, find the `case "awareness":` block. It currently handles `read` and `update`. Add `rollup`:

```typescript
case "awareness": {
  const sub = rest[0];
  if (sub === "read") {
    // ... existing read logic ...
  } else if (sub === "update") {
    // ... existing update logic ...
  } else if (sub === "rollup") {
    // Promote confirmed insights from index → awareness
    const thresholdFlag = rest.indexOf("--threshold");
    const threshold = thresholdFlag >= 0 ? parseInt(rest[thresholdFlag + 1] ?? "3", 10) : 3;

    const { promoteConfirmedInsights } = await import("agent-recall-core");
    const result = promoteConfirmedInsights(threshold);

    if (result.promoted.length === 0 && result.skipped.length === 0) {
      output(`No insights meet the threshold (confirmed_count >= ${threshold}).`);
    } else {
      if (result.promoted.length > 0) {
        output(`Promoted ${result.promoted.length} insight(s) into awareness:`);
        for (const title of result.promoted) output(`  + ${title}`);
      }
      if (result.skipped.length > 0) {
        output(`Skipped ${result.skipped.length} (already in awareness or rejected by quality gate).`);
      }
    }
  } else {
    process.stderr.write(`Unknown awareness subcommand: ${sub}\nUsage: ar awareness read|update|rollup [--threshold N]\n`);
    process.exit(1);
  }
  break;
}
```

- [ ] **Step 6.2: Build and smoke test**

```bash
cd ~/Projects/AgentRecall && npm run build -w packages/core -w packages/cli 2>&1 | tail -5
/Users/tongwu/.npm-global/bin/ar --project AgentRecall awareness rollup 2>&1
```

Expected: prints promoted/skipped count or "No insights meet the threshold"

- [ ] **Step 6.3: Test with custom threshold**

```bash
/Users/tongwu/.npm-global/bin/ar --project AgentRecall awareness rollup --threshold 1 2>&1 | head -10
```

Expected: promotes more insights (lower bar)

- [ ] **Step 6.4: Commit**

```bash
cd ~/Projects/AgentRecall
git add packages/cli/src/index.ts
git commit -m "feat: add 'ar awareness rollup [--threshold N]' CLI command for dream agent"
```

---

## Task 7: Wire rollup into dream-prompt + update help

**Problem:** The nightly dream agent can't call MCP `session_end`. Even with `ar awareness rollup` now available, the dream prompt doesn't know to use it.

**Files:**
- Modify: `~/.aam/dreams/dream-prompt.md` — add rollup step to Step 3
- Modify: `packages/cli/src/index.ts` — update help text

- [ ] **Step 7.1: Add rollup to dream prompt Step 3**

In `~/.aam/dreams/dream-prompt.md`, find the section after "confidence ≥ 0.8 → write to awareness via ar CLI" block. Add after all pattern-writing logic:

```markdown
## Step 3b: Promote confirmed cross-session insights
After writing any patterns from Step 3, run:
  /Users/tongwu/.npm-global/bin/ar --project agentrecall awareness rollup --threshold 3

This auto-promotes insights from the global index that have been confirmed 3+ times
but have not yet surfaced in awareness. Log the output in the dream report under
"Rollup Results". If no output: write "Rollup: 0 promoted (threshold not reached)".
```

- [ ] **Step 7.2: Update ar help text**

In `packages/cli/src/index.ts`, find the `printHelp` function. Update the PALACE/AWARENESS section to include:

```
  ar awareness read                    — show current awareness state
  ar awareness update --insight "t" --evidence "e"  — add insight
  ar awareness rollup [--threshold N]  — promote confirmed insights from index (default: 3)
```

- [ ] **Step 7.3: Final full build + test run**

```bash
cd ~/Projects/AgentRecall && npm run build 2>&1 | tail -5 && npm test 2>&1 | tail -20
```

Expected: clean build, all tests pass

- [ ] **Step 7.4: Final commit**

```bash
cd ~/Projects/AgentRecall
git add packages/cli/src/index.ts
git commit -m "docs: add awareness rollup to dream prompt and ar help text"
```

---

## Task 8: APQC duplicate folder reconciliation (manual)

**Problem:** Two project folders exist for what is likely the same project:
- `~/.agent-recall/projects/APQC-Process/` (created Apr 23)
- `~/.agent-recall/projects/APQC-Process-Automation/` (created Apr 28)

FTS queries return results from both, causing duplicates. Supabase has separate entries for each.

**This is a human decision — not automated.** Determine whether these are the same project or genuinely different, then:

- [ ] **Step 8.1: Inspect both projects**

```bash
ar --project APQC-Process palace walk --depth identity 2>/dev/null
ar --project APQC-Process-Automation palace walk --depth identity 2>/dev/null
ls ~/.agent-recall/projects/APQC-Process/journal/ | wc -l
ls ~/.agent-recall/projects/APQC-Process-Automation/journal/ | wc -l
```

- [ ] **Step 8.2: Decision**

- If same project: merge by copying missing journal/palace files from APQC-Process into APQC-Process-Automation, then delete APQC-Process directory. Update Supabase: delete `ar_entries` rows where `project = 'APQC-Process'`.
- If different projects: they can coexist — no action needed.

- [ ] **Step 8.3: If merging — delete old project**

```bash
# Only if confirmed same project:
rm -rf ~/.agent-recall/projects/APQC-Process/
# Then clean Supabase via ar sync or Supabase SQL editor:
# DELETE FROM ar_entries WHERE project = 'APQC-Process';
# DELETE FROM ar_sync_state WHERE file_path LIKE '%/APQC-Process/%';
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Silent sync errors → Task 1
- ✅ source_project null → Task 2
- ✅ insights-index never synced → Task 3
- ✅ ar setup supabase --backfill broken → Task 4
- ✅ Insights don't auto-promote → Task 5 + 6
- ✅ Dream agent can't trigger rollup → Task 7
- ✅ APQC duplicate folders → Task 8

**Placeholder scan:** No TBDs. All code blocks are complete. All commands have expected output.

**Type consistency:**
- `promoteConfirmedInsights` defined in Task 5.3, imported in Task 5.4, 5.6, and Task 6.1 — consistent
- `logSyncError` defined in Task 1.3, exported in 1.3, used in test in 1.1 — consistent
- `backfill()` signature: `(project: string, files: Array<{path, content, store, room?}>)` — matches existing core export

---

## Version Note

These changes constitute a **patch release** (no new MCP tools, no API surface changes, no breaking changes). Bump to `v3.4.1` after all tasks pass.

```bash
cd ~/Projects/AgentRecall
npm version patch -w packages/core -w packages/mcp-server -w packages/sdk -w packages/cli --no-git-tag-version
# Then commit and await publish approval
```
