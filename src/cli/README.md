# Layer 1: CLI - Core Intelligence Engine

The CLI layer is the core intelligence engine that provides direct user interaction with comprehensive semantic analysis. Every query processed through this layer receives the full three-layer internal pipeline.

## Architecture

```
Layer 1 (CLI) - Core Intelligence Engine
    ├── Semantic Search (pgvector similarity)
    ├── Graph Expansion (Neo4j relationships) 
    ├── Tree Navigation (AST analysis)
    ├── Tool Selection (AI-driven)
    └── Universal Learning (all databases)
```

## Key Components

- **`codeseeker-unified-cli.ts`**: Main interactive CLI with full workflow
- **`claude-integration.ts`**: Claude Code integration and context optimization
- **`enhanced-tool-selector.ts`**: AI-powered tool selection system
- **`context-optimizer.ts`**: Token-efficient context management
- **`container-manager.ts`**: Docker deployment management

## Features

- **Interactive Interface**: Professional CLI with inquirer.js prompts
- **Semantic Search**: pgvector-powered similarity search across codebase
- **Graph Analysis**: Neo4j relationship traversal and pattern discovery
- **AI Integration**: Seamless Claude Code workflow enhancement
- **Project Management**: Complete project initialization and configuration
- **Multi-Database**: Coordinated updates across all storage systems

## Usage

The CLI can be used directly for individual queries or called by higher layers (Orchestrator/Planner) for step-by-step execution. Every interaction benefits from the full semantic analysis pipeline regardless of the calling layer.