# CodeMind Core Cycle - Architecture Diagram

## Overview
This diagram shows the complete CodeMind Core Cycle workflow, the main orchestrator classes that handle each step, and their database connections using professional Mermaid diagrams.

## Main Workflow Architecture

```mermaid
flowchart TD
    %% User Input
    User["👤 User Request<br/>Natural Language Input<br/>'add auth to API routes'"]

    %% Main Orchestrator
    MainOrch["🎯 CodeMindWorkflowOrchestrator<br/>Main Coordinator"]

    %% Step 1: Intent Analysis
    IntentSvc["🧠 IntentAnalysisService<br/>• analyzeIntentAndSelectTools<br/>• mapComplexity<br/>• suggestTools<br/>• assessRisk"]
    ClaudeInt["🤖 ClaudeCodeIntegration<br/>• detectUserIntentSimple"]

    %% Step 2: Context Gathering
    ContextSvc["📊 ContextGatheringService<br/>• gatherSemanticContext<br/>• buildEnhancedContext<br/>• optimizeContextForTokens"]
    SemanticEng["🔍 SemanticEnhancementEngine<br/>• enhanceUserQuery"]

    %% Step 3: Git Operations
    GitSvc["🌿 GitWorkflowService<br/>• createFeatureBranch<br/>• ensureCleanWorkingDir<br/>• getBranchStatus"]
    GitMgr["📝 GitBranchManager<br/>• createBranch<br/>• checkoutBranch"]

    %% Step 4: Task Orchestration
    TaskSvc["🔪 TaskOrchestrationService<br/>• splitIntoSubTasks<br/>• processAllSubTasks<br/>• executeSubTask"]
    TaskDec["📋 TaskDecomposer<br/>• decomposeRequest"]
    TaskExec["⚡ TaskExecutor<br/>• executeTask"]

    %% Step 5: Quality Assurance
    QualSvc["🔍 QualityAssuranceService<br/>• runQualityChecks<br/>• validateCompilation<br/>• checkCodeQuality"]
    QualMgr["📊 QualityToolManager<br/>• runCompilationCheck<br/>• runSOLIDAnalysis<br/>• runSecurityAnalysis"]
    ValCycle["✅ CodeMindValidationCycle<br/>• executeValidationCycle<br/>• runCoreSafetyChecks"]

    %% Step 6: Database Sync
    DBSvc["💾 DatabaseSyncService<br/>• updateAllDatabases<br/>• updateNeo4jGraph<br/>• updateRedisCache"]
    DBMgr["🗄️ DatabaseUpdateManager<br/>• updateGraphDatabase<br/>• updateMainDatabase"]

    %% Databases
    PostgreSQL[("📊 PostgreSQL<br/>Primary Database<br/>• semantic_search_embeddings<br/>• project_files<br/>• analysis_results")]
    Neo4j[("🔗 Neo4j<br/>Graph Database<br/>• code_relationships<br/>• dependency_graph<br/>• component_hierarchy")]
    Redis[("⚡ Redis<br/>Cache Database<br/>• sessions<br/>• temp_data<br/>• file_cache")]

    %% Flow connections
    User --> MainOrch
    MainOrch --> IntentSvc
    IntentSvc --> ClaudeInt
    MainOrch --> ContextSvc
    ContextSvc --> SemanticEng
    MainOrch --> GitSvc
    GitSvc --> GitMgr
    MainOrch --> TaskSvc
    TaskSvc --> TaskDec
    TaskSvc --> TaskExec
    TaskExec --> ClaudeInt
    MainOrch --> QualSvc
    QualSvc --> QualMgr
    QualSvc --> ValCycle
    MainOrch --> DBSvc
    DBSvc --> DBMgr

    %% Database connections
    ContextSvc -.->|reads| PostgreSQL
    ContextSvc -.->|reads| Neo4j
    DBSvc -.->|updates| PostgreSQL
    DBSvc -.->|updates| Neo4j
    DBSvc -.->|updates| Redis

    %% Styling
    classDef serviceClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef dbClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef mainClass fill:#fff3e0,stroke:#e65100,stroke-width:3px
    classDef userClass fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px

    class MainOrch mainClass
    class User userClass
    class IntentSvc,ContextSvc,GitSvc,TaskSvc,QualSvc,DBSvc serviceClass
    class ClaudeInt,SemanticEng,GitMgr,TaskDec,TaskExec,QualMgr,ValCycle,DBMgr serviceClass
    class PostgreSQL,Neo4j,Redis dbClass
```

## 8-Step Workflow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Orchestrator as 🎯 WorkflowOrchestrator
    participant Intent as 🧠 IntentAnalysisService
    participant Context as 📊 ContextGatheringService
    participant Git as 🌿 GitWorkflowService
    participant Task as 🔪 TaskOrchestrationService
    participant Quality as 🔍 QualityAssuranceService
    participant DB as 💾 DatabaseSyncService

    User->>Orchestrator: executeFeatureRequest("add auth to API routes")

    Note over Orchestrator: Step 1: Intent Analysis
    Orchestrator->>Intent: analyzeIntentAndSelectTools(request)
    Intent-->>Orchestrator: ProcessedIntent{complexity: medium, tools: [...]}

    Note over Orchestrator: Step 2: Context Gathering
    Orchestrator->>Context: gatherSemanticContext(query, intent)
    Context-->>Orchestrator: EnhancementContext{files: 15, relationships: 8}

    Note over Orchestrator: Step 3: Git Branch Creation
    Orchestrator->>Git: createFeatureBranch(workflowId, description)
    Git-->>Orchestrator: "codemind/workflow_123/add-auth"

    Note over Orchestrator: Step 4: Task Decomposition
    Orchestrator->>Task: splitIntoSubTasks(request, intent, context)
    Task-->>Orchestrator: SubTask[]{4 tasks identified}

    Note over Orchestrator: Step 5: Task Execution
    Orchestrator->>Task: processAllSubTasks(tasks, context)
    Task-->>Orchestrator: SubTaskResult[]{3/4 successful}

    Note over Orchestrator: Step 6: Quality Assurance
    Orchestrator->>Quality: runQualityChecks(results)
    Quality-->>Orchestrator: QualityResult{score: 88%, compilation: ✅}

    Note over Orchestrator: Step 7: Git Finalization
    Orchestrator->>Git: finalizeChanges(branch, quality, results)
    Git-->>Orchestrator: WorkflowResult{success: true, merged: true}

    Note over Orchestrator: Step 8: Database Sync
    Orchestrator->>DB: updateAllDatabases(files, context)
    DB-->>Orchestrator: DatabaseUpdates{neo4j: +12, postgres: +3, redis: +5}

    Orchestrator-->>User: WorkflowResult{success: true, quality: 88%}
```

## Service Dependencies and SOLID Architecture

```mermaid
graph TB
    subgraph "🏗️ SOLID Architecture Implementation"
        subgraph "Single Responsibility"
            SRP1["🧠 Intent Analysis"]
            SRP2["📊 Context Gathering"]
            SRP3["🌿 Git Operations"]
            SRP4["🔪 Task Orchestration"]
            SRP5["🔍 Quality Assurance"]
            SRP6["💾 Database Sync"]
        end

        subgraph "Interface Segregation"
            ISP1["IIntentAnalysisService"]
            ISP2["IContextGatheringService"]
            ISP3["IGitWorkflowService"]
            ISP4["ITaskOrchestrationService"]
            ISP5["IQualityAssuranceService"]
            ISP6["IDatabaseSyncService"]
        end

        subgraph "Dependency Inversion"
            DIP["🎯 WorkflowOrchestrator<br/>Depends on Abstractions"]
            DIP --> ISP1
            DIP --> ISP2
            DIP --> ISP3
            DIP --> ISP4
            DIP --> ISP5
            DIP --> ISP6
        end

        SRP1 -.-> ISP1
        SRP2 -.-> ISP2
        SRP3 -.-> ISP3
        SRP4 -.-> ISP4
        SRP5 -.-> ISP5
        SRP6 -.-> ISP6
    end

    subgraph "🔧 Validation Services (SOLID Refactored)"
        Val1["🛡️ CoreSafetyService"]
        Val2["📊 QualityValidationService"]
        Val3["📈 ValidationAggregatorService"]
        Val4["📋 ValidationReportService"]
        ValMain["✅ CodeMindValidationCycle"]

        ValMain --> Val1
        ValMain --> Val2
        ValMain --> Val3
        ValMain --> Val4
    end
```

## Database Connection Architecture

```mermaid
erDiagram
    WORKFLOW_ORCHESTRATOR ||--o{ CONTEXT_GATHERING_SERVICE : "coordinates"
    WORKFLOW_ORCHESTRATOR ||--o{ DATABASE_SYNC_SERVICE : "coordinates"

    CONTEXT_GATHERING_SERVICE ||--o{ POSTGRESQL : "reads from"
    CONTEXT_GATHERING_SERVICE ||--o{ NEO4J : "reads from"

    DATABASE_SYNC_SERVICE ||--o{ POSTGRESQL : "updates"
    DATABASE_SYNC_SERVICE ||--o{ NEO4J : "updates"
    DATABASE_SYNC_SERVICE ||--o{ REDIS : "updates"

    POSTGRESQL {
        string semantic_search_embeddings "Vector embeddings for search"
        string project_files "File metadata and content"
        string analysis_results "Historical analysis data"
        string projects "Project configuration"
    }

    NEO4J {
        string code_relationships "File dependencies"
        string dependency_graph "Component relationships"
        string component_hierarchy "Architecture mapping"
    }

    REDIS {
        string sessions "User sessions"
        string temp_data "Workflow state"
        string file_cache "Performance optimization"
    }
```

## Performance and Quality Metrics

```mermaid
gantt
    title CodeMind Workflow Performance Timeline
    dateFormat X
    axisFormat %S s

    section Intent Analysis
    Analyze User Intent    :a1, 0, 2s

    section Context Gathering
    Semantic Search        :a2, 2s, 5s

    section Git Operations
    Create Branch         :a3, 5s, 1s

    section Task Processing
    Decompose Tasks       :a4, 6s, 5s
    Execute Tasks         :a5, 11s, 20s

    section Quality Checks
    Run Validations       :a6, 31s, 10s

    section Finalization
    Git Operations        :a7, 41s, 2s
    Database Sync         :a8, 43s, 3s
```

## Database Connection Summary

### 📊 PostgreSQL (Primary Database)
**Connected by:** ContextGatheringService, DatabaseSyncService
**Tables:**
- `semantic_search_embeddings` - Vector embeddings for semantic search
- `project_files` - File metadata and analysis results
- `projects` - Project configuration and status
- `analysis_results` - Historical analysis data

### 🔗 Neo4j (Graph Database)
**Connected by:** ContextGatheringService, DatabaseSyncService
**Used for:**
- Code relationship mapping
- Dependency graph analysis
- Component hierarchy visualization
- Cross-file relationship tracking

### ⚡ Redis (Cache Database)
**Connected by:** ContextGatheringService, DatabaseSyncService
**Used for:**
- Session data caching
- Temporary workflow state
- File content caching
- Performance optimization

## SOLID Principles Implementation

✅ **Single Responsibility**: Each service has one clear responsibility
✅ **Open/Closed**: Services can be extended without modification
✅ **Liskov Substitution**: Services implement well-defined interfaces
✅ **Interface Segregation**: Focused interfaces for each service type
✅ **Dependency Inversion**: All dependencies injected via interfaces

## Refactoring Results

| Component | Original Lines | New Lines | Reduction |
|-----------|---------------|-----------|-----------|
| validation-cycle.ts | 805 | 33 | 96% |
| workflow-orchestrator.ts | 803 | 41 | 95% |
| **Total** | **1,608** | **74** | **95%** |

**Services Created:** 10 specialized services + 2 coordinators
**Interfaces Created:** 12 focused interfaces
**Architecture:** Full SOLID compliance achieved

## Performance Characteristics

- **Step 1-2**: ~2-5 seconds (semantic search + context)
- **Step 3**: ~0.5 seconds (git operations)
- **Step 4-5**: ~10-30 seconds (task execution, varies by complexity)
- **Step 6**: ~5-15 seconds (quality checks)
- **Step 7**: ~1-2 seconds (git finalization)
- **Step 8**: ~1-3 seconds (database sync)

**Total Workflow Time**: ~20-60 seconds depending on request complexity