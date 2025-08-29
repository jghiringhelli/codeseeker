# CodeMind Database Initialization Script
# Initializes PostgreSQL database with schema and essential data

param(
    [string]$Action = "full",  # full, schema, data, reset
    [switch]$Force
)

Write-Host "🗄️ CodeMind Database Initialization" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Database connection parameters
$DB_HOST = $env:DB_HOST ?? "localhost"
$DB_PORT = $env:DB_PORT ?? "5432"
$DB_NAME = $env:DB_NAME ?? "codemind"
$DB_USER = $env:DB_USER ?? "codemind"
$DB_PASSWORD = $env:DB_PASSWORD ?? "codemind123"

# Project paths
$ProjectRoot = "C:\workspace\claude\CodeMind"
$SchemaFile = Join-Path $ProjectRoot "src\database\schema.postgres.sql"

function Test-DatabaseConnection {
    Write-Host "🔍 Testing database connection..." -ForegroundColor Yellow
    
    try {
        $result = docker exec codemind-database pg_isready -h localhost -p 5432 -U $DB_USER 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database connection successful" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Database not ready" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Database connection failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Initialize-Schema {
    Write-Host "📋 Initializing database schema..." -ForegroundColor Yellow
    
    if (!(Test-Path $SchemaFile)) {
        Write-Host "❌ Schema file not found: $SchemaFile" -ForegroundColor Red
        exit 1
    }
    
    try {
        # Apply schema
        Get-Content $SchemaFile | docker exec -i codemind-database psql -U $DB_USER -d $DB_NAME
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database schema initialized successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Schema initialization completed with warnings" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Schema initialization failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Initialize-FundamentalData {
    Write-Host "🔧 Loading fundamental data..." -ForegroundColor Yellow
    
    try {
        # Load default external tools
        Write-Host "Loading default external tools..."
        npx tsx "$ProjectRoot\scripts\force-load-tools.ts"
        
        # Insert essential configuration
        Write-Host "Loading system configuration..."
        docker exec codemind-database psql -U $DB_USER -d $DB_NAME -c "
            INSERT INTO system_config (config_key, config_value, is_global) VALUES
            ('system_version', '\"2.0.0\"', true),
            ('architecture_type', '\"three-layer\"', true),
            ('default_role_timeout_minutes', '30', true),
            ('max_concurrent_workflows', '5', true),
            ('external_tools_enabled', 'true', true),
            ('dashboard_enabled', 'true', true)
            ON CONFLICT (config_key) DO UPDATE SET 
                config_value = EXCLUDED.config_value,
                updated_at = NOW();
        "
        
        Write-Host "✅ Fundamental data loaded successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Data initialization failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Reset-Database {
    if (!$Force) {
        $confirm = Read-Host "⚠️ This will completely reset the database. Continue? (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Host "Database reset cancelled." -ForegroundColor Yellow
            return
        }
    }
    
    Write-Host "🗑️ Resetting database..." -ForegroundColor Red
    
    try {
        # Drop and recreate database
        docker exec codemind-database psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
        docker exec codemind-database psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
        
        Write-Host "✅ Database reset complete" -ForegroundColor Green
    } catch {
        Write-Host "❌ Database reset failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Show-DatabaseStatus {
    Write-Host "📊 Database Status:" -ForegroundColor Cyan
    
    # Show table counts
    $tables = @("projects", "external_tools", "tool_installations", "role_tool_permissions", "system_config")
    
    foreach ($table in $tables) {
        try {
            $count = docker exec codemind-database psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>$null
            if ($count) {
                Write-Host "  $table`: $($count.Trim()) rows" -ForegroundColor White
            } else {
                Write-Host "  $table`: N/A" -ForegroundColor Gray
            }
        } catch {
            Write-Host "  $table`: Error" -ForegroundColor Red
        }
    }
}

# Main execution
Set-Location $ProjectRoot

if (!(Test-DatabaseConnection)) {
    Write-Host "❌ Database not available. Please ensure PostgreSQL container is running." -ForegroundColor Red
    Write-Host "Run: docker-compose --env-file .env.docker up -d codemind-db" -ForegroundColor Yellow
    exit 1
}

switch ($Action.ToLower()) {
    "schema" {
        Initialize-Schema
    }
    "data" {
        Initialize-FundamentalData
    }
    "reset" {
        Reset-Database
        Initialize-Schema
        Initialize-FundamentalData
    }
    "status" {
        Show-DatabaseStatus
    }
    "full" {
        Initialize-Schema
        Initialize-FundamentalData
        Show-DatabaseStatus
        Write-Host "🎉 Database initialization complete!" -ForegroundColor Green
    }
    default {
        Write-Host "Usage: ./init-database.ps1 -Action [full|schema|data|reset|status]" -ForegroundColor Yellow
        Write-Host "Examples:" -ForegroundColor Cyan
        Write-Host "  ./init-database.ps1 -Action full" -ForegroundColor White
        Write-Host "  ./init-database.ps1 -Action reset -Force" -ForegroundColor White
    }
}