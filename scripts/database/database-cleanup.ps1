# PowerShell script for safe database cleanup
# Executes the database cleanup with proper error handling and backups

param(
    [switch]$DryRun,
    [switch]$CreateBackup,
    [string]$BackupPath = "C:\workspace\claude\CodeMind\.backups",
    [string]$DatabaseUrl = $env:DATABASE_URL
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-DatabaseConnection {
    param([string]$ConnectionString)
    
    try {
        # Test PostgreSQL connection
        $env:PGPASSWORD = "codemind123"
        $result = psql -h localhost -p 5432 -U codemind -d codemind -c "SELECT 1;" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Database connection successful" $Green
            return $true
        } else {
            Write-ColorOutput "❌ Database connection failed: $result" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ Database connection error: $_" $Red
        return $false
    }
}

function Create-DatabaseBackup {
    param([string]$BackupDir)
    
    Write-ColorOutput "📦 Creating database backup..." $Cyan
    
    # Ensure backup directory exists
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $BackupDir "codemind_backup_$timestamp.sql"
    
    try {
        $env:PGPASSWORD = "codemind123"
        $result = pg_dump -h localhost -p 5432 -U codemind -d codemind -f $backupFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Backup created: $backupFile" $Green
            return $backupFile
        } else {
            Write-ColorOutput "❌ Backup failed: $result" $Red
            return $null
        }
    }
    catch {
        Write-ColorOutput "❌ Backup error: $_" $Red
        return $null
    }
}

function Get-TableSizes {
    Write-ColorOutput "📊 Analyzing current table sizes..." $Cyan
    
    $query = @"
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"@

    try {
        $env:PGPASSWORD = "codemind123"
        $result = psql -h localhost -p 5432 -U codemind -d codemind -c $query 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput $result $Cyan
        } else {
            Write-ColorOutput "❌ Failed to get table sizes: $result" $Red
        }
    }
    catch {
        Write-ColorOutput "❌ Error getting table sizes: $_" $Red
    }
}

function Execute-CleanupScript {
    param([string]$ScriptPath, [bool]$DryRunMode)
    
    if ($DryRunMode) {
        Write-ColorOutput "🔍 DRY RUN MODE: Would execute cleanup script" $Yellow
        Write-ColorOutput "Script path: $ScriptPath" $Yellow
        return $true
    }
    
    Write-ColorOutput "🧹 Executing database cleanup..." $Cyan
    
    try {
        $env:PGPASSWORD = "codemind123"
        $result = psql -h localhost -p 5432 -U codemind -d codemind -f $ScriptPath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Cleanup script executed successfully" $Green
            Write-ColorOutput $result $Green
            return $true
        } else {
            Write-ColorOutput "❌ Cleanup script failed: $result" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ Cleanup script error: $_" $Red
        return $false
    }
}

function Optimize-Database {
    Write-ColorOutput "⚡ Optimizing database (VACUUM and ANALYZE)..." $Cyan
    
    try {
        $env:PGPASSWORD = "codemind123"
        
        # Run VACUUM
        Write-ColorOutput "Running VACUUM..." $Cyan
        $result = psql -h localhost -p 5432 -U codemind -d codemind -c "VACUUM;" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ VACUUM completed" $Green
        } else {
            Write-ColorOutput "⚠️ VACUUM warning: $result" $Yellow
        }
        
        # Run ANALYZE
        Write-ColorOutput "Running ANALYZE..." $Cyan
        $result = psql -h localhost -p 5432 -U codemind -d codemind -c "ANALYZE;" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ ANALYZE completed" $Green
        } else {
            Write-ColorOutput "⚠️ ANALYZE warning: $result" $Yellow
        }
    }
    catch {
        Write-ColorOutput "❌ Database optimization error: $_" $Red
    }
}

# Main execution
Write-ColorOutput "🚀 CodeMind Database Cleanup Script" $Cyan
Write-ColorOutput "===================================" $Cyan

# Check if psql is available
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-ColorOutput "❌ PostgreSQL client (psql) not found. Please install PostgreSQL or add it to PATH." $Red
    exit 1
}

# Test database connection
if (-not (Test-DatabaseConnection)) {
    Write-ColorOutput "❌ Cannot connect to database. Please check your connection settings." $Red
    exit 1
}

# Get current state
Write-ColorOutput "📋 Current database state:" $Cyan
Get-TableSizes

# Create backup if requested
if ($CreateBackup) {
    $backupFile = Create-DatabaseBackup $BackupPath
    if (-not $backupFile) {
        Write-ColorOutput "❌ Backup failed. Aborting cleanup for safety." $Red
        exit 1
    }
}

# Confirm execution
if (-not $DryRun) {
    Write-ColorOutput "⚠️  This will permanently delete unused database tables!" $Yellow
    Write-ColorOutput "Tables to be removed:" $Yellow
    Write-ColorOutput "- semantic_search_embeddings" $Yellow
    Write-ColorOutput "- questionnaire_responses" $Yellow  
    Write-ColorOutput "- resume_state" $Yellow
    Write-ColorOutput "- query_performance_log" $Yellow
    Write-ColorOutput "- database_relationships" $Yellow
    Write-ColorOutput "- database_analysis" $Yellow
    Write-ColorOutput "- database_schema_summary" $Yellow
    
    $confirmation = Read-Host "Type 'DELETE' to confirm deletion"
    if ($confirmation -ne "DELETE") {
        Write-ColorOutput "❌ Cleanup cancelled by user." $Yellow
        exit 0
    }
}

# Execute cleanup script
$scriptPath = Join-Path $PSScriptRoot "database-cleanup.sql"
if (-not (Test-Path $scriptPath)) {
    Write-ColorOutput "❌ Cleanup script not found: $scriptPath" $Red
    exit 1
}

if (Execute-CleanupScript $scriptPath $DryRun) {
    if (-not $DryRun) {
        Write-ColorOutput "🎉 Database cleanup completed successfully!" $Green
        
        # Show new state
        Write-ColorOutput "📋 Database state after cleanup:" $Cyan
        Get-TableSizes
        
        # Optimize database
        Optimize-Database
        
        Write-ColorOutput "✅ All cleanup operations completed!" $Green
        
        if ($CreateBackup -and $backupFile) {
            Write-ColorOutput "💾 Backup saved at: $backupFile" $Green
        }
    }
} else {
    Write-ColorOutput "❌ Database cleanup failed!" $Red
    
    if ($CreateBackup -and $backupFile) {
        Write-ColorOutput "💾 You can restore from backup: $backupFile" $Yellow
        Write-ColorOutput "Restore command: psql -h localhost -p 5432 -U codemind -d codemind -f `"$backupFile`"" $Yellow
    }
    
    exit 1
}