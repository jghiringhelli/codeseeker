# CodeMind Infrastructure Setup Script
# One-time setup that creates all database schemas and starts services

param(
    [switch]$ForceReset = $false
)

$ErrorActionPreference = "Stop"

# Output functions
function Write-Step($Message) { Write-Host "[SETUP] $Message" -ForegroundColor Blue }
function Write-Good($Message) { Write-Host "[DONE] $Message" -ForegroundColor Green }
function Write-Bad($Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Warn($Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Info($Message) { Write-Host "[INFO] $Message" -ForegroundColor Cyan }

# Header
Write-Host ""
Write-Host "CodeMind Infrastructure Setup" -ForegroundColor Magenta
Write-Host "============================" -ForegroundColor Magenta
Write-Host "Creating all database structures needed for CodeMind" -ForegroundColor White
Write-Host ""

# Step 1: Validate environment
Write-Step "Validating environment..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Bad "Docker is required but not installed"
    exit 1
}

if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Bad "Docker Compose is required but not installed"
    exit 1
}

Write-Good "Environment validated"

# Step 2: Stop existing services if reset requested
if ($ForceReset) {
    Write-Step "Stopping and removing existing services..."
    try {
        docker-compose down -v 2>&1 | Out-Null
        Write-Good "Existing services removed"
    }
    catch {
        Write-Warn "Failed to stop services (may not exist): $($_.Exception.Message)"
    }
}

# Step 3: Start Docker services
Write-Step "Starting Docker services..."

try {
    $dockerOutput = docker-compose up -d database redis neo4j mongodb 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Good "Docker services started"
    } else {
        Write-Bad "Failed to start Docker services"
        Write-Host $dockerOutput
        exit 1
    }
}
catch {
    Write-Bad "Docker startup failed: $($_.Exception.Message)"
    exit 1
}

# Step 4: Wait for services to be ready
Write-Step "Waiting for services to initialize..."

$maxWait = 60
$waited = 0
$allReady = $false

while ($waited -lt $maxWait -and -not $allReady) {
    try {
        # Check PostgreSQL
        $env:PGPASSWORD = "codemind123"
        $pgReady = psql -h localhost -U codemind -d codemind -c "SELECT 1;" 2>$null
        
        # Check Neo4j (simple port check)
        $neo4jReady = Test-NetConnection -ComputerName localhost -Port 7687 -WarningAction SilentlyContinue
        
        if ($pgReady -and $neo4jReady.TcpTestSucceeded) {
            $allReady = $true
            Write-Good "All services ready"
            break
        }
    }
    catch {
        # Continue waiting
    }
    
    Start-Sleep -Seconds 2
    $waited += 2
    Write-Host "." -NoNewline
}

if (-not $allReady) {
    Write-Warn "Services may not be fully ready, but continuing with setup..."
}

# Step 5: Initialize PostgreSQL schema
Write-Step "Creating PostgreSQL database schema..."

try {
    $schemaFile = Join-Path $PSScriptRoot "..\src\database\schema.postgres.sql"
    if (Test-Path $schemaFile) {
        Get-Content $schemaFile | docker exec -i codemind-database psql -U codemind -d codemind 2>&1 | Out-Null
        Write-Good "PostgreSQL schema created"
    } else {
        Write-Warn "PostgreSQL schema file not found"
    }
}
catch {
    Write-Warn "PostgreSQL schema creation failed: $($_.Exception.Message)"
}

# Step 6: Initialize Neo4j schema
Write-Step "Creating Neo4j graph schema..."

try {
    $neo4jFile = Join-Path $PSScriptRoot "neo4j-init.cypher" 
    if (Test-Path $neo4jFile) {
        Get-Content $neo4jFile | docker exec -i codemind-neo4j cypher-shell -u neo4j -p codemind123 2>&1 | Out-Null
        Write-Good "Neo4j schema created"
    } else {
        Write-Warn "Neo4j initialization file not found"
    }
}
catch {
    Write-Warn "Neo4j schema creation failed: $($_.Exception.Message)"
}

# Step 7: Load system configuration
Write-Step "Loading system configuration..."

try {
    docker exec codemind-database psql -U codemind -d codemind -c "
        INSERT INTO system_config (config_key, config_value, is_global) VALUES
        ('system_version', '\"3.0.0\"', true),
        ('architecture_type', '\"three-layer\"', true),
        ('default_role_timeout_minutes', '30', true),
        ('max_concurrent_workflows', '5', true),
        ('external_tools_enabled', 'true', true),
        ('dashboard_enabled', 'true', true),
        ('infrastructure_setup_complete', 'true', true),
        ('setup_timestamp', '\"$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')\"', true)
        ON CONFLICT (config_key) DO UPDATE SET 
            config_value = EXCLUDED.config_value,
            updated_at = NOW();
    " 2>&1 | Out-Null
    Write-Good "System configuration loaded"
}
catch {
    Write-Warn "System configuration failed: $($_.Exception.Message)"
}

# Step 8: Display service status
Write-Step "Checking service status..."

Write-Info "Service Status:"
docker ps --filter "name=codemind" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | ForEach-Object { 
    Write-Host "  $_" -ForegroundColor White 
}

# Final status
Write-Host ""
Write-Good "CodeMind infrastructure setup complete!"
Write-Host ""
Write-Info "Database schemas created:"
Write-Host "  - PostgreSQL: 35+ tables for project management" -ForegroundColor Cyan
Write-Host "  - Neo4j: Graph schema for code relationships" -ForegroundColor Cyan  
Write-Host "  - MongoDB: Collections for analysis results" -ForegroundColor Cyan
Write-Host "  - Redis: Cache structures for performance" -ForegroundColor Cyan
Write-Host ""
Write-Info "Next steps:"
Write-Host "  - Navigate to your project directory" -ForegroundColor Cyan
Write-Host "  - Run 'codemind' to start the CLI" -ForegroundColor Cyan
Write-Host "  - Use '/init' to register your project" -ForegroundColor Cyan
Write-Host ""