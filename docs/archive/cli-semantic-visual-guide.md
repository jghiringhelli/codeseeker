# CLI Semantic Graph Visual Guide

## 🎨 Visual Indicators for Semantic Graph Usage

The CodeMind CLI now provides rich visual feedback to show exactly when and how the semantic graph is being used. This guide explains all the color codes and indicators.

## 🧠 Semantic Graph Indicators

### Connection Status
- **🧠 [GREEN]** - Semantic graph connected and operational
- **🧠 [RED]** - Semantic graph unavailable or disconnected
- **🧠 [BLUE]** - Initializing semantic graph connection

### Service Status Colors
- **✅ [GREEN]** - Service operational/successful
- **⚠️ [YELLOW]** - Service warning/partial functionality
- **❌ [RED]** - Service failed/unavailable
- **ℹ [CYAN]** - Service information

## 🔍 Semantic Search Command

```bash
node dist/cli/codemind.js search "authentication" "." --intent coding
```

### Visual Output Elements:

#### Command Header
```
= SEMANTIC SEARCH =
Search codebase using intelligent semantic graph
```

#### Search Status
- **🔍 [MAGENTA]** - Semantic search initiated with query and intent
- **🧠 [BLUE]** - Initializing semantic graph...  
- **🧠 [GREEN]** - Semantic graph connected (X nodes, Y relationships)

#### Results Display
- **🔍 [GREEN]** - Search completed (duration)
- **📋 [CYAN]** - Primary results count
- **🔗 [YELLOW]** - Related concepts count  
- **🌐 [MAGENTA]** - Cross-domain insights count
- **💭 [GRAY]** - No semantic matches found

#### Detailed Results
- **Primary Results**: Bold names with type indicators
- **Related Concepts**: Name [domain] (strength%) with related file counts
- **Recommendations**: Green bullets with actionable insights

## 🎯 Context Optimization Command

```bash
node dist/cli/codemind.js context "orchestration" "." --tokens 4000
```

### Visual Output Elements:

#### Strategy Indicators
- **[🧠 Semantic]** - Using semantic graph for file prioritization
- **[📁 Standard]** - Using standard file analysis (fallback mode)

#### Results Display
- **🎯 [GREEN]** - Optimization completed
- **Strategy**: Selected optimization strategy
- **Tokens**: Used/Available token counts
- **🧠 Semantic boosts applied**: Count of files boosted by semantic relevance

#### File Priority List
```
📁 Top Priority Files:
1. src/api/server.ts [CRITICAL] 🧠 (33.000)
   Language: typescript
   Summary: Brief file description...
```

**Priority Indicators**:
- **[CRITICAL] [RED]** - Critical importance files
- **[HIGH] [YELLOW]** - High importance files
- **[MEDIUM] [BLUE]** - Medium importance files
- **[LOW] [GRAY]** - Low importance files

**Semantic Boost Indicator**:
- **🧠** - File received semantic relevance boost
- *(no indicator)* - File scored by standard analysis only

## 📊 Status Command

```bash
node dist/cli/codemind.js status
```

### Visual Output Elements:

#### Service Health Check
```
🔍 Semantic Services Health Check:
Neo4j Database: Connected
Semantic Graph: Available
Orchestrator API: Running
```

**Status Colors**:
- **Connected/Available/Running [GREEN]** - Service operational
- **Not responding/Unavailable [RED]** - Service failed
- **Warning states [YELLOW]** - Partial functionality

#### Overall Status
- **✅ All semantic services operational [GREEN]** - Everything working
- **⚠️ Some semantic services are unavailable [YELLOW]** - Limited functionality

## 🎨 Color Legend

### Background Colors
- **Command Headers**: Blue borders and titles
- **Section Headers**: Colored emojis with consistent themes

### Text Colors
- **WHITE** - Primary information (file paths, names, values)
- **CYAN** - Labels and secondary information
- **GRAY** - Metadata, timestamps, and supplementary details
- **GREEN** - Success states, positive indicators
- **YELLOW** - Warnings, medium priority items
- **RED** - Errors, critical items
- **MAGENTA** - Special features (semantic search, tools)
- **BLUE** - Process states, informational items

## 🚨 Semantic Fallback Indicators

When the semantic graph is unavailable, the CLI clearly shows fallback behavior:

### Fallback Messages
```
⚠️ Semantic graph unavailable: Neo4j connection failed
   Falling back to standard file analysis
```

### Quick Fix Suggestions
```
💡 Start services: docker-compose -f docker-compose.semantic-graph.yml up -d
```

## 📈 Progress and Performance Indicators

### Duration Tracking
- **Search completed (87ms)** - Shows semantic search performance
- **Optimization completed** - Context optimization timing

### Semantic Statistics
- **Graph Nodes: 103** - Total nodes in semantic graph
- **Graph Relationships: 39** - Total relationships in graph
- **Semantic boosts applied: 5 files** - Files that received priority boosts

## 🎯 Usage Examples

### Example 1: Successful Semantic Search
```bash
$ node dist/cli/codemind.js search "user authentication" "." --intent coding

= SEMANTIC SEARCH =
🔍 Semantic search: "user authentication" [coding]
🧠 Semantic graph connected (103 nodes, 39 relationships)
🔍 Search completed (124ms)
   📋 Primary results: 2
   🔗 Related concepts: 4

📋 Primary Results:
1. UserAuthService (code_context)
   Path: src/auth/user-auth-service.ts
   Relevance: 89.5%

🔗 Related Concepts:
1. authentication [security] (95%)
   Related: 3 code files, 2 docs

💡 Recommendations:
   • Found 2 highly relevant matches - strong semantic understanding
   • Consider reviewing related authentication patterns
```

### Example 2: Context Optimization with Semantic Boost
```bash
$ node dist/cli/codemind.js context "database operations" "." --tokens 6000

= CONTEXT OPTIMIZATION =
🎯 Context optimization: "database operations" [🧠 Semantic]
🎯 Optimization completed
   🧠 Semantic boosts applied: 7 files

📁 Top Priority Files:
1. src/database/connection.ts [CRITICAL] 🧠 (45.2)
2. src/models/user.model.ts [HIGH] 🧠 (32.1)  
3. src/config/database.config.ts [HIGH] 🧠 (28.7)
```

### Example 3: System Status Check
```bash
$ node dist/cli/codemind.js status

= SYSTEM STATUS =
🔍 Semantic Services Health Check:
Neo4j Database: Connected
Semantic Graph: Available  
Orchestrator API: Running

✅ All semantic services operational
```

## 🔧 Troubleshooting Visual Cues

### Service Down Indicators
```
❌ Neo4j Database: Not running
🚀 Quick Start Commands:
Start Neo4j: docker-compose -f docker-compose.semantic-graph.yml up -d
```

### Limited Functionality Warnings
```
⚠️ Semantic graph unavailable: Connection timeout
   Falling back to standard file analysis
   
[📁 Standard] mode activated for context optimization
```

This visual system makes it immediately clear to users:
1. **When** semantic features are active
2. **How well** they're performing  
3. **What benefits** they're providing
4. **How to fix** any issues

The semantic graph intelligence is no longer hidden - it's a visible, integral part of the CLI experience.