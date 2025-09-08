# 🚀 CodeMind Complete Setup and Testing Guide

## 📋 Overview

This guide will help you set up the complete CodeMind environment with all services running in Docker, initialize everything properly, and test each component including the semantic graph integration.

## 🏗️ Architecture Overview

### Services Stack
1. **PostgreSQL** (port 5432) - Main database
2. **Redis** (port 6379) - Cache and message queue
3. **Neo4j** (ports 7474/7687) - Semantic graph database
4. **Dashboard** (port 3003) - Web interface
5. **Semantic API** (port 3005) - Graph API server
6. **Orchestrator** (port 3006) - Main orchestration server
7. **pgAdmin** (port 5050) - Database management
8. **Redis Commander** (port 8081) - Redis management

## 🛠️ Step-by-Step Setup

### Step 1: Prepare the Environment

```bash
cd C:\workspace\claude\CodeMind

# Compile TypeScript
npx tsc

# Ensure all required files exist
ls docker-compose.full-stack.yml
ls docker/dashboard.Dockerfile
ls docker/orchestrator.Dockerfile
ls docker/semantic-api.Dockerfile
```

### Step 2: Start All Services

```bash
# Stop any existing services
docker-compose -f docker-compose.full-stack.yml down

# Start the complete stack
docker-compose -f docker-compose.full-stack.yml up -d

# Check service status
docker ps --filter label=project=codemind
```

**Expected Output:**
```
CONTAINER ID   IMAGE                    COMMAND                  CREATED         STATUS                   PORTS                    NAMES
abc123...      codemind-orchestrator    "node dist/orchestr…"   2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:3006->3006/tcp   codemind-orchestrator
def456...      codemind-semantic-api    "node src/dashboard…"   2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:3005->3005/tcp   codemind-semantic-api
ghi789...      codemind-dashboard       "node src/dashboard…"   2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:3003->3003/tcp   codemind-dashboard
jkl012...      neo4j:5.15-community    "/sbin/tini -g -- /d…"   2 minutes ago   Up 2 minutes (healthy)   7473/tcp, 0.0.0.0:7474->7474/tcp, 0.0.0.0:7687->7687/tcp   codemind-neo4j
mno345...      postgres:15              "docker-entrypoint.s…"  2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:5432->5432/tcp   codemind-postgres
pqr678...      redis:7-alpine           "docker-entrypoint.s…"  2 minutes ago   Up 2 minutes (healthy)   0.0.0.0:6379->6379/tcp   codemind-redis
stu901...      dpage/pgadmin4:latest    "/entrypoint.sh"        2 minutes ago   Up 2 minutes             0.0.0.0:5050->80/tcp     codemind-pgadmin
vwx234...      rediscommander           "node ./bin/redis-co…"  2 minutes ago   Up 2 minutes             0.0.0.0:8081->8081/tcp   codemind-redis-commander
```

### Step 3: Initialize the Semantic Graph

```bash
# Initialize the semantic graph with project data
node scripts/init-semantic-graph.js

# Verify the initialization
curl http://localhost:3005/api/semantic-graph/statistics
```

**Expected Response:**
```json
{
  "total_nodes": 103,
  "total_relationships": 39,
  "node_distribution": [
    {"label": "BusinessConcept", "count": 61},
    {"label": "Code", "count": 12},
    {"label": "Documentation", "count": 30}
  ],
  "relationship_distribution": [
    {"type": "DEFINES", "count": 33},
    {"type": "IMPLEMENTS", "count": 6}
  ]
}
```

### Step 4: Health Check All Services

```bash
# Test all health endpoints
echo "=== Dashboard Health ==="
curl http://localhost:3003/health

echo -e "\n=== Semantic API Health ==="
curl http://localhost:3005/api/semantic-graph/health

echo -e "\n=== Orchestrator Health ==="
curl http://localhost:3006/health

echo -e "\n=== Neo4j Health ==="
curl http://localhost:7474/

echo -e "\n=== PostgreSQL Health ==="
pg_isready -h localhost -p 5432 -U codemind -d codemind

echo -e "\n=== Redis Health ==="
redis-cli -h localhost -p 6379 -a codemind123 ping
```

## 🧪 Testing Each Component

### 1. Test CLI Commands

#### Status Check
```bash
node dist/cli/codemind.js status
```
**Expected Output:**
```
= SYSTEM STATUS =
Check all CodeMind services and semantic graph health

Orchestrator Status: healthy
Uptime: 123s
Graph Nodes: 103
Graph Relationships: 39

🔍 Semantic Services Health Check:
Neo4j Database: Connected
Semantic Graph: Available
Orchestrator API: Running

✅ All semantic services operational
```

#### Semantic Search Test
```bash
node dist/cli/codemind.js search "authentication" "." --intent coding --max-results 5
```
**Expected Output:**
```
= SEMANTIC SEARCH =
🔍 Semantic search: "authentication" [coding]
🧠 Semantic graph connected (103 nodes, 39 relationships)
🔍 Search completed (87ms)
   🔗 Related concepts: 4

🔗 Related Concepts:
1. authentication [security] (100%)
   Related: 3 code files, 2 docs
2. user management [security] (85%)
   Related: 2 code files, 1 docs

💡 Recommendations:
   • Found 4 highly relevant matches - strong semantic understanding
   • No direct code matches - check documentation for implementation guidance
```

#### Context Optimization Test
```bash
node dist/cli/codemind.js context "database operations" "." --tokens 4000 --strategy smart
```
**Expected Output:**
```
= CONTEXT OPTIMIZATION =
🎯 Context optimization: "database operations" [🧠 Semantic]
🎯 Optimization completed
   🧠 Semantic boosts applied: 3 files

📁 Top Priority Files:
1. src/database/database.ts [CRITICAL] 🧠 (45.2)
2. src/orchestration/orchestrator-server.ts [HIGH] 🧠 (32.1)
3. src/database/schema.postgres.sql [HIGH] (28.7)
```

### 2. Test Dashboard Interface

Open your browser and visit:
- **Main Dashboard**: http://localhost:3003
- **Semantic Graph Visualization**: http://localhost:3005/dashboard/semantic-graph

**What you should see:**
1. **Main Dashboard**: CodeMind interface with navigation tabs
2. **Semantic Graph**: Interactive D3.js visualization with nodes and relationships
3. **Graph Statistics**: Real-time node and relationship counts
4. **Search functionality**: Working semantic search interface

### 3. Test Database Integration

#### PostgreSQL via pgAdmin
1. Open http://localhost:5050
2. Login: `admin@codemind.local` / `codemind123`
3. Connect to CodeMind PostgreSQL server (already configured)

**Essential Queries to Run:**

```sql
-- Check orchestration data
SELECT * FROM orchestrations ORDER BY created_at DESC LIMIT 5;

-- Check external tools
SELECT * FROM external_tools ORDER BY trust_level DESC;

-- Check workflow executions
SELECT * FROM workflow_executions WHERE status = 'completed' LIMIT 10;

-- Get tool recommendations statistics
SELECT category, COUNT(*) as tool_count, AVG(trust_level::numeric) as avg_trust
FROM external_tools 
GROUP BY category 
ORDER BY tool_count DESC;
```

**Expected Results:**
- `orchestrations` table should have sample orchestration records
- `external_tools` table should contain various development tools
- `workflow_executions` table should show completed workflows

#### Redis via Redis Commander
1. Open http://localhost:8081
2. Login: `admin` / `codemind123`

**Keys to Check:**
```bash
# Check Redis keys
redis-cli -h localhost -p 6379 -a codemind123 keys "*"
```

**Expected Keys:**
- `workflow:*` - Workflow state data
- `queue:*` - Message queue data
- `cache:*` - Cached analysis results

### 4. Test Neo4j Semantic Graph

#### Via Neo4j Browser
1. Open http://localhost:7474
2. Login: `neo4j` / `codemind123`

**Essential Cypher Queries:**

```cypher
// Check all node types
MATCH (n) RETURN labels(n)[0] as nodeType, count(n) as count ORDER BY count DESC;

// Find authentication-related concepts
MATCH (bc:BusinessConcept)
WHERE toLower(bc.name) CONTAINS 'auth'
RETURN bc.name, bc.domain, bc.description;

// Show concept-to-code relationships
MATCH (bc:BusinessConcept)-[r:IMPLEMENTS]-(c:Code)
RETURN bc.name as concept, c.name as code, type(r) as relationship
LIMIT 10;

// Find cross-domain insights
MATCH (bc:BusinessConcept)-[:DEFINES]-(d:Documentation)
WHERE bc.domain <> 'general'
RETURN bc.name as concept, bc.domain, count(d) as doc_count
ORDER BY doc_count DESC
LIMIT 5;

// Graph overview
MATCH (n)-[r]->(m)
RETURN labels(n)[0] as source, type(r) as relationship, labels(m)[0] as target, count(*) as count
ORDER BY count DESC;
```

**Expected Results:**
- ~103 total nodes (BusinessConcept, Code, Documentation)
- ~39 relationships (DEFINES, IMPLEMENTS, RELATES_TO)
- Authentication concepts with security domain
- Cross-references between documentation and code

### 5. Test API Endpoints

#### Orchestrator API
```bash
# Get semantic context
curl "http://localhost:3006/api/semantic/context/C%3A%5Cworkspace%5Cclaude%5CCodeMind?intent=overview&maxTokens=800"

# Semantic search
curl "http://localhost:3006/api/semantic/search/C%3A%5Cworkspace%5Cclaude%5CCodeMind?query=database&intent=coding&maxResults=5"

# Tool recommendations
curl "http://localhost:3006/api/tools/recommendations/C%3A%5Cworkspace%5Cclaude%5CCodeMind"
```

#### Semantic Graph API
```bash
# Graph statistics
curl http://localhost:3005/api/semantic-graph/statistics

# Node exploration
curl "http://localhost:3005/api/semantic-graph/nodes?limit=5"

# Search functionality
curl "http://localhost:3005/api/semantic-graph/search?q=authentication&limit=3"
```

## 🔍 Troubleshooting Guide

### Service Not Starting
```bash
# Check service logs
docker logs codemind-orchestrator
docker logs codemind-semantic-api
docker logs codemind-neo4j

# Restart specific service
docker-compose -f docker-compose.full-stack.yml restart codemind-orchestrator
```

### Database Connection Issues
```bash
# Test database connectivity
docker exec -it codemind-postgres psql -U codemind -d codemind -c "SELECT version();"

# Test Neo4j connectivity
docker exec -it codemind-neo4j cypher-shell -u neo4j -p codemind123 "RETURN 'Neo4j is working' as status;"
```

### Semantic Graph Issues
```bash
# Check graph initialization
curl http://localhost:3005/api/semantic-graph/health

# Re-initialize if needed
node scripts/init-semantic-graph.js

# Check node counts
curl http://localhost:3005/api/semantic-graph/statistics
```

## 📊 Performance Benchmarks

### Expected Response Times
- **CLI Status Check**: < 2 seconds
- **Semantic Search**: < 500ms
- **Context Optimization**: < 3 seconds
- **Graph Visualization Load**: < 2 seconds
- **Database Queries**: < 100ms

### Expected Resource Usage
- **Total Memory**: ~2-3 GB
- **CPU Usage**: < 10% (idle)
- **Disk Space**: ~500 MB (with data)

## 🧪 Complete Test Script

```bash
#!/bin/bash
# Complete CodeMind Test Suite

echo "🚀 Starting CodeMind Complete Test Suite"

# 1. Health Checks
echo "1️⃣ Testing service health..."
curl -f http://localhost:3003/health && echo " ✅ Dashboard OK" || echo " ❌ Dashboard FAIL"
curl -f http://localhost:3005/api/semantic-graph/health && echo " ✅ Semantic API OK" || echo " ❌ Semantic API FAIL"
curl -f http://localhost:3006/health && echo " ✅ Orchestrator OK" || echo " ❌ Orchestrator FAIL"

# 2. CLI Tests
echo "2️⃣ Testing CLI commands..."
node dist/cli/codemind.js status > /dev/null && echo " ✅ CLI Status OK" || echo " ❌ CLI Status FAIL"
node dist/cli/codemind.js search "test" "." --max-results 1 > /dev/null && echo " ✅ CLI Search OK" || echo " ❌ CLI Search FAIL"

# 3. API Tests
echo "3️⃣ Testing API endpoints..."
curl -f "http://localhost:3006/api/semantic/context/." > /dev/null && echo " ✅ Semantic Context OK" || echo " ❌ Semantic Context FAIL"
curl -f http://localhost:3005/api/semantic-graph/statistics > /dev/null && echo " ✅ Graph Stats OK" || echo " ❌ Graph Stats FAIL"

# 4. Database Tests
echo "4️⃣ Testing databases..."
docker exec codemind-postgres pg_isready -U codemind > /dev/null && echo " ✅ PostgreSQL OK" || echo " ❌ PostgreSQL FAIL"
docker exec codemind-redis redis-cli ping > /dev/null && echo " ✅ Redis OK" || echo " ❌ Redis FAIL"
docker exec codemind-neo4j cypher-shell -u neo4j -p codemind123 "RETURN 1" > /dev/null && echo " ✅ Neo4j OK" || echo " ❌ Neo4j FAIL"

echo "🏁 Test suite completed!"
```

## 🎯 Success Criteria

You have successfully set up CodeMind when you can:

1. ✅ See all 8 Docker containers running with `(healthy)` status
2. ✅ Access all web interfaces (Dashboard, pgAdmin, Redis Commander, Neo4j Browser)
3. ✅ Run CLI commands with colored semantic indicators
4. ✅ See ~103 nodes and ~39 relationships in Neo4j
5. ✅ Query PostgreSQL with orchestration and tool data
6. ✅ Get sub-second response times from all APIs
7. ✅ See semantic boost indicators (🧠) in CLI output
8. ✅ Interactive graph visualization working in browser

## 📈 Next Steps

After successful setup:
1. **Explore the dashboard** - Navigate through all tabs and features
2. **Test with your own queries** - Use CLI commands with your specific use cases
3. **Monitor performance** - Check response times and resource usage
4. **Customize semantic data** - Add your own business concepts to the graph
5. **Integration testing** - Test with actual development workflows

This complete stack gives you the full CodeMind experience with semantic intelligence, visual interfaces, and robust backend services all working together!