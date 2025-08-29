import * as cron from 'node-cron';
import { SelfImprovementEngine, SelfImprovementReport } from './self-improvement-engine';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Self-Improvement Scheduler
 * 
 * Runs self-improvement analysis on a schedule as per Phase 2 requirements:
 * "As we build Phase 2, we'll use our own features to improve the system"
 */
export class SelfImprovementScheduler extends EventEmitter {
  private logger = Logger?.getInstance();
  private engine: SelfImprovementEngine;
  private scheduledTasks: cron.ScheduledTask[] = [];
  
  constructor(projectPath?: string) {
    super();
    this.engine = new SelfImprovementEngine(projectPath);
    
    // Set up event forwarding
    this.engine?.on('self-improvement:completed', (report) => {
      this?.emit('improvement:completed', report);
    });
    
    this.engine?.on('self-improvement:failed', (error) => {
      this?.emit('improvement:failed', error);
    });
  }

  /**
   * Set up Phase 2 dogfooding schedule as specified in the requirements
   */
  setupPhase2Schedule(): void {
    this.logger.info('Setting up Phase 2 dogfooding schedule...');
    
    // Daily self-improvement at 2 AM
    this?.scheduleDaily('0 2 * * *', 'full-analysis');
    
    // Phase 2 specific schedule (as per requirements)
    this?.scheduleSpecificDays([
      { day: 17, feature: 'duplication_detection', description: 'Use duplication detection on our own analysis code' },
      { day: 19, feature: 'refactoring', description: 'Apply refactoring suggestions to consolidate similar logic' },
      { day: 21, feature: 'tree_navigation', description: 'Navigate our own dependency tree to optimize imports' },
      { day: 23, feature: 'vector_search', description: 'Use vector search to find similar implementations across modules' },
      { day: 25, feature: 'centralization', description: 'Centralize our own scattered configuration and constants' },
      { day: 28, feature: 'context_optimization', description: 'Optimize context windows for our own CLI workflows' }
    ]);
    
    this.logger.info('Phase 2 dogfooding schedule configured');
  }

  /**
   * Schedule daily self-improvement
   */
  scheduleDaily(cronPattern: string, analysisType: string): void {
    const task = cron?.schedule(cronPattern, async () => {
      this.logger.info(`Running scheduled self-improvement: ${analysisType}`);
      
      try {
        const report = await this.engine?.runSelfImprovement();
        this?.logReport(report, analysisType);
        
      } catch (error) {
        this.logger.error(`Scheduled self-improvement failed: ${analysisType}`, error as Error);
      }
    });
    
    this.scheduledTasks?.push(task);
  }

  /**
   * Schedule specific Phase 2 dogfooding days
   */
  private scheduleSpecificDays(schedule: Array<{
    day: number;
    feature: string;
    description: string;
  }>): void {
    
    // For demonstration, we'll convert this to a weekly schedule
    // In production, you'd set specific dates
    schedule?.forEach(({ day, feature, description }, index) => {
      // Convert to weekly schedule (day % 7 for day of week)
      const dayOfWeek = day % 7;
      const cronPattern = `0 10 * * ${dayOfWeek}`; // 10 AM on specific day of week
      
      const task = cron?.schedule(cronPattern, async () => {
        this.logger.info(`Phase 2 dogfooding day ${day}: ${description}`);
        
        try {
          await this?.runFeatureSpecificAnalysis(feature, description);
          
        } catch (error) {
          this.logger.error(`Phase 2 dogfooding failed for ${feature}`, error as Error);
        }
      });
      
      this.scheduledTasks?.push(task);
    });
  }

  /**
   * Run analysis focused on a specific feature
   */
  private async runFeatureSpecificAnalysis(feature: string, description: string): Promise<void> {
    this.logger.info(`Running feature-specific analysis: ${feature}`);
    
    switch (feature) {
      case 'duplication_detection':
        await this?.analyzeOurDuplicationDetection();
        break;
        
      case 'refactoring':
        await this?.applyOurRefactoringSuggestions();
        break;
        
      case 'tree_navigation':
        await this?.optimizeOurDependencyTree();
        break;
        
      case 'vector_search':
        await this?.findOurSimilarImplementations();
        break;
        
      case 'centralization':
        await this?.centralizeOurConfigurations();
        break;
        
      case 'context_optimization':
        await this?.optimizeOurContextWindows();
        break;
        
      default:
        // Run general analysis
        const report = await this.engine?.runSelfImprovement();
        this?.logReport(report, feature);
    }
    
    this?.emit('feature-analysis:completed', { feature, description });
  }

  /**
   * Analyze our duplication detection code for duplications
   */
  private async analyzeOurDuplicationDetection(): Promise<void> {
    const { duplicationDetector } = await this?.getOurOwnTools();
    
    const results = await duplicationDetector?.findDuplicates({
      projectPath: this.engine['projectPath'],
      includeSemantic: true,
      similarityThreshold: 0.8,
      includeRefactoringSuggestions: true,
      filePatterns: [
        'src/features/duplication/**/*.ts',
        'src/shared/ast/**/*.ts'
      ]
    });
    
    this.logger.info(`Self-analysis found ${results.duplicates?.length} duplication groups in our analysis code`);
    
    // Log specific findings
    for (const group of results.duplicates?.slice(0, 3)) { // Top 3
      this.logger.info(`  - ${group.similarity}% similarity: ${group.locations?.map(l => l.file).join(', ')}`);
      if (group.refactoring) {
        this.logger.info(`    Suggestion: ${group.refactoring.description}`);
      }
    }
  }

  /**
   * Apply refactoring suggestions to our own code
   */
  private async applyOurRefactoringSuggestions(): Promise<void> {
    const report = await this.engine?.runSelfImprovement();
    const refactoringOpportunities = report.improvements?.filter(i => 
      i?.type === 'duplication_removed' || i?.type === 'pattern_applied'
    );
    
    this.logger.info(`Found ${refactoringOpportunities?.length} refactoring opportunities in our codebase`);
    
    // In a real implementation, we'd apply these automatically or queue for review
    for (const opp of refactoringOpportunities?.slice(0, 5)) {
      this.logger.info(`  - ${opp.description} (benefit: ${opp.benefit})`);
      this.logger.info(`    Suggestion: ${opp.suggestion}`);
    }
  }

  /**
   * Optimize our own dependency tree
   */
  private async optimizeOurDependencyTree(): Promise<void> {
    const { treeNavigator } = await this?.getOurOwnTools();
    
    const tree = await treeNavigator?.buildDependencyTree(this.engine['projectPath']);
    
    this.logger.info(`Our dependency tree: ${tree.nodes.size} nodes, ${tree.circularDependencies?.length} circular deps`);
    
    // Analyze for optimization opportunities
    const complexModules = Array.from(tree.nodes?.values())
      .filter(node => node.children?.length > 10)
      .sort((a, b) => b.children?.length - a.children?.length);
    
    this.logger.info(`Found ${complexModules?.length} complex modules that could be split`);
    
    complexModules?.slice(0, 3)?.forEach(module => {
      this.logger.info(`  - ${module.path}: ${module.children?.length} dependencies`);
    });
  }

  /**
   * Find similar implementations in our code
   */
  private async findOurSimilarImplementations(): Promise<void> {
    const { vectorSearch } = await this?.getOurOwnTools();
    
    const patterns = [
      'error handling',
      'file processing',
      'AST traversal',
      'database operations',
      'configuration loading'
    ];
    
    for (const pattern of patterns) {
      const results = await vectorSearch?.search({
        query: pattern,
        projectPath: this.engine['projectPath'],
        limit: 5,
        crossProject: false,
        useSemanticSearch: true,
        similarityThreshold: 0.7
      });
      
      if (results.matches?.length > 2) {
        this.logger.info(`Found ${results.matches?.length} similar implementations of "${pattern}"`);
        this.logger.info(`  Files: ${results.matches?.map(m => m.file).join(', ')}`);
      }
    }
  }

  /**
   * Centralize our scattered configurations
   */
  private async centralizeOurConfigurations(): Promise<void> {
    const { centralizationDetector } = await this?.getOurOwnTools();
    
    const results = await centralizationDetector?.scanProject({
      projectPath: this.engine['projectPath'],
      includeMigrationPlan: true,
      includeRiskAssessment: true
    });
    
    this.logger.info(`Found ${results.opportunities?.length} centralization opportunities`);
    
    const highValue = results.opportunities?.filter(opp => opp.benefitScore > 5);
    for (const opp of highValue) {
      this.logger.info(`  - ${opp.configType}: ${opp.scatteredLocations?.length} locations (benefit: ${opp.benefitScore})`);
    }
  }

  /**
   * Optimize our context windows
   */
  private async optimizeOurContextWindows(): Promise<void> {
    const { contextOptimizer } = await this?.getOurOwnTools();
    
    const analysis = await contextOptimizer?.analyzeProject({
      projectPath: this.engine['projectPath'],
      tokenBudget: 8000
    });
    
    this.logger.info(`Context analysis: ${analysis.totalFiles} files, primary language: ${analysis.primaryLanguage}`);
    
    // Check for files that are too large
    const largeFiles = analysis.files?.filter((f: any) => f.tokenCount > 2000) || [];
    if (largeFiles?.length > 0) {
      this.logger.info(`Found ${largeFiles?.length} files that are too large for optimal context`);
      largeFiles?.slice(0, 3)?.forEach((f: any) => {
        this.logger.info(`  - ${f.path}: ${f.tokenCount} tokens`);
      });
    }
  }

  /**
   * Get our own tools (helper method)
   */
  private async getOurOwnTools() {
    // Import our own tools dynamically to avoid circular dependencies
    const { DuplicationDetector } = await import('../features/duplication/detector');
    const { TreeNavigator } = await import('../features/tree-navigation/navigator');
    const { VectorSearch } = await import('../features/vector-search/search-engine');
    const { CentralizationDetector } = await import('../features/centralization/detector');
    const { ContextOptimizer } = await import('../cli/context-optimizer');
    
    return {
      duplicationDetector: new DuplicationDetector(),
      treeNavigator: new TreeNavigator(),
      vectorSearch: new VectorSearch(),
      centralizationDetector: new CentralizationDetector(),
      contextOptimizer: new ContextOptimizer()
    };
  }

  /**
   * Start all scheduled tasks
   */
  start(): void {
    this.logger.info('Starting self-improvement scheduler...');
    
    for (const task of this.scheduledTasks) {
      task?.start();
    }
    
    this.logger.info(`Started ${this.scheduledTasks?.length} scheduled self-improvement tasks`);
    this?.emit('scheduler:started', { taskCount: this.scheduledTasks?.length });
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    this.logger.info('Stopping self-improvement scheduler...');
    
    for (const task of this.scheduledTasks) {
      task?.stop();
    }
    
    this?.emit('scheduler:stopped');
  }

  /**
   * Get status of all scheduled tasks
   */
  getStatus(): Array<{
    name: string;
    running: boolean;
    nextRun?: Date;
  }> {
    return this.scheduledTasks?.map((task, index) => ({
      name: `task-${index}`,
      running: false, // node-cron doesn't expose running state
      nextRun: undefined // node-cron doesn't expose next run dates
    }));
  }

  /**
   * Run immediate self-improvement (manual trigger)
   */
  async runNow(): Promise<SelfImprovementReport> {
    this.logger.info('Running immediate self-improvement...');
    const report = await this.engine?.runSelfImprovement();
    this?.logReport(report, 'manual');
    return report;
  }

  /**
   * Log improvement report
   */
  private logReport(report: SelfImprovementReport, context: string): void {
    this.logger.info(`Self-improvement completed (${context}):`);
    this.logger.info(`  - ${report.improvements?.length} improvements identified`);
    this.logger.info(`  - ${report.recommendations?.length} recommendations generated`);
    
    const highPriority = report.improvements?.filter(i => i.benefit > 7);
    if (highPriority?.length > 0) {
      this.logger.info(`  - ${highPriority?.length} high-priority improvements found`);
    }
  }

  close(): void {
    this?.stop();
    this.engine?.close();
  }
}

export default SelfImprovementScheduler;