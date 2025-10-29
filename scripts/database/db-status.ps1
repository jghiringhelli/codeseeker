# CodeMind Database Status and Management Script
param(
    [string]$Action = "status",
    [switch]$Detailed,
    [switch]$Json
)

# Database connection parameters
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "codemind"
$DB_USER = "codemind"
$DB_PASSWORD = "codemind123"

function Write-StatusMessage {
    param([string]$Message, [string]$Color = "White")
    if (!$Json) {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Get-DatabaseStatus {
    Write-StatusMessage "Checking CodeMind Database Status..." "Cyan"
    
    $status = @{
        connection = @{}
        volumes = @{}
        external_tools = @{}
        tables = @{}
        credentials = @{
            host = $DB_HOST
            port = $DB_PORT
            database = $DB_NAME
            username = $DB_USER
        }
    }
    
    try {
        # Test Docker container
        $containerStatus = docker ps --filter "name=codemind-database" --format "{{.Names}}" 2>$null
        if ($containerStatus) {
            Write-StatusMessage "Database container is running" "Green"
            $status.connection.container = "running"
        } else {
            Write-StatusMessage "Database container is not running" "Red"
            $status.connection.container = "stopped"
            return $status
        }
        
        # Test PostgreSQL connection
        $connectionTest = docker exec codemind-database pg_isready -h localhost -p 5432 -U $DB_USER 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-StatusMessage "PostgreSQL is ready" "Green"
            $status.connection.postgresql = "ready"
        } else {
            Write-StatusMessage "PostgreSQL is not ready" "Red"
            $status.connection.postgresql = "not_ready"
            return $status
        }
        
        # Check volumes
        $dbVolume = docker volume inspect codemind_codemind_db_data --format "{{.Mountpoint}}" 2>$null
        if ($dbVolume) {
            Write-StatusMessage "Database volume exists: $dbVolume" "Green"
            $status.volumes.database = $dbVolume
            $status.volumes.persistent = $true
        } else {
            Write-StatusMessage "Database volume not found" "Yellow"
            $status.volumes.persistent = $false
        }
        
        # Check external tools tables
        Write-StatusMessage "Checking External Tools System..." "Cyan"
        
        $externalToolsTables = @("external_tools", "tool_installations", "role_tool_permissions")
        
        foreach ($table in $externalToolsTables) {
            $tableCheck = docker exec codemind-database psql -U $DB_USER -d $DB_NAME -t -c "SELECT to_regclass('$table');" 2>$null
            if ($tableCheck -and $tableCheck.Trim() -ne "") {
                Write-StatusMessage "Table '$table' exists" "Green"
                $status.external_tools.$table = "exists"
            } else {
                Write-StatusMessage "Table '$table' missing" "Red"
                $status.external_tools.$table = "missing"
            }
        }
        
        # Check default tools loaded
        $defaultToolsCount = docker exec codemind-database psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM external_tools WHERE is_active = true;" 2>$null
        if ($defaultToolsCount -and $defaultToolsCount.Trim() -gt 0) {
            Write-StatusMessage "Default tools loaded: $($defaultToolsCount.Trim()) tools" "Green"
            $status.external_tools.default_tools_count = $defaultToolsCount.Trim()
        } else {
            Write-StatusMessage "No default tools found" "Yellow"
            $status.external_tools.default_tools_count = "0"
        }
        
        Write-StatusMessage "Database status check completed" "Green"
        
    } catch {
        Write-StatusMessage "Error checking database: $($_.Exception.Message)" "Red"
        $status.error = $_.Exception.Message
    }
    
    return $status
}

function Show-ConnectionInfo {
    Write-StatusMessage "CodeMind Database Connection Information" "Cyan"
    Write-StatusMessage "Host: $DB_HOST" "White"
    Write-StatusMessage "Port: $DB_PORT" "White" 
    Write-StatusMessage "Database: $DB_NAME" "White"
    Write-StatusMessage "Username: $DB_USER" "White"
    Write-StatusMessage "Password: $DB_PASSWORD" "White"
    Write-StatusMessage "" "White"
    Write-StatusMessage "Connection Commands:" "Yellow"
    Write-StatusMessage "psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME" "White"
    Write-StatusMessage "docker exec -it codemind-database psql -U $DB_USER -d $DB_NAME" "White"
}

# Main execution
switch ($Action.ToLower()) {
    "status" {
        $result = Get-DatabaseStatus
        if ($Json) {
            $result | ConvertTo-Json -Depth 10
        }
    }
    "connection" {
        Show-ConnectionInfo
    }
    default {
        Write-StatusMessage "Usage: ./db-status.ps1 -Action [status|connection]" "Yellow"
    }
}