# CodeMind Codebase Organization

## Three-Layer Architecture Overview

CodeMind implements a **three-layer architecture** where each layer serves a distinct purpose while maintaining clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Project Planner (Long-term Planning)             │
│  📁 src/planner/                                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Orchestrator (Multi-step Workflows)              │
│  📁 src/orchestration/                                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: CLI (Core Intelligence Engine)                   │
│  📁 src/cli/                                                │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

### **Layer 1: CLI - Core Intelligence Engine** (`src/cli/`)
The foundation layer that provides direct user interaction with comprehensive semantic analysis.

```
src/cli/
├── codemind-unified-cli.ts          # Main interactive CLI
├── claude-integration.ts            # Claude Code integration
├── enhanced-tool-selector.ts        # AI-powered tool selection
├── context-optimizer.ts             # Token-efficient context management
├── container-manager.ts             # Docker deployment management
├── commands/                        # CLI command implementations
│   ├── semantic-search.ts
│   └── reconcile.ts
└── tools/                           # CLI-specific tools
    └── context-optimizer-tool.ts
```

**Key Features:**
- Interactive interface with inquirer.js prompts
- Semantic search via pgvector similarity
- Graph analysis through Neo4j relationships  
- AI integration for Claude Code workflows
- Project management and configuration

### **Layer 2: Orchestrator - Multi-step Workflows** (`src/orchestration/`)
Manages complex, multi-step workflows with role-based task distribution.

```
src/orchestration/
├── orchestrator-server.ts           # HTTP API server
├── sequential-workflow-orchestrator.ts # Core workflow management
├── intelligent-task-orchestrator.ts # AI-driven task orchestration
├── workflow-definitions.ts          # Predefined workflow templates
├── context-manager.ts               # Context management across steps
├── tool-management-api.ts           # Tool selection and execution APIs
├── pause-rollback-manager.ts        # Workflow state management
└── workflow-tool-integrator.ts      # Tool integration layer
```

**Key Features:**
- Sequential workflow execution
- Role-based task distribution to specialized AI agents
- Context passing between workflow steps
- Cross-step learning and result aggregation
- Redis-based message queuing and state persistence

### **Layer 3: Project Planner - Long-term Planning** (`src/planner/`)
Manages multi-phase project execution with milestone tracking and dependency management.

```
src/planner/
├── project-planner.ts               # Core planner implementation
└── README.md                        # Planner documentation
```

**Key Features:**
- Multi-phase project planning
- Dependency management between phases
- Milestone tracking and progress monitoring
- Integration with orchestrator for workflow execution

### **Supporting Components**

#### **Dashboard** (`src/dashboard/`)
Web-based interfaces for monitoring and management.

```
src/dashboard/
├── server.js                        # Dashboard web server
├── index.html                       # Main dashboard interface
├── project-view.html                # Project-specific views
├── orchestrator-page.html           # Orchestrator management UI
├── planner-page.html                # Project planning interface
├── analytics-dashboard.html         # Analytics and metrics
└── marketplace/                     # Component marketplace
```

#### **API Server** (`src/api/`)
RESTful API services for external integrations.

```
src/api/
├── server.ts                        # Main API server
└── handlers/                        # API endpoint handlers
```

#### **Core Systems** (`src/core/`, `src/services/`, `src/shared/`)
Foundational components used across all layers.

```
src/
├── core/                            # Core workflow components
│   ├── intent-analyzer.ts
│   ├── task-splitter.ts
│   ├── quality-checker.ts
│   └── codemind-workflow-orchestrator.ts
├── services/                        # Business logic services
│   ├── embedding-service.ts         # pgvector embeddings
│   └── claude-tool-orchestrator.ts
├── shared/                          # Shared utilities
│   ├── context/
│   ├── embeddings/
│   └── ast/
└── database/                        # Database integrations
    ├── adapters/
    └── migrations/
```

#### **Features** (`src/features/`)
Modular feature implementations.

```
src/features/
├── semantic-graph/                  # Neo4j graph analysis
├── search/                         # Semantic search capabilities
├── duplication/                    # Code duplication detection
├── solid-principles/               # SOLID principles analysis
├── tree-navigation/               # AST-based navigation
└── use-cases/                     # Use case inference
```

#### **Configuration & Deployment**

```
docker/                             # Docker configurations
├── postgres-vector.Dockerfile      # PostgreSQL with pgvector
└── dashboard.Dockerfile           # Dashboard container

scripts/                           # Setup and utility scripts
├── database-cleanup.ps1
└── init-project-final.ps1
```

## Layer Interactions

### **Composition Over Inheritance**
- Higher layers **use** lower layers, don't extend them
- Each layer maintains its own responsibilities  
- Clean separation of concerns

### **Intelligence Reuse**
- Every CLI call gets full three-layer internal analysis
- No intelligence bypassing - always semantic → graph → tree
- Consistent context quality regardless of calling layer

### **Universal Learning**
- All database updates happen at CLI level
- Every tool learns from every request across all layers
- Pattern recognition improves system-wide

## Usage Patterns

### **Simple Tasks (Direct CLI)**
```bash
codemind "fix authentication bug"
# → CLI processes directly with full semantic analysis
```

### **Complex Workflows (Orchestrator + CLI)**  
```bash
# Orchestrator breaks down complex request into CLI steps
"refactor entire auth system"
# → Step 1: CLI analyzes current auth
# → Step 2: CLI identifies refactoring opportunities  
# → Step 3: CLI implements changes
# → Orchestrator aggregates results
```

### **Long-term Projects (Planner + Orchestrator + CLI)**
```bash
# Planner manages multi-phase project
"modernize legacy system"  
# → Phase 1: Analysis (via Orchestrator → CLI steps)
# → Phase 2: Implementation (via Orchestrator → CLI steps)
# → Phase 3: Testing (via Orchestrator → CLI steps)
# → Planner tracks milestones and dependencies
```

This organization ensures that every level of complexity benefits from the full intelligence of CodeMind's semantic analysis while maintaining clear architectural boundaries.