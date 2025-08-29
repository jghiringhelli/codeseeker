#!/bin/bash

# CodeMind Database Initialization Script (Linux/Mac)
# Initializes PostgreSQL database with schema and essential data

ACTION=${1:-full}
FORCE=${2:-false}

echo "🗄️ CodeMind Database Initialization"
echo "=================================="

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-codemind}
DB_USER=${DB_USER:-codemind}
DB_PASSWORD=${DB_PASSWORD:-codemind123}

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="$PROJECT_ROOT/src/database/schema.postgres.sql"

test_database_connection() {
    echo "🔍 Testing database connection..."
    
    if docker exec codemind-database pg_isready -h localhost -p 5432 -U $DB_USER >/dev/null 2>&1; then
        echo "✅ Database connection successful"
        return 0
    else
        echo "❌ Database not ready"
        return 1
    fi
}

initialize_schema() {
    echo "📋 Initializing database schema..."
    
    if [ ! -f "$SCHEMA_FILE" ]; then
        echo "❌ Schema file not found: $SCHEMA_FILE"
        exit 1
    fi
    
    if docker exec -i codemind-database psql -U $DB_USER -d $DB_NAME < "$SCHEMA_FILE"; then
        echo "✅ Database schema initialized successfully"
    else
        echo "⚠️ Schema initialization completed with warnings"
    fi
}

initialize_fundamental_data() {
    echo "🔧 Loading fundamental data..."
    
    # Load default external tools
    echo "Loading default external tools..."
    cd "$PROJECT_ROOT"
    npx tsx "scripts/force-load-tools.ts"
    
    # Insert essential configuration
    echo "Loading system configuration..."
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
    
    echo "✅ Fundamental data loaded successfully"
}

reset_database() {
    if [ "$FORCE" != "true" ]; then
        read -p "⚠️ This will completely reset the database. Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Database reset cancelled."
            return
        fi
    fi
    
    echo "🗑️ Resetting database..."
    
    docker exec codemind-database psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
    docker exec codemind-database psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
    
    echo "✅ Database reset complete"
}

show_database_status() {
    echo "📊 Database Status:"
    
    tables=("projects" "external_tools" "tool_installations" "role_tool_permissions" "system_config")
    
    for table in "${tables[@]}"; do
        count=$(docker exec codemind-database psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
        if [ -n "$count" ]; then
            echo "  $table: $count rows"
        else
            echo "  $table: N/A"
        fi
    done
}

# Main execution
cd "$PROJECT_ROOT"

if ! test_database_connection; then
    echo "❌ Database not available. Please ensure PostgreSQL container is running."
    echo "Run: docker-compose --env-file .env.docker up -d codemind-db"
    exit 1
fi

case "$ACTION" in
    "schema")
        initialize_schema
        ;;
    "data")
        initialize_fundamental_data
        ;;
    "reset")
        reset_database
        initialize_schema
        initialize_fundamental_data
        ;;
    "status")
        show_database_status
        ;;
    "full")
        initialize_schema
        initialize_fundamental_data
        show_database_status
        echo "🎉 Database initialization complete!"
        ;;
    *)
        echo "Usage: $0 [full|schema|data|reset|status] [force]"
        echo "Examples:"
        echo "  $0 full"
        echo "  $0 reset force"
        ;;
esac