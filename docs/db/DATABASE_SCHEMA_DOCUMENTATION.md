# CodeMind Database Schema Documentation

## Overview

This document provides comprehensive documentation for the CodeMind database schema, including table purposes, relationships, and usage patterns across the application.

## Database Standards for Schema Documentation

**Best Practices:**
- **PostgreSQL INFORMATION_SCHEMA**: Use standard PostgreSQL system tables for metadata
- **JSON Schema Validation**: Store table schemas as JSON documents for programmatic access
- **OpenAPI/Swagger**: Document API endpoints that use each table
- **Entity-Relationship Diagrams**: Visual representations using tools like DbVisualizer or pgAdmin
- **Automated Documentation**: Tools like SchemaCrawler, pg_autodoc, or custom scripts

**Recommended Implementation:**
```sql
-- Store table documentation as system metadata
COMMENT ON TABLE projects IS 'Central registry for all analyzed projects';
COMMENT ON COLUMN projects.project_type IS 'Type classification: web_application, api_service, library, etc.';
```

## Core Tables (Currently Created: ✅ / Missing: ❌)

### Project Management Layer
| Table | Status | Purpose | Used In |
|-------|--------|---------|---------|
| `projects` | ✅ | Central registry for all analyzed projects | All dashboard APIs, main project tracking |
| `cache_entries` | ✅ | Multi-level cache for analysis results and data | Caching system, performance optimization |
| `claude_decisions` | ✅ | Track AI decision making and reasoning | Decision tracking, analytics |

### Analysis & Intelligence Layer (CRITICAL - ALL MISSING)
| Table | Status | Purpose | Used In |
|-------|--------|---------|---------|
| `analysis_results` | ❌ | **CRITICAL** - Store analysis results per file/project | services/postgresql-service.js, project-overview-api.js, multi-database-api.js |
| `semantic_search_embeddings` | ❌ | **CRITICAL** - Vector embeddings for semantic search | services/postgresql-service.js, project-api.js |
| `initialization_progress` | ❌ | Track multi-phase initialization progress | project-overview-api.js |
| `detected_patterns` | ❌ | Store detected architectural and design patterns | project-overview-api.js |
| `questionnaire_responses` | ❌ | User responses to setup questionnaires | project-overview-api.js |
| `resume_state` | ❌ | Resumable analyzer state for complex operations | State management |
| `system_config` | ❌ | System-wide and project-specific configuration | Configuration management |
| `operation_metrics` | ❌ | Track operation performance for optimization | Performance analytics |
| `project_paths` | ❌ | Track project path changes and aliases | Path management |

### Database Analysis Layer (ALL MISSING)
| Table | Status | Purpose | Used In |
|-------|--------|---------|---------|
| `database_analysis` | ❌ | Database analysis results for each project | Database intelligence |
| `database_schema_summary` | ❌ | Database schema summary for quick reference | Schema documentation |
| `query_performance_log` | ❌ | Query performance tracking | Performance monitoring |
| `database_relationships` | ❌ | Database relationship mapping | Relationship visualization |

### Orchestration & Workflow Layer (ALL MISSING)
| Table | Status | Purpose | Used In |
|-------|--------|---------|---------|
| `orchestration_processes` | ❌ | **CRITICAL** - Track active AI orchestration processes | server.js (health checks, dashboard views) |
| `ai_role_activities` | ❌ | Individual AI roles and their activities | server.js (role performance) |
| `process_logs` | ❌ | Process logs for debugging and monitoring | server.js (log queries) |
| `system_metrics` | ❌ | System metrics and performance indicators | Metrics collection |
| `accomplishments` | ❌ | Accomplishment summaries and achievements | Achievement tracking |
| `workflow_nodes` | ❌ | Workflow node states for visualization | server.js (workflow visualization) |

### Sequential Workflow Layer (ALL MISSING)
| Table | Status | Purpose | Used In |
|-------|--------|---------|---------|
| `sequential_workflows` | ❌ | **CRITICAL** - Master tracking for multi-role workflows | project-overview-api.js |
| `workflow_role_executions` | ❌ | Role executions within sequential workflows | project-overview-api.js |
| `workflow_message_log` | ❌ | Message queue status tracking for Redis | Message queuing |
| `role_performance_metrics` | ❌ | Performance metrics for role-based processing | Performance analytics |
| `redis_queue_status` | ❌ | Redis queue status monitoring | Queue monitoring |
| `codemind_cli_usage` | ❌ | CLI usage tracking | Usage analytics |

### External Tool Management (ALL MISSING)
| Table | Status | Purpose | Used In |
|-------|--------|---------|---------|
| `external_tools` | ❌ | Master catalog of all available tools | Tool management system |
| `tool_installations` | ❌ | **CRITICAL** - Track what's installed where | project-overview-api.js |
| `role_tool_permissions` | ❌ | Which roles can use/install which tools | Permission management |
| `tool_approval_history` | ❌ | User approval history for tool installations | Approval tracking |
| `tech_stack_detections` | ❌ | Cache for detected project technology stacks | Tech stack analysis |
| `tool_recommendations` | ❌ | AI-generated suggestions for tools | Recommendation engine |
| `tool_usage_analytics` | ❌ | Track how tools are being used | Usage analytics |

### Idea Planner Layer (ALL MISSING)
| Table | Status | Purpose | Used In |
|-------|--------|---------|---------|
| `idea_conversations` | ❌ | Store conversation history and ideas | Idea management |
| `roadmaps` | ❌ | Generated roadmaps from conversations | Project planning |
| `business_plans` | ❌ | Business plan generation and storage | Business planning |
| `tech_stacks` | ❌ | Technology stack recommendations | Tech planning |
| `system_architectures` | ❌ | System architecture designs | Architecture planning |
| `workflow_specifications` | ❌ | Generated workflow specifications | Workflow generation |
| `implementation_progress` | ❌ | Implementation progress tracking | Progress monitoring |
| `conversation_insights` | ❌ | AI insights for learning and improvement | Learning system |

## Critical Database Views (ALL MISSING)

### System Health Views
- `dashboard_active_processes` - **CRITICAL** - Used by server.js for process monitoring
- `dashboard_system_health` - **CRITICAL** - Used by server.js for health checks
- `dashboard_recent_accomplishments` - Used by server.js for accomplishment display
- `active_projects_status` - Project status overview
- `project_pattern_summary` - Pattern analysis summary

### Workflow Views  
- `active_sequential_workflows` - Sequential workflow monitoring
- `role_performance_summary` - Role performance analytics
- `workflow_completion_stats` - Workflow statistics

### Tool Management Views
- `role_available_tools` - Available tools per role
- `project_tool_status` - Project tool installation status
- `project_tool_recommendations` - Tool recommendation summary

## Analysis of Missing Tables Impact

### Immediate Failures (Preventing Basic Functionality)
1. **`analysis_results`** - PostgreSQLService.getAllProjects() fails with JOIN error
2. **`semantic_search_embeddings`** - All semantic search functionality broken
3. **`orchestration_processes`** - Dashboard health checks fail
4. **`tool_installations`** - Tool management completely non-functional

### API Endpoints Affected
- `/api/projects` - **BROKEN** (analysis_results JOIN)
- `/api/project/:id` - **BROKEN** (multiple missing tables)
- `/api/query` (pg-recent-analyses) - **BROKEN**
- `/api/query` (pg-project-stats) - **BROKEN** 
- `/api/semantic-search` - **BROKEN**
- All orchestrator dashboard views - **BROKEN**

### Database Services Affected
- **PostgreSQLService** - 90% non-functional
- **MongoDBService** - May work but reduced functionality
- **RedisService** - Basic functionality may work
- **Neo4jService** - Independent, should work

## Schema Loading Issue Analysis

The current schema file contains 43+ tables but only 3 were created:
- Vector extension dependency issue (pgvector required)
- Possible transaction rollback due to errors
- UUID extension not properly loaded
- Complex foreign key dependencies causing cascade failures

## Recommended Recovery Steps

1. **Drop and recreate database** with proper extension loading
2. **Load extensions first**: uuid-ossp, vector
3. **Load schema in sections** to identify failure points
4. **Verify each table creation** before proceeding
5. **Create indexes after tables** to avoid dependency issues
6. **Insert configuration data** last
7. **Verify all views and triggers** are created

## Future Enhancements

Consider implementing:
- **MongoDB**: Store flexible analysis results and JSON documents
- **PostgreSQL**: Keep relational data, structured queries, ACID transactions
- **Documentation Standards**: COMMENT ON TABLE/COLUMN statements
- **Schema Versioning**: Track schema migrations and versions
- **Automated Testing**: Verify schema integrity after changes