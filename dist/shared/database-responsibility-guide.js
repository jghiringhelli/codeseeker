"use strict";
/**
 * Database Responsibility Guide
 *
 * This file clearly defines the responsibilities of each database in CodeMind
 * to ensure complete database disjointness and eliminate overlapping concerns.
 *
 * Updated: 2025-09-24
 * Purpose: Maintain database separation of concerns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIGRATION_STATUS = exports.ENFORCEMENT_MECHANISMS = exports.VIOLATION_PATTERNS = exports.ANALYTICS_OWNERSHIP = exports.CACHING_OWNERSHIP = exports.WORKFLOW_STATE_OWNERSHIP = exports.NEO4J_RESPONSIBILITIES = exports.REDIS_RESPONSIBILITIES = exports.POSTGRESQL_RESPONSIBILITIES = void 0;
// ============================================================================
// DATABASE RESPONSIBILITY MATRIX
// ============================================================================
/**
 * POSTGRESQL - PERSISTENT APPLICATION DATA
 *
 * Responsibility: Primary persistent application data and long-term storage
 * Use Cases:
 * - Project configurations and metadata
 * - User settings and preferences
 * - Tool configurations and definitions
 * - Analysis results and historical data
 * - Performance metrics and analytics (centralized from DuckDB)
 * - File metadata and change tracking
 * - Workflow execution history and audit logs
 * - Persistent workflow state for recovery (checkpoints, completed workflows)
 * - Session management (persistent sessions)
 * - Database schemas and migrations
 */
exports.POSTGRESQL_RESPONSIBILITIES = {
    projects: 'Project metadata, configurations, paths',
    tool_configs: 'Tool definitions, settings, capabilities',
    analysis_results: 'Historical analysis data, reports',
    performance_metrics: 'Centralized analytics and performance data',
    file_metadata: 'File hashes, sizes, modification times',
    workflow_execution_log: 'Completed workflow runs, execution history',
    workflow_checkpoints: 'Persistent recovery points for long-running workflows',
    session_management: 'Long-term session storage and user authentication',
    system_configuration: 'Application-wide settings and configuration'
};
/**
 * REDIS - REAL-TIME STATE AND MESSAGING
 *
 * Responsibility: Ephemeral state, real-time communication, and caching
 * Use Cases:
 * - Active workflow state (currently running workflows)
 * - Real-time messaging between components
 * - Temporary session state (active sessions)
 * - Live system monitoring and health checks
 * - Event queues and job processing
 * - Distributed locks and coordination
 * - All caching operations (consolidated from PostgreSQL)
 * - Temporary computation results
 */
exports.REDIS_RESPONSIBILITIES = {
    active_workflows: 'Currently executing workflow state, progress, live status',
    messaging_queues: 'Inter-service communication, event propagation',
    active_sessions: 'Real-time session state, temporary user data',
    system_health: 'Live monitoring, component status, heartbeats',
    distributed_locks: 'Coordination locks, mutual exclusion',
    cache_all: 'All caching operations: embeddings, search results, computations',
    temp_results: 'Short-lived computation results and intermediate data'
};
/**
 * NEO4J - SEMANTIC RELATIONSHIPS AND GRAPHS
 *
 * Responsibility: Code relationships, knowledge graphs, and semantic connections
 * Use Cases:
 * - Code dependency graphs
 * - Semantic relationships between files/functions
 * - Knowledge graphs for code understanding
 * - Cross-reference mappings
 * - Architectural relationship modeling
 * - Code similarity and clustering
 */
exports.NEO4J_RESPONSIBILITIES = {
    code_dependencies: 'File-to-file, function-to-function dependencies',
    semantic_relationships: 'Semantic connections and similarity graphs',
    knowledge_graphs: 'Code understanding and relationship modeling',
    architectural_maps: 'High-level system architecture relationships',
    cross_references: 'Symbol usage, import/export relationships'
};
// ============================================================================
// OWNERSHIP BOUNDARIES AND RULES
// ============================================================================
/**
 * WORKFLOW STATE OWNERSHIP CLARIFICATION
 *
 * CLEAR SEPARATION:
 * - Redis: Active, live workflow state (status=running/paused/executing)
 * - PostgreSQL: Historical workflow data (status=completed/failed/cancelled)
 *
 * MIGRATION POINTS:
 * - When workflow completes -> Move from Redis to PostgreSQL
 * - When workflow fails -> Log to PostgreSQL, clear from Redis
 * - When workflow is cancelled -> Log to PostgreSQL, clear from Redis
 *
 * NO OVERLAP:
 * - Never store the same workflow instance in both databases
 * - Use workflowId to ensure single source of truth
 * - Active workflows exist ONLY in Redis
 * - Historical workflows exist ONLY in PostgreSQL
 */
exports.WORKFLOW_STATE_OWNERSHIP = {
    redis_active: 'status IN (running, paused, executing, queued)',
    postgresql_historical: 'status IN (completed, failed, cancelled, archived)',
    migration_trigger: 'status change from active to terminal state',
    no_duplication: 'Same workflowId cannot exist in both systems simultaneously'
};
/**
 * CACHING OWNERSHIP CLARIFICATION
 *
 * COMPLETE CONSOLIDATION TO REDIS:
 * - All L1 cache (memory) operations via Redis
 * - All L2 cache (file) with Redis backup
 * - All L3 cache (database) moved to Redis
 * - NO caching operations in PostgreSQL
 *
 * MIGRATION COMPLETE:
 * - Removed PostgreSQL cache tables
 * - Updated MultiLevelCache to use Redis adapter
 * - All semantic search caching via Redis
 */
exports.CACHING_OWNERSHIP = {
    redis_all_cache: 'All caching operations consolidated to Redis',
    no_postgresql_cache: 'Zero caching responsibility in PostgreSQL',
    unified_cache_layer: 'Single Redis-based caching system'
};
/**
 * ANALYTICS OWNERSHIP CLARIFICATION
 *
 * COMPLETE CONSOLIDATION TO POSTGRESQL:
 * - All performance metrics in PostgreSQL
 * - All code quality analytics in PostgreSQL
 * - All file change analytics in PostgreSQL
 * - NO DuckDB analytics operations
 *
 * MIGRATION COMPLETE:
 * - Replaced DuckDB with PostgreSQL analytics
 * - Updated all analytics consumers
 * - Centralized analytics reporting
 */
exports.ANALYTICS_OWNERSHIP = {
    postgresql_all_analytics: 'All analytics consolidated to PostgreSQL',
    no_duckdb_analytics: 'Zero analytics responsibility in DuckDB',
    unified_analytics_layer: 'Single PostgreSQL-based analytics system'
};
// ============================================================================
// VIOLATION DETECTION
// ============================================================================
/**
 * Patterns that indicate database responsibility violations:
 *
 * 1. Same data type in multiple databases
 * 2. Duplicate foreign keys across databases
 * 3. Cross-database transactions or joins
 * 4. Inconsistent data models for same entity
 * 5. Manual data synchronization between databases
 */
exports.VIOLATION_PATTERNS = {
    duplicate_entities: 'Same entity/concept stored in multiple databases',
    cross_database_joins: 'Queries that require data from multiple databases',
    manual_sync: 'Code that manually keeps databases in sync',
    inconsistent_schemas: 'Different schemas for same conceptual data',
    shared_foreign_keys: 'Foreign key references across database boundaries'
};
// ============================================================================
// ENFORCEMENT MECHANISMS
// ============================================================================
/**
 * Mechanisms to maintain database separation:
 *
 * 1. Clear interface boundaries - each database has dedicated service layer
 * 2. No direct cross-database queries or transactions
 * 3. Event-driven communication between database domains
 * 4. Regular audits of database responsibilities
 * 5. Documentation updates with any architectural changes
 */
exports.ENFORCEMENT_MECHANISMS = {
    service_layer_isolation: 'Each database accessed only through its service layer',
    event_driven_communication: 'Databases communicate via events, not direct calls',
    regular_audits: 'Periodic review of database responsibilities and usage',
    documentation_updates: 'This file updated with any architectural changes',
    interface_boundaries: 'Clear API boundaries prevent accidental cross-database access'
};
// ============================================================================
// MIGRATION STATUS
// ============================================================================
/**
 * Current migration status (as of 2025-09-24):
 */
exports.MIGRATION_STATUS = {
    caching_consolidation: 'COMPLETED - All caching moved to Redis',
    analytics_consolidation: 'COMPLETED - All analytics moved to PostgreSQL',
    workflow_state_clarification: 'COMPLETED - Clear boundaries established with documentation',
    file_state_consolidation: 'COMPLETED - PostgreSQL as single source of truth via FileSynchronizationSystem',
    mongodb_cleanup: 'COMPLETED - MongoDB references removed, episodic memory moved to PostgreSQL'
};
//# sourceMappingURL=database-responsibility-guide.js.map