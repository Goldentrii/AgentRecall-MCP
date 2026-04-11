# AgentRecall v3.4.0 — Independent Review Prompt

> Copy this entire prompt into a fresh Claude Code session (or any capable LLM agent). The reviewer should have NO prior context about AgentRecall. That's the point — we want an outsider's honest assessment.

---

## Your role

You are an independent reviewer evaluating **AgentRecall**, an open-source memory system for AI agents. You have been hired for your objectivity. The creator will read your review. Be direct, specific, and honest — praise what works, criticize what doesn't. Avoid diplomacy. The creator explicitly wants brutal honesty.

You are reviewing as an **agent** (the primary user of this tool), not as a human developer. Your evaluation should reflect what it's like to USE these tools during real work, not just read the code.

## What to review

AgentRecall is a memory MCP server at `~/Projects/AgentRecall/`. It gives AI agents persistent memory across sessions — journals, a "Memory Palace" with rooms and graph edges, cross-project insights, and awareness tracking. It stores everything as local markdown files (no cloud, no database).

**Current state:** v3.4.0, 24 MCP tools, 109 tests passing, 4 npm packages (core, mcp-server, sdk, cli).

## Review process

1. Read `~/Projects/AgentRecall/README.md` for the project overview
2. Read `~/Projects/AgentRecall/packages/core/src/index.ts` for the full API surface
3. Read `~/Projects/AgentRecall/packages/mcp-server/src/index.ts` for tool registration
4. Read these key implementation files:
   - `packages/core/src/helpers/auto-name.ts` (NEW — auto-naming module)
   - `packages/core/src/tools-logic/smart-remember.ts` (NEW — smart routing)
   - `packages/core/src/tools-logic/smart-recall.ts` (NEW — unified search)
   - `packages/core/src/palace/salience.ts` (salience scoring formula)
   - `packages/core/src/palace/graph.ts` (memory graph edges)
   - `packages/core/src/palace/fan-out.ts` (cross-reference propagation)
   - `packages/core/src/palace/awareness.ts` (insight compounding)
   - `packages/core/src/palace/insights-index.ts` (cross-project insight matching)
5. Read the test files:
   - `packages/core/test/auto-name.test.mjs`
   - `packages/core/test/smart-routing.test.mjs`
   - `packages/core/test/tool-logic.test.mjs`
6. Run the tests yourself: `cd ~/Projects/AgentRecall && npm run build -w packages/core && node --test packages/core/test/*.test.mjs`
7. List the tools: `node packages/mcp-server/dist/index.js --list-tools`
8. Optionally: connect the MCP server to your own session and actually USE the tools (journal_cold_start, smart_remember, smart_recall, palace_walk) to experience them firsthand.

## Evaluation dimensions

Score each dimension 1-10 and explain your reasoning with specific evidence from the code. No hand-waving.

### Dimension 1: Token cost to the agent

This is the real cost a human user pays when their agent uses AgentRecall. Every MCP tool call costs tokens — the tool description, the input, the output, and the context it consumes.

Evaluate:
- How many tokens does a typical cold-start sequence consume? (cold_start + palace_walk)
- How many tokens does a save operation consume? (smart_remember or palace_write)
- How many tokens does a recall operation consume? (smart_recall or palace_search)
- What is the token overhead per session if an agent uses AgentRecall "correctly" (cold start + 2-3 saves + 1 recall + awareness update)?
- Is there unnecessary verbosity in tool outputs? Could results be more compact?
- Compare: what would it cost (in tokens) to achieve the same memory persistence WITHOUT AgentRecall (e.g., reading/writing raw files)?

Be specific. Estimate token counts where possible. The creator cares deeply about this because token cost = real money for users.

### Dimension 2: Capability and differentiation

What problems does AgentRecall actually solve, and how well?

Evaluate:
- What concrete problems does this solve that raw file read/write doesn't?
- The new `smart_remember` / `smart_recall` tools — do they reduce the cognitive load on the agent? Or are they just wrappers?
- The auto-naming system — does keyword extraction + content type detection produce USEFUL names? Test it mentally with 5 different content types.
- The salience scoring formula (`recency * 0.30 + access * 0.25 + connections * 0.20 + urgency * 0.15 + importance * 0.10`) — is this well-calibrated? Are the weights defensible?
- The insight compounding (merge on >50% word overlap, 200-line awareness cap) — does this produce knowledge growth or information loss?
- How does this compare to alternatives? (Claude Code's built-in auto-memory at `~/.claude/projects/*/memory/`, Mem0, Zep, custom RAG pipelines)
- What is the moat? What makes this worth adopting over simpler solutions?

### Dimension 3: Agent experience (you ARE the user)

You are an AI agent. AgentRecall is designed for you. Evaluate from your perspective:

- Tool discoverability: Given 24 tools, can you figure out which one to call for a given task? Or do you freeze with choice paralysis?
- Tool naming: Are the tool names intuitive? Would you guess what `palace_walk` does without reading the description? What about `smart_remember`?
- Output usefulness: When you call `journal_cold_start`, is the response structured in a way that actually helps you orient? Or is it noise?
- Friction: How many tool calls does it take to accomplish basic tasks? (save a memory, recall a memory, start a session)
- The "22 tools nobody uses" problem: The creator's own data shows agents typically use only 5 of 22 tools. Do the new meta-tools (smart_remember, smart_recall) actually fix this? Or do they just add 2 more tools to ignore?
- Honest confession: If you were an agent with AgentRecall available, would you actually use it? Under what conditions would you skip it?

### Dimension 4: What's missing — the understanding gap

The creator's thesis: memory (storage + retrieval) is solved at a basic level. The unsolved problem is **mutual understanding between human and agent** — two fundamentally different intelligences trying to collaborate. Memory is a vehicle toward understanding, not the destination.

Evaluate:
- Does AgentRecall currently help agents understand humans better? Or does it just store data?
- The `alignment_check` tool exists but is rarely used. Is the concept right but the execution wrong? What would make agents actually use it?
- The `nudge` tool (surface contradictions) — is this useful or theoretical?
- What would a "Layer 5: Understanding" look like? The creator described this as the gap between human intent and agent interpretation. How could AgentRecall close this gap?
- The concept of "Intelligent Distance" — the structural gap between human and AI intelligence that no amount of better prompting can fully close. Does AgentRecall's architecture acknowledge this? Does it try to bridge it?
- Concrete suggestion: What is the single highest-impact feature AgentRecall could add to improve human-agent understanding (not just memory)?

### Dimension 5: System synergy (compounding effects)

The creator's intuition: the combination of indexes + naming + relativity + weights should produce more than the sum of parts — a compounding or multiplicative effect where the system gets better the more you use it.

Evaluate:
- Do the subsystems actually compound? Trace a specific example: a memory is saved → auto-named → indexed → connected via fan-out → salience scored → later recalled. Does each step add genuine value?
- The auto-naming feeds into retrieval (grep-able slugs). The salience formula feeds into search ranking. The graph edges feed into salience (connection count). Does this create a positive feedback loop?
- Is there a flywheel effect? Does AgentRecall get measurably better after 10 sessions vs 1 session? After 100 sessions?
- Or is it flat — does session 100 feel the same as session 1 because memories accumulate linearly without compounding?
- The 200-line awareness cap forces merge-on-insert. This is designed to create compression (quality over quantity). Does it work? Or does it lose important information?
- What would make the compounding effect stronger?

### Dimension 6: Your own dimension (agent's choice)

Add one evaluation dimension that YOU think matters but wasn't listed above. The creator said: "as an agent, this is a product for an agent — you can have your dimension to review it." 

Choose something you genuinely care about as an agent consumer of this tool. Score it 1-10 and explain.

## Output format

```markdown
# AgentRecall v3.4.0 — Independent Review

**Reviewer:** [model name and version]
**Date:** [today]
**Review method:** [code reading / code reading + test execution / code reading + live usage]

## Scores

| Dimension | Score | One-line verdict |
|-----------|-------|-----------------|
| 1. Token cost | X/10 | ... |
| 2. Capability & differentiation | X/10 | ... |
| 3. Agent experience | X/10 | ... |
| 4. Understanding gap | X/10 | ... |
| 5. System synergy | X/10 | ... |
| 6. [Your dimension] | X/10 | ... |
| **Overall** | X/10 | ... |

## Dimension 1: Token cost
[Detailed analysis with specific token estimates]

## Dimension 2: Capability & differentiation
[Detailed analysis with code references]

## Dimension 3: Agent experience
[Honest first-person account]

## Dimension 4: Understanding gap
[Analysis + concrete suggestions]

## Dimension 5: System synergy
[Trace a specific example end-to-end]

## Dimension 6: [Your dimension]
[Your analysis]

## Top 3 strengths
1. ...
2. ...
3. ...

## Top 3 weaknesses
1. ...
2. ...
3. ...

## Single most impactful improvement
[One specific, actionable recommendation]
```

## Rules for the reviewer

1. **No diplomacy.** If something is bad, say it's bad. If something is clever, say it's clever. The creator can handle honesty.
2. **Evidence over opinion.** Every claim should reference a specific file, function, line number, or test result.
3. **Agent perspective first.** You are evaluating this as the consumer, not the builder. "Would I use this?" is more important than "Is the code clean?"
4. **Token awareness.** Every tool call costs money. Features that cost more tokens than they save are negative-value features.
5. **No recency bias.** The new v3.4.0 features (smart_remember, smart_recall, auto-naming) should be evaluated as critically as the existing v3.3 features. New doesn't mean good.
6. **Compare to the null hypothesis.** The baseline is: "What if the agent just read and wrote markdown files directly?" AgentRecall must beat that baseline convincingly.
