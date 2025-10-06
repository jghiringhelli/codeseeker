# ADR-001: Granular Semantic Embeddings for Method and Class Level Analysis

## Status
Accepted

## Date
2025-01-19

## Context

CodeMind's semantic search and duplicate detection capabilities originally used file-level embeddings with arbitrary text chunking. This approach had several limitations:

1. **Poor Semantic Boundaries**: Arbitrary chunking split methods and classes across chunks, losing contextual meaning
2. **Ineffective Duplicate Detection**: File-level granularity missed duplicate methods within different files
3. **Limited Code Intelligence**: Inability to analyze relationships between individual methods and classes
4. **Misaligned with Graph Structure**: The semantic graph already contained method and class nodes, but embeddings didn't match this granularity

## Decision

We will implement a **Granular Semantic Embedding Strategy** that creates embeddings at the method and class level, aligned with our semantic graph nodes.

### Key Components:

#### 1. Method-Level Embeddings
- **Individual Method Embeddings**: Each method gets its own embedding vector
- **Semantic Context**: Include method signature, parameters, return type, and surrounding context
- **Content-Based**: Embed the actual method implementation code
- **Metadata Integration**: Include complexity metrics, visibility, and call relationships

#### 2. Class-Level Embeddings
- **Holistic Class View**: Embed entire class including all methods and properties
- **Structural Context**: Include inheritance relationships, implemented interfaces
- **Aggregate Information**: Method names, property names, class hierarchy

#### 3. Intelligent Chunking Strategy
Instead of arbitrary text splitting:
- **Semantic Boundaries**: Split by method and class boundaries
- **Context Preservation**: Maintain full method/class context
- **Hierarchical Structure**: Class embedding encompasses method embeddings

#### 4. Database Schema
```sql
-- Method-level embeddings
CREATE TABLE granular_method_embeddings (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  method_id VARCHAR(500) NOT NULL,  -- file:class:method format
  method_name VARCHAR(255) NOT NULL,
  class_name VARCHAR(255),
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  signature TEXT NOT NULL,
  embedding vector(384) NOT NULL,   -- Semantic embedding vector
  metadata JSONB NOT NULL,          -- Parameters, complexity, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, method_id)
);

-- Class-level embeddings
CREATE TABLE granular_class_embeddings (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  class_id VARCHAR(500) NOT NULL,   -- file:class format
  class_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384) NOT NULL,   -- Semantic embedding vector
  metadata JSONB NOT NULL,          -- Inheritance, methods, properties
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, class_id)
);
```

## Implementation Architecture

### GranularEmbeddingService
- **Responsibility**: Generate and manage method/class level embeddings
- **Integration**: Uses existing EmbeddingService for vector generation
- **Parsing**: Leverages CodeRelationshipParser for code structure extraction

### Enhanced Deduplication
- **Similarity Analysis**: Compare methods and classes using cosine similarity
- **Confidence Levels**: High (>90%), Medium (80-90%), Low (70-80%)
- **Merge Strategies**: Exact merge, similar consolidation, refactoring recommendations

### Alignment with Semantic Graph
- **Consistent IDs**: Method and class embeddings use same IDs as semantic graph nodes
- **Unified Analysis**: Combine graph relationships with similarity metrics
- **Enhanced Context**: Embedding similarity + relationship context = better insights

## Benefits

### 1. Precise Duplicate Detection
- **Method-Level Duplicates**: Find identical or similar methods across codebase
- **Class-Level Patterns**: Identify classes with similar structure and behavior
- **Cross-File Analysis**: Detect duplicates regardless of file boundaries

### 2. Intelligent Similarity
- **Semantic Understanding**: Embeddings capture meaning, not just text similarity
- **Context Awareness**: Method signatures and surrounding context preserved
- **Relationship Intelligence**: Combined with graph relationships for deeper analysis

### 3. Better Code Intelligence
- **Focused Analysis**: Analyze specific methods or classes in isolation
- **Hierarchical Understanding**: Class-level view with method-level detail
- **Scalable Approach**: Works with large codebases without losing granularity

### 4. Enhanced User Experience
- **Targeted Reports**: Show specific methods/classes that are duplicates
- **Interactive Merging**: Choose specific methods to merge with quality cycle
- **Contextual Recommendations**: Merge strategies based on similarity confidence

## Consequences

### Positive
- **More Accurate Duplicate Detection**: Method-level precision vs file-level approximation
- **Better Code Understanding**: Granular analysis enables deeper insights
- **Improved Performance**: Targeted similarity searches instead of full-text comparisons
- **Enhanced Automation**: Intelligent merge strategies with confidence levels

### Negative
- **Increased Storage**: More embedding vectors (one per method/class vs one per file)
- **Complex Generation**: Requires code parsing and structure analysis
- **Processing Time**: Initial embedding generation takes longer
- **Database Complexity**: Additional tables and indexes required

### Mitigation Strategies
- **Incremental Updates**: Only regenerate embeddings for changed methods/classes
- **Efficient Indexing**: Use vector indexes for fast similarity searches
- **Batch Processing**: Generate embeddings in batches to optimize performance
- **Smart Caching**: Cache frequently accessed embeddings

## Implementation Timeline

### Phase 1: Core Infrastructure ✅
- [x] GranularEmbeddingService implementation
- [x] Database schema creation
- [x] Integration with existing EmbeddingService

### Phase 2: Deduplication Engine ✅
- [x] DeduplicationService with similarity analysis
- [x] Confidence level classification
- [x] Merge strategy recommendations

### Phase 3: CLI Integration ✅
- [x] `/dedup analyze` command for comprehensive reporting
- [x] `/dedup merge` command for interactive merging
- [x] Quality cycle integration for safe merging

### Phase 4: Optimization (Future)
- [ ] Performance optimization and caching
- [ ] Advanced merge strategies
- [ ] UI dashboard for visual duplicate analysis

## Monitoring and Success Metrics

### Quality Metrics
- **Duplicate Detection Accuracy**: % of actual duplicates found vs manual review
- **False Positive Rate**: % of flagged duplicates that aren't actually duplicates
- **Merge Success Rate**: % of automated merges that pass quality checks

### Performance Metrics
- **Embedding Generation Time**: Time to process all methods/classes in a project
- **Similarity Search Performance**: Time to find similar methods/classes
- **Storage Efficiency**: Storage used per method/class embedding

### User Experience Metrics
- **Time to Find Duplicates**: End-to-end time from command to results
- **User Satisfaction**: Quality of duplicate recommendations
- **Adoption Rate**: Usage of dedup commands vs other tools

## Related Decisions
- **ADR-002**: Quality Cycle Integration for Safe Code Merging (Future)
- **ADR-003**: Vector Database Optimization Strategies (Future)

## References
- [Semantic Graph Implementation](../semantic-graph/semantic-graph-service.ts)
- [Code Relationship Parser](../code-relationship-parser.ts)
- [PostgreSQL Vector Extension](https://github.com/pgvector/pgvector)
- [Embedding Service Architecture](../embedding-service.ts)