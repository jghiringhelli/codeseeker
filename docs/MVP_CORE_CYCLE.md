# CodeMind MVP - Core Cycle Reference

**Version**: 1.1 MVP (Implementation Complete)
**Last Updated**: 2025-12-01
**Purpose**: Definitive reference for the CodeMind MVP Core Cycle
**Status**: FULLY IMPLEMENTED - Ready for testing

---

## What is CodeMind?

CodeMind is a **wrapper around Claude Code CLI** that enhances every user prompt with:

1. **Semantic Search Results** - Finds relevant code files using vector embeddings (PostgreSQL + pgvector)
2. **Knowledge Graph Context** - Maps relationships between classes, functions, and modules (Neo4j)
3. **Configuration and Documentation** - Includes relevant config files and docs
4. **User Clarifications** - Prompts for missing information when ambiguities are detected

Instead of using `claude` directly, users type `codemind -c "your request"`, and CodeMind:
- Queries the semantic search index in PostgreSQL
- Traverses the knowledge graph in Neo4j
- Builds an enhanced prompt with extra context
- Passes it to Claude Code CLI
- Ensures code compiles and tests pass after changes
- Updates databases with any new/modified files

---

## Quick Start

### 1. Setup Infrastructure

```bash
# Start Docker containers (PostgreSQL, Neo4j, Redis)
npm run setup

# Or manually:
docker-compose up -d
```

### 2. Initialize a Project

```bash
# Navigate to your project
cd /path/to/your/project

# Initialize CodeMind (creates embeddings and graph)
codemind
/init

# Or from command line directly
codemind init /path/to/project
```

### 3. Use Natural Language

```bash
# The main MVP flow - enhanced Claude Code
codemind -c "add authentication middleware to the API routes"
codemind -c "refactor the user service to follow SOLID principles"
codemind -c "search for database connection code"
```

---

## The 10-Step Core Cycle

When you run `codemind -c "your request"`, the following steps execute:

### Step 1: Query Analysis
**File**: `src/cli/commands/services/natural-language-processor.ts`

- Analyzes user input for assumptions and ambiguities
- Detects intent (create, modify, analyze, etc.)
- Calculates confidence level (0-100%)
- Identifies what needs clarification

```
Intent: create (confidence: 85.0%)
Assumptions detected: 1
• Assuming REST API structure exists
```

### Step 2: User Clarification & Search Toggle (Optional)
**File**: `src/cli/commands/services/user-interaction-service.ts`

- Prompts user when assumptions/ambiguities detected
- Generates smart questions based on patterns
- Enhances original query with user responses
- **NEW**: Users can toggle semantic search on/off before each prompt

```
🤔 CodeMind detected some assumptions in your request.
1. What authentication method should be used? (JWT, session-based, OAuth, etc.)
> JWT with refresh tokens
```

#### Search Toggle Feature
Before entering a prompt, users can enable/disable semantic search:

**Menu-Based Interface:**
```
  Search: ON

? Options:
  > Enter prompt (with search)
    Turn OFF search (skip file discovery)
    Cancel
```

**Inline Interface:**
```
  [s] to toggle search | Search: ON
>
```

This allows users to:
- Skip file discovery for simple/direct prompts
- Get faster responses when context isn't needed
- Send prompts directly to Claude without CodeMind enhancement

### Step 3: Semantic Search
**File**: `src/cli/commands/services/semantic-search-orchestrator.ts`

- Queries PostgreSQL `semantic_search_embeddings` table
- Uses text-based search with fallback to file system search
- Falls back gracefully when database is unavailable
- Returns ranked list with similarity scores

```
📁 Found 5 relevant files
   1. src/api/middleware/auth.ts (similarity: 87%)
   2. src/api/routes/users.ts (similarity: 72%)
   3. src/models/User.ts (similarity: 68%)
```

### Step 4: Code Relationship Analysis
**File**: `src/cli/commands/services/graph-analysis-service.ts`

- Queries Neo4j for file relationships
- Maps classes, functions, dependencies
- Identifies architectural patterns

```
🔗 Found 4 relationships between components
   • AuthMiddleware → UserService (uses)
   • UserService → UserRepository (depends)
```

### Step 5: Enhanced Context Building
**File**: `src/cli/commands/services/context-builder.ts`

- Combines: original query + clarifications + semantic results + graph context
- Creates optimized prompt for Claude Code
- Manages token efficiency

### Step 6: Claude Code Execution
**File**: `src/cli/commands/services/user-interaction-service.ts`

- Passes enhanced context to `claude` CLI
- Captures response and recommendations
- Falls back to simulation mode if Claude unavailable

### Step 7: File Modification Approval
**File**: `src/cli/commands/services/user-interaction-service.ts`

- Shows files Claude intends to modify
- Provides approval options: Yes, No, "Don't ask again"
- User maintains control over code changes

```
📝 Changes to review:
   1. src/api/middleware/auth.ts
   2. src/api/routes/users.ts
Would you like to proceed? [y/n/a]
```

### Step 8: Build/Test Verification
**File**: `src/cli/commands/services/workflow-orchestrator.ts`

- Runs `npm run build` to verify compilation
- Runs `npm test` to verify tests pass
- Reports success/failure status
- Continues even if build/tests fail (warns user)

```
8️⃣ Verifying build and tests...
   ✅ Build successful
   ✅ Tests passed
```

### Step 9: Database Sync
**File**: `src/shared/managers/database-update-manager.ts`

- Updates PostgreSQL `semantic_search_embeddings` with modified files
- Updates Neo4j knowledge graph with new nodes and relationships
- Updates Redis cache with file hashes
- Uses graceful fallback if databases unavailable

```
9️⃣ Syncing databases...
   Updated: 2 files, 4 graph nodes
```

### Step 10: Execution Summary
**File**: `src/cli/commands/services/workflow-orchestrator.ts`

- Displays comprehensive summary
- Shows analysis statistics
- Reports build/test results
- Shows database sync results

```
✅ CodeMind Execution Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Analysis Statistics:
  • Files analyzed: 5
  • Relationships found: 4
  • Assumptions detected: 1
  • Clarifications provided: 1

🔨 Build/Test Status:
  • Build: ✅ Passed
  • Tests: ✅ Passed

🔄 Database Sync:
  • PostgreSQL records: 2
  • Neo4j nodes: 4
  • Redis cache: 2
```

---

## Architecture Overview

```
codemind -c "your request"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    CodeMind CLI                              │
│  bin/codemind.js → src/cli/codemind-cli.ts                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Command Router                              │
│  src/cli/commands/command-router.ts                          │
│  - Routes commands and natural language to handlers          │
│  - Uses WorkflowOrchestrator for NL queries                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│               Workflow Orchestrator                          │
│  src/cli/commands/services/workflow-orchestrator.ts          │
│  - Coordinates the 10-step Core Cycle                       │
│  - Lazy initialization of services                           │
└─────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────────────┐
        │                                      │
        ▼                                      ▼
┌─────────────────────┐            ┌─────────────────────────┐
│   NLP Processor     │            │  Semantic Search        │
│   - Intent detection│            │  - PostgreSQL + pgvector│
│   - Assumption check│            │  - Vector similarity    │
└─────────────────────┘            └─────────────────────────┘
        │                                      │
        └──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│               Graph Analysis Service                         │
│  - Neo4j queries for relationships                          │
│  - Class/function/dependency mapping                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│               Context Builder                                │
│  - Combines all context into enhanced prompt                │
│  - Token optimization                                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│           User Interaction Service                           │
│  - Clarification prompts (inquirer)                         │
│  - Claude Code execution (child_process)                    │
│  - File modification approval                                │
│  - Execution summary display                                 │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Sync Service                           │
│  - Update PostgreSQL embeddings                              │
│  - Update Neo4j graph                                        │
│  - Update Redis cache                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### CLI Entry Points
| File | Purpose |
|------|---------|
| `bin/codemind.js` | CLI executable entry |
| `src/cli/codemind-cli.ts` | Main CLI class |
| `src/cli/commands/command-router.ts` | Command routing |

### Core Cycle Services
| File | Purpose |
|------|---------|
| `src/cli/commands/services/workflow-orchestrator.ts` | Main orchestrator |
| `src/cli/commands/services/natural-language-processor.ts` | Query analysis |
| `src/cli/commands/services/semantic-search-orchestrator.ts` | File discovery |
| `src/cli/commands/services/graph-analysis-service.ts` | Relationship mapping |
| `src/cli/commands/services/context-builder.ts` | Prompt generation |
| `src/cli/commands/services/user-interaction-service.ts` | User prompts & Claude execution |

### Database Sync
| File | Purpose |
|------|---------|
| `src/cli/workflow/services/database-sync-service.ts` | Sync orchestration |
| `src/shared/managers/database-update-manager.ts` | Database operations |

### Setup & Infrastructure
| File | Purpose |
|------|---------|
| `scripts/setup.js` | Complete setup script |
| `docker-compose.yml` | Container definitions |
| `scripts/helpers/database-init.js` | DB initialization |

---

## Database Infrastructure

### PostgreSQL (with pgvector)
- **Purpose**: Semantic search via vector embeddings
- **Port**: 5432 (default)
- **Database**: codemind
- **Key Tables**:
  - `projects` - Project registry
  - `semantic_search_embeddings` - File embeddings
  - `code_embeddings` - Code snippet embeddings

### Neo4j
- **Purpose**: Knowledge graph for code relationships
- **Ports**: 7474 (browser), 7687 (bolt)
- **Key Node Types**: Project, File, Class, Function, Directory
- **Key Relationships**: IMPORTS, EXTENDS, IMPLEMENTS, USES, DEPENDS_ON

### Redis
- **Purpose**: Caching for speed
- **Port**: 6379
- **Key Usage**:
  - Cache semantic search results
  - Cache graph traversals
  - Session management

---

## CLI Commands Reference

### Infrastructure Setup
```bash
npm run setup              # Full Docker + DB setup
npm run setup:local        # Local-only setup (no Docker)
```

### Project Initialization
```bash
codemind init              # Initialize current directory
codemind init /path        # Initialize specific path
codemind init --reset      # Reinitialize (clear existing data)
codemind init --quick      # Skip indexing (faster)
```

### Natural Language Queries (MVP Core Feature)
```bash
codemind -c "add authentication middleware"
codemind -c "refactor user service for SOLID"
codemind -c "create new API endpoint for user registration"
codemind -c "fix the bug in checkout flow"
```

### Other Commands
```bash
codemind search "database connection"   # Semantic search
codemind analyze                        # Code analysis
codemind sync                          # Manual database sync
codemind status                        # Show project status
```

---

## Expected Logging Output

### Minimal but Meaningful

```
🧠 Starting CodeMind workflow...

1️⃣ Analyzing query for assumptions and ambiguities...
   Intent: create (confidence: 85.0%)
   Assumptions detected: 1
   • Assuming REST API structure exists

2️⃣ Requesting user clarifications...
   [Interactive prompts if needed]

📁 Found 3 relevant files
   1. src/api/middleware/auth.ts (service, similarity: 87%)
   2. src/api/routes/users.ts (route, similarity: 72%)
   3. src/models/User.ts (model, similarity: 68%)

🔗 Found 2 relationships between components

🚀 Processing with enhanced context...

📝 Changes to review:
   1. src/api/middleware/auth.ts
   2. src/api/routes/users.ts
Would you like to proceed? [y/n/a]

✅ CodeMind Execution Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Analysis Statistics:
  • Files analyzed: 3
  • Relationships found: 2
  • Assumptions detected: 1
  • Clarifications provided: 1
```

---

## Known Issues & TODO

### Database Update Manager (Stub Implementation)
**File**: `src/shared/managers/database-update-manager.ts`

Currently has placeholder implementations marked with `// TODO`:
- `updateGraphDatabase()` - Needs real Neo4j queries
- `updateRedisCache()` - Needs real Redis operations
- `updateMainDatabase()` - Needs real PostgreSQL queries

### Claude Code Execution
**File**: `src/cli/commands/services/user-interaction-service.ts`

- Falls back to simulation mode when running inside Claude Code
- Response parsing is basic - needs structured output parsing

### Knowledge Graph Depth (Post-MVP)
**File**: `src/cli/commands/services/graph-analysis-service.ts`

Current implementation is shallow - extracts class names from file paths and generates heuristic relationships. Full AST parsing would provide:
- **Methods** within each class (with signatures, line numbers)
- **Import/Export relationships** (which files import which)
- **Actual method calls** (ClassA.methodX() → ClassB.methodY())
- **Class hierarchies** (extends/implements)
- **Variable types** (for dependency injection context)

Implementation approach:
1. Use TypeScript Compiler API (`ts.createSourceFile`) for TS/JS
2. Parse during `codemind init` and store in Neo4j
3. Update incrementally on file changes
4. Query relationships during workflow execution

Benefits: Richer context for Claude, better call chain understanding, more accurate impact analysis.

---

## Testing the MVP

### Manual Test Flow

1. **Ensure Docker containers are running**:
   ```bash
   docker ps  # Should show codemind-database, codemind-neo4j, codemind-redis
   ```

2. **Navigate to test project**:
   ```bash
   cd /path/to/contractmaster-test
   ```

3. **Initialize with CodeMind**:
   ```bash
   codemind init
   ```

4. **Run natural language query**:
   ```bash
   codemind -c "add a new endpoint for user registration"
   ```

5. **Verify outputs**:
   - Files found and displayed
   - Relationships shown
   - Approval prompt appears
   - Summary displayed

---

## SOLID Principles Applied

The codebase follows SOLID principles:

- **Single Responsibility**: Each service has one purpose
  - `NaturalLanguageProcessor` - Only query analysis
  - `SemanticSearchOrchestrator` - Only file discovery
  - `ContextBuilder` - Only prompt construction

- **Open/Closed**: Easy to extend
  - Command handlers registered in map
  - New services can be added without modifying orchestrator

- **Liskov Substitution**: Interfaces used throughout
  - All services implement their respective interfaces

- **Interface Segregation**: Small, focused interfaces
  - `QueryAnalysis`, `SemanticResult`, `GraphContext`, etc.

- **Dependency Inversion**: Constructor injection
  - Services accept dependencies via constructor
  - Easy to mock for testing

---

## Future Enhancements (Post-MVP)

These exist in code but are NOT part of MVP Phase 1:

- Role-based orchestration
- Quality checks for non-OOP projects
- RAG system with official/custom documentation
- Dashboard UI
- Multi-project management
- Advanced code generation patterns

---

## Reference: CLAUDE.md Integration

The key sections in `CLAUDE.md` that enable this:

1. **Claude Code Integration Architecture** - Explains CLI-only approach
2. **CodeMind Core Cycle** - Documents the 8-step workflow
3. **SOLID Principles Requirements** - Code quality standards
4. **Class Naming Convention** - File organization rules

When starting a new Claude session, the CLAUDE.md file provides all context needed to understand and work with CodeMind.
