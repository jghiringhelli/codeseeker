/**
 * Workflow Orchestrator Service - TRANSPARENT MODE
 * Single Responsibility: Coordinate CodeSeeker workflow OR pass through to Claude transparently
 *
 * Workflow when DBs are UP:
 * 1. Semantic Search (find relevant files using embeddings)
 * 2. Graph Analysis (show relationships)
 * 3. Build Context & Execute Claude with enhanced context
 * 4. Quality Check (auto build/test)
 * 5. Database Sync
 *
 * When DBs are DOWN:
 * - Inform user that CodeSeeker is running in transparent mode
 * - Pass query directly to Claude (same as using `claude` directly)
 * - Only difference: quality checks at the end
 */

import { SemanticSearchOrchestrator, SemanticResult } from './semantic-search-orchestrator';
import { GraphAnalysisService, GraphContext } from './graph-analysis-service';
import { ContextBuilder, EnhancedContext } from './context-builder';
import { UserInteractionService, ClaudeResponse } from './user-interaction-service';
import { DatabaseUpdateManager } from '../../../shared/managers/database-update-manager';
import { getSearchQualityMetrics, SearchQualityMetrics } from './search-quality-metrics';
import { Theme } from '../../ui/theme';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { isUsingEmbeddedStorage, getStorageManager, StorageManager } from '../../../storage';

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
  transparentMode?: boolean;
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
  forceSearch?: boolean;  // When true, always enable search (for -c mode)
  isCommandMode?: boolean;  // When true, running in single command mode (-c flag)
}

export class WorkflowOrchestrator {
  private _searchOrchestrator?: SemanticSearchOrchestrator;
  private _graphAnalysisService?: GraphAnalysisService;
  private _contextBuilder?: ContextBuilder;
  private _userInteractionService?: UserInteractionService;
  private _databaseUpdateManager?: DatabaseUpdateManager;
  private _storageManager?: StorageManager;
  private _qualityMetrics: SearchQualityMetrics;
  private projectPath: string;
  private projectId: string;
  private _readlineInterface?: any;

  private get searchOrchestrator(): SemanticSearchOrchestrator {
    if (!this._searchOrchestrator) {
      this._searchOrchestrator = new SemanticSearchOrchestrator();
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

  private async getStorageManager(): Promise<StorageManager> {
    if (!this._storageManager) {
      this._storageManager = await getStorageManager();
    }
    return this._storageManager;
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
    this._qualityMetrics = getSearchQualityMetrics();
  }

  setReadlineInterface(rl: any): void {
    this._readlineInterface = rl;
    if (this._userInteractionService) {
      this._userInteractionService.setReadlineInterface(rl);
    }
  }

  /**
   * Set verbose mode (show full debug output: files, relationships, prompt)
   */
  setVerboseMode(enabled: boolean): void {
    if (this._userInteractionService) {
      this._userInteractionService.setVerboseMode(enabled);
    }
  }

  /**
   * Get the UserInteractionService for external access
   * Used by CommandRouter for search toggle management
   */
  getUserInteractionService(): UserInteractionService {
    return this.userInteractionService;
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
   * Convert similarity score (0-1) to star rating display
   * ★★★★★ = 90-100% (Excellent match)
   * ★★★★☆ = 75-89%  (Very good match)
   * ★★★☆☆ = 60-74%  (Good match)
   * ★★☆☆☆ = 45-59%  (Fair match)
   * ★☆☆☆☆ = 30-44%  (Weak match)
   * ☆☆☆☆☆ = 0-29%   (Poor match)
   */
  private getStarRating(score: number): string {
    const percentage = Math.max(0, Math.min(100, score * 100));

    if (percentage >= 90) return '★★★★★';
    if (percentage >= 75) return '★★★★☆';
    if (percentage >= 60) return '★★★☆☆';
    if (percentage >= 45) return '★★☆☆☆';
    if (percentage >= 30) return '★☆☆☆☆';
    return '☆☆☆☆☆';
  }

  /**
   * Check if storage is available for enhanced workflow
   * Uses the StorageManager to determine availability in both embedded and server modes
   */
  private async checkDatabaseAvailability(): Promise<{ postgres: boolean; redis: boolean; neo4j: boolean; embedded: boolean }> {
    try {
      const storageManager = await this.getStorageManager();
      const health = await storageManager.healthCheck();
      const status = storageManager.getStatus();

      // If using embedded mode, all storage is "embedded"
      if (status.mode === 'embedded') {
        return {
          postgres: false,
          redis: false,
          neo4j: false,
          embedded: health.healthy
        };
      }

      // Server mode: report individual component availability
      return {
        postgres: status.components.vectorStore === 'server',
        redis: status.components.cacheStore === 'server',
        neo4j: status.components.graphStore === 'server',
        embedded: false
      };
    } catch {
      // If storage manager fails, assume embedded is available (no external deps)
      return { postgres: false, redis: false, neo4j: false, embedded: true };
    }
  }

  /**
   * Execute the CodeSeeker workflow
   * - If DBs are available: enhanced workflow with semantic search + context
   * - If DBs are down: transparent mode - pass through to Claude directly
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

      // ==========================================
      // CHECK DATABASE AVAILABILITY
      // ==========================================
      const dbStatus = await this.checkDatabaseAvailability();
      const anyDbAvailable = dbStatus.embedded || dbStatus.postgres || dbStatus.redis || dbStatus.neo4j;

      if (!anyDbAvailable) {
        // TRANSPARENT MODE - DBs are down
        return await this.executeTransparentMode(query, projectPath, options);
      }

      // ==========================================
      // ENHANCED MODE - DBs are available
      // ==========================================
      return await this.executeEnhancedMode(query, projectPath, options);

    } catch (error) {
      console.error(Theme.colors.error('❌ Workflow failed'));
      return {
        success: false,
        queryAnalysis: this.createDefaultQueryAnalysis(),
        semanticResults: [],
        graphContext: this.createEmptyGraphContext(),
        enhancedContext: this.createEmptyEnhancedContext(query),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Transparent mode - pass query directly to Claude
   * Used when databases are unavailable
   */
  private async executeTransparentMode(
    query: string,
    projectPath: string,
    options: WorkflowOptions
  ): Promise<WorkflowResult> {
    console.log(Theme.colors.warning('\n📡 CodeSeeker Transparent Mode'));
    console.log(Theme.colors.muted('   Databases unavailable - passing query directly to Claude.'));
    console.log(Theme.colors.muted('   Tip: Using `claude` directly would give the same result.'));
    console.log(Theme.colors.muted('   CodeSeeker adds: quality checks (build/test) after execution.\n'));

    // Execute Claude directly without enhanced context
    console.log(Theme.colors.claudeCode('🤖 Claude is working...'));
    const claudeResponse = await this.userInteractionService.executeClaudeCode(query);

    // Quality check (the value-add of CodeSeeker even in transparent mode)
    let buildResult: BuildTestResult | undefined;
    if (!options.skipBuildTest && claudeResponse.filesToModify.length > 0) {
      buildResult = await this.runAutonomousQualityCheck(projectPath);
    }

    // Show summary
    this.showCompletionSummary(0, this.createEmptyGraphContext(), buildResult);

    return {
      success: true,
      queryAnalysis: this.createDefaultQueryAnalysis(),
      semanticResults: [],
      graphContext: this.createEmptyGraphContext(),
      enhancedContext: this.createEmptyEnhancedContext(query),
      claudeResponse,
      buildResult,
      transparentMode: true
    };
  }

  /**
   * Enhanced mode - full workflow with semantic search and context building
   * Used when databases are available
   */
  private async executeEnhancedMode(
    query: string,
    projectPath: string,
    options: WorkflowOptions
  ): Promise<WorkflowResult> {
    // ==========================================
    // STEP 1: Semantic Search (if enabled)
    // ==========================================
    let semanticResults: SemanticResult[] = [];

    // Check if search should be performed
    // forceSearch = true means always search (for -c mode)
    // Otherwise, check if user has enabled search via toggle
    const shouldSearch = options.forceSearch || this.userInteractionService.isSearchEnabled();

    if (shouldSearch) {
      console.log(Theme.colors.muted('⏳ Searching codebase...'));
      semanticResults = await this.searchOrchestrator.performSemanticSearch(query, projectPath);

      // Show compact results
      if (semanticResults.length > 0) {
        console.log(Theme.colors.success(`✓ Found ${semanticResults.length} relevant files`));
        // Check if verbose mode is enabled
        const isVerbose = this.userInteractionService.isVerboseMode();
        // Show top files with star ratings (more in verbose mode)
        const showCount = isVerbose ? 5 : 3;
        const topFiles = semanticResults.slice(0, showCount);
        topFiles.forEach(f => {
          const normalizedSimilarity = Math.min(1, f.similarity);
          const stars = this.getStarRating(normalizedSimilarity);
          const percentage = Math.round(normalizedSimilarity * 100);

          // In verbose mode, show debug breakdown of score sources
          if (isVerbose && f.debug) {
            const semanticPct = Math.round(f.debug.vectorScore * 100);
            const textNorm = Math.min(1, f.debug.textScore / 20); // Normalize BM25 (0-20+) to 0-1
            const textPct = Math.round(textNorm * 100);
            const pathMatch = f.debug.pathMatch ? '✓' : '✗';
            const debugInfo = Theme.colors.muted(` [sem:${semanticPct}% txt:${textPct}% path:${pathMatch}]`);
            console.log(Theme.colors.muted(`  → ${f.file}`) + Theme.colors.success(` ${stars} ${percentage}%`) + debugInfo);
          } else {
            console.log(Theme.colors.muted(`  → ${f.file}`) + Theme.colors.success(` ${stars}`));
          }
        });
        if (semanticResults.length > showCount) {
          console.log(Theme.colors.muted(`  ... +${semanticResults.length - showCount} more`));
        }
      } else {
        console.log(Theme.colors.muted('  No specific file matches (will use general context)'));
      }
    } else {
      console.log(Theme.colors.muted('🔍 Search: OFF (sending directly to Claude)'));
    }

    // ==========================================
    // STEP 2: Graph Analysis (only if results found)
    // ==========================================
    let graphContext = this.createEmptyGraphContext();
    if (semanticResults.length > 0) {
      const graphResult = await this.graphAnalysisService.performGraphAnalysis(query, semanticResults);
      if (graphResult.relationships.length > 0 || (graphResult.classes && graphResult.classes.length > 0)) {
        graphContext = graphResult;
        // Show compact relationship info with type breakdown
        const classes = graphResult.classes || [];
        const relCount = graphResult.relationships.length;
        if (classes.length > 0 || relCount > 0) {
          // Count components by type
          const typeCounts = new Map<string, number>();
          for (const c of classes) {
            const type = c.type?.toLowerCase() || 'unknown';
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
          }

          // Build type breakdown string (e.g., "24 classes, 12 functions")
          const typeBreakdown = Array.from(typeCounts.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
            .join(', ');

          const componentSummary = typeBreakdown || `${classes.length} components`;
          console.log(Theme.colors.success(`✓ Found ${componentSummary}, ${relCount} relationships`));
        }
      }
    }

    // ==========================================
    // STEP 3: Build Context & Execute Claude
    // ==========================================
    console.log(Theme.colors.muted('⏳ Building context...'));
    const queryAnalysis = this.createDefaultQueryAnalysis();
    const enhancedContext = this.contextBuilder.buildEnhancedContext(
      query,
      queryAnalysis,
      [],
      semanticResults,
      graphContext
    );

    // Start search quality tracking session if we performed a search
    if (semanticResults.length > 0) {
      const suggestedFiles = semanticResults.map(r => r.file);
      this._qualityMetrics.startSession(query, suggestedFiles);
    }

    // Execute Claude with enhanced context
    console.log(Theme.colors.claudeCode('\n🤖 Claude is working...'));
    let claudeResponse = await this.userInteractionService.executeClaudeCode(
      enhancedContext.enhancedPrompt || query
    );

    // Check if user wants to run a different command (keep same context)
    while (claudeResponse.summary.startsWith('new_command:')) {
      const newCommand = claudeResponse.summary.substring('new_command:'.length);
      console.log(Theme.colors.claudeCode('\n🤖 Processing new command...'));
      claudeResponse = await this.userInteractionService.executeClaudeCode(newCommand);
    }

    // Record Claude's file usage for quality metrics
    // Note: filesToModify is used as a proxy since we don't track reads directly
    if (semanticResults.length > 0 && claudeResponse.filesToModify.length > 0) {
      this._qualityMetrics.recordClaudeModifications(claudeResponse.filesToModify);
    }

    // ==========================================
    // STEP 4: Quality Check (auto build/test if files changed)
    // ==========================================
    let buildResult: BuildTestResult | undefined;
    if (!options.skipBuildTest && claudeResponse.filesToModify.length > 0) {
      buildResult = await this.runAutonomousQualityCheck(projectPath);
    }

    // ==========================================
    // STEP 5: Database Sync (silent)
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
      syncResult,
      transparentMode: false
    };
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

    // Show search quality metrics in verbose mode
    const isVerbose = this.userInteractionService.isVerboseMode();
    if (isVerbose && filesFound > 0) {
      const sessionMetrics = this._qualityMetrics.getLatestSessionMetrics();
      if (sessionMetrics) {
        console.log(Theme.colors.muted('\n' + this._qualityMetrics.formatMetricsForDisplay(sessionMetrics, true)));
      }
    }

    console.log('');
  }

  /**
   * Create default query analysis (no longer using Claude for intent detection)
   */
  private createDefaultQueryAnalysis(): QueryAnalysis {
    return {
      assumptions: [],
      ambiguities: [],
      intent: 'general',
      confidence: 1.0,
      reasoning: 'Direct execution without intent analysis',
      requiresModifications: true,
      targetEntities: []
    };
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
   * Check if workflow should be used (natural language vs command)
   * This is simple command routing, NOT intent detection
   */
  shouldUseWorkflow(input: string): boolean {
    const trimmed = input.trim();

    // Empty or very short inputs are not natural language
    if (trimmed.length <= 2) {
      return false;
    }

    // Known single-word commands
    const knownCommands = new Set([
      'help', 'exit', 'quit', 'status', 'setup', 'init', 'project', 'sync',
      'search', 'analyze', 'dedup', 'solid', 'docs', 'instructions', 'watch', 'watcher', 'history', 'synonyms'
    ]);

    // Known subcommands for each command (to recognize "project duplicates", "project cleanup", etc.)
    const knownSubcommands: Record<string, Set<string>> = {
      'project': new Set(['list', 'ls', 'cleanup', 'clean', 'duplicates', 'dups', 'info', 'id', 'help']),
      'search': new Set(['semantic', 'files', 'code', 'help']),
      'analyze': new Set(['solid', 'dedup', 'quality', 'help']),
      'sync': new Set(['full', 'incremental', 'status', 'help']),
      'docs': new Set(['generate', 'update', 'help']),
      'init': new Set(['reset', 'force', 'help']),
      'synonyms': new Set(['list', 'add', 'remove', 'import-defaults', 'clear', 'help'])
    };

    const words = trimmed.split(/\s+/);
    const firstWord = words[0].toLowerCase();
    const secondWord = words.length > 1 ? words[1].toLowerCase() : '';

    // Single word that matches a known command = command
    if (words.length === 1 && knownCommands.has(firstWord)) {
      return false;
    }

    // If first word is a known command...
    if (knownCommands.has(firstWord)) {
      // Check if second word is a known subcommand for this command
      const commandSubcommands = knownSubcommands[firstWord];
      if (commandSubcommands && commandSubcommands.has(secondWord)) {
        return false;  // This is a command with a valid subcommand
      }

      // Check if all remaining words look like command arguments
      // Arguments are: flags (--flag, -f), paths, short words
      const allArgsLookLikeCommandArgs = words.slice(1).every(word => {
        // Flags like --reset, -v, --new-config
        if (word.startsWith('-')) return true;
        // File paths (contains / or \)
        if (word.includes('/') || word.includes('\\') || word.includes('.')) return true;
        // Short argument (less than 8 chars and no spaces)
        if (word.length < 8) return true;
        return false;
      });

      if (allArgsLookLikeCommandArgs) {
        return false;
      }
    }

    // Multi-word = natural language
    return true;
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
    if (this._storageManager) {
      await this._storageManager.closeAll();
    }
  }

  /**
   * Factory method
   */
  static create(projectPath?: string, projectId?: string): WorkflowOrchestrator {
    return new WorkflowOrchestrator(projectPath || process.cwd(), projectId);
  }
}
