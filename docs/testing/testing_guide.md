# CodeMind Testing Guide

Complete guide to testing CodeMind's three operating modes: CLI, MCP Server, and VSCode Extension.

## Prerequisites

```bash
# 1. Install CodeMind globally
npm install -g codemind

# 2. Verify installation
codemind --version
codemind --help
```

---

## Part 1: CLI Testing

### Quick Start with ContractMaster-Test

The `ContractMaster-Test` fixture is a sample codebase with intentional SOLID violations, perfect for testing CodeMind's analysis capabilities.

```bash
# Copy the test fixture to a temporary location
cp -r tests/fixtures/ContractMaster-Test-Original /tmp/ContractMaster-Test
cd /tmp/ContractMaster-Test

# Initialize CodeMind (uses embedded mode by default)
codemind init --quick
```

### Sample CLI Queries

#### Basic Queries (Copy-Paste Ready)

```bash
# What is this project about?
codemind -c "what is this project about?"

# List all classes
codemind -c "show me all the classes in this project"

# Find specific functionality
codemind -c "where is user registration handled?"

# Find contracts functionality
codemind -c "how does contract processing work?"
```

#### SOLID Analysis Queries

```bash
# Find SOLID violations
codemind -c "what SOLID principle violations are in MegaController?"

# Single Responsibility violations
codemind -c "show me classes that handle too many responsibilities"

# Suggest refactoring
codemind -c "how can I refactor MegaController to follow single responsibility principle?"
```

#### Code Modification Queries

```bash
# Add validation
codemind -c "add input validation to the registerUser function in MegaController - validate that email is a valid format and name is not empty"

# Add error handling
codemind -c "add try-catch error handling to processContract in BusinessLogic.js"

# Extract service
codemind -c "extract the email sending logic from MegaController into a separate EmailService"

# Add new method
codemind -c "add a deleteContract method to MegaController that validates the contract exists before deleting"

# Use constants
codemind -c "the ProcessorFactory is using string comparisons for type - convert it to use constants"
```

#### Code Search Queries

```bash
# Semantic search
codemind -c "find all files related to user authentication"

# Find patterns
codemind -c "find all places where we validate user input"

# Find relationships
codemind -c "what files depend on UserService?"

# Find duplications
codemind -c "are there any duplicate implementations in this codebase?"
```

### CLI Commands Reference

```bash
# Initialize project
codemind init                    # Full initialization
codemind init --quick            # Quick init (skip docs)
codemind init --no-docs          # Skip documentation generation

# Query with search
codemind -c "your question"      # Natural language query

# Sync after changes
codemind sync                    # Incremental sync
codemind sync --full             # Full reindex

# Project management
codemind list                    # List indexed projects
codemind status                  # Show project status

# Storage commands
codemind storage status          # Check storage mode
codemind storage test            # Test database connections
```

### Expected Output Examples

#### Successful Query Response
```
🧠 Starting CodeMind workflow...

1️⃣ Analyzing query for assumptions and ambiguities...
   Intent: analyze (confidence: 92.0%)

2️⃣ Performing semantic search...
   Found 3 relevant files:
   • server/controllers/MegaController.js (score: 0.94)
   • server/services/UserService.js (score: 0.78)
   • lib/core/UserManager.js (score: 0.71)

3️⃣ Analyzing code relationships...
   Found 5 relationships between components

4️⃣ Building enhanced context...
   Context size: 2,847 characters

5️⃣ Executing with Claude Code...
   [Claude's response appears here]

📊 Analysis Complete
   Files analyzed: 3
   Relationships found: 5
   Execution time: 2.3s
```

---

## Part 2: MCP Server Testing

### Option A: Configure Claude Code (CLI) - Recommended

```bash
# Add CodeMind as an MCP server
claude mcp add codemind --scope user -- codemind serve --mcp

# Verify it was added
claude mcp list

# Test the configuration
claude mcp get codemind
```

### Option B: Configure Claude Desktop (GUI App)

Create or edit the Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codemind": {
      "command": "codemind",
      "args": ["serve", "--mcp"]
    }
  }
}
```

### Restart and Verify

After configuring, restart Claude Code or Claude Desktop. In Claude Code, verify with:

```bash
claude mcp list
# Should show: codemind (user)
```

### Sample MCP Conversations

#### 1. Index a Project

```
You: Index my project at /tmp/ContractMaster-Test

Claude: [Uses index_project tool]

I've indexed your ContractMaster-Test project:
- Files indexed: 17
- Code entities: 42
- Duration: 3.2 seconds

The project is now ready for semantic search.
```

#### 2. Search for Code

```
You: Search for authentication code in ContractMaster-Test

Claude: [Uses search_code tool]

I found 4 relevant files related to authentication:

1. **server/controllers/MegaController.js** (score: 0.91)
   Contains registerUser() with password hashing using bcrypt

2. **server/controllers/UserController.js** (score: 0.85)
   Handles user login and session management

3. **server/services/UserService.js** (score: 0.79)
   User CRUD operations with password validation

4. **lib/core/UserManager.js** (score: 0.72)
   Core user management logic
```

#### 3. Get File Context

```
You: Show me the MegaController with related code

Claude: [Uses get_file_context tool]

**MegaController.js** (server/controllers/MegaController.js)

This file contains a "god class" with multiple responsibilities:
- User registration and authentication
- Contract creation and management
- Email sending
- PDF generation
- Audit logging

Related code chunks:
- UserService.js - provides user operations
- ContractValidator.js - validates contract data
- ProcessorFactory.js - creates contract processors

SOLID Violations detected:
- Single Responsibility: Handles 6+ concerns
- Open/Closed: Not easily extensible
```

#### 4. Explore Code Relationships

```
You: What files depend on UserService?

Claude: [Uses get_code_relationships tool]

UserService has the following relationships:

**Incoming (files that import UserService):**
├── server/controllers/MegaController.js (imports, calls)
├── server/controllers/UserController.js (imports, calls)
└── tests/contract.test.js (imports)

**Outgoing (UserService depends on):**
├── lib/core/UserManager.js (imports)
└── lib/helpers/ValidatorService.js (imports)

Summary: UserService is a central dependency used by 3 files
and depends on 2 core libraries.
```

#### 5. Full Reindex After Git Pull

```
You: I just did a big git pull, refresh the entire index

Claude: [Uses notify_file_changes with full_reindex: true]

I've triggered a complete reindex:
- Mode: full_reindex
- Previous chunks deleted: 156
- New files indexed: 19
- New chunks created: 178
- Duration: 4.7 seconds

The index is now fully synchronized with your latest code.
```

### MCP Testing with Inspector

Test MCP tools interactively using the MCP Inspector:

```bash
# Install and run MCP Inspector
npx @modelcontextprotocol/inspector codemind serve --mcp
```

This opens a web interface where you can:
- List available tools
- Call tools with parameters
- See raw JSON responses

---

## Part 3: VSCode Extension Testing

### Build and Install Extension

```bash
# Navigate to extension directory
cd extensions/vscode-codemind

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package

# Install in VSCode
code --install-extension vscode-codemind-0.1.0.vsix
```

### Verify Installation

1. Open VSCode
2. Look for "CodeMind" in the status bar (bottom)
3. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
4. Type "CodeMind" to see available commands:
   - CodeMind: Sync Now
   - CodeMind: Full Reindex
   - CodeMind: Toggle Auto-Sync

### Test Auto-Sync

1. Open a project folder that's been indexed with `codemind init`
2. Edit a file and save
3. Watch the status bar - should show sync activity
4. After 2 seconds (debounce), files are synced

### Status Bar Indicators

| Icon | Status |
|------|--------|
| ✓ CodeMind | Synced and ready |
| ↻ CodeMind | Syncing in progress |
| ⚠ CodeMind | Sync error (check output) |

### Extension Commands

| Command | Description |
|---------|-------------|
| `CodeMind: Sync Now` | Manually trigger sync |
| `CodeMind: Full Reindex` | Complete project reindex |
| `CodeMind: Toggle Auto-Sync` | Enable/disable auto-sync |

### Extension Settings

Configure via VSCode Settings (Ctrl+,):

```json
{
  "codemind.autoSync": true,
  "codemind.syncDebounceMs": 2000,
  "codemind.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/*.min.js"
  ],
  "codemind.mcpCommand": "codemind"
}
```

### Troubleshooting Extension

```bash
# Check extension output in VSCode
View → Output → Select "CodeMind" from dropdown

# Verify MCP server is accessible
codemind serve --mcp  # Should output "CodeMind MCP server running"

# Check extension logs
# Look in: ~/.vscode/extensions/vscode-codemind-*/logs/
```

---

## Part 4: Running Automated Tests

### Unit Tests

```bash
cd /path/to/CodeMind

# Run all unit tests
npm test

# Run specific test file
npx jest tests/cli/services/embedding-service.test.ts

# Run with coverage
npm run test:coverage
```

### E2E Integration Tests

```bash
# Run E2E tests in mock mode (default, fast)
node scripts/run-e2e-tests.js

# Run E2E tests with real Claude CLI (slow, requires API)
node scripts/run-e2e-tests.js --live

# Run with server storage mode (requires Docker)
CODEMIND_TEST_STORAGE_MODE=server node scripts/run-e2e-tests.js
```

### Test Results Expected

```
============================================================
Running E2E Tests in MOCK mode
============================================================

PASS tests/integration/e2e/codemind-e2e.test.ts
  CodeMind E2E Integration Tests
    Init Command
      ✓ should initialize project successfully
      ✓ should create project entry in PostgreSQL
      ✓ should index files and create embeddings
    Search and Context Building
      ✓ should find MegaController when searching for user functions
      ✓ should find BusinessLogic when searching for contract processing
      ✓ should find ProcessorFactory when searching for processors
      ✓ should include enhanced context in Claude prompts
    ...

Test Suites: 1 passed, 1 total
Tests:       18 passed, 18 total
```

---

## Quick Reference Card

### CLI Commands
```bash
codemind init --quick           # Initialize project
codemind -c "query"             # Natural language query
codemind sync                   # Sync changes
codemind list                   # List projects
```

### MCP Setup
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "codemind": {
      "command": "codemind",
      "args": ["serve", "--mcp"]
    }
  }
}
```

### VSCode Extension
```bash
cd extensions/vscode-codemind
npm install && npm run compile
npm run package
code --install-extension vscode-codemind-0.1.0.vsix
```

---

## Troubleshooting

### "codemind: command not found"
```bash
npm install -g codemind
# Verify: which codemind (or where codemind on Windows)
```

### "No project found"
```bash
cd /your/project
codemind init
```

### "MCP server not responding"
```bash
# Test MCP server directly
codemind serve --mcp
# Should output: "CodeMind MCP server running on stdio"
```

### "Extension not syncing"
1. Check VSCode Output → CodeMind
2. Verify `codemind serve --mcp` works
3. Check file is not in excludePatterns

### "No specific file matches" / Search returns empty
If semantic search returns no results after initialization:
```bash
# Re-initialize the project (required when switching storage modes)
codemind init

# Or for quick re-index without doc generation
codemind init --quick
```

**Important**: If you switch between embedded and server storage modes (via `CODEMIND_STORAGE_MODE`), you must re-run `codemind init` because:
- Embedded mode uses SQLite (local files)
- Server mode uses PostgreSQL (external database)
- Data does NOT transfer between storage modes

### Storage Modes
```bash
# Embedded mode (default) - no Docker required
codemind init

# Server mode - requires PostgreSQL, Neo4j, Redis
CODEMIND_STORAGE_MODE=server codemind init
```

---

For more details, see:
- [MCP Server Documentation](docs/mcp-server.md)
- [Storage Configuration](docs/storage.md)
- [CLI Commands Manual](docs/cli_commands_manual.md)