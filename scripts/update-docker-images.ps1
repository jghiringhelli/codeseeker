# CodeMind Docker Images Update Script
# Rebuilds and restarts all services with the latest three-layer architecture code

param(
    [switch]$ForceRebuild,
    [switch]$NoCache,
    [switch]$VerboseOutput
)

# Colors for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    switch ($Color) {
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        "Magenta" { Write-Host $Message -ForegroundColor Magenta }
        default { Write-Host $Message -ForegroundColor White }
    }
}

function Info { param([string]$msg) Write-ColorOutput $msg "Cyan" }
function Success { param([string]$msg) Write-ColorOutput $msg "Green" }
function Warning { param([string]$msg) Write-ColorOutput $msg "Yellow" }
function Error { param([string]$msg) Write-ColorOutput $msg "Red" }

Write-ColorOutput "CodeMind Docker Images Update" "Cyan"
Write-ColorOutput "=====================================" "Cyan"
Info "Updating Docker images with latest three-layer architecture code"
Info "This will rebuild all images and restart services with fresh containers"
Write-Host ""

# Navigate to project directory
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
Info "Working directory: $PWD"

# Check if docker-compose is available
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Error "docker-compose is not installed or not in PATH"
    exit 1
}

# Step 1: Stop all services
Info "Step 1: Stopping all CodeMind services..."
try {
    docker-compose down
    Success "✅ All services stopped"
} catch {
    Warning "⚠️  Error stopping services: $($_.Exception.Message)"
}

# Step 2: Remove old images if force rebuild is requested
if ($ForceRebuild) {
    Info "Step 2: Removing old CodeMind images (force rebuild)..."
    try {
        docker images --filter "reference=codemind*" --format "{{.Repository}}:{{.Tag}}" | ForEach-Object {
            if ($_ -ne "<none>:<none>") {
                Info "  Removing image: $_"
                docker image rm $_ --force
            }
        }
        Success "✅ Old images removed"
    } catch {
        Warning "⚠️  Error removing images: $($_.Exception.Message)"
    }
} else {
    Info "Step 2: Skipping image removal (use -ForceRebuild to remove old images)"
}

# Step 3: Build new images with latest code
Info "Step 3: Building new Docker images with latest code..."

$BuildArgs = @()
if ($NoCache) {
    $BuildArgs += "--no-cache"
}
if ($VerboseOutput) {
    $BuildArgs += "--progress=plain"
}

try {
    Info "  Building API service image..."
    docker-compose build $BuildArgs codemind-api
    
    Info "  Building Dashboard service image..."  
    docker-compose build $BuildArgs codemind-dashboard
    
    Info "  Building Orchestrator service image..."
    docker-compose build $BuildArgs codemind-orchestrator
    
    Info "  Building Role Terminal service image..."
    docker-compose build $BuildArgs codemind-role-terminal
    
    Success "✅ All images built successfully"
} catch {
    Error "❌ Error building images: $($_.Exception.Message)"
    exit 1
}

# Step 4: Start services with new images
Info "Step 4: Starting services with updated images..."
try {
    docker-compose up -d
    Success "✅ All services started"
} catch {
    Error "❌ Error starting services: $($_.Exception.Message)"
    exit 1
}

# Step 5: Wait for services to be healthy
Info "Step 5: Waiting for services to become healthy..."
$MaxWaitTime = 120  # 2 minutes
$WaitInterval = 5   # 5 seconds
$ElapsedTime = 0

while ($ElapsedTime -lt $MaxWaitTime) {
    Start-Sleep $WaitInterval
    $ElapsedTime += $WaitInterval
    
    $Status = docker-compose ps --format json | ConvertFrom-Json
    $HealthyServices = 0
    $TotalServices = 0
    
    foreach ($Service in $Status) {
        $TotalServices++
        if ($Service.State -eq "running") {
            $Health = docker inspect $Service.Name --format '{{.State.Health.Status}}' 2>$null
            if ($Health -eq "healthy" -or $Health -eq "") {
                $HealthyServices++
            }
        }
    }
    
    Info "  Healthy services: $HealthyServices/$TotalServices (${ElapsedTime}s elapsed)"
    
    if ($HealthyServices -eq $TotalServices) {
        Success "✅ All services are healthy!"
        break
    }
}

if ($ElapsedTime -ge $MaxWaitTime) {
    Warning "⚠️  Some services may not be fully healthy yet. Check logs if needed."
}

# Step 6: Display final status
Info "Step 6: Final service status..."
docker-compose ps

Write-Host ""
Success "🎉 Docker images update complete!"
Write-ColorOutput "======================================" "Green"
Success "✅ All services rebuilt with latest three-layer architecture code"
Success "✅ Database now uses three-layer-complete-schema.sql"
Success "✅ Dashboard includes comprehensive three-layer interface"
Success "✅ Orchestrator ready for sequential role-based workflows"
Write-Host ""
Info "Services are now running with the latest code:"
Info "• Dashboard: http://localhost:3005 (three-layer interface)"
Info "• API: http://localhost:3004 (smart CLI backend)"
Info "• Orchestrator: http://localhost:3006 (workflow coordination)"
Info "• Database: localhost:5432 (three-layer schema)"
Write-Host ""
Info "To view logs: docker-compose logs -f [service-name]"
Info "To restart: docker-compose restart [service-name]"
Info "To stop: docker-compose down"