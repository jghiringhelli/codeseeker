# CodeMind System Architecture Diagrams

## 🏗️ Complete System Architecture

```mermaid
graph TB
    subgraph "User Interface"
        CLI[CodeMind CLI]
        WEB[Web Dashboard]
    end
    
    subgraph "Orchestration Layer"
        ORCH[Intelligent Task Orchestrator]
        DISC[Three-Phase Discovery Engine]
        SYNC[File Synchronization System]
    end
    
    subgraph "Discovery Phases"
        P1[Phase 1: Semantic Search<br/>Vector Embeddings]
        P2[Phase 2: Semantic Graph<br/>Relationship Analysis]  
        P3[Phase 3: Tree Traversal<br/>Code Structure]
    end
    
    subgraph "Task Management"
        SPLIT[Task Splitting Engine]
        CTX[Context Window Manager]
        EXEC[Execution Planner]
    end
    
    subgraph "Storage Layer"
        PG[(PostgreSQL + pgvector<br/>File Index + Embeddings)]
        NEO[(Neo4j<br/>Semantic Graph)]
        FS[File System<br/>Hash Cache]
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API<br/>Embeddings]
        CLAUDE[Claude<br/>Code Generation]
    end
    
    CLI --> ORCH
    WEB --> ORCH
    ORCH --> DISC
    DISC --> P1
    P1 --> P2
    P2 --> P3
    P3 --> SPLIT
    SPLIT --> CTX
    CTX --> EXEC
    EXEC --> CLAUDE
    
    ORCH --> SYNC
    SYNC --> PG
    SYNC --> NEO
    SYNC --> FS
    
    P1 --> PG
    P1 --> OPENAI
    P2 --> NEO
    P3 --> PG
    
    CLAUDE --> SYNC
```

## 🔄 Three-Phase Discovery Flow

```mermaid
sequenceDiagram
    participant User
    participant Orchestrator
    participant SemanticSearch
    participant SemanticGraph  
    participant TreeTraversal
    participant TaskSplitter
    participant Claude
    
    User->>Orchestrator: "Add OAuth to authentication"
    
    Note over Orchestrator: Phase 1: Semantic Search
    Orchestrator->>SemanticSearch: Find similar files
    SemanticSearch->>SemanticSearch: Generate query embedding
    SemanticSearch->>PostgreSQL: Vector similarity search
    PostgreSQL-->>SemanticSearch: auth.ts, user.ts, crypto.ts
    SemanticSearch-->>Orchestrator: Primary files (3)
    
    Note over Orchestrator: Phase 2: Graph Expansion
    Orchestrator->>SemanticGraph: Expand relationships
    SemanticGraph->>Neo4j: Find related nodes
    Neo4j-->>SemanticGraph: Dependencies, tests, configs
    SemanticGraph-->>Orchestrator: All related files (12)
    
    Note over Orchestrator: Phase 3: Tree Analysis
    Orchestrator->>TreeTraversal: Analyze code structure
    TreeTraversal->>TreeTraversal: Extract classes/functions
    TreeTraversal-->>Orchestrator: Code elements map
    
    Note over Orchestrator: Task Orchestration
    Orchestrator->>TaskSplitter: Create execution plan
    TaskSplitter->>TaskSplitter: Split by layers & context size
    TaskSplitter-->>Orchestrator: 8 optimized tasks
    
    loop For each task
        Orchestrator->>Claude: Execute task with focused context
        Claude-->>Orchestrator: Code changes
        Orchestrator->>FileSyncSystem: Update indexes
    end
    
    Orchestrator-->>User: All changes completed
```

## 📁 File Synchronization Architecture

```mermaid
graph TD
    subgraph "File System"
        FILES[Project Files]
        CACHE[.codemind/file-hashes.json]
    end
    
    subgraph "Sync Engine"
        MONITOR[File Monitor]
        HASHER[Hash Calculator]
        COMPARATOR[Change Detector]
        UPDATER[Index Updater]
    end
    
    subgraph "Index Storage"
        FILE_IDX[File Index Table<br/>PostgreSQL]
        EMBED_IDX[Embeddings Table<br/>pgvector]
        GRAPH_IDX[Graph Nodes<br/>Neo4j]
    end
    
    FILES --> MONITOR
    MONITOR --> HASHER
    HASHER --> CACHE
    CACHE --> COMPARATOR
    COMPARATOR --> UPDATER
    
    UPDATER --> FILE_IDX
    UPDATER --> EMBED_IDX
    UPDATER --> GRAPH_IDX
    
    FILE_IDX -.->|Content Retrieval| MONITOR
    EMBED_IDX -.->|Vector Search| MONITOR
    GRAPH_IDX -.->|Relationship Query| MONITOR
```

## 🎯 Task Orchestration Model

```mermaid
graph TB
    subgraph "Discovery Results"
        FILES[Discovered Files<br/>25 files total]
    end
    
    subgraph "Impact Categorization"
        CORE[Core Logic<br/>auth.ts, user.ts]
        DATA[Data Layer<br/>schema.sql, migrations]
        API[API Layer<br/>routes.ts, controllers]
        UI[UI Layer<br/>components, views]
        TEST[Test Layer<br/>unit, integration tests]
        CONFIG[Config Layer<br/>oauth-config.json]
        DEPLOY[Deployment<br/>docker, ci/cd]
        DOCS[Documentation<br/>README, docs]
    end
    
    subgraph "Task Creation"
        T1[Task 1: Core Logic<br/>Priority 10, 2000 tokens]
        T2[Task 2: Data Layer<br/>Priority 9, 1500 tokens]
        T3[Task 3: API Layer<br/>Priority 8, 2500 tokens]
        T4[Task 4: UI Layer<br/>Priority 7, 2000 tokens]
        T5[Task 5: Test Layer<br/>Priority 6, 3000 tokens]
        T6[Task 6: Config<br/>Priority 5, 1000 tokens]
        T7[Task 7: Deployment<br/>Priority 4, 800 tokens]
        T8[Task 8: Documentation<br/>Priority 3, 500 tokens]
    end
    
    subgraph "Execution Plan"
        SEQ[Sequential: T1→T2→T3→T4]
        PAR1[Parallel: T1,T6]
        PAR2[Parallel: T5,T8]
    end
    
    FILES --> CORE
    FILES --> DATA
    FILES --> API
    FILES --> UI
    FILES --> TEST
    FILES --> CONFIG
    FILES --> DEPLOY
    FILES --> DOCS
    
    CORE --> T1
    DATA --> T2
    API --> T3
    UI --> T4
    TEST --> T5
    CONFIG --> T6
    DEPLOY --> T7
    DOCS --> T8
    
    T1 --> SEQ
    T2 --> SEQ
    T3 --> SEQ
    T4 --> SEQ
    T5 --> PAR2
    T6 --> PAR1
    T8 --> PAR2
```

## 🗄️ Database Schema Overview

```mermaid
erDiagram
    PROJECTS ||--o{ FILE_INDEX : contains
    PROJECTS ||--o{ CODE_EMBEDDINGS : has
    PROJECTS ||--o{ TOOL_DATA : analyzed_by
    
    PROJECTS {
        uuid id PK
        string name
        string project_path
        string project_type
        jsonb metadata
        timestamp created_at
    }
    
    FILE_INDEX {
        uuid id PK
        uuid project_id FK
        string file_path
        text content
        string content_hash
        integer file_size
        string language
        string content_type
        timestamp last_modified
    }
    
    CODE_EMBEDDINGS {
        uuid id PK  
        uuid project_id FK
        string file_path
        string content_type
        text content_text
        string content_hash
        vector_1536 embedding
        jsonb metadata
    }
    
    TOOL_DATA {
        uuid id PK
        uuid project_id FK
        string tool_name
        jsonb analysis_result
        timestamp created_at
    }
    
    SEMANTIC_SEARCH_QUERIES {
        uuid id PK
        uuid project_id FK
        string query_text
        vector_1536 query_embedding
        jsonb results
        timestamp created_at
    }
```

## 🌊 Data Flow Architecture

```mermaid
graph LR
    subgraph "Input Layer"
        USER[User Query]
        FILES[File Changes]
    end
    
    subgraph "Processing Layer"  
        DISCOVERY[Three-Phase Discovery]
        ORCHESTRATION[Task Orchestration]
        SYNC[File Synchronization]
    end
    
    subgraph "Intelligence Layer"
        VECTOR[Vector Search Engine]
        GRAPH[Graph Relationship Engine]
        TREE[Tree Structure Engine]
        CONTEXT[Context Optimization Engine]
    end
    
    subgraph "Storage Layer"
        POSTGRES[(PostgreSQL)]
        NEO4J[(Neo4j)]
        FILESYSTEM[(File System)]
    end
    
    subgraph "Output Layer"
        TASKS[Orchestrated Tasks]
        CLAUDE[Claude Execution]
        RESULTS[Code Changes]
    end
    
    USER --> DISCOVERY
    FILES --> SYNC
    
    DISCOVERY --> VECTOR
    DISCOVERY --> GRAPH
    DISCOVERY --> TREE
    
    ORCHESTRATION --> CONTEXT
    
    VECTOR <--> POSTGRES
    GRAPH <--> NEO4J
    TREE <--> POSTGRES
    SYNC <--> POSTGRES
    SYNC <--> NEO4J
    SYNC <--> FILESYSTEM
    
    DISCOVERY --> ORCHESTRATION
    ORCHESTRATION --> TASKS
    TASKS --> CLAUDE
    CLAUDE --> RESULTS
    RESULTS --> SYNC
```

## 🔧 Component Dependencies

```mermaid
graph TB
    subgraph "Core Components"
        ORCHESTRATOR[Intelligent Task Orchestrator]
        FILE_DISCOVERY[Hybrid File Discovery]
        FILE_SYNC[File Synchronization System]
        TASK_SPLITTER[Task Splitting Engine]
    end
    
    subgraph "Discovery Components"
        SEMANTIC_SEARCH[Semantic Search Tool]
        SEMANTIC_GRAPH[Semantic Graph Service]
        TREE_NAVIGATOR[Tree Navigator]
    end
    
    subgraph "Storage Components"
        TOOL_DB_API[Tool Database API]
        CONTEXT_PROVIDER[Enhanced Context Provider]
    end
    
    subgraph "CLI Components"
        CLI_MAIN[Main CLI]
        TOOL_SELECTOR[Tool Selector]
        LOGGER[CLI Logger]
    end
    
    ORCHESTRATOR --> FILE_DISCOVERY
    ORCHESTRATOR --> TASK_SPLITTER
    FILE_DISCOVERY --> SEMANTIC_SEARCH
    FILE_DISCOVERY --> SEMANTIC_GRAPH
    FILE_DISCOVERY --> TREE_NAVIGATOR
    
    SEMANTIC_SEARCH --> TOOL_DB_API
    SEMANTIC_GRAPH --> NEO4J
    TREE_NAVIGATOR --> TOOL_DB_API
    
    TASK_SPLITTER --> CONTEXT_PROVIDER
    CONTEXT_PROVIDER --> TOOL_SELECTOR
    
    FILE_SYNC --> TOOL_DB_API
    CLI_MAIN --> ORCHESTRATOR
    CLI_MAIN --> FILE_SYNC
    
    all_components --> LOGGER
```

This comprehensive architecture enables CodeMind to act as an intelligent development orchestrator, understanding entire codebases and coordinating changes across all layers of modern software projects. 🚀