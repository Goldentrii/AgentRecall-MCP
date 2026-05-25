# AgentRecall Dashboard — Design Spec

> Single-file SPA for managing agent memory. Personal use, Supabase-backed, real-time.

## Overview

A self-contained HTML file (`~/.agent-recall/dashboard.html`) that connects to the existing AgentRecall Supabase instance. Provides a visual Control Tower for all projects, with drill-down tabbed views and 9 interactive write operations. Light/dark mode with Parchment/Deep Walnut theme.

## Architecture

```
~/.agent-recall/dashboard.html  (single file, ~1000-1500 lines)
  ├── Supabase JS SDK v2 (CDN: cdn.jsdelivr.net)
  ├── Google Fonts: Nunito (CDN)
  ├── Inline CSS (Parchment light + Deep Walnut dark, CSS variables)
  ├── Inline JS (CRUD, real-time subscriptions, backup-before-delete)
  └── Connects to: fjdtuyflvgylrllujpnc (anon key hardcoded)
```

**No build step. No dependencies. No server. Just open the file.**

### Data Flow

```
Agent (CLI/MCP) → local files → sync hook → Supabase INSERT/UPDATE
                                                    ↓
                                    Supabase Realtime subscription
                                                    ↓
Dashboard (browser) ← receives event ← renders update instantly
                   → user clicks archive/edit/delete
                   → Supabase UPDATE (with backup row first)
                   → next ar session_start reads updated state
```

### Source of Truth

Dual-write with timestamp-based conflict resolution:
- AR CLI writes to local files, sync hook pushes to Supabase
- Dashboard writes to Supabase directly
- Conflict: latest `updated_at` wins
- AR journal filenames embed timestamps naturally

### Safety Model

Every destructive operation (delete, archive, status change) follows this pattern:
```js
// 1. Read current row
const { data: original } = await sb.from('memories').select('*').eq('id', id).single()
// 2. Backup to _backups table
await sb.from('_backups').insert({ table_name: 'memories', original_id: id, data: original, deleted_at: new Date() })
// 3. Then delete/update
await sb.from('memories').update({ is_active: false }).eq('id', id)
```

Requires creating a `_backups` table in Supabase (one-time migration).

## Supabase Connection

- **Project:** `fjdtuyflvgylrllujpnc`
- **Anon key:** `sb_publishable_6Ciu8k-P7yaEWdXZOX6ZVg_W-6QtCzr` (hardcoded)
- **Existing tables:** `memories` (342 rows — Claude AutoMemory), `projects` (39 rows), `journal_entries` (40 rows), `knowledge` (12 rows)
- **New tables needed:** `ar_awareness`, `ar_corrections`, `ar_palace_rooms`, `ar_sessions`, `_backups`
- **Real-time:** Subscribe to all `ar_*` tables + `projects` + `journal_entries`

### Data Gap (discovered during design review)

The existing `memories` table contains Claude AutoMemory data (feedback, references, concepts), NOT AgentRecall operational data. The dashboard needs corrections, awareness insights, palace rooms, and recent journals — none of which are currently in Supabase.

**Solution: Phase 0 sync command** (`ar dashboard sync`) pushes all AR operational data before the dashboard can be used. See Phase 0 section below.

## Phase 0: Data Sync (`ar dashboard sync`)

A sync command that pushes all AR operational data to Supabase. Must run before first dashboard use, then runs automatically after every `session_end` via hook.

### New Supabase Tables

```sql
-- Awareness insights (source: awareness-state.json)
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

-- Corrections (source: projects/*/corrections/*.json)
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

-- Palace rooms (source: projects/*/palace/rooms/*/_room.json)
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

-- Live/recent sessions (source: ~/.aam/sessions/*/state.json + journal dates)
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

-- Backup table for destructive operations
CREATE TABLE IF NOT EXISTS _backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  original_id UUID,
  data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  restored BOOLEAN DEFAULT false
);

-- RLS policies (personal use, anon key access)
ALTER TABLE ar_awareness ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_palace_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE _backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON ar_awareness FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON ar_corrections FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON ar_palace_rooms FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON ar_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON _backups FOR ALL TO anon USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ar_awareness;
ALTER PUBLICATION supabase_realtime ADD TABLE ar_corrections;
ALTER PUBLICATION supabase_realtime ADD TABLE ar_palace_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE ar_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- Indexes
CREATE INDEX idx_ar_corrections_project ON ar_corrections(project);
CREATE INDEX idx_ar_palace_project ON ar_palace_rooms(project);
CREATE INDEX idx_ar_sessions_project ON ar_sessions(project);
CREATE INDEX idx_backups_lookup ON _backups(table_name, original_id);
```

### Sync Script (`ar dashboard sync`)

Python script at `~/.claude/scripts/ar-dashboard-sync.py`. Reads local AR data, upserts to Supabase.

**Data sources → tables:**

| Local source | Supabase table | Sync key |
|-------------|---------------|----------|
| `~/.agent-recall/awareness-state.json` → `topInsights[]` | `ar_awareness` | title (upsert) |
| `~/.agent-recall/projects/*/corrections/*.json` | `ar_corrections` | source_file (upsert) |
| `~/.agent-recall/projects/*/palace/rooms/*/_room.json` | `ar_palace_rooms` | project + room_slug (upsert) |
| `~/.agent-recall/projects/*/journal/*.md` (last 30 days) | `journal_entries` | title (upsert) |
| `~/.agent-recall/dreams/*.md` (last 14 days) | `journal_entries` (type=dream) | title (upsert) |

**Sync behavior:**
- Upsert (insert or update on conflict) — never deletes from Supabase
- Runs in ~5 seconds for typical data volume
- Idempotent — safe to run multiple times

**Hook integration:**
After building, add to PostToolUse hook on `session_end`:
```bash
python3 ~/.claude/scripts/ar-dashboard-sync.py 2>/dev/null &
```

## Theme

### Design Tokens (CSS Variables)

**Light mode (Parchment):**
```css
--bg-primary: #F5F0E8;
--bg-secondary: #EBE2D5;
--bg-card: #FBF8F3;
--bg-card-hover: #F3EDE4;
--border: #DDD3C3;
--text-primary: #2C2418;
--text-secondary: #8C7A66;
--text-muted: #6B5C4A;
--accent-primary: #C4841D;     /* amber — brand, highlights */
--accent-green: #4A7C59;       /* active, success */
--accent-red: #B84233;         /* blocked, danger */
--accent-copper: #B87333;      /* warnings, corrections */
--accent-purple: #7B5EA7;      /* palace, sessions */
--tag-active-bg: #DEF0D8;
--tag-active-fg: #4A7C59;
--tag-blocked-bg: #FDEBD0;
--tag-blocked-fg: #C4841D;
--tag-stale-bg: #EBE2D5;
--tag-stale-fg: #8C7A66;
```

**Dark mode (Deep Walnut):**
```css
--bg-primary: #191510;
--bg-secondary: #241E16;
--bg-card: #1E1912;
--bg-card-hover: #2A2318;
--border: #362D22;
--text-primary: #DDD3C3;
--text-secondary: #6B5C4A;
--text-muted: #544838;
--accent-primary: #E8A94D;
--accent-green: #7ABF5C;
--accent-red: #E06B5A;
--accent-copper: #D4883A;
--accent-purple: #A68BD4;
--tag-active-bg: #162E1B;
--tag-active-fg: #7ABF5C;
--tag-blocked-bg: #362408;
--tag-blocked-fg: #E8A94D;
--tag-stale-bg: #241E16;
--tag-stale-fg: #6B5C4A;
```

**Font:** `'Nunito', system-ui, -apple-system, sans-serif` (Google Fonts CDN)
**Border radius:** `10px` cards, `20px` tags, `8px` panels
**Toggle:** Sun/moon icon in header, preference stored in `localStorage`

## Layout

### Page 0: Morning Brief (Landing)

The first thing you see. One screen, 30-second scan, you know your day.

**Header bar:**
- Logo: `🧠 AgentRecall`
- Right: global search bar, real-time indicator (green dot), total stats, theme toggle (☀/🌙)

**Global search:** Single input at top. Full-text search across all `ar_*` tables + `journal_entries`. Type "P0 regex" → shows matching corrections, insights, and journal entries. Results grouped by source type.

**4 sections, vertical stack:**

1. **🌙 Overnight** — latest dream report summary. Key actions needed as clickable buttons:
   - Stale candidates: each gets [Accept] / [Reject]
   - Post-crystallization cleanup: [Archive source insights]
   - New patterns written: shown for awareness

2. **🚧 Blocked** — projects with blocked status. Each shows: project name, blocker reason, how long blocked. Click → drill down.

3. **⚡ Agent Activity** — sessions from last 24h. Running (green dot), completed (gray), failed (red). Shows: project, model, duration, phase.

4. **⚠ Today's Predictions** — from dream report's "Predictions for Tomorrow" section. Each prediction shows: context, risk, what to watch for.

**Navigation:** "View all projects →" link at bottom → Control Tower.

### Page 1: Control Tower

The project overview. Accessed from Morning Brief or directly.

**Header bar:**
- Same header as Morning Brief (search, real-time, theme toggle)

**Stats bar (4 cards):**
- Active Projects (green) | Awareness Insights (amber) | Corrections (copper) | Live Sessions (purple)
- Numbers pulled from Supabase counts

**Project grid:**
- `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`
- Each card shows: name, version/meta, last date, status tag (active/blocked/stale)
- Left border color indicates status: green=active, red=blocked, gray=stale
- Click → navigates to drill-down view
- Cards are clickable, hoverable with subtle lift
- **Each card has a "👁 Preview" button** — shows what `session_start` would inject for this project. Token count badge. Expand/collapse inline. This is the hero feature — no other memory tool offers this.

**Bottom panels (2-column):**
- Left: **Awareness panel** — top insights sorted by confirmation count, each with trend badge (growing/stable/weakening) and edit/archive buttons
- Right: **Live Sessions** — running sessions with model/phase (dream summary moved to Morning Brief)

### Page 2: Drill-Down (Project Detail)

Appears when a project card is clicked. Back button returns to Control Tower.

**Header:** Project name, version, stats, status change button, delete button

**7 tabs:**

#### Tab 1: Overview
- **Trajectory** — editable text block showing where work is heading
- **Next Action** — from latest journal `## Next` section
- **"What would the agent see?" preview** — renders the data that `session_start` would inject
  - Shows: P0 rules (from corrections where severity=p0), watch_for warnings, awareness insights sorted by confirmations, last session summary
  - **Token budget indicator**: estimated token count with color coding:
    - Green (<300 tokens): lean and efficient
    - Amber (300-500 tokens): normal range
    - Red (>500 tokens): bloated — consider archiving low-value insights
  - Each insight row has a ✕ button to archive directly from the preview
  - Note: this shows the raw data components, not a pixel-perfect replica of session_start output (that would require reimplementing TypeScript ranking logic in browser JS — fragile and unnecessary)

#### Tab 2: Awareness
- All insights for this project (filtered by `source_project` or global)
- Each row: confirmation count, title, trend badge, edit/archive buttons
- Inline editing: click title to edit, save updates Supabase
- Archive: moves to `is_active: false` (with backup)

#### Tab 3: Corrections
- All corrections from `ar_corrections` table matching project
- **Grouped by pattern** — cluster corrections with similar keywords:
  ```
  Version bumping (4 corrections across 3 projects)
    - one version bump per release — AgentRecall, May 20      [P0] [promote] [dismiss]
    - never bump without asking — novada-proxy, Apr 29         [P0] [promote] [dismiss]
  
  Publishing without permission (3 corrections)
    - published v1.8.0 without permission — proxy4agent        [P0] [promote] [dismiss]
  
  Ungrouped
    - Root cause is Mac sleep mode — ENOTFOUND...              [P1] [promote] [dismiss]
  ```
- Pattern grouping: client-side keyword clustering (extract 2-3 key nouns from each rule, group by overlap)
- Each row: P0/P1 severity badge, rule text, date, project
- Actions: **Promote to insight** (creates `ar_awareness` entry), **Dismiss** (marks resolved)
- Noise filter: toggle to show/hide system message garbage (detect `<task-notification>`, bare numbers, speech fragments <5 words)
- Dismiss all noise: bulk action

#### Tab 4: Journal
- Session entries from `journal_entries` table, sorted newest first
- Each entry: date, summary with phase headings highlighted
- Read-only (agents write these, humans read them)
- Expandable: click to show full content

#### Tab 5: Palace
- Room cards in a grid: name, access count, salience bar (visual fill)
- Salience color: green (>0.5), blue (0.2-0.5), gray (<0.2)
- Click room to expand and see content
- Actions: delete room (with backup), merge rooms (future)
- Archived rooms (salience ≤ 0.05) shown at bottom, dimmed

#### Tab 6: Dreams
- Dream reports from `journal_entries` where title contains "Dream"
- Chronological, newest first
- Key sections highlighted: Patterns Written, Stale Candidates, Crystallizations
- **Stale candidates:** each gets Accept (archive the insight) / Reject (keep it) buttons
- **Post-crystallization cleanup:** shows source insights to remove, with one-click archive

#### Tab 7: Performance
- **Corrections per session chart** — bar chart, last 30 days
  - Blue bars = high correction count, green bars = declining (good)
  - If trending down: "↘ declining (good)" indicator
  - If flat/rising: "⚠ not improving" warning
- **Summary stats:** avg corrections/session, P0 rate, trend direction
- Data derived from: count corrections by date, group by session dates from journal_entries

## Interactive Actions (9 total)

All write operations with Supabase + backup:

| # | Action | Table | Operation | Backup |
|---|--------|-------|-----------|--------|
| 1 | Archive insight | ar_awareness | `is_active = false` | yes |
| 2 | Dismiss correction | ar_corrections | `dismissed = true` | yes |
| 3 | Promote correction → insight | ar_corrections + ar_awareness | SET promoted=true, INSERT awareness row | no (additive) |
| 4 | Edit insight title/evidence | ar_awareness | UPDATE title/evidence | yes (save original) |
| 5 | Change project status | projects | UPDATE status | yes |
| 6 | Preview agent injection | n/a | Read-only render from ar_awareness + ar_corrections | n/a |
| 7 | Delete palace room | ar_palace_rooms | DELETE | yes |
| 8 | Dream: accept/reject stale | ar_awareness | `is_active = false` on accept | yes |
| 9 | Delete orphaned project | projects + ar_* | DELETE cascade | yes (full project snapshot) |

### Confirmation Dialogs

Destructive actions (delete project, delete room) show a confirmation modal:
```
┌─────────────────────────────────────────┐
│  Delete project "novada-site"?          │
│                                         │
│  This will remove:                      │
│  • 0 journal entries                    │
│  • 0 corrections                        │
│  • 6 palace rooms (all boilerplate)     │
│                                         │
│  A backup will be saved to _backups.    │
│                                         │
│  [Cancel]              [Delete]         │
└─────────────────────────────────────────┘
```

## Real-Time Subscriptions

```js
const channel = sb.channel('dashboard')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, handleMemoryChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handleProjectChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, handleJournalChange)
  .subscribe()
```

When an event arrives:
- INSERT → add new row to the relevant view, flash highlight animation
- UPDATE → update the row in place
- DELETE → remove with fade-out animation

Toast notification on each event: "✓ Insight archived" / "New journal entry from AgentRecall"

## Supabase Migration (one-time)

```sql
-- Backup table for destructive operations
CREATE TABLE IF NOT EXISTS _backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  original_id UUID,
  data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  restored BOOLEAN DEFAULT false
);

-- Enable realtime on tables the dashboard subscribes to
ALTER PUBLICATION supabase_realtime ADD TABLE memories;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;

-- Index for backup lookups
CREATE INDEX idx_backups_table_original ON _backups(table_name, original_id);

-- Allow anon key to insert backups (personal use, no RLS needed)
ALTER TABLE _backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_backups" ON _backups FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_backups" ON _backups FOR SELECT TO anon USING (true);
```

## File Structure

Single file. Internal organization:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google Fonts: Nunito -->
  <!-- Supabase JS SDK v2 -->
  <style>
    /* CSS variables for light/dark theme */
    /* Layout: header, stats, grid, panels, tabs */
    /* Components: cards, tags, buttons, modals, toasts */
    /* Animations: fade, slide, highlight */
  </style>
</head>
<body>
  <!-- Header -->
  <!-- Control Tower view -->
  <!-- Drill-down view (hidden by default) -->
  <!-- Modal container -->
  <!-- Toast container -->

  <script>
    // Supabase client init
    // Theme toggle (localStorage)
    // Data loading functions
    // Real-time subscription setup
    // Render functions (Control Tower, drill-down, each tab)
    // Action handlers (archive, dismiss, promote, edit, delete)
    // Backup helper
    // Navigation (Control Tower ↔ drill-down)
  </script>
</body>
</html>
```

## Sync-Back: Dashboard → Agent

When insights are archived or corrections dismissed in the dashboard, the next `ar session_start` must respect those changes. Without this, the feedback loop is broken.

**Implementation: lightweight Supabase filter in session_start.**

In `packages/core/src/tools-logic/session-start.ts`, before rendering insights:

```typescript
// Check Supabase for dashboard-archived insights
const archived = await fetchArchivedInsightTitles(); // SELECT title FROM ar_awareness WHERE is_active = false
// Filter them out of the local awareness state
const activeInsights = localInsights.filter(i => !archived.includes(i.title));
```

This is a single Supabase query (~50ms). No full `ar pull` needed. The local files remain the source of truth for writes, but the dashboard's archive/dismiss decisions are respected at read time.

**Fallback:** If Supabase is unreachable (offline), use local state only. Never block session_start on network.

## Non-Goals (explicitly out of scope)

- Multi-user auth / RLS (personal use only)
- Offline support (needs Supabase connection for dashboard; CLI works offline)
- Mobile-first responsive (desktop primary, basic mobile OK)
- Full bidirectional sync / `ar pull` command (sync-back lite via Supabase filter is sufficient)
- Network graph visualization of insight connections (future)
- Drag-to-reorder in agent preview (future)
