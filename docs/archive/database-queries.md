# 🗄️ CodeMind Database Queries Guide

## PostgreSQL Queries (Use in pgAdmin)

Access: http://localhost:5050 (admin@codemind.local / codemind123)

### Essential System Queries

#### 1. Orchestration Overview
```sql
-- Get recent orchestrations
SELECT 
    id,
    workflow_type,
    status,
    priority,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (updated_at - created_at)) as duration_seconds
FROM orchestrations 
ORDER BY created_at DESC 
LIMIT 10;

-- Orchestration statistics
SELECT 
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
FROM orchestrations 
GROUP BY status
ORDER BY count DESC;
```

#### 2. External Tools Analysis
```sql
-- Tool categories and trust levels
SELECT 
    category,
    COUNT(*) as tool_count,
    AVG(trust_level::numeric) as avg_trust_level,
    MAX(trust_level::numeric) as max_trust
FROM external_tools 
GROUP BY category 
ORDER BY tool_count DESC;

-- High-trust tools by language
SELECT 
    t.name,
    t.category,
    t.trust_level,
    STRING_AGG(tl.language, ', ') as supported_languages
FROM external_tools t
LEFT JOIN tool_languages tl ON t.id = tl.tool_id
WHERE t.trust_level::numeric > 8.0
GROUP BY t.id, t.name, t.category, t.trust_level
ORDER BY t.trust_level::numeric DESC;

-- Tool installation status
SELECT 
    name,
    category,
    installation_status,
    installed_at,
    installation_metadata
FROM external_tools 
WHERE installation_status = 'installed'
ORDER BY installed_at DESC;
```

#### 3. Workflow Execution Analysis
```sql
-- Recent workflow executions
SELECT 
    we.id,
    we.orchestration_id,
    we.role_type,
    we.status,
    we.started_at,
    we.completed_at,
    o.workflow_type
FROM workflow_executions we
JOIN orchestrations o ON we.orchestration_id = o.id
ORDER BY we.started_at DESC 
LIMIT 15;

-- Performance by role type
SELECT 
    role_type,
    COUNT(*) as execution_count,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as success_count,
    ROUND(
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as success_rate
FROM workflow_executions 
WHERE completed_at IS NOT NULL
GROUP BY role_type
ORDER BY execution_count DESC;
```

#### 4. System Health Queries
```sql
-- Database size and table info
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_stat_get_tuples_inserted(c.oid) as inserts,
    pg_stat_get_tuples_updated(c.oid) as updates
FROM pg_tables pt
JOIN pg_class c ON c.relname = pt.tablename
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Recent activity
SELECT 
    'orchestrations' as table_name,
    COUNT(*) as total_records,
    MAX(created_at) as latest_record
FROM orchestrations
UNION ALL
SELECT 
    'workflow_executions' as table_name,
    COUNT(*) as total_records,
    MAX(started_at) as latest_record
FROM workflow_executions
UNION ALL
SELECT 
    'external_tools' as table_name,
    COUNT(*) as total_records,
    MAX(installed_at) as latest_record
FROM external_tools;
```

## Neo4j Queries (Use in Neo4j Browser)

Access: http://localhost:7474 (neo4j / codemind123)

### Essential Graph Queries

#### 1. Graph Overview
```cypher
// Total nodes and relationships
MATCH (n)
WITH labels(n)[0] as nodeType, count(n) as nodeCount
RETURN nodeType, nodeCount
ORDER BY nodeCount DESC;

// Relationship distribution
MATCH ()-[r]->()
WITH type(r) as relType, count(r) as relCount
RETURN relType, relCount
ORDER BY relCount DESC;

// Graph summary
MATCH (n)-[r]->(m)
RETURN 
    labels(n)[0] as sourceType, 
    type(r) as relationship, 
    labels(m)[0] as targetType, 
    count(*) as count
ORDER BY count DESC
LIMIT 10;
```

#### 2. Business Concepts Analysis
```cypher
// Most connected business concepts
MATCH (bc:BusinessConcept)
OPTIONAL MATCH (bc)-[r]-()
WITH bc, count(r) as connections
RETURN bc.name, bc.domain, connections
ORDER BY connections DESC
LIMIT 10;

// Business concepts by domain
MATCH (bc:BusinessConcept)
WITH bc.domain as domain, collect(bc.name) as concepts, count(bc) as count
RETURN domain, count, concepts
ORDER BY count DESC;

// Cross-domain concepts
MATCH (bc:BusinessConcept)-[:DEFINES]-(d:Documentation)
WITH bc, collect(DISTINCT d.type) as docTypes
WHERE size(docTypes) > 1
RETURN bc.name as concept, bc.domain, docTypes as spans_doc_types
LIMIT 10;
```

#### 3. Code-Business Alignment
```cypher
// Business concepts with code implementation
MATCH (bc:BusinessConcept)-[r:IMPLEMENTS]-(c:Code)
RETURN bc.name as concept, bc.domain, c.name as code_element, r.strength
ORDER BY r.strength DESC
LIMIT 15;

// Unimplemented business concepts
MATCH (bc:BusinessConcept)
WHERE NOT (bc)-[:IMPLEMENTS]-(:Code)
RETURN bc.name, bc.domain, bc.description
ORDER BY bc.importance DESC
LIMIT 10;

// Code without business context
MATCH (c:Code)
WHERE NOT (c)-[:IMPLEMENTS]-(:BusinessConcept)
RETURN c.name, c.type, c.language
LIMIT 10;
```

#### 4. Documentation Analysis
```cypher
// Most referenced documentation
MATCH (d:Documentation)
OPTIONAL MATCH (d)-[r]-()
WITH d, count(r) as references
RETURN d.title, d.path, d.type, references
ORDER BY references DESC
LIMIT 10;

// Documentation coverage by topic
MATCH (d:Documentation)-[:DEFINES]-(bc:BusinessConcept)
WITH bc.domain as domain, count(DISTINCT d) as doc_count, collect(DISTINCT d.type) as doc_types
RETURN domain, doc_count, doc_types
ORDER BY doc_count DESC;

// Orphaned documentation
MATCH (d:Documentation)
WHERE NOT (d)-[:DEFINES|:DESCRIBES]-()
RETURN d.title, d.path, d.type
LIMIT 10;
```

#### 5. Semantic Search Queries
```cypher
// Search for authentication-related items
MATCH (n)
WHERE ANY(prop IN keys(n) WHERE toString(n[prop]) =~ '(?i).*auth.*')
RETURN labels(n)[0] as nodeType, n.name, n.domain
LIMIT 10;

// Find related concepts (breadth-first)
MATCH (start:BusinessConcept {name: 'authentication'})
MATCH path = (start)-[*1..2]-(related)
RETURN 
    start.name as start_concept,
    [node in nodes(path) | labels(node)[0] + ': ' + node.name] as path_nodes,
    length(path) as depth
ORDER BY depth, related.name
LIMIT 15;

// Impact analysis for a concept
MATCH (bc:BusinessConcept {name: 'authentication'})
MATCH (bc)-[r*1..3]-(affected)
RETURN 
    labels(affected)[0] as affected_type,
    affected.name,
    length(r) as degrees_of_separation,
    count(*) as connection_strength
ORDER BY degrees_of_separation, connection_strength DESC
LIMIT 20;
```

## Redis Queries (Use in Redis Commander or CLI)

Access: http://localhost:8081 (admin / codemind123)

### Essential Cache Queries

```bash
# Connect to Redis CLI
redis-cli -h localhost -p 6379 -a codemind123

# View all keys
KEYS *

# Workflow-related keys
KEYS workflow:*

# Queue information
KEYS queue:*

# Cache statistics
INFO stats

# Memory usage
INFO memory

# Get workflow status
HGETALL workflow:status:latest

# Check queue lengths
LLEN queue:orchestration
LLEN queue:analysis
LLEN queue:completed

# Recent cache activity
KEYS cache:context:*
TTL cache:context:latest
GET cache:context:latest
```

## Performance Monitoring Queries

### PostgreSQL Performance
```sql
-- Connection statistics
SELECT 
    datname,
    numbackends as connections,
    xact_commit as commits,
    xact_rollback as rollbacks,
    blks_read,
    blks_hit,
    temp_files,
    temp_bytes
FROM pg_stat_database 
WHERE datname = 'codemind';

-- Slow queries (if enabled)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Table activity
SELECT 
    relname,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
ORDER BY n_tup_ins DESC;
```

### Neo4j Performance
```cypher
// Database info
CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Store file sizes") 
YIELD attributes
RETURN attributes;

// Cache statistics
CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Page cache") 
YIELD attributes
RETURN attributes;

// Transaction statistics
CALL dbms.queryJmx("org.neo4j:instance=kernel#0,name=Transactions") 
YIELD attributes
RETURN attributes;
```

## 🔍 What You Should See

### Expected Data Volumes
- **PostgreSQL**: 10-100 orchestration records, 50+ external tools
- **Neo4j**: 100+ nodes, 30+ relationships minimum
- **Redis**: 10-50 cached items, queue data

### Key Indicators of Success
1. **Orchestrations table**: Multiple completed workflows
2. **External tools**: Tools categorized with trust levels
3. **Neo4j nodes**: Business concepts connected to code and docs
4. **Redis cache**: Active workflow state and cache entries

### Performance Benchmarks
- **PostgreSQL queries**: < 100ms
- **Neo4j traversals**: < 200ms  
- **Redis operations**: < 10ms

These queries will help you understand exactly what's happening in your CodeMind system and verify that all components are working together properly.