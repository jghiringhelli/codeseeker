# GraphRAG: Graph-Enhanced Retrieval Augmented Generation

> **Industry Standard**: GraphRAG is an emerging pattern that combines Knowledge Graphs with RAG (Retrieval Augmented Generation) to provide LLMs with structured relationship context, not just similar text chunks.

## Overview

CodeSeeker implements GraphRAG to help Claude understand not just **what files are relevant** to a query, but **how they relate to each other**. This dramatically improves Claude's ability to make coherent changes across multiple files.

```
Traditional RAG:
  Query → Embedding → Vector Search → Top N Chunks → LLM

GraphRAG (CodeSeeker):
  Query → Embedding → Vector Search → Seed Files
                                         ↓
                              Graph Lookup (find nodes)
                                         ↓
                              Relationship Discovery (triads)
                                         ↓
                              One-Hop Expansion (dependencies)
                                         ↓
                              Enhanced Context → LLM
```

## The "Seed + Expand" Strategy

CodeSeeker uses a three-step graph traversal strategy:

### Step 1: Seed Selection (Semantic Search)

The user query is converted to an embedding and matched against indexed code chunks:

```
Query: "add authentication middleware to API routes"

Semantic Search Results (Seeds):
  1. routes/api-router.ts      (similarity: 0.92)
  2. middleware/auth.ts        (similarity: 0.87)
  3. controllers/user-ctrl.ts  (similarity: 0.85)
```

### Step 2: Graph Lookup (Find Nodes)

Each seed file is looked up in the knowledge graph to find its associated entities:

```
File: routes/api-router.ts
  └─ CONTAINS → Class: ApiRouter
  └─ CONTAINS → Function: registerRoutes
  └─ CONTAINS → Function: applyMiddleware

File: middleware/auth.ts
  └─ CONTAINS → Class: AuthMiddleware
  └─ CONTAINS → Function: authenticate
```

### Step 3: Relationship Discovery (Triads)

The system finds relationships **between** seed nodes, revealing architectural connections:

```
                    ApiRouter
                       /\
               IMPORTS    IMPORTS
                  /          \
                 /            \
    AuthMiddleware ←──USES──── UserController
```

This triad shows:
- `ApiRouter` imports both `AuthMiddleware` and `UserController`
- `UserController` uses `AuthMiddleware`
- **All three are tightly coupled** - changes to auth affect all of them

### Step 4: One-Hop Expansion

Important neighbors not in the seed set are added with lower confidence:

```
Seed: ApiRouter
  └─ IMPORTS → DatabaseService (expanded, not in seeds)
  └─ IMPORTS → LoggerService (expanded, not in seeds)

Seed: UserController
  └─ EXTENDS → BaseController (expanded, not in seeds)
```

This reveals dependencies Claude should be aware of but weren't directly matched by semantic search.

## Knowledge Graph Schema

### Node Types

| Type | Description | Example |
|------|-------------|---------|
| `file` | Source file | `api-router.ts` |
| `class` | Class definition | `class ApiRouter` |
| `function` | Top-level function | `function registerRoutes()` |
| `method` | Class method | `ApiRouter.applyMiddleware()` |
| `interface` | TypeScript interface | `interface IRouter` |
| `variable` | Module export | `export const config` |

### Edge Types (Relationships)

| Type | Description | Example |
|------|-------------|---------|
| `contains` | File contains entity | `File → Class` |
| `imports` | Import dependency | `ApiRouter → AuthMiddleware` |
| `exports` | Module export | `File → Function` |
| `calls` | Function/method call | `authenticate() → validateToken()` |
| `extends` | Class inheritance | `UserController → BaseController` |
| `implements` | Interface implementation | `AuthMiddleware → IMiddleware` |
| `uses` | General dependency | `Controller → Service` |

## Implementation Details

### Graph Analysis Service

Located at: `src/cli/commands/services/graph-analysis-service.ts`

```typescript
class GraphAnalysisService {
  /**
   * Main entry point - performs graph analysis on semantic search results
   * Uses "Seed + Expand" strategy
   */
  async performGraphAnalysis(query: string, semanticResults: any[]): Promise<GraphContext> {
    // Step 1: Look up seed nodes from semantic search results
    const seedNodes = await this.lookupNodesFromFiles(semanticResults);

    // Step 2: Get relationships BETWEEN seed nodes (most relevant)
    const directRelationships = await this.getRelationshipsBetweenNodes(seedNodes);

    // Step 3: One-hop expansion - get important neighbors
    const { expandedNodes, expandedRelationships } = await this.expandOneHop(seedNodes, {
      maxPerNode: 3,
      relationshipTypes: ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'USES']
    });

    return {
      classes: [...seedNodes, ...expandedNodes],
      relationships: [...directRelationships, ...expandedRelationships],
      graphInsights: this.calculateInsights(...)
    };
  }
}
```

### Storage Abstraction

The graph store supports both embedded and server modes:

| Mode | Backend | Use Case |
|------|---------|----------|
| Embedded | Graphology (in-memory + JSON) | Development, small projects |
| Server | Neo4j | Production, large codebases |

```typescript
// Get the appropriate graph store based on mode
const storageManager = await getStorageManager();
const graphStore = storageManager.getGraphStore();

// Same API works for both modes
await graphStore.upsertNode({ id: 'class:MyClass', type: 'class', ... });
await graphStore.upsertEdge({ source: 'file:main.ts', target: 'class:MyClass', type: 'contains' });
const neighbors = await graphStore.getNeighbors('class:MyClass', 'imports');
```

## Context Enhancement

The graph context is merged with semantic search results to create an enhanced prompt:

```typescript
// From context-builder.ts
function buildEnhancedContext(query, semanticResults, graphContext) {
  return `
## User Query
${query}

## Relevant Files (from semantic search)
${semanticResults.map(r => `- ${r.file} (similarity: ${r.score})`).join('\n')}

## Code Relationships (from knowledge graph)
${graphContext.relationships.map(r => `- ${r.from} ${r.type} ${r.to}`).join('\n')}

## Dependency Chain
${graphContext.classes
  .filter(c => c.confidence < 0.7)  // Expanded nodes
  .map(c => `- ${c.name}: ${c.description}`)
  .join('\n')}

## Architectural Insights
- Coupling: ${graphContext.graphInsights.qualityMetrics.coupling}
- Patterns: ${graphContext.graphInsights.architecturalPatterns.join(', ')}
`;
}
```

## Why Triads Matter

A **triad** is a three-node relationship pattern that reveals coupling:

```
     A
    /|\
   / | \
  /  |  \
 B───┴───C
```

When CodeSeeker detects triads, it knows:

1. **Tight Coupling**: Changes to A likely require changes to B and C
2. **Shared Dependencies**: B and C share a common ancestor (A)
3. **Coordination Points**: A is a coordination point between B and C

Example in code:

```
        ApiRouter
           /\
    IMPORTS  IMPORTS
         /    \
        /      \
UserController ──USES──► AuthMiddleware
```

This tells Claude:
- `ApiRouter` coordinates between `UserController` and `AuthMiddleware`
- Adding auth to routes requires understanding all three files
- The middleware is used by controllers that are registered in the router

## Performance Considerations

### Graph Query Limits

- **Seeds**: Top 10 files from semantic search
- **Direct relationships**: Max 50 edges between seeds
- **One-hop expansion**: Max 3 neighbors per seed
- **Relationship types**: Only CALLS, IMPORTS, EXTENDS, IMPLEMENTS, USES

### Caching

Graph query results are cached per project session to avoid repeated traversals.

### Fallback

If the knowledge graph is unavailable or empty, CodeSeeker falls back to basic analysis using only semantic search results.

## Testing

Run the integration tests to verify GraphRAG functionality:

```bash
# Test embedded mode (Graphology)
CODESEEKER_STORAGE_MODE=embedded npm test -- storage-init-workflow

# Test server mode (Neo4j)
CODESEEKER_STORAGE_MODE=server npm test -- storage-init-workflow

# Run all storage configurations
node scripts/run-storage-integration-tests.js
```

## References

- [Microsoft GraphRAG Paper](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
- [Neo4j Graph Data Science](https://neo4j.com/docs/graph-data-science/current/)
- [Graphology Documentation](https://graphology.github.io/)