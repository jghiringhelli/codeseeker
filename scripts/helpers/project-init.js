#!/usr/bin/env node

/**
 * Project Registration and Data Population Helper
 * Handles registering projects and populating with sample data
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');

// PostgreSQL configuration
const config = {
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'codemind',
    user: process.env.DB_USER || 'codemind',
    password: process.env.DB_PASSWORD || 'codemind123'
  }
};

async function initializeProjectData({ projectPath, projectName, resetProject = false, projectStats = {} }) {
  const pgClient = new Pool(config.postgres);
  
  try {
    // Check if project already exists
    const existingQuery = 'SELECT id FROM projects WHERE project_path = $1 LIMIT 1';
    const existingResult = await pgClient.query(existingQuery, [projectPath]);
    
    let projectId;
    
    if (existingResult.rows.length > 0 && !resetProject) {
      projectId = existingResult.rows[0].id;
      console.log(chalk.yellow(`📁 Using existing project: ${projectId}`));
    } else {
      if (existingResult.rows.length > 0 && resetProject) {
        projectId = existingResult.rows[0].id;
        console.log(chalk.blue('🔄 Resetting project data...'));
        
        // Clean up all tool data for this project
        await cleanupProjectData(pgClient, projectId);
      } else {
        // Create new project
        projectId = uuidv4();
        console.log(chalk.blue('📝 Creating new project...'));
        
        const insertQuery = `
          INSERT INTO projects (
            id, project_path, project_name, project_type, 
            languages, frameworks, project_size, total_files, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        await pgClient.query(insertQuery, [
          projectId,
          projectPath,
          projectName,
          'api_service',
          JSON.stringify(['TypeScript', 'JavaScript']),
          JSON.stringify(['Node.js', 'Express']),
          projectStats.projectSize || 'medium',
          projectStats.totalFiles || 0,
          'active'
        ]);
      }
      
      // Populate with comprehensive sample data
      await populateProjectData(pgClient, projectId, projectPath, projectName);
    }
    
    return { 
      success: true, 
      projectId,
      isNew: existingResult.rows.length === 0,
      wasReset: resetProject && existingResult.rows.length > 0
    };
    
  } finally {
    await pgClient.end();
  }
}

async function cleanupProjectData(pgClient, projectId) {
  const cleanupQueries = [
    'DELETE FROM tree_navigation_data WHERE project_id = $1',
    'DELETE FROM code_duplications WHERE project_id = $1',
    'DELETE FROM centralization_opportunities WHERE project_id = $1',
    'DELETE FROM test_coverage_data WHERE project_id = $1',
    'DELETE FROM compilation_results WHERE project_id = $1',
    'DELETE FROM compilation_issues WHERE project_id = $1',
    'DELETE FROM solid_violations WHERE project_id = $1',
    'DELETE FROM ui_components WHERE project_id = $1',
    'DELETE FROM ui_navigation_flows WHERE project_id = $1',
    'DELETE FROM code_embeddings_text WHERE project_id = $1',
    'DELETE FROM documentation_structure WHERE project_id = $1',
    'DELETE FROM use_cases WHERE project_id = $1',
    'DELETE FROM detected_patterns WHERE project_id = $1',
    'DELETE FROM analysis_results WHERE project_id = $1'
  ];
  
  for (const query of cleanupQueries) {
    try {
      await pgClient.query(query, [projectId]);
    } catch (error) {
      // Continue if table doesn't exist
      if (!error.message.includes('does not exist')) {
        console.warn(chalk.yellow(`Warning cleaning ${query}: ${error.message}`));
      }
    }
  }
}

async function populateProjectData(pgClient, projectId, projectPath, projectName) {
  console.log(chalk.blue('📊 Populating project with sample data...'));
  
  // Tree Navigation Data
  await pgClient.query(`
    INSERT INTO tree_navigation_data (project_id, file_path, node_type, node_name, parent_path, depth, children_count, complexity_score, metadata) VALUES
    ($1, '/src', 'directory', 'src', '/', 1, 10, 0, '{"type": "source_root"}'::jsonb),
    ($1, '/src/cli', 'directory', 'cli', '/src', 2, 5, 0, '{}'::jsonb),
    ($1, '/src/cli/codemind.ts', 'file', 'codemind.ts', '/src/cli', 3, 0, 85, '{"exports": ["CodeMindCLI"], "imports": 15}'::jsonb),
    ($1, '/src/features', 'directory', 'features', '/src', 2, 12, 0, '{}'::jsonb),
    ($1, '/src/dashboard', 'directory', 'dashboard', '/src', 2, 8, 0, '{}'::jsonb),
    ($1, '/src/orchestration', 'directory', 'orchestration', '/src', 2, 6, 0, '{}'::jsonb)
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // Code Duplications
  await pgClient.query(`
    INSERT INTO code_duplications (project_id, duplication_type, similarity_score, source_file, source_start_line, source_end_line, target_file, target_start_line, target_end_line, code_snippet, tokens_count, refactor_suggestion, priority, status) VALUES
    ($1, 'exact', 1.00, '/src/cli/codemind.ts', 45, 52, '/src/cli/enhanced.ts', 67, 74, 'const logger = Logger.getInstance();', 25, 'Extract to shared logger utility', 'medium', 'detected'),
    ($1, 'similar', 0.85, '/src/features/database.ts', 120, 145, '/src/features/analyzer.ts', 200, 225, 'Schema extraction logic', 150, 'Create shared schema extraction service', 'high', 'detected'),
    ($1, 'structural', 0.75, '/src/dashboard/server.js', 500, 550, '/src/orchestration/server.ts', 300, 350, 'Express route setup pattern', 200, 'Use route factory pattern', 'low', 'detected')
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // Centralization Opportunities
  await pgClient.query(`
    INSERT INTO centralization_opportunities (project_id, opportunity_type, pattern_name, occurrences, affected_files, centralization_benefit, suggested_location, suggested_approach, complexity_reduction, priority, status) VALUES
    ($1, 'scattered_logic', 'Database Connection', 5, '{"/src/dashboard/server.js", "/src/orchestration/server.ts", "/src/features/database.ts"}', 'Single connection pool management', '/src/shared/database-connection.ts', 'Create DatabaseConnectionManager singleton', 0.70, 'high', 'identified'),
    ($1, 'repeated_pattern', 'Error Handling', 8, '{"/src/cli/codemind.ts", "/src/dashboard/server.js"}', 'Consistent error handling', '/src/shared/error-handler.ts', 'Implement centralized error handler with custom error classes', 0.65, 'medium', 'identified'),
    ($1, 'cross_cutting_concern', 'Logging', 12, '{"/src/cli/*.ts", "/src/features/**/*.ts"}', 'Unified logging strategy', '/src/utils/logger.ts', 'Enhance existing Logger with log levels and transports', 0.80, 'high', 'identified')
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // Test Coverage Data
  await pgClient.query(`
    INSERT INTO test_coverage_data (project_id, file_path, coverage_type, total_items, covered_items, coverage_percentage, uncovered_lines, test_files, complexity_score, risk_level, last_test_run) VALUES
    ($1, '/src/cli/codemind.ts', 'line', 684, 342, 50.00, '{125,126,127,245,246,247}', '{"/tests/cli/codemind.test.ts"}', 85, 'high', NOW()),
    ($1, '/src/features/database.ts', 'line', 450, 315, 70.00, '{100,101,102,200,201,202}', '{"/tests/features/database.test.ts"}', 92, 'medium', NOW()),
    ($1, '/src/dashboard/server.js', 'line', 3200, 1600, 50.00, '{1500,1501,1502}', '{"/tests/dashboard/server.test.js"}', 78, 'high', NOW())
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // Compilation Results
  const buildId = `build-${Date.now()}`;
  await pgClient.query(`
    INSERT INTO compilation_results (project_id, build_id, build_status, compiler, total_files, successful_files, files_with_errors, files_with_warnings, build_time_ms, output_size_bytes, errors, warnings) VALUES
    ($1, $2, 'warning', 'tsc', 109, 105, 2, 4, 5432, 2485760, 
    '[{"file": "/src/cli/codemind.ts", "line": 45, "message": "Type error TS2322"}]'::jsonb,
    '[{"file": "/src/dashboard/server.js", "line": 100, "message": "Unused variable"}]'::jsonb)
    ON CONFLICT DO NOTHING
  `, [projectId, buildId]);
  
  await pgClient.query(`
    INSERT INTO compilation_issues (project_id, build_id, file_path, line_number, column_number, issue_type, severity, message, suggestion) VALUES
    ($1, $2, '/src/cli/codemind.ts', 45, 12, 'type', 'error', 'Type string is not assignable to type number', 'Check variable type declaration'),
    ($1, $2, '/src/dashboard/server.js', 100, 15, 'other', 'warning', 'Unused variable config', 'Remove unused variable')
    ON CONFLICT DO NOTHING
  `, [projectId, buildId]);
  
  // SOLID Violations
  await pgClient.query(`
    INSERT INTO solid_violations (project_id, file_path, class_name, principle, violation_type, description, line_number, severity, refactoring_suggestion, estimated_effort, status) VALUES
    ($1, '/src/dashboard/server.js', 'DashboardServer', 'SRP', 'Multiple Responsibilities', 'Class handles HTTP server, database operations, and business logic', 50, 'major', 'Split into DashboardServer, DatabaseService, and BusinessLogicService', 'large', 'detected'),
    ($1, '/src/cli/codemind.ts', 'CodeMindCLI', 'OCP', 'Direct Modification', 'Adding new tools requires modifying the class', 180, 'moderate', 'Use plugin architecture with tool registration', 'medium', 'detected')
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // UI Components
  await pgClient.query(`
    INSERT INTO ui_components (project_id, component_name, component_type, file_path, parent_component, children_components, props, state_management, routes, dependencies, complexity_score, accessibility_score, performance_score) VALUES
    ($1, 'DashboardLayout', 'layout', '/src/dashboard/index.html', NULL, '{ProjectView,Settings,Metrics}', '{"theme": "dark", "sidebarCollapsed": false}'::jsonb, '{"provider": "context"}'::jsonb, '{"/", "/projects", "/settings"}', '{Header,Sidebar,Footer}', 45, 0.85, 0.90),
    ($1, 'ProjectView', 'page', '/src/dashboard/project-view.html', 'DashboardLayout', '{TreeView,MetricsPanel,ToolsPanel}', '{"projectId": "string"}'::jsonb, '{"state": "local"}'::jsonb, '{"/projects/:id"}', '{TreeView,MetricsPanel}', 68, 0.75, 0.85),
    ($1, 'TreeView', 'widget', '/src/dashboard/components/tree-view.js', 'ProjectView', '{}', '{"data": "array", "onSelect": "function"}'::jsonb, '{}'::jsonb, '{}', '{}', 35, 0.90, 0.95)
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // Use Cases
  await pgClient.query(`
    INSERT INTO use_cases (project_id, use_case_name, category, description, actors, preconditions, postconditions, main_flow, alternate_flows, related_files, test_coverage, implementation_status, priority) VALUES
    ($1, 'Analyze Project Codebase', 'feature', 'User analyzes a project to understand its structure and quality', '{developer,architect}', '{"Project exists", "User has access"}', '{"Analysis complete", "Results displayed"}', '[{"step": 1, "action": "Select project"}, {"step": 2, "action": "Run analysis"}, {"step": 3, "action": "View results"}]'::jsonb, '[]'::jsonb, '{"/src/cli/codemind.ts", "/src/dashboard/project-view.html"}', true, 'implemented', 'high'),
    ($1, 'Configure Tool Settings', 'requirement', 'User configures tool behavior and preferences', '{developer}', '{"User logged in"}', '{"Settings saved"}', '[{"step": 1, "action": "Open settings"}, {"step": 2, "action": "Modify values"}, {"step": 3, "action": "Save"}]'::jsonb, '[{"condition": "Invalid settings", "action": "Show error"}]'::jsonb, '{"/src/dashboard/settings.js"}', false, 'in_progress', 'medium')
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // Detected Patterns
  await pgClient.query(`
    INSERT INTO detected_patterns (project_id, pattern_type, pattern_name, confidence_score, evidence, status) VALUES 
    ($1, 'architecture', 'Layered Architecture', 0.90, '{}'::jsonb, 'detected'),
    ($1, 'design_pattern', 'Singleton', 0.85, '{"files": ["/src/utils/logger.ts"]}'::jsonb, 'detected'),
    ($1, 'design_pattern', 'Factory', 0.75, '{"files": ["/src/cli/tool-factory.ts"]}'::jsonb, 'detected'),
    ($1, 'coding_standard', 'ESLint Compliance', 0.95, '{}'::jsonb, 'validated'),
    ($1, 'testing_pattern', 'Unit Testing', 0.70, '{"coverage": 50}'::jsonb, 'detected')
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  // Analysis Results
  await pgClient.query(`
    INSERT INTO analysis_results (project_id, file_path, file_hash, analysis_type, analysis_result, confidence_score) VALUES
    ($1, '/src/cli/codemind.ts', 'abc123def456', 'quality', '{"complexity": 85, "maintainability": 65, "readability": 70}'::jsonb, 0.88),
    ($1, '/src/dashboard/server.js', 'ghi789jkl012', 'architecture', '{"layer": "presentation", "dependencies": 20}'::jsonb, 0.92),
    ($1, '/src/features/database.ts', 'mno345pqr678', 'dependency', '{"imports": 8, "exports": 3, "circular": false}'::jsonb, 0.95)
    ON CONFLICT DO NOTHING
  `, [projectId]);
  
  console.log(chalk.green('✅ Project data populated successfully'));
}

module.exports = {
  initializeProjectData,
  cleanupProjectData,
  populateProjectData
};