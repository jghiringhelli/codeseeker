-- CodeMind Three-Layer Complete Database Schema
-- Supports Layer 1 (Smart CLI), Layer 2 (Orchestrator), Layer 3 (Planner)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- SHARED FOUNDATION TABLES
-- ============================================================================

-- Core project information shared across all layers
CREATE TABLE IF NOT EXISTS projects (
    project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name VARCHAR(255) NOT NULL,
    project_path TEXT NOT NULL UNIQUE,
    project_type VARCHAR(100) DEFAULT 'unknown',
    languages TEXT[], -- Array of programming languages
    frameworks TEXT[], -- Array of frameworks
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active', -- active, analyzing, error, archived
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    layer_config JSONB DEFAULT '{}'::jsonb -- Configuration for each layer
);

-- Project settings and preferences for all layers
CREATE TABLE IF NOT EXISTS project_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB,
    layer VARCHAR(20) NOT NULL, -- 'cli', 'orchestrator', 'planner'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, setting_key, layer)
);

-- ============================================================================
-- LAYER 1: SMART CLI TABLES
-- ============================================================================

-- Tool registry and metadata
CREATE TABLE IF NOT EXISTS cli_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50), -- context, analysis, security, performance, etc.
    endpoint VARCHAR(255) NOT NULL,
    input_schema JSONB,
    output_schema JSONB,
    cost_tokens INTEGER DEFAULT 0, -- Estimated token cost
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_response_time_ms INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool usage tracking and performance metrics
CREATE TABLE IF NOT EXISTS cli_tool_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    tool_id UUID REFERENCES cli_tools(id),
    query_text TEXT,
    query_intent VARCHAR(50), -- overview, coding, architecture, debugging
    response_time_ms INTEGER,
    tokens_used INTEGER,
    success BOOLEAN,
    error_message TEXT,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project file structure and analysis
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    content_hash VARCHAR(64),
    last_modified TIMESTAMP WITH TIME ZONE,
    analysis_data JSONB DEFAULT '{}',
    indexed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, file_path)
);

-- Code insights and analysis results
CREATE TABLE IF NOT EXISTS code_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    file_id UUID REFERENCES project_files(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL, -- class, function, import, etc.
    name VARCHAR(255),
    location JSONB, -- line numbers, column positions
    properties JSONB DEFAULT '{}',
    relationships JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics and optimization suggestions
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(12,4),
    unit VARCHAR(20),
    threshold_low DECIMAL(12,4),
    threshold_high DECIMAL(12,4),
    status VARCHAR(20) DEFAULT 'ok', -- ok, warning, critical
    suggestions TEXT[],
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool effectiveness tracking for learning
CREATE TABLE IF NOT EXISTS tool_effectiveness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID REFERENCES cli_tools(id),
    project_type VARCHAR(100),
    languages TEXT[],
    query_pattern VARCHAR(255),
    success_rate DECIMAL(5,2),
    avg_response_time_ms INTEGER,
    user_satisfaction DECIMAL(3,2), -- 1-5 rating
    usage_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- LAYER 2: WORKFLOW ORCHESTRATOR TABLES
-- ============================================================================

-- Workflow definitions and templates
CREATE TABLE IF NOT EXISTS orchestration_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    workflow_type VARCHAR(50) DEFAULT 'sequential', -- sequential, parallel, custom
    definition JSONB NOT NULL, -- Full workflow definition
    roles_config JSONB NOT NULL, -- Configuration for each role
    dependency_graph JSONB DEFAULT '{}', -- Task dependencies
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual workflow executions
CREATE TABLE IF NOT EXISTS orchestration_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES orchestration_workflows(id),
    execution_context JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, paused
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_details JSONB,
    results JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role-based analysis results
CREATE TABLE IF NOT EXISTS orchestration_role_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES orchestration_executions(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL, -- architect, security, quality, performance, coordinator
    sequence_order INTEGER NOT NULL,
    input_context JSONB DEFAULT '{}',
    output_results JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Redis queue management and monitoring
CREATE TABLE IF NOT EXISTS orchestration_queue_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_name VARCHAR(100) NOT NULL,
    message_count INTEGER DEFAULT 0,
    processing_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(20) DEFAULT 'healthy', -- healthy, degraded, failed
    metrics JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coordination and synthesis results
CREATE TABLE IF NOT EXISTS orchestration_synthesis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES orchestration_executions(id) ON DELETE CASCADE,
    role_insights JSONB NOT NULL, -- Combined insights from all roles
    recommendations JSONB NOT NULL, -- Prioritized action items
    risk_assessment JSONB DEFAULT '{}',
    implementation_plan JSONB DEFAULT '{}',
    confidence_score DECIMAL(3,2), -- 0-1 confidence in recommendations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- LAYER 3: IDEA PLANNER TABLES
-- ============================================================================

-- Planning sessions and conversations
CREATE TABLE IF NOT EXISTS planning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    session_name VARCHAR(255) NOT NULL,
    idea_description TEXT,
    conversation_history JSONB DEFAULT '[]', -- Array of conversation messages
    status VARCHAR(50) DEFAULT 'active', -- active, completed, archived
    created_by VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated roadmaps from planning sessions
CREATE TABLE IF NOT EXISTS roadmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES planning_sessions(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    total_timeline_weeks INTEGER,
    confidence_level DECIMAL(3,2), -- 0-1 confidence in timeline
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roadmap milestones and phases
CREATE TABLE IF NOT EXISTS roadmap_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    phase_number INTEGER NOT NULL,
    estimated_weeks INTEGER,
    dependencies TEXT[], -- Array of milestone IDs or external dependencies
    deliverables TEXT[], -- Key outputs from this milestone
    risks TEXT[], -- Potential challenges
    success_criteria TEXT[], -- How to measure completion
    status VARCHAR(50) DEFAULT 'planned', -- planned, in_progress, completed, blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detailed tasks within milestones
CREATE TABLE IF NOT EXISTS roadmap_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_id UUID REFERENCES roadmap_milestones(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_hours INTEGER,
    priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    skills_required TEXT[],
    task_type VARCHAR(50), -- development, design, testing, documentation, etc.
    dependencies UUID[], -- Array of other task IDs
    assignee VARCHAR(100),
    status VARCHAR(50) DEFAULT 'todo', -- todo, in_progress, completed, blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business plans generated from ideas
CREATE TABLE IF NOT EXISTS business_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES planning_sessions(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    executive_summary TEXT,
    market_analysis JSONB DEFAULT '{}',
    competitive_analysis JSONB DEFAULT '{}',
    revenue_model JSONB DEFAULT '{}',
    financial_projections JSONB DEFAULT '{}',
    go_to_market_strategy JSONB DEFAULT '{}',
    team_requirements JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Technology stack recommendations
CREATE TABLE IF NOT EXISTS tech_stacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES planning_sessions(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    architecture_pattern VARCHAR(100),
    frontend_technologies JSONB DEFAULT '[]',
    backend_technologies JSONB DEFAULT '[]',
    database_technologies JSONB DEFAULT '[]',
    infrastructure_technologies JSONB DEFAULT '[]',
    development_tools JSONB DEFAULT '[]',
    justifications JSONB DEFAULT '{}', -- Reasons for each technology choice
    alternatives JSONB DEFAULT '{}', -- Alternative options considered
    trade_offs JSONB DEFAULT '{}', -- Pros and cons analysis
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System architecture designs
CREATE TABLE IF NOT EXISTS system_architectures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES planning_sessions(id) ON DELETE CASCADE,
    project_name VARCHAR(255) NOT NULL,
    architecture_type VARCHAR(100), -- monolithic, microservices, serverless, etc.
    components JSONB NOT NULL, -- System components and their responsibilities
    interfaces JSONB DEFAULT '{}', -- APIs and communication patterns
    data_flows JSONB DEFAULT '{}', -- How data moves through the system
    security_model JSONB DEFAULT '{}', -- Authentication, authorization, encryption
    deployment_model JSONB DEFAULT '{}', -- How the system is deployed and scaled
    monitoring_strategy JSONB DEFAULT '{}', -- Observability and alerting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow specifications for handoff to orchestrator
CREATE TABLE IF NOT EXISTS workflow_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES planning_sessions(id) ON DELETE CASCADE,
    roadmap_id UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
    project_name VARCHAR(255) NOT NULL,
    orchestration_steps JSONB NOT NULL, -- Steps to be executed by orchestrator
    role_assignments JSONB NOT NULL, -- Which roles handle which aspects
    implementation_phases JSONB DEFAULT '[]', -- Phased implementation approach
    success_criteria JSONB DEFAULT '{}', -- How to measure success
    estimated_timeline JSONB DEFAULT '{}', -- Time estimates for each phase
    resource_requirements JSONB DEFAULT '{}', -- Team size, skills needed
    generated_workflow_id UUID REFERENCES orchestration_workflows(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INTEGRATION AND LEARNING TABLES
-- ============================================================================

-- Cross-layer learning and optimization
CREATE TABLE IF NOT EXISTS layer_integration_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    source_layer VARCHAR(20) NOT NULL, -- cli, orchestrator, planner
    target_layer VARCHAR(20) NOT NULL,
    integration_type VARCHAR(50) NOT NULL, -- handoff, feedback, optimization
    success_rate DECIMAL(5,2),
    avg_processing_time_ms INTEGER,
    data_quality_score DECIMAL(3,2), -- 0-1 quality of data passed between layers
    user_satisfaction DECIMAL(3,2), -- 1-5 rating
    improvement_suggestions JSONB DEFAULT '[]',
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historical decisions and learning data
CREATE TABLE IF NOT EXISTS learning_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    layer VARCHAR(20) NOT NULL,
    decision_type VARCHAR(100) NOT NULL, -- tool_selection, workflow_choice, planning_approach
    context JSONB NOT NULL, -- Context that led to the decision
    decision JSONB NOT NULL, -- What was decided
    outcome JSONB DEFAULT '{}', -- Results of the decision
    feedback_score DECIMAL(3,2), -- 0-5 how well it worked
    lessons_learned TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Projects and core tables
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Layer 1 indexes
CREATE INDEX IF NOT EXISTS idx_cli_tool_usage_project ON cli_tool_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_cli_tool_usage_tool ON cli_tool_usage(tool_id);
CREATE INDEX IF NOT EXISTS idx_cli_tool_usage_intent ON cli_tool_usage(query_intent);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_type ON project_files(file_type);
CREATE INDEX IF NOT EXISTS idx_code_insights_project ON code_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_code_insights_type ON code_insights(insight_type);

-- Layer 2 indexes
CREATE INDEX IF NOT EXISTS idx_orchestration_workflows_project ON orchestration_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_workflows_status ON orchestration_workflows(status);
CREATE INDEX IF NOT EXISTS idx_orchestration_executions_workflow ON orchestration_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_executions_status ON orchestration_executions(status);
CREATE INDEX IF NOT EXISTS idx_orchestration_role_results_execution ON orchestration_role_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_role_results_role ON orchestration_role_results(role_name);

-- Layer 3 indexes
CREATE INDEX IF NOT EXISTS idx_planning_sessions_project ON planning_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_planning_sessions_status ON planning_sessions(status);
CREATE INDEX IF NOT EXISTS idx_roadmaps_session ON roadmaps(session_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_roadmap ON roadmap_milestones(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_milestone ON roadmap_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_session ON business_plans(session_id);

-- Integration indexes
CREATE INDEX IF NOT EXISTS idx_layer_integration_metrics_project ON layer_integration_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_layer_integration_metrics_layers ON layer_integration_metrics(source_layer, target_layer);
CREATE INDEX IF NOT EXISTS idx_learning_history_project ON learning_history(project_id);
CREATE INDEX IF NOT EXISTS idx_learning_history_layer ON learning_history(layer);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Project overview with all layer information
CREATE OR REPLACE VIEW project_overview AS
SELECT 
    p.*,
    (SELECT COUNT(*) FROM project_files WHERE project_id = p.project_id) as file_count,
    (SELECT COUNT(*) FROM cli_tool_usage WHERE project_id = p.project_id) as cli_usage_count,
    (SELECT COUNT(*) FROM orchestration_workflows WHERE project_id = p.project_id) as workflow_count,
    (SELECT COUNT(*) FROM planning_sessions WHERE project_id = p.project_id) as planning_session_count
FROM projects p;

-- Layer integration health dashboard
CREATE OR REPLACE VIEW integration_health AS
SELECT 
    p.project_name,
    p.project_id,
    COALESCE(AVG(lim.success_rate), 0) as avg_integration_success,
    COALESCE(AVG(lim.data_quality_score), 0) as avg_data_quality,
    COUNT(lim.id) as integration_events
FROM projects p
LEFT JOIN layer_integration_metrics lim ON p.project_id = lim.project_id
WHERE p.status = 'active'
GROUP BY p.project_id, p.project_name;

-- ============================================================================
-- TRIGGER FUNCTIONS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_settings_updated_at BEFORE UPDATE ON project_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cli_tools_updated_at BEFORE UPDATE ON cli_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_files_updated_at BEFORE UPDATE ON project_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orchestration_workflows_updated_at BEFORE UPDATE ON orchestration_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planning_sessions_updated_at BEFORE UPDATE ON planning_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmaps_updated_at BEFORE UPDATE ON roadmaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_plans_updated_at BEFORE UPDATE ON business_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tech_stacks_updated_at BEFORE UPDATE ON tech_stacks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_architectures_updated_at BEFORE UPDATE ON system_architectures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_specifications_updated_at BEFORE UPDATE ON workflow_specifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Insert default CLI tools
INSERT INTO cli_tools (name, description, category, endpoint, cost_tokens, active) VALUES
('context-optimizer', 'Optimizes project context for AI analysis', 'context', '/api/tools/context-optimizer', 50, true),
('issues-detector', 'Detects code quality issues and potential bugs', 'analysis', '/api/tools/issues-detector', 100, true),
('performance-analyzer', 'Analyzes code performance and bottlenecks', 'performance', '/api/tools/performance-analyzer', 75, true),
('security-scanner', 'Scans for security vulnerabilities', 'security', '/api/tools/security-scanner', 125, true),
('duplication-detector', 'Finds duplicated code patterns', 'analysis', '/api/tools/duplication-detector', 60, true),
('centralization-detector', 'Identifies centralization opportunities', 'architecture', '/api/tools/centralization-detector', 80, true),
('dependency-analyzer', 'Analyzes project dependencies', 'architecture', '/api/tools/dependency-analyzer', 70, true),
('test-coverage-analyzer', 'Analyzes test coverage and quality', 'testing', '/api/tools/test-coverage-analyzer', 90, true),
('documentation-analyzer', 'Evaluates documentation completeness', 'documentation', '/api/tools/documentation-analyzer', 55, true),
('git-integration-analyzer', 'Analyzes git history and patterns', 'version-control', '/api/tools/git-integration-analyzer', 65, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default orchestration roles configuration
INSERT INTO orchestration_workflows (name, description, workflow_type, definition, roles_config) VALUES
('standard-project-review', 'Comprehensive project review workflow', 'sequential', 
'{"steps": ["architect", "security", "quality", "performance", "coordinator"], "timeout_minutes": 60}',
'{"architect": {"focus": "system design and architecture", "tools": ["dependency-analyzer", "centralization-detector"]}, 
  "security": {"focus": "security vulnerabilities and compliance", "tools": ["security-scanner"]}, 
  "quality": {"focus": "code quality and testing", "tools": ["issues-detector", "test-coverage-analyzer"]}, 
  "performance": {"focus": "performance optimization", "tools": ["performance-analyzer"]}, 
  "coordinator": {"focus": "synthesis and recommendations", "tools": ["context-optimizer"]}}')
ON CONFLICT DO NOTHING;

-- Set up default queue status monitoring
INSERT INTO orchestration_queue_status (queue_name, health_status) VALUES
('architect:queue', 'healthy'),
('security:queue', 'healthy'),
('quality:queue', 'healthy'),
('performance:queue', 'healthy'),
('coordinator:queue', 'healthy')
ON CONFLICT DO NOTHING;

COMMIT;