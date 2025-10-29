# CodeMind Docker Rebuild Script
# Rebuilds all Docker containers with latest changes and handles database migrations

param(
    [switch]$Fresh,           # Start with fresh database
    [switch]$SkipBuild,       # Skip Docker image rebuilds
    [switch]$Logs,            # Show logs after startup
    [string]$Service = ""     # Rebuild specific service only
)

Write-Host "🚀 CodeMind Docker Rebuild Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Change to project directory
Set-Location "C:\workspace\claude\CodeMind"

# Load environment variables
if (Test-Path ".env.docker") {
    Write-Host "📋 Loading Docker environment configuration..." -ForegroundColor Green
    Get-Content ".env.docker" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
        }
    }
}

try {
    # Stop all services
    Write-Host "🛑 Stopping all CodeMind services..." -ForegroundColor Yellow
    docker-compose --env-file .env.docker down --remove-orphans
    
    if ($Fresh) {
        Write-Host "🗑️  Removing all volumes for fresh start..." -ForegroundColor Red
        docker-compose --env-file .env.docker down -v
        docker volume prune -f
        Write-Host "✅ Fresh start: All data volumes removed" -ForegroundColor Green
    }

    if (!$SkipBuild) {
        Write-Host "🔨 Building Docker images..." -ForegroundColor Blue
        
        if ($Service -ne "") {
            Write-Host "🎯 Building specific service: $Service" -ForegroundColor Cyan
            docker-compose --env-file .env.docker build --no-cache $Service
        } else {
            # Build all services
            Write-Host "🏗️  Building all services..." -ForegroundColor Blue
            docker-compose --env-file .env.docker build --no-cache
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
        Write-Host "✅ Docker images built successfully" -ForegroundColor Green
    }

    # Start database and Redis first
    Write-Host "🗄️  Starting database and Redis..." -ForegroundColor Blue
    docker-compose --env-file .env.docker up -d codemind-db codemind-redis
    
    # Wait for database to be ready
    Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
    $dbReady = $false
    $attempts = 0
    $maxAttempts = 30
    
    while (!$dbReady -and $attempts -lt $maxAttempts) {
        Start-Sleep 2
        $attempts++
        try {
            $result = docker-compose --env-file .env.docker exec -T codemind-db pg_isready -U codemind -d codemind
            if ($LASTEXITCODE -eq 0) {
                $dbReady = $true
                Write-Host "✅ Database is ready" -ForegroundColor Green
            } else {
                Write-Host "⏳ Database not ready yet (attempt $attempts/$maxAttempts)..." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⏳ Waiting for database container (attempt $attempts/$maxAttempts)..." -ForegroundColor Yellow
        }
    }
    
    if (!$dbReady) {
        throw "Database failed to start within expected time"
    }

    # Run database migration
    Write-Host "🔧 Running database migration..." -ForegroundColor Blue
    docker-compose --env-file .env.docker exec -T codemind-db /docker-entrypoint-initdb.d/02-init.sh
    
    # For existing databases, run migration script
    if (!$Fresh) {
        Write-Host "🔄 Running database schema migration..." -ForegroundColor Blue
        # Copy migration script to container and run it
        docker cp "docker/scripts/db-migration.sh" "codemind-database:/tmp/db-migration.sh"
        docker-compose --env-file .env.docker exec -T codemind-db chmod +x /tmp/db-migration.sh
        docker-compose --env-file .env.docker exec -T codemind-db /tmp/db-migration.sh
    }

    # Start all other services
    Write-Host "🚀 Starting all CodeMind services..." -ForegroundColor Blue
    docker-compose --env-file .env.docker up -d
    
    # Wait for services to be ready
    Write-Host "⏳ Waiting for all services to be healthy..." -ForegroundColor Yellow
    Start-Sleep 10
    
    # Check service health
    Write-Host "🏥 Checking service health..." -ForegroundColor Blue
    $services = @("codemind-db", "codemind-redis", "codemind-api", "codemind-dashboard", "codemind-orchestrator")
    
    foreach ($service in $services) {
        $health = docker-compose --env-file .env.docker ps --services --filter "health=healthy" | Select-String -Pattern $service
        if ($health) {
            Write-Host "✅ $service is healthy" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $service is not yet healthy" -ForegroundColor Yellow
        }
    }
    
    # Display service URLs
    Write-Host "`n🌐 Service URLs:" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host "🔗 CodeMind API:      http://localhost:3004" -ForegroundColor Green
    Write-Host "🔗 Dashboard:         http://localhost:3005" -ForegroundColor Green
    Write-Host "🔗 Orchestrator:      http://localhost:3006" -ForegroundColor Green
    Write-Host "🔗 Database:          localhost:5432" -ForegroundColor Green
    Write-Host "🔗 Redis:             localhost:6379" -ForegroundColor Green
    Write-Host ""
    
    # Show running containers
    Write-Host "📊 Container Status:" -ForegroundColor Cyan
    docker-compose --env-file .env.docker ps
    
    if ($Logs) {
        Write-Host "`n📜 Showing service logs (Ctrl+C to exit)..." -ForegroundColor Cyan
        docker-compose --env-file .env.docker logs -f
    } else {
        Write-Host "`n💡 To view logs, run: docker-compose --env-file .env.docker logs -f" -ForegroundColor Yellow
        Write-Host "💡 To stop services: docker-compose --env-file .env.docker down" -ForegroundColor Yellow
    }
    
    Write-Host "`n🎉 CodeMind services are running successfully!" -ForegroundColor Green

} catch {
    Write-Host "`n❌ Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "📋 Container logs for debugging:" -ForegroundColor Yellow
    docker-compose --env-file .env.docker logs --tail=50
    exit 1
}

Write-Host "`n✨ Rebuild completed successfully!" -ForegroundColor Green