# CodeMind Dashboard Startup Script
# Ensures dashboard runs in Docker container, not locally

Write-Host "🚀 Starting CodeMind Dashboard in Docker..." -ForegroundColor Green

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✓ Docker is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not available. Please start Docker Desktop." -ForegroundColor Red
    Write-Host "Dashboard MUST run in Docker container for proper operation." -ForegroundColor Yellow
    exit 1
}

# Check if docker-compose.yml exists
if (!(Test-Path "docker-compose.yml")) {
    Write-Host "❌ docker-compose.yml not found. Please run from project root." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "   - Dashboard Port: 3005" -ForegroundColor Gray
Write-Host "   - Profile: dev (includes dashboard)" -ForegroundColor Gray
Write-Host "   - Container: codemind-dashboard" -ForegroundColor Gray
Write-Host ""

# Start dashboard with dev profile
Write-Host "🐳 Starting dashboard container..." -ForegroundColor Yellow
docker-compose --profile dev up dashboard

# If we get here, the container stopped
Write-Host ""
Write-Host "📊 Dashboard container has stopped." -ForegroundColor Yellow
Write-Host "To restart: docker-compose --profile dev up dashboard" -ForegroundColor Gray