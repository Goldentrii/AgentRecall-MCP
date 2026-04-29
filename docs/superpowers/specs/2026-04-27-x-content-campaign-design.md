# AgentRecall X Content Campaign — Design Spec

**Date:** 2026-04-27
**Status:** Approved
**Dashboard:** `AgentRecall/.superpowers/brainstorm/*/content/dashboard-v3.html`

## Overview

6-week content campaign on X (Twitter) to grow followers/impressions from a 25-follower cold-start account. Bilingual EN+ZH. Promotes AgentRecall as a persistent memory system for AI agents.

## Goals (force-ranked)

1. **Followers / impressions** (primary metric)
2. GitHub stars (secondary, organic)
3. npm installs (tertiary, organic)

## Audience

Dual: AI/LLM developers (for adoption) + AI enthusiasts (for reach).

## Strategy: Hybrid Content

Alternates between engagement hooks (for algorithmic reach) and technical deep-dives (for developer conversion). Each week follows a fixed rhythm:

| Day | Type | Format | Audience | Goal |
|-----|------|--------|----------|------|
| Mon | Hot Take | Single tweet, conflictive | Everyone | Impressions + engagement |
| Tue | Thread | 5-8 tweets | AI enthusiasts | Follows + bookmarks |
| Wed | Visual | Diagram / infographic + caption | Both | Shares + saves |
| Thu | Demo | Screen recording / GIF | Developers | Clicks + installs |
| Fri | Folder Spotlight | Code screenshot + explanation | Developers | Credibility + repo visits |
| Sat-Sun | Engage | Reply / QRT AI threads | Community | Visibility + network |

## 6-Week Theme Arc

### Week 1: The Problem — "Your Agent Has Amnesia"
- **Goal:** Establish pain. Zero product mention.
- **Hot take angle:** "AI is dumber than a $5 notebook"
- **Thread:** 3 types of forgetting (session boundary, correction amnesia, cross-project blindness)
- **Visual:** The Agent Amnesia Loop diagram
- **Demo:** Correction forgotten in new session
- **Folder:** ~/.claude/ — flat files, no structure

### Week 2: The Architecture — Memory Palace
- **Goal:** First product reveal. Challenge "bigger context window" narrative.
- **Hot take angle:** "Bigger context = bigger goldfish bowl"
- **Thread:** 5-layer memory pyramid (journal → episodic → palace → awareness → insights)
- **Visual:** Pyramid diagram with decay rates and token costs
- **Demo:** session_start loading full project context
- **Folder:** ~/.agent-recall/ — rooms, salience, graph

### Week 3: The Secret Sauce — Corrections > Facts
- **Goal:** Differentiation. Challenge RAG orthodoxy.
- **Hot take angle:** "RAG retrieves the wrong things"
- **Thread:** Why corrections compound, watch_for warnings, 200-line awareness cap
- **Visual:** Compression curves (typical memory vs AgentRecall awareness)
- **Demo:** watch_for warning in action (callback to W1 Thursday)
- **Folder:** palace/rooms/alignment/ — correction storage

### Week 4: The Math — Three Formulas
- **Goal:** Developer catnip. Challenge embeddings orthodoxy.
- **Hot take angle:** "Embeddings are expensive theater. Fight me."
- **Thread:** RRF (fair voting), Ebbinghaus (differential decay), Bayesian Beta (feedback loop)
- **Visual:** 3 decay curves (journal S=2, knowledge S=180, palace S=9999)
- **Demo:** Salience scoring live — watch ranking change with feedback
- **Folder:** scoring engine source code walkthrough

### Week 5: Real Usage — Cross-Project Intelligence
- **Goal:** Social proof with real projects. Honest numbers.
- **Hot take angle:** "PhD intelligence, goldfish memory"
- **Thread:** Cross-project insight surfacing + honest token savings (-57% complex, +99% simple)
- **Visual:** Token savings bar chart (honest, includes the overhead case)
- **Demo:** Bootstrap: 0 → 18 projects in one command
- **Folder:** insights-index.json — the cross-project bridge

### Week 6: The Vision — Intelligent Distance Protocol
- **Goal:** Big picture. CTA to follow.
- **Hot take angle:** "Agents won't replace devs — they'll replace bad memory"
- **Thread:** Intelligent Distance (structural gap, navigable through corrections, behavioral convergence)
- **Visual:** Session 1 vs Session 50 side-by-side
- **Demo:** Full AgentRecall lifecycle in 60 seconds
- **Folder:** ORCHESTRATOR-PROTOCOL.md — multi-agent shared memory

## Content Production

### Visual Assets
- Screen recordings (macOS built-in or OBS, 30-60 seconds)
- GIFs for short demos
- HTML cards → screenshot as PNG (agent-generated)
- Terminal screenshots for folder spotlights

### Bilingual Strategy
- All posts produced in both EN and ZH
- ZH is culturally adapted, not literal translation
- Option: post EN in morning, ZH in evening (or alternate days)

### Generation Prompts (3 types, embedded in dashboard)
1. **Tweet & Thread Writer** — for hot takes, threads, captions
2. **Visual / Diagram Generator** — for HTML cards → PNG
3. **Screen Recording Script** — for demo planning with timestamps + overlays
4. **Folder Spotlight Generator** — for code/directory visualization cards

Each post card in the dashboard has a "Generate" button that opens a pre-filled prompt modal with the week, day, type, and brief auto-populated.

## Conflict Strategy

Every Monday hot take is designed to be conflictive:
- Use patterns: "Unpopular opinion:", "Fight me.", "Everyone says X. They're wrong."
- Target sacred cows: RAG, embeddings, bigger context windows, "agents replace devs"
- Goal: force replies ("YES exactly" or "no, you're wrong because...")
- Never attack people, only ideas/approaches

## Tracking

- Dashboard has a checklist with localStorage persistence
- Progress bar: X/42 posts completed
- Each cell clickable to mark done

## Key Decisions (audit trail)

1. Audience: Both devs + AI enthusiasts
2. Primary goal: Followers/impressions (#1 force-ranked metric)
3. Baseline: 25 followers, daily poster, bilingual, zero existing AR content
4. Assets: Screen recordings + GIFs + agent-generated HTML cards
5. Cadence: 1/day for 6 weeks, front-load Week 1
6. Structure: Hybrid (hot takes + threads + visuals + demos + folder spotlights)
7. Week 1: Approved — zero product, pure problem framing
8. Dashboard: Side-by-side EN/ZH, beige+Nunito theme, per-post prompts, checklist
9. Tone: Conflictive hot takes — force agreement or argument

## Output Total

- 30 original posts (5/week x 6 weeks)
- 6 threads (~40 thread tweets)
- ~12 weekend engagements
- **~82 total content pieces**
