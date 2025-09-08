# 🤖 Intelligent Tool Selection & Management System

## Overview

This document describes the comprehensive intelligent tool selection and management system implemented for CodeMind. The system automatically selects appropriate tools for each CLI request, provides enhanced context to Claude Code, and includes a web-based dashboard for tool management.

## 🏗️ Architecture Components

### 1. Intelligent Tool Selection (`src/shared/intelligent-tool-selector.ts`)

**Purpose**: Uses Claude Code to assess which tools should be used for each request, similar to MCP client tool selection.

**Key Features**:
- AI-powered tool selection based on user queries
- Tool bundle activation for common use cases
- Confidence scoring and reasoning for selections
- Fallback mechanisms when Claude Code is unavailable

**Tool Bundles**:
- **Architecture Analysis Bundle**: Deep architectural insights and design recommendations
- **Code Quality Audit Bundle**: Comprehensive code quality assessment 
- **Performance Optimization Bundle**: Performance-focused analysis tools
- **Developer Experience Bundle**: Developer productivity and navigation tools
- **Enterprise Compliance Bundle**: Enterprise standards and compliance checking

### 2. Enhanced Context Provider (`src/shared/enhanced-context-provider.ts`)

**Purpose**: Uses selected tools to generate comprehensive context for Claude Code requests.

**Key Features**:
- Multi-tool analysis orchestration
- Token-budget optimization
- Cross-tool insight generation
- Recommended actions synthesis
- Context section prioritization

**Process Flow**:
1. Select appropriate tools using IntelligentToolSelector
2. Run analysis with all selected tools
3. Generate context sections from tool results
4. Optimize within token budget
5. Generate cross-tool insights and recommendations

### 3. Change Assessment System (`src/shared/change-assessment-system.ts`)

**Purpose**: Analyzes codebase changes after CLI requests and updates all tool databases.

**Key Features**:
- Before/after project state comparison
- File and structural change detection
- Code metrics change calculation
- Claude Code integration for change analysis
- Comprehensive tool database updates

**Assessment Capabilities**:
- File additions, modifications, deletions
- Directory structure changes
- Code complexity changes
- Test coverage impact
- Overall change impact scoring

### 4. Tool Management Dashboard (`src/dashboard/tool-management-page.html`)

**Purpose**: Web interface for managing tools, bundles, and viewing analytics.

**Key Features**:
- Tool metadata editing (descriptions, trust levels, categories)
- Bundle creation and management
- Usage analytics and performance metrics
- Tool testing and validation
- Real-time status monitoring

**Dashboard Sections**:
- **Internal Tools**: View, edit, and test individual tools
- **Tool Bundles**: Manage bundles and activation keywords
- **Usage Analytics**: Tool usage patterns and effectiveness metrics

### 5. Tool Management API (`src/orchestration/tool-management-api.ts`)

**Purpose**: REST API backend for dashboard operations.

**Endpoints**:
- `GET /api/tools/list` - List all tools with status
- `PUT /api/tools/update/:toolName` - Update tool configuration
- `POST /api/tools/test/:toolName` - Test tool functionality
- `GET /api/tools/bundles` - List all tool bundles
- `PUT /api/tools/bundles/:bundleId` - Update bundle configuration
- `GET /api/tools/analytics` - Get usage analytics
- `POST /api/tools/selection/test-query` - Test tool selection

## 🔄 Integration Points

### CLI Integration (`src/cli/codemind.ts`)

**Enhanced Commands**:
- **Search Command**: Now includes tool selection and context provision
- **Context Command**: Uses intelligent tool selection for optimization
- **All Commands**: Include comprehensive change assessment

**New Functions**:
- `provideEnhancedContext()`: Generates tool-enhanced context before requests
- `assessChangesAndUpdateAllTools()`: Post-request analysis and tool updates

### Orchestrator Integration (`src/orchestration/orchestrator-server.ts`)

**New API Routes**:
- Tool management endpoints integrated
- Tool selection testing capabilities
- Analytics data endpoints

## 🚀 Usage Examples

### 1. Automatic Tool Selection

```typescript
const selectionRequest = {
  userQuery: "analyze architecture and find performance issues",
  projectPath: "/path/to/project",
  projectId: "proj123",
  cliCommand: "analyze",
  intent: "architecture"
};

const result = await toolSelector.selectToolsForRequest(selectionRequest);
// Result: Architecture Analysis Bundle activated
// Selected: context-optimizer, centralization-detector, semantic-search
```

### 2. Enhanced Context Generation

```typescript
const contextRequest = {
  userQuery: "refactor authentication system",
  projectPath: "/path/to/project",
  projectId: "proj123",
  cliCommand: "context",
  intent: "refactoring",
  tokenBudget: 4000
};

const context = await contextProvider.generateEnhancedContext(contextRequest);
// Result: Rich context from multiple tools within token budget
// Includes: cross-tool insights, recommended actions, prioritized content
```

### 3. Change Assessment

```typescript
const assessmentRequest = {
  projectPath: "/path/to/project",
  projectId: "proj123",
  cliCommand: "refactor auth",
  userQuery: "refactor authentication system",
  claudeCodeResult: { /* ... */ }
};

const assessment = await changeAssessment.assessChangesAndUpdateTools(assessmentRequest);
// Result: All tools updated with change information
// Includes: impact analysis, tool-specific updates, assessment summary
```

## 📊 Analytics & Monitoring

### Tool Usage Metrics
- Selection frequency and confidence scores
- Success rates and effectiveness measurements
- Cross-tool correlation analysis
- Bundle activation patterns

### Performance Monitoring
- Tool execution times
- Context generation efficiency
- Token usage optimization
- Change assessment accuracy

## 🔧 Configuration

### Tool Bundle Configuration

```typescript
const customBundle = {
  id: 'custom-security-audit',
  name: 'Security Audit Bundle',
  description: 'Comprehensive security analysis tools',
  requiredTools: ['security-scanner', 'vulnerability-detector'],
  optionalTools: ['compliance-checker', 'code-quality-analyzer'],
  activationKeywords: ['security', 'audit', 'vulnerability', 'secure'],
  priority: 9,
  useCase: 'When security analysis is the primary concern'
};
```

### Tool Metadata Customization

```typescript
const toolMetadata = {
  name: 'custom-analyzer',
  category: 'quality',
  trustLevel: 8.5,
  description: 'Custom code quality analyzer with advanced heuristics',
  capabilities: ['quality-scoring', 'best-practices', 'maintainability'],
  dependencies: ['semantic-graph']
};
```

## 🎯 Benefits

### For Users
- **Intelligent Automation**: Tools are automatically selected based on context
- **Rich Context**: Enhanced information provided before each request
- **Continuous Learning**: System improves based on usage patterns
- **Comprehensive Analysis**: All tools provide insights, not just selected ones
- **Visual Management**: Web dashboard for tool configuration

### For Developers
- **Easy Extension**: Add new tools by implementing the InternalTool interface
- **Bundle System**: Group tools for common use cases
- **Analytics Integration**: Track tool effectiveness and usage
- **Flexible Configuration**: Customize tool behavior through dashboard
- **Change Tracking**: Automatic updates based on code modifications

## 🔮 Future Enhancements

### Planned Features
- **Machine Learning**: Tool selection optimization based on historical data
- **Custom Tool Creation**: Visual tool builder in dashboard
- **Advanced Analytics**: Predictive insights and trend analysis
- **Integration Hooks**: External tool integration capabilities
- **Performance Optimization**: Parallel tool execution and caching

### Extensibility Points
- **Tool Plugin System**: Third-party tool integration
- **Custom Bundle Templates**: User-defined bundle patterns
- **API Integrations**: External service connectors
- **Workflow Automation**: Multi-step tool orchestration
- **Real-time Collaboration**: Team-based tool sharing

## 🚦 Getting Started

### Prerequisites
- CodeMind orchestrator running on port 3006
- PostgreSQL database for tool metadata
- Neo4j for semantic graph (optional)
- Claude Code API access (optional, with fallbacks)

### Quick Start

1. **Initialize Project with Tools**:
```powershell
.\scripts\init-project.ps1 -ProjectPath "." -VerboseOutput
```

2. **Access Dashboard**:
```
http://localhost:3003/tool-management-page.html
```

3. **Test Tool Selection**:
```bash
node dist/cli/codemind.js search "architecture review" ./project --intent architecture
```

### Configuration Files
- `CLAUDE.md`: Project-specific tool configuration
- `src/shared/tool-bundles.json`: Custom bundle definitions
- `.env`: Environment variables for API endpoints

The intelligent tool selection system transforms CodeMind from a static tool collection into a dynamic, learning platform that adapts to user needs and continuously improves its recommendations.