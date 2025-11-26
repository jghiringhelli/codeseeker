/**
 * CodeMind Workflow Orchestrator - SOLID Architecture
 * SOLID Principles: Single Responsibility - Coordinate workflow execution only
 *
 * This is the main orchestrator that coordinates all workflow services
 * to execute complete feature requests from users.
 */

import { Logger } from '../../shared/logger';
import { IntentAnalysisService } from './services/intent-analysis-service';
import { ContextGatheringService } from './services/context-gathering-service';
import { GitWorkflowService } from './services/git-workflow-service';
import { TaskOrchestrationService } from './services/task-orchestration-service';
import { QualityAssuranceService } from './services/quality-assurance-service';
import { DatabaseSyncService } from './services/database-sync-service';
import {
  IWorkflowOrchestrator,
  IIntentAnalysisService,
  IContextGatheringService,
  IGitWorkflowService,
  ITaskOrchestrationService,
  IQualityAssuranceService,
  IDatabaseSyncService,
  UserFeatureRequest,
  WorkflowResult
} from './interfaces/index';

export class CodeMindWorkflowOrchestrator implements IWorkflowOrchestrator {
  private logger = Logger.getInstance();
  private projectId: string;

  constructor(
    projectId: string,
    private intentAnalysisService?: IIntentAnalysisService,
    private contextGatheringService?: IContextGatheringService,
    private gitWorkflowService?: IGitWorkflowService,
    private taskOrchestrationService?: ITaskOrchestrationService,
    private qualityAssuranceService?: IQualityAssuranceService,
    private databaseSyncService?: IDatabaseSyncService
  ) {
    this.projectId = projectId;

    // Initialize services with dependency injection
    this.intentAnalysisService = intentAnalysisService || new IntentAnalysisService();
    this.contextGatheringService = contextGatheringService || new ContextGatheringService();
    this.gitWorkflowService = gitWorkflowService || new GitWorkflowService();
    this.taskOrchestrationService = taskOrchestrationService || new TaskOrchestrationService();
    this.qualityAssuranceService = qualityAssuranceService || new QualityAssuranceService();
    this.databaseSyncService = databaseSyncService || new DatabaseSyncService();
  }

  /**
   * MAIN WORKFLOW: Execute complete feature request workflow
   * This is the single entry point that orchestrates everything using SOLID principles
   */
  async executeFeatureRequest(request: UserFeatureRequest): Promise<WorkflowResult> {
    const workflowId = `workflow_${Date.now()}`;
    this.logger.info(`🎯 Starting CodeMind workflow: ${workflowId}`);
    this.logger.info(`Request: "${request.query}"`);

    try {
      // STEP 1: Analyze user intent and select appropriate tools
      const intent = await this.intentAnalysisService!.analyzeIntentAndSelectTools(request);
      this.logger.info(`Intent: ${intent.intention} (${intent.complexity} complexity, ${intent.suggestedTools.length} tools)`);

      // STEP 2: Execute semantic search + graph traversal for complete context
      const context = await this.contextGatheringService!.gatherSemanticContext(request.query, intent);
      this.logger.info(`Context: ${context.totalFiles} files (${Math.round(context.contextSize / 1000)}KB)`);

      // STEP 3: Create git branch for safe development
      const gitBranch = await this.gitWorkflowService!.createFeatureBranch(workflowId, request.query);
      this.logger.info(`Git branch: ${gitBranch}`);

      // STEP 4: Split request into manageable sub-tasks
      const subTasks = await this.taskOrchestrationService!.splitIntoSubTasks(request, intent, context);
      this.logger.info(`Sub-tasks: ${subTasks.length} tasks identified`);

      // STEP 5: Process each sub-task with Claude + focused context
      const subTaskResults = await this.taskOrchestrationService!.processAllSubTasks(subTasks, context);
      this.logger.info(`Sub-tasks completed: ${subTaskResults.filter(r => r.success).length}/${subTasks.length} successful`);

      // STEP 6: Run comprehensive quality checks (skip for report requests)
      let qualityResult;
      if (intent.intention === 'report') {
        this.logger.info('📋 Skipping quality checks for report request');
        qualityResult = this.createSkippedQualityResult();
      } else {
        qualityResult = await this.qualityAssuranceService!.runQualityChecks(subTaskResults);
        this.logger.info(`Quality score: ${qualityResult.overallScore}% (${qualityResult.compilation.success ? 'compiles' : 'compilation errors'})`);
      }

      // STEP 7: If quality checks pass, commit and merge; otherwise rollback
      const finalResult = await this.gitWorkflowService!.finalizeChanges(
        gitBranch,
        qualityResult,
        subTaskResults,
        intent.intention === 'report'
      );

      // STEP 8: Update all databases with changes made
      const databaseUpdates = await this.databaseSyncService!.updateAllDatabases(finalResult.filesModified, context);
      finalResult.databases = databaseUpdates;

      this.logger.info(`✅ Workflow complete: ${finalResult.success ? 'SUCCESS' : 'FAILED'}`);
      return finalResult;

    } catch (error) {
      this.logger.error(`❌ Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Rollback any changes made
      try {
        await this.gitWorkflowService!.rollbackChanges(workflowId);
      } catch (rollbackError) {
        this.logger.error('Rollback also failed:', rollbackError);
      }

      throw error;
    }
  }

  /**
   * Execute a lightweight analysis workflow (no code changes)
   */
  async executeAnalysisWorkflow(request: UserFeatureRequest): Promise<{
    intent: any;
    context: any;
    analysis: string;
    recommendations: string[];
  }> {
    this.logger.info('🔍 Starting analysis-only workflow...');

    try {
      // Analyze intent
      const intent = await this.intentAnalysisService!.analyzeIntentAndSelectTools({
        ...request,
        query: request.query + ' (analysis only)'
      });

      // Gather context
      const context = await this.contextGatheringService!.gatherSemanticContext(request.query, intent);

      // Generate analysis report
      const analysis = this.generateAnalysisReport(intent, context);

      // Generate recommendations
      const recommendations = this.generateRecommendations(intent, context);

      this.logger.info('✅ Analysis workflow complete');

      return {
        intent,
        context,
        analysis,
        recommendations
      };
    } catch (error) {
      this.logger.error('Analysis workflow failed:', error);
      throw error;
    }
  }

  /**
   * Get workflow status and health information
   */
  async getWorkflowHealth(): Promise<{
    services: Record<string, boolean>;
    databases: Record<string, boolean>;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      // Check database connections
      const databaseHealth = await this.databaseSyncService!.validateDatabaseConnections();

      // Check git status
      const gitStatus = await this.gitWorkflowService!.getBranchStatus();

      const services = {
        intentAnalysis: true, // These are lightweight services
        contextGathering: true,
        gitWorkflow: !gitStatus.hasUncommittedChanges,
        taskOrchestration: true,
        qualityAssurance: true,
        databaseSync: Object.values(databaseHealth).some(healthy => healthy)
      };

      const healthyServices = Object.values(services).filter(Boolean).length;
      const healthyDatabases = Object.values(databaseHealth).filter(Boolean).length;

      let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (healthyServices < 4 || healthyDatabases === 0) {
        overall = 'unhealthy';
      } else if (healthyServices < 6 || healthyDatabases < 2) {
        overall = 'degraded';
      }

      return {
        services,
        databases: databaseHealth,
        overall
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);

      return {
        services: {},
        databases: {},
        overall: 'unhealthy'
      };
    }
  }

  // Private helper methods
  private createSkippedQualityResult(): any {
    return {
      overallScore: 100,
      issues: [],
      compilation: { success: true, errors: [] },
      tests: { passed: 100, failed: 0, coverage: 100 },
      codeQuality: { solidPrinciples: true, security: true, architecture: true },
      analysisDetails: {
        linting: { penalty: 0, issues: [] },
        security: { penalty: 0, issues: [] },
        dependencies: { penalty: 0, issues: [] },
        complexity: { penalty: 0, issues: [] },
        testing: { penalty: 0, issues: [], results: {} },
        taskExecution: { penalty: 0, issues: [] }
      }
    };
  }

  private generateAnalysisReport(intent: any, context: any): string {
    const contextSummary = this.contextGatheringService!.formatContextForClaude(context);

    return [
      '# CodeMind Analysis Report',
      '',
      `## Request Analysis`,
      `- **Intent**: ${intent.intention}`,
      `- **Complexity**: ${intent.complexity}`,
      `- **Confidence**: ${Math.round(intent.confidence * 100)}%`,
      `- **Risk Level**: ${intent.riskLevel}`,
      `- **Time Estimate**: ${intent.timeEstimate} minutes`,
      '',
      `## Project Context`,
      contextSummary,
      '',
      `## Suggested Tools`,
      ...intent.suggestedTools.map((tool: string) => `- ${tool}`),
      '',
      `## Primary Domains`,
      ...intent.primaryDomains.map((domain: string) => `- ${domain}`),
    ].join('\n');
  }

  private generateRecommendations(intent: any, context: any): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (intent.riskLevel === 'high') {
      recommendations.push('Consider creating a backup branch before implementing changes');
      recommendations.push('Run comprehensive tests after implementation');
    }

    // Complexity-based recommendations
    if (intent.complexity === 'complex') {
      recommendations.push('Break down the task into smaller, manageable subtasks');
      recommendations.push('Consider implementing in phases');
    }

    // Context-based recommendations
    if (context.totalFiles > 10) {
      recommendations.push('Large number of relevant files - ensure thorough testing');
    }

    // Intent-specific recommendations
    if (intent.intention.includes('refactor')) {
      recommendations.push('Ensure all tests pass before and after refactoring');
      recommendations.push('Consider SOLID principles during refactoring');
    }

    if (intent.intention.includes('security')) {
      recommendations.push('Run security analysis after implementation');
      recommendations.push('Review changes with security team');
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push('Review changes carefully before merging');
      recommendations.push('Ensure proper documentation is updated');
    }

    return recommendations;
  }
}

// Export factory function for easy instantiation
export function createWorkflowOrchestrator(projectId: string): CodeMindWorkflowOrchestrator {
  return new CodeMindWorkflowOrchestrator(projectId);
}

// Export for backward compatibility
export { CodeMindWorkflowOrchestrator as default };