# CLAUDE.md - CodeMind

This file provides comprehensive guidance to Claude Code when working with this project.

## Project Overview

**Project**: CodeMind
**Type**: api_service
**Description**: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
**Languages**: JavaScript, TypeScript
**Architecture**: Layered Architecture
**Testing Strategy**: Unit + Integration Testing
**Coding Standards**: Strict (ESLint/Prettier with custom rules)
**Project Intent**: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
**Business Value**: Provide reliable and scalable backend services
**Quality Requirements**: High Performance, High Reliability, Secure

## CodeMind Integration

This project uses the CodeMind Intelligent Code Auxiliary System for enhanced context and analysis.

### Token-Efficient API Usage

**Environment Setup:**
`powershell
$env:CODEMIND_API_URL = "http://localhost:3004"
$env:PROJECT_PATH = "C:\workspace\claude\CodeMind"
`

### Intelligent Context Patterns

#### Before Any Changes (Overview - ~200 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=overview"
`

#### Before Coding (Development Context - ~500 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=coding&maxTokens=800"
`

#### For Architecture Decisions (Detailed Analysis - ~1000 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=architecture&maxTokens=1500"
`

#### When Debugging (Error Context - ~600 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=debugging&maxTokens=1000"
`

#### For User Interaction (Smart Questions)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/suggest-questions/$env:PROJECT_PATH?maxQuestions=3"
`

### Project-Specific Workflow

1. **Start every session** with overview context to understand current state
2. **Before creating features** get coding context for patterns and standards
3. **For architectural changes** use architecture context for design guidance
4. **When debugging** use error context for common issues and solutions
5. **For user requirements** use smart questions to gather focused information

## CodeMind Core Cycle - WORKING ✅

**Status**: Fully implemented and tested (2025-11-15)

The CodeMind Core Cycle is the heart of the intelligent Claude Code enhancement system. When a user provides natural language input, CodeMind executes an 8-step workflow to enhance Claude Code's capabilities.

### How to Trigger the Core Cycle

Use natural language queries with CodeMind CLI:

```bash
# Example natural language queries that trigger the core cycle
codemind -c "add authentication middleware to the API routes"
codemind -c "create a new API endpoint for user registration"
codemind -c "can you help me understand what this project does"
codemind -c "implement error handling for database operations"
```

### The 8-Step Core Cycle

**1️⃣ Query Analysis**
- Analyzes user input for assumptions and ambiguities
- Detects intent (create, modify, analyze, etc.)
- Calculates confidence level
- Identifies potential clarification needs

**2️⃣ User Clarification (Optional)**
- Prompts user for clarification when assumptions/ambiguities detected
- Generates smart questions based on detected patterns
- Enhances the original query with user responses

**3️⃣ Semantic Search**
- Searches codebase for files relevant to the query
- Uses vector embeddings for semantic similarity
- Returns ranked list of relevant files with similarity scores

**4️⃣ Code Relationship Analysis**
- Analyzes relationships between relevant files
- Identifies classes, functions, and dependencies
- Maps package structure and component relationships

**5️⃣ Enhanced Context Building**
- Combines original query, clarifications, semantic results, and relationships
- Creates comprehensive context prompt for Claude Code
- Optimizes for token efficiency while maintaining completeness

**6️⃣ Claude Code Execution**
- Passes enhanced context to Claude Code CLI
- Falls back to simulation mode if Claude Code unavailable
- Captures Claude's response and recommendations

**7️⃣ File Modification Approval**
- Shows user which files Claude intends to modify
- Provides approval options: Yes, No, or "Don't ask again"
- Ensures user maintains control over code changes

**8️⃣ Execution Summary**
- Displays comprehensive summary of what was accomplished
- Shows analysis statistics (files found, relationships discovered, etc.)
- Provides performance metrics for the enhancement process

### Technical Implementation (SOLID Architecture)

The core cycle is implemented using SOLID principles with these services:

- **NaturalLanguageProcessor**: Query analysis and intent detection
- **SemanticSearchOrchestrator**: File discovery and relevance ranking
- **GraphAnalysisService**: Code relationship mapping
- **ContextBuilder**: Enhanced prompt generation
- **UserInteractionService**: User prompts and Claude Code execution
- **WorkflowOrchestrator**: Coordinates all services and manages the 8-step flow

### Example Core Cycle Output

```
🧠 Starting CodeMind workflow...

1️⃣ Analyzing query for assumptions and ambiguities...
   Intent: create (confidence: 85.0%)
   Assumptions detected: 1
   • Assuming REST API structure exists

2️⃣ Requesting user clarifications...
   [User clarification prompts appear here]

3️⃣ Performing semantic search...
   Found 3 relevant files

4️⃣ Analyzing code relationships...
   Found 2 relationships between components

5️⃣ Building enhanced context...
   Enhanced prompt: 926 characters

6️⃣ Executing Claude Code...
   [Claude Code execution with enhanced context]

7️⃣ Requesting file modification approval...
   [File modification confirmation dialog]

8️⃣ Displaying execution summary...
   📊 Analysis Statistics:
   • Files analyzed: 3
   • Relationships found: 2
   • Assumptions detected: 1
   • Clarifications provided: 1
```

### Key Benefits

- **Enhanced Context**: Claude gets much more relevant information about your codebase
- **Intelligent Analysis**: Automatically detects patterns and relationships
- **User Control**: Always confirms before making changes
- **Comprehensive Results**: Provides detailed feedback on what was accomplished
- **Token Optimization**: Maximizes information density while respecting token limits

### Smart Questions for User Interaction

When you need to gather requirements, consider asking:

- What specific coding patterns should I follow?
- How should I structure the test files?
- What quality metrics are most important?


## Development Guidelines

### Architecture Principles
- Follow Layered Architecture patterns consistently
- Use the coding context API before creating new components
- Validate architectural decisions with the architecture context endpoint

### Testing Approach
- Implement Unit + Integration Testing
- Use debugging context when tests fail
- Check existing test patterns before adding new ones

### Code Quality Standards
- Maintain Strict (ESLint/Prettier with custom rules)
- Use smart questions to clarify quality requirements
- Project Intent: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
- Quality Focus: High Performance, High Reliability, Secure

### SOLID Principles Requirements
**CRITICAL**: All new code MUST follow SOLID principles:
- **S**ingle Responsibility: Each class/function has one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Derived classes must be substitutable for base classes
- **I**nterface Segregation: Clients shouldn't depend on interfaces they don't use
- **D**ependency Inversion: Depend on abstractions, not concretions

**Implementation Guidelines:**
- Use dependency injection patterns
- Create focused, single-purpose classes
- Implement proper interfaces and abstractions
- Avoid tight coupling between components
- Follow the established three-layer architecture (CLI/Orchestrator/Shared)

**SOLID Architecture Refactoring Completed** (2025-11-15):
The command routing system has been fully refactored to follow SOLID principles:
- ✅ **CommandRouter**: Reduced from 921 lines to ~200 lines, focused only on routing
- ✅ **Service Layer**: Created 6 focused services following single responsibility principle
- ✅ **Dependency Injection**: Implemented constructor injection for all dependencies
- ✅ **Interface Segregation**: Created specific interfaces for each service contract
- ✅ **Workflow Orchestration**: Complete 8-step natural language processing pipeline

**Service Architecture:**
```
src/cli/commands/services/
├── natural-language-processor.ts    # Query analysis and intent detection
├── semantic-search-orchestrator.ts  # File discovery and relevance ranking
├── graph-analysis-service.ts        # Code relationship mapping
├── context-builder.ts               # Enhanced prompt generation
├── user-interaction-service.ts      # User prompts and Claude Code execution
└── workflow-orchestrator.ts         # Master coordinator service
```

### Class Naming Convention Enforcement
**MANDATORY**: All classes MUST follow dash-style naming in file names:
- **File names**: Use dash-style (kebab-case): `quality-checker.ts`, `project-manager.ts`
- **Class names**: Use PascalCase: `QualityChecker`, `ProjectManager`
- **NO duplicates**: Never create multiple classes with similar names (e.g., `quality-checker` and `QualityChecker`)
- **Merge duplicates**: When found, merge into the most comprehensive version
- **Examples**:
  - ✅ Correct: `quality-checker.ts` exports `class QualityChecker`
  - ❌ Wrong: `QualityChecker.ts` or multiple quality checker files
  - ❌ Wrong: `qualityChecker.ts` (camelCase files)

**Duplicate Detection and Resolution:**
- Search for similar class names before creating new ones
- Merge functionality from duplicate files into the most comprehensive version
- Delete the less comprehensive duplicate
- Update all imports to reference the single merged class

### CodeMind CLI Integration
**IMPORTANT**: After major codebase changes, CodeMind needs relinking:
```bash
# Relink CodeMind for Claude Code access
npm run build
npm link

# Verify global access
codemind --help
```

**When to Relink:**
- After fixing compilation errors
- After restructuring imports/exports
- After adding new CLI features
- After updating the bin entry point

### Integration Notes

- All CodeMind API calls are cached for 5 minutes
- Context responses are optimized for token efficiency
- Different intents provide focused information for specific tasks
- The system learns from your project patterns over time

**Setup completed**: 2025-08-27 12:37
**Integration**: Interactive Enhanced Setup v2.0 (PowerShell)
**Resume Token**: 

## Docker Best Practices for CodeMind

When working with CodeMind Docker containers, ALWAYS follow these practices:

### Container Management Rules
1. **Consistent Naming**: Always use the same container names (e.g., `codemind-dashboard`, `codemind-api`)
2. **Clean Before Rebuild**: Stop and remove old containers/images before rebuilding
3. **Volume Consistency**: Maintain the same volume mappings to preserve data
4. **Image Refresh**: Always rebuild images when code changes

### Standard Docker Workflow
```powershell
# 1. Stop and remove old containers
docker stop codemind-dashboard
docker rm codemind-dashboard

# 2. Remove old images (keep volumes)
docker rmi codemind-dashboard:latest

# 3. Rebuild with latest code
docker-compose build dashboard --no-cache

# 4. Start with consistent volumes
docker-compose up dashboard -d
```

### Volume Management
- **Preserve**: Database volumes, configuration, logs
- **Refresh**: Application code, temporary files
- **Consistent**: Use same mount points across rebuilds

### Health Checks
- Always verify container health after restart
- Check logs for connection issues
- Validate all database connections before testing

## File System Accessibility for Dashboards

**CRITICAL**: When running the CodeMind dashboard in Docker or on a remote server, it may not be able to access project files on the local machine.

### Automatic Detection
The dashboard automatically checks file system accessibility and shows warnings when:
- 🐳 **Docker Container**: Cannot access host file system without volume mapping
- 🌐 **Remote Server**: Dashboard running on different machine than project files
- 📂 **Permissions**: File system access denied or path invalid
- ⚠️ **Path Issues**: Directory doesn't exist or isn't a valid project

### Warning System
The enhanced dashboard shows prominent warnings with:
- **Issue Detection**: Identifies the specific problem (Docker, remote, permissions)
- **Server Information**: Shows where dashboard is running vs where files should be
- **Step-by-Step Solutions**: Provides exact commands to fix the issue
- **Recheck Functionality**: Allows testing after applying fixes

### Common Solutions

#### For Docker Deployments
```bash
# Stop container
docker stop codemind-dashboard

# Add volume mapping to docker-compose.yml
services:
  dashboard:
    volumes:
      - "/local/project/path:/app/projects/project-name"

# Restart with new volume
docker-compose up dashboard -d
```

#### For Remote Server Deployments
- **NFS/SMB Mount**: Mount project directory on server
- **File Sync**: Use rsync, scp, or git to sync files
- **Local Development**: Run dashboard locally where files exist
- **SSH Tunneling**: Forward local files through SSH

### Best Practices
- **Always Check**: Verify file accessibility before running analysis
- **Volume Consistency**: Use same mount paths across rebuilds
- **Path Validation**: Ensure project paths are correct in database
- **Access Monitoring**: Monitor file system warnings in dashboard

## Important Development Reminders

### SOLID Principles Enforcement
**MANDATORY**: ALL NEW CODE MUST FOLLOW SOLID PRINCIPLES:
- **Single Responsibility**: One class, one purpose
- **Open/Closed**: Extend behavior without modifying existing code
- **Liskov Substitution**: Subclasses must be interchangeable with parent classes
- **Interface Segregation**: Create specific interfaces, not monolithic ones
- **Dependency Inversion**: Depend on abstractions, not concrete implementations

### CodeMind CLI Relinking Requirements
After major changes to CodeMind codebase:
1. **Always run `npm run build`** to ensure TypeScript compilation
2. **Run `npm link`** to relink the global CLI command
3. **Test with `codemind --help`** to verify Claude Code can access it
4. **This is CRITICAL** after fixing compilation errors or restructuring imports

### File Creation Guidelines
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary for achieving the goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- NEVER create new versions of files with adjectives (no "file-enhanced.js", "file-improved.js", "file-v2.js")
- Always modify the existing file directly instead of creating variations

## Recursive Folder Organization Structure

**Updated**: 2025-10-28 - Implemented recursive folder organization following logical dependencies

### CLI Services Organization
CodeMind CLI services are now organized by functionality domain:

```
src/cli/services/
├── data/                      # Data processing and storage services
│   ├── embedding/             # Vector embeddings and semantic analysis
│   ├── semantic-graph/        # Neo4j graph management and queries
│   │   ├── builders/          # Node and relationship builders
│   │   └── parsers/           # Language-specific code parsers
│   ├── database/              # PostgreSQL database services
│   ├── content-processing/    # Content analysis and processing
│   ├── code-relationship-parser.ts
│   └── documentation-service.ts
├── analysis/                  # Code analysis and quality services
│   ├── deduplication/         # Duplicate code detection and consolidation
│   ├── solid/                 # SOLID principles analysis
│   └── user-intentions/       # LLM-based intention detection
├── search/                    # Search and discovery services
│   └── semantic-search/       # Vector-based semantic search
├── monitoring/                # System monitoring and tracking
│   ├── file-scanning/         # File discovery and type detection
│   ├── initialization/        # Project initialization tracking
│   └── file-watcher-service.ts
└── integration/               # External system integrations
    ├── workflow-integration/   # Claude Code workflow enhancement
    └── codemind-instruction-service.ts
```

### CLI Features Organization
Features are grouped by functional domain:

```
src/cli/features/
├── analysis/                  # Code analysis features
│   ├── code-graph/           # Complete code graph building
│   ├── duplication/          # Duplication detection
│   ├── solid-principles/     # SOLID analysis
│   └── centralization/       # Code centralization detection
├── search/                   # Search and navigation features
│   ├── search/               # Semantic search capabilities
│   ├── tree-navigation/      # Project tree navigation
│   └── ui-navigation/        # UI component navigation
├── quality/                  # Quality and verification
│   ├── compilation/          # Code compilation verification
│   └── use-cases/           # Use case analysis
└── data/                    # Data management features
    ├── database/            # Database schema and documentation
    ├── documentation/       # Documentation analysis
    └── semantic-graph/      # Semantic graph tools
```

### Shared Services Organization
Shared services follow responsibility-based organization:

```
src/shared/
├── core/                    # Core shared functionality (future)
├── data/                    # Data management (future)
├── intelligence/            # AI and smart features (future)
├── analysis/                # Analysis systems (future)
├── integration/             # Integration support (future)
├── tools/                   # Tool management (future)
├── cache/                   # Caching systems (future)
└── managers/                # Service managers
    ├── semantic-search-manager.ts
    ├── git-branch-manager.ts
    ├── cache-manager.ts
    ├── container-manager.ts
    └── database-update-manager.ts
```

### Benefits of New Structure
1. **Logical Grouping**: Related functionality is grouped together
2. **Clear Dependencies**: Folder structure reflects dependency hierarchy
3. **Easier Navigation**: Find related files quickly
4. **Scalability**: Easy to add new functionality to appropriate domains
5. **Maintenance**: Clear separation of concerns

### Import Path Changes
After reorganization, import paths have been updated:
- `../services/embedding/` → `../services/data/embedding/`
- `../services/deduplication/` → `../services/analysis/deduplication/`
- `../services/semantic-search/` → `../services/search/semantic-search/`
- `../services/file-scanner/` → `../services/monitoring/file-scanning/`
