-- Phase 4: Development Plan Management System
-- Database schema extension for development plans and progress tracking

-- ============================================
-- DEVELOPMENT PLANS CORE TABLES
-- ============================================

-- Plan types enumeration
DO $$ BEGIN
    CREATE TYPE plan_type_enum AS ENUM (
        'feature_development',
        'bug_fix_campaign', 
        'refactoring_project',
        'performance_optimization',
        'security_hardening',
        'documentation_sprint',
        'testing_initiative',
        'architecture_migration'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Plan priority enumeration  
DO $$ BEGIN
    CREATE TYPE plan_priority_enum AS ENUM (
        'critical',
        'high',
        'medium', 
        'low'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Plan status enumeration
DO $$ BEGIN
    CREATE TYPE plan_status_enum AS ENUM (
        'draft',
        'planned',
        'in_progress',
        'on_hold',
        'completed',
        'cancelled',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Task status enumeration
DO $$ BEGIN
    CREATE TYPE task_status_enum AS ENUM (
        'not_started',
        'in_progress', 
        'blocked',
        'under_review',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main development plans table
CREATE TABLE IF NOT EXISTS development_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Plan metadata
    plan_type plan_type_enum NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority plan_priority_enum DEFAULT 'medium',
    status plan_status_enum DEFAULT 'draft',
    
    -- Planning data
    estimated_effort_hours INTEGER,
    estimated_duration_days INTEGER,
    assigned_to TEXT, -- Team or individual
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Goals and criteria
    primary_goals JSONB DEFAULT '[]'::jsonb,
    success_criteria JSONB DEFAULT '[]'::jsonb,
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,
    
    -- Timeline
    planned_start_date TIMESTAMPTZ,
    planned_end_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_end_date TIMESTAMPTZ,
    
    -- Progress tracking
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    blocked_tasks INTEGER DEFAULT 0,
    
    -- Effort tracking
    estimated_hours_total INTEGER DEFAULT 0,
    actual_hours_spent INTEGER DEFAULT 0,
    
    -- Template and generation info
    template_id UUID,
    auto_generated BOOLEAN DEFAULT false,
    claude_enhanced BOOLEAN DEFAULT false,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);

-- Plan phases (for organizing tasks into logical groups)
CREATE TABLE IF NOT EXISTS plan_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
    
    -- Phase details
    phase_name TEXT NOT NULL,
    phase_description TEXT,
    phase_order INTEGER NOT NULL,
    
    -- Timeline
    planned_start_date TIMESTAMPTZ,
    planned_end_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_end_date TIMESTAMPTZ,
    
    -- Progress
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    status plan_status_enum DEFAULT 'planned',
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(plan_id, phase_order)
);

-- Individual tasks within phases
CREATE TABLE IF NOT EXISTS plan_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES plan_phases(id) ON DELETE SET NULL,
    
    -- Task details
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT DEFAULT 'development', -- development, testing, documentation, review
    priority plan_priority_enum DEFAULT 'medium',
    status task_status_enum DEFAULT 'not_started',
    
    -- Assignment
    assignee TEXT,
    reviewer TEXT,
    
    -- Effort estimation and tracking
    estimated_hours INTEGER DEFAULT 0,
    actual_hours INTEGER DEFAULT 0,
    
    -- Timeline
    planned_start_date TIMESTAMPTZ,
    planned_end_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_end_date TIMESTAMPTZ,
    
    -- Task ordering within phase
    task_order INTEGER,
    
    -- Dependencies (stored as array of task IDs)
    dependencies JSONB DEFAULT '[]'::jsonb,
    
    -- Progress details
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Files and code references
    related_files JSONB DEFAULT '[]'::jsonb,
    git_commits JSONB DEFAULT '[]'::jsonb,
    pull_requests JSONB DEFAULT '[]'::jsonb,
    
    -- Notes and updates
    notes TEXT,
    completion_notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(plan_id, phase_id, task_order)
);

-- Task dependencies (explicit many-to-many relationship)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dependent_task_id UUID NOT NULL REFERENCES plan_tasks(id) ON DELETE CASCADE,
    prerequisite_task_id UUID NOT NULL REFERENCES plan_tasks(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'blocks', -- blocks, soft_dependency, related
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(dependent_task_id, prerequisite_task_id),
    CHECK (dependent_task_id != prerequisite_task_id)
);

-- Task blockers and impediments
CREATE TABLE IF NOT EXISTS task_blockers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES plan_tasks(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
    
    -- Blocker details
    blocker_type TEXT NOT NULL, -- technical, resource, external, approval_pending
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium', -- low, medium, high, critical
    
    -- Status and resolution
    status TEXT DEFAULT 'active', -- active, resolved, bypassed
    resolution_notes TEXT,
    
    -- Timeline
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    -- Assignment
    reported_by TEXT,
    assigned_to TEXT,
    
    -- Impact
    impact_description TEXT,
    estimated_delay_hours INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan milestones
CREATE TABLE IF NOT EXISTS plan_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES plan_phases(id) ON DELETE SET NULL,
    
    -- Milestone details
    milestone_name TEXT NOT NULL,
    milestone_description TEXT,
    milestone_type TEXT DEFAULT 'delivery', -- delivery, checkpoint, approval_gate, release
    
    -- Timeline
    planned_date TIMESTAMPTZ,
    actual_date TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'planned', -- planned, achieved, missed, cancelled
    achievement_notes TEXT,
    
    -- Success criteria
    success_criteria JSONB DEFAULT '[]'::jsonb,
    deliverables JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    achieved_at TIMESTAMPTZ
);

-- Progress history and updates
CREATE TABLE IF NOT EXISTS plan_progress_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
    task_id UUID REFERENCES plan_tasks(id) ON DELETE SET NULL,
    
    -- Progress update details
    update_type TEXT NOT NULL, -- task_progress, plan_progress, milestone, blocker, general
    previous_status TEXT,
    new_status TEXT,
    
    -- Numeric progress
    previous_completion_percentage INTEGER,
    new_completion_percentage INTEGER,
    
    -- Hours tracking
    hours_added INTEGER DEFAULT 0,
    actual_hours_total INTEGER,
    
    -- Update content
    update_summary TEXT,
    detailed_notes TEXT,
    
    -- Context
    updated_by TEXT,
    update_source TEXT DEFAULT 'manual', -- manual, automated, claude, git_integration
    
    -- Related data
    related_commits JSONB DEFAULT '[]'::jsonb,
    related_files JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PLAN TEMPLATES SYSTEM
-- ============================================

-- Plan templates for common development patterns
CREATE TABLE IF NOT EXISTS plan_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template metadata
    template_name TEXT UNIQUE NOT NULL,
    template_description TEXT,
    plan_type plan_type_enum NOT NULL,
    category TEXT, -- backend, frontend, fullstack, devops, etc.
    
    -- Template structure
    phases_template JSONB NOT NULL, -- Array of phase definitions
    tasks_template JSONB NOT NULL, -- Array of task templates
    milestones_template JSONB DEFAULT '[]'::jsonb,
    
    -- Default settings
    default_priority plan_priority_enum DEFAULT 'medium',
    estimated_duration_days INTEGER,
    estimated_effort_hours INTEGER,
    
    -- Usage and validation
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2), -- Percentage of successful completions
    average_completion_time_days INTEGER,
    
    -- Template metadata
    tags JSONB DEFAULT '[]'::jsonb,
    applicable_project_types JSONB DEFAULT '[]'::jsonb,
    required_skills JSONB DEFAULT '[]'::jsonb,
    
    -- Versioning
    version TEXT DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    parent_template_id UUID REFERENCES plan_templates(id),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Template usage tracking
CREATE TABLE IF NOT EXISTS template_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES plan_templates(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Usage details
    customizations_made JSONB DEFAULT '[]'::jsonb,
    completion_rate DECIMAL(5,2),
    actual_vs_estimated_ratio DECIMAL(5,2),
    
    -- Feedback
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    feedback_notes TEXT,
    
    -- Timeline
    plan_created_at TIMESTAMPTZ,
    plan_completed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Development plans indexes
CREATE INDEX IF NOT EXISTS idx_development_plans_project_id ON development_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_development_plans_status ON development_plans(status);
CREATE INDEX IF NOT EXISTS idx_development_plans_plan_type ON development_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_development_plans_priority ON development_plans(priority);
CREATE INDEX IF NOT EXISTS idx_development_plans_dates ON development_plans(planned_start_date, planned_end_date);
CREATE INDEX IF NOT EXISTS idx_development_plans_assigned_to ON development_plans(assigned_to);
CREATE INDEX IF NOT EXISTS idx_development_plans_tags ON development_plans USING gin(tags);

-- Plan phases indexes
CREATE INDEX IF NOT EXISTS idx_plan_phases_plan_id ON plan_phases(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_phases_order ON plan_phases(plan_id, phase_order);
CREATE INDEX IF NOT EXISTS idx_plan_phases_status ON plan_phases(status);

-- Plan tasks indexes
CREATE INDEX IF NOT EXISTS idx_plan_tasks_plan_id ON plan_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_phase_id ON plan_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_status ON plan_tasks(status);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_assignee ON plan_tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_priority ON plan_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_dates ON plan_tasks(planned_start_date, planned_end_date);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_dependencies ON plan_tasks USING gin(dependencies);

-- Task blockers indexes
CREATE INDEX IF NOT EXISTS idx_task_blockers_task_id ON task_blockers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_blockers_plan_id ON task_blockers(plan_id);
CREATE INDEX IF NOT EXISTS idx_task_blockers_status ON task_blockers(status);
CREATE INDEX IF NOT EXISTS idx_task_blockers_severity ON task_blockers(severity);

-- Progress history indexes
CREATE INDEX IF NOT EXISTS idx_progress_history_plan_id ON plan_progress_history(plan_id);
CREATE INDEX IF NOT EXISTS idx_progress_history_task_id ON plan_progress_history(task_id);
CREATE INDEX IF NOT EXISTS idx_progress_history_created_at ON plan_progress_history(created_at);
CREATE INDEX IF NOT EXISTS idx_progress_history_update_type ON plan_progress_history(update_type);

-- Template indexes
CREATE INDEX IF NOT EXISTS idx_plan_templates_plan_type ON plan_templates(plan_type);
CREATE INDEX IF NOT EXISTS idx_plan_templates_category ON plan_templates(category);
CREATE INDEX IF NOT EXISTS idx_plan_templates_active ON plan_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_plan_templates_tags ON plan_templates USING gin(tags);

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Update development plans updated_at timestamp
CREATE TRIGGER update_development_plans_updated_at BEFORE UPDATE ON development_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update plan phases updated_at timestamp  
CREATE TRIGGER update_plan_phases_updated_at BEFORE UPDATE ON plan_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update plan tasks updated_at timestamp
CREATE TRIGGER update_plan_tasks_updated_at BEFORE UPDATE ON plan_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update task blockers updated_at timestamp
CREATE TRIGGER update_task_blockers_updated_at BEFORE UPDATE ON task_blockers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update plan templates updated_at timestamp
CREATE TRIGGER update_plan_templates_updated_at BEFORE UPDATE ON plan_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AUTOMATIC PROGRESS CALCULATION TRIGGERS
-- ============================================

-- Function to recalculate plan progress when tasks change
CREATE OR REPLACE FUNCTION update_plan_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update plan-level statistics
    UPDATE development_plans dp SET
        total_tasks = (
            SELECT COUNT(*) FROM plan_tasks pt WHERE pt.plan_id = dp.id
        ),
        completed_tasks = (
            SELECT COUNT(*) FROM plan_tasks pt 
            WHERE pt.plan_id = dp.id AND pt.status = 'completed'
        ),
        blocked_tasks = (
            SELECT COUNT(*) FROM plan_tasks pt 
            WHERE pt.plan_id = dp.id AND pt.status = 'blocked'
        ),
        actual_hours_spent = (
            SELECT COALESCE(SUM(pt.actual_hours), 0) FROM plan_tasks pt 
            WHERE pt.plan_id = dp.id
        ),
        estimated_hours_total = (
            SELECT COALESCE(SUM(pt.estimated_hours), 0) FROM plan_tasks pt 
            WHERE pt.plan_id = dp.id
        ),
        completion_percentage = CASE 
            WHEN (SELECT COUNT(*) FROM plan_tasks pt WHERE pt.plan_id = dp.id) = 0 THEN 0
            ELSE (
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE pt.status = 'completed')::DECIMAL / COUNT(*)) * 100
                )::INTEGER
                FROM plan_tasks pt WHERE pt.plan_id = dp.id
            )
        END,
        updated_at = NOW()
    WHERE dp.id = COALESCE(NEW.plan_id, OLD.plan_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update plan progress when tasks change
CREATE TRIGGER trigger_update_plan_progress
    AFTER INSERT OR UPDATE OR DELETE ON plan_tasks
    FOR EACH ROW EXECUTE FUNCTION update_plan_progress();

-- Function to update phase progress when tasks in phase change
CREATE OR REPLACE FUNCTION update_phase_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update phase-level statistics for affected phases
    UPDATE plan_phases pp SET
        completion_percentage = CASE 
            WHEN (SELECT COUNT(*) FROM plan_tasks pt WHERE pt.phase_id = pp.id) = 0 THEN 0
            ELSE (
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE pt.status = 'completed')::DECIMAL / COUNT(*)) * 100
                )::INTEGER
                FROM plan_tasks pt WHERE pt.phase_id = pp.id
            )
        END,
        updated_at = NOW()
    WHERE pp.id = COALESCE(NEW.phase_id, OLD.phase_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update phase progress when tasks change
CREATE TRIGGER trigger_update_phase_progress
    AFTER INSERT OR UPDATE OR DELETE ON plan_tasks
    FOR EACH ROW EXECUTE FUNCTION update_phase_progress();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Comprehensive plan overview
CREATE OR REPLACE VIEW plan_overview AS
SELECT 
    dp.id as plan_id,
    dp.title,
    dp.plan_type,
    dp.status,
    dp.priority,
    dp.completion_percentage,
    dp.total_tasks,
    dp.completed_tasks,
    dp.blocked_tasks,
    dp.actual_hours_spent,
    dp.estimated_hours_total,
    dp.planned_start_date,
    dp.planned_end_date,
    dp.assigned_to,
    p.project_path,
    p.project_name,
    -- Progress metrics
    CASE 
        WHEN dp.estimated_hours_total > 0 
        THEN ROUND((dp.actual_hours_spent::DECIMAL / dp.estimated_hours_total) * 100, 2)
        ELSE 0 
    END as hours_completion_percentage,
    -- Timeline status
    CASE 
        WHEN dp.planned_end_date < NOW() AND dp.status != 'completed' THEN 'overdue'
        WHEN dp.planned_end_date < NOW() + INTERVAL '7 days' AND dp.status != 'completed' THEN 'due_soon'
        ELSE 'on_track'
    END as timeline_status,
    -- Active blockers count
    (SELECT COUNT(*) FROM task_blockers tb WHERE tb.plan_id = dp.id AND tb.status = 'active') as active_blockers_count
FROM development_plans dp
JOIN projects p ON dp.project_id = p.id
WHERE dp.status != 'archived';

-- Task summary with dependencies
CREATE OR REPLACE VIEW task_summary AS
SELECT 
    pt.id as task_id,
    pt.plan_id,
    dp.title as plan_title,
    pt.title as task_title,
    pt.status,
    pt.priority,
    pt.assignee,
    pt.estimated_hours,
    pt.actual_hours,
    pt.completion_percentage,
    pt.planned_start_date,
    pt.planned_end_date,
    pp.phase_name,
    -- Dependencies info
    (SELECT COUNT(*) FROM task_dependencies td WHERE td.dependent_task_id = pt.id) as dependency_count,
    (SELECT COUNT(*) FROM task_dependencies td WHERE td.prerequisite_task_id = pt.id) as dependent_tasks_count,
    -- Blockers
    (SELECT COUNT(*) FROM task_blockers tb WHERE tb.task_id = pt.id AND tb.status = 'active') as active_blockers_count,
    -- Timeline status
    CASE 
        WHEN pt.planned_end_date < NOW() AND pt.status NOT IN ('completed', 'cancelled') THEN 'overdue'
        WHEN pt.planned_end_date < NOW() + INTERVAL '3 days' AND pt.status NOT IN ('completed', 'cancelled') THEN 'due_soon'
        ELSE 'on_track'
    END as timeline_status
FROM plan_tasks pt
JOIN development_plans dp ON pt.plan_id = dp.id
LEFT JOIN plan_phases pp ON pt.phase_id = pp.id
WHERE dp.status != 'archived';

-- Blocker impact analysis
CREATE OR REPLACE VIEW blocker_analysis AS
SELECT 
    tb.id as blocker_id,
    tb.title as blocker_title,
    tb.blocker_type,
    tb.severity,
    tb.status,
    tb.reported_at,
    dp.title as plan_title,
    pt.title as task_title,
    pt.assignee,
    tb.estimated_delay_hours,
    -- Impact calculation
    CASE 
        WHEN tb.severity = 'critical' THEN 4
        WHEN tb.severity = 'high' THEN 3
        WHEN tb.severity = 'medium' THEN 2
        ELSE 1
    END * COALESCE(tb.estimated_delay_hours, 8) as impact_score,
    -- Age of blocker
    EXTRACT(DAYS FROM NOW() - tb.reported_at) as days_blocked
FROM task_blockers tb
JOIN development_plans dp ON tb.plan_id = dp.id
JOIN plan_tasks pt ON tb.task_id = pt.id
WHERE tb.status = 'active'
ORDER BY impact_score DESC, days_blocked DESC;