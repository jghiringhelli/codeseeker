# CodeMind Semantic Dashboard Startup Script
# Starts all required services for the semantic graph dashboard

Write-Host "🧠 Starting CodeMind Semantic Graph Dashboard..." -ForegroundColor Cyan

# Check if Neo4j is running
Write-Host "Checking Neo4j..." -ForegroundColor Yellow
try {
    $neo4jStatus = Invoke-WebRequest -Uri "http://localhost:7474" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Neo4j is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Neo4j is not running. Starting Neo4j..." -ForegroundColor Red
    Write-Host "Please run: docker-compose -f docker-compose.semantic-graph.yml up -d" -ForegroundColor Yellow
    exit 1
}

# Set environment variables
$env:CODEMIND_API_URL = "http://localhost:3004"
$env:PROJECT_PATH = "C:\workspace\claude\CodeMind"

# Start services in background
Write-Host "Starting Dashboard Server..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "src/dashboard/server.js" -WorkingDirectory $PSScriptRoot\..\

Write-Host "Starting Semantic Graph API..." -ForegroundColor Yellow  
Start-Process -FilePath "node" -ArgumentList "src/dashboard/semantic-graph-api.js" -WorkingDirectory $PSScriptRoot\..\

Write-Host "Starting Orchestrator Server..." -ForegroundColor Yellow
$orchestratorEnv = @{
    "DB_HOST" = "localhost"
    "DB_PORT" = "5432"  
    "DB_NAME" = "codemind"
    "DB_USER" = "codemind"
    "DB_PASSWORD" = "codemind123"
}
$orchestratorProcess = Start-Process -FilePath "node" -ArgumentList "dist/orchestration/orchestrator-server.js" -WorkingDirectory $PSScriptRoot\..\ -EnvironmentVariables $orchestratorEnv -PassThru

# Wait a moment for services to start
Start-Sleep -Seconds 3

# Check service health
Write-Host "Checking service health..." -ForegroundColor Yellow

try {
    $dashboardHealth = Invoke-WebRequest -Uri "http://localhost:3003" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Dashboard Server (http://localhost:3003)" -ForegroundColor Green
} catch {
    Write-Host "❌ Dashboard Server not responding" -ForegroundColor Red
}

try {
    $semanticHealth = Invoke-WebRequest -Uri "http://localhost:3005/api/semantic-graph/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Semantic Graph API (http://localhost:3005)" -ForegroundColor Green
} catch {
    Write-Host "❌ Semantic Graph API not responding" -ForegroundColor Red
}

try {
    $orchestratorHealth = Invoke-WebRequest -Uri "http://localhost:3006/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Orchestrator Server (http://localhost:3006)" -ForegroundColor Green
} catch {
    Write-Host "❌ Orchestrator Server not responding" -ForegroundColor Red
}

Write-Host "`n🚀 CodeMind Semantic Dashboard Services Started!" -ForegroundColor Cyan
Write-Host "Available at:" -ForegroundColor White
Write-Host "  📊 Main Dashboard: http://localhost:3003" -ForegroundColor Cyan
Write-Host "  🧠 Semantic Graph: http://localhost:3005/dashboard/semantic-graph" -ForegroundColor Cyan
Write-Host "  🎭 Orchestrator: http://localhost:3006" -ForegroundColor Cyan
Write-Host "  🔍 Neo4j Browser: http://localhost:7474 (neo4j/codemind123)" -ForegroundColor Cyan

Write-Host "`nPress any key to open the main dashboard..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Open main dashboard
Start-Process "http://localhost:3003"