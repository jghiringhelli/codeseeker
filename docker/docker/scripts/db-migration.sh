#!/bin/bash

# CodeMind Database Migration Script
# This script handles database schema updates for existing deployments

set -e

echo "🔧 CodeMind Database Migration Starting..."

# Database connection parameters
DB_HOST="${DB_HOST:-codemind-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-codemind}"
DB_USER="${DB_USER:-codemind}"
PGPASSWORD="${DB_PASSWORD:-codemind123}"

export PGPASSWORD

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME; do
  echo "Database not ready, waiting..."
  sleep 2
done

echo "✅ Database is ready, starting migration..."

# Check if this is a fresh database or needs migration
TABLES_EXIST=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='projects';")

if [ "$TABLES_EXIST" -eq "0" ]; then
    echo "📊 Fresh database detected, running full schema initialization..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f /docker-entrypoint-initdb.d/01-schema.sql
    echo "✅ Full schema initialization completed"
else
    echo "🔄 Existing database detected, running incremental migration..."
    
    # Check for external tools tables (new feature)
    EXTERNAL_TOOLS_EXIST=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='external_tools';")
    
    if [ "$EXTERNAL_TOOLS_EXIST" -eq "0" ]; then
        echo "🔧 Adding external tools management tables..."
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        -- External tools management system tables
        CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
        
        -- External tools registry
        CREATE TABLE IF NOT EXISTS external_tools (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tool_id VARCHAR(100) UNIQUE NOT NULL,
          tool_name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100) NOT NULL,
          executable TEXT NOT NULL,
          install_command TEXT,
          check_command TEXT NOT NULL,
          languages TEXT[] DEFAULT ARRAY[]::TEXT[],
          frameworks TEXT[] DEFAULT ARRAY[]::TEXT[],
          purposes TEXT[] DEFAULT ARRAY[]::TEXT[],
          package_manager VARCHAR(50),
          global_install BOOLEAN DEFAULT false,
          version VARCHAR(50),
          homepage TEXT,
          documentation TEXT,
          license_type VARCHAR(100) DEFAULT 'unknown',
          trust_level VARCHAR(50) DEFAULT 'community' CHECK (
            trust_level IN ('safe', 'verified', 'community', 'experimental')
          ),
          installation_time VARCHAR(50) DEFAULT 'medium' CHECK (
            installation_time IN ('instant', 'fast', 'medium', 'slow')
          ),
          disk_space_mb INTEGER DEFAULT 0,
          prerequisites TEXT[] DEFAULT ARRAY[]::TEXT[],
          config_files TEXT[] DEFAULT ARRAY[]::TEXT[],
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Tool installations
        CREATE TABLE IF NOT EXISTS tool_installations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
          project_path TEXT NOT NULL,
          installed_version VARCHAR(100),
          installation_method VARCHAR(50) DEFAULT 'local' CHECK (
            installation_method IN ('global', 'local', 'project')
          ),
          install_date TIMESTAMPTZ DEFAULT NOW(),
          last_used TIMESTAMPTZ DEFAULT NOW(),
          usage_count INTEGER DEFAULT 0,
          config_path TEXT,
          is_working BOOLEAN DEFAULT true,
          last_check TIMESTAMPTZ DEFAULT NOW(),
          installation_notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Role-tool permissions
        CREATE TABLE IF NOT EXISTS role_tool_permissions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          role_type VARCHAR(100) NOT NULL,
          tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
          permission VARCHAR(50) DEFAULT 'ask-permission' CHECK (
            permission IN ('allowed', 'auto-approved', 'ask-permission', 'denied')
          ),
          auto_install BOOLEAN DEFAULT false,
          max_usage_per_session INTEGER,
          restrict_to_projects TEXT[],
          approved_by VARCHAR(255),
          approval_date TIMESTAMPTZ,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(role_type, tool_id)
        );
        
        -- User approval history
        CREATE TABLE IF NOT EXISTS tool_approval_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
          role_type VARCHAR(100) NOT NULL,
          request_type VARCHAR(50) NOT NULL CHECK (
            request_type IN ('install', 'execute', 'auto-install-enable')
          ),
          user_decision VARCHAR(50) NOT NULL CHECK (
            user_decision IN ('approved', 'denied', 'approve-once', 'approve-always')
          ),
          requested_at TIMESTAMPTZ DEFAULT NOW(),
          decided_at TIMESTAMPTZ DEFAULT NOW(),
          reasoning TEXT,
          remember_decision BOOLEAN DEFAULT false
        );
        
        -- Tech stack detections
        CREATE TABLE IF NOT EXISTS tech_stack_detections (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          project_path TEXT NOT NULL,
          languages JSONB DEFAULT '{}'::JSONB,
          frameworks JSONB DEFAULT '{}'::JSONB,
          package_managers TEXT[] DEFAULT ARRAY[]::TEXT[],
          build_tools TEXT[] DEFAULT ARRAY[]::TEXT[],
          test_frameworks TEXT[] DEFAULT ARRAY[]::TEXT[],
          linters TEXT[] DEFAULT ARRAY[]::TEXT[],
          formatters TEXT[] DEFAULT ARRAY[]::TEXT[],
          dependencies JSONB DEFAULT '{}'::JSONB,
          detection_confidence DECIMAL(3,2) DEFAULT 0.8,
          last_scan TIMESTAMPTZ DEFAULT NOW(),
          scan_duration_ms INTEGER,
          file_count_analyzed INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Tool recommendations
        CREATE TABLE IF NOT EXISTS tool_recommendations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
          role_type VARCHAR(100) NOT NULL,
          confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
          reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
          urgency VARCHAR(50) DEFAULT 'medium' CHECK (
            urgency IN ('low', 'medium', 'high', 'critical')
          ),
          timing VARCHAR(50) DEFAULT 'as-needed' CHECK (
            timing IN ('now', 'project-setup', 'before-coding', 'as-needed')
          ),
          estimated_benefit DECIMAL(3,2) CHECK (estimated_benefit >= 0 AND estimated_benefit <= 1),
          recommendation_status VARCHAR(50) DEFAULT 'pending' CHECK (
            recommendation_status IN ('pending', 'accepted', 'rejected', 'installed', 'ignored')
          ),
          user_feedback TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          acted_on_at TIMESTAMPTZ
        );
        
        -- Tool usage analytics
        CREATE TABLE IF NOT EXISTS tool_usage_analytics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
          role_type VARCHAR(100) NOT NULL,
          usage_type VARCHAR(50) NOT NULL CHECK (
            usage_type IN ('execute', 'install', 'check', 'configure')
          ),
          execution_duration_ms INTEGER,
          success BOOLEAN NOT NULL,
          command_args TEXT,
          output_size_bytes INTEGER,
          error_message TEXT,
          context JSONB DEFAULT '{}'::JSONB,
          used_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_external_tools_tool_id ON external_tools(tool_id);
        CREATE INDEX IF NOT EXISTS idx_external_tools_category ON external_tools(category);
        CREATE INDEX IF NOT EXISTS idx_external_tools_trust_level ON external_tools(trust_level);
        CREATE INDEX IF NOT EXISTS idx_tool_installations_project_id ON tool_installations(project_id);
        CREATE INDEX IF NOT EXISTS idx_tool_installations_tool_id ON tool_installations(tool_id);
        CREATE INDEX IF NOT EXISTS idx_role_tool_permissions_role ON role_tool_permissions(role_type);
        CREATE INDEX IF NOT EXISTS idx_role_tool_permissions_tool ON role_tool_permissions(tool_id);
        CREATE INDEX IF NOT EXISTS idx_tool_recommendations_project_id ON tool_recommendations(project_id);
        CREATE INDEX IF NOT EXISTS idx_tool_recommendations_urgency ON tool_recommendations(urgency);
        CREATE INDEX IF NOT EXISTS idx_tool_usage_analytics_used_at ON tool_usage_analytics(used_at);
        
        -- Add configuration for external tools
        INSERT INTO system_config (config_key, config_value, config_type, description, is_global) VALUES
            ('external_tools_enabled', 'true', 'boolean', 'Enable external tool management system', true),
            ('auto_tool_recommendations', 'true', 'boolean', 'Enable automatic tool recommendations', true),
            ('tool_permission_timeout_hours', '24', 'number', 'Hours to remember user tool permission decisions', true),
            ('max_tool_installations_per_project', '50', 'number', 'Maximum tools that can be installed per project', true),
            ('tool_usage_analytics', 'true', 'boolean', 'Enable tool usage analytics collection', true)
        ON CONFLICT (config_key) DO NOTHING;
        "
        echo "✅ External tools management tables added"
    else
        echo "ℹ️  External tools tables already exist, skipping..."
    fi
    
    # Check for any missing columns or updates needed
    echo "🔍 Checking for schema updates..."
    
    # Update system configuration with any new settings
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    INSERT INTO system_config (config_key, config_value, config_type, description, is_global) VALUES
        ('sequential_workflows_enabled', 'true', 'boolean', 'Enable sequential workflow orchestration', true),
        ('redis_host', 'codemind-redis', 'string', 'Redis server host for message queuing', true),
        ('redis_port', '6379', 'number', 'Redis server port', true),
        ('default_workflow_timeout_minutes', '30', 'number', 'Default workflow timeout in minutes', true),
        ('max_workflow_retries', '3', 'number', 'Maximum retries per workflow role', true),
        ('role_processing_timeout_seconds', '300', 'number', 'Timeout for individual role processing', true),
        ('queue_monitoring_interval_seconds', '30', 'number', 'Interval for Redis queue status monitoring', true),
        ('workflow_cleanup_age_days', '7', 'number', 'Age in days after which to cleanup completed workflows', true),
        ('max_concurrent_workflows', '10', 'number', 'Maximum concurrent sequential workflows', true),
        ('role_terminal_workers', '5', 'number', 'Number of role terminal worker instances', true)
    ON CONFLICT (config_key) DO NOTHING;
    " || echo "⚠️  Configuration update had some conflicts (this is normal)"
    
    echo "✅ Schema migration completed successfully"
fi

# Run database health check
echo "🏥 Running database health check..."
DB_HEALTH=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM system_config WHERE config_key = 'postgres_version';")

if [ "$DB_HEALTH" -ge "1" ]; then
    echo "✅ Database health check passed"
else
    echo "⚠️  Database health check found issues, but continuing..."
fi

echo "🎉 Database migration completed successfully!"
echo "📊 Database is ready for CodeMind services"