# MongoDB Integration Guide

This guide covers the comprehensive MongoDB integration in CodeMind, providing flexible document storage for complex, nested data that doesn't fit well in relational models.

## Overview

CodeMind uses a **hybrid database architecture**:

- **PostgreSQL**: Operational data, metadata, relationships
- **MongoDB**: Complex configurations, analysis results, project intelligence  
- **Neo4j**: Graph relationships and semantic connections
- **Redis**: Caching and real-time messaging
- **DuckDB**: Analytics and metrics (columnar storage)

## MongoDB Collections

### 1. Tool Configurations (`tool_configs`)

Stores flexible tool configurations with inheritance support.

```javascript
{
  projectId: "uuid-string",
  toolName: "semantic-search",
  config: {
    embeddingModel: "text-embedding-ada-002",
    chunkSize: 4000,
    similarity: "cosine",
    cacheEnabled: true,
    frameworks: ["react", "nodejs"]
  },
  version: "1.0.0",
  updatedAt: ISODate,
  inheritFrom: "default", // Optional inheritance
  overrides: {} // Project-specific overrides
}
```

**Key Features:**
- Configuration inheritance from defaults
- Project-specific overrides
- Framework-based configuration discovery
- Version tracking and history

### 2. Analysis Results (`analysis_results`)

Stores complex, nested analysis results with full-text search.

```javascript
{
  projectId: "uuid-string",
  toolName: "solid-principles",
  timestamp: ISODate,
  analysis: {
    data: [...], // Tool-specific analysis data
    summary: "Found 3 SOLID principle violations",
    recommendations: [...]
  },
  summary: "Found 3 SOLID principle violations", // Extracted for search
  fileCount: 15,
  hasIssues: true,
  tags: ["typescript", "solid", "violations"],
  metrics: {
    executionTime: 2341,
    filesProcessed: 15,
    issuesFound: 3,
    complexity: 7.2
  }
}
```

**Key Features:**
- Full-text search across analysis content
- Automatic tag extraction and indexing
- Metrics tracking and trend analysis
- TTL-based automatic cleanup (90 days)

### 3. Project Intelligence (`project_intelligence`)

Stores intelligent project context and recommendations.

```javascript
{
  projectId: "uuid-string",
  context: {
    languages: ["typescript", "javascript"],
    frameworks: ["react", "express"],
    projectType: "web_application",
    fileStructure: {
      entryPoints: ["src/index.tsx"],
      configFiles: ["package.json", "tsconfig.json"],
      testDirectories: ["tests/", "src/__tests__/"]
    },
    patterns: {
      architectural: ["Component-Based", "MVC"],
      design: ["Factory", "Observer"]
    },
    complexity: "medium",
    recommendedTools: [
      "semantic-search",
      "solid-principles", 
      "ui-navigation"
    ],
    metrics: {
      totalFiles: 245,
      totalLines: 12450,
      dependencies: 45
    }
  },
  lastUpdated: ISODate,
  version: 3,
  history: [...] // Previous versions for change tracking
}
```

**Key Features:**
- Automatic project analysis and categorization
- Intelligent tool recommendations
- Similarity matching between projects
- Learning from successful tool executions

### 4. Knowledge Repository (`knowledge_repository`)

Stores project documentation and knowledge articles.

```javascript
{
  projectId: "uuid-string",
  type: "readme", // readme, documentation, comment, guide, api
  title: "Authentication System Guide",
  content: "# Authentication\n\nThis system uses JWT...",
  metadata: {
    language: "markdown",
    author: "developer",
    lastUpdated: ISODate
  },
  searchableText: "authentication system jwt tokens...",
  relatedFiles: ["src/auth/", "src/middleware/auth.ts"],
  tags: ["auth", "jwt", "security"],
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### 5. Workflow States (`workflow_states`)

Tracks complex workflow execution states.

```javascript
{
  workflowId: "workflow-exec-123",
  projectId: "uuid-string", 
  status: "running", // pending, running, completed, failed, paused
  currentStep: 3,
  steps: [
    {
      stepId: 1,
      name: "file-discovery",
      status: "completed",
      startTime: ISODate,
      endTime: ISODate,
      output: {
        filesDiscovered: 245,
        relevantFiles: [...]
      }
    },
    {
      stepId: 2,
      name: "semantic-analysis",
      status: "running", 
      progress: 0.67
    }
  ],
  dynamicContext: {
    adaptiveSettings: { batchSize: 50 }
  }
}
```

## Usage Examples

### Tool Configuration Management

```typescript
import { toolConfigRepo } from '../shared/tool-config-repository';

// Save tool configuration
await toolConfigRepo.saveToolConfig(projectId, 'semantic-search', {
  embeddingModel: 'text-embedding-ada-002',
  chunkSize: 4000,
  cacheEnabled: true
});

// Get configuration with fallback to defaults
const config = await toolConfigRepo.getToolConfig(projectId, 'semantic-search');

// Initialize all default configs for a new project
await toolConfigRepo.initializeProjectConfigs(projectId);

// Find configurations for React projects
const reactConfigs = await toolConfigRepo.getConfigsByFramework('react');
```

### Analysis Results Storage

```typescript
import { analysisRepo } from '../shared/analysis-repository';

// Store complex analysis result
const resultId = await analysisRepo.storeAnalysis(projectId, 'solid-principles', {
  data: analysisData,
  analysis: complexAnalysis,
  executionTime: 2341,
  parameters: toolParameters
});

// Search analysis results
const searchResults = await analysisRepo.searchAnalysis(projectId, 'authentication issues');

// Get analysis trends
const trends = await analysisRepo.getAnalysisTrends(projectId, 'solid-principles', 7);

// Get latest analysis for each tool
const latestAnalyses = await analysisRepo.getLatestAnalyses(projectId);
```

### Project Intelligence

```typescript
import { projectIntelligence } from '../shared/project-intelligence';

// Analyze project from file list
const context = await projectIntelligence.analyzeProject(
  projectId, 
  projectPath, 
  fileList
);

// Get intelligent tool recommendations
const recommendedTools = await projectIntelligence.getRecommendedTools(projectId);

// Find similar projects for learning
const similarProjects = await projectIntelligence.findSimilarProjects(context, 5);

// Learn from successful tool executions
await projectIntelligence.learnFromToolExecution(
  projectId,
  'semantic-search',
  true, // success
  1500  // execution time
);
```

## Enhanced Tool Integration

Tools automatically integrate with MongoDB through the enhanced tool interface:

```typescript
export class MyAnalysisTool extends EnhancedAnalysisTool {
  async analyze(projectPath: string, projectId: string, parameters?: any) {
    // 1. Automatically loads tool configuration from MongoDB
    // 2. Performs analysis with intelligent caching
    // 3. Stores results in both PostgreSQL and MongoDB
    // 4. Records performance metrics
    // 5. Updates project intelligence
    
    return await super.analyze(projectPath, projectId, parameters);
  }
}
```

## Database Administration

### Initialization

```bash
# Initialize all databases including MongoDB
npm run init-databases

# Start with Docker Compose (includes MongoDB)
docker-compose up -d

# Initialize MongoDB collections and indexes
node scripts/mongo-init.js
```

### Monitoring

```bash
# Connect to MongoDB
mongosh mongodb://codemind:codemind123@localhost:27017/codemind?authSource=admin

# Check collection sizes
db.stats()

# View recent analysis results
db.analysis_results.find().sort({timestamp: -1}).limit(5)

# Search for specific configurations
db.tool_configs.find({"config.frameworks": "react"})
```

### Backup and Restore

```bash
# Backup MongoDB data
mongodump --uri="mongodb://codemind:codemind123@localhost:27017/codemind?authSource=admin" --out=/backup

# Restore MongoDB data  
mongorestore --uri="mongodb://codemind:codemind123@localhost:27017/codemind?authSource=admin" /backup/codemind
```

## Performance Considerations

### Indexing Strategy

The MongoDB collections use strategic indexes:

- **Compound indexes** on frequently queried field combinations
- **Text indexes** for full-text search across content
- **TTL indexes** for automatic data cleanup
- **Sparse indexes** on optional fields

### Query Optimization

- **Projection**: Only fetch required fields
- **Aggregation pipelines**: For complex analysis queries
- **Caching**: Frequently accessed data is cached in memory
- **Batch operations**: For bulk inserts and updates

### Scaling Considerations

- **Connection pooling**: Managed by the MongoDB client
- **Read preferences**: Configure for read replicas if needed
- **Sharding**: Consider for very large datasets
- **Archival**: Old data can be archived to cheaper storage

## Security

- **Authentication**: Required for all connections
- **Authorization**: Role-based access control
- **Encryption**: TLS for connections, encryption at rest
- **Network isolation**: Containers communicate on private network

## Troubleshooting

### Common Issues

1. **Connection Errors**
   ```bash
   # Check MongoDB is running
   docker ps | grep mongodb
   
   # Check logs
   docker logs codemind-mongodb
   ```

2. **Collection Not Found**
   ```bash
   # Reinitialize database
   npm run init-databases
   ```

3. **Performance Issues**
   ```javascript
   // Check slow queries
   db.setProfilingLevel(2)
   db.system.profile.find().sort({ts: -1}).limit(5)
   ```

4. **Storage Issues**
   ```bash
   # Check disk usage
   df -h
   
   # Clean up old data
   db.analysis_results.deleteMany({
     timestamp: { $lt: new Date(Date.now() - 90*24*60*60*1000) }
   })
   ```

## Migration from PostgreSQL JSON

If migrating existing JSON data from PostgreSQL:

```typescript
// Migration script example
async function migrateAnalysisResults() {
  const pgResults = await pg.query('SELECT * FROM tool_data WHERE tool_name = $1', ['semantic-search']);
  
  for (const row of pgResults.rows) {
    await analysisRepo.storeAnalysis(
      row.project_id,
      row.tool_name,
      JSON.parse(row.data)
    );
  }
}
```

## Best Practices

1. **Use appropriate data types** for MongoDB fields
2. **Index frequently queried fields** but avoid over-indexing
3. **Use aggregation pipelines** for complex queries
4. **Implement proper error handling** and connection management
5. **Monitor performance** and optimize queries
6. **Use TTL indexes** for automatic data cleanup
7. **Consider data archival** strategies for long-term storage
8. **Test with realistic data volumes** during development

This MongoDB integration provides CodeMind with the flexibility to handle complex, evolving data structures while maintaining excellent query performance and intelligent learning capabilities.