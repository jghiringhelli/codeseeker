# ADR 0013: A declaration outranks a name that merely matches

- **Status:** Accepted
- **Date:** 2026-09-10
- **Refines:** ADR-0004 (additive symbol-name boost), ADR-0009 (source boost and test penalty)

## Context

ADR-0004 gave a single additive +0.20 whenever a query token appeared in the file name,
the chunk's `symbolName`, or `metadata.classes` / `metadata.functions`. Being *named*
after the query and *declaring* what the query asks for therefore counted the same.

The RealWorld Conduit benchmark (ADR-0009's open direction, now measurable across Python,
JavaScript and TypeScript) showed what that costs:

- `README.md` ranked first for "log a user in and sign a JWT for them", ahead of the
  `auth.service.ts` that implements it. Prose describing a feature embeds closer to a
  prose query than the code implementing it does, and −0.05 for a doc file is not enough
  to correct that.
- A 14-line `routes.ts` that only wires routers together outranked the
  `article.controller.ts` declaring all eleven endpoints, because both matched "routes".
- An 18-line interface file outranked the service implementing the feed.

Two of the four inputs were also dead. The indexer writes `symbolName` and `symbolType`;
it has never written `classes` or `functions`, so those branches only ever fired in tests
that supplied them by hand.

## Decision

Grade the boost by the strength of the evidence:

| evidence | boost |
|---|---|
| some chunk of the file **declares** a symbol the query names (`symbolName` matches and `symbolType` is not `unknown`) | +0.20 |
| only the **file name** shares a word with the query | +0.12 |

The declaration weight is unchanged from ADR-0004. The entire gain comes from separating
the weaker case out of it.

The declaration signal is a property of the file, not of its best-scoring chunk: a service
can declare `getTags` in one chunk while an unrelated chunk of the same file scores
highest. It is accumulated while chunks are merged, before boosting.

Everything ADR-0004 established still holds: the boost is additive so it reliably reverses
a ranking, and the RAPTOR cascade gate still reads the pre-boost score.

## Consequences

Positive, measured over 23 labelled queries on three RealWorld Conduit implementations:

|        | before | after  |
|--------|--------|--------|
| MRR    | 66.3%  | 80.4%  |
| P@1    | 43.5%  | 65.2%  |
| P@3    | 30.4%  | 33.3%  |
| R@5    | 95.7%  | 100.0% |
| F1@3   | 45.7%  | 50.0%  |

Per language MRR lands at Python 79.6%, JavaScript 78.1%, TypeScript 75.0% — within five
points, which is the first evidence that language handling is not what separates these
corpora.

Negative: 0.12 is tuned on 23 queries. The sweep gave 0.08 → 79.3% MRR at P@1 60.9%,
0.12 → 79.3%/65.2%, 0.15 → 74.6%, 0.18 → 74.3%. Read it as "clearly below a declaration,
clearly above nothing", not as a located optimum. It should be re-swept whenever the
benchmark grows.

Negative: the declaration signal comes from the AST chunker's own regex symbol detection,
which is independent of the graph parsers. A chunk the chunker cannot classify gets
`symbolType: 'unknown'` and forfeits the boost even when a real parser would have found a
declaration there. Unifying the two is the next open direction, and it is what still
limits the Express corpus (75.0%) relative to Django (79.6%).

Known limitation carried forward from ADR-0009: an off-topic query still returns files.
`kubernetes deployment yaml ingress replica set` against a Django project returns
`articles/views.py`. Addressed by ADR-0014, which labels such a response rather than
filtering it — the boosts described above are part of why the reported score cannot
express relevance.
