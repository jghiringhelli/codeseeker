# CLAUDE.md - CodeSeeker

This file provides comprehensive guidance to Claude Code when working with this project.

## Project Overview

**Project**: CodeSeeker
**Type**: api_service
**Description**: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
**Languages**: JavaScript, TypeScript
**Architecture**: Layered Architecture
**Testing Strategy**: Unit + Integration Testing
**Coding Standards**: Strict (ESLint/Prettier with custom rules)
**Project Intent**: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
**Business Value**: Provide reliable and scalable backend services
**Quality Requirements**: High Performance, High Reliability, Secure

## Claude Code Integration Architecture

**CRITICAL**: CodeSeeker uses ONLY direct Claude Code CLI integration - NO APIs.

### Main Coordination Class
All Claude Code interactions are coordinated through:
**`ClaudeCodeIntegration`** (`src/integrations/claude/claude-cli-integration.ts`)

This class provides:
- `executeClaudeCode(prompt, context, options)` - Direct CLI execution
- `analyzeProject(projectPath, resumeToken)` - Project analysis
- `processRequest(userRequest, projectPath, options)` - User request processing

### CLI-Only Approach
- **NO fetch() calls** to external APIs
- **NO HTTP requests** to Claude API
- **Direct CLI execution** only via child_process.exec()
- **All AI processing** goes through `claude` CLI command
- **Fallback transparency**: When Claude CLI fails, CodeSeeker becomes transparent passthrough

### Integration Points
- UserInteractionService → ClaudeCodeIntegration.executeClaudeCode()
- Semantic Search → Local database + ClaudeCodeIntegration analysis
- Graph Analysis → Local Neo4j + ClaudeCodeIntegration processing
- Workflow Orchestrator → ClaudeCodeIntegration.processRequest()

**Reference this class everywhere Claude Code interaction is needed.**

### CLI-Only Workflow Patterns

#### Direct Claude Code Execution
```typescript
const claudeIntegration = new ClaudeCodeIntegration();

// For any Claude Code interaction:
const result = await claudeIntegration.executeClaudeCode(
  "Your prompt here",
  "Additional context",
  { projectPath: process.cwd() }
);
```

#### Project Analysis
```typescript
// Analyze entire project
const analysis = await claudeIntegration.analyzeProject("/path/to/project");
```

#### User Request Processing
```typescript
// Process user requests through complete pipeline
const response = await claudeIntegration.processRequest(
  "user request here",
  "/path/to/project",
  { maxTokens: 4000 }
);
```

#### Error Handling Pattern
```typescript
try {
  const result = await claudeIntegration.executeClaudeCode(prompt, context);
  // Process successful result
} catch (error) {
  // Fallback to transparent mode - direct CLI passthrough
  console.warn('Claude integration unavailable, using direct mode');
  // Continue with local-only processing
}
```

### Project-Specific Workflow

1. **All AI interactions** route through `ClaudeCodeIntegration` class
2. **Semantic search** uses local database + Claude CLI analysis (no API calls)
3. **Graph analysis** uses local Neo4j + Claude CLI processing (no API calls)
4. **User clarifications** use `ClaudeCodeIntegration.processRequest()`
5. **Fallback strategy**: When CLI fails → transparent passthrough mode
6. **Error handling**: Always provide local fallback options

## Dynamic Index Management

**Status**: Fully implemented (2025-12-31)

When Claude discovers files that shouldn't be indexed (like Unity's Library folder, build outputs, or generated files), use the `manage_index` MCP tool to dynamically exclude them:

### Usage Examples

```typescript
// Exclude files/patterns - removes from index immediately
manage_index({
  action: "exclude",
  project: "my-project",
  paths: ["Library/**", "Temp/**", "*.generated.cs"],
  reason: "Build artifacts and generated files"
})

// List current exclusions
manage_index({
  action: "list",
  project: "my-project"
})

// Re-include previously excluded files (requires reindex to take effect)
manage_index({
  action: "include",
  project: "my-project",
  paths: ["Library/**"]
})
```

### How It Works

1. **Exclusion**: Files matching patterns are immediately deleted from the vector store
2. **Persistence**: Exclusions saved to `.codeseeker/exclusions.json`
3. **Reindexing**: User exclusions are respected during `index_project` and `notify_file_changes(full_reindex: true)`
4. **Glob Patterns**: Supports `**` (any path), `*` (any segment), `?` (any char)

### When to Use

- Unity projects: `Library/**`, `Temp/**`, `Logs/**`
- Build outputs: `dist/**`, `build/**`, `out/**`
- Generated code: `*.generated.cs`, `*.g.cs`
- Large binary assets: `*.asset`, `*.prefab` (if indexed by mistake)

## Auto-Detected Coding Standards - NEW ✨

**Status**: Fully implemented (2025-12-28)

CodeSeeker automatically detects and generates coding standards from your indexed codebase, helping Claude write code that follows your project's conventions.

### How It Works

1. **Pattern Detection**: During `codeseeker init`, CodeSeeker analyzes indexed code to identify common patterns
2. **Standards File**: Auto-generates `.codeseeker/coding-standards.json` with detected patterns
3. **Incremental Updates**: Standards update automatically when pattern-related files change
4. **MCP Integration**: New `get_coding_standards` MCP tool exposes standards to Claude
5. **CLI Integration**: Standards can be queried via natural language commands

### Pattern Categories

CodeSeeker detects patterns in four categories:

| Category | Examples | Detection Method |
|----------|----------|------------------|
| **Validation** | `validator.isEmail()`, email regex, `Joi.string().email()` | Searches for validation keywords, analyzes usage frequency |
| **Error Handling** | `res.status().json({error})`, custom Error classes, try-catch patterns | Detects error handling patterns and response structures |
| **Logging** | `console.log`, `logger.info/error/warn` (Winston/Bunyan) | Identifies logging approaches and structured logging |
| **Testing** | `beforeEach` setup, `expect().toBe` assertions | Finds test framework patterns and assertion styles |

### Standards File Format

```json
{
  "generated_at": "2025-12-28T10:30:00.000Z",
  "project_id": "abc123",
  "project_path": "/path/to/project",
  "standards": {
    "validation": {
      "email": {
        "preferred": "validator.isEmail()",
        "import": "const validator = require('validator');",
        "usage_count": 5,
        "files": ["src/auth.ts", "src/user.ts"],
        "confidence": "high",
        "rationale": "Project standard - uses validator library in 5 files. Battle-tested validation with comprehensive edge case handling.",
        "example": "if (!validator.isEmail(email)) { return res.status(400).json({ error: 'Invalid email' }); }",
        "alternatives": [
          {
            "pattern": "email-regex: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/",
            "usage_count": 2,
            "recommendation": "Consider using \"validator.isEmail()\" instead (5 vs 2 occurrences)"
          }
        ]
      }
    },
    "error-handling": { ... },
    "logging": { ... },
    "testing": { ... }
  }
}
```

### MCP Tool Usage

```typescript
// Claude can call this tool via MCP
get_coding_standards({
  project: "my-app",
  category: "validation"  // or "all", "error-handling", "logging", "testing"
})
```

**Response**: Returns the coding standards JSON with pattern recommendations, usage counts, confidence levels, and rationale.

### CLI Usage

Standards are automatically available when using natural language commands:

```bash
# CodeSeeker will use detected standards when implementing validation
codeseeker -c "add email validation to the registerUser function"
```

### Benefits

- **Consistency**: Claude uses the same patterns your project already uses
- **Auto-Learning**: No manual configuration - learns from your codebase
- **Evidence-Based**: Recommendations backed by usage frequency and file locations
- **Alternatives**: Shows alternative patterns with usage counts
- **Confidence Levels**: High (3+ uses), Medium (2 uses), Low (1 use)

### Implementation Files

- `src/cli/services/analysis/coding-patterns-analyzer.ts` - Pattern detection logic
- `src/cli/services/analysis/coding-standards-generator.ts` - Standards file generation
- `src/cli/commands/handlers/setup-command-handler.ts` - CLI integration (init time)
- `src/mcp/mcp-server.ts` - MCP tool + incremental updates

## CodeSeeker Core Cycle - WORKING ✅

**Status**: Fully implemented and tested (2025-11-15)

The CodeSeeker Core Cycle is the heart of the intelligent Claude Code enhancement system. When a user provides natural language input, CodeSeeker executes an 11-step workflow to enhance Claude Code's capabilities.

### How to Trigger the Core Cycle

Use natural language queries with CodeSeeker CLI:

```bash
# Example natural language queries that trigger the core cycle
codeseeker -c "add authentication middleware to the API routes"
codeseeker -c "create a new API endpoint for user registration"
codeseeker -c "can you help me understand what this project does"
codeseeker -c "implement error handling for database operations"
```

### The 11-Step Core Cycle (with Task Decomposition)

**1️⃣ Query Analysis**
- Analyzes user input for assumptions and ambiguities
- Detects intent (create, modify, analyze, etc.)
- Calculates confidence level
- Identifies potential clarification needs

**2️⃣ Task Decomposition**
- Detects if query is complex (multiple actions, numbered steps, etc.)
- Splits complex queries into focused sub-tasks
- Assigns task types (analyze, create, modify, test, etc.)
- Creates execution plan with dependency ordering

**3️⃣ User Clarification (Optional)**
- Prompts user for clarification when assumptions/ambiguities detected
- Generates smart questions based on detected patterns
- Enhances the original query with user responses

**4️⃣ Hybrid Search**
- Executes **true hybrid search** running multiple methods in parallel
- **Vector Similarity**: Semantic understanding via embeddings (weight: 50%)
- **Text Search**: MiniSearch (embedded) or PostgreSQL tsvector (server) with synonym expansion (weight: 35%)
- **File Path Matching**: Directory/filename pattern matching (weight: 15%)
- Results fused using Reciprocal Rank Fusion (RRF) for optimal ranking

**5️⃣ Code Relationship Analysis**
- Analyzes relationships between relevant files
- Identifies classes, functions, and dependencies
- Maps package structure and component relationships

**6️⃣ Sub-Task Context Generation**
- For complex queries: generates tailored context per sub-task
- Filters relevant files based on task type
- Applies context limits to optimize token usage

**7️⃣ Enhanced Context Building**
- Combines original query, clarifications, semantic results, and relationships
- Creates comprehensive context prompt for Claude Code
- Optimizes for token efficiency while maintaining completeness

**8️⃣ Claude Code Execution**
- For complex queries: executes each sub-task with tailored context
- For simple queries: executes directly with full context
- Aggregates responses from sub-tasks into coherent output

**9️⃣ File Modification Approval**
- Shows user which files Claude intends to modify
- Provides approval options: Yes, No, or "Don't ask again"
- Ensures user maintains control over code changes

**🔟 Build/Test Verification**
- Runs build to verify code compiles
- Runs tests to ensure no regressions
- Reports errors for user attention

**1️⃣1️⃣ Database Sync**
- Updates PostgreSQL semantic search embeddings
- Updates knowledge graph with new relationships
- Refreshes cache for modified files

### Technical Implementation (SOLID Architecture)

The core cycle is implemented using SOLID principles with these services:

- **NaturalLanguageProcessor**: Query analysis and intent detection
- **TaskDecompositionService**: Complex query splitting and sub-task context filtering
- **SemanticSearchOrchestrator**: Hybrid search (Vector + Text + Path) with RRF fusion
- **GraphAnalysisService**: Code relationship mapping via knowledge graph
- **ContextBuilder**: Enhanced prompt generation with token optimization
- **UserInteractionService**: User prompts and Claude Code execution
- **WorkflowOrchestrator**: Coordinates all services and manages the 11-step flow

### Example Core Cycle Output

```
🧠 Starting CodeSeeker workflow...

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

## Hybrid Search Architecture

**Updated**: 2025-12-25 - Vector + Text Search + Path with RRF fusion

The semantic search system uses a **true hybrid approach** that runs multiple search methods in parallel and merges results using Reciprocal Rank Fusion (RRF).

### Storage Modes

CodeSeeker supports two storage modes with different text search implementations:

| Mode | Vector Store | Text Search | When to Use |
|------|--------------|-------------|-------------|
| **Embedded** (default) | SQLite + cosine similarity | MiniSearch (BM25 + synonyms) | Local development, no Docker |
| **Server** | PostgreSQL + pgvector | PostgreSQL tsvector/tsquery | Production, team environments |

### Why Hybrid Search?

Different search methods excel at different query types:
- **Vector similarity** understands semantic meaning ("authentication" finds "login", "auth", "session")
- **Text search** handles exact terms and linguistic variations (stemming, word boundaries)
- **Path matching** finds files by name/location patterns

Combining all three with RRF fusion provides the best recall and precision.

### Search Methods (Run in Parallel)

1. **Vector Similarity**
   - Generates query embedding using transformer model
   - Uses cosine similarity against stored embeddings
   - Captures semantic meaning beyond exact keyword matches
   - Weight: **50%** in RRF fusion

2. **Text Search**
   - **Embedded mode**: MiniSearch with BM25 scoring, CamelCase tokenization, synonym expansion
   - **Server mode**: PostgreSQL tsvector/tsquery with GIN indexing
   - Includes synonym expansion (handler → controller, auth → authentication)
   - Weight: **35%** in RRF fusion

3. **File Path Matching**
   - Matches query terms against directory and file names
   - Pattern matching on file paths
   - Weight: **15%** in RRF fusion

### Reciprocal Rank Fusion (RRF) Algorithm

```typescript
const k = 60; // RRF constant

// For each search method, calculate RRF score based on result rank
vectorResults.forEach((result, rank) => {
  rrfScore = 0.50 / (k + rank + 1);  // Vector weight
});
textResults.forEach((result, rank) => {
  rrfScore = 0.35 / (k + rank + 1);  // Text search weight
});
pathResults.forEach((result, rank) => {
  rrfScore = 0.15 / (k + rank + 1);  // Path weight
});

// Files found by multiple methods get combined scores
// Final results sorted by total RRF score
```

### Database Schema

The `semantic_search_embeddings` table includes:
```sql
-- Vector embeddings (pgvector)
embedding VECTOR(384)  -- Stored embeddings for similarity search

-- Full-text search column
content_tsvector TSVECTOR  -- GIN-indexed for fast FTS

-- Content and metadata
content_text TEXT
file_path TEXT
metadata JSONB
```

### Key Files

- `src/database/semantic-search-schema.sql` - Vector embedding schema
- `src/cli/commands/services/semantic-search-orchestrator.ts` - Hybrid search implementation
- `src/cli/services/search/embedding-generator-adapter.ts` - Query embedding generation

## Task Decomposition Architecture - IMPLEMENTED ✅

**Status**: Fully implemented (2025-12-03)

CodeSeeker now includes intelligent task decomposition where complex queries are automatically split into focused sub-tasks, each receiving tailored context.

### How It Works

When you submit a complex query, CodeSeeker:

1. **Analyzes Task Complexity**: Detects patterns indicating multi-part requests
2. **Decomposes into Sub-tasks**: Splits into focused, atomic operations
3. **Filters Context per Sub-task**: Each sub-task gets only relevant files/relationships
4. **Executes Sequentially**: Runs sub-tasks respecting dependencies
5. **Aggregates Results**: Combines outputs into coherent response

### Complexity Detection Patterns

Queries are detected as complex if they contain:
- Conjunctions with sequencing: "and also", "then", "after", "before"
- Multiple distinct actions: "create...and test", "fix...and document"
- Numbered steps: "1. First...", "2. Then..."
- Multi-part keywords: "multiple", "several", "all"

### Sub-Task Types

| Type | Description | Context Filter |
|------|-------------|----------------|
| `analyze` | Understanding/reading code | All relationships, max 15 files |
| `create` | Creating new components | Existing patterns, max 10 files |
| `modify` | Modifying existing code | Target files + dependencies |
| `refactor` | Restructuring code | Import/export relationships |
| `test` | Writing/running tests | Test files, max 8 files |
| `fix` | Bug fixes | Error-related files |
| `document` | Documentation updates | MD files, max 5 files |
| `configure` | Configuration changes | Config files, max 6 files |

### Example Output

```
✓ Query analyzed (intent: create)
✓ Complex query: 3 sub-tasks identified

┌─ Task Decomposition ─────────────────────────────────────┐
│ Query split into 3 sub-tasks:
│ 1. [analyze] Analyze existing API structure...
│ 2. [create] Implement authentication middleware...
│ 3. [test] Create authentication tests... (after: 2)
│
│ Execution: 2 phase(s)
└──────────────────────────────────────────────────────────┘

🔄 Executing 3 sub-tasks...

  📌 Sub-task 1: Analyze existing API structure...
  📌 Sub-task 2: Implement authentication middleware...
  📌 Sub-task 3: Create authentication tests...
```

### Key Implementation Files

- `src/cli/commands/services/task-decomposition-service.ts` - Core decomposition logic
- `src/cli/commands/services/workflow-orchestrator.ts` - Integration with workflow

### Benefits

- **Better Focus**: Claude concentrates on one thing at a time
- **Optimized Context**: Each sub-task gets precisely relevant files
- **Reduced Token Usage**: No wasted tokens on irrelevant context
- **Improved Accuracy**: Smaller, focused tasks produce better results
- **Dependency Handling**: Tests run after implementation, docs after code changes

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
- ✅ **Workflow Orchestration**: Complete 11-step natural language processing pipeline with task decomposition

**Service Architecture:**
```
src/cli/commands/services/
├── natural-language-processor.ts     # Query analysis and intent detection
├── task-decomposition-service.ts     # Complex query splitting and sub-task context
├── semantic-search-orchestrator.ts   # Hybrid search (Vector + Text + Path)
├── graph-analysis-service.ts         # Code relationship mapping
├── context-builder.ts                # Enhanced prompt generation
├── user-interaction-service.ts       # User prompts and Claude Code execution
└── workflow-orchestrator.ts          # Master coordinator (11-step flow)
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

### CodeSeeker CLI Integration
**IMPORTANT**: After major codebase changes, CodeSeeker needs relinking:
```bash
# Relink CodeSeeker for Claude Code access
npm run build
npm link

# Verify global access
codeseeker --help
```

**When to Relink:**
- After fixing compilation errors
- After restructuring imports/exports
- After adding new CLI features
- After updating the bin entry point

### Integration Notes

- All CodeSeeker API calls are cached for 5 minutes
- Context responses are optimized for token efficiency
- Different intents provide focused information for specific tasks
- The system learns from your project patterns over time

**Setup completed**: 2025-08-27 12:37
**Integration**: Interactive Enhanced Setup v2.0 (PowerShell)
**Resume Token**: 

## Docker Best Practices for CodeSeeker

When working with CodeSeeker Docker containers, ALWAYS follow these practices:

### Container Management Rules
1. **Consistent Naming**: Always use the same container names (e.g., `codeseeker-dashboard`, `codeseeker-api`)
2. **Clean Before Rebuild**: Stop and remove old containers/images before rebuilding
3. **Volume Consistency**: Maintain the same volume mappings to preserve data
4. **Image Refresh**: Always rebuild images when code changes

### Standard Docker Workflow
```powershell
# 1. Stop and remove old containers
docker stop codeseeker-dashboard
docker rm codeseeker-dashboard

# 2. Remove old images (keep volumes)
docker rmi codeseeker-dashboard:latest

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

**CRITICAL**: When running the CodeSeeker dashboard in Docker or on a remote server, it may not be able to access project files on the local machine.

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
docker stop codeseeker-dashboard

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

## Semantic Versioning (MANDATORY)

**CRITICAL**: Claude MUST update version numbers when making changes. Follow SemVer strictly.

### Version Format: `MAJOR.MINOR.PATCH`

| Bump | When to Use | Examples |
|------|-------------|----------|
| **PATCH** (x.x.+1) | Bug fixes, performance, refactoring, docs | Fixed search bug, improved speed, updated README |
| **MINOR** (x.+1.0) | New features (backward compatible) | New command, new MCP tool, new option |
| **MAJOR** (+1.0.0) | Breaking changes (not backward compatible) | Renamed command, removed feature, schema migration |

### Files to Update (ALL of them)

When bumping version, update these files:
1. `package.json` → `"version": "X.Y.Z"`
2. `plugins/codeseeker/.claude-plugin/plugin.json` → `"version": "X.Y.Z"`
3. `plugins/codeseeker/version.json` → `"version": "X.Y.Z"` and `"releaseDate"`

### Commit Message Format

- **PATCH**: `fix: <description>` or `perf: <description>` or `docs: <description>`
- **MINOR**: `feat: <description>`
- **MAJOR**: `feat!: <description>` or include `BREAKING CHANGE:` in body

### Plugin Branch Sync

After version bump on master, sync to plugin branch:
```bash
git checkout plugin
# Update version files
git commit -m "chore: bump version to X.Y.Z"
git push origin plugin
git checkout master
```

See `.github/VERSIONING.md` for full details.

## GitHub Release Process (MANDATORY)

**CRITICAL**: Every version bump MUST have a corresponding GitHub release. The plugin update UI reads release notes from GitHub.

### When to Create Releases

| Release Type | When | Content |
|--------------|------|---------|
| **Initial (x.0.0)** | First release of a major version | Full feature documentation, all capabilities |
| **Minor (x.Y.0)** | New features added | New features with descriptions, any fixes |
| **Patch (x.y.Z)** | Bug fixes only | Fixed issues, improvements, no new features |

### Release Creation Steps

1. **Ensure version files are updated** (package.json, plugin.json, version.json)
2. **Ensure CHANGELOG.md is updated** with the new version entry
3. **Commit and push** the version changes to master
4. **Create the GitHub release**:

```bash
# Create release with gh CLI
gh release create v1.0.X --repo jghiringhelli/codeseeker --title "v1.0.X - Title" --notes "$(cat <<'EOF'
# CodeSeeker v1.0.X - Title

## Fixed
- Issue 1
- Issue 2

## Added
- Feature 1

## Upgrade

\`\`\`bash
/plugin uninstall codeseeker
/plugin install codeseeker@github:jghiringhelli/codeseeker#plugin
\`\`\`

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

5. **Sync to plugin branch** if not already done

### Release Notes Format

- **Major/Initial releases** (v1.0.0): Include full feature documentation with all MCP tools, supported languages, installation instructions
- **Minor releases** (v1.1.0): Focus on new features, include upgrade instructions
- **Patch releases** (v1.0.1): Focus on fixes, keep it concise

### Link to Releases

The `plugins/codeseeker/version.json` file contains:
```json
{
  "changelog": "https://github.com/jghiringhelli/codeseeker/releases"
}
```

This URL is used by the Claude Code plugin update UI to show release notes.

### Verify Release

After creating a release:
1. Visit https://github.com/jghiringhelli/codeseeker/releases
2. Verify the release appears with correct tag and notes
3. Test plugin update in Claude Code to ensure notes display

## Important Development Reminders

### SOLID Principles Enforcement
**MANDATORY**: ALL NEW CODE MUST FOLLOW SOLID PRINCIPLES:
- **Single Responsibility**: One class, one purpose
- **Open/Closed**: Extend behavior without modifying existing code
- **Liskov Substitution**: Subclasses must be interchangeable with parent classes
- **Interface Segregation**: Create specific interfaces, not monolithic ones
- **Dependency Inversion**: Depend on abstractions, not concrete implementations

### CodeSeeker CLI Relinking Requirements
After major changes to CodeSeeker codebase:
1. **Always run `npm run build`** to ensure TypeScript compilation
2. **Run `npm link`** to relink the global CLI command
3. **Test with `codeseeker --help`** to verify Claude Code can access it
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
CodeSeeker CLI services are now organized by functionality domain:

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

## CodeSeeker MCP Tools (Preferred over grep/glob)

This project is indexed with CodeSeeker for semantic code search.

**IMPORTANT: Use CodeSeeker MCP tools instead of grep/glob for code discovery:**

| Task | Use This | Not This |
|------|----------|----------|
| Find code by meaning | `search_code("authentication logic")` | `grep -r "auth"` |
| Search + read files | `find_and_read("error handling")` | `grep` then `cat` |
| Show dependencies | `get_code_relationships({filepath})` | Manual file reading |
| Find patterns | `get_coding_standards({project})` | Searching manually |

**When to use grep/glob instead:**
- Exact literal string matches (e.g., specific error codes, UUIDs)
- Regex pattern matching (e.g., `grep -E "v[0-9]+\.[0-9]+"`)
- You already know the exact file path

**Examples:**
- ❌ `grep -r "error handling" src/` → finds literal text only
- ✅ `search_code("how errors are handled")` → finds try-catch, error responses, validation
- ❌ `grep -r "auth" && cat file.ts` → two steps, text-only matching
- ✅ `find_and_read("authentication flow")` → one step, semantic search + file content

**Available CodeSeeker MCP tools:**
- `search_code(query)` - Semantic search across all indexed files
- `find_and_read(query)` - Search and read matching files in one call
- `get_code_relationships({filepath})` - Show imports, exports, calls, dependencies
- `get_file_context({filepath})` - Read file with related code context
- `get_coding_standards({project})` - Show detected coding patterns
- `index_project({path})` - Index/reindex a project
- `notify_file_changes({changes})` - Update index after file changes

