# CodeSeeker Testing Guide

Complete guide to testing CodeSeeker's three operating modes: CLI, MCP Server, and VSCode Extension.

## Prerequisites

```bash
# 1. Install CodeSeeker globally
npm install -g codeseeker

# 2. Verify installation
codeseeker --version
codeseeker --help
```

---

## Part 1: CLI Testing

### Quick Start with ContractMaster-Test

The `ContractMaster-Test` fixture is a sample codebase with intentional SOLID violations, perfect for testing CodeSeeker's analysis capabilities.

```bash
# Copy the test fixture to a temporary location
cp -r tests/fixtures/ContractMaster-Test-Original /tmp/ContractMaster-Test
cd /tmp/ContractMaster-Test

# Initialize CodeSeeker (uses embedded mode by default)
codeseeker init --quick
```

### Sample CLI Queries

#### Basic Queries (Copy-Paste Ready)

```bash
# What is this project about?
codeseeker -c "what is this project about?"

# List all classes
codeseeker -c "show me all the classes in this project"

# Find specific functionality
codeseeker -c "where is user registration handled?"

# Find contracts functionality
codeseeker -c "how does contract processing work?"
```

#### SOLID Analysis Queries

```bash
# Find SOLID violations
codeseeker -c "what SOLID principle violations are in MegaController?"

# Single Responsibility violations
codeseeker -c "show me classes that handle too many responsibilities"

# Suggest refactoring
codeseeker -c "how can I refactor MegaController to follow single responsibility principle?"
```

#### Code Modification Queries

```bash
# Add validation
codeseeker -c "add input validation to the registerUser function in MegaController - validate that email is a valid format and name is not empty"

# Add error handling
codeseeker -c "add try-catch error handling to processContract in BusinessLogic.js"

# Extract service
codeseeker -c "extract the email sending logic from MegaController into a separate EmailService"

# Add new method
codeseeker -c "add a deleteContract method to MegaController that validates the contract exists before deleting"

# Use constants
codeseeker -c "the ProcessorFactory is using string comparisons for type - convert it to use constants"
```

#### Code Search Queries

```bash
# Semantic search
codeseeker -c "find all files related to user authentication"

# Find patterns
codeseeker -c "find all places where we validate user input"

# Find relationships
codeseeker -c "what files depend on UserService?"

# Find duplications
codeseeker -c "are there any duplicate implementations in this codebase?"
```

### CLI Commands Reference

```bash
# Initialize project
codeseeker init                    # Full initialization
codeseeker init --quick            # Quick init (skip docs)
codeseeker init --no-docs          # Skip documentation generation

# Query with search
codeseeker -c "your question"      # Natural language query

# Sync after changes
codeseeker sync                    # Incremental sync
codeseeker sync --full             # Full reindex

# Project management
codeseeker list                    # List indexed projects
codeseeker status                  # Show project status

# Storage commands
codeseeker storage status          # Check storage mode
codeseeker storage test            # Test database connections
```

### Expected Output Examples

#### Successful Query Response
```
🧠 Starting CodeSeeker workflow...

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
# Add CodeSeeker as an MCP server
claude mcp add codeseeker --scope user -- codeseeker serve --mcp

# Verify it was added
claude mcp list

# Test the configuration
claude mcp get codeseeker
```

### Option B: Configure Claude Desktop (GUI App)

Create or edit the Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "codeseeker",
      "args": ["serve", "--mcp"]
    }
  }
}
```

### Restart and Verify

After configuring, restart Claude Code or Claude Desktop. In Claude Code, verify with:

```bash
claude mcp list
# Should show: codeseeker (user)
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
npx @modelcontextprotocol/inspector codeseeker serve --mcp
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
cd extensions/vscode-codeseeker

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package

# Install in VSCode
code --install-extension vscode-codeseeker-0.1.0.vsix
```

### Verify Installation

1. Open VSCode
2. Look for "CodeSeeker" in the status bar (bottom)
3. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
4. Type "CodeSeeker" to see available commands:
   - CodeSeeker: Sync Now
   - CodeSeeker: Full Reindex
   - CodeSeeker: Toggle Auto-Sync

### Test Auto-Sync

1. Open a project folder that's been indexed with `codeseeker init`
2. Edit a file and save
3. Watch the status bar - should show sync activity
4. After 2 seconds (debounce), files are synced

### Status Bar Indicators

| Icon | Status |
|------|--------|
| ✓ CodeSeeker | Synced and ready |
| ↻ CodeSeeker | Syncing in progress |
| ⚠ CodeSeeker | Sync error (check output) |

### Extension Commands

| Command | Description |
|---------|-------------|
| `CodeSeeker: Sync Now` | Manually trigger sync |
| `CodeSeeker: Full Reindex` | Complete project reindex |
| `CodeSeeker: Toggle Auto-Sync` | Enable/disable auto-sync |

### Extension Settings

Configure via VSCode Settings (Ctrl+,):

```json
{
  "codeseeker.autoSync": true,
  "codeseeker.syncDebounceMs": 2000,
  "codeseeker.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/*.min.js"
  ],
  "codeseeker.mcpCommand": "codeseeker"
}
```

### Troubleshooting Extension

```bash
# Check extension output in VSCode
View → Output → Select "CodeSeeker" from dropdown

# Verify MCP server is accessible
codeseeker serve --mcp  # Should output "CodeSeeker MCP server running"

# Check extension logs
# Look in: ~/.vscode/extensions/vscode-codeseeker-*/logs/
```

---

## Part 4: Running Automated Tests

### Unit Tests

```bash
cd /path/to/CodeSeeker

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
CODESEEKER_TEST_STORAGE_MODE=server node scripts/run-e2e-tests.js
```

### Test Results Expected

```
============================================================
Running E2E Tests in MOCK mode
============================================================

PASS tests/integration/e2e/codeseeker-e2e.test.ts
  CodeSeeker E2E Integration Tests
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
codeseeker init --quick           # Initialize project
codeseeker -c "query"             # Natural language query
codeseeker sync                   # Sync changes
codeseeker list                   # List projects
```

### MCP Setup
```json
// claude_desktop_config.json
{
  "mcpServers": {
    "codeseeker": {
      "command": "codeseeker",
      "args": ["serve", "--mcp"]
    }
  }
}
```

### VSCode Extension
```bash
cd extensions/vscode-codeseeker
npm install && npm run compile
npm run package
code --install-extension vscode-codeseeker-0.1.0.vsix
```

---

## Troubleshooting

### "codeseeker: command not found"
```bash
npm install -g codeseeker
# Verify: which codeseeker (or where codeseeker on Windows)
```

### "No project found"
```bash
cd /your/project
codeseeker init
```

### "MCP server not responding"
```bash
# Test MCP server directly
codeseeker serve --mcp
# Should output: "CodeSeeker MCP server running on stdio"
```

### "Extension not syncing"
1. Check VSCode Output → CodeSeeker
2. Verify `codeseeker serve --mcp` works
3. Check file is not in excludePatterns

### "No specific file matches" / Search returns empty
If semantic search returns no results after initialization:
```bash
# Re-initialize the project (required when switching storage modes)
codeseeker init

# Or for quick re-index without doc generation
codeseeker init --quick
```

**Important**: If you switch between embedded and server storage modes (via `CODESEEKER_STORAGE_MODE`), you must re-run `codeseeker init` because:
- Embedded mode uses SQLite (local files)
- Server mode uses PostgreSQL (external database)
- Data does NOT transfer between storage modes

### Storage Modes
```bash
# Embedded mode (default) - no Docker required
codeseeker init

# Server mode - requires PostgreSQL, Neo4j, Redis
CODESEEKER_STORAGE_MODE=server codeseeker init
```

---

For more details, see:
- [MCP Server Documentation](docs/mcp-server.md)
- [Storage Configuration](docs/storage.md)
- [CLI Commands Manual](docs/cli_commands_manual.md)