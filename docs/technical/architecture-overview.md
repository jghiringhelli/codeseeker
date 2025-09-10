# CodeMind Technical Architecture

## System Overview

CodeMind implements a **three-layer intelligent architecture** for comprehensive code analysis and AI-powered development assistance.

## Core Architecture

### **Layer 1: Data Intelligence**
- **PostgreSQL + pgvector**: Semantic embeddings and vector similarity search
- **Neo4j**: Code relationship graphs and dependency mapping  
- **Redis**: High-performance file caching and session management
- **MongoDB**: Project metadata and analysis history

### **Layer 2: Processing Engine**
- **Embedding Service**: Hybrid OpenAI + local embedding generation
- **Semantic Analyzer**: Multi-dimensional code feature extraction
- **Workflow Orchestrator**: Intelligent task automation and execution
- **Context Optimizer**: Token-efficient AI context management

### **Layer 3: Interface & Integration**
- **Interactive CLI**: Professional command-line interface with inquirer.js
- **Claude Code Integration**: Seamless workflow integration
- **Docker Services**: Containerized deployment and scaling
- **API Gateway**: RESTful services for external integrations

## Key Components

### **Embedding Service** (`src/services/embedding-service.ts`)
```typescript
class EmbeddingService {
  // Hybrid strategy: OpenAI primary, local fallback
  async generateProjectEmbeddings(projectId: string, files: string[])
  
  // 13-dimensional local feature extraction
  private extractLocalFeatures(content: string, language: string)
  
  // Batch processing with progress tracking
  private processBatch(files: FileData[], callback: ProgressCallback)
}
```

### **Database Schema**
```sql
-- pgvector embeddings table
CREATE TABLE semantic_search_embeddings (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_project_file UNIQUE (project_id, file_path)
);

-- HNSW index for fast similarity search
CREATE INDEX ON semantic_search_embeddings 
USING hnsw (embedding vector_cosine_ops);
```

### **CLI Workflow** (`src/cli/codemind-unified-cli.ts`)
1. **Project Initialization**: Interactive setup with feature selection
2. **File Scanning**: Recursive source code discovery
3. **Embedding Generation**: Parallel processing with progress tracking
4. **Database Population**: Multi-database data persistence
5. **Analysis Ready**: Real-time semantic search and insights

## Performance Characteristics

- **Embedding Generation**: 50-100 files/minute (local), 10-20 files/minute (OpenAI)
- **Similarity Search**: Sub-10ms queries on 100K+ embeddings via HNSW
- **Memory Usage**: ~2MB per 1000 cached files in Redis
- **Database Storage**: ~2KB per file (embedding + metadata)

## Deployment Architecture

### **Docker Services**
```yaml
services:
  codemind-database:    # PostgreSQL + pgvector
  codemind-neo4j:       # Graph database
  codemind-redis:       # Caching layer
  codemind-mongodb:     # Metadata storage
  codemind-api:         # REST API gateway
  codemind-dashboard:   # Web interface
```

### **Scaling Strategy**
- **Horizontal**: Multi-container deployment with load balancing
- **Vertical**: Memory scaling for large codebases (1M+ files)
- **Distributed**: Redis clustering for multi-tenant deployments

## Security & Compliance

- **Data Isolation**: Project-level data separation
- **API Security**: Token-based authentication for external services
- **Local Processing**: Sensitive code analysis without external API calls
- **Audit Logging**: Complete activity tracking and compliance reporting

## Integration Points

### **Claude Code Integration**
- Seamless workflow triggering from CodeMind analysis
- Context-optimized prompts for reduced token usage
- Project-aware suggestions and code generation

### **API Endpoints**
- `GET /api/projects/{id}/context` - Intelligent context extraction
- `POST /api/embeddings/search` - Semantic similarity search  
- `GET /api/analysis/{id}/suggestions` - AI-powered recommendations

## Development Roadmap

### **Immediate (v2.0)**
- ✅ Core CLI with embedding service
- ✅ Multi-database architecture
- ✅ Docker deployment

### **Q1 2025 (v2.1)**
- Advanced code relationship analysis
- Real-time collaborative features
- Performance optimization for 1M+ files

### **Q2 2025 (v3.0)**
- Plugin ecosystem for IDE integrations
- Enterprise SSO and team management
- Advanced analytics and reporting dashboard