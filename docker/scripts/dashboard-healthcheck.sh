#!/bin/bash
# Health check script for CodeMind Dashboard

set -e

# Configuration
DASHBOARD_PORT=${DASHBOARD_PORT:-3005}
HEALTH_ENDPOINT="http://localhost:${DASHBOARD_PORT}/api/dashboard/status"
MAX_RETRIES=3
RETRY_INTERVAL=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] HEALTHCHECK:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Function to check if dashboard server is responding
check_dashboard_health() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log "Health check attempt $attempt/$MAX_RETRIES"
        
        # Check if port is listening
        if ! netstat -tuln 2>/dev/null | grep -q ":${DASHBOARD_PORT} "; then
            error "Dashboard server not listening on port $DASHBOARD_PORT"
            return 1
        fi
        
        # Make HTTP request to health endpoint
        local response
        local http_code
        
        if command -v curl >/dev/null 2>&1; then
            response=$(curl -s -w "%{http_code}" --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
            http_code="${response: -3}"
            response="${response%???}"
        elif command -v wget >/dev/null 2>&1; then
            response=$(wget -q -O- --timeout=10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "")
            http_code=$([ -n "$response" ] && echo "200" || echo "000")
        else
            error "Neither curl nor wget available for health check"
            return 1
        fi
        
        if [ "$http_code" = "200" ]; then
            log "Dashboard server is healthy (HTTP $http_code)"
            
            # Validate response contains expected data
            if echo "$response" | grep -q '"timestamp"' && echo "$response" | grep -q '"version"'; then
                log "Health check response contains expected data"
                return 0
            else
                warn "Health check response missing expected data"
            fi
        else
            warn "Dashboard server returned HTTP $http_code on attempt $attempt"
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log "Waiting ${RETRY_INTERVAL}s before retry..."
            sleep $RETRY_INTERVAL
        fi
        
        attempt=$((attempt + 1))
    done
    
    error "Dashboard health check failed after $MAX_RETRIES attempts"
    return 1
}

# Function to check database connectivity
check_database_connection() {
    local db_host=${DB_HOST:-localhost}
    local db_port=${DB_PORT:-5432}
    local db_name=${DB_NAME:-codemind}
    local db_user=${DB_USER:-codemind}
    
    log "Checking database connection to $db_host:$db_port/$db_name"
    
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h "$db_host" -p "$db_port" -d "$db_name" -U "$db_user" -q; then
            log "Database connection is healthy"
            return 0
        else
            warn "Database connection check failed"
            return 1
        fi
    else
        warn "pg_isready not available, skipping database connectivity check"
        return 0
    fi
}

# Function to check system resources
check_system_resources() {
    log "Checking system resources"
    
    # Check memory usage
    local memory_info
    if [ -f "/proc/meminfo" ]; then
        local mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        local mem_usage_percent=$((100 - (mem_available * 100 / mem_total)))
        
        log "Memory usage: ${mem_usage_percent}%"
        
        if [ "$mem_usage_percent" -gt 90 ]; then
            error "High memory usage: ${mem_usage_percent}%"
            return 1
        elif [ "$mem_usage_percent" -gt 80 ]; then
            warn "Memory usage is high: ${mem_usage_percent}%"
        fi
    fi
    
    # Check disk space for logs
    local logs_dir="/app/logs"
    if [ -d "$logs_dir" ]; then
        local disk_usage
        disk_usage=$(df "$logs_dir" | tail -1 | awk '{print $5}' | sed 's/%//')
        
        log "Disk usage for logs: ${disk_usage}%"
        
        if [ "$disk_usage" -gt 90 ]; then
            error "High disk usage for logs: ${disk_usage}%"
            return 1
        elif [ "$disk_usage" -gt 80 ]; then
            warn "Disk usage for logs is high: ${disk_usage}%"
        fi
    fi
    
    return 0
}

# Function to check process health
check_process_health() {
    log "Checking Node.js process health"
    
    # Check if Node.js process is running
    if ! pgrep -f "node.*dashboard.*server" >/dev/null; then
        error "Dashboard Node.js process not found"
        return 1
    fi
    
    # Check process uptime (should be running for more than 30 seconds in normal conditions)
    local process_age
    process_age=$(ps -o etimes= -p "$(pgrep -f 'node.*dashboard.*server')" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$process_age" -lt 30 ] && [ "${HEALTHCHECK_STARTUP:-false}" != "true" ]; then
        warn "Dashboard process is very young (${process_age}s), might be restarting"
    else
        log "Dashboard process uptime: ${process_age}s"
    fi
    
    return 0
}

# Main health check execution
main() {
    log "Starting comprehensive health check for CodeMind Dashboard"
    
    local overall_status=0
    
    # Core health checks
    if ! check_dashboard_health; then
        overall_status=1
    fi
    
    if ! check_process_health; then
        overall_status=1
    fi
    
    # Optional checks (warnings don't fail the health check)
    check_database_connection || warn "Database check failed"
    check_system_resources || warn "System resources check failed"
    
    # Final status
    if [ $overall_status -eq 0 ]; then
        log "✅ Overall health check: HEALTHY"
        exit 0
    else
        error "❌ Overall health check: UNHEALTHY"
        exit 1
    fi
}

# Execute main function
main "$@"