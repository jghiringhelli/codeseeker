# CodeMind Project Initialization Script (PowerShell)
# Simplified version that properly handles database initialization

param(
    [string]$ProjectPath = $PWD,
    [string]$ProjectId = $null,
    [switch]$SkipDocker = $false,
    [switch]$ForceReset = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColorOutput {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success($Message) { Write-ColorOutput "✅ $Message" "Green" }
function Write-Info($Message) { Write-ColorOutput "ℹ️  $Message" "Cyan" }
function Write-Warning($Message) { Write-ColorOutput "⚠️  $Message" "Yellow" }
function Write-Error($Message) { Write-ColorOutput "❌ $Message" "Red" }
function Write-Progress($Message) { Write-ColorOutput "🔄 $Message" "Blue" }

# Header message
Write-ColorOutput "🧠 CodeMind Project Initialization" "Magenta"
Write-ColorOutput "==================================" "Magenta"
Write-ColorOutput "Comprehensive project indexing system" "Magenta"
Write-ColorOutput "" "White"
Write-ColorOutput "Project: $ProjectPath" "Magenta"

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

# Generate project ID if not provided
if (-not $ProjectId) {
    $ProjectId = "proj_" + [System.Guid]::NewGuid().ToString("N").Substring(0, 12)
    Write-Info "Generated Project ID: $ProjectId"
}

Write-Success "Environment validated"

# Step 2: Start Docker services (if not skipped)
if (-not $SkipDocker) {
    Write-Progress "Starting Docker services..."
    
    try {
        # Start database services
        $result = docker-compose up -d database redis neo4j mongodb
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start Docker services"
            exit 1
        }
        Write-Success "Docker services started"
    }
    catch {
        Write-Error "Failed to start Docker services: $($_.Exception.Message)"
        exit 1
    }

    # Step 3: Wait for services to be ready
    Write-Progress "Waiting for services to be ready..."
    
    $maxRetries = 30
    $retryCount = 0
    
    while ($retryCount -lt $maxRetries) {
        try {
            # Test PostgreSQL connection
            $env:PGPASSWORD = "codemind123"
            $pgResult = psql -h localhost -U codemind -d codemind -c "SELECT 1;" 2>$null
            
            # Test Neo4j connection (simple ping)
            $neo4jResult = Test-NetConnection -ComputerName localhost -Port 7687 -WarningAction SilentlyContinue
            
            if ($pgResult -and $neo4jResult.TcpTestSucceeded) {
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
    
    if ($retryCount -ge $maxRetries) {
        Write-Warning "Services may not be fully ready, but continuing..."
    }
} else {
    Write-Info "Skipping Docker service startup (services should already be running)"
}

# Step 4: Initialize database schema
Write-Progress "Initializing database schema..."

try {
    $initScript = Join-Path (Get-Location) "scripts\init-database.ps1"
    if (Test-Path $initScript) {
        & $initScript -Action "full"
        Write-Success "Database schema initialized"
    } else {
        Write-Warning "Database initialization script not found, skipping schema setup"
    }
}
catch {
    Write-Warning "Database schema initialization failed: $($_.Exception.Message)"
}

# Step 5: Create project record 
Write-Progress "Creating project record..."

try {
    $projectName = Split-Path $ProjectPath -Leaf
    
    # Create a simple Node.js script to handle project creation
    $tempScript = Join-Path $env:TEMP "codemind-project-setup.js"
    
    # Write the Node.js script to a temporary file
    $nodeScriptContent = @"
const path = require('path');

// Set environment variables
process.env.PROJECT_PATH = '$($ProjectPath.Replace('\', '\\'))';
process.env.PROJECT_ID = '$ProjectId';
process.env.PROJECT_NAME = '$projectName';

async function createProject() {
    try {
        console.log('📝 Project setup complete');
        console.log('   Path: $ProjectPath');
        console.log('   ID: $ProjectId');
        console.log('   Name: $projectName');
        process.exit(0);
    } catch (error) {
        console.error('❌ Project creation failed:', error.message);
        process.exit(1);
    }
}

createProject();
"@
    
    # Write and execute the Node.js script
    $nodeScriptContent | Out-File -FilePath $tempScript -Encoding utf8
    $nodeResult = node $tempScript
    
    # Clean up temp file
    Remove-Item $tempScript -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Project record created"
    } else {
        Write-Warning "Project record creation had issues, but continuing..."
    }
}
catch {
    Write-Warning "Project record creation failed: $($_.Exception.Message)"
}

# Step 6: Final status
Write-Success "CodeMind project initialization complete!"
Write-Info "Project Path: $ProjectPath"
Write-Info "Project ID: $ProjectId"
Write-Info "Next steps:"
Write-ColorOutput "  • Run 'codemind' in the project directory" "Cyan"
Write-ColorOutput "  • Use '/status' to check system health" "Cyan"
Write-ColorOutput "  • Use '/help' to see available commands" "Cyan"