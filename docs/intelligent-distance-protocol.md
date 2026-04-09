# Intelligent Distance Protocol v2.0

> **The definitive specification for minimizing information loss between human and AI agents.**
>
> This protocol is agent-agnostic. It defines WHAT must happen, not HOW any specific agent implements it. Any AI system — Claude, GPT, Codex, Gemini, Llama, Mistral, or custom models — can implement this protocol.
>
> Status: v2.0 · Author: Tongwu · License: MIT

---

## Core Premise

The gap between human and AI cognition is **structural, not a bug**.

- Humans think in emotion, intuition, scattered fragments, and non-linear bursts. They forget, contradict themselves, and communicate incompletely — not because they're bad communicators, but because that's how human cognition works.
- AI thinks in token streams, logical dependencies, and sequential operations. It is literal, context-dependent, and has no embodied experience.

**These are two fundamentally different modes of understanding the same reality.**

The protocol doesn't try to close this gap. It designs around it:

1. Give agents **full freedom** in how they think and act — they are execution-smart
2. Focus all protocol effort on **goal understanding** — they are goal-dumb
3. Actively **detect and surface misunderstanding** — including when the human is the source of inconsistency
4. **Compound insights** across sessions and projects — learning is not remembering, it's connecting

---

## Five Pillars

### Pillar 1: Goal Alignment (not process prescription)

**Principle**: Agents have full freedom in HOW they think and act. The protocol's only job is ensuring the agent understands WHAT the human truly wants.

**Rules**:

1. **Never prescribe method.** Define the destination, not the route.
2. **Separate WHAT from HOW.** Extract the goal and constraints. Discard process instructions unless they are constraints.
3. **SMART goals only.** If the human gives a vague goal, the agent's first job is to make it SMART — by asking.
4. **Success path becomes SOP.** When an agent discovers a working approach, that path is recorded for future agents.

### Pillar 2: Structured Memory (five layers)

**Principle**: Memory is the bridge between sessions. Raw logs drown agents in noise. Structured memory gives the right information at the right density at the right time.

| Layer | Name | What | When | Cost |
|-------|------|------|------|------|
| **L1** | Working Memory | Per-turn Q&A pairs, file edits, errors | During work, append-only | ~50 tokens/entry |
| **L2** | Episodic Memory | Structured daily journal (10 sections) | End of session | ~800 tokens |
| **L3** | Memory Palace | Room-based knowledge wiki with cross-references | On write, consolidated from L2 | ~200 tokens/room |
| **L4** | Awareness | Self-compounding 200-line document | End of session, forced merge | ~400 tokens |
| **L5** | Insight Index | Cross-project insight matching | On recall, keyword-based | ~50 tokens/match |

**L3 Memory Palace** organizes knowledge into themed rooms (goals, architecture, blockers, alignment, knowledge, or custom). Writing to one room auto-updates cross-references in related rooms via `[[wikilinks]]`. Every room has a salience score: `importance(0.4) + recency(0.3) + access_frequency(0.2) + connections(0.1)`.

**L4 Awareness** is a living document capped at 200 lines. When a new insight is added, similar existing insights merge (strengthen) or the weakest gets replaced. The constraint forces compression. Compression creates compounding. After 100 sessions, the document is still 200 lines — but each line carries the weight of cross-validated observations.

**L5 Insight Index** maps insights to situations via keywords, across all projects. When an agent starts a task, it queries the index to surface relevant lessons learned anywhere.

### Pillar 3: Active Misunderstanding Detection

**Principle**: Most protocols try to prevent misunderstanding. This protocol also **detects** it — including when the human is the source of inconsistency.

#### 3a. Confidence Declaration (Alignment Check)

Before acting on any non-trivial task, the agent declares its understanding:

```
ALIGNMENT CHECK:
- Goal (as I understand it): [summary]
- Confidence: [high / medium / low]
- Assumptions: [list]
- Unclear: [what I'm not sure about]
```

- **High** → proceed, log the declaration
- **Medium** → proceed but flag assumptions for review
- **Low** → STOP and ask before acting

The delta between agent understanding and human correction is the **measured Intelligent Distance**.

#### 3b. Inconsistency Detection (Nudge Protocol)

When the agent detects the human's current input contradicts a prior statement, decision, or goal:

```
NUDGE:
- You said [X] on [date/earlier].
- Now you're saying [Y].
- These seem to conflict. Which is your current intent?
```

**Nudge rules**:
1. Never nudge on trivial matters (style preferences, minor wording)
2. Always nudge on goal-level contradictions
3. Frame as curiosity, not correction ("I noticed..." not "You were wrong...")
4. If confirmed as a change, update the record. If clarified, log the clarification.
5. Never nudge more than once on the same inconsistency

#### 3c. Feedback Loop

Every alignment check and nudge creates a record. Over time, patterns reveal:
- Where misunderstanding is most likely (goal, scope, priority, technical, aesthetic)
- How the human's communication style works (scattered? linear? contradictory?)
- What the agent should always confirm vs can safely assume

### Pillar 4: Progressive Loading (not context dumping)

**Principle**: Context is expensive. Loading everything wastes tokens. Loading nothing wastes time. Progressive loading gives the right amount at the right depth.

| Depth | ~Tokens | Content |
|-------|---------|---------|
| `identity` | 50 | Project name, purpose, last session date |
| `active` | 200 | Identity + top 3 rooms by salience + awareness summary |
| `relevant` | 500 | Active + rooms matching current task + key memories |
| `full` | 2000 | All rooms with content |

The agent starts at `identity` and deepens as needed. This replaces the old pattern of loading the entire latest journal entry on cold-start.

### Pillar 5: Compounding (not accumulating)

**Principle**: A filing cabinet with better labels is still a filing cabinet. Knowledge must compound — each new insight makes existing insights more valuable through connection and compression.

**Compounding mechanisms**:

1. **Fan-out writes** — writing to one knowledge room updates cross-references in related rooms. One fact produces N connections.
2. **Merge-on-insert** — when a new insight resembles an existing one, they merge (strengthening confidence) rather than duplicating.
3. **Cross-project recall** — insights learned in Project A are available in Project B. Knowledge is not project-scoped.
4. **Forced compression** — the 200-line awareness limit forces the system to synthesize, not accumulate. Overflow triggers demotion of the least-confirmed insight.
5. **Contradiction detection** — when new information conflicts with existing knowledge, the system surfaces it rather than silently storing both.

---

## Protocol in Practice

### Session Start (`/agstart`)

```
1. recall_insight(context="today's task")       → cross-project insights
2. palace_walk(depth="active")                   → identity + top rooms + awareness
3. Present cold-start brief to human
4. Ask: "Starting from [top priority], or something else?"
```

### During Session (Active Work)

```
FOR EACH non-trivial task:
  1. Alignment Check (3a) — declare understanding on medium/low confidence
  2. Act with full freedom — choose approach, iterate, explore
  3. On contradictory human input → Nudge (3b)
  4. On completion → Quick Capture (L1)

FOR the session overall:
  - Track decisions with WHY (not just WHAT)
  - Track agent observations (what the agent noticed that the human didn't)
  - Track goal evolution if it happens
```

### Session End (`/agsave`)

```
1. journal_write → daily journal (L2) from L1 captures + conversation
2. context_synthesize(consolidate=true) → promote to palace rooms (L3)
3. awareness_update(insights=[...]) → compound into awareness (L4)
4. Cross-project insights auto-indexed (L5)
5. Optional: git push
```

### Agent-to-Agent Handoff

```
HANDOFF:
- Source: [who is handing off]
- Target: [who receives]
- Goal: [one sentence — what the target must accomplish]
- Input: [specific file paths / artifacts]
- Constraints: [what the target must NOT do]
- Acceptance criteria: [SMART — how to know it's done]
- Context: [3-5 lines — minimum viable understanding]
- Unresolved: [alignment gaps, open nudges, known risks]
```

**Critical**: Source defines WHAT and DONE. Target determines HOW.

---

## Implementing This Protocol

### MCP Server (recommended)

21 tools across 5 categories:

| Category | Tools |
|----------|-------|
| Session Memory | `journal_read`, `journal_write`, `journal_capture`, `journal_list`, `journal_search`, `journal_projects` |
| Memory Palace | `palace_read`, `palace_write`, `palace_walk`, `palace_lint`, `palace_search` |
| Awareness | `awareness_update`, `recall_insight` |
| Architecture | `journal_state`, `journal_cold_start`, `journal_archive` |
| Knowledge | `knowledge_write`, `knowledge_read` |
| Alignment | `alignment_check`, `nudge`, `context_synthesize` |

Install: `npx -y agent-recall-mcp` (works with Claude Code, Cursor, VS Code, Windsurf, Codex, any MCP agent)

### Skill/Prompt Implementation

Embed these behaviors in agent instructions:

1. **Alignment Check trigger**: Before any task where confidence < high
2. **Nudge trigger**: When current input contradicts recorded context
3. **Save trigger**: At session end, or on `/agsave` command
4. **Resume trigger**: At session start, or on `/agstart` command

### Data Format

All data is local markdown + JSON. No cloud. No database. Obsidian-compatible.

```
~/.agent-recall/
  awareness.md                    # L4: 200-line compounding document
  awareness-state.json            # Structured awareness data
  insights-index.json             # L5: cross-project matching
  projects/<project>/
    journal/                      # L1 + L2: immutable session records
    palace/                       # L3: mutable knowledge wiki
      rooms/<room>/               # Themed knowledge rooms
      graph.json                  # Cross-reference edges
      palace-index.json           # Room catalog + salience
```

---

## Measuring Protocol Effectiveness

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| **Cold-start time** | How fast an agent resumes context | < 5 seconds |
| **Alignment delta rate** | % of checks where human corrected agent | Decreasing over time |
| **Nudge acceptance rate** | % of nudges where human changed input | Indicates protocol value |
| **Decision retention** | % of past decisions retrievable with WHY | 100% |
| **Insight compounding rate** | Average confirmation count per insight | Increasing over time |
| **Cross-project recall accuracy** | % of recalled insights actually relevant | > 70% |

---

## What This Protocol Is NOT

1. **Not a memory database.** It's a communication and learning protocol. Memory is one component.
2. **Not an agent framework.** It doesn't tell agents how to think. That's their freedom.
3. **Not a prompt template.** It defines behaviors, not specific text.
4. **Not vendor-specific.** Any agent that can read, write, and compare text can implement it.
5. **Not a replacement for good human communication.** It acknowledges imperfection and designs around it.

---

## Design Principles

1. **File-based, local-first.** Data stays on the user's machine. No cloud. No telemetry.
2. **Low token cost.** L1 ~50 tok. L2 ~800. L3 ~200/room. L4 ~400. L5 ~50/match.
3. **Graceful degradation.** L1 + L2 alone is valuable. L3-L5 are additive.
4. **Human always wins.** If a human says "ignore the protocol," the agent complies.
5. **Honest by default.** The journal records what actually happened, not what should have.
6. **Compounding over accumulating.** Merge, compress, connect. Never just append.
7. **Obsidian-compatible.** YAML frontmatter + `[[wikilinks]]`. Open any palace as a vault.

---

*The structural gap between human and AI intelligence is permanent. Don't try to close it. Design protocols around it. Then make the protocol compound.*

*— Intelligent Distance Protocol v2.0, Tongwu 2026*
