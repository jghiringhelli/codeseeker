# ADR 0014: Confidence comes from the raw cosine, not the reported score

- **Status:** Accepted
- **Date:** 2026-09-10
- **Implements:** R23

## Context

Search always returns files. Ask a Django project about Kubernetes and it returns
`articles/views.py` — the least irrelevant thing in the corpus, with nothing marking it as
irrelevant. An agent reading that result will answer the question from it, which is a
hallucination the tool invited.

The obvious remedy is a floor on the reported `score`. That score cannot carry one. It is
built to be readable, not calibrated:

- an FTS-only hit is normalised against the best score **in its own result set**, so the
  top text match is always 0.85 however irrelevant;
- a hit found by both methods is `cosine × 1.1`;
- the ranking boosts (+0.20 declaration, +0.10 source, +0.12 filename) are additive and
  capped at 1.0, so good and bad results alike saturate.

`scripts/relevance-floor.js` measured all three available signals over nine questions
three RealWorld corpora can answer and fifteen they cannot:

| signal | answerable (mean) | unanswerable (mean) | overlap |
|---|---|---|---|
| reported `score` | 88.9% | 62.5% | 42.3 points |
| **raw cosine** | **54.3%** | **17.6%** | **1.3 points** |
| BM25 | 226 | 24.6 | 71.1 |

`kubernetes deployment yaml ingress replica set` against the Express corpus reports a
score of **100.0%** while its best cosine is **28.8%**.

The cosine was already carried on every result as `debug.vectorScore`, and nothing
consumed it.

## Decision

Report `confidence: high | low | unknown` on every `search` response, from the best raw
cosine among the results. Below 0.34, add a `confidence_note` naming the best match and
stating that the files are the closest available rather than necessarily relevant.

**Do not suppress anything.** The order and contents of the results are unchanged.

Suppression is the tempting move and the wrong one: the two distributions overlap by 1.3
points, so a filter would silently discard the answerable queries that fall inside the
overlap — trading a visible failure for an invisible one. Labelling costs a caller
nothing and lets it decide.

A result set with no cosine at all — a pure text search — reports `unknown`, not `low`.
Absent evidence is not evidence of absence, and calling it `low` would warn on every
FTS-only search.

## Consequences

Positive: an agent can distinguish "here is the answer" from "here is the closest thing I
have", which the `score` field never allowed. Verified end to end on the indexed corpora:

| corpus | query | cosine | reported | confidence |
|---|---|---|---|---|
| django | follow and unfollow a user profile | 76.0% | 100.0% | high |
| django | kubernetes deployment yaml … | 19.5% | 45.6% | low |
| node-express | follow and unfollow a user profile | 44.1% | 79.2% | high |
| node-express | kubernetes deployment yaml … | 28.8% | 100.0% | low |

Negative: 0.34 sits inside the measured overlap. On this sample it misclassifies at most
one answerable query (cosine 33.3%) as low and one unanswerable (34.7%) as high. Because
nothing is suppressed, both errors cost a label rather than an answer.

Negative: 24 queries across three corpora of the same application is a small and
correlated sample. The threshold should be re-measured as the benchmark grows, and it is
a property of this embedder — ADR/R22's identity stamp already forbids mixing indexes
built by another, which would invalidate the calibration.

Known limitation: the reported `score` remains uncalibrated and is now demonstrably not a
confidence. It is left alone deliberately — it is a ranking display, callers read it as
one, and changing its meaning is a separate decision from adding an honest signal beside
it.
