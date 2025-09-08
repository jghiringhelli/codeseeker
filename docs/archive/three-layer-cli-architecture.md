# CodeMind CLI Internal Architecture

## Overview

The CodeMind CLI serves as the **core intelligence engine** within CodeMind's composite architecture. While the higher-level Orchestrator and Planner layers handle workflow coordination and long-term planning, the CLI provides the foundational three-layer intelligence pipeline that powers all semantic analysis.

**Position in Composite Architecture**:
- **Used by**: Direct users, Orchestrator workflows, Planner implementations
- **Role**: Core intelligence engine with complete semantic analysis
- **Scope**: Individual query processing with full context enrichment

Every time the CLI is called (whether directly by users, or by Orchestrator/Planner), it executes this complete three-layer intelligence pipeline.

## Architecture Layers

### Layer 1: Claude Code Integration

The unified CLI provides a Claude Code-like interactive experience:

#### Key Components
- **Interactive Prompt Loop**: Full readline-based interface with command history
- **Natural Language Processing**: User queries parsed for intent and context
- **Professional Color System**: Uses existing `ColoredLogger` and `CLILogger` for consistent output
- **Session Management**: Persistent project context and user preferences

#### Color System Integration
```typescript
// Uses existing professional color systems
import { cliLogger } from '../utils/colored-logger';
import CLILogger from '../utils/cli-logger';

// Professional session tracking
cliLogger.sessionStart(sessionId, projectPath, config);
cliLogger.toolSelection(toolName, reason, confidence);
```

### Layer 2: Intelligent Context Pipeline

This layer builds context through three sequential phases:

#### Phase 1: Semantic Search 🔍
- **Query Analysis**: Extract semantic concepts and intent
- **Vector Search**: OpenAI embeddings (text-embedding-ada-002, 1536 dimensions)
- **Relevance Scoring**: Initial file/concept prioritization
- **Concept Identification**: Domain-specific terminology extraction

**Database Usage**: Multi-level caching (Memory → File → Redis → PostgreSQL)

#### Phase 2: Semantic Graph Expansion 🌐
- **Neo4j Graph Traversal**: From semantic search results
- **Relationship Mapping**: Imports, dependencies, inheritance chains
- **Architecture Pattern Recognition**: Design patterns and code structures  
- **Context Enrichment**: Expand from initial results to related code

**Database Usage**: Neo4j for graph relationships, Redis for traversal caching

#### Phase 3: Tree Navigation 🌳
- **AST-Based Traversal**: Abstract Syntax Tree analysis from graph-identified areas
- **Call Graph Analysis**: Function relationships and dependency tracking
- **File Importance Scoring**: Weighted relevance with semantic boosting
- **Code Section Prioritization**: Specific functions/classes ranked by importance

**Database Usage**: MongoDB for complex AST analysis results, DuckDB for performance analytics

### Layer 3: Specialized Tools & Learning

#### Phase 4: Tool Execution 🔧
- **Claude-Driven Selection**: AI picks 2-7 most relevant tools based on enriched context
- **Parallel/Sequential Execution**: Smart execution strategy based on tool dependencies
- **Context-Aware Analysis**: Tools receive pre-analyzed, relevant code sections
- **Confidence Scoring**: Real-time relevance and success probability

**Available Tools**:
- Security Analyzer
- Performance Analyzer  
- Duplication Detector
- SOLID Principles Analyzer
- Test Coverage Analyzer
- Documentation Analyzer
- Centralization Detector
- Use Case Analyzer

#### Phase 5: Comprehensive Database Update 💾
- **Universal Learning**: ALL tools learn from EVERY request (not just selected ones)
- **Multi-Database Updates**:
  - **PostgreSQL**: Operational data, tool metrics, execution history
  - **MongoDB**: Complex analysis results, tool configurations, project intelligence
  - **Neo4j**: Updated semantic relationships, new code patterns discovered
  - **Redis**: Cached results, session data, frequently accessed patterns  
  - **DuckDB**: Performance analytics, usage statistics, optimization metrics

## Data Flow Diagram

```
User Query
    ↓
┌─────────────────┐
│ Semantic Search │ → Redis Cache → PostgreSQL Embeddings
└─────────────────┘
    ↓ (Relevant Files)
┌─────────────────┐
│ Semantic Graph  │ → Neo4j Traversal → Context Expansion
└─────────────────┘
    ↓ (Related Code)
┌─────────────────┐
│ Tree Navigation │ → MongoDB AST → DuckDB Analytics
└─────────────────┘
    ↓ (Prioritized Sections)
┌─────────────────┐
│ Tool Selection  │ → Claude Analysis → Confidence Scoring
└─────────────────┘
    ↓ (Selected Tools)
┌─────────────────┐
│ Tool Execution  │ → Parallel/Sequential → Context-Aware Analysis
└─────────────────┘
    ↓ (Results + Learning Data)
┌─────────────────┐
│ Database Update │ → All 5 Databases → Universal Tool Learning
└─────────────────┘
    ↓
Enhanced Claude Code Experience
```

## Benefits of This Architecture

### 🧠 Intelligence First
- Semantic understanding drives everything
- Tools receive pre-analyzed, relevant context
- Reduces noise and increases signal

### 📊 Context Rich  
- Each layer adds meaningful context
- Progressive refinement from broad to specific
- Maximum relevance with minimum tokens

### 🔄 Universal Learning
- Every tool learns from every request
- Continuous improvement across the entire system
- Pattern recognition gets better over time

### ⚡ Efficiency
- Smart filtering at each layer
- Parallel execution where possible
- Cached results for repeated patterns

### 🎯 Targeted Analysis
- Tools work on pre-filtered, relevant code sections
- Higher accuracy and more actionable insights
- Better token efficiency ratios

## Implementation Guidelines

### CLI Integration Requirements

1. **Replace Duplicate Color System**
```typescript
// Remove simple theme object, use professional systems
import { cliLogger } from '../utils/colored-logger';
import CLILogger from '../utils/cli-logger';

// Use specialized logging methods
cliLogger.sessionStart(sessionId, projectPath, config);
cliLogger.semanticSearching(query, intent);  
cliLogger.contextOptimization(operation, before, after, savings);
```

2. **Implement Three-Layer Flow**
```typescript
async function processUserQuery(query: string) {
  // Layer 2: Intelligent Context Pipeline
  const semanticResults = await semanticSearch.search(query);
  const graphContext = await semanticGraph.expand(semanticResults);  
  const treeAnalysis = await treeNavigator.analyze(graphContext);
  
  // Layer 3: Tools & Learning
  const selectedTools = await claude.selectTools(treeAnalysis);
  const results = await toolExecutor.execute(selectedTools);
  await databaseUpdater.updateAll(results); // ALL tools learn
}
```

3. **Professional Session Management**
```typescript
// Use existing session tracking
const session = {
  sessionId: generateSessionId(),
  projectPath: process.cwd(),
  config: { tokenBudget: 4000, smartSelection: true }
};

cliLogger.sessionStart(session.sessionId, session.projectPath, session.config);
```

## Performance Characteristics

- **Semantic Search**: ~200ms (cached: ~10ms)
- **Graph Expansion**: ~150ms (depth 3)  
- **Tree Navigation**: ~100ms (AST analysis)
- **Tool Selection**: ~50ms (Claude API)
- **Tool Execution**: ~500-2000ms (varies by tool)
- **Database Updates**: ~100ms (parallel writes)

**Total Pipeline**: ~1-3 seconds for comprehensive analysis

## Error Handling & Fallbacks

- **Semantic Search Failure**: Fall back to keyword-based search
- **Graph Unavailable**: Use file-based dependency analysis  
- **AST Errors**: Skip tree analysis, use file-level importance
- **Tool Failures**: Continue with successful tools, log failures
- **Database Issues**: Continue execution, queue updates for retry

This architecture ensures CodeMind provides the most intelligent, context-aware assistance possible while maintaining the interactive, professional experience users expect from a Claude Code-like interface.