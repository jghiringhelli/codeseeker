# CodeMind Database Schema Documentation

This document describes the complete PostgreSQL database schema for the CodeMind system, including table relationships, expected data flows, and validation rules.

## Schema Overview

The CodeMind database supports multi-project analysis with comprehensive tracking of initialization progress, pattern detection, and analysis results. All tables use UUID primary keys and include audit timestamps.

## Core Tables

### 1. `projects` - Main Project Registry
**Purpose**: Central registry of all projects being analyzed

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_path TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT CHECK (project_type IN (
    'web_application', 'api_service', 'library', 
    'mobile_app', 'desktop_app', 'cli_tool', 'unknown'
  )),
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  frameworks JSONB DEFAULT '[]'::jsonb,
  total_files INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  project_size TEXT DEFAULT 'small' CHECK (project_size IN ('small', 'medium', 'large', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'analyzing', 'completed', 'error', 'archived')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Expected API Impact**: 
- `/init` creates new projects or updates existing ones
- All endpoints reference projects by project_path
- Metadata stores additional context from setup scripts

**Test Validation**:
- Verify unique constraint on project_path
- Check enum validation on project_type and status
- Validate JSONB structure for languages/frameworks
- Confirm updated_at trigger updates automatically

### 2. `project_paths` - Path Aliasing System
**Purpose**: Support multiple path references to the same project

```sql
CREATE TABLE project_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  alias_type TEXT DEFAULT 'manual' CHECK (alias_type IN ('primary', 'manual', 'auto_detected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  UNIQUE(project_id, path)
);
```

**Expected API Impact**:
- API calls can use any active path to reference a project
- Path resolution happens transparently
- Supports workspace reorganization without losing data

**Test Validation**:
- Multiple paths can reference same project_id
- Only one primary path per project
- Deactivated paths don't resolve in API calls

### 3. `initialization_progress` - Resumable Processing
**Purpose**: Track multi-phase project initialization and analysis

```sql
CREATE TABLE initialization_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN (
    'project_discovery', 'pattern_analysis', 'standards_inference',
    'smart_questioning', 'deep_analysis', 'configuration_generation',
    'claude_md_update', 'completed'
  )),
  resume_token TEXT UNIQUE NOT NULL,
  progress_data JSONB NOT NULL,
  tech_stack_data JSONB,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Progress Data Structure**:
```json
{
  "totalFiles": 150,
  "processedFiles": 75,
  "skippedFiles": 5,
  "errorFiles": 2,
  "batchSize": 25,
  "processingStartTime": "2024-08-24T10:00:00Z",
  "estimatedTimeRemaining": 300
}
```

**Tech Stack Data Structure**:
```json
{
  "languages": {"typescript": "5.0.0", "javascript": "ES2022"},
  "frameworks": {"express": "4.18.0", "react": "18.2.0"},
  "tools": {"webpack": "5.88.0", "eslint": "8.45.0"},
  "packageManagers": ["npm", "yarn"],
  "buildTools": ["tsc", "webpack"]
}
```

**Expected API Impact**:
- `/init` creates or updates progress records
- Context endpoints read tech_stack_data for enhanced responses
- Resume capability for large project analysis

**Test Validation**:
- Unique constraint on project_id (one progress per project)
- Unique constraint on resume_token
- JSONB structure validation
- Phase enum validation
- ON CONFLICT behavior in upserts

### 4. `detected_patterns` - Architectural Analysis
**Purpose**: Store detected code patterns, architectures, and inconsistencies

```sql
CREATE TABLE detected_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (
    pattern_type IN ('architecture', 'design_pattern', 'coding_standard', 'testing_pattern')
  ),
  pattern_name TEXT NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  evidence JSONB NOT NULL,
  source_files JSONB DEFAULT '[]'::jsonb,
  relationships JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'validated', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Evidence Structure**:
```json
{
  "type": "code_pattern",
  "location": {"file": "src/api/server.ts", "startLine": 42, "endLine": 56},
  "description": "Express.js route handler pattern detected",
  "examples": ["handleInit", "handleAnalyze", "handleContext"],
  "confidence": 0.95
}
```

**Expected API Impact**:
- Context endpoints include relevant patterns based on intent
- Pattern detection happens during deep analysis phase
- Influences smart question generation

**Test Validation**:
- Confidence score between 0.0 and 1.0
- JSONB structure for evidence and relationships
- Foreign key constraint to projects
- Pattern type enum validation

### 5. `questionnaire_responses` - User Feedback
**Purpose**: Store user responses to smart questions

```sql
CREATE TABLE questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('architecture', 'standards', 'patterns', 'purpose', 'quality')
  ),
  question_id TEXT NOT NULL,
  question_text TEXT,
  response TEXT NOT NULL,
  response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'choice', 'boolean', 'number')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Expected API Impact**:
- Future endpoint for storing user responses
- Influences context generation and recommendations
- Used for improving smart question algorithms

**Test Validation**:
- Category enum validation
- Response type enum validation
- Non-empty response field
- JSONB metadata structure

### 6. `analysis_results` - File-Level Analysis
**Purpose**: Store detailed analysis results for individual files

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  analysis_type TEXT NOT NULL CHECK (
    analysis_type IN ('pattern', 'quality', 'architecture', 'tech_stack', 'duplication', 'dependency')
  ),
  analysis_result JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Expected API Impact**:
- Deep analysis phase populates this table
- Context endpoints can include file-specific insights
- Duplication detection and quality metrics

**Test Validation**:
- Analysis type enum validation
- File hash format validation
- JSONB analysis_result structure
- Version incrementing on updates

## Indexes for Performance

```sql
-- Core lookup indexes
CREATE INDEX idx_projects_path ON projects(project_path);
CREATE INDEX idx_projects_type ON projects(project_type);
CREATE INDEX idx_projects_status ON projects(status);

-- Path resolution indexes
CREATE INDEX idx_project_paths_path ON project_paths(path);
CREATE INDEX idx_project_paths_active ON project_paths(is_active);

-- Initialization tracking
CREATE INDEX idx_init_project_id ON initialization_progress(project_id);
CREATE INDEX idx_init_phase ON initialization_progress(phase);
CREATE INDEX idx_init_resume_token ON initialization_progress(resume_token);

-- Pattern analysis
CREATE INDEX idx_patterns_project_id ON detected_patterns(project_id);
CREATE INDEX idx_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX idx_patterns_confidence ON detected_patterns(confidence_score);
CREATE INDEX idx_patterns_name ON detected_patterns(pattern_name);
CREATE INDEX idx_patterns_status ON detected_patterns(status);
```

## Data Flow Expectations

### API Call → Database Changes

1. **POST /init**:
   ```
   Input: {projectPath, mode, batchSize, metadata}
   Changes: 
   - INSERT/UPDATE projects table
   - INSERT/UPDATE initialization_progress table
   - INSERT project_paths if new paths detected
   ```

2. **GET /claude/context/:path**:
   ```
   Input: {projectPath, intent, maxTokens}
   Reads:
   - projects (basic info)
   - initialization_progress (current status)  
   - detected_patterns (relevant patterns)
   - analysis_results (if available)
   ```

3. **POST /claude/analyze-with-context**:
   ```
   Input: {projectPath, analysisType, context}
   Changes:
   - INSERT analysis_results (new analysis)
   - UPDATE projects (file counts, status)
   ```

## Triggers and Automation

```sql
-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_initialization_updated_at BEFORE UPDATE ON initialization_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Views for Common Queries

```sql
-- Project status dashboard
CREATE VIEW project_status_summary AS
SELECT 
    p.id,
    p.project_path,
    p.project_name,
    p.project_type,
    p.total_files,
    ip.phase as current_phase,
    ip.updated_at as last_activity,
    COUNT(DISTINCT dp.id) as detected_patterns_count,
    COUNT(DISTINCT qr.category) as completed_questionnaire_categories
FROM projects p
LEFT JOIN initialization_progress ip ON p.id = ip.project_id
LEFT JOIN detected_patterns dp ON p.id = dp.project_id AND dp.status = 'detected'
LEFT JOIN questionnaire_responses qr ON p.id = qr.project_id
WHERE p.status = 'active'
GROUP BY p.id, p.project_path, p.project_name, p.project_type, p.total_files, ip.phase, ip.updated_at;
```

## Test Validation Checklist

For each API endpoint, verify:

✅ **Data Integrity**:
- [ ] Foreign key constraints enforced
- [ ] Enum values validated
- [ ] UNIQUE constraints respected
- [ ] Check constraints enforced
- [ ] JSONB structure valid

✅ **Expected Behavior**:
- [ ] Upsert operations work correctly
- [ ] Cascade deletes work properly
- [ ] Triggers update timestamps
- [ ] Indexes improve query performance

✅ **API Contract**:
- [ ] API creates expected rows
- [ ] API reads correct data
- [ ] API updates appropriate fields
- [ ] Error cases handled gracefully

This schema documentation provides the foundation for comprehensive API testing and validation.