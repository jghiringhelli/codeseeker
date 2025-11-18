/**
 * Workflow Orchestrator Service
 * Single Responsibility: Coordinate the complete CodeMind workflow
 * Orchestrates the entire process from query analysis to Claude execution
 */

import { NaturalLanguageProcessor, QueryAnalysis } from './natural-language-processor';
import { SemanticSearchOrchestrator, SemanticResult } from './semantic-search-orchestrator';
import { GraphAnalysisService, GraphContext } from './graph-analysis-service';
import { ContextBuilder, EnhancedContext } from './context-builder';
import { UserInteractionService, ClaudeResponse } from './user-interaction-service';

export interface WorkflowResult {
  success: boolean;
  queryAnalysis: QueryAnalysis;
  semanticResults: SemanticResult[];
  graphContext: GraphContext;
  enhancedContext: EnhancedContext;
  claudeResponse?: ClaudeResponse;
  error?: string;
}

export interface WorkflowOptions {
  skipUserClarification?: boolean;
  skipFileConfirmation?: boolean;
  maxSemanticResults?: number;
  semanticThreshold?: number;
}

export class WorkflowOrchestrator {
  private _nlpProcessor?: NaturalLanguageProcessor;
  private _searchOrchestrator?: SemanticSearchOrchestrator;
  private _graphAnalysisService?: GraphAnalysisService;
  private _contextBuilder?: ContextBuilder;
  private _userInteractionService?: UserInteractionService;
  private projectPath: string;

  // Lazy initialization with singleton pattern for better performance
  private get nlpProcessor(): NaturalLanguageProcessor {
    if (!this._nlpProcessor) {
      this._nlpProcessor = new NaturalLanguageProcessor();
    }
    return this._nlpProcessor;
  }

  private get searchOrchestrator(): SemanticSearchOrchestrator {
    if (!this._searchOrchestrator) {
      this._searchOrchestrator = new SemanticSearchOrchestrator();
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
    }
    return this._userInteractionService;
  }

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    // Services now use lazy initialization for better performance
  }

  /**
   * Execute the complete CodeMind workflow
   */
  async executeWorkflow(
    query: string,
    projectPath: string,
    options: WorkflowOptions = {}
  ): Promise<WorkflowResult> {
    try {
      console.log('🧠 Starting CodeMind workflow...\n');

      // Step 1: Analyze the user query for assumptions and ambiguities
      console.log('1️⃣ Analyzing query for assumptions and ambiguities...');
      const queryAnalysis = this.nlpProcessor.analyzeQuery(query);
      this.logQueryAnalysis(queryAnalysis);

      // Step 2: Get user clarifications if needed
      let userClarifications: string[] = [];
      if (!options.skipUserClarification && (queryAnalysis.assumptions.length > 0 || queryAnalysis.ambiguities.length > 0)) {
        console.log('\n2️⃣ Requesting user clarifications...');
        userClarifications = await this.userInteractionService.promptForClarifications(queryAnalysis);
      } else {
        console.log('\n2️⃣ No clarifications needed');
      }

      // Step 3: Perform semantic search to find relevant files
      console.log('\n3️⃣ Performing semantic search...');
      const semanticResults = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
      console.log(`   Found ${semanticResults.length} relevant files`);

      // Step 4: Perform graph analysis to understand relationships
      console.log('\n4️⃣ Analyzing code relationships...');
      const graphContext = await this.graphAnalysisService.performGraphAnalysis(query, semanticResults);
      console.log(`   Found ${graphContext.relationships.length} relationships between components`);

      // Step 5: Build enhanced context for Claude
      console.log('\n5️⃣ Building enhanced context...');
      const enhancedContext = this.contextBuilder.buildEnhancedContext(
        query,
        queryAnalysis,
        userClarifications,
        semanticResults,
        graphContext
      );

      const contextStats = this.contextBuilder.getContextStats(enhancedContext);
      console.log(`   Enhanced prompt: ${contextStats.promptLength} characters`);

      // Step 6: Execute Claude Code with enhanced prompt
      console.log('\n6️⃣ Executing Claude Code...');
      const claudeResponse = await this.userInteractionService.executeClaudeCode(enhancedContext.enhancedPrompt);

      // Step 7: Show file modification confirmation
      if (!options.skipFileConfirmation && claudeResponse.filesToModify.length > 0) {
        console.log('\n7️⃣ Requesting file modification approval...');
        const confirmation = await this.userInteractionService.confirmFileModifications(claudeResponse.filesToModify);

        if (!confirmation.approved) {
          console.log('❌ File modifications cancelled by user');
          return {
            success: false,
            queryAnalysis,
            semanticResults,
            graphContext,
            enhancedContext,
            error: 'File modifications cancelled by user'
          };
        }

        if (confirmation.dontAskAgain) {
          console.log('✅ File modification approval disabled for this session');
        }
      }

      // Step 8: Display execution summary
      console.log('\n8️⃣ Displaying execution summary...');
      this.userInteractionService.displayExecutionSummary(claudeResponse.summary, contextStats);

      return {
        success: true,
        queryAnalysis,
        semanticResults,
        graphContext,
        enhancedContext,
        claudeResponse
      };

    } catch (error) {
      console.error('❌ Workflow execution failed:', error);

      return {
        success: false,
        queryAnalysis: this.nlpProcessor.analyzeQuery(query),
        semanticResults: [],
        graphContext: {
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
        },
        enhancedContext: {
          originalQuery: query,
          clarifications: [],
          assumptions: [],
          relevantFiles: [],
          codeRelationships: [],
          packageStructure: [],
          enhancedPrompt: query
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
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
    const totalSteps = 8;

    // Count completed steps based on result
    if (result.queryAnalysis) stepsCompleted++;
    if (result.semanticResults.length > 0) stepsCompleted += 2; // Search + clarification
    if (result.graphContext.relationships.length >= 0) stepsCompleted++;
    if (result.enhancedContext) stepsCompleted++;
    if (result.claudeResponse) stepsCompleted++;
    if (result.success) stepsCompleted += 2; // Confirmation + summary

    return {
      stepsCompleted,
      totalSteps,
      filesAnalyzed: result.semanticResults.length,
      relationshipsFound: result.graphContext.relationships.length,
      assumptionsDetected: result.queryAnalysis.assumptions.length
    };
  }

  /**
   * Log query analysis results
   */
  private logQueryAnalysis(analysis: QueryAnalysis): void {
    console.log(`   Intent: ${analysis.intent} (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`);

    if (analysis.assumptions.length > 0) {
      console.log(`   Assumptions detected: ${analysis.assumptions.length}`);
      analysis.assumptions.forEach(assumption => {
        console.log(`   • ${assumption}`);
      });
    }

    if (analysis.ambiguities.length > 0) {
      console.log(`   Ambiguities detected: ${analysis.ambiguities.length}`);
      analysis.ambiguities.forEach(ambiguity => {
        console.log(`   • ${ambiguity}`);
      });
    }

    if (analysis.assumptions.length === 0 && analysis.ambiguities.length === 0) {
      console.log('   No assumptions or ambiguities detected');
    }
  }

  /**
   * Create a factory method for dependency injection
   */
  static create(projectPath?: string): WorkflowOrchestrator {
    return new WorkflowOrchestrator(projectPath || process.cwd());
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
}