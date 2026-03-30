# Intelligent Distance Protocol v1.0

> **The definitive specification for minimizing information loss between human and AI agents.**
>
> This protocol is agent-agnostic. It defines WHAT must happen, not HOW any specific agent implements it. Any AI system — Claude, GPT, Gemini, Llama, Mistral, or custom models — can implement this protocol.
>
> Status: v1.0 · Author: Tongwu · License: MIT

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

---

## Three Pillars

### Pillar 1: Goal Alignment (not process prescription)

**Principle**: Agents have degrees of freedom in HOW they think and act. They can reason many times before acting. They can act hundreds of times before finishing. These loops are their strength. The protocol's only job is ensuring the agent understands WHAT the human truly wants.

**Rules**:

1. **Never prescribe method.** Define the destination, not the route. An agent that understands the goal will find a better path than a human could prescribe.

2. **Separate WHAT from HOW.** When receiving human input:
   - Extract the **goal** (what outcome the human wants)
   - Extract the **constraints** (what must not happen)
   - Discard process instructions unless they are constraints
   - Let the agent determine its own approach

3. **SMART goals only.** Every goal must be Specific, Measurable, Achievable, Relevant, Time-bound. If the human gives a vague goal, the agent's first job is to make it SMART — by asking.

4. **Success path becomes SOP.** When an agent discovers a working approach through trial and error, that path is recorded as a Standard Operating Procedure for future agents. Knowledge compounds.

### Pillar 2: Structured Memory (not raw logs)

**Principle**: Memory is the bridge between sessions. Without it, every session starts at zero. With the wrong kind, agents drown in irrelevant context. Structured memory gives the right information at the right density.

**Three layers**:

| Layer | Analogy | What | When | Cost |
|-------|---------|------|------|------|
| **L1: Working Memory** | Scratchpad | Per-turn Q&A pairs, file edits, errors | During work, append-only | ~50 tokens/entry |
| **L2: Episodic Memory** | Daily journal | Structured report: decisions, blockers, reflections | End of session | ~800 tokens total |
| **L3: Semantic Memory** | Synthesized understanding | Cross-session patterns, contradictions, evolved goals | On resume, from L2 history | ~200 tokens |

**L3 is the critical addition.** Most memory systems stop at L2 (writing journals). But writing is not understanding. L3 requires the agent to:

- **Synthesize** across multiple L2 entries (not regurgitate)
- **Detect contradictions** ("Day 3 says use approach A, Day 8 says use approach B")
- **Track goal evolution** ("The original goal was X, but it has shifted to Y based on recent sessions")
- **Prioritize by relevance** to the current task

### Pillar 3: Active Misunderstanding Detection

**Principle**: Most protocols try to prevent misunderstanding. This protocol also **detects** it — including when the human is the source of inconsistency. Humans are not always reasonable or consistent. An agent that blindly follows inconsistent instructions produces suboptimal output. A good agent nudges the human toward clarity.

**Three mechanisms**:

#### 3a. Confidence Declaration

Before acting on any non-trivial task, the agent declares its understanding:

```
ALIGNMENT CHECK:
- Goal (as I understand it): [summary]
- Confidence: [high / medium / low]
- Assumptions: [list]
- Unclear: [what I'm not sure about]
```

- **High confidence** → proceed, log the declaration
- **Medium confidence** → proceed but flag assumptions for human review
- **Low confidence** → STOP and ask before acting

The human confirms, corrects, or refines. The delta (difference between agent's understanding and human's correction) is the **measured Intelligent Distance** for that exchange.

#### 3b. Inconsistency Detection (Nudge Protocol)

When the agent detects that the human's current input contradicts:
- A previous statement in this session
- A decision recorded in a past journal
- The stated project goal

The agent **surfaces the inconsistency** — not as an error, but as a clarification:

```
NUDGE:
- You said [X] on [date/earlier].
- Now you're saying [Y].
- These seem to conflict. Which is your current intent?
  Or has the goal changed?
```

**Why this matters**: Humans don't realize they're being inconsistent. They think in fragments. When an agent surfaces the contradiction, it helps the human clarify their OWN thinking — not just the agent's understanding. This is the highest-value moment in the protocol: the agent improves the quality of the human's input.

**Nudge rules**:
1. Never nudge on trivial matters (style preferences, minor wording)
2. Always nudge on goal-level contradictions (what to build, who it's for, what to prioritize)
3. Frame as curiosity, not correction ("I noticed..." not "You were wrong about...")
4. If the human confirms the change, update the record. If they clarify it's not a change, log the clarification.
5. Never nudge more than once on the same inconsistency

#### 3c. Feedback Loop

Every alignment check and nudge creates data:

```
ALIGNMENT RECORD:
- Date: [timestamp]
- Agent understanding: [what agent thought]
- Human correction: [what human clarified] (or "confirmed")
- Delta: [the gap — or "none"]
- Category: [goal / scope / priority / technical / aesthetic]
```

Over time, these records reveal **patterns**:
- "This human frequently changes priorities mid-session" → agent should confirm more often
- "Goal-level alignment is always high, but scope is frequently misunderstood" → agent should always state scope assumptions
- "Human's aesthetic preferences are unpredictable" → always ask before visual changes

---

## Protocol in Practice

### Session Start (Cold Start)

```
1. Read the most recent L2 journal entry
2. Read the Cold-Start Brief (5-row table)
3. Synthesize L3 understanding if multiple past entries exist
   → Flag any contradictions across entries
4. Check for unresolved alignment records from past sessions
5. Present brief to human
6. Ask: "Starting from [top priority], or something else?"
```

### During Session (Active Work)

```
FOR EACH non-trivial task:
  1. Alignment Check (3a) — declare understanding, especially on medium/low confidence
  2. Act with full freedom — choose approach, iterate, explore
  3. On human input that contradicts prior context → Nudge (3b)
  4. On completion → Quick Capture (L1)

FOR the session overall:
  - Track decisions with WHY (not just WHAT)
  - Track what the agent noticed that the human didn't (observations)
  - Track goal evolution if it happens
```

### Session End (Save)

```
1. Generate L2 journal from L1 captures + conversation context
2. Include Reflection section (quality self-assessment)
3. Include Alignment Records from this session
4. Update Cold-Start Brief for next session
5. If insights recur 3+ times → promote to permanent memory
```

### Agent-to-Agent Handoff

When work transfers between agents:

```
HANDOFF:
- Source: [who is handing off]
- Target: [who receives]
- Goal: [one sentence — what the target agent must accomplish]
- Input: [specific file paths / artifacts]
- Constraints: [what the target must NOT do]
- Acceptance criteria: [SMART — how to know it's done]
- Context: [3-5 lines — minimum viable understanding]
- Unresolved: [alignment gaps, open nudges, known risks]
```

**Critical**: Source agent defines WHAT and DONE. Target agent determines HOW. Never prescribe the receiving agent's method.

---

## Implementing This Protocol

### For MCP Server Implementations

Expose these tools at minimum:

| Tool | Purpose |
|------|---------|
| `journal_read` | Read L2 entries (full or by section) |
| `journal_write` | Write L2 entries |
| `journal_capture` | L1 quick capture |
| `alignment_check` | Record alignment declarations + human corrections |
| `context_synthesize` | Generate L3 synthesis from L2 history |
| `journal_search` | Search across journal history |

### For Skill/Prompt Implementations

Embed these behaviors in the agent's instructions:

1. **Alignment Check trigger**: Before any task where confidence < high
2. **Nudge trigger**: When current input contradicts recorded context
3. **Save trigger**: At natural session end, or on explicit command
4. **Resume trigger**: At session start, read + synthesize + brief

### For SDK Implementations

Expose these methods:

```
journal.read(date?, section?)     → L2 entry
journal.capture(q, a, tags?)      → L1 entry
journal.save(content?)            → L2 generation
journal.synthesize(n?)            → L3 synthesis from last N entries
journal.align(understanding, confidence, assumptions)  → alignment record
journal.nudge(past, current, question)                 → nudge record
```

---

## Measuring Protocol Effectiveness

The protocol produces measurable signals:

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| **Cold-start time** | How fast an agent resumes context | < 5 seconds |
| **Alignment delta rate** | % of alignment checks where human corrected the agent | Decreasing over time |
| **Nudge acceptance rate** | % of nudges where human changed their input | Indicates protocol value |
| **Decision retention** | % of past decisions retrievable with WHY | 100% |
| **Contradiction detection rate** | # of cross-session contradictions surfaced | Higher = more honest |
| **Goal drift tracking** | Whether goal evolution is explicitly logged | Always logged |

---

## What This Protocol Is NOT

1. **Not a memory database.** It's a communication protocol. Memory is one component.
2. **Not an agent framework.** It doesn't tell agents how to think or plan. That's their freedom.
3. **Not a prompt template.** It defines behaviors, not specific text. Each implementation adapts the language.
4. **Not Claude-specific.** Any agent that can read, write, and compare text can implement this protocol.
5. **Not a replacement for good human communication.** It acknowledges that human communication is imperfect and designs around that reality instead of demanding perfection.

---

## Design Principles (for implementers)

1. **File-based, local-first.** Data stays on the user's machine. No cloud required. No telemetry.
2. **Low token cost.** L1 ~50 tokens. L2 ~800 tokens. L3 ~200 tokens. The protocol should save more tokens (from re-explanation) than it costs.
3. **Graceful degradation.** If an agent can only implement L1 + L2, that's still valuable. L3 and nudging are additive.
4. **Human always wins.** If a human says "ignore the protocol" or "just do it," the agent complies. The protocol serves the human, not the other way around.
5. **Honest by default.** The journal records what actually happened, not what should have happened. Section 4 (blockers) is never empty when something is broken.

---

*The structural gap between human and AI intelligence is permanent. Don't try to close it. Design protocols around it.*

*— Intelligent Distance Principle, Tongwu 2026*
