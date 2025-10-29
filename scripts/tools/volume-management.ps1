# CodeMind Volume Management Script
# Manages Docker volumes for persistent data storage

param(
    [string]$Action = "status",  # status, backup, restore, clean, reset
    [string]$BackupPath = ".\backups",
    [switch]$Force
)

Write-Host "🗄️ CodeMind Volume Management" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# Set locations
$ProjectRoot = "C:\workspace\claude\CodeMind"
$BackupDir = Join-Path $ProjectRoot "backups"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Ensure backup directory exists
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

function Show-VolumeStatus {
    Write-Host "📊 Current Volume Status:" -ForegroundColor Green
    
    # List CodeMind volumes
    $volumes = docker volume ls --filter "name=codemind" --format "table {{.Name}}\t{{.Driver}}\t{{.Mountpoint}}"
    Write-Host $volumes
    
    # Check database volume specifically
    $dbVolume = docker volume inspect codemind_codemind_db_data --format "{{.Mountpoint}}" 2>$null
    if ($dbVolume) {
        Write-Host "✅ Database volume: $dbVolume" -ForegroundColor Green
        
        # Check volume size
        try {
            $dbSize = docker run --rm -v codemind_codemind_db_data:/data alpine du -sh /data 2>$null
            if ($dbSize) {
                Write-Host "📊 Database size: $dbSize" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️ Could not determine database size" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Database volume not found!" -ForegroundColor Red
    }
    
    # Show container status
    Write-Host "`n🐳 Container Status:" -ForegroundColor Green
    docker-compose --env-file .env.docker ps
}

function Backup-Database {
    Write-Host "💾 Creating database backup..." -ForegroundColor Yellow
    
    $backupFile = Join-Path $BackupDir "codemind-db-$Timestamp.sql"
    $configBackup = Join-Path $BackupDir "codemind-config-$Timestamp.json"
    
    try {
        # Backup database schema and data
        Write-Host "Backing up database to: $backupFile"
        docker exec codemind-database pg_dump -U codemind -d codemind > $backupFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database backup successful!" -ForegroundColor Green
        } else {
            throw "Database backup failed with exit code $LASTEXITCODE"
        }
        
        # Backup configuration
        Write-Host "Backing up configuration..."
        $config = @{
            timestamp = $Timestamp
            database_credentials = @{
                host = "localhost"
                port = 5432
                database = "codemind"
                username = "codemind"
                password = "codemind123"
            }
            volumes = @{
                database = "codemind_codemind_db_data"
                redis = "codemind_codemind_redis_data"
                api_logs = "codemind_codemind_api_logs"
                dashboard_logs = "codemind_codemind_dashboard_logs"
            }
            services_status = (docker-compose --env-file .env.docker ps --format json | ConvertFrom-Json)
        }
        
        $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configBackup -Encoding UTF8
        
        Write-Host "✅ Configuration backup saved to: $configBackup" -ForegroundColor Green
        
        # Create volume backup
        Write-Host "Creating volume backup..."
        $volumeBackup = Join-Path $BackupDir "codemind-volume-$Timestamp.tar.gz"
        docker run --rm -v codemind_codemind_db_data:/data -v ${BackupDir}:/backup alpine tar czf /backup/codemind-volume-$Timestamp.tar.gz -C /data .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Volume backup successful!" -ForegroundColor Green
            Write-Host "📁 Backup files created:" -ForegroundColor Cyan
            Write-Host "  - Database: $backupFile" -ForegroundColor White
            Write-Host "  - Config: $configBackup" -ForegroundColor White
            Write-Host "  - Volume: $volumeBackup" -ForegroundColor White
        }
        
    } catch {
        Write-Host "❌ Backup failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Restore-Database {
    param([string]$RestoreFile)
    
    if (!$RestoreFile -or !(Test-Path $RestoreFile)) {
        Write-Host "❌ Please specify a valid backup file to restore" -ForegroundColor Red
        return
    }
    
    if (!$Force) {
        $confirm = Read-Host "⚠️ This will overwrite the current database. Continue? (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Host "Restore cancelled." -ForegroundColor Yellow
            return
        }
    }
    
    Write-Host "🔄 Restoring database from: $RestoreFile" -ForegroundColor Yellow
    
    try {
        # Stop services that depend on database
        docker-compose --env-file .env.docker stop codemind-api codemind-dashboard codemind-orchestrator
        
        # Drop and recreate database
        docker exec codemind-database psql -U codemind -c "DROP DATABASE IF EXISTS codemind;"
        docker exec codemind-database psql -U codemind -c "CREATE DATABASE codemind;"
        
        # Restore from backup
        Get-Content $RestoreFile | docker exec -i codemind-database psql -U codemind -d codemind
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database restored successfully!" -ForegroundColor Green
            
            # Restart services
            Write-Host "🚀 Restarting services..." -ForegroundColor Yellow
            docker-compose --env-file .env.docker up -d
            
            Write-Host "✅ Services restarted. Database restore complete!" -ForegroundColor Green
        } else {
            throw "Database restore failed"
        }
        
    } catch {
        Write-Host "❌ Restore failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Reset-Volumes {
    if (!$Force) {
        $confirm = Read-Host "⚠️ This will permanently delete all CodeMind data and volumes. Continue? (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Host "Reset cancelled." -ForegroundColor Yellow
            return
        }
    }
    
    Write-Host "🗑️ Resetting all CodeMind volumes..." -ForegroundColor Red
    
    try {
        # Stop all services
        docker-compose --env-file .env.docker down -v
        
        # Remove specific volumes
        $volumes = @(
            "codemind_codemind_db_data",
            "codemind_codemind_redis_data", 
            "codemind_codemind_api_logs",
            "codemind_codemind_dashboard_logs",
            "codemind_codemind_orchestrator_logs"
        )
        
        foreach ($volume in $volumes) {
            Write-Host "Removing volume: $volume"
            docker volume rm $volume 2>$null
        }
        
        # Clean up orphaned volumes
        docker volume prune -f
        
        Write-Host "✅ All volumes reset. Starting fresh services..." -ForegroundColor Green
        
        # Restart with fresh volumes
        docker-compose --env-file .env.docker up -d
        
        Write-Host "🎉 Fresh CodeMind instance ready!" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Reset failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Clean-OldBackups {
    Write-Host "🧹 Cleaning old backups (keeping last 10)..." -ForegroundColor Yellow
    
    $backupFiles = Get-ChildItem $BackupDir -Name "codemind-*" | Sort-Object -Descending
    
    if ($backupFiles.Count -gt 10) {
        $filesToDelete = $backupFiles | Select-Object -Skip 10
        
        foreach ($file in $filesToDelete) {
            $filePath = Join-Path $BackupDir $file
            Remove-Item $filePath -Force
            Write-Host "Deleted: $file" -ForegroundColor Gray
        }
        
        Write-Host "✅ Cleaned $($filesToDelete.Count) old backup files" -ForegroundColor Green
    } else {
        Write-Host "No cleanup needed. Found $($backupFiles.Count) backup files." -ForegroundColor Green
    }
}

# Main execution
Set-Location $ProjectRoot

switch ($Action.ToLower()) {
    "status" {
        Show-VolumeStatus
    }
    "backup" {
        Backup-Database
        Clean-OldBackups
    }
    "restore" {
        if ($BackupPath) {
            Restore-Database -RestoreFile $BackupPath
        } else {
            Write-Host "❌ Please specify backup file with -BackupPath" -ForegroundColor Red
        }
    }
    "reset" {
        Reset-Volumes
    }
    "clean" {
        Clean-OldBackups
    }
    default {
        Write-Host "Usage: ./volume-management.ps1 -Action [status|backup|restore|reset|clean]" -ForegroundColor Yellow
        Write-Host "Examples:" -ForegroundColor Cyan
        Write-Host "  ./volume-management.ps1 -Action status" -ForegroundColor White
        Write-Host "  ./volume-management.ps1 -Action backup" -ForegroundColor White
        Write-Host "  ./volume-management.ps1 -Action restore -BackupPath .\backups\codemind-db-20250829-143022.sql" -ForegroundColor White
        Write-Host "  ./volume-management.ps1 -Action reset -Force" -ForegroundColor White
    }
}