#!/usr/bin/env node

/**
 * Analysis Runner Helper
 * Handles comprehensive project analysis including semantic graph and tool autodiscovery
 */

const chalk = require('chalk');

async function runComprehensiveAnalysis({ projectPath, projectId, projectName }) {
  const results = {
    semanticGraph: null,
    toolAutodiscovery: null,
    totalRecordsCreated: 0,
    toolsInitialized: 0,
    errors: []
  };
  
  console.log(chalk.blue('🧠 Running comprehensive analysis...'));
  
  // Try to load analysis services
  let SemanticGraphService, ToolAutodiscoveryService, EnhancedDocumentMapAnalyzer;
  
  try {
    ({ SemanticGraphService } = require('../../dist/services/semantic-graph'));
    ({ ToolAutodiscoveryService } = require('../../dist/shared/tool-autodiscovery'));
    ({ EnhancedDocumentMapAnalyzer } = require('../../dist/features/documentation/enhanced-map-analyzer'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Advanced analysis services not available. Build first with: npm run build'));
    console.log(chalk.yellow('    Continuing with basic analysis...'));
  }
  
  // Run semantic graph analysis
  if (SemanticGraphService && EnhancedDocumentMapAnalyzer) {
    try {
      console.log(chalk.blue('📊 Running semantic graph analysis...'));
      
      const semanticGraph = new SemanticGraphService();
      await semanticGraph.initialize();
      
      const analyzer = new EnhancedDocumentMapAnalyzer();
      const analysisParams = {
        projectPath: projectPath,
        includeCodeAnalysis: true,
        maxDepth: 3,
        fileTypes: ['.ts', '.js', '.md', '.json']
      };
      
      const analysisResult = await analyzer.analyzeDocumentationWithSemantics(analysisParams);
      const stats = await semanticGraph.getGraphStatistics();
      
      results.semanticGraph = {
        analysisResult,
        stats,
        nodes: stats.total_nodes || 0,
        relationships: stats.total_relationships || 0
      };
      
      results.semanticGraphNodes = stats.total_nodes;
      results.semanticGraphRelationships = stats.total_relationships;
      
      console.log(chalk.green(`✅ Semantic analysis complete: ${stats.total_nodes} nodes, ${stats.total_relationships} relationships`));
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Semantic analysis failed: ${error.message}`));
      results.errors.push({ type: 'semantic', error: error.message });
    }
  }
  
  // Run tool autodiscovery
  if (ToolAutodiscoveryService) {
    try {
      console.log(chalk.blue('🔧 Running tool autodiscovery and analysis...'));
      
      const toolService = new ToolAutodiscoveryService();
      await toolService.initializeTools();
      
      // Initialize all tools for the project
      const initResult = await toolService.initializeProjectForAllTools(projectPath, projectId);
      
      // Run comprehensive analysis with all tools
      const analysisResult = await toolService.analyzeProjectWithAllTools(projectPath, projectId);
      
      // Get tool status summary
      const toolStatuses = await toolService.getToolsStatus(projectId);
      
      results.toolAutodiscovery = {
        initResult,
        analysisResult,
        toolStatuses
      };
      
      results.toolsInitialized = initResult.results?.size || 0;
      results.totalRecordsCreated += initResult.totalRecordsInserted || 0;
      
      console.log(chalk.green(`✅ Tool analysis complete: ${results.toolsInitialized} tools initialized, ${initResult.totalRecordsInserted || 0} records created`));
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Tool autodiscovery failed: ${error.message}`));
      results.errors.push({ type: 'tools', error: error.message });
    }
  }
  
  // Run basic file system analysis if advanced services not available
  if (!SemanticGraphService && !ToolAutodiscoveryService) {
    try {
      console.log(chalk.blue('📁 Running basic file system analysis...'));
      const basicResults = await runBasicAnalysis(projectPath, projectId);
      results.basicAnalysis = basicResults;
      results.totalRecordsCreated += basicResults.recordsCreated || 0;
      console.log(chalk.green(`✅ Basic analysis complete: ${basicResults.recordsCreated} records created`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Basic analysis failed: ${error.message}`));
      results.errors.push({ type: 'basic', error: error.message });
    }
  }
  
  return results;
}

async function runBasicAnalysis(projectPath, projectId) {
  const fs = require('fs').promises;
  const path = require('path');
  const { Pool } = require('pg');
  
  const pgClient = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'codemind',
    user: process.env.DB_USER || 'codemind',
    password: process.env.DB_PASSWORD || 'codemind123'
  });
  
  let recordsCreated = 0;
  
  try {
    // Scan project directory structure
    const files = [];
    
    async function scanDirectory(dir, depth = 0) {
      if (depth > 4) return; // Limit depth
      
      try {
        const items = await fs.readdir(dir);
        for (const item of items) {
          if (item.startsWith('.') || item === 'node_modules' || item === 'dist') continue;
          
          const itemPath = path.join(dir, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory()) {
            files.push({
              path: path.relative(projectPath, itemPath).replace(/\\/g, '/'),
              type: 'directory',
              size: 0,
              depth: depth + 1
            });
            await scanDirectory(itemPath, depth + 1);
          } else {
            files.push({
              path: path.relative(projectPath, itemPath).replace(/\\/g, '/'),
              type: 'file',
              size: stat.size,
              depth: depth + 1,
              extension: path.extname(item)
            });
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    await scanDirectory(projectPath);
    
    // Insert basic tree navigation data
    for (const file of files.slice(0, 50)) { // Limit to first 50 files
      try {
        await pgClient.query(`
          INSERT INTO tree_navigation_data (
            project_id, file_path, node_type, node_name, 
            parent_path, depth, children_count, complexity_score, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
        `, [
          projectId,
          '/' + file.path,
          file.type,
          path.basename(file.path),
          '/' + path.dirname(file.path),
          file.depth,
          0,
          file.type === 'file' ? Math.min(file.size / 1000, 100) : 0,
          JSON.stringify({
            size: file.size,
            extension: file.extension || null,
            scanned_at: new Date().toISOString()
          })
        ]);
        recordsCreated++;
      } catch (error) {
        // Skip on error
      }
    }
    
    return { recordsCreated, filesScanned: files.length };
    
  } finally {
    await pgClient.end();
  }
}

module.exports = {
  runComprehensiveAnalysis,
  runBasicAnalysis
};