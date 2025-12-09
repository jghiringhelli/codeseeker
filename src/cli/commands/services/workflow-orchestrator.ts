/**
 * Workflow Orchestrator Service
 * Single Responsibility: Coordinate the complete CodeMind Core Cycle workflow
 *
 * This orchestrator manages the 12-step workflow with Context-Aware Clarification:
 * 1. Query Analysis - Analyze user input for assumptions and ambiguities
 * 2. Task Decomposition - Split complex queries into focused sub-tasks
 * 3. Semantic Search - Find relevant files using PostgreSQL pgvector + FTS
 * 4. Code Relationship Analysis - Map relationships using knowledge graph
 * 5. Context-Aware Clarification - Ask targeted questions based on research results
 * 6. Sub-Task Context Generation - Build tailored context per sub-task
 * 7. Enhanced Context Building - Build optimized prompt for Claude
 * 8. Claude Code Execution - Execute sub-tasks or full query with context
 * 9. File Modification Approval - Confirm changes before applying
 * 10. Build/Test Verification - Ensure code compiles and tests pass
 * 11. Database Sync - Update semantic search and knowledge graph
 */

import { NaturalLanguageProcessor, QueryAnalysis } from './natural-language-processor';
import { SemanticSearchOrchestrator, SemanticResult } from './semantic-search-orchestrator';
import { GraphAnalysisService, GraphContext } from './graph-analysis-service';
import { ContextBuilder, EnhancedContext } from './context-builder';
import { UserInteractionService, ClaudeResponse } from './user-interaction-service';
import { TaskDecompositionService, DecompositionResult, SubTaskContext, ContextFilter } from './task-decomposition-service';
import { ContextAwareClarificationService, ClarificationResult } from './context-aware-clarification-service';
import { DatabaseUpdateManager } from '../../../shared/managers/database-update-manager';
import { DatabaseConnections } from '../../../config/database-config';
import { Spinner, Theme } from '../../ui/theme';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import inquirer from 'inquirer';
import { Logger } from '../../../utils/logger';

const execAsync = promisify(exec);

interface TaskConfirmationResult {
  proceed: boolean;
  clarification?: string;
}

export interface WorkflowResult {
  success: boolean;
  queryAnalysis: QueryAnalysis;
  decomposition?: DecompositionResult;
  clarificationResult?: ClarificationResult;
  subTaskContexts?: SubTaskContext[];
  semanticResults: SemanticResult[];
  graphContext: GraphContext;
  enhancedContext: EnhancedContext;
  claudeResponse?: ClaudeResponse;
  buildResult?: BuildTestResult;
  syncResult?: SyncResult;
  error?: string;
}

export interface BuildTestResult {
  buildSuccess: boolean;
  testSuccess: boolean;
  buildOutput?: string;
  testOutput?: string;
  buildError?: string;
  testError?: string;
}

export interface SyncResult {
  filesUpdated: number;
  graphNodesCreated: number;
  cacheUpdated: number;
}

export interface WorkflowOptions {
  skipUserClarification?: boolean;
  skipFileConfirmation?: boolean;
  skipBuildTest?: boolean;
  skipDatabaseSync?: boolean;
  maxSemanticResults?: number;
  semanticThreshold?: number;
  projectId?: string;
  transparentMode?: boolean; // Skip all interactive prompts and output context directly
}

export class WorkflowOrchestrator {
  private _nlpProcessor?: NaturalLanguageProcessor;
  private _searchOrchestrator?: SemanticSearchOrchestrator;
  private _graphAnalysisService?: GraphAnalysisService;
  private _contextBuilder?: ContextBuilder;
  private _userInteractionService?: UserInteractionService;
  private _taskDecompositionService?: TaskDecompositionService;
  private _clarificationService?: ContextAwareClarificationService;
  private _databaseUpdateManager?: DatabaseUpdateManager;
  private _dbConnections?: DatabaseConnections;
  private projectPath: string;
  private projectId: string;
  private _readlineInterface?: any;

  // Lazy initialization with singleton pattern for better performance
  private get nlpProcessor(): NaturalLanguageProcessor {
    if (!this._nlpProcessor) {
      this._nlpProcessor = new NaturalLanguageProcessor();
    }
    return this._nlpProcessor;
  }

  private get searchOrchestrator(): SemanticSearchOrchestrator {
    if (!this._searchOrchestrator) {
      this._searchOrchestrator = new SemanticSearchOrchestrator(this.dbConnections);
      if (this.projectId) {
        this._searchOrchestrator.setProjectId(this.projectId);
      }
    }
    return this._searchOrchestrator;
  }

  private get graphAnalysisService(): GraphAnalysisService {
    if (!this._graphAnalysisService) {
      this._graphAnalysisService = new GraphAnalysisService(this.projectPath);
    }
    return this._graphAnalysisService;
  }

  private get contextBuilder(): ContextBuilder {
    if (!this._contextBuilder) {
      this._contextBuilder = new ContextBuilder();
    }
    return this._contextBuilder;
  }

  private get userInteractionService(): UserInteractionService {
    if (!this._userInteractionService) {
      this._userInteractionService = new UserInteractionService();
      if (this._readlineInterface) {
        this._userInteractionService.setReadlineInterface(this._readlineInterface);
      }
    }
    return this._userInteractionService;
  }

  private get taskDecompositionService(): TaskDecompositionService {
    if (!this._taskDecompositionService) {
      this._taskDecompositionService = new TaskDecompositionService();
    }
    return this._taskDecompositionService;
  }

  private get clarificationService(): ContextAwareClarificationService {
    if (!this._clarificationService) {
      this._clarificationService = new ContextAwareClarificationService();
      if (this._readlineInterface) {
        this._clarificationService.setReadlineInterface(this._readlineInterface);
      }
    }
    return this._clarificationService;
  }

  private get dbConnections(): DatabaseConnections {
    if (!this._dbConnections) {
      this._dbConnections = new DatabaseConnections();
    }
    return this._dbConnections;
  }

  private get databaseUpdateManager(): DatabaseUpdateManager {
    if (!this._databaseUpdateManager) {
      this._databaseUpdateManager = new DatabaseUpdateManager(this.projectId, this.projectPath);
    }
    return this._databaseUpdateManager;
  }

  constructor(projectPath: string, projectId?: string) {
    this.projectPath = projectPath;
    this.projectId = projectId || 'default';
  }

  /**
   * Set readline interface for user interactions
   */
  setReadlineInterface(rl: any): void {
    this._readlineInterface = rl;
    if (this._userInteractionService) {
      this._userInteractionService.setReadlineInterface(rl);
    }
    if (this._clarificationService) {
      this._clarificationService.setReadlineInterface(rl);
    }
  }

  /**
   * Set project context
   */
  setProject(projectId: string, projectPath: string): void {
    this.projectId = projectId;
    this.projectPath = projectPath;
    if (this._searchOrchestrator) {
      this._searchOrchestrator.setProjectId(projectId);
    }
    if (this._databaseUpdateManager) {
      this._databaseUpdateManager.setProject(projectId, projectPath);
    }
  }

  /**
   * Check database health and provide setup guidance if unavailable
   */
  private async checkDatabaseHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check PostgreSQL
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'codemind',
        user: process.env.DB_USER || 'codemind',
        password: process.env.DB_PASSWORD || 'codemind123',
        connectionTimeoutMillis: 3000
      });
      await pool.query('SELECT 1');
      await pool.end();
    } catch (error) {
      issues.push('PostgreSQL');
    }

    // Check Redis (optional, warn only)
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 3000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // Don't retry
      });
      // Suppress error events to prevent console flooding
      redis.on('error', () => {});
      await redis.connect();
      await redis.ping();
      await redis.quit();
    } catch {
      // Redis is optional, don't add to critical issues
    }

    return { healthy: issues.length === 0, issues };
  }

  /**
   * Display database setup guidance
   */
  private displayDatabaseSetupGuidance(issues: string[]): void {
    console.log('\n⚠️  Database Connection Issues Detected');
    console.log('━'.repeat(50));
    console.log(`Unable to connect to: ${issues.join(', ')}\n`);

    console.log('📋 Setup Options:\n');

    console.log('1️⃣  Start databases with Docker (recommended):');
    console.log('   docker-compose up -d postgres redis\n');

    console.log('2️⃣  Or start Rancher Desktop / Docker Desktop\n');

    console.log('3️⃣  Environment variables (if using custom setup):');
    console.log('   DB_HOST=localhost DB_PORT=5432 DB_NAME=codemind');
    console.log('   DB_USER=codemind DB_PASSWORD=codemind123');
    console.log('   REDIS_HOST=localhost REDIS_PORT=6379\n');

    console.log('4️⃣  Initialize project after databases are running:');
    console.log('   codemind setup\n');

    console.log('━'.repeat(50));
    console.log('⏳ Continuing with limited functionality (file-based search only)...\n');
  }

  /**
   * Execute the complete CodeMind Core Cycle workflow
   */
  async executeWorkflow(
    query: string,
    projectPath: string,
    options: WorkflowOptions = {}
  ): Promise<WorkflowResult> {
    try {
      // Update project path if different
      if (projectPath !== this.projectPath) {
        this.projectPath = projectPath;
      }
      if (options.projectId) {
        this.projectId = options.projectId;
      }

      // Check database health and provide guidance if needed
      const dbHealth = await this.checkDatabaseHealth();
      if (!dbHealth.healthy) {
        this.displayDatabaseSetupGuidance(dbHealth.issues);
      }

      // Transparent mode is now controlled by explicit option, not auto-detected
      // Users can pass --transparent flag to skip interactive prompts
      const isTransparentMode = options.transparentMode === true;
      if (isTransparentMode) {
        // In transparent mode, skip interactive prompts
        options.skipUserClarification = true;
        options.skipFileConfirmation = true;
        options.skipBuildTest = true; // Let Claude handle build/test
        options.skipDatabaseSync = true; // Sync after Claude completes
      }

      // ==========================================
      // STEP 1: Query Analysis (with spinner) - Now using Claude-based analysis
      // ==========================================
      let spinner = Spinner.create('Analyzing query with Claude...');
      const queryAnalysis = await this.nlpProcessor.analyzeQueryAsync(query);
      spinner.succeed(`Query analyzed (intent: ${queryAnalysis.intent}, confidence: ${(queryAnalysis.confidence * 100).toFixed(0)}%)`);

      // Show analysis details from Claude's analysis
      if (queryAnalysis.assumptions.length > 0 || queryAnalysis.ambiguities.length > 0 || queryAnalysis.reasoning) {
        this.logQueryAnalysis(queryAnalysis);
      }

      // ==========================================
      // STEP 2: Task Decomposition (for complex queries)
      // Run BEFORE preview so we can show all sub-tasks
      // ==========================================
      spinner = Spinner.create('Analyzing task complexity...');
      const decomposition = this.taskDecompositionService.decomposeQuery(query, queryAnalysis);
      if (decomposition.isComplex) {
        spinner.succeed(`Complex query: ${decomposition.subTasks.length} sub-tasks identified`);
      } else {
        spinner.succeed('Simple query: single task identified');
      }

      // ==========================================
      // TASK PREVIEW: Show user what CodeMind will do
      // Shows all sub-tasks if query was decomposed into multiple parts
      // ==========================================
      this.displayTaskPreview(query, queryAnalysis, decomposition);

      // For complex queries, show detailed breakdown and get user confirmation
      if (decomposition.isComplex && !isTransparentMode) {
        const confirmed = await this.confirmTaskExecution(decomposition);
        if (!confirmed.proceed) {
          if (confirmed.clarification) {
            // User provided clarification - retry with updated query
            return this.executeWorkflow(confirmed.clarification, projectPath, options);
          }
          return {
            success: false,
            queryAnalysis,
            semanticResults: [],
            graphContext: this.createEmptyGraphContext(),
            enhancedContext: this.createEmptyEnhancedContext(query),
            error: 'Task execution cancelled by user'
          };
        }
      }

      // ==========================================
      // WORKFLOW BRANCHES: Simple vs Complex Query Processing
      // ==========================================
      let claudeResponse: ClaudeResponse;
      let semanticResults: SemanticResult[] = [];
      let graphContext: GraphContext = this.createEmptyGraphContext();
      let enhancedContext: EnhancedContext;
      let clarificationResult: ClarificationResult | undefined;
      let subTaskContexts: SubTaskContext[] = [];

      if (decomposition.isComplex && decomposition.subTasks.length > 1) {
        // ==========================================
        // COMPLEX QUERY: Process each sub-task with its own search & context
        // Steps 3-7 run in a loop for each sub-task, then step 8 executes
        // ==========================================
        console.log(`\n🔄 Processing ${decomposition.subTasks.length} sub-tasks...\n`);

        const combinedResponse: ClaudeResponse = {
          response: '',
          filesToModify: [],
          summary: ''
        };

        // Aggregate all semantic results and graph contexts for final result
        const allSemanticResults: SemanticResult[] = [];
        const allClasses: GraphContext['classes'] = [];
        const allRelationships: GraphContext['relationships'] = [];

        for (const subTask of decomposition.subTasks) {
          console.log(Theme.colors.primary(`\n┌─ Sub-Task ${subTask.id}: ${subTask.type.toUpperCase()} ──────────────────────────────┐`));
          console.log(Theme.colors.muted(`│ ${subTask.description.substring(0, 55)}${subTask.description.length > 55 ? '...' : ''}`));
          console.log(Theme.colors.primary(`└${'─'.repeat(58)}┘`));

          // STEP 3 (per sub-task): Semantic Search using sub-task's search terms
          const searchQuery = subTask.searchTerms.length > 0
            ? subTask.searchTerms.join(' ')
            : subTask.description;

          spinner = Spinner.create(`  Searching for: "${searchQuery.substring(0, 30)}..."`);
          const taskSemanticResults = await this.searchOrchestrator.performSemanticSearch(searchQuery, projectPath);

          // Apply context filter if defined
          let filteredResults = taskSemanticResults;
          if (subTask.contextFilter) {
            filteredResults = this.applyContextFilter(taskSemanticResults, subTask.contextFilter);
          }

          if (filteredResults.length > 0) {
            spinner.succeed(`  Found ${filteredResults.length} relevant files`);
            filteredResults.slice(0, 3).forEach((r, i) => {
              const similarity = (r.similarity * 100).toFixed(0);
              console.log(Theme.colors.muted(`     ${i + 1}. ${r.file} (${similarity}%)`));
            });
            if (filteredResults.length > 3) {
              console.log(Theme.colors.muted(`     ... +${filteredResults.length - 3} more`));
            }
          } else {
            spinner.succeed('  Search complete (no specific matches)');
          }

          // STEP 4 (per sub-task): Code Relationship Analysis
          spinner = Spinner.create('  Analyzing relationships...');
          const taskGraphContext = await this.graphAnalysisService.performGraphAnalysis(searchQuery, filteredResults);
          const taskRelCount = taskGraphContext.relationships?.length || 0;
          const taskClassCount = taskGraphContext.classes?.length || 0;
          spinner.succeed(`  Found ${taskClassCount} components, ${taskRelCount} relationships`);

          // STEP 5 (per sub-task): Context-Aware Clarification
          // Only ask for first sub-task or if high-impact ambiguity detected
          if (!options.skipUserClarification && filteredResults.length > 0 && subTask.id === 1) {
            const taskClarification = await this.clarificationService.analyzeAndClarify(
              subTask.description,
              { ...queryAnalysis, intent: subTask.type },
              filteredResults,
              taskGraphContext,
              { skipClarification: isTransparentMode, maxQuestions: 2 }
            );

            if (!taskClarification.skipped && taskClarification.questionsAnswered > 0) {
              clarificationResult = taskClarification;
            }
          }

          // STEP 6 (per sub-task): Build Sub-Task Context
          spinner = Spinner.create('  Building context...');
          const taskContext = this.taskDecompositionService.filterContextForSubTask(
            subTask,
            filteredResults,
            taskGraphContext
          );
          subTaskContexts.push(taskContext);
          spinner.succeed('  Context ready');

          // Display sub-task context summary
          if (filteredResults.length > 0 || taskClassCount > 0) {
            console.log(Theme.colors.muted(`  📁 Files: ${filteredResults.length} | 📦 Components: ${taskClassCount} | 🔗 Relationships: ${taskRelCount}`));
          }

          // STEP 7 (per sub-task): Execute Claude Code
          console.log(Theme.colors.info('\n  🤖 Executing with Claude Code...'));
          const subResponse = await this.userInteractionService.executeClaudeCode(
            taskContext.enhancedPrompt
          );

          // Aggregate responses
          if (subResponse.response) {
            combinedResponse.response += `\n--- Sub-task ${subTask.id} (${subTask.type}) ---\n`;
            combinedResponse.response += subResponse.response;
          }
          if (subResponse.filesToModify) {
            combinedResponse.filesToModify.push(...subResponse.filesToModify);
          }
          if (subResponse.summary) {
            combinedResponse.summary += subResponse.summary + '\n';
          }

          // Aggregate search results for final WorkflowResult
          allSemanticResults.push(...filteredResults);
          if (taskGraphContext.classes) allClasses.push(...taskGraphContext.classes);
          if (taskGraphContext.relationships) allRelationships.push(...taskGraphContext.relationships);

          console.log(Theme.colors.success(`  ✓ Sub-task ${subTask.id} complete`));
        }

        // Deduplicate aggregated results
        combinedResponse.filesToModify = [...new Set(combinedResponse.filesToModify)];
        claudeResponse = combinedResponse;

        // Set aggregated results for WorkflowResult
        semanticResults = this.deduplicateSemanticResults(allSemanticResults);
        graphContext = {
          classes: this.deduplicateClasses(allClasses),
          relationships: this.deduplicateRelationships(allRelationships),
          relationshipDetails: allRelationships,
          packageStructure: [],
          graphInsights: {
            totalNodes: allClasses.length,
            totalRelationships: allRelationships.length,
            architecturalPatterns: [],
            qualityMetrics: { coupling: 0, cohesion: 0, complexity: 0 }
          }
        };

        // Build combined enhanced context for result
        enhancedContext = this.contextBuilder.buildEnhancedContext(
          query,
          queryAnalysis,
          [],
          semanticResults,
          graphContext
        );

        console.log(`\n✅ Completed all ${decomposition.subTasks.length} sub-tasks`);

      } else {
        // ==========================================
        // SIMPLE QUERY: Single pass through steps 3-8
        // ==========================================

        // STEP 3: Semantic Search (PostgreSQL pgvector + FTS)
        spinner = Spinner.create('Searching codebase...');
        semanticResults = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
        if (semanticResults.length > 0) {
          spinner.succeed(`Found ${semanticResults.length} relevant files`);

          const topFiles = semanticResults.slice(0, 5);
          topFiles.forEach((r, i) => {
            const similarity = (r.similarity * 100).toFixed(0);
            console.log(Theme.colors.muted(`   ${i + 1}. ${r.file} (${r.type}, ${similarity}%)`));
          });
          if (semanticResults.length > 5) {
            console.log(Theme.colors.muted(`   ... +${semanticResults.length - 5} more files`));
          }
        } else {
          spinner.succeed('Search complete');
        }

        // STEP 4: Code Relationship Analysis
        spinner = Spinner.create('Analyzing code relationships...');
        graphContext = await this.graphAnalysisService.performGraphAnalysis(query, semanticResults);
        const relCount = graphContext.relationships?.length || 0;
        const classCount = graphContext.classes?.length || 0;
        spinner.succeed(`Found ${classCount} components, ${relCount} relationships`);

        if (relCount > 0) {
          const topRels = graphContext.relationships.slice(0, 3);
          topRels.forEach(r => {
            console.log(Theme.colors.muted(`   • ${r.from} → ${r.to} (${r.type})`));
          });
          if (relCount > 3) {
            console.log(Theme.colors.muted(`   ... +${relCount - 3} more relationships`));
          }
        }

        // STEP 5: Context-Aware Clarification
        let userClarifications: string[] = [];
        if (!options.skipUserClarification && semanticResults.length > 0) {
          clarificationResult = await this.clarificationService.analyzeAndClarify(
            query,
            queryAnalysis,
            semanticResults,
            graphContext,
            { skipClarification: isTransparentMode, maxQuestions: 3 }
          );

          if (!clarificationResult.skipped && clarificationResult.questionsAnswered > 0) {
            userClarifications = Array.from(clarificationResult.clarifications.entries())
              .map(([key, value]) => `${key}: ${value}`);
            query = clarificationResult.enhancedQuery;
          }
        }

        // STEP 6: Enhanced Context Building
        spinner = Spinner.create('Building context...');
        enhancedContext = this.contextBuilder.buildEnhancedContext(
          query,
          queryAnalysis,
          userClarifications,
          semanticResults,
          graphContext
        );
        spinner.succeed('Context ready');

        // Display context summary
        if (semanticResults.length > 0 || graphContext.classes?.length > 0) {
          this.displayContextSummary(semanticResults, graphContext);
        }

        // STEP 7: Claude Code Execution
        claudeResponse = await this.userInteractionService.executeClaudeCode(
          semanticResults.length > 0 ? enhancedContext.enhancedPrompt : query
        );
      }

      // Note: File changes are now confirmed BEFORE being applied (in executeClaudeCode)
      // No need for post-execution file modification approval

      // ==========================================
      // STEP 9: Build/Test Verification (with user confirmation)
      // ==========================================
      let buildResult: BuildTestResult | undefined;
      if (!options.skipBuildTest && claudeResponse.filesToModify.length > 0) {
        // Ask user if they want to run build/tests
        const buildConfirmation = await this.userInteractionService.confirmBuildAndTest();

        if (buildConfirmation.choice === 'yes' || buildConfirmation.choice === 'yes_always') {
          console.log(Theme.colors.muted('\n  Running build and tests...'));
          buildResult = await this.verifyBuildAndTests(projectPath);

          if (buildResult.buildSuccess) {
            console.log(Theme.colors.success('  ✓ Build successful'));
          } else if (buildResult.buildError) {
            console.log(Theme.colors.error(`  ✗ Build failed: ${buildResult.buildError.substring(0, 100)}...`));
          }

          if (buildResult.testSuccess) {
            console.log(Theme.colors.success('  ✓ Tests passed'));
          } else if (buildResult.testError) {
            console.log(Theme.colors.error(`  ✗ Tests failed: ${buildResult.testError.substring(0, 100)}...`));
          }
        } else {
          console.log(Theme.colors.muted('\n  Skipped build/test verification'));
        }
      }

      // ==========================================
      // STEP 10: Database Sync (silent)
      // ==========================================
      let syncResult: SyncResult | undefined;
      if (!options.skipDatabaseSync && claudeResponse.filesToModify.length > 0) {
        syncResult = await this.syncDatabases(claudeResponse.filesToModify);
      }

      return {
        success: true,
        queryAnalysis,
        decomposition,
        clarificationResult,
        subTaskContexts: subTaskContexts.length > 0 ? subTaskContexts : undefined,
        semanticResults,
        graphContext,
        enhancedContext,
        claudeResponse,
        buildResult,
        syncResult
      };

    } catch (error) {
      console.error('❌ Workflow execution failed:', error);

      // Use synchronous fallback for error case
      const fallbackAnalysis = this.nlpProcessor.analyzeQuery(query);
      return {
        success: false,
        queryAnalysis: fallbackAnalysis,
        semanticResults: [],
        graphContext: this.createEmptyGraphContext(),
        enhancedContext: this.createEmptyEnhancedContext(query),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Confirm task execution with user
   * Shows detailed task breakdown and allows user to proceed, modify, or cancel
   */
  private async confirmTaskExecution(decomposition: DecompositionResult): Promise<TaskConfirmationResult> {
    // Display detailed task breakdown
    console.log(Theme.colors.primary('\n┌─ 📋 Task Breakdown ────────────────────────────────────────┐'));
    console.log(Theme.colors.muted('│ CodeMind has analyzed your request and identified:'));
    console.log(Theme.colors.primary('│'));

    for (const task of decomposition.subTasks) {
      const typeIcon = this.getTaskTypeIcon(task.type);
      const complexityBadge = this.getComplexityBadge(task.estimatedComplexity);

      console.log(Theme.colors.primary(`│ ${typeIcon} Task ${task.id}: `) + Theme.colors.result(task.description));
      console.log(Theme.colors.muted(`│    Type: ${task.type} | Complexity: ${complexityBadge}`));

      if (task.searchTerms.length > 0) {
        console.log(Theme.colors.muted(`│    Search terms: ${task.searchTerms.slice(0, 5).join(', ')}`));
      }

      if (task.dependencies.length > 0) {
        console.log(Theme.colors.muted(`│    Depends on: Task ${task.dependencies.join(', Task ')}`));
      }

      console.log(Theme.colors.primary('│'));
    }

    // Show execution plan
    console.log(Theme.colors.primary('│ 📊 Execution Plan:'));
    for (const phase of decomposition.executionPlan.phases) {
      const taskIds = phase.taskIds.join(', ');
      console.log(Theme.colors.muted(`│    Phase ${phase.phaseNumber}: Tasks [${taskIds}] - ${phase.description}`));
    }

    console.log(Theme.colors.primary('└──────────────────────────────────────────────────────────────┘\n'));

    // Pause readline and mute logger before inquirer prompts
    if (this._readlineInterface) {
      this._readlineInterface.pause();
    }
    Logger.mute();

    try {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'How would you like to proceed?',
          choices: [
            { name: '✅ Proceed with these tasks', value: 'proceed' },
            { name: '✏️  Clarify or modify the request', value: 'clarify' },
            { name: '❌ Cancel', value: 'cancel' }
          ]
        }
      ]);

      if (answer.action === 'proceed') {
        return { proceed: true };
      }

      if (answer.action === 'clarify') {
        const clarification = await inquirer.prompt([
          {
            type: 'input',
            name: 'text',
            message: 'Provide additional details or modifications:',
            validate: (input) => input.trim().length > 0 || 'Please provide some clarification'
          }
        ]);

        return {
          proceed: false,
          clarification: clarification.text
        };
      }

      return { proceed: false };
    } catch (error: any) {
      // Handle Ctrl+C gracefully - treat as cancel
      if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
        console.log(Theme.colors.muted('\n⚠️  Prompt cancelled'));
        return { proceed: false };
      }
      throw error;
    } finally {
      // Unmute logger and resume readline after inquirer
      Logger.unmute();
      if (this._readlineInterface) {
        this._readlineInterface.resume();
      }
    }
  }

  /**
   * Get icon for task type
   */
  private getTaskTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'analyze': '🔍',
      'create': '✨',
      'modify': '📝',
      'refactor': '🔄',
      'test': '🧪',
      'fix': '🔧',
      'document': '📚',
      'configure': '⚙️',
      'general': '📌'
    };
    return icons[type] || '📌';
  }

  /**
   * Get complexity badge
   */
  private getComplexityBadge(complexity: string): string {
    const badges: Record<string, string> = {
      'low': Theme.colors.success('●') + ' Low',
      'medium': Theme.colors.warning('●') + ' Medium',
      'high': Theme.colors.error('●') + ' High'
    };
    return badges[complexity] || complexity;
  }

  /**
   * Verify build and run tests
   */
  private async verifyBuildAndTests(projectPath: string): Promise<BuildTestResult> {
    const result: BuildTestResult = {
      buildSuccess: false,
      testSuccess: false
    };

    // Try to run build
    try {
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: projectPath,
        timeout: 120000 // 2 minute timeout
      });
      result.buildSuccess = true;
      result.buildOutput = stdout;
      if (stderr) {
        result.buildOutput += '\n' + stderr;
      }
    } catch (error: any) {
      result.buildSuccess = false;
      result.buildError = error.message || String(error);
      // Don't fail completely if build fails - continue with tests
    }

    // Try to run tests
    try {
      const { stdout, stderr } = await execAsync('npm test', {
        cwd: projectPath,
        timeout: 180000 // 3 minute timeout
      });
      result.testSuccess = true;
      result.testOutput = stdout;
      if (stderr) {
        result.testOutput += '\n' + stderr;
      }
    } catch (error: any) {
      result.testSuccess = false;
      result.testError = error.message || String(error);
    }

    return result;
  }

  /**
   * Sync modified files to all databases
   */
  private async syncDatabases(files: string[]): Promise<SyncResult> {
    const absoluteFiles = files.map(f =>
      path.isAbsolute(f) ? f : path.join(this.projectPath, f)
    );

    // Update PostgreSQL (semantic search)
    const dbResult = await this.databaseUpdateManager.updateMainDatabase(absoluteFiles);

    // Update Neo4j (knowledge graph)
    const graphResult = await this.databaseUpdateManager.updateGraphDatabase(absoluteFiles);

    // Update Redis (cache)
    const cacheResult = await this.databaseUpdateManager.updateRedisCache(absoluteFiles);

    return {
      filesUpdated: dbResult.recordsUpdated,
      graphNodesCreated: graphResult.nodesCreated,
      cacheUpdated: cacheResult.filesUpdated
    };
  }

  /**
   * Display context summary - shows what CodeMind found
   * Just prints the information directly without interactive prompts
   */
  private displayContextSummary(
    semanticResults: SemanticResult[],
    graphContext: GraphContext
  ): void {
    console.log('\n┌─ 🧠 CodeMind Context Details ─────────────────────────────┐');

    // Show relevant files with file:line format
    if (semanticResults.length > 0) {
      console.log('│ 📁 Relevant Files:');
      const topFiles = semanticResults.slice(0, 10);
      topFiles.forEach(r => {
        const similarity = (r.similarity * 100).toFixed(0);
        // Find corresponding class for line number
        const classInfo = graphContext.classes?.find(c =>
          c.filePath === r.file ||
          r.file.toLowerCase().includes(c.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase())
        );
        const startLine = (classInfo as any)?.metadata?.startLine || (classInfo as any)?.sourceLocation?.startLine;
        const location = startLine ? `${r.file}:${startLine}` : r.file;
        console.log(`│    • ${location} (${r.type}, ${similarity}%)`);
      });
      if (semanticResults.length > 10) {
        console.log(`│    ... +${semanticResults.length - 10} more files`);
      }
    }

    // Show classes found with file:line format
    if (graphContext.classes && graphContext.classes.length > 0) {
      console.log('│ 📦 Classes/Components:');
      const topClasses = graphContext.classes.slice(0, 6);
      topClasses.forEach(c => {
        const startLine = (c as any).metadata?.startLine || (c as any).sourceLocation?.startLine;
        const location = c.filePath
          ? ` [${c.filePath}${startLine ? `:${startLine}` : ''}]`
          : '';
        console.log(`│    • ${c.name}: ${c.type}${location}`);
      });
      if (graphContext.classes.length > 6) {
        console.log(`│    ... +${graphContext.classes.length - 6} more`);
      }
    }

    // Show relationships with method names and file:line context
    if (graphContext.relationships.length > 0) {
      console.log('│ 🔗 Relationships:');
      const topRels = graphContext.relationships.slice(0, 5);
      topRels.forEach(r => {
        // Format: ClassName.methodName() → TargetClass.targetMethod() [file:line]
        const fromDisplay = r.fromMethod
          ? `${r.from}.${r.fromMethod}()`
          : r.from;
        const toDisplay = r.toMethod
          ? `${r.to}.${r.toMethod}()`
          : r.to;

        // Include file:line if available
        const lineLoc = r.line ? `:${r.line}` : '';
        const fromLoc = r.fromPath
          ? ` [${r.fromPath}${lineLoc}]`
          : '';
        console.log(`│    • ${fromDisplay}${fromLoc} → ${toDisplay} (${r.type})`);
      });
      if (graphContext.relationships.length > 5) {
        console.log(`│    ... +${graphContext.relationships.length - 5} more`);
      }
    }

    console.log('└──────────────────────────────────────────────────────────┘\n');
  }

  /**
   * Check if input is suitable for the full workflow
   */
  shouldUseWorkflow(input: string): boolean {
    return this.nlpProcessor.isNaturalLanguageQuery(input);
  }

  /**
   * Get workflow statistics for monitoring
   */
  getWorkflowStats(result: WorkflowResult): {
    stepsCompleted: number;
    totalSteps: number;
    filesAnalyzed: number;
    relationshipsFound: number;
    assumptionsDetected: number;
    executionTime?: number;
  } {
    let stepsCompleted = 0;
    const totalSteps = 10;

    if (result.queryAnalysis) stepsCompleted++;
    if (result.semanticResults.length > 0) stepsCompleted += 2;
    if (result.graphContext.relationships.length >= 0) stepsCompleted++;
    if (result.enhancedContext) stepsCompleted++;
    if (result.claudeResponse) stepsCompleted++;
    if (result.buildResult) stepsCompleted++;
    if (result.syncResult) stepsCompleted++;
    if (result.success) stepsCompleted += 2;

    return {
      stepsCompleted,
      totalSteps,
      filesAnalyzed: result.semanticResults.length,
      relationshipsFound: result.graphContext.relationships.length,
      assumptionsDetected: result.queryAnalysis.assumptions.length
    };
  }

  /**
   * Display task preview at the beginning of the workflow
   * Shows users what CodeMind will do based on query analysis and decomposition
   */
  private displayTaskPreview(query: string, analysis: QueryAnalysis, decomposition: DecompositionResult): void {
    console.log('\n┌─ 📋 Task Preview ─────────────────────────────────────────┐');

    if (decomposition.isComplex && decomposition.subTasks.length > 1) {
      // Complex query with multiple sub-tasks
      console.log(`│ 📊 Complex request: ${decomposition.subTasks.length} tasks identified`);
      console.log(`│    Overall confidence: ${this.formatConfidenceLabel(analysis.confidence)}`);
      console.log(`│`);
      console.log(`│ 📝 Tasks to execute:`);

      for (const task of decomposition.subTasks) {
        const icon = this.getIntentIcon(task.type);
        const complexity = this.getComplexityBadge(task.estimatedComplexity);
        const desc = task.description.length > 50
          ? task.description.substring(0, 47) + '...'
          : task.description;
        console.log(`│    ${icon} ${task.id}. ${desc}`);
        console.log(`│       Type: ${task.type} | Complexity: ${complexity}`);

        // Show dependencies if any
        if (task.dependencies.length > 0) {
          console.log(`│       Depends on: Task ${task.dependencies.join(', Task ')}`);
        }
      }

      // Show execution phases
      if (decomposition.executionPlan.phases.length > 1) {
        console.log(`│`);
        console.log(`│ 🔄 Execution order: ${decomposition.executionPlan.phases.length} phases`);
        for (const phase of decomposition.executionPlan.phases) {
          console.log(`│    Phase ${phase.phaseNumber}: Tasks [${phase.taskIds.join(', ')}]`);
        }
      }
    } else {
      // Simple query - single task
      const intentIcon = this.getIntentIcon(analysis.intent);
      const intentLabel = this.formatIntentLabel(analysis.intent);
      const confidenceLabel = this.formatConfidenceLabel(analysis.confidence);

      console.log(`│ ${intentIcon} Action: ${intentLabel}`);
      console.log(`│    Confidence: ${confidenceLabel}`);

      // Show what CodeMind will do
      const taskDescription = this.generateTaskDescription(query, analysis);
      console.log(`│`);
      console.log(`│ 📝 What CodeMind will do:`);
      taskDescription.forEach(line => {
        console.log(`│    ${line}`);
      });
    }

    // Show files that will be targeted (if entities identified)
    if (analysis.targetEntities && analysis.targetEntities.length > 0) {
      console.log(`│`);
      console.log(`│ 🎯 Target areas: ${analysis.targetEntities.join(', ')}`);
    }

    console.log('└──────────────────────────────────────────────────────────┘\n');
  }

  /**
   * Get icon for intent type
   */
  private getIntentIcon(intent: string): string {
    const icons: Record<string, string> = {
      'create': '✨',
      'modify': '📝',
      'refactor': '🔄',
      'fix': '🔧',
      'analyze': '🔍',
      'explain': '💡',
      'test': '🧪',
      'document': '📚',
      'delete': '🗑️',
      'general': '📌'
    };
    return icons[intent] || '📌';
  }

  /**
   * Format intent as human-readable label
   */
  private formatIntentLabel(intent: string): string {
    const labels: Record<string, string> = {
      'create': 'CREATE new code',
      'modify': 'MODIFY existing code',
      'refactor': 'REFACTOR code structure',
      'fix': 'FIX/DEBUG issues',
      'analyze': 'ANALYZE codebase',
      'explain': 'EXPLAIN code behavior',
      'test': 'CREATE/RUN tests',
      'document': 'UPDATE documentation',
      'delete': 'REMOVE code',
      'general': 'PROCESS request'
    };
    return labels[intent] || intent.toUpperCase();
  }

  /**
   * Format confidence as visual indicator
   */
  private formatConfidenceLabel(confidence: number): string {
    const percentage = Math.round(confidence * 100);
    if (confidence >= 0.8) {
      return Theme.colors.success(`●●●●● ${percentage}% (High)`);
    } else if (confidence >= 0.6) {
      return Theme.colors.warning(`●●●○○ ${percentage}% (Medium)`);
    } else {
      return Theme.colors.error(`●●○○○ ${percentage}% (Low - may need clarification)`);
    }
  }

  /**
   * Generate human-readable task description based on analysis
   */
  private generateTaskDescription(query: string, analysis: QueryAnalysis): string[] {
    const steps: string[] = [];

    // First, what we'll search for
    steps.push('1. Search codebase for relevant files');

    // Then, based on intent
    switch (analysis.intent) {
      case 'create':
        steps.push('2. Identify similar patterns for reference');
        steps.push('3. Generate new code following existing conventions');
        break;
      case 'modify':
        steps.push('2. Identify files to modify');
        steps.push('3. Apply requested changes');
        break;
      case 'refactor':
        steps.push('2. Analyze current code structure');
        steps.push('3. Apply refactoring improvements');
        break;
      case 'fix':
        steps.push('2. Identify the source of the issue');
        steps.push('3. Apply fix and verify');
        break;
      case 'analyze':
        steps.push('2. Gather code metrics and patterns');
        steps.push('3. Generate analysis report');
        break;
      case 'explain':
        steps.push('2. Trace code flow and dependencies');
        steps.push('3. Provide detailed explanation');
        break;
      case 'test':
        steps.push('2. Identify testable components');
        steps.push('3. Generate/run tests');
        break;
      case 'document':
        steps.push('2. Extract documentation from code');
        steps.push('3. Generate/update documentation');
        break;
      default:
        steps.push('2. Analyze context and requirements');
        steps.push('3. Execute requested action');
    }

    // Add modification warning if needed
    if (analysis.requiresModifications) {
      steps.push('4. Request approval before making changes');
    }

    return steps;
  }

  /**
   * Log query analysis results from Claude-based analysis
   */
  private logQueryAnalysis(analysis: QueryAnalysis): void {
    // Show Claude's reasoning if available
    if (analysis.reasoning) {
      console.log(Theme.colors.muted(`   Reasoning: ${analysis.reasoning}`));
    }

    // Show if modifications are required
    if (analysis.requiresModifications !== undefined) {
      console.log(Theme.colors.muted(`   Requires modifications: ${analysis.requiresModifications ? 'Yes' : 'No'}`));
    }

    // Show detected assumptions
    if (analysis.assumptions.length > 0) {
      console.log(Theme.colors.warning(`   ⚠️  Assumptions detected: ${analysis.assumptions.length}`));
      analysis.assumptions.forEach(assumption => {
        console.log(Theme.colors.muted(`      • ${assumption}`));
      });
    }

    // Show detected ambiguities
    if (analysis.ambiguities.length > 0) {
      console.log(Theme.colors.warning(`   ❓ Ambiguities detected: ${analysis.ambiguities.length}`));
      analysis.ambiguities.forEach(ambiguity => {
        console.log(Theme.colors.muted(`      • ${ambiguity}`));
      });
    }

    // Show suggested clarifications
    if (analysis.suggestedClarifications && analysis.suggestedClarifications.length > 0) {
      console.log(Theme.colors.info(`   💡 Suggested clarifications:`));
      analysis.suggestedClarifications.forEach(clarification => {
        console.log(Theme.colors.muted(`      • ${clarification}`));
      });
    }

    // Show target entities
    if (analysis.targetEntities && analysis.targetEntities.length > 0) {
      console.log(Theme.colors.muted(`   🎯 Target entities: ${analysis.targetEntities.join(', ')}`));
    }
  }

  /**
   * Create empty graph context for error cases
   */
  private createEmptyGraphContext(): GraphContext {
    return {
      classes: [],
      relationships: [],
      relationshipDetails: [],
      packageStructure: [],
      graphInsights: {
        totalNodes: 0,
        totalRelationships: 0,
        architecturalPatterns: [],
        qualityMetrics: {
          coupling: 0,
          cohesion: 0,
          complexity: 0
        }
      }
    };
  }

  /**
   * Create empty enhanced context for error cases
   */
  private createEmptyEnhancedContext(query: string): EnhancedContext {
    return {
      originalQuery: query,
      clarifications: [],
      assumptions: [],
      relevantFiles: [],
      codeRelationships: [],
      packageStructure: [],
      enhancedPrompt: query
    };
  }

  /**
   * Apply context filter to semantic results
   */
  private applyContextFilter(results: SemanticResult[], filter: ContextFilter): SemanticResult[] {
    let filtered = [...results];

    // Filter by file patterns
    if (filter.filePatterns && filter.filePatterns.length > 0) {
      filtered = filtered.filter(r =>
        filter.filePatterns!.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
          return regex.test(r.file);
        })
      );
    }

    // Filter by file types
    if (filter.fileTypes && filter.fileTypes.length > 0) {
      filtered = filtered.filter(r =>
        filter.fileTypes!.some(type => r.type.toLowerCase().includes(type.toLowerCase()))
      );
    }

    // Apply max files limit
    if (filter.maxFiles && filtered.length > filter.maxFiles) {
      filtered = filtered.slice(0, filter.maxFiles);
    }

    // If filtering removed all results, return original (limited)
    if (filtered.length === 0 && results.length > 0) {
      return results.slice(0, filter.maxFiles || 10);
    }

    return filtered;
  }

  /**
   * Deduplicate semantic results by file path
   */
  private deduplicateSemanticResults(results: SemanticResult[]): SemanticResult[] {
    const seen = new Map<string, SemanticResult>();

    for (const result of results) {
      const existing = seen.get(result.file);
      // Keep the one with higher similarity
      if (!existing || result.similarity > existing.similarity) {
        seen.set(result.file, result);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Deduplicate classes by name
   */
  private deduplicateClasses(classes: GraphContext['classes']): GraphContext['classes'] {
    if (!classes) return [];

    const seen = new Map<string, typeof classes[0]>();

    for (const cls of classes) {
      if (!seen.has(cls.name)) {
        seen.set(cls.name, cls);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Deduplicate relationships
   */
  private deduplicateRelationships(relationships: GraphContext['relationships']): GraphContext['relationships'] {
    if (!relationships) return [];

    const seen = new Set<string>();
    const unique: typeof relationships = [];

    for (const rel of relationships) {
      const key = `${rel.from}-${rel.type}-${rel.to}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rel);
      }
    }

    return unique;
  }

  /**
   * Factory method for dependency injection
   */
  static create(projectPath?: string, projectId?: string): WorkflowOrchestrator {
    return new WorkflowOrchestrator(projectPath || process.cwd(), projectId);
  }

  /**
   * Validate that all required services are properly initialized
   */
  validateServices(): boolean {
    return !!(
      this.nlpProcessor &&
      this.searchOrchestrator &&
      this.graphAnalysisService &&
      this.contextBuilder &&
      this.userInteractionService
    );
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this._databaseUpdateManager) {
      await this._databaseUpdateManager.close();
    }
    if (this._dbConnections) {
      await this._dbConnections.closeAll();
    }
  }
}
