# AgentRecall Recall Scoring — Design Rationale

> This document explains WHY the scoring system works the way it does.
> It is written for future agents and engineers so they understand the theory
> before making changes. Changing numbers without understanding this will
> re-introduce the bugs we fixed in v3.3.14.

---

## The Core Problem: Heterogeneous Memory Types

AgentRecall stores four types of memory:

| Type | What it is | Useful for how long? |
|------|-----------|---------------------|
| **Journal** | Daily session logs, raw events | 1–3 days |
| **Knowledge** | Specific bug fixes, workarounds | Months to years |
| **Palace** | Architecture decisions, strategy | Indefinitely |
| **Insight** | Learned behavioral patterns | Indefinitely (until contradicted) |

**The fundamental mistake** (< v3.3.14) was putting all four types in the same
scoring arena and letting a single weighted sum decide the winner:

```
score = recency * 0.60 + exactness * 0.40   ← journal
score = salience * 0.70 + exactness * 0.30   ← palace
```

A journal entry from yesterday has `recency = 0.95^1 = 0.95` → score ≈ 0.57+.  
A palace entry with `salience = 0.5` (new room) → score ≈ 0.35+exactness*0.30.

**Journal always won**. This is not because journal entries are more useful —
it is a mathematical artifact of incompatible score scales.

The analogy: this is like running a 100m sprint and a marathon on the same track
at the same time and declaring whoever reaches 100m first the winner of both races.

---

## Fix 1: Reciprocal Rank Fusion (RRF)

**Source**: Cormack, Clarke & Buettcher (2009), SIGIR.  
**Adopted by**: Elasticsearch, Azure AI Search, Cohere, Milvus.

**Principle**: Don't compare raw scores across sources. Rank within each source
independently, then merge by rank position.

```
RRF_score(doc) = Σ  1 / (k + rank_i(doc))
                i∈sources
```

Where `k = 60` (empirically validated default).

**Why k=60?** It controls the penalty curve. Higher rank = lower contribution:
```
Rank 1:   1/(60+1)   = 0.0164
Rank 2:   1/(60+2)   = 0.0161   ← big jump: rank 1 is clearly better than 2
Rank 10:  1/(60+10)  = 0.0143
Rank 100: 1/(60+100) = 0.0063   ← small jump: 99 vs 100 barely matters
```

**Result**: Journal item at rank 1 = Palace item at rank 1. Neither source
dominates by default. Items appearing in multiple sources get a natural bonus.

**In practice**: Each source scores its own candidates using formulas optimized
for that type (see below), ranks them, then RRF merges the ranked lists.

---

## Fix 2: Ebbinghaus Forgetting Curve

**Source**: Ebbinghaus, H. (1885). *Über das Gedächtnis*.  
**Replicated**: Murre & Dros (2015), PMC4492928.

**Formula**: `R(t) = e^(-t/S)`
- `R` = retrievability / retention (0 to 1)
- `t` = time elapsed (days)
- `S` = memory strength (days) — the key parameter

**The insight**: S is not fixed. It depends on what kind of memory it is.
Ebbinghaus found: *the more meaningful and frequently-reinforced an item,
the slower it decays*.

| Memory Type | Psychological Category | S (days) | 1-day retention | 30-day retention |
|------------|----------------------|---------|----------------|-----------------|
| Journal | Episodic, low-meaning | 2 | 60.7% | ~0% |
| Knowledge (bug fix) | Procedural, practiced | 180 | 99.4% | 84.6% |
| Palace (decisions) | Semantic, structural | 9999 | ≈100% | ≈100% |
| Insight | Conceptual (uses confirmation count instead) | n/a | n/a | n/a |

**Old approach**: All sources used `0.95^days` — identical decay regardless of type.  
**New approach**: S values match the psychological reality of each memory type.

---

## Fix 3: Beta Distribution for Feedback Utility

**Source**: Bayesian statistics; Beta-Binomial model.  
**Also used in**: Multi-armed bandit systems (Thompson Sampling), A/B testing.

**Problem with old approach**: Feedback applied as `score += positives * 0.03 - negatives * 0.05`.
These additive adjustments are tiny relative to raw scores (±0.15 max) and have no
principled basis.

**The Beta model**: Each recall result has an implicit distribution over "true usefulness."
When we get feedback, we update this distribution:

```
Prior:   Beta(1, 1)      = uniform, we know nothing
After k positives, n negatives:
         Beta(k+1, n+1)
Expected value = (k+1) / (k+n+2)
```

This is mathematically the **optimal Bayesian estimate** of true usefulness from
binary observations. Known as Laplace smoothing.

| Feedback history | Old adjustment | Beta E[U] | Multiplier (×2) |
|----------------|----------------|-----------|-----------------|
| None           | +0.00          | 0.50      | ×1.00 (neutral) |
| 1 positive     | +0.03          | 0.67      | ×1.33           |
| 3 positive     | +0.09          | 0.80      | ×1.60           |
| 5 positive     | +0.15          | 0.86      | ×1.71           |
| 5 negative     | −0.25          | 0.14      | ×0.29           |

Applied as: `final_score = rrf_score × (betaUtility(pos, neg) × 2)`

The ×2 normalization ensures no-feedback items are unchanged (multiplier = 1.0).

---

## Fix 4: Consistent total_searched

**Problem**: Previously summed three incompatible metrics:
- Palace: `total_matches` (actual file matches found)
- Journal: `results.length` (results returned, capped)
- Insight: `total_in_index` (ALL insights, regardless of match)

This caused wildly varying numbers (171 to 1070) for the same session.

**Fix**: `total_searched = palaceItems.length + journalItems.length + insightItems.length`

This counts actual candidates evaluated before RRF merge — a consistent, meaningful number.

---

## Fix 5: Palace Keyword Matching

**Problem**: Old `palace-search.ts` used `line.includes(fullQuery)` — the entire
query had to appear as a single continuous substring on one line.

Query: `"edge functions cold start latency"` → requires this exact string in a line.  
Content: `"Decision: use edge functions not serverless... cold start latency >800ms"` → NO MATCH.

**Fix**: Changed to keyword overlap matching (same as `journal-search.ts`):
- Split query into keywords
- Count how many appear in the line
- `keyword_score = matched_count / total_keywords`
- Any line with ≥1 keyword match is a candidate

This aligns palace search behavior with journal search, which already worked correctly.

---

## Summary: Before vs After (v3.3.13 → v3.3.14)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Journal always wins | Linear fusion with 0.60 recency weight | RRF: rank within source, merge by position |
| Old palace entries dominate new ones | Both use same decay rate | Ebbinghaus S values per type |
| Feedback has no real effect | ±0.03 additive is noise | Beta distribution multiplier |
| total_searched varies wildly | Three different metrics summed | Count candidates consistently |
| Palace misses relevant entries | Exact substring match | Keyword overlap scoring |

---

## Guiding Principle: Respect the Memory Type

The right mental model: **different memory types play in different leagues**.
Journal is the newspaper (yesterday's news, fast decay). Palace is the constitution
(slow to change, very high authority). Knowledge is the technical manual (accurate
for years). Insights are learned wisdom (accumulates confirmation over time).

RRF ensures no league dominates. Ebbinghaus ensures each league uses its own clock.
Beta ensures user signal accumulates correctly. The result: agents get the most
useful memory, not just the most recent.

---

*Last updated: v3.3.14 (2026-04-14). See `smart-recall.ts` for implementation.*
