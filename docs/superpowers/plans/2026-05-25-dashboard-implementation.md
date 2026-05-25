# AgentRecall Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML dashboard at `~/.agent-recall/dashboard.html` that connects to Supabase for real-time agent memory management.

**Architecture:** Single HTML file with Supabase JS SDK (CDN), inline CSS (Parchment/Deep Walnut theme via CSS variables), inline JS for all CRUD + real-time. Phase 0 creates Supabase tables + sync script. Dashboard reads/writes Supabase directly. Sync-back via Supabase filter in session_start.ts.

**Tech Stack:** HTML/CSS/JS (no build), Supabase JS SDK v2 (CDN), Python 3 (sync script), TypeScript (session_start change)

**Spec:** `docs/superpowers/specs/2026-05-25-dashboard-design.md`

---

### Task 1: Supabase Migration — Create Tables

**Files:**
- Create: `scripts/dashboard-migration.sql`

- [ ] **Step 1: Write the migration SQL file**

Save to `scripts/dashboard-migration.sql`:

```sql
-- AgentRecall Dashboard — Supabase Migration
-- Run once: paste into Supabase SQL Editor (https://supabase.com/dashboard/project/fjdtuyflvgylrllujpnc/sql)

-- Awareness insights
CREATE TABLE IF NOT EXISTS ar_awareness (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  evidence TEXT,
  applies_when TEXT[],
  confirmations INTEGER DEFAULT 1,
  trend TEXT DEFAULT 'stable',
  source TEXT,
  source_project TEXT,
  last_confirmed DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Corrections
CREATE TABLE IF NOT EXISTS ar_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT NOT NULL,
  severity TEXT DEFAULT 'p1',
  rule TEXT NOT NULL,
  context TEXT,
  goal TEXT,
  delta TEXT,
  correction_date DATE,
  dismissed BOOLEAN DEFAULT false,
  promoted BOOLEAN DEFAULT false,
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Palace rooms
CREATE TABLE IF NOT EXISTS ar_palace_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT NOT NULL,
  room_slug TEXT NOT NULL,
  room_name TEXT,
  description TEXT,
  salience REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed DATE,
  content TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project, room_slug)
);

-- Sessions
CREATE TABLE IF NOT EXISTS ar_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  model TEXT,
  phase TEXT,
  summary TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  corrections_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Backups (safety net for destructive operations)
CREATE TABLE IF NOT EXISTS _backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  original_id UUID,
  data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  restored BOOLEAN DEFAULT false
);

-- RLS policies (personal use, anon key full access)
DO $$ BEGIN
  ALTER TABLE ar_awareness ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ar_corrections ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ar_palace_rooms ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ar_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE _backups ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY IF NOT EXISTS "anon_all_awareness" ON ar_awareness FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all_corrections" ON ar_corrections FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all_palace" ON ar_palace_rooms FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all_sessions" ON ar_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all_backups" ON _backups FOR ALL TO anon USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ar_awareness;
ALTER PUBLICATION supabase_realtime ADD TABLE ar_corrections;
ALTER PUBLICATION supabase_realtime ADD TABLE ar_palace_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE ar_sessions;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ar_awareness_active ON ar_awareness(is_active);
CREATE INDEX IF NOT EXISTS idx_ar_corrections_project ON ar_corrections(project);
CREATE INDEX IF NOT EXISTS idx_ar_corrections_dismissed ON ar_corrections(dismissed);
CREATE INDEX IF NOT EXISTS idx_ar_palace_project ON ar_palace_rooms(project, room_slug);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_project ON ar_sessions(project);
CREATE INDEX IF NOT EXISTS idx_backups_lookup ON _backups(table_name, original_id);
```

- [ ] **Step 2: Run the migration via Supabase MCP**

Run each CREATE TABLE statement via the Supabase `execute_sql` MCP tool. If MCP is unavailable, paste into the SQL Editor at `https://supabase.com/dashboard/project/fjdtuyflvgylrllujpnc/sql`.

- [ ] **Step 3: Verify tables exist**

```bash
python3 -c "
import urllib.request, json
URL='https://fjdtuyflvgylrllujpnc.supabase.co'
KEY='sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr'
for table in ['ar_awareness','ar_corrections','ar_palace_rooms','ar_sessions','_backups']:
    req = urllib.request.Request(f'{URL}/rest/v1/{table}?select=id&limit=1',
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    try:
        urllib.request.urlopen(req)
        print(f'  ✓ {table}')
    except Exception as e:
        print(f'  ✗ {table}: {e}')
"
```

Expected: all 5 tables show ✓.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/AgentRecall
git add scripts/dashboard-migration.sql
git commit -m "chore: add dashboard Supabase migration SQL"
```

---

### Task 2: Data Sync Script

**Files:**
- Create: `~/.claude/scripts/ar-dashboard-sync.py`

- [ ] **Step 1: Write the sync script**

Create `~/.claude/scripts/ar-dashboard-sync.py`. The script reads local AR data and upserts to Supabase. Key sections:

1. **Awareness sync** — read `~/.agent-recall/awareness-state.json`, extract `topInsights[]`, upsert to `ar_awareness` by title.
2. **Corrections sync** — glob `~/.agent-recall/projects/*/corrections/*.json`, read each, upsert to `ar_corrections` by source_file.
3. **Palace sync** — glob `~/.agent-recall/projects/*/palace/rooms/*/_room.json`, read each + its `README.md` content, upsert to `ar_palace_rooms` by (project, room_slug).
4. **Journal sync** — glob recent `.md` journal files (last 30 days), parse frontmatter/summary, upsert to `journal_entries` by title.
5. **Dream sync** — glob `~/.agent-recall/dreams/*.md` (last 14 days), upsert to `journal_entries` with type=dream tag.

Each sync function should:
- Use `urllib.request` (no external deps, matches existing ar-sync-status.py pattern)
- Upsert via Supabase REST API `POST` with `Prefer: resolution=merge-duplicates`
- Print a count summary: `awareness: 10 synced, corrections: 60 synced, ...`
- Handle errors per-item (never abort the full sync on one bad file)

```python
#!/usr/bin/env python3
"""
ar-dashboard-sync.py — Push local AgentRecall data to Supabase for the dashboard.

Usage:
  python3 ar-dashboard-sync.py           # full sync
  python3 ar-dashboard-sync.py --quick   # awareness + corrections only (fast)
"""

import sys, os, re, json, glob
import urllib.request, urllib.error
from datetime import date, datetime, timedelta

AR_ROOT = os.path.expanduser("~/.agent-recall")
SUPABASE_URL = "https://fjdtuyflvgylrllujpnc.supabase.co"
SUPABASE_KEY = "sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr"

SKIP_SLUGS = {"tongwu", "build", "Downloads", "Projects",
              "this-project-does-not-exist-xyz",
              "d234ebb2-f31b-4d40-a601-7de39085fc4e"}


def supabase_upsert(table: str, rows: list[dict], on_conflict: str) -> int:
    """Upsert rows to Supabase table. Returns count of rows sent."""
    if not rows:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    data = json.dumps(rows, default=str).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": f"resolution=merge-duplicates,return=minimal",
    })
    try:
        urllib.request.urlopen(req)
        return len(rows)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if hasattr(e, 'read') else str(e)
        print(f"  [warn] {table} upsert failed: {e.code} {body[:200]}", file=sys.stderr)
        return 0


def sync_awareness() -> int:
    """Read awareness-state.json → ar_awareness."""
    state_path = os.path.join(AR_ROOT, "awareness-state.json")
    if not os.path.exists(state_path):
        return 0
    with open(state_path) as f:
        state = json.load(f)
    rows = []
    for ins in state.get("topInsights", []):
        rows.append({
            "title": ins.get("title", ""),
            "evidence": ins.get("evidence", "")[:2000],
            "applies_when": ins.get("appliesWhen", []),
            "confirmations": ins.get("confirmations", 1),
            "trend": ins.get("trend", "stable"),
            "source": ins.get("source", ""),
            "source_project": ins.get("source_project", "_global"),
            "last_confirmed": ins.get("lastConfirmed", str(date.today())),
            "is_active": True,
            "updated_at": datetime.now().isoformat(),
        })
    return supabase_upsert("ar_awareness", rows, "title")


def sync_corrections() -> int:
    """Read projects/*/corrections/*.json → ar_corrections."""
    rows = []
    for cfile in glob.glob(os.path.join(AR_ROOT, "projects/*/corrections/*.json")):
        parts = cfile.split("/projects/")
        if len(parts) < 2:
            continue
        project = parts[1].split("/corrections/")[0]
        if project in SKIP_SLUGS:
            continue
        try:
            with open(cfile) as f:
                c = json.load(f)
            rows.append({
                "project": project,
                "severity": c.get("severity", "p1"),
                "rule": c.get("rule", "")[:500],
                "context": c.get("context", "")[:500],
                "goal": c.get("goal", ""),
                "delta": c.get("delta", ""),
                "correction_date": c.get("date", str(date.today())),
                "source_file": os.path.basename(cfile),
                "updated_at": datetime.now().isoformat(),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return supabase_upsert("ar_corrections", rows, "source_file")


def sync_palace() -> int:
    """Read projects/*/palace/rooms/*/_room.json → ar_palace_rooms."""
    rows = []
    for rfile in glob.glob(os.path.join(AR_ROOT, "projects/*/palace/rooms/*/_room.json")):
        parts = rfile.split("/projects/")
        if len(parts) < 2:
            continue
        rest = parts[1]
        project = rest.split("/palace/")[0]
        if project in SKIP_SLUGS:
            continue
        room_slug = rest.split("/rooms/")[1].split("/")[0] if "/rooms/" in rest else "unknown"
        try:
            with open(rfile) as f:
                meta = json.load(f)
            # Read README.md content
            readme = os.path.join(os.path.dirname(rfile), "README.md")
            content = ""
            if os.path.exists(readme):
                with open(readme) as rf:
                    content = rf.read()[:3000]
            rows.append({
                "project": project,
                "room_slug": room_slug,
                "room_name": meta.get("name", room_slug),
                "description": meta.get("description", ""),
                "salience": meta.get("salience", 0.5),
                "access_count": meta.get("access_count", 0),
                "last_accessed": meta.get("last_accessed", str(date.today())),
                "content": content,
                "is_archived": meta.get("salience", 0.5) <= 0.05,
                "updated_at": datetime.now().isoformat(),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return supabase_upsert("ar_palace_rooms", rows, "project,room_slug")


def sync_journals() -> int:
    """Read recent journal .md files → journal_entries."""
    cutoff = date.today() - timedelta(days=30)
    rows = []
    for jfile in glob.glob(os.path.join(AR_ROOT, "projects/*/journal/*.md")):
        basename = os.path.basename(jfile)
        if basename == "index.md" or "-log." in basename:
            continue
        # Extract date from filename
        m = re.match(r"(\d{4}-\d{2}-\d{2})", basename)
        if not m:
            continue
        fdate = date.fromisoformat(m.group(1))
        if fdate < cutoff:
            continue
        parts = jfile.split("/projects/")
        if len(parts) < 2:
            continue
        project = parts[1].split("/journal/")[0]
        if project in SKIP_SLUGS:
            continue
        try:
            with open(jfile) as f:
                content = f.read()[:5000]
            title = f"{m.group(1)} — {project}"
            rows.append({
                "entry_date": m.group(1),
                "title": title,
                "content": content,
                "project_slugs": [project],
                "tags": ["journal", project],
            })
        except Exception:
            continue
    return supabase_upsert("journal_entries", rows, "title")


def sync_dreams() -> int:
    """Read recent dream reports → journal_entries with dream tag."""
    cutoff = date.today() - timedelta(days=14)
    rows = []
    dreams_dir = os.path.join(AR_ROOT, "dreams")
    if not os.path.isdir(dreams_dir):
        return 0
    for dfile in glob.glob(os.path.join(dreams_dir, "*.md")):
        basename = os.path.basename(dfile)
        m = re.match(r"(\d{4}-\d{2}-\d{2})", basename)
        if not m:
            continue
        fdate = date.fromisoformat(m.group(1))
        if fdate < cutoff:
            continue
        try:
            with open(dfile) as f:
                content = f.read()[:8000]
            title = f"Dream {m.group(1)}"
            rows.append({
                "entry_date": m.group(1),
                "title": title,
                "content": content,
                "project_slugs": ["_global"],
                "tags": ["dream", "nightly"],
            })
        except Exception:
            continue
    return supabase_upsert("journal_entries", rows, "title")


if __name__ == "__main__":
    quick = "--quick" in sys.argv
    print("ar-dashboard-sync: pushing local data to Supabase...")
    a = sync_awareness()
    print(f"  awareness: {a} synced")
    c = sync_corrections()
    print(f"  corrections: {c} synced")
    if not quick:
        p = sync_palace()
        print(f"  palace rooms: {p} synced")
        j = sync_journals()
        print(f"  journals: {j} synced")
        d = sync_dreams()
        print(f"  dreams: {d} synced")
    print("done.")
```

- [ ] **Step 2: Run the sync and verify data landed**

```bash
python3 ~/.claude/scripts/ar-dashboard-sync.py
```

Expected output like:
```
ar-dashboard-sync: pushing local data to Supabase...
  awareness: 10 synced
  corrections: 60 synced
  palace rooms: 150 synced
  journals: 25 synced
  dreams: 10 synced
done.
```

Then verify:
```bash
python3 -c "
import urllib.request, json
URL='https://fjdtuyflvgylrllujpnc.supabase.co'
KEY='sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr'
for table in ['ar_awareness','ar_corrections','ar_palace_rooms']:
    req = urllib.request.Request(f'{URL}/rest/v1/{table}?select=id&limit=1',
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Prefer': 'count=exact'})
    resp = urllib.request.urlopen(req)
    total = resp.headers.get('content-range', '?')
    print(f'  {table}: {total}')
"
```

Expected: non-zero counts for all three.

- [ ] **Step 3: Commit**

```bash
cd ~/.claude && git add scripts/ar-dashboard-sync.py
git commit -m "feat: ar-dashboard-sync.py — push AR data to Supabase for dashboard"
```

---

### Task 3: Dashboard Shell — HTML + Theme + Header + Navigation

**Files:**
- Create: `~/.agent-recall/dashboard.html`

This task creates the HTML file with:
- Supabase SDK and Google Fonts from CDN
- Full CSS theme (Parchment light + Deep Walnut dark via CSS variables)
- Header with logo, global search bar, real-time indicator, stats, theme toggle
- Three view containers: Morning Brief, Control Tower, Drill-Down (hidden by default)
- Navigation functions (showMorningBrief / showControlTower / showDrillDown)
- Supabase client initialization
- Theme toggle with localStorage persistence
- Toast notification system
- Modal/confirmation dialog system

- [ ] **Step 1: Create the HTML file with full CSS and structural HTML**

Write `~/.agent-recall/dashboard.html` with all CSS (both themes), the header, the three empty view containers, and the modal/toast containers. Include the Supabase SDK and Nunito font from CDN. Use exact hex values from the spec's design tokens section.

The `<style>` section should define all CSS variables under `:root` (light) and `[data-theme="dark"]` (dark). All component styles should use `var(--token-name)` exclusively — no hardcoded colors.

The `<script>` section should initialize the Supabase client, set up theme toggle, and define the navigation functions.

- [ ] **Step 2: Open in browser and verify**

```bash
open ~/.agent-recall/dashboard.html
```

Expected: see the header with logo, search bar, theme toggle. Click the sun/moon icon — theme switches between Parchment and Deep Walnut. Three empty view containers exist but only Morning Brief is visible.

- [ ] **Step 3: Commit**

```bash
cd ~/.agent-recall && git add dashboard.html
git commit -m "feat: dashboard shell — theme, header, navigation, Supabase client"
```

---

### Task 4: Morning Brief Page

**Files:**
- Modify: `~/.agent-recall/dashboard.html`

Add the Morning Brief view — the landing page with 4 sections.

- [ ] **Step 1: Write the data-loading functions**

Add JS functions that query Supabase for Morning Brief data:
- `loadDreamReport()` — `SELECT * FROM journal_entries WHERE tags @> '{dream}' ORDER BY entry_date DESC LIMIT 1`
- `loadBlockedProjects()` — `SELECT * FROM projects WHERE status = 'active' AND meta->>'blocker' IS NOT NULL` (or filter client-side from all projects)
- `loadRecentSessions()` — `SELECT * FROM ar_sessions WHERE started_at > now() - interval '24 hours' ORDER BY started_at DESC`
- `loadPredictions()` — parse from latest dream report content (client-side regex for "## Predictions" section)

- [ ] **Step 2: Write the render functions**

Add `renderMorningBrief()` that populates the 4 sections:
1. 🌙 Overnight — dream summary with action buttons (stale candidates get Accept/Reject)
2. 🚧 Blocked — project cards with blocker reason
3. ⚡ Agent Activity — session rows with status dots
4. ⚠ Predictions — parsed from dream report

Add "View all projects →" link that calls `showControlTower()`.

- [ ] **Step 3: Wire up on page load**

In the main `init()` function, call `renderMorningBrief()` after Supabase client is ready.

- [ ] **Step 4: Open in browser and verify**

```bash
open ~/.agent-recall/dashboard.html
```

Expected: see Morning Brief with real data from Supabase. Dream summary shows (or "No dream data" if dreams haven't synced). Blocked projects show. "View all projects →" navigates to empty Control Tower.

- [ ] **Step 5: Commit**

```bash
cd ~/.agent-recall && git add dashboard.html
git commit -m "feat: Morning Brief — dream report, blocked projects, agent activity, predictions"
```

---

### Task 5: Control Tower Page with Agent Preview

**Files:**
- Modify: `~/.agent-recall/dashboard.html`

Add the Control Tower view with project grid, stats bar, awareness panel, live sessions, and the agent preview feature.

- [ ] **Step 1: Write data-loading functions**

- `loadProjects()` — `SELECT * FROM projects ORDER BY slug` + enrich with correction/insight counts from `ar_corrections` and `ar_awareness`
- `loadAwareness()` — `SELECT * FROM ar_awareness WHERE is_active = true ORDER BY confirmations DESC`
- `loadAgentPreview(project)` — combine: P0 corrections for project, awareness insights, latest journal summary. Estimate token count (~4 chars per token).

- [ ] **Step 2: Write render functions**

- `renderControlTower()` — stats bar + project grid + bottom panels
- `renderProjectCard(project)` — card with name, meta, status tag, left border color, "👁 Preview" button
- `renderAgentPreview(project)` — expandable inline panel showing: P0 rules, watch_for, insights list (each with ✕ archive button), token budget badge with color coding (green <300, amber 300-500, red >500)
- `renderAwarenessPanel(insights)` — insight rows with count, title, trend badge, edit/archive buttons
- `renderSessionsPanel(sessions)` — session rows with status dots

- [ ] **Step 3: Wire up navigation**

Clicking a project card calls `showDrillDown(project.slug)`. "👁 Preview" button toggles the preview panel inline. Back navigation from Control Tower returns to Morning Brief.

- [ ] **Step 4: Verify in browser**

Expected: see stats bar with real counts, project cards in a grid, awareness panel with insights, preview button works and shows token count.

- [ ] **Step 5: Commit**

```bash
cd ~/.agent-recall && git add dashboard.html
git commit -m "feat: Control Tower — project grid, stats, awareness panel, agent preview"
```

---

### Task 6: Drill-Down — Overview, Awareness, Corrections Tabs

**Files:**
- Modify: `~/.agent-recall/dashboard.html`

Add the drill-down view with the first 3 tabs.

- [ ] **Step 1: Write the drill-down shell**

- Back button that returns to Control Tower
- Project header with name, version, stats, "Change Status" and "Delete Project" buttons
- Tab bar with 7 tabs (all clickable, only first 3 have content in this task)
- Tab switching function `switchTab(tabName)`

- [ ] **Step 2: Write Tab 1 — Overview**

- Trajectory (editable textarea, "Save" button writes to `projects.meta.trajectory` via Supabase)
- Next Action (read from latest journal `## Next` section)
- Agent preview (same as Control Tower's preview but in full-width panel, with token budget)

- [ ] **Step 3: Write Tab 2 — Awareness**

- `SELECT * FROM ar_awareness WHERE source_project = project OR source_project = '_global' AND is_active = true ORDER BY confirmations DESC`
- Each row: confirmation count badge, title (click to inline-edit), trend badge, [edit] [archive] buttons
- Inline editing: click title → contenteditable, Enter/blur saves to Supabase

- [ ] **Step 4: Write Tab 3 — Corrections**

- `SELECT * FROM ar_corrections WHERE project = slug AND dismissed = false ORDER BY correction_date DESC`
- Client-side pattern grouping: extract 2-3 key nouns from each rule (filter stopwords), group corrections sharing ≥2 nouns into clusters, render as collapsible groups
- Each row: P0/P1 badge, rule text, date, [promote] [dismiss] buttons
- Noise detection: dim rows where rule matches `<task-notification>`, bare numbers, or <5 words
- "Dismiss all noise" bulk button

- [ ] **Step 5: Verify in browser**

Navigate to a project drill-down. Switch between Overview, Awareness, Corrections tabs. Edit a trajectory. Inline-edit an insight title. See corrections grouped by pattern.

- [ ] **Step 6: Commit**

```bash
cd ~/.agent-recall && git add dashboard.html
git commit -m "feat: drill-down — Overview, Awareness, Corrections tabs with inline editing"
```

---

### Task 7: Drill-Down — Journal, Palace, Dreams, Performance Tabs

**Files:**
- Modify: `~/.agent-recall/dashboard.html`

Add the remaining 4 tabs.

- [ ] **Step 1: Write Tab 4 — Journal**

- `SELECT * FROM journal_entries WHERE project_slugs @> ARRAY[slug] ORDER BY entry_date DESC`
- Each entry: date header, summary with `**Phase N —**` highlighted in accent color
- Expandable: click to toggle full content
- Read-only (no edit/delete actions)

- [ ] **Step 2: Write Tab 5 — Palace**

- `SELECT * FROM ar_palace_rooms WHERE project = slug ORDER BY salience DESC`
- Room cards in CSS grid: room name with emoji prefix, access count, salience bar (colored fill)
- Click room → expand to show README content
- Archived rooms (salience ≤ 0.05) shown at bottom, dimmed, with [delete] button
- Delete button triggers backup + Supabase DELETE

- [ ] **Step 3: Write Tab 6 — Dreams**

- `SELECT * FROM journal_entries WHERE tags @> '{dream}' ORDER BY entry_date DESC LIMIT 14`
- Each dream: date header, key sections parsed from markdown (Patterns Written, Stale Candidates, Crystallizations)
- Stale candidates: parse from "## Stale Insight Candidates" section, render each with [Accept] (archives the insight in ar_awareness) / [Reject] (no action) buttons
- Post-crystallization cleanup: parse from "## Post-crystallization cleanup" section if present

- [ ] **Step 4: Write Tab 7 — Performance**

- Corrections per session chart: query `ar_corrections` grouped by `correction_date`, render as bar chart using inline SVG (no chart library — just `<rect>` elements)
- Color coding: bars above average = amber (`var(--accent-copper)`), below average = green (`var(--accent-green)`)
- Summary stats below chart: avg corrections/session, P0 rate (P0 count / total), trend direction (compare last 7 days avg vs previous 7 days)
- Trend indicator: "↘ declining (good)" in green or "↗ increasing (warning)" in red

- [ ] **Step 5: Verify all 7 tabs in browser**

Navigate to AgentRecall drill-down, click through all 7 tabs. Verify: journal entries render with phases highlighted, palace rooms show salience bars, dreams show with action buttons, performance chart renders with real correction data.

- [ ] **Step 6: Commit**

```bash
cd ~/.agent-recall && git add dashboard.html
git commit -m "feat: drill-down — Journal, Palace, Dreams, Performance tabs"
```

---

### Task 8: Interactive Actions + Backup + Real-Time

**Files:**
- Modify: `~/.agent-recall/dashboard.html`

Wire up all 9 interactive actions with backup-before-delete safety, confirmation modals, and Supabase Realtime subscriptions.

- [ ] **Step 1: Write the backup helper**

```javascript
async function backupBeforeAction(table, id) {
  const { data: original } = await sb.from(table).select('*').eq('id', id).single()
  if (original) {
    await sb.from('_backups').insert({
      table_name: table,
      original_id: id,
      data: original,
    })
  }
  return original
}
```

- [ ] **Step 2: Write all 9 action handlers**

1. `archiveInsight(id)` — backup → `ar_awareness.update({ is_active: false })`
2. `dismissCorrection(id)` — backup → `ar_corrections.update({ dismissed: true })`
3. `promoteCorrection(id)` — read correction → insert into `ar_awareness` with title=rule, evidence=context → update `ar_corrections.update({ promoted: true })`
4. `editInsight(id, title, evidence)` — backup → `ar_awareness.update({ title, evidence })`
5. `changeProjectStatus(slug, status)` — backup → `projects.update({ status })`
6. Agent preview — read-only, already implemented in Task 5
7. `deletePalaceRoom(id)` — confirmation modal → backup → `ar_palace_rooms.delete()`
8. Dream accept/reject stale — calls `archiveInsight()` for accepted candidates
9. `deleteProject(slug)` — confirmation modal (shows counts) → backup all related rows → delete from `ar_corrections`, `ar_palace_rooms`, `ar_sessions` where project=slug → delete from `projects`

- [ ] **Step 3: Write confirmation modal**

```javascript
function showConfirmModal(title, body, onConfirm) {
  // Renders modal overlay with title, body text, Cancel and Confirm buttons
  // Cancel dismisses, Confirm calls onConfirm() then dismisses
  // Confirm button is red for destructive actions
}
```

Use for: deleteProject, deletePalaceRoom.

- [ ] **Step 4: Write toast notification**

```javascript
function showToast(message, type = 'success') {
  // Shows fixed-position toast at bottom-right
  // Green for success, red for error
  // Auto-dismisses after 3 seconds
}
```

- [ ] **Step 5: Set up Supabase Realtime subscriptions**

```javascript
const channel = sb.channel('dashboard-live')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_awareness' }, handleChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_corrections' }, handleChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_palace_rooms' }, handleChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_sessions' }, handleChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, handleChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handleChange)
  .subscribe()

function handleChange(payload) {
  // Re-render the affected view
  // Show toast: "New correction from novada-mcp" / "Insight archived"
  // Flash highlight on new/updated rows
}
```

- [ ] **Step 6: Write global search**

```javascript
async function globalSearch(query) {
  // Search ar_awareness (title, evidence), ar_corrections (rule, context),
  // journal_entries (title, content) using Supabase ilike
  // Group results by source type
  // Render in a dropdown below the search bar
}
```

Wire to the search input in the header with debounce (300ms).

- [ ] **Step 7: Verify all actions in browser**

Test checklist:
1. Archive an insight → disappears from list, toast shows
2. Dismiss a correction → dimmed/removed
3. Promote a correction → appears in Awareness tab
4. Edit an insight title → inline edit, save, verify in Supabase
5. Change project status → dropdown, confirm, project card updates
6. Delete a palace room → confirmation modal → gone
7. Search "P0 regex" → results from corrections and awareness
8. Open two browser tabs — action in one reflects in the other (realtime)

- [ ] **Step 8: Commit**

```bash
cd ~/.agent-recall && git add dashboard.html
git commit -m "feat: 9 interactive actions, backup safety, realtime, global search"
```

---

### Task 9: Sync-Back — session_start Supabase Filter

**Files:**
- Modify: `~/Projects/AgentRecall/packages/core/src/tools-logic/session-start.ts`
- Modify: `~/Projects/AgentRecall/packages/core/src/palace/awareness.ts`

When the dashboard archives an insight, the next `ar session_start` should not inject it.

- [ ] **Step 1: Write the Supabase filter function**

In `packages/core/src/palace/awareness.ts`, add a function that checks Supabase for archived insight titles:

```typescript
export async function fetchDashboardArchivedTitles(): Promise<string[]> {
  const url = process.env.SUPABASE_URL || "https://fjdtuyflvgylrllujpnc.supabase.co";
  const key = process.env.SUPABASE_ANON_KEY || "sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr";
  try {
    const resp = await fetch(
      `${url}/rest/v1/ar_awareness?select=title&is_active=eq.false`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(3000) }
    );
    if (!resp.ok) return [];
    const rows = await resp.json() as Array<{ title: string }>;
    return rows.map(r => r.title);
  } catch {
    return []; // Network failure → use local state only, never block
  }
}
```

- [ ] **Step 2: Filter archived insights in session_start**

In `packages/core/src/tools-logic/session-start.ts`, after loading local awareness state and before rendering output, add:

```typescript
// Filter out dashboard-archived insights (sync-back lite)
const archivedTitles = await fetchDashboardArchivedTitles();
if (archivedTitles.length > 0) {
  insights = insights.filter(i => !archivedTitles.includes(i.title));
}
```

- [ ] **Step 3: Run existing tests**

```bash
cd ~/Projects/AgentRecall && npm test --workspace=packages/core 2>&1 | tail -5
```

Expected: 257 tests pass (the filter is a no-op when Supabase returns empty).

- [ ] **Step 4: Build and link**

```bash
cd ~/Projects/AgentRecall
npm run build --workspace=packages/core
npm run build --workspace=packages/cli
npm link --workspace=packages/cli
ar --version
```

Expected: new version with sync-back support.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/AgentRecall
git add packages/core/src/palace/awareness.ts packages/core/src/tools-logic/session-start.ts
git commit -m "feat: sync-back — session_start filters dashboard-archived insights via Supabase"
```

---

### Task 10: Final Integration — Hook + Open Command

**Files:**
- Modify: `~/.claude/settings.json` (add PostToolUse hook)

- [ ] **Step 1: Add sync hook to settings.json**

Add a PostToolUse hook that runs the dashboard sync after `session_end`:

```json
{
  "event": "PostToolUse",
  "matcher": "mcp__agent-recall__session_end",
  "command": "python3 ~/.claude/scripts/ar-dashboard-sync.py --quick 2>/dev/null &"
}
```

This ensures every `session_end` pushes the latest awareness + corrections to Supabase for the dashboard.

- [ ] **Step 2: Add `ar dashboard` convenience alias**

Create a shell alias or script that opens the dashboard:

```bash
echo 'alias ar-dashboard="open ~/.agent-recall/dashboard.html"' >> ~/.zshrc
```

- [ ] **Step 3: Full end-to-end verification**

1. Run `python3 ~/.claude/scripts/ar-dashboard-sync.py` — verify all data lands
2. Open `~/.agent-recall/dashboard.html` — see Morning Brief with real data
3. Click "View all projects" → Control Tower with project cards
4. Click a project → Drill-down with 7 tabs working
5. Archive an insight → verify it's gone
6. Run `ar session_start --project AgentRecall` → verify archived insight is excluded
7. Toggle dark mode → verify Deep Walnut theme
8. Search "P0 regex" → find results

- [ ] **Step 4: Commit hook change**

```bash
cd ~/.claude && git add settings.json
git commit -m "chore: add dashboard sync hook on session_end"
```
