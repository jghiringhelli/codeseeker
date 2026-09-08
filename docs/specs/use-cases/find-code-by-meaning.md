# Use case: find code by meaning

**Actor.** An AI assistant that has been asked a question about a codebase and does not
know which files are relevant.

**Requirements.** R4–R10.

## Main flow

1. The assistant calls `search({q: "<natural language question>"})` with the project root.
2. CodeSeeker retrieves by BM25 and by embedding, and fuses the two rankings with RRF at
   k=60 (R4). Path relevance is already inside the text index, not a separate fusion
   dimension (R5).
3. If a directory summary scores at or above 0.5, results narrow to that directory (R7).
4. Results are deduplicated to the best chunk per file and adjusted: source files up,
   test files down, symbol-name matches up (R6).
5. The top results are expanded along graph edges, each neighbour scored at 0.7 of the
   result that reached it (R8).
6. The response is a ranked list of project-relative paths with scores, line ranges and
   signatures — no file bodies (R9, R10).

## Observable outcome

The assistant reads one or two files rather than grepping and guessing, and those files
contain the answer.

## Why each layer is there

Each retrieval layer earns its place on a query class the others handle badly. This table
is the argument for the pipeline's shape, and the reason removing a layer is a
specification change rather than an optimisation.

| Query | Layer that carries it |
|---|---|
| `RaptorIndexingService` — an exact symbol | BM25; the vector layer ranks paraphrases equally well |
| "how does the project handle retries" — no shared vocabulary with the code | embeddings; BM25 has nothing to match |
| "what does the auth module do" — about a directory, not a file | the RAPTOR cascade |
| "what breaks if I change this file" | graph expansion, or the `graph` action |

## Failure modes

| Condition | Required behaviour |
|---|---|
| Project not indexed | Error naming the init call (C4) |
| No results | A statement that nothing matched, with the query echoed — not an empty list |
| Multiple projects indexed, none specified | Error listing the candidates |

## What must never happen

A test file outranking the source file it tests, for a query naming a symbol that the
source defines (R6). Test files import and exercise every symbol in the code they test,
so without correction they are excellent semantic matches for exactly the wrong reason.

This is the failure the type penalty exists for, and the benchmark query `cv-prompts`
still exhibits it: `prompt-builder.test.ts` outscores `prompt-builder.ts`, so the source
file never enters the top 10 and cannot be graph-walked from. Recorded in ADR-0009 as an
open limitation rather than a solved problem.
