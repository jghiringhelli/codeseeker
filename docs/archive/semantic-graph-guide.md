# CodeMind Semantic Graph System

## 🧠 Overview

CodeMind now includes a powerful semantic graph system that provides intelligent knowledge representation and search capabilities. This system uses Neo4j to create relationships between business concepts, code, documentation, UI components, and tests.

## ✨ Features

### 🔗 Unified Knowledge Base
- **Business Concepts**: Extracted from documentation and mapped to code
- **Cross-Domain Analysis**: Understanding relationships across frontend, backend, security, etc.
- **Impact Analysis**: Understand the ripple effects of code changes
- **Semantic Search**: Find related concepts and code intelligently

### 🎯 Node Types
- **Code**: Classes, functions, and code files
- **Documentation**: README files, guides, and technical docs
- **BusinessConcept**: Domain concepts extracted from documentation
- **UIComponent**: Frontend components and interfaces
- **TestCase**: Test files and test scenarios

### 🔄 Relationship Types
- **IMPLEMENTS**: Code that implements a business concept
- **DESCRIBES**: Documentation that describes code or concepts
- **USES**: Code that uses other code or components
- **TESTS**: Tests that verify functionality
- **RELATES_TO**: General conceptual relationships
- **DEPENDS_ON**: Dependency relationships

## 🚀 Getting Started

### Prerequisites
- Docker (for Neo4j)
- Node.js 18+
- CodeMind project setup

### Quick Start

1. **Start Neo4j Container**:
   ```bash
   docker-compose -f docker-compose.semantic-graph.yml up -d
   ```

2. **Initialize the Semantic Graph**:
   ```bash
   node scripts/init-semantic-graph.js
   ```

3. **Start the Dashboard**:
   ```powershell
   ./scripts/start-semantic-dashboard.ps1
   ```

4. **Access the Dashboard**:
   - Main Dashboard: http://localhost:3003
   - Semantic Graph: http://localhost:3005/dashboard/semantic-graph
   - Neo4j Browser: http://localhost:7474 (neo4j/codemind123)

## 🎨 Dashboard Features

### Interactive Graph Visualization
- **Node Exploration**: Click nodes to see details and relationships
- **Search & Filter**: Find specific concepts or code elements
- **Impact Analysis**: Analyze change effects across the codebase
- **Real-time Statistics**: Monitor graph growth and health

### Search Capabilities
- **Semantic Search**: Natural language queries to find related concepts
- **Type Filtering**: Filter by node types (Code, Documentation, etc.)
- **Domain Filtering**: Focus on specific domains (frontend, backend, security)

### Analytics
- **Graph Statistics**: Node counts, relationship distributions
- **Concept Clusters**: Related concept groupings
- **Cross-Domain Insights**: Concepts spanning multiple domains

## 🔧 API Endpoints

### Graph Statistics
```bash
GET /api/semantic-graph/statistics
```

### Search
```bash
GET /api/semantic-graph/search?q=authentication&limit=10
```

### Node Exploration
```bash
GET /api/semantic-graph/explore/{nodeId}?depth=2
```

### Impact Analysis
```bash
GET /api/semantic-graph/impact/{nodeId}?depth=3
```

### Cross References
```bash
GET /api/semantic-graph/cross-references/{conceptName}
```

## 🏗️ Integration with CodeMind Tools

### Enhanced Document Analyzer
The `EnhancedDocumentMapAnalyzer` now populates the semantic graph with:
- Business concepts extracted from documentation
- Code-to-documentation relationships
- Cross-references between documents

### Semantic Orchestrator
Every analysis request now includes semantic context:
```typescript
const orchestrator = new SemanticOrchestrator();
const result = await orchestrator.analyzeWithSemanticContext({
  query: "user authentication",
  intent: "coding",
  projectPath: "/path/to/project"
});
```

### Intent-Based Analysis
- **overview**: High-level project understanding
- **coding**: Code-focused context for development
- **architecture**: Architectural insights and patterns
- **debugging**: Impact analysis and change effects
- **research**: Comprehensive concept exploration

## 🎯 Use Cases

### 1. Code Understanding
Find all code related to "authentication":
```javascript
const results = await semanticGraph.semanticSearch("authentication", {
  includeTypes: ['Code', 'BusinessConcept']
});
```

### 2. Impact Analysis
Understand what's affected by changing a specific class:
```javascript
const impact = await semanticGraph.analyzeImpact(nodeId, 3);
console.log(`Risk Level: ${impact.riskLevel}`);
console.log(`Affected Files: ${impact.impact.codeFiles}`);
```

### 3. Documentation Coverage
Find business concepts without code implementation:
```javascript
const crossRefs = await semanticGraph.findCrossReferences("user management");
if (crossRefs.relatedCode.length === 0) {
  console.log("Concept needs implementation");
}
```

### 4. Architecture Analysis
Get enhanced documentation analysis with semantic insights:
```javascript
const analyzer = new EnhancedDocumentMapAnalyzer();
const result = await analyzer.analyzeDocumentationWithSemantics({
  projectPath: "./",
  generateMermaid: true
});
```

## 📊 Graph Schema

### Node Properties
- **Code Nodes**: `name`, `type`, `path`, `language`, `description`
- **Documentation Nodes**: `title`, `path`, `summary`, `wordCount`, `topics`
- **Business Concept Nodes**: `name`, `domain`, `description`, `keywords`

### Relationship Properties
- **strength**: Relationship strength (0-1)
- **context**: Contextual information
- **type**: Additional relationship metadata

## 🔍 Advanced Queries

### Find Related Concepts
```cypher
MATCH (concept:BusinessConcept {name: "authentication"})
MATCH (concept)-[r]-(related)
RETURN concept, r, related
```

### Cross-Domain Analysis
```cypher
MATCH (c:BusinessConcept)-[:IMPLEMENTS]-(code:Code)
MATCH (c)-[:DEFINES]-(doc:Documentation)
WHERE c.domain <> code.domain
RETURN c.name as concept, collect(DISTINCT code.domain) as codeDomains, collect(DISTINCT doc.type) as docTypes
```

### Impact Analysis Query
```cypher
MATCH (start:Code {name: "UserService"})-[r*1..3]-(affected)
RETURN start, collect(affected) as impacted, count(affected) as impactCount
```

## 🛠️ Development

### Adding New Node Types
1. Update `NodeType` enum in `semantic-graph.ts`
2. Add indexing in `ensureIndexes()`
3. Update dashboard visualization styles

### Custom Relationship Types
1. Update `RelationshipType` enum
2. Add relationship creation logic in analyzers
3. Update impact analysis calculations

### Performance Optimization
- Use appropriate indexes for frequently queried properties
- Limit traversal depth for large graphs
- Implement caching for expensive queries

## 🐛 Troubleshooting

### Neo4j Connection Issues
```bash
# Check if Neo4j is running
docker ps | grep neo4j

# Restart Neo4j
docker-compose -f docker-compose.semantic-graph.yml restart
```

### Graph Not Populating
```bash
# Re-initialize the graph
node scripts/init-semantic-graph.js

# Check graph statistics
curl http://localhost:3005/api/semantic-graph/statistics
```

### Dashboard Not Loading
```bash
# Check API health
curl http://localhost:3005/api/semantic-graph/health

# Restart semantic graph API
node src/dashboard/semantic-graph-api.js
```

## 📚 Additional Resources

- [Neo4j Cypher Reference](https://neo4j.com/docs/cypher-manual/current/)
- [D3.js Force Simulation](https://github.com/d3/d3-force)
- [CodeMind Architecture Documentation](./architecture/system-architecture.md)

## 🤝 Contributing

When adding new features to the semantic graph:

1. Update the relevant analyzer to populate new node types
2. Add corresponding API endpoints if needed
3. Update dashboard visualization for new node types
4. Add tests for new functionality
5. Update this documentation

## 🔮 Future Enhancements

- **ML-Powered Insights**: Use machine learning for better concept extraction
- **Version Tracking**: Track changes in the semantic graph over time
- **Integration with IDEs**: Direct IDE integration for semantic navigation
- **Advanced Visualizations**: 3D graph visualization, timeline views
- **Collaborative Features**: Multi-user semantic annotation