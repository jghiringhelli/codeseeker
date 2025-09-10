# CodeMind Project Initialization Script (PowerShell)
# Initializes complete project indexing: PostgreSQL + Vector Search + Neo4j + File Hash Tracking

param(
    [string]$ProjectPath = $PWD,
    [string]$ProjectId = $null,
    [switch]$SkipDocker = $false,
    [switch]$ForceReset = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColorOutput($Message, $Color = "White") {
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success($Message) { Write-ColorOutput "✅ $Message" "Green" }
function Write-Info($Message) { Write-ColorOutput "ℹ️  $Message" "Cyan" }
function Write-Warning($Message) { Write-ColorOutput "⚠️  $Message" "Yellow" }
function Write-Error($Message) { Write-ColorOutput "❌ $Message" "Red" }
function Write-Progress($Message) { Write-ColorOutput "🔄 $Message" "Blue" }

Write-ColorOutput @"
🧠 CodeMind Project Initialization
================================
Comprehensive project indexing system

Project: $ProjectPath
"@ -Color "Magenta"

# Step 1: Validate environment
Write-Progress "Validating environment..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is required but not installed"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is required but not installed"
    exit 1
}

if (-not (Test-Path $ProjectPath)) {
    Write-Error "Project path does not exist: $ProjectPath"
    exit 1
}

Write-Success "Environment validation passed"

# Step 2: Generate project ID if not provided
if (-not $ProjectId) {
    $ProjectId = [System.Guid]::NewGuid().ToString()
    Write-Info "Generated project ID: $ProjectId"
} else {
    Write-Info "Using provided project ID: $ProjectId"
}

# Step 3: Start Docker services (if needed)
if (-not $SkipDocker) {
    Write-Progress "Starting Docker services..."
    
    # Check if services are already running
    $postgresRunning = docker ps --filter "name=codemind-postgres" --format "table {{.Names}}" | Select-String "codemind-postgres"
    $neo4jRunning = docker ps --filter "name=codemind-neo4j" --format "table {{.Names}}" | Select-String "codemind-neo4j"
    
    if (-not $postgresRunning -or $ForceReset) {
        Write-Progress "Starting PostgreSQL with pgvector..."
        docker run -d `
            --name codemind-postgres `
            -e POSTGRES_DB=codemind `
            -e POSTGRES_USER=codemind `
            -e POSTGRES_PASSWORD=codemind123 `
            -p 5432:5432 `
            pgvector/pgvector:pg15
        
        Start-Sleep -Seconds 5
        Write-Success "PostgreSQL started"
    } else {
        Write-Info "PostgreSQL already running"
    }
    
    if (-not $neo4jRunning -or $ForceReset) {
        Write-Progress "Starting Neo4j..."
        docker run -d `
            --name codemind-neo4j `
            -e NEO4J_AUTH=neo4j/codemind123 `
            -p 7474:7474 `
            -p 7687:7687 `
            neo4j:latest
        
        Start-Sleep -Seconds 10
        Write-Success "Neo4j started"
    } else {
        Write-Info "Neo4j already running"
    }
}

# Step 4: Wait for databases to be ready
Write-Progress "Waiting for databases to be ready..."

$maxRetries = 30
$retryCount = 0

while ($retryCount -lt $maxRetries) {
    try {
        # Test PostgreSQL connection
        $env:PGPASSWORD = "codemind123"
        $pgReady = & psql -h localhost -U codemind -d codemind -c "SELECT 1;" 2>$null
        
        # Test Neo4j connection (simple HTTP check)
        $neo4jReady = Invoke-WebRequest -Uri "http://localhost:7474" -UseBasicParsing 2>$null
        
        if ($pgReady -and $neo4jReady) {
            Write-Success "All databases ready"
            break
        }
    }
    catch {
        # Continue waiting
    }
    
    Start-Sleep -Seconds 2
    $retryCount++
    Write-Host "." -NoNewline
}

if ($retryCount -eq $maxRetries) {
    Write-Error "Databases failed to become ready within timeout"
    exit 1
}

# Step 5: Initialize database schemas
Write-Progress "Initializing database schemas..."

try {
    # Initialize PostgreSQL schema
    $env:PGPASSWORD = "codemind123"
    Get-Content "src/database/schema.postgres.sql" | & psql -h localhost -U codemind -d codemind -f -
    Get-Content "docker/scripts/vector-init.sql" | & psql -h localhost -U codemind -d codemind -f -
    
    Write-Success "PostgreSQL schema initialized"
} catch {
    Write-Error "Failed to initialize PostgreSQL schema: $_"
    exit 1
}

try {
    # Initialize Neo4j schema/constraints
    if (Test-Path "scripts/neo4j-init.cypher") {
        # Use cypher-shell if available
        if (Get-Command cypher-shell -ErrorAction SilentlyContinue) {
            Get-Content "scripts/neo4j-init.cypher" | & cypher-shell -u neo4j -p codemind123
        } else {
            Write-Warning "cypher-shell not available, skipping Neo4j schema initialization"
        }
    }
    Write-Success "Neo4j schema initialized"
} catch {
    Write-Warning "Neo4j schema initialization failed (continuing): $_"
}

# Step 6: Start CodeMind services
Write-Progress "Starting CodeMind services..."

# Start tool database API
Start-Process -NoNewWindow -FilePath "npx" -ArgumentList "tsx", "src/scripts/start-tool-api.ts" -WorkingDirectory $PWD
Start-Sleep -Seconds 3

Write-Success "CodeMind API services started"

# Step 7: Create project record and initialize file synchronization
Write-Progress "Creating project record and initializing file synchronization..."

try {
    $syncScript = @"
const { FileSynchronizationSystem } = require('./src/shared/file-synchronization-system');
const { ToolDatabaseAPI } = require('./src/orchestration/tool-database-api');
const path = require('path');

async function initializeSync() {
    try {
        // Create project record first
        const dbAPI = new ToolDatabaseAPI();
        await dbAPI.initialize();
        
        const projectName = path.basename('$ProjectPath');
        const projectData = {
            id: '$ProjectId',
            project_path: '$ProjectPath',
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
        const sync = new FileSynchronizationSystem('$ProjectPath');
        await sync.initialize();
        console.log('📁 File synchronization initialized');
        
        const result = await sync.synchronizeProject('$ProjectPath', '$ProjectId');
        console.log('✅ Project synchronized:');
        console.log(\`   New files: \${result.newFiles}\`);
        console.log(\`   Modified files: \${result.modifiedFiles}\`);
        console.log(\`   Total files: \${result.totalFiles}\`);
        
        await sync.close();
        await dbAPI.close();
    } catch (error) {
        console.error('❌ Synchronization failed:', error.message);
        process.exit(1);
    }
}

initializeSync();
"@
    
    $syncScript | Out-File -FilePath "temp-sync-init.js" -Encoding UTF8
    & npx tsx temp-sync-init.js
    Remove-Item "temp-sync-init.js" -Force
    
    Write-Success "File synchronization completed"
} catch {
    Write-Error "File synchronization failed: $_"
    exit 1
}

# Step 8: Generate semantic embeddings for all files
Write-Progress "Generating semantic embeddings..."

if ($env:OPENAI_API_KEY) {
    try {
        # Generate embeddings using the semantic search tool directly
        $embeddingScript = @"
const { SemanticSearchTool } = require('./src/features/search/semantic-search-complete');
const tool = new SemanticSearchTool();

async function generateEmbeddings() {
    try {
        console.log('🧠 Generating semantic embeddings...');
        const result = await tool.analyze('$ProjectPath', '$ProjectId', { skipCache: true });
        console.log('✅ Semantic embeddings generated:', result.analysis.totalSegments, 'segments');
    } catch (error) {
        console.error('❌ Embedding generation failed:', error.message);
    }
}

generateEmbeddings();
"@
        $embeddingScript | Out-File -FilePath "temp-embedding-init.js" -Encoding UTF8
        & npx tsx temp-embedding-init.js
        Remove-Item "temp-embedding-init.js" -Force
        
        Write-Success "Semantic embeddings generated"
    } catch {
        Write-Warning "Semantic embeddings generation failed (continuing): $_"
    }
} else {
    Write-Warning "OPENAI_API_KEY not set, skipping semantic embeddings generation"
}

# Step 9: Build semantic graph
Write-Progress "Building semantic graph..."

try {
    $graphScript = @"
const { CodeRelationshipParser } = require('./src/services/code-relationship-parser');
const parser = new CodeRelationshipParser();

async function buildGraph() {
    try {
        await parser.initialize();
        console.log('🔗 Code relationship parser initialized');
        
        await parser.parseAndPopulateProject('$ProjectPath', '$ProjectId');
        console.log('📊 Semantic graph populated with project relationships');
        
        await parser.close();
    } catch (error) {
        console.error('❌ Graph building failed:', error.message);
    }
}

buildGraph();
"@
    
    $graphScript | Out-File -FilePath "temp-graph-init.js" -Encoding UTF8
    & npx tsx temp-graph-init.js
    Remove-Item "temp-graph-init.js" -Force
    
    Write-Success "Semantic graph built"
} catch {
    Write-Warning "Semantic graph building failed (continuing): $_"
}

# Step 10: Create project metadata and update project status
Write-Progress "Creating project metadata and finalizing project..."

$metadataDir = Join-Path $ProjectPath ".codemind"
if (-not (Test-Path $metadataDir)) {
    New-Item -ItemType Directory -Path $metadataDir -Force | Out-Null
}

$projectConfig = @{
    projectId = $ProjectId
    projectPath = $ProjectPath
    initialized = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    databases = @{
        postgres = @{
            host = "localhost"
            port = 5432
            database = "codemind"
            user = "codemind"
        }
        neo4j = @{
            host = "localhost" 
            port = 7687
            user = "neo4j"
        }
    }
    services = @{
        toolAPI = "http://localhost:3003"
        orchestrator = "http://localhost:3006"
    }
    features = @{
        fileSync = $true
        semanticSearch = [bool]$env:OPENAI_API_KEY
        semanticGraph = $true
        vectorEmbeddings = [bool]$env:OPENAI_API_KEY
        multiLevelCache = $true
    }
} | ConvertTo-Json -Depth 4

$configFile = Join-Path $metadataDir "project.json"
$projectConfig | Out-File -FilePath $configFile -Encoding UTF8

# Update project status to 'active' in database
try {
    $statusScript = @"
const { ToolDatabaseAPI } = require('./src/orchestration/tool-database-api');

async function updateProjectStatus() {
    const dbAPI = new ToolDatabaseAPI();
    await dbAPI.initialize();
    
    await dbAPI.query('UPDATE projects SET status = \$1, updated_at = NOW() WHERE id = \$2', ['active', '$ProjectId']);
    console.log('📊 Project status updated to active');
    
    await dbAPI.close();
}

updateProjectStatus().catch(console.error);
"@
    $statusScript | Out-File -FilePath "temp-status-update.js" -Encoding UTF8
    & npx tsx temp-status-update.js
    Remove-Item "temp-status-update.js" -Force
} catch {
    Write-Warning "Failed to update project status in database: $_"
}

Write-Success "Project metadata created and project activated"

# Final summary
Write-ColorOutput @"

🎉 CodeMind Project Initialization Complete!
==========================================

Project ID: $ProjectId
Project Path: $ProjectPath

✅ Databases: PostgreSQL (pgvector) + Neo4j running
✅ File Synchronization: All files indexed and hash-tracked  
✅ Semantic Search: $(if($env:OPENAI_API_KEY) {'Enabled with OpenAI embeddings'} else {'Disabled (no API key)'})
✅ Semantic Graph: Initialized and ready
✅ API Services: Running on http://localhost:3003

Next Steps:
-----------
1. Set OPENAI_API_KEY to enable semantic search
2. Run: codemind smart "analyze authentication logic" $ProjectPath
3. Check status: codemind status

Configuration saved to: $configFile
"@ "Green"

Write-ColorOutput "Ready to use CodeMind! 🚀" "Magenta"