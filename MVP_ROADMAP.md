# CodeMind MVP Roadmap - Essential Classes & Execution Path

## MVP Core Requirements
1. **Setup & Installation** - Docker containers, databases initialization
2. **Project Initialization** - Code scanning, embeddings, graph building
3. **Intelligent Cycle** - Intent analysis, task decomposition, context enhancement
4. **RAG System** - Technical docs, self-documentation, semantic search
5. **Quality Control** - Testing, validation, improvement suggestions

## Essential Classes & Their Responsibilities

### 1. Setup & Infrastructure Layer

#### Setup Classes
- **`scripts/interactive-setup.sh`** - Main setup orchestrator
  - Validates environment
  - Creates Docker containers
  - Initializes databases

- **`src/cli/container-manager.ts`** - Docker container management
  - Start/stop PostgreSQL, Neo4j, Redis containers
  - Health checks
  - Volume management

- **`src/database/database.ts`** - Database connection manager
  - PostgreSQL connection pooling
  - Query execution
  - Connection health monitoring

- **`scripts/helpers/master-database-init.js`** - Database schema setup
  - Creates tables (projects, analyses, embeddings, etc.)
  - Sets up indexes
  - Initializes pgvector extension

### 2. Project Initialization Layer

#### Core Initialization Classes
- **`src/cli/managers/project-manager.ts`** - Project lifecycle management
  - Creates project records
  - Manages project configuration
  - Handles project selection

- **`scripts/init-project-master.js`** - Main initialization orchestrator
  - Coordinates all initialization steps
  - Progress tracking
  - Error recovery

- **`src/shared/codebase-analyzer.ts`** - File system analysis
  - Scans project files
  - Extracts code structure
  - Generates file metadata

- **`src/cli/services/embedding-service.ts`** - Vector embeddings
  - Generates embeddings for code chunks
  - Stores in pgvector
  - Handles batch processing

- **`src/cli/services/semantic-graph/neo4j-graph-storage.ts`** - Neo4j integration
  - Stores code relationships
  - Creates graph nodes/edges
  - Enables graph traversal

### 3. Intelligent Cycle Layer

#### Intent Analysis & Task Breaking
- **`src/cli/intent-analyzer.ts`** - Intent detection
  - Analyzes user requests
  - Determines task type
  - Identifies required tools

- **`src/cli/integration/task-decomposer.ts`** - Task breakdown
  - Splits complex tasks into steps
  - Creates execution plan
  - Manages dependencies

- **`src/cli/services/assumption-detector.ts`** - Assumption detection
  - Identifies ambiguous requirements
  - Generates clarification questions
  - Tracks assumptions made

#### Context Enhancement
- **`src/cli/context-optimizer.ts`** - Context management
  - Optimizes token usage
  - Selects relevant context
  - Manages context windows

- **`src/cli/features/search/semantic-search-complete.ts`** - Semantic search
  - Vector similarity search
  - Code chunk retrieval
  - Relevance ranking

- **`src/cli/features/code-graph/complete-graph-builder.ts`** - Graph traversal
  - Neo4j query execution
  - Relationship navigation
  - Impact analysis

### 4. RAG & Documentation Layer

#### RAG System
- **`src/shared/documentation-rag-service.ts`** - Documentation RAG
  - Indexes technical documentation
  - Retrieves relevant docs
  - Augments responses

- **`src/shared/project-intelligence.ts`** - Project understanding
  - Pattern recognition
  - Convention detection
  - Best practices extraction

- **`src/cli/analyzers/documentation-analyzer.ts`** - Doc analysis
  - Parses README, docs
  - Extracts architecture info
  - Maps documentation to code

### 5. Quality Control Layer

#### Quality Assurance
- **`src/cli/managers/quality-checker.ts`** - Quality validation
  - Code quality checks
  - SOLID principles validation
  - Best practices verification

- **`src/cli/features/compilation/verifier.ts`** - Compilation checks
  - TypeScript compilation
  - Syntax validation
  - Type checking

- **`src/cli/integration/result-improver.ts`** - Result enhancement
  - Suggests improvements
  - Validates completeness
  - Ensures consistency

## Logical Execution Path

### Phase 1: Environment Setup
```bash
# User downloads repo and runs:
./scripts/interactive-setup.sh

# Flow:
1. ContainerManager → Start Docker containers (PostgreSQL, Neo4j, Redis)
2. DatabaseManager → Initialize connections
3. master-database-init.js → Create schema, tables, indexes
4. Health checks → Verify all services running
```

### Phase 2: Project Initialization
```bash
codemind
/setup  # Configure environment
/init   # Initialize project

# Flow:
1. ProjectManager → Create project record
2. CodebaseAnalyzer → Scan all files
3. EmbeddingService → Generate vectors for code chunks
4. Neo4jGraphStorage → Build code relationship graph
5. DocumentationAnalyzer → Parse and index docs
```

### Phase 3: Intelligent Processing Cycle
```bash
/cycle "implement user authentication"

# Flow:
1. IntentAnalyzer → Understand request type
2. AssumptionDetector → Identify ambiguities
3. UserClarificationService → Ask clarifying questions
4. TaskDecomposer → Break into subtasks:
   - Create user model
   - Add authentication middleware
   - Implement login/logout
   - Add session management
5. ContextOptimizer → Gather relevant context:
   - SemanticSearchComplete → Find similar code
   - CompleteGraphBuilder → Traverse relationships
   - DocumentationRAGService → Get relevant docs
6. TaskExecutor → Execute each subtask
7. QualityChecker → Validate implementation
8. ResultImprover → Suggest enhancements
```

### Phase 4: Quality Control
```bash
/quality  # Run quality checks

# Flow:
1. CompilationVerifier → Check TypeScript compilation
2. SOLIDAnalyzer → Validate SOLID principles
3. TestCoverageAnalyzer → Check test coverage
4. DuplicationDetector → Find code duplication
5. ResultImprover → Generate improvement suggestions
```

## Key Integration Points

### Database Connections
- **PostgreSQL**: Project data, analyses, embeddings
- **Neo4j**: Code relationships, graph traversal
- **Redis**: Caching, queues, real-time updates

### Service Communications
- **REST API** (`src/api/server.ts`): External tool access
- **Redis Messaging** (`src/orchestrator/messaging/redis-messaging.ts`): Inter-service communication
- **WebSocket** (Dashboard): Real-time updates

### Claude Code Integration
- **`src/cli/claude-integration.ts`**: Claude API wrapper
- **`src/cli/claude-code-interceptor.ts`**: Request interception
- **`src/cli/claude-code-outcome-analyzer.ts`**: Response analysis

## Testing Path for MVP

### 1. Setup Verification
```bash
# Check containers
docker ps  # Should show postgres, neo4j, redis

# Test database connections
node scripts/test-postgres.js
node scripts/test-redis.js
```

### 2. Initialization Testing
```bash
codemind
/setup
/init
/status  # Should show initialized project
```

### 3. Core Functionality
```bash
# Test semantic search
/search "authentication"

# Test graph traversal
/graph src/cli/managers/project-manager.ts

# Test cycle with simple task
/cycle "add a comment to the main function"
```

### 4. Quality Validation
```bash
/quality
/analyze src/
```

## Missing Components to Address

1. **Neo4j Connection Setup** - Needs proper initialization in setup scripts
2. **Embedding Service Configuration** - OpenAI API key management
3. **RAG Index Building** - Documentation indexing process
4. **Quality Metrics Collection** - Performance tracking
5. **Error Recovery** - Rollback and retry mechanisms

## Next Steps for Live Testing

1. **Environment Setup**
   - Run `./scripts/interactive-setup.sh`
   - Verify all containers running
   - Check database schemas created

2. **Project Initialization**
   - Run `/setup` and `/init` commands
   - Monitor progress in dashboard
   - Verify embeddings and graph created

3. **Cycle Testing**
   - Start with simple tasks
   - Gradually increase complexity
   - Monitor token usage and performance

4. **Quality Validation**
   - Run quality checks after each cycle
   - Review improvement suggestions
   - Iterate based on feedback

This roadmap provides the essential path from setup to quality control, with all key classes identified and their relationships mapped.