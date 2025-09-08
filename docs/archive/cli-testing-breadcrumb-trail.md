# CodeMind CLI Testing Breadcrumb Trail

## Overview

This guide provides a comprehensive testing pathway to verify CodeMind CLI is functioning correctly with the composite three-layer architecture, database integration, and dashboard visibility.

## 🎯 Pre-Testing Setup

### Prerequisites Checklist
- [ ] Docker containers running (PostgreSQL, Neo4j, Redis, MongoDB)
- [ ] CodeMind compiled and available (`npm run build`)
- [ ] Project initialized in database
- [ ] Dashboard accessible (localhost:3003)
- [ ] All required dependencies installed

### Environment Setup
```powershell
# 1. Set environment variables
$env:CODEMIND_DB_HOST = "localhost"
$env:CODEMIND_DB_PORT = "5432" 
$env:CODEMIND_REDIS_URL = "redis://localhost:6379"
$env:CODEMIND_NEO4J_URL = "neo4j://localhost:7687"
$env:CODEMIND_MONGODB_URL = "mongodb://localhost:27017/codemind"

# 2. Start all services
docker-compose up -d

# 3. Build the project
npm run build

# 4. Check if CLI binary exists
Test-Path .\bin\codemind.js
```

## 🚀 Phase 1: Project Initialization

### Step 1.1: Initialize Project in Database
```powershell
# Initialize current project in CodeMind database
node .\bin\codemind.js init

# Expected Output:
# 🚀 Initializing CodeMind...
# ✅ Project registered in database
# ✅ Tool databases initialized
# ✅ Semantic graph ready
# ✅ CodeMind initialized successfully!
```

**Testing Points:**
- [ ] No errors during initialization
- [ ] Database project ID generated
- [ ] Success message displayed

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:1456` - init command handler
- `scripts/init-project.ps1` - PowerShell initialization script

### Step 1.2: Verify Database Registration
```sql
-- Connect to PostgreSQL and verify project exists
SELECT * FROM projects WHERE project_path LIKE '%CodeMind%';

-- Expected: One row with current project path
```

**Dashboard Check:**
- Navigate to `http://localhost:3003`
- Verify project appears in project list
- Check project details show correct path

## 🔍 Phase 2: CLI Status Check

### Step 2.1: Service Health Check
```powershell
# Check all services are running
node .\bin\codemind.js status

# Expected Output:
# 📊 CodeMind Status
# ✅ PostgreSQL: Running
# ✅ Neo4j: Running  
# ✅ Redis: Running
# ✅ Orchestrator: Running
# ✅ Dashboard: Running
```

**Testing Points:**
- [ ] All services show "Running" status
- [ ] No connection errors
- [ ] Port checks succeed

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:1476` - status command handler
- Service connection logic at lines 1482-1522

### Step 2.2: Database Connectivity Test
```powershell
# Test CLI database binding
node .\bin\codemind.js "test database connection"

# Expected Output:
# 🧠 CodeMind
# ─────────────────────────────
# 📝 test database connection
# 🤔 Thinking...
# ⚡ Working...
# ✅ Bound to project: [PROJECT-ID]
# 🤖 Claude selected: [tools...]
# 🎯 Processing with Claude Code...
# ✅ Analysis Complete
```

**Testing Points:**
- [ ] Project binding successful
- [ ] No database connection errors
- [ ] Tools selected and executed

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:72` - `initializeProjectBinding()` method
- Database query logic at lines 75-93

## 🧠 Phase 3: Three-Layer Intelligence Testing

### Step 3.1: Test Semantic Search Layer
```powershell
# Test semantic search functionality
node .\bin\codemind.js "find authentication code" --verbose

# Expected Output in verbose mode:
# 🚀 CODEMIND CONTEXT ENHANCER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📝 User Request: "find authentication code"
# 📂 Project: [PROJECT-PATH]
# 
# ⏳ Phase 1: Discovering tools...
# ✅ Discovered [N] tools
# 
# ⏳ Phase 2: Selecting tools...
# ✅ Selected [N] tools
# 
# 🛠  Selected Tools:
#    • SemanticGraphTool (95%)
#      Core knowledge graph analysis for project understanding
#    • TreeNavigator (90%)
#      Navigate and understand code structure for updates
```

**Testing Points:**
- [ ] Semantic concepts identified
- [ ] Vector search executed
- [ ] Relevance scoring applied
- [ ] Auth-related files found

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:131` - semantic search initialization
- `src/services/claude-tool-orchestrator.ts` - orchestration logic
- `src/shared/tool-autodiscovery.ts` - tool discovery

### Step 3.2: Test Graph Expansion Layer
```powershell
# Test Neo4j graph traversal
node .\bin\codemind.js "analyze project architecture" --verbose

# Expected verbose output should show:
# 📊 Executing Claude-selected tools...
#    • SemanticGraphTool (95%)
#    • [Other tools...]
# 
# Phase 3: Generating context...
# ✅ Generated [N] tokens
```

**Testing Points:**
- [ ] Neo4j connection successful
- [ ] Graph relationships traversed
- [ ] Architecture patterns identified
- [ ] Cross-domain insights generated

**Class Paths to Check:**
- `src/orchestration/semantic-orchestrator.ts` - graph expansion
- `src/services/semantic-graph.ts` - Neo4j integration

### Step 3.3: Test Tree Navigation Layer
```powershell
# Test AST-based tree navigation
node .\bin\codemind.js "explore code structure" --verbose

# Expected to show:
# 📊 Analyzing codebase...
#    • TreeNavigator
#    • [Other tools...]
# 
# Phase 4: Processing with Claude Code...
# ✅ Processing complete
```

**Testing Points:**
- [ ] AST parsing successful
- [ ] Call graph generation
- [ ] File importance scoring
- [ ] Code section prioritization

**Class Paths to Check:**
- `src/features/tree-navigation/navigator.ts` - tree analysis
- AST parsing logic and call graph generation

## 🔧 Phase 4: Tool Selection & Execution Testing

### Step 4.1: Test Multi-Intent Tool Selection
```powershell
# Test complex request with multiple intents
node .\bin\codemind.js "refactor authentication system for better security and performance"

# Expected Output:
# 🤖 Claude selected: SemanticGraphTool, DuplicationDetector, SOLIDAnalyzer, SecurityAnalyzer, PerformanceAnalyzer
# 💡 [Reasoning for tool selection]
```

**Testing Points:**
- [ ] Multiple intents detected (refactor, security, performance)
- [ ] Appropriate tools selected
- [ ] Confidence scores reasonable
- [ ] Tool execution successful

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:222` - `selectTools()` method
- Intent detection logic at lines 1287-1324
- Tool selection logic at lines 252-404

### Step 4.2: Test Tool Parameters
```powershell
# Test tool parameter passing
node .\bin\codemind.js "find security vulnerabilities" --debug

# In debug mode, should show:
# Parameters: {"comprehensive": true}
# Tool execution details
```

**Testing Points:**
- [ ] Tool parameters correctly determined
- [ ] Parameters passed to tools
- [ ] Tool execution with parameters successful

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:504` - tool execution loop
- Parameter handling at lines 511-516

## 💾 Phase 5: Database Update & Learning Testing

### Step 5.1: Test Claude Code Outcome Analysis
```powershell
# Test outcome analysis and database updates
node .\bin\codemind.js "analyze this codebase for improvements"

# Should trigger database updates after analysis
# Check PostgreSQL for new entries
```

**SQL Verification:**
```sql
-- Check Claude decisions were logged
SELECT * FROM claude_decisions ORDER BY created_at DESC LIMIT 5;

-- Check tool-specific tables were updated
SELECT * FROM tree_navigation ORDER BY analysis_date DESC LIMIT 5;
SELECT * FROM compilation_results ORDER BY build_date DESC LIMIT 5;
```

**Testing Points:**
- [ ] Claude decisions logged in database
- [ ] Tool-specific tables updated
- [ ] Outcome analysis executed
- [ ] Change detection working

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:729` - `updateDataWithClaude()` method
- `src/cli/codemind-unified.ts:1002` - `updateToolSpecificTables()` method
- Database update logic at lines 1044-1083

### Step 5.2: Test Universal Learning
```powershell
# Test that all tools learn from requests
node .\bin\codemind.js "optimize code quality"

# Verify all tools were updated, not just selected ones
```

**Dashboard Verification:**
- Navigate to `http://localhost:3003/tools`
- Check tool usage statistics
- Verify learning data updated

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:977` - `updateAllTools()` legacy method
- Universal learning implementation

## 🎛️ Phase 6: Dashboard Integration Testing

### Step 6.1: Verify Data Visibility
1. Navigate to `http://localhost:3003`
2. Check project appears with correct details
3. Navigate to tool-specific pages
4. Verify recent analysis data appears

**Dashboard Testing Points:**
- [ ] Project listed correctly
- [ ] Tool usage data visible
- [ ] Recent analyses displayed
- [ ] Graph relationships visible (Neo4j page)
- [ ] Performance metrics available

### Step 6.2: Real-time Updates
1. Run a CLI command: `node .\bin\codemind.js "test real-time updates"`
2. Refresh dashboard during execution
3. Verify data updates in real-time

**Class Paths to Check:**
- `src/dashboard/server.js` - dashboard server
- `src/dashboard/tool-bundle-api.js` - API endpoints
- Database API at `src/orchestration/tool-management-api.ts`

## 🔄 Phase 7: Error Handling & Fallback Testing

### Step 7.1: Test Service Failures
```powershell
# Stop Neo4j temporarily
docker stop codemind-neo4j

# Test CLI still works with fallback
node .\bin\codemind.js "analyze without neo4j"

# Should show fallback behavior
# Start Neo4j back up
docker start codemind-neo4j
```

**Testing Points:**
- [ ] Graceful degradation when services fail
- [ ] Fallback mechanisms work
- [ ] Error messages helpful
- [ ] Recovery when services return

**Class Paths to Check:**
- Error handling in `src/cli/codemind-unified.ts:162` and `src/cli/codemind-unified.ts:214`
- Fallback logic throughout tool execution

### Step 7.2: Test Invalid Requests
```powershell
# Test non-codebase requests (should use sink intention)
node .\bin\codemind.js "what is the weather today"

# Expected: Direct Claude Code processing with sink intent
```

**Testing Points:**
- [ ] Sink intent detection working
- [ ] Non-codebase requests handled appropriately
- [ ] No unnecessary tool execution

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:227` - sink intention handling
- Intent detection at lines 1312-1316

## 📊 Phase 8: Performance & Monitoring

### Step 8.1: Token Usage Monitoring
```powershell
# Test token estimation and optimization
node .\bin\codemind.js "analyze entire codebase" --verbose

# Check output for token usage information
```

**Testing Points:**
- [ ] Token counting accurate
- [ ] Context optimization working
- [ ] Performance metrics logged

**Class Paths to Check:**
- `src/cli/codemind-unified.ts:1262` - `estimateTokens()` method
- Token counting throughout tool execution

### Step 8.2: Caching Effectiveness
```powershell
# Run same command twice
node .\bin\codemind.js "analyze authentication system"
node .\bin\codemind.js "analyze authentication system"

# Second run should be faster with cached results
```

**Testing Points:**
- [ ] Cache hit detection
- [ ] Faster second execution
- [ ] Cache invalidation working

## 🎯 Success Criteria

### All Tests Pass When:
- [ ] Project initializes successfully in database
- [ ] All services show healthy status
- [ ] Three-layer intelligence pipeline executes
- [ ] Tools selected and executed appropriately
- [ ] Database updates occur after analysis
- [ ] Dashboard shows real-time data
- [ ] Error handling graceful
- [ ] Performance metrics reasonable

### Key Performance Indicators:
- **Initialization**: < 30 seconds
- **Simple queries**: < 5 seconds
- **Complex analysis**: < 30 seconds
- **Database updates**: < 5 seconds
- **Dashboard refresh**: < 2 seconds

### Architecture Validation:
- [ ] **Composite layers**: CLI used by higher layers
- [ ] **Intelligence pipeline**: Semantic → Graph → Tree → Tools
- [ ] **Universal learning**: All tools updated
- [ ] **Professional logging**: Consistent color/format system
- [ ] **Claude Code integration**: Outcome analysis working

## 🐛 Troubleshooting Guide

### Common Issues:

1. **"Project not found in database"**
   - Run `codemind init` to initialize project
   - Check PostgreSQL container is running
   - Verify database connection string

2. **"Failed to connect to database"**
   - Check all Docker containers running: `docker ps`
   - Verify environment variables set correctly
   - Check port availability

3. **"No tools discovered"**
   - Verify `src/shared/tool-autodiscovery.ts` working
   - Check tool registry initialization
   - Ensure build is up to date

4. **Dashboard not showing data**
   - Check API endpoints responding
   - Verify database has data
   - Clear browser cache

5. **Tool execution failures**
   - Check individual tool implementations
   - Verify tool parameters valid
   - Check database permissions

This breadcrumb trail ensures comprehensive testing of the CodeMind CLI's composite three-layer architecture, from basic functionality through advanced database integration and dashboard visualization.