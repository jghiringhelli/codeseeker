#!/usr/bin/env node

/**
 * CodeMind Core CLI - Local Workflow Implementation
 * Self-contained CLI that executes complete workflow cycles locally
 */

import { Command } from 'commander';
import { Logger } from '../utils/logger';
import { CLILogger } from '../utils/cli-logger';
import { CodeMindLocalWorkflow } from './codemind-local-workflow';
import { ContextOptimizer } from './context-optimizer';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();
const logger = Logger.getInstance();
const cliLogger = CLILogger.getInstance();

// Helper function to resolve project ID (shared utility)
async function resolveProjectId(projectPath: string): Promise<string> {
  try {
    const configPath = path.join(projectPath, '.codemind', 'project.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.projectId) return config.projectId;
    }
  } catch (error) {
    // Ignore config read errors
  }
  return `proj_${Buffer.from(projectPath).toString('base64').replace(/[+=]/g, '').substring(0, 8)}`;
}

program
  .name('codemind')
  .description('CodeMind - Intelligent Claude Code Enhancement Platform')
  .version('2.0.0');

// Core CLI command - local workflow implementation
program
  .command('analyze')
  .description('Execute complete local workflow for a request')
  .argument('<request>', 'Your request description')
  .argument('<projectPath>', 'Path to project directory')
  .action(async (request: string, projectPath: string) => {
    try {
      const workflow = new CodeMindLocalWorkflow();
      await workflow.executeWorkflow(request, projectPath);
    } catch (error) {
      logger.error('Workflow execution failed:', error);
      process.exit(1);
    }
  });

// Plan workflow without execution
program
  .command('plan')
  .description('Plan workflow steps without execution')
  .argument('<request>', 'Your request description')
  .argument('<projectPath>', 'Path to project directory')
  .action(async (request: string, projectPath: string) => {
    try {
      const workflow = new CodeMindLocalWorkflow();
      logger.info('🧠 Analyzing request and planning workflow...');
      
      // Access private methods through any casting (for demo purposes)
      const workflowAny = workflow as any;
      const intention = workflowAny.inferUserIntention(request, projectPath);
      const tools = await workflowAny.selectTools(intention, projectPath);
      const files = await workflowAny.findRelevantFiles(intention, tools, projectPath);
      const steps = await workflowAny.planWorkflowSteps(intention, tools, files, projectPath);
      
      logger.info('\n📋 Planned Workflow:');
      steps.forEach((step: any, i: number) => {
        logger.info(`  ${i + 1}. ${step.description}`);
        logger.info(`     Files: ${step.files.length} files`);
        logger.info(`     Action: ${step.action}`);
        logger.info(`     Priority: ${step.priority}`);
      });
      
      logger.info(`\n🚀 To execute: codemind analyze "${request}" "${projectPath}"`);
      
    } catch (error) {
      logger.error('Planning failed:', error);
      process.exit(1);
    }
  });

// List available tools
program
  .command('tools')
  .description('List available external tools')
  .option('--category <category>', 'Filter by category')
  .action(async (options) => {
    try {
      const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3006';
      const url = `${orchestratorUrl}/api/tools/available${options.category ? `?category=${options.category}` : ''}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        
        logger.info(`\n🔧 Available Tools (${data.totalCount}):`);
        
        const categories = [...new Set(data.tools.map((t: any) => t.category))];
        categories.forEach(category => {
          const toolsInCategory = data.tools.filter((t: any) => t.category === category);
          logger.info(`\n📁 ${category}:`);
          toolsInCategory.forEach((tool: any) => {
            logger.info(`  - ${tool.name}: ${tool.description}`);
            logger.info(`    Languages: ${tool.languages.join(', ')}`);
            logger.info(`    Trust: ${tool.trustLevel}`);
          });
        });
        
      } else {
        logger.error('❌ Could not fetch tools from orchestrator');
      }
    } catch (error) {
      logger.error('❌ Failed to fetch tools:', error);
    }
  });

// System status
program
  .command('status')
  .description('Check system status including semantic services')
  .action(async () => {
    try {
      cliLogger.commandHeader('SYSTEM STATUS', 'Check all CodeMind services and semantic graph health');
      
      const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3006';
      let services = {
        neo4j: false,
        semanticGraph: false,
        orchestrator: false
      };
      
      // Check orchestrator
      try {
        const response = await fetch(`${orchestratorUrl}/health`);
        if (response.ok) {
          services.orchestrator = true;
          const data = await response.json();
          
          cliLogger.statusLine('Orchestrator Status', data.status, 'success');
          cliLogger.statusLine('Uptime', `${Math.round(data.uptime)}s`, 'info');
        }
      } catch (error) {
        cliLogger.statusLine('Orchestrator Status', 'Not responding', 'error');
      }
      
      // Check Neo4j and semantic graph
      try {
        const response = await fetch('http://localhost:3005/api/semantic-graph/health');
        if (response.ok) {
          services.neo4j = true;
          services.semanticGraph = true;
          
          const stats = await fetch('http://localhost:3005/api/semantic-graph/statistics');
          if (stats.ok) {
            const data = await stats.json();
            cliLogger.statusLine('Graph Nodes', data.total_nodes || 0, 'success');
            cliLogger.statusLine('Graph Relationships', data.total_relationships || 0, 'success');
          }
        }
      } catch (error) {
        // Try direct Neo4j check
        try {
          const response = await fetch('http://localhost:7474');
          if (response.ok) {
            services.neo4j = true;
            cliLogger.statusLine('Neo4j Database', 'Connected', 'success');
            cliLogger.statusLine('Semantic Graph API', 'Not responding', 'warning');
          }
        } catch (neo4jError) {
          cliLogger.statusLine('Neo4j Database', 'Not running', 'error');
        }
      }
      
      // Show semantic health check
      cliLogger.semanticHealthCheck(services);
      
      // Database status
      console.log(`\n${cliLogger.highlight('📊 Database Status:')}`);
      console.log(`${cliLogger.dim('Run:')} ${cliLogger.code('./scripts/db-status.ps1')} ${cliLogger.dim('for detailed database status')}`);
      
      // Quick start commands if services are down
      if (!services.neo4j || !services.semanticGraph) {
        console.log(`\n${cliLogger.highlight('🚀 Quick Start Commands:')}`);
        if (!services.neo4j) {
          console.log(`${cliLogger.dim('Start Neo4j:')} ${cliLogger.code('docker-compose -f docker-compose.semantic-graph.yml up -d')}`);
        }
        if (!services.semanticGraph) {
          console.log(`${cliLogger.dim('Start Graph API:')} ${cliLogger.code('node src/dashboard/semantic-graph-api.js')}`);
        }
      }
      
    } catch (error) {
      cliLogger.error('Status check failed', error instanceof Error ? error.message : 'Unknown error');
    }
  });

// Orchestrate workflow
program
  .command('orchestrate')
  .description('Start workflow orchestration')
  .argument('<query>', 'Analysis query')
  .argument('<projectPath>', 'Path to project')
  .option('--priority <priority>', 'Priority level', 'normal')
  .action(async (query, projectPath, options) => {
    try {
      logger.info(`🎭 Starting orchestration: ${query}`);
      
      const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3006';
      const response = await fetch(`${orchestratorUrl}/api/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          projectPath,
          requestedBy: 'cli',
          options: {
            priority: options.priority
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        logger.info(`✅ Orchestration started: ${data.orchestrationId}`);
        logger.info(`Status: ${data.status}`);
        logger.info(`Workflow: ${data.workflowGraph.name}`);
        logger.info(`Estimated duration: ${data.workflowGraph.estimatedDuration}s`);
        logger.info('\n💡 Monitor at: http://localhost:3005 (dashboard)');
        
        // Update tools after successful orchestration start
        // Tools are updated through orchestrator messaging
        
      } else {
        logger.error('❌ Orchestration failed');
      }
      
    } catch (error) {
      logger.error('❌ Orchestration error:', error);
    }
  });

// Intelligent orchestration command with three-phase discovery
program
  .command('smart')
  .description('Smart orchestration with three-phase discovery (semantic search → graph → tree)')
  .argument('<intent>', 'User intent or task description')
  .argument('<projectPath>', 'Path to project directory')
  .option('-m, --max-context <size>', 'Maximum context window size', '8000')
  .option('--no-cache', 'Disable cached results')
  .option('--force-sync', 'Force file synchronization before analysis')
  .action(async (intent: string, projectPath: string, options: any) => {
    try {
      const { IntelligentTaskOrchestrator } = await import('../orchestration/intelligent-task-orchestrator');
      const { FileSynchronizationSystem } = await import('../shared/file-synchronization-system');
      
      logger.info('🧠 Starting intelligent orchestration...');
      const startTime = Date.now();
      
      // Resolve project ID
      const projectId = await resolveProjectId(projectPath);
      
      // Force sync if requested
      if (options.forceSync) {
        logger.info('🔄 Synchronizing project files...');
        const syncSystem = new FileSynchronizationSystem(projectPath);
        await syncSystem.initialize();
        const syncResult = await syncSystem.synchronizeProject(projectPath, projectId);
        logger.info(`✅ Synchronized: ${syncResult.totalFiles} files, ${syncResult.modifiedFiles} updated`);
        await syncSystem.close();
      }
      
      // Initialize orchestrator
      const orchestrator = new IntelligentTaskOrchestrator();
      await orchestrator.initialize();
      
      // Orchestrate with three-phase discovery
      const result = await orchestrator.orchestrateRequest({
        userQuery: intent || 'analyze project',
        userIntent: intent,
        projectPath,
        projectId,
        maxContextTokens: parseInt(options.maxContext)
      });
      
      await orchestrator.close();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Display results
      console.log('\n' + '='.repeat(80));
      console.log('🎯 INTELLIGENT ORCHESTRATION RESULTS');
      console.log('='.repeat(80));
      console.log(`📋 Intent: ${intent}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`🎨 Tasks Created: ${result.orchestratedTasks.length}`);
      console.log(`📁 Files Discovered: ${result.discoveredImpact.semanticFiles.length}`);
      console.log(`🔍 Discovery Method: semantic+graph+tree`);
      console.log('');
      
      // Show discovery summary
      console.log('📊 DISCOVERY SUMMARY');
      console.log('─'.repeat(40));
      if (result.discoveredImpact.semanticFiles) {
        console.log(`🔎 Semantic Search: ${result.discoveredImpact.semanticFiles.length} files`);
      }
      if (result.discoveredImpact.graphRelationships) {
        console.log(`🕸️  Graph Expansion: ${result.discoveredImpact.graphRelationships.length} relationships`);
      }
      if (result.discoveredImpact.treeStructure) {
        console.log(`🌳 Tree Analysis: ${result.discoveredImpact.treeStructure.length} structures`);
      }
      console.log('');
      
      // Show tasks
      console.log('📝 TASK BREAKDOWN');
      console.log('─'.repeat(40));
      result.orchestratedTasks.forEach((task, index) => {
        console.log(`${index + 1}. [PRIORITY ${task.priority}] ${task.description}`);
        console.log(`   📦 Context Size: ${task.estimatedTokens} tokens`);
        console.log(`   📁 Files: ${task.targetFiles.length}`);
        console.log(`   🏷️ Category: ${task.category}`);
        console.log('');
      });
      
      // Show execution plan
      console.log('💡 EXECUTION PLAN');
      console.log('─'.repeat(40));
      console.log(`Total Tasks: ${result.executionPlan.totalTasks}`);
      console.log(`Estimated Duration: ${result.executionPlan.estimatedDuration}`);
      console.log('');
      
      logger.info('✅ Intelligent orchestration completed successfully');
      
    } catch (error) {
      logger.error('❌ Intelligent orchestration failed:', error);
      
      // Provide helpful error diagnosis and recovery suggestions
      console.log('\n🔧 TROUBLESHOOTING GUIDE');
      console.log('─'.repeat(40));
      
      if (error instanceof Error) {
        if (error.message.includes('not initialized')) {
          console.log('• Run initialization: ./scripts/init-project.ps1');
          console.log('• Check database connections');
        }
        
        if (error.message.includes('timeout')) {
          console.log('• Services may be slow to respond');
          console.log('• Check Docker containers: docker ps');
          console.log('• Retry with --force-sync to refresh data');
        }
        
        if (error.message.includes('OPENAI_API_KEY')) {
          console.log('• Set OPENAI_API_KEY for semantic search');
          console.log('• Or use --no-cache to skip embeddings');
        }
        
        if (error.message.includes('connection')) {
          console.log('• Check PostgreSQL: docker logs codemind-postgres');
          console.log('• Check Neo4j: docker logs codemind-neo4j');
        }
      }
      
      console.log('• For support: https://github.com/anthropics/claude-code/issues');
      console.log('');
    }
  });

// Help and examples
program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log(`
CodeMind CLI Examples - Three Layer Architecture

🧠 Layer 1: Smart CLI
  codemind analyze ./my-project --role architect
  codemind analyze ./frontend --role security
  codemind tools --category linting

🎭 Layer 2: Orchestrator
  codemind orchestrate "security audit" ./my-app
  codemind orchestrate "performance optimization" ./backend
  codemind status

🚀 Layer 3: Planner (via Dashboard)
  Visit: http://localhost:3005
  Click: "💡 I have an idea" button

System Management:
  codemind status                    # Check all services
  ./scripts/init-database.ps1       # Initialize database
  ./scripts/db-status.ps1           # Database status

Environment Setup:
  export ORCHESTRATOR_URL=http://localhost:3006
  export DB_HOST=localhost
  export DB_PORT=5432
    `);
  });

// Semantic search command
program
  .command('search')
  .description('Search the codebase using semantic graph')
  .argument('<query>', 'Search query')
  .argument('<projectPath>', 'Path to project directory')
  .option('--intent <intent>', 'Search intent (overview, coding, architecture, debugging)', 'overview')
  .option('--max-results <n>', 'Maximum number of results', '10')
  .action(async (query, projectPath, options) => {
    const startTime = Date.now();
    
    try {
      cliLogger.commandHeader('SEMANTIC SEARCH', 'Search codebase using intelligent semantic graph');
      
      // Provide enhanced context before processing
      // Enhanced context is provided via local workflow
      
      cliLogger.semanticSearching(query, options.intent);
      
      // Import the class properly
      const { SemanticOrchestrator } = require('../orchestration/semantic-orchestrator');
      const semanticOrchestrator = new SemanticOrchestrator();
      
      cliLogger.semanticInitializing();
      await semanticOrchestrator.initialize();
      
      // Get graph stats for status
      const graphStats = await semanticOrchestrator['semanticGraph'].getGraphStatistics();
      cliLogger.semanticConnected({ 
        nodes: graphStats.total_nodes || 0, 
        relationships: graphStats.total_relationships || 0 
      });
      
      const result = await semanticOrchestrator.analyzeWithSemanticContext({
        query,
        projectPath,
        intent: options.intent,
        maxResults: parseInt(options.maxResults),
        includeRelated: true
      });
      
      const duration = Date.now() - startTime;
      cliLogger.semanticResults({
        primaryResults: result.primaryResults.length,
        relatedConcepts: result.relatedConcepts.length,
        crossDomainInsights: result.crossDomainInsights.length,
        duration
      });
      
      // Show detailed results if found
      if (result.primaryResults.length > 0) {
        console.log(`\n${cliLogger.highlight('📋 Primary Results:')}`);
        result.primaryResults.forEach((item: any, index: number) => {
          console.log(`\n${index + 1}. ${cliLogger.bold(item.name)} ${cliLogger.dim(`(${item.type})`)}`);
          if (item.path) {
            console.log(`   ${cliLogger.dim('Path:')} ${cliLogger.path(item.path)}`);
          }
          if (item.description) {
            console.log(`   ${cliLogger.dim('Description:')} ${item.description}`);
          }
          if (item.relevance) {
            console.log(`   ${cliLogger.dim('Relevance:')} ${cliLogger.highlight((item.relevance * 100).toFixed(1) + '%')}`);
          }
        });
      }
      
      // Show related concepts
      if (result.relatedConcepts.length > 0) {
        cliLogger.conceptsList(result.relatedConcepts);
      }
      
      // Show recommendations
      if (result.recommendations.length > 0) {
        cliLogger.recommendationsList(result.recommendations);
      }
      
      await semanticOrchestrator.close();
      cliLogger.success('Semantic search completed');
      
      // Assessment handled by local workflow when needed
      
    } catch (error) {
      cliLogger.error('Semantic search failed', error instanceof Error ? error.message : 'Unknown error');
      cliLogger.semanticFallback('Neo4j connection failed');
      console.log(`\n${cliLogger.dim('💡 Start services: docker-compose -f docker-compose.semantic-graph.yml up -d')}`);
    }
  });

// Context optimization command
program
  .command('context')
  .description('Optimize context for Claude Code using semantic intelligence')
  .argument('<query>', 'Query for context optimization')
  .argument('<projectPath>', 'Path to project directory')
  .option('--tokens <n>', 'Token budget', '8000')
  .option('--strategy <strategy>', 'Optimization strategy (minimal, smart, full)', 'smart')
  .option('--focus <area>', 'Focus area for analysis')
  .action(async (query, projectPath, options) => {
    try {
      cliLogger.commandHeader('CONTEXT OPTIMIZATION', 'Intelligent file prioritization for Claude Code');
      
      // Provide enhanced context before processing
      // Enhanced context provided via local workflow
      
      const contextOptimizer = new ContextOptimizer();
      let semanticEnabled = false;
      
      try {
        // Check if semantic graph is available
        await contextOptimizer['semanticOrchestrator'].initialize();
        semanticEnabled = true;
      } catch (error) {
        // Semantic graph not available, will use fallback
      }
      
      cliLogger.contextOptimizing(query, parseInt(options.tokens), semanticEnabled);
      
      if (!semanticEnabled) {
        cliLogger.semanticFallback('Neo4j not available');
      }
      
      const result = await contextOptimizer.optimizeContext({
        query,
        projectPath,
        tokenBudget: parseInt(options.tokens),
        strategy: options.strategy,
        focusArea: options.focus
      });
      
      // Count semantic boosts
      const semanticBoosts = result.priorityFiles.filter((file: any) => file.semanticBoost).length;
      
      cliLogger.contextResults({
        strategy: result.strategy || options.strategy,
        estimatedTokens: result.estimatedTokens,
        tokenBudget: result.tokenBudget,
        priorityFiles: result.priorityFiles.length,
        semanticBoosts: semanticEnabled ? semanticBoosts : undefined
      });
      
      // Format files with semantic boost indicators
      const formattedFiles = result.priorityFiles.slice(0, 10).map((file: any) => ({
        path: file.path,
        score: file.score,
        importance: file.importance,
        language: file.language,
        semanticBoost: semanticEnabled && file.score > 10, // Heuristic for semantic boost
        summary: file.summary
      }));
      
      cliLogger.fileList(formattedFiles);
      cliLogger.success('Context optimization completed');
      
      // Assessment handled by local workflow when needed
      
    } catch (error) {
      cliLogger.error('Context optimization failed', error instanceof Error ? error.message : 'Unknown error');
    }
  });

// Reconciliation command
program
  .command('reconcile [project-path]')
  .description('Reconcile database with current codebase state')
  .option('-p, --project-id <id>', 'Project ID (will attempt to auto-detect if not provided)')
  .option('-s, --scope <scope>', 'Reconciliation scope: full, incremental, selective', 'incremental')
  .option('-t, --tools <tools>', 'Comma-separated list of specific tools (for selective scope)')
  .option('-h, --hours <hours>', 'Hours to look back for incremental reconciliation', '24')
  .option('-d, --dry-run', 'Preview changes without applying them', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (projectPathArg: string = process.cwd(), options) => {
    try {
      logger.info('🔄 Starting database reconciliation...');
      
      const { createReconcileCommand } = await import('./commands/reconcile');
      const reconcileCommand = createReconcileCommand();
      
      // Execute the reconcile command with the provided arguments
      const args = [projectPathArg];
      if (options.projectId) args.push('--project-id', options.projectId);
      if (options.scope) args.push('--scope', options.scope);
      if (options.tools) args.push('--tools', options.tools);
      if (options.hours) args.push('--hours', options.hours);
      if (options.dryRun) args.push('--dry-run');
      if (options.verbose) args.push('--verbose');
      
      await reconcileCommand.parseAsync(args, { from: 'user' });
      
    } catch (error) {
      logger.error('Reconciliation failed:', error);
      process.exit(1);
    }
  });


program.parse();

export default program;