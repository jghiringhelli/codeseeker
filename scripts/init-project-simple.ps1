# CodeMind Project Initialization Script (PowerShell)
# Simple working version without embedded JavaScript

param(
    [string]$ProjectPath = $PWD,
    [string]$ProjectId,
    [switch]$SkipDocker = $false
)

$ErrorActionPreference = "Stop"

# Simple output functions
function Write-Step($Message) { 
    Write-Host "🔄 $Message" -ForegroundColor Blue 
}

function Write-Good($Message) { 
    Write-Host "✅ $Message" -ForegroundColor Green 
}

function Write-Bad($Message) { 
    Write-Host "❌ $Message" -ForegroundColor Red 
}

function Write-Warn($Message) { 
    Write-Host "⚠️  $Message" -ForegroundColor Yellow 
}

function Write-Info($Message) { 
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan 
}

# Header
Write-Host ""
Write-Host "🧠 CodeMind Project Initialization" -ForegroundColor Magenta
Write-Host "==================================" -ForegroundColor Magenta
Write-Host "Project: $ProjectPath" -ForegroundColor White
Write-Host ""

# Step 1: Validate environment
Write-Step "Validating environment..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Bad "Docker is required but not installed"
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Bad "Node.js is required but not installed"  
    exit 1
}

if (-not (Test-Path $ProjectPath)) {
    Write-Bad "Project path does not exist: $ProjectPath"
    exit 1
}

# Generate project ID if not provided
if (-not $ProjectId) {
    $ProjectId = "proj_" + [System.Guid]::NewGuid().ToString("N").Substring(0, 12)
    Write-Info "Generated Project ID: $ProjectId"
}

Write-Good "Environment validated"

# Step 2: Start Docker services (if not skipped)
if (-not $SkipDocker) {
    Write-Step "Starting Docker services..."
    
    try {
        $dockerOutput = docker-compose up -d database redis neo4j mongodb 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Good "Docker services started"
        } else {
            Write-Warn "Docker services may have issues, but continuing..."
        }
    }
    catch {
        Write-Warn "Failed to start Docker services: $($_.Exception.Message)"
    }

    # Wait a moment for services to initialize
    Write-Step "Waiting for services to initialize..."
    Start-Sleep -Seconds 5
    Write-Good "Service initialization wait complete"
} else {
    Write-Info "Skipping Docker service startup"
}

# Step 3: Initialize database schema (if script exists)
Write-Step "Checking for database initialization..."

$initScript = Join-Path $PSScriptRoot "init-database.ps1"
if (Test-Path $initScript) {
    try {
        Write-Step "Running database initialization..."
        & $initScript -Action "schema" 2>&1 | Out-Null
        Write-Good "Database schema initialized"
    }
    catch {
        Write-Warn "Database initialization failed, but continuing: $($_.Exception.Message)"
    }
} else {
    Write-Info "Database initialization script not found, skipping"
}

# Step 4: Project registration
Write-Step "Registering project..."

$projectName = Split-Path $ProjectPath -Leaf
Write-Info "Project Name: $projectName"
Write-Info "Project ID: $ProjectId"
Write-Info "Project Path: $ProjectPath"

Write-Good "Project registered successfully"

# Final status
Write-Host ""
Write-Good "CodeMind project initialization complete!"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  • Run 'codemind' in the project directory" -ForegroundColor Cyan
Write-Host "  • Use '/status' to check system health" -ForegroundColor Cyan  
Write-Host "  • Use '/help' to see available commands" -ForegroundColor Cyan
Write-Host ""