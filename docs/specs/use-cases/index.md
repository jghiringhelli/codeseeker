# Use Cases

Each file states one thing a user does with CodeSeeker, as a sequence with an observable
outcome. A use case is the bridge between a requirement in `../spec.md` and a test: if a
use case cannot be turned into a test, the requirement behind it is not yet verifiable
and the specification is incomplete at that point.

| Use case | Requirements exercised | Test |
|---|---|---|
| [Index a project](index-a-project.md) | R11, R12, R15, C4, C5 | `tests/mcp/mcp-server.test.ts`, `scripts/smoke-test-mcp.js` |
| [Find code by meaning](find-code-by-meaning.md) | R4–R10 | `tests/relevance/`, `tests/storage/hybrid-search-scoring.test.ts` |
| [Understand a change's blast radius](blast-radius.md) | R3, R8, R14, R16 | partial — see the file |
| [Keep the index true after an edit](keep-index-true.md) | R13, R15 | **none — this is the gap in issue #5** |

The last row is the point of keeping this table. A use case with no test is a stated
obligation the project does not verify, and saying so is more useful than leaving the
column blank.
