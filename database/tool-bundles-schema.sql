-- Tool Bundle System Database Schema

-- Tool Bundles table
CREATE TABLE IF NOT EXISTS tool_bundles (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    tools JSON NOT NULL, -- Array of tool IDs
    dependencies JSON NOT NULL, -- Array of bundle IDs this depends on
    conditions JSON NOT NULL, -- Array of BundleCondition objects
    execution_order VARCHAR(50) DEFAULT 'dependency-based',
    priority INTEGER DEFAULT 0,
    token_cost VARCHAR(20) DEFAULT 'medium',
    estimated_time VARCHAR(20) DEFAULT 'medium',
    scenarios JSON NOT NULL, -- Array of scenario strings
    auto_trigger JSON, -- Array of trigger keywords
    version VARCHAR(50) DEFAULT '1.0.0',
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255) DEFAULT 'system',
    modified_by VARCHAR(255) DEFAULT 'system'
);

-- Tool and Bundle Descriptions table (for configurable descriptions)
CREATE TABLE IF NOT EXISTS configurable_descriptions (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('tool', 'bundle')),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    default_description TEXT NOT NULL,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by VARCHAR(255) DEFAULT 'user',
    is_custom BOOLEAN DEFAULT FALSE
);

-- Bundle usage statistics
CREATE TABLE IF NOT EXISTS bundle_usage_stats (
    id SERIAL PRIMARY KEY,
    bundle_id VARCHAR(255) REFERENCES tool_bundles(id),
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    context_task TEXT,
    codebase_languages JSON,
    success_rate DECIMAL(3,2),
    execution_time INTEGER, -- in seconds
    token_count INTEGER,
    user_feedback INTEGER DEFAULT 0, -- -1 to 5 rating
    project_path VARCHAR(500)
);

-- Tool definitions (enhanced from existing)
CREATE TABLE IF NOT EXISTS tool_definitions (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    capabilities JSON NOT NULL, -- Array of capability strings
    token_cost VARCHAR(20) DEFAULT 'medium',
    execution_time VARCHAR(20) DEFAULT 'medium',
    dependencies JSON NOT NULL, -- Array of tool dependencies
    parallelizable BOOLEAN DEFAULT TRUE,
    reliability DECIMAL(3,2) DEFAULT 0.80,
    auto_run JSON, -- Array of contexts where this tool should auto-run
    category VARCHAR(100),
    version VARCHAR(50) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT TRUE,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bundle selection history (for learning and optimization)
CREATE TABLE IF NOT EXISTS bundle_selection_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    task_description TEXT NOT NULL,
    codebase_context JSON,
    selected_bundles JSON, -- Array of selected bundle IDs
    selected_tools JSON, -- Array of selected tool IDs
    execution_plan JSON, -- Complete execution plan
    reasoning TEXT,
    total_token_cost INTEGER,
    estimated_time INTEGER,
    actual_time INTEGER,
    success BOOLEAN,
    user_satisfaction INTEGER, -- 1-5 rating
    selection_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_timestamp TIMESTAMP,
    optimization_mode VARCHAR(50) DEFAULT 'balanced'
);

-- Configuration settings
CREATE TABLE IF NOT EXISTS bundle_system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    data_type VARCHAR(50) DEFAULT 'string',
    category VARCHAR(100) DEFAULT 'general',
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by VARCHAR(255) DEFAULT 'system'
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tool_bundles_category ON tool_bundles(category);
CREATE INDEX IF NOT EXISTS idx_tool_bundles_active ON tool_bundles(is_active);
CREATE INDEX IF NOT EXISTS idx_tool_bundles_priority ON tool_bundles(priority DESC);
CREATE INDEX IF NOT EXISTS idx_bundle_usage_stats_date ON bundle_usage_stats(usage_date);
CREATE INDEX IF NOT EXISTS idx_bundle_usage_stats_bundle ON bundle_usage_stats(bundle_id);
CREATE INDEX IF NOT EXISTS idx_selection_history_session ON bundle_selection_history(session_id);
CREATE INDEX IF NOT EXISTS idx_selection_history_timestamp ON bundle_selection_history(selection_timestamp);
CREATE INDEX IF NOT EXISTS idx_configurable_descriptions_type ON configurable_descriptions(type);

-- Insert default configuration
INSERT INTO bundle_system_config (key, value, description, category) VALUES
('max_bundles_per_selection', '3', 'Maximum number of bundles to select in one operation', 'selection'),
('enable_auto_triggers', 'true', 'Enable automatic bundle triggering based on keywords', 'automation'),
('default_optimization_mode', 'balanced', 'Default optimization mode for bundle selection', 'selection'),
('bundle_cache_ttl', '300', 'Bundle selection cache TTL in seconds', 'performance'),
('enable_learning', 'true', 'Enable machine learning from selection history', 'ai'),
('min_success_rate_threshold', '0.70', 'Minimum success rate for bundle recommendations', 'quality')
ON CONFLICT (key) DO NOTHING;

-- Create trigger to update last_modified timestamp
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tool_bundles_last_modified
    BEFORE UPDATE ON tool_bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_configurable_descriptions_last_modified
    BEFORE UPDATE ON configurable_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_tool_definitions_last_modified
    BEFORE UPDATE ON tool_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_last_modified();