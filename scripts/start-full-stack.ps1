# CodeMind Full Stack Startup Script
# Starts all services and runs health checks

Write-Host "🚀 Starting CodeMind Full Stack Environment..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Stop any existing services
Write-Host "🛑 Stopping existing services..." -ForegroundColor Yellow
docker-compose -f docker-compose.full-stack.yml down --remove-orphans

# Compile TypeScript
Write-Host "🔨 Compiling TypeScript..." -ForegroundColor Yellow
npx tsc

# Start all services
Write-Host "🚀 Starting all services..." -ForegroundColor Cyan
docker-compose -f docker-compose.full-stack.yml up -d

# Wait for services to start
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service status
Write-Host "`n📊 Service Status:" -ForegroundColor Cyan
docker ps --filter label=project=codemind --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health check
Write-Host "`n🔍 Running health checks..." -ForegroundColor Cyan

$services = @(
    @{Name="Dashboard"; Url="http://localhost:3003/health"},
    @{Name="Semantic API"; Url="http://localhost:3005/api/semantic-graph/health"},
    @{Name="Orchestrator"; Url="http://localhost:3006/health"},
    @{Name="Neo4j"; Url="http://localhost:7474"}
)

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri $service.Url -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ $($service.Name): OK" -ForegroundColor Green
    } catch {
        Write-Host "❌ $($service.Name): Failed" -ForegroundColor Red
    }
}

# Initialize semantic graph
Write-Host "`n🧠 Initializing semantic graph..." -ForegroundColor Magenta
try {
    node scripts/init-semantic-graph.js
    Write-Host "✅ Semantic graph initialized" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Semantic graph initialization failed - continuing anyway" -ForegroundColor Yellow
}

# Final status
Write-Host "`n🎉 CodeMind Full Stack is ready!" -ForegroundColor Green
Write-Host "🌐 Available services:" -ForegroundColor White
Write-Host "  📊 Main Dashboard:      http://localhost:3003" -ForegroundColor Cyan
Write-Host "  🧠 Semantic Graph:      http://localhost:3005/dashboard/semantic-graph" -ForegroundColor Magenta
Write-Host "  🎭 Orchestrator:        http://localhost:3006" -ForegroundColor Blue
Write-Host "  🔍 Neo4j Browser:       http://localhost:7474 (neo4j/codemind123)" -ForegroundColor Yellow
Write-Host "  🗄️ pgAdmin:              http://localhost:5050 (admin@codemind.local/codemind123)" -ForegroundColor Green
Write-Host "  🔴 Redis Commander:     http://localhost:8081 (admin/codemind123)" -ForegroundColor Red

Write-Host "`n🧪 Test CLI:" -ForegroundColor White
Write-Host "  node dist/cli/codemind.js status" -ForegroundColor Gray
Write-Host "  node dist/cli/codemind.js search `"authentication`" `".`" --intent coding" -ForegroundColor Gray
Write-Host "  node dist/cli/codemind.js context `"database`" `".`" --tokens 4000" -ForegroundColor Gray

# Optional: Open browser
$openBrowser = Read-Host "`nOpen dashboard in browser? (y/n)"
if ($openBrowser -eq "y" -or $openBrowser -eq "Y") {
    Start-Process "http://localhost:3003"
}