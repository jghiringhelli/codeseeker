#!/bin/bash
# CodeMind Project Initialization Script (Bash)
# Initializes complete project indexing: PostgreSQL + Vector Search + Neo4j + File Hash Tracking

set -e

# Default values
PROJECT_PATH="${1:-$(pwd)}"
PROJECT_ID="${2:-}"
SKIP_DOCKER="${SKIP_DOCKER:-false}"
FORCE_RESET="${FORCE_RESET:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }
progress() { echo -e "${BLUE}🔄 $1${NC}"; }

echo -e "${MAGENTA}🧠 CodeMind Project Initialization
==================================
Comprehensive project indexing system

Project: $PROJECT_PATH${NC}"

# Step 1: Validate environment
progress "Validating environment..."

if ! command -v docker &> /dev/null; then
    error "Docker is required but not installed"
fi

if ! command -v node &> /dev/null; then
    error "Node.js is required but not installed"
fi

if [ ! -d "$PROJECT_PATH" ]; then
    error "Project path does not exist: $PROJECT_PATH"
fi

success "Environment validation passed"

# Step 2: Generate project ID if not provided
if [ -z "$PROJECT_ID" ]; then
    if command -v uuidgen &> /dev/null; then
        PROJECT_ID=$(uuidgen)
    else
        PROJECT_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$(shuf -i 1000-9999 -n 1)")
    fi
    info "Generated project ID: $PROJECT_ID"
else
    info "Using provided project ID: $PROJECT_ID"
fi

# Step 3: Start Docker services (if needed)
if [ "$SKIP_DOCKER" != "true" ]; then
    progress "Starting Docker services..."
    
    # Check if services are already running
    if ! docker ps --filter "name=codemind-postgres" --format "{{.Names}}" | grep -q "codemind-postgres" || [ "$FORCE_RESET" = "true" ]; then
        progress "Starting PostgreSQL with pgvector..."
        docker run -d \
            --name codemind-postgres \
            -e POSTGRES_DB=codemind \
            -e POSTGRES_USER=codemind \
            -e POSTGRES_PASSWORD=codemind123 \
            -p 5432:5432 \
            pgvector/pgvector:pg15
        
        sleep 5
        success "PostgreSQL started"
    else
        info "PostgreSQL already running"
    fi
    
    if ! docker ps --filter "name=codemind-neo4j" --format "{{.Names}}" | grep -q "codemind-neo4j" || [ "$FORCE_RESET" = "true" ]; then
        progress "Starting Neo4j..."
        docker run -d \
            --name codemind-neo4j \
            -e NEO4J_AUTH=neo4j/codemind123 \
            -p 7474:7474 \
            -p 7687:7687 \
            neo4j:latest
        
        sleep 10
        success "Neo4j started"
    else
        info "Neo4j already running"
    fi
    
    if ! docker ps --filter "name=codemind-mongodb" --format "{{.Names}}" | grep -q "codemind-mongodb" || [ "$FORCE_RESET" = "true" ]; then
        progress "Starting MongoDB..."
        docker run -d \
            --name codemind-mongodb \
            -e MONGO_INITDB_ROOT_USERNAME=codemind \
            -e MONGO_INITDB_ROOT_PASSWORD=codemind123 \
            -e MONGO_INITDB_DATABASE=codemind \
            -p 27017:27017 \
            mongo:7.0
        
        sleep 8
        success "MongoDB started"
    else
        info "MongoDB already running"
    fi
fi

# Step 4: Wait for databases to be ready
progress "Waiting for databases to be ready..."

max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    # Test PostgreSQL connection
    if PGPASSWORD=codemind123 psql -h localhost -U codemind -d codemind -c "SELECT 1;" > /dev/null 2>&1; then
        # Test Neo4j connection (simple HTTP check)
        if curl -s "http://localhost:7474" > /dev/null 2>&1; then
            # Test MongoDB connection
            if mongosh --eval "db.adminCommand('ping')" --quiet mongodb://codemind:codemind123@localhost:27017/codemind?authSource=admin > /dev/null 2>&1; then
                success "All databases ready"
                break
            fi
        fi
    fi
    
    sleep 2
    retry_count=$((retry_count + 1))
    echo -n "."
done
echo

if [ $retry_count -eq $max_retries ]; then
    error "Databases failed to become ready within timeout"
fi

# Step 5: Initialize database schemas
progress "Initializing database schemas..."

# Initialize PostgreSQL schema
if ! PGPASSWORD=codemind123 psql -h localhost -U codemind -d codemind -f src/database/schema.postgres.sql > /dev/null 2>&1; then
    error "Failed to initialize PostgreSQL schema"
fi

if ! PGPASSWORD=codemind123 psql -h localhost -U codemind -d codemind -f docker/scripts/vector-init.sql > /dev/null 2>&1; then
    error "Failed to initialize vector schema"
fi

success "PostgreSQL schema initialized"

# Initialize Neo4j schema/constraints (if available)
if [ -f "scripts/neo4j-init.cypher" ] && command -v cypher-shell &> /dev/null; then
    if cypher-shell -u neo4j -p codemind123 < scripts/neo4j-init.cypher > /dev/null 2>&1; then
        success "Neo4j schema initialized"
    else
        warning "Neo4j schema initialization failed (continuing)"
    fi
else
    warning "cypher-shell not available, skipping Neo4j schema initialization"
fi

# Step 6: Start CodeMind services
progress "Starting CodeMind services..."

# Start tool database API in background
nohup npx tsx src/scripts/start-tool-api.ts > /dev/null 2>&1 &
sleep 3

success "CodeMind API services started"

# Step 7: Create project record and initialize file synchronization with MongoDB
progress "Creating project record and initializing file synchronization..."

# Create sync script with project creation and MongoDB initialization
cat > temp-sync-init.js << EOF
const { FileSynchronizationSystem } = require('./src/shared/file-synchronization-system');
const { ToolDatabaseAPI } = require('./src/orchestration/tool-database-api');
const { mongoClient } = require('./src/shared/mongodb-client');
const { projectIntelligence } = require('./src/shared/project-intelligence');
const { toolConfigRepo } = require('./src/shared/tool-config-repository');
const path = require('path');
const fs = require('fs');

async function initializeSync() {
    try {
        // Initialize MongoDB connection
        await mongoClient.connect();
        console.log('📄 MongoDB connection established');
        
        // Create project record in PostgreSQL
        const dbAPI = new ToolDatabaseAPI();
        await dbAPI.initialize();
        
        const projectName = path.basename('$PROJECT_PATH');
        const projectData = {
            id: '$PROJECT_ID',
            project_path: '$PROJECT_PATH',
            project_name: projectName,
            project_type: 'unknown', // Will be detected later
            languages: JSON.stringify([]),
            frameworks: JSON.stringify([]),
            status: 'analyzing'
        };
        
        console.log('📝 Creating project record:', projectName);
        await dbAPI.query(\`
            INSERT INTO projects (id, project_path, project_name, project_type, languages, frameworks, status, created_at, updated_at)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, NOW(), NOW())
            ON CONFLICT (project_path) DO UPDATE SET
            project_name = \$3, status = \$7, updated_at = NOW()
        \`, [projectData.id, projectData.project_path, projectData.project_name, 
            projectData.project_type, projectData.languages, projectData.frameworks, projectData.status]);
        
        // Initialize file synchronization
        const sync = new FileSynchronizationSystem('$PROJECT_PATH');
        await sync.initialize();
        console.log('📁 File synchronization initialized');
        
        const result = await sync.synchronizeProject('$PROJECT_PATH', '$PROJECT_ID');
        console.log('✅ Project synchronized:');
        console.log(\`   New files: \${result.newFiles}\`);
        console.log(\`   Modified files: \${result.modifiedFiles}\`);
        console.log(\`   Total files: \${result.totalFiles}\`);
        
        // Analyze project and create MongoDB intelligence
        const fileList = fs.readdirSync('$PROJECT_PATH', { recursive: true })
            .filter(f => typeof f === 'string' && !f.includes('node_modules') && !f.includes('.git'));
        
        console.log('🧠 Analyzing project structure...');
        const context = await projectIntelligence.analyzeProject('$PROJECT_ID', '$PROJECT_PATH', fileList);
        console.log(\`✅ Project intelligence created: \${context.languages.join(', ')} project\`);
        
        // Initialize tool configurations
        console.log('⚙️ Initializing tool configurations...');
        await toolConfigRepo.initializeProjectConfigs('$PROJECT_ID');
        console.log('✅ Tool configurations initialized');
        
        // Update project status to active
        await dbAPI.query(\`
            UPDATE projects SET status = 'active', updated_at = NOW() WHERE id = \$1
        \`, ['$PROJECT_ID']);
        
        await sync.close();
        await dbAPI.close();
        await mongoClient.disconnect();
    } catch (error) {
        console.error('❌ Synchronization failed:', error.message);
        process.exit(1);
    }
}

initializeSync();
EOF

if npx tsx temp-sync-init.js; then
    success "Project record created and file synchronization completed"
else
    error "File synchronization failed"
fi

rm -f temp-sync-init.js

# Step 8: Generate semantic embeddings for all files
progress "Generating semantic embeddings..."

if [ -n "$OPENAI_API_KEY" ]; then
    # Generate embeddings using the semantic search tool directly
    cat > temp-embedding-init.js << EOF
const { SemanticSearchTool } = require('./src/features/search/semantic-search-complete');
const tool = new SemanticSearchTool();

async function generateEmbeddings() {
    try {
        console.log('🧠 Generating semantic embeddings...');
        const result = await tool.analyze('$PROJECT_PATH', '$PROJECT_ID', { skipCache: true });
        console.log('✅ Semantic embeddings generated:', result.analysis.totalSegments, 'segments');
    } catch (error) {
        console.error('❌ Embedding generation failed:', error.message);
    }
}

generateEmbeddings();
EOF
    
    if timeout 300 npx tsx temp-embedding-init.js; then
        success "Semantic embeddings generated"
    else
        warning "Semantic embeddings generation failed or timed out (continuing)"
    fi
    rm -f temp-embedding-init.js
else
    warning "OPENAI_API_KEY not set, skipping semantic embeddings generation"
fi

# Step 9: Build semantic graph
progress "Building semantic graph..."

# Create graph initialization script
cat > temp-graph-init.js << EOF
const { CodeRelationshipParser } = require('./src/services/code-relationship-parser');
const parser = new CodeRelationshipParser();

async function buildGraph() {
    try {
        await parser.initialize();
        console.log('🔗 Code relationship parser initialized');
        
        await parser.parseAndPopulateProject('$PROJECT_PATH', '$PROJECT_ID');
        console.log('📊 Semantic graph populated with project relationships');
        
        await parser.close();
    } catch (error) {
        console.error('❌ Graph building failed:', error.message);
    }
}

buildGraph();
EOF

if npx tsx temp-graph-init.js; then
    success "Semantic graph built"
else
    warning "Semantic graph building failed (continuing)"
fi

rm -f temp-graph-init.js

# Step 10: Create project metadata
progress "Creating project metadata..."

metadata_dir="$PROJECT_PATH/.codemind"
mkdir -p "$metadata_dir"

# Create project configuration
cat > "$metadata_dir/project.json" << EOF
{
  "projectId": "$PROJECT_ID",
  "projectPath": "$PROJECT_PATH",
  "initialized": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "databases": {
    "postgres": {
      "host": "localhost",
      "port": 5432,
      "database": "codemind",
      "user": "codemind"
    },
    "neo4j": {
      "host": "localhost",
      "port": 7687,
      "user": "neo4j"
    }
  },
  "services": {
    "toolAPI": "http://localhost:3003",
    "orchestrator": "http://localhost:3006"
  },
  "features": {
    "fileSync": true,
    "semanticSearch": $([ -n "$OPENAI_API_KEY" ] && echo "true" || echo "false"),
    "semanticGraph": true,
    "vectorEmbeddings": $([ -n "$OPENAI_API_KEY" ] && echo "true" || echo "false")
  }
}
EOF

success "Project metadata created"

# Final summary
echo -e "${GREEN}
🎉 CodeMind Project Initialization Complete!
==========================================

Project ID: $PROJECT_ID
Project Path: $PROJECT_PATH

✅ Databases: PostgreSQL (pgvector) + Neo4j running
✅ File Synchronization: All files indexed and hash-tracked  
✅ Semantic Search: $([ -n "$OPENAI_API_KEY" ] && echo "Enabled with OpenAI embeddings" || echo "Disabled (no API key)")
✅ Semantic Graph: Initialized and ready
✅ API Services: Running on http://localhost:3003

Next Steps:
-----------
1. Set OPENAI_API_KEY to enable semantic search
2. Run: codemind smart \"analyze authentication logic\" $PROJECT_PATH
3. Check status: codemind status

Configuration saved to: $metadata_dir/project.json${NC}"

echo -e "${MAGENTA}Ready to use CodeMind! 🚀${NC}"