/**
 * Workflow Orchestrator Service - STREAMLINED MVP
 * Single Responsibility: Coordinate the CodeMind Core Cycle with minimal friction
 *
 * Simplified workflow:
 * 1. Query Analysis (ONE Claude call for intent + complexity + clarification check)
 * 2. Semantic Search (find relevant files)
 * 3. Graph Analysis (show relationships if found)
 * 4. Build Context & Execute Claude
 * 5. Apply Changes (with user approval)
 * 6. Quality Check (auto build/test)
 * 7. Database Sync (silent)
 */

import { UnifiedQueryAnalyzer, UnifiedAnalysis } from './unified-query-analyzer';
import { SemanticSearchOrchestrator, SemanticResult } from './semantic-search-orchestrator';
import { GraphAnalysisService, GraphContext } from './graph-analysis-service';
import { ContextBuilder, EnhancedContext } from './context-builder';
import { UserInteractionService, ClaudeResponse } from './user-interaction-service';
import { DatabaseUpdateManager } from '../../../shared/managers/database-update-manager';
import { DatabaseConnections } from '../../../config/database-config';
import { Theme } from '../../ui/theme';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import inquirer from 'inquirer';
import { Logger } from '../../../utils/logger';

const execAsync = promisify(exec);

// Legacy interface for backwards compatibility
export interface QueryAnalysis {
  assumptions: string[];
  ambiguities: string[];
  intent: string;
  confidence: number;
  reasoning?: string;
  requiresModifications?: boolean;
  suggestedClarifications?: string[];
  targetEntities?: string[];
}

export interface WorkflowResult {
  success: boolean;
  queryAnalysis: QueryAnalysis;
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
  skipBuildTest?: boolean;
  skipDatabaseSync?: boolean;
  maxSemanticResults?: number;
  projectId?: string;
  transparentMode?: boolean;
}

export class WorkflowOrchestrator {
  private _unifiedAnalyzer?: UnifiedQueryAnalyzer;
  private _searchOrchestrator?: SemanticSearchOrchestrator;
  private _graphAnalysisService?: GraphAnalysisService;
  private _contextBuilder?: ContextBuilder;
  private _userInteractionService?: UserInteractionService;
  private _databaseUpdateManager?: DatabaseUpdateManager;
  private _dbConnections?: DatabaseConnections;
  private projectPath: string;
  private projectId: string;
  private _readlineInterface?: any;

  // Lazy initialization
  private get unifiedAnalyzer(): UnifiedQueryAnalyzer {
    if (!this._unifiedAnalyzer) {
      this._unifiedAnalyzer = UnifiedQueryAnalyzer.getInstance();
    }
    return this._unifiedAnalyzer;
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

  setReadlineInterface(rl: any): void {
    this._readlineInterface = rl;
    if (this._userInteractionService) {
      this._userInteractionService.setReadlineInterface(rl);
    }
  }

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
   * Execute the streamlined CodeMind workflow
   */
  async executeWorkflow(
    query: string,
    projectPath: string,
    options: WorkflowOptions = {}
  ): Promise<WorkflowResult> {
    try {
      if (projectPath !== this.projectPath) {
        this.projectPath = projectPath;
      }
      if (options.projectId) {
        this.projectId = options.projectId;
      }

      const isTransparentMode = options.transparentMode === true;

      // ==========================================
      // STEP 1: Unified Query Analysis (ONE Claude call)
      // ==========================================
      console.log(Theme.colors.muted('⏳ Analyzing query...'));
      const analysisResult = await this.unifiedAnalyzer.analyzeQuery(query);
      const analysis = analysisResult.analysis;

      // Show minimal analysis result
      const intentIcon = this.getIntentIcon(analysis.intent);
      console.log(Theme.colors.primary(`${intentIcon} ${analysis.intent.toUpperCase()}`) +
        Theme.colors.muted(` (${Math.round(analysis.confidence * 100)}% confidence)`));

      // Handle clarification if Claude says it's critical
      let finalQuery = query;
      if (analysis.clarificationNeeded && analysis.clarificationQuestion && !isTransparentMode) {
        const answer = await this.askClarification(analysis.clarificationQuestion);
        if (answer) {
          finalQuery = `${query}\n\nClarification: ${answer}`;
        }
      }

      // Convert to legacy QueryAnalysis format
      const queryAnalysis = this.toLegacyAnalysis(analysis);

      // ==========================================
      // STEP 2: Semantic Search
      // ==========================================
      console.log(Theme.colors.muted('⏳ Searching codebase...'));
      const semanticResults = await this.searchOrchestrator.performSemanticSearch(
        analysis.searchTerms.length > 0 ? analysis.searchTerms.join(' ') : finalQuery,
        projectPath
      );

      // Show compact results
      if (semanticResults.length > 0) {
        console.log(Theme.colors.success(`✓ Found ${semanticResults.length} relevant files`));
        // Show top 3 files inline
        const topFiles = semanticResults.slice(0, 3);
        topFiles.forEach(f => {
          const match = Math.round(f.similarity * 100);
          console.log(Theme.colors.muted(`  → ${f.file}`) + Theme.colors.success(` (${match}%)`));
        });
        if (semanticResults.length > 3) {
          console.log(Theme.colors.muted(`  ... +${semanticResults.length - 3} more`));
        }
      } else {
        console.log(Theme.colors.muted('  No specific file matches (will use general context)'));
      }

      // ==========================================
      // STEP 3: Graph Analysis (only show if results found)
      // ==========================================
      let graphContext = this.createEmptyGraphContext();
      if (semanticResults.length > 0) {
        const graphResult = await this.graphAnalysisService.performGraphAnalysis(finalQuery, semanticResults);
        if (graphResult.relationships.length > 0 || (graphResult.classes && graphResult.classes.length > 0)) {
          graphContext = graphResult;
          // Show compact relationship info
          const classCount = graphResult.classes?.length || 0;
          const relCount = graphResult.relationships.length;
          if (classCount > 0 || relCount > 0) {
            console.log(Theme.colors.success(`✓ Found ${classCount} components, ${relCount} relationships`));
          }
        }
      }

      // ==========================================
      // STEP 4: Build Context & Execute Claude
      // ==========================================
      console.log(Theme.colors.muted('⏳ Building context...'));
      const enhancedContext = this.contextBuilder.buildEnhancedContext(
        finalQuery,
        queryAnalysis,
        [],
        semanticResults,
        graphContext
      );

      // Execute Claude with enhanced context
      console.log(Theme.colors.claudeCode('\n🤖 Claude is working...'));
      const claudeResponse = await this.userInteractionService.executeClaudeCode(
        semanticResults.length > 0 ? enhancedContext.enhancedPrompt : finalQuery
      );

      // ==========================================
      // STEP 5: Quality Check (auto build/test if files changed)
      // ==========================================
      let buildResult: BuildTestResult | undefined;
      if (!options.skipBuildTest && claudeResponse.filesToModify.length > 0 && !isTransparentMode) {
        buildResult = await this.runAutonomousQualityCheck(projectPath);
      }

      // ==========================================
      // STEP 6: Database Sync (silent)
      // ==========================================
      let syncResult: SyncResult | undefined;
      if (!options.skipDatabaseSync && claudeResponse.filesToModify.length > 0) {
        syncResult = await this.syncDatabases(claudeResponse.filesToModify);
      }

      // Final summary
      this.showCompletionSummary(semanticResults.length, graphContext, buildResult);

      return {
        success: true,
        queryAnalysis,
        semanticResults,
        graphContext,
        enhancedContext,
        claudeResponse,
        buildResult,
        syncResult
      };

    } catch (error) {
      console.error(Theme.colors.error('❌ Workflow failed'));
      return {
        success: false,
        queryAnalysis: { assumptions: [], ambiguities: [], intent: 'general', confidence: 0.5 },
        semanticResults: [],
        graphContext: this.createEmptyGraphContext(),
        enhancedContext: this.createEmptyEnhancedContext(query),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Ask a clarification question (only when Claude says it's critical)
   */
  private async askClarification(question: string): Promise<string | undefined> {
    if (this._readlineInterface) {
      this._readlineInterface.pause();
    }
    Logger.mute();

    try {
      console.log(Theme.colors.warning('\n❓ Clarification needed:'));
      const answer = await inquirer.prompt([{
        type: 'input',
        name: 'response',
        message: question,
        validate: (input) => input.trim().length > 0 || 'Please provide an answer (or press Ctrl+C to skip)'
      }]);
      return answer.response;
    } catch (error: any) {
      if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
        console.log(Theme.colors.muted('  Skipped - proceeding with best guess'));
        return undefined;
      }
      throw error;
    } finally {
      Logger.unmute();
      if (this._readlineInterface) {
        this._readlineInterface.resume();
      }
    }
  }

  /**
   * Run autonomous quality check - build and test without prompts
   */
  private async runAutonomousQualityCheck(projectPath: string): Promise<BuildTestResult> {
    const result: BuildTestResult = { buildSuccess: true, testSuccess: true };

    // Auto-run build
    console.log(Theme.colors.muted('\n⏳ Running build...'));
    let buildOnlyResult = await this.runBuild(projectPath);
    result.buildSuccess = buildOnlyResult.success;
    result.buildOutput = buildOnlyResult.output;
    result.buildError = buildOnlyResult.error;

    if (result.buildSuccess) {
      console.log(Theme.colors.success('✓ Build passed'));
    } else {
      console.log(Theme.colors.error('✗ Build failed - auto-fixing...'));
      const fixPrompt = `Fix the build error:\n${result.buildError?.substring(0, 2000)}`;
      await this.userInteractionService.executeDirectFixCommand(fixPrompt, 'build');

      // Retry build
      buildOnlyResult = await this.runBuild(projectPath);
      result.buildSuccess = buildOnlyResult.success;
      console.log(result.buildSuccess ?
        Theme.colors.success('✓ Build fixed') :
        Theme.colors.warning('⚠️ Build still failing'));
    }

    // Auto-run tests (only if build passed)
    if (result.buildSuccess) {
      console.log(Theme.colors.muted('⏳ Running tests...'));
      let testOnlyResult = await this.runTests(projectPath);
      result.testSuccess = testOnlyResult.success;
      result.testOutput = testOnlyResult.output;
      result.testError = testOnlyResult.error;

      if (result.testSuccess) {
        console.log(Theme.colors.success('✓ Tests passed'));
      } else {
        console.log(Theme.colors.error('✗ Tests failed - auto-fixing...'));
        const fixPrompt = `Fix the failing tests:\n${result.testError?.substring(0, 2000)}`;
        await this.userInteractionService.executeDirectFixCommand(fixPrompt, 'test');

        // Retry tests
        testOnlyResult = await this.runTests(projectPath);
        result.testSuccess = testOnlyResult.success;
        console.log(result.testSuccess ?
          Theme.colors.success('✓ Tests fixed') :
          Theme.colors.warning('⚠️ Some tests still failing'));
      }
    }

    return result;
  }

  /**
   * Show minimal completion summary
   */
  private showCompletionSummary(
    filesFound: number,
    graphContext: GraphContext,
    buildResult?: BuildTestResult
  ): void {
    const parts: string[] = [];

    if (filesFound > 0) {
      parts.push(`${filesFound} files analyzed`);
    }

    const relCount = graphContext.relationships?.length || 0;
    if (relCount > 0) {
      parts.push(`${relCount} relationships`);
    }

    if (buildResult) {
      if (buildResult.buildSuccess && buildResult.testSuccess) {
        parts.push('build ✓ tests ✓');
      } else if (buildResult.buildSuccess) {
        parts.push('build ✓');
      }
    }

    if (parts.length > 0) {
      console.log(Theme.colors.muted(`\n📊 ${parts.join(' | ')}`));
    }
    console.log('');
  }

  /**
   * Convert UnifiedAnalysis to legacy QueryAnalysis format
   */
  private toLegacyAnalysis(analysis: UnifiedAnalysis): QueryAnalysis {
    return {
      assumptions: [],
      ambiguities: analysis.clarificationNeeded && analysis.clarificationQuestion
        ? [analysis.clarificationQuestion]
        : [],
      intent: analysis.intent,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      requiresModifications: ['create', 'modify', 'fix', 'delete'].includes(analysis.intent),
      targetEntities: analysis.targetEntities
    };
  }

  /**
   * Get icon for intent
   */
  private getIntentIcon(intent: string): string {
    const icons: Record<string, string> = {
      'create': '✨', 'modify': '📝', 'fix': '🔧', 'delete': '🗑️',
      'understand': '💡', 'analyze': '🔍', 'search': '🔎', 'general': '📌'
    };
    return icons[intent] || '📌';
  }

  /**
   * Run build
   */
  private async runBuild(projectPath: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: projectPath,
        timeout: 120000
      });
      return { success: true, output: stdout + (stderr ? '\n' + stderr : '') };
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Run tests
   */
  private async runTests(projectPath: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('npm test', {
        cwd: projectPath,
        timeout: 180000
      });
      return { success: true, output: stdout + (stderr ? '\n' + stderr : '') };
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Sync databases
   */
  private async syncDatabases(files: string[]): Promise<SyncResult> {
    const absoluteFiles = files.map(f =>
      path.isAbsolute(f) ? f : path.join(this.projectPath, f)
    );

    const dbResult = await this.databaseUpdateManager.updateMainDatabase(absoluteFiles);
    const graphResult = await this.databaseUpdateManager.updateGraphDatabase(absoluteFiles);
    const cacheResult = await this.databaseUpdateManager.updateRedisCache(absoluteFiles);

    return {
      filesUpdated: dbResult.recordsUpdated,
      graphNodesCreated: graphResult.nodesCreated,
      cacheUpdated: cacheResult.filesUpdated
    };
  }

  /**
   * Check if workflow should be used
   */
  shouldUseWorkflow(input: string): boolean {
    return this.unifiedAnalyzer.isNaturalLanguageQuery(input);
  }

  /**
   * Create empty graph context
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
        qualityMetrics: { coupling: 0, cohesion: 0, complexity: 0 }
      }
    };
  }

  /**
   * Create empty enhanced context
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

  /**
   * Factory method
   */
  static create(projectPath?: string, projectId?: string): WorkflowOrchestrator {
    return new WorkflowOrchestrator(projectPath || process.cwd(), projectId);
  }
}
