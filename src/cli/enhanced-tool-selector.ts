import { ToolSelectionContext, Tool } from './intelligent-tool-selector';
import { ToolBundleSystem, BundleSelectionResult, ToolBundle } from './tool-bundle-system';
import { Database } from '../database/database';
import { Logger } from '../utils/logger';
import { PerformanceMonitor } from '../shared/performance-monitor';

export interface EnhancedSelectionResult extends BundleSelectionResult {
  fallbackToIndividual: boolean;
  selectionStrategy: 'bundle-first' | 'tool-first' | 'hybrid' | 'claude-direct';
  confidence: number;
  recommendations: string[];
}

export interface SelectionMetrics {
  selectionTime: number;
  totalTools: number;
  totalBundles: number;
  averageToolRelevance: number;
  executionComplexity: number;
  expectedTokenSavings: number;
}

export class EnhancedToolSelector {
  private logger = Logger.getInstance();
  private bundleSystem: ToolBundleSystem;
  private db: Database;
  private performanceMonitor: PerformanceMonitor;
  private selectionCache = new Map<string, { result: EnhancedSelectionResult; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(database: Database, performanceMonitor: PerformanceMonitor) {
    this.db = database;
    this.performanceMonitor = performanceMonitor;
    this.bundleSystem = new ToolBundleSystem(database);
  }

  async initialize(): Promise<void> {
    await this.bundleSystem.initialize();
    this.logger.info('Enhanced Tool Selector initialized');
  }

  /**
   * Main selection method that intelligently chooses between bundles, tools, or Claude direct
   */
  async selectOptimalApproach(context: ToolSelectionContext): Promise<EnhancedSelectionResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(context);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.logger.debug('Using cached selection result');
        return cached;
      }

      // Determine selection strategy
      const strategy = this.determineSelectionStrategy(context);
      
      let result: EnhancedSelectionResult;
      
      switch (strategy) {
        case 'bundle-first':
          result = await this.bundleFirstSelection(context);
          break;
        case 'tool-first':
          result = await this.toolFirstSelection(context);
          break;
        case 'hybrid':
          result = await this.hybridSelection(context);
          break;
        case 'claude-direct':
          result = await this.claudeDirectSelection(context);
          break;
        default:
          result = await this.hybridSelection(context);
      }

      // Add metadata
      result.selectionStrategy = strategy;
      result.confidence = this.calculateConfidence(result, context);
      result.recommendations = this.generateRecommendations(result, context);

      // Cache the result
      this.cacheResult(cacheKey, result);

      // Record metrics
      await this.recordSelectionMetrics(context, result, Date.now() - startTime);

      return result;

    } catch (error) {
      this.logger.error('Error in enhanced tool selection:', error);
      return this.getFallbackSelection(context);
    }
  }

  private determineSelectionStrategy(context: ToolSelectionContext): 'bundle-first' | 'tool-first' | 'hybrid' | 'claude-direct' {
    const task = context.task.toLowerCase();
    
    // Claude direct for non-project queries
    if (this.isExternalQuery(task)) {
      return 'claude-direct';
    }

    // Bundle-first for complex, multi-step tasks
    if (this.isComplexTask(task, context)) {
      return 'bundle-first';
    }

    // Tool-first for specific, single-purpose tasks
    if (this.isSpecificTask(task)) {
      return 'tool-first';
    }

    // Default to hybrid approach
    return 'hybrid';
  }

  private isExternalQuery(task: string): boolean {
    const externalIndicators = [
      'what is', 'how to', 'explain', 'define', 'when was', 'who is',
      'latest news', 'current', 'recent updates', 'documentation for',
      'tutorial', 'example of', 'best practices for'
    ];
    
    return externalIndicators.some(indicator => task.includes(indicator));
  }

  private isComplexTask(task: string, context: ToolSelectionContext): boolean {
    const complexIndicators = [
      'refactor', 'restructure', 'analyze entire', 'full audit',
      'comprehensive', 'complete overhaul', 'migration', 'upgrade',
      'architecture review', 'end-to-end'
    ];

    const hasComplexIndicators = complexIndicators.some(indicator => task.includes(indicator));
    const isLargeCodebase = context.codebaseContext?.size && context.codebaseContext.size > 10000;
    const isHighComplexity = context.codebaseContext?.complexity === 'high';

    return hasComplexIndicators || isLargeCodebase || isHighComplexity;
  }

  private isSpecificTask(task: string): boolean {
    const specificIndicators = [
      'add function', 'fix bug', 'update config', 'modify component',
      'create test', 'format code', 'lint', 'single file',
      'one method', 'specific class'
    ];

    return specificIndicators.some(indicator => task.includes(indicator));
  }

  private async bundleFirstSelection(context: ToolSelectionContext): Promise<EnhancedSelectionResult> {
    this.logger.debug('Using bundle-first selection strategy');
    
    const bundleResult = await this.bundleSystem.selectBundlesAndTools(context);
    
    return {
      ...bundleResult,
      fallbackToIndividual: false,
      selectionStrategy: 'bundle-first',
      confidence: 0.85,
      recommendations: []
    };
  }

  private async toolFirstSelection(context: ToolSelectionContext): Promise<EnhancedSelectionResult> {
    this.logger.debug('Using tool-first selection strategy');
    
    // Use existing individual tool selection logic
    const individualTools = await this.selectIndividualTools(context);
    
    // Check if any bundles could complement these tools
    const complementaryBundles = await this.findComplementaryBundles(individualTools, context);
    
    const executionPlan = this.bundleSystem['createExecutionPlan'](complementaryBundles, individualTools);
    
    return {
      selectedBundles: complementaryBundles,
      selectedTools: individualTools,
      executionPlan,
      reasoning: `Selected ${individualTools.length} individual tools with ${complementaryBundles.length} complementary bundles`,
      totalTokenCost: this.bundleSystem['calculateTokenCost'](complementaryBundles, individualTools),
      estimatedTime: this.bundleSystem['estimateExecutionTime'](executionPlan),
      fallbackToIndividual: true,
      selectionStrategy: 'tool-first',
      confidence: 0.75,
      recommendations: []
    };
  }

  private async hybridSelection(context: ToolSelectionContext): Promise<EnhancedSelectionResult> {
    this.logger.debug('Using hybrid selection strategy');
    
    // Get both bundle and individual tool recommendations
    const bundleResult = await this.bundleSystem.selectBundlesAndTools(context);
    const individualTools = await this.selectIndividualTools(context);
    
    // Merge and optimize the selection
    const optimizedResult = await this.optimizeHybridSelection(bundleResult, individualTools, context);
    
    return {
      ...optimizedResult,
      fallbackToIndividual: false,
      selectionStrategy: 'hybrid',
      confidence: 0.90,
      recommendations: []
    };
  }

  private async claudeDirectSelection(context: ToolSelectionContext): Promise<EnhancedSelectionResult> {
    this.logger.debug('Using Claude direct strategy - no tools needed');
    
    return {
      selectedBundles: [],
      selectedTools: [],
      executionPlan: [],
      reasoning: 'Query determined to be best handled directly by Claude without tools',
      totalTokenCost: 0,
      estimatedTime: 5,
      fallbackToIndividual: false,
      selectionStrategy: 'claude-direct',
      confidence: 0.95,
      recommendations: ['This query can be answered directly without using project-specific tools']
    };
  }

  private async selectIndividualTools(context: ToolSelectionContext): Promise<Tool[]> {
    // This would integrate with the existing intelligent tool selector
    // For now, return a mock implementation
    const mockTools: Tool[] = [
      {
        name: 'file-reader',
        description: 'Reads and analyzes file contents',
        capabilities: ['file-analysis', 'content-extraction'],
        tokenCost: 'low',
        executionTime: 'fast',
        dependencies: [],
        parallelizable: true,
        reliability: 0.95,
        execute: async (params: any) => ({ success: true, data: params })
      }
    ];

    return mockTools.filter(tool => this.isToolRelevant(tool, context));
  }

  private isToolRelevant(tool: Tool, context: ToolSelectionContext): boolean {
    const taskLower = context.task.toLowerCase();
    return tool.capabilities.some(capability => 
      taskLower.includes(capability.toLowerCase())
    ) || tool.description.toLowerCase().includes(taskLower);
  }

  private async findComplementaryBundles(tools: Tool[], context: ToolSelectionContext): Promise<ToolBundle[]> {
    // Find bundles that would work well with the selected individual tools
    const allBundles = this.bundleSystem.getAllBundles();
    const complementary: ToolBundle[] = [];

    for (const bundle of allBundles) {
      if (!bundle.isActive) continue;
      
      // Check if bundle adds value without too much overlap
      const toolOverlap = this.calculateToolOverlap(bundle.tools, tools.map(t => t.name));
      if (toolOverlap < 0.5) { // Less than 50% overlap
        complementary.push(bundle);
      }
    }

    return complementary.slice(0, 2); // Limit to 2 complementary bundles
  }

  private calculateToolOverlap(bundleTools: string[], selectedTools: string[]): number {
    const overlap = bundleTools.filter(tool => selectedTools.includes(tool)).length;
    return overlap / Math.max(bundleTools.length, selectedTools.length);
  }

  private async optimizeHybridSelection(
    bundleResult: BundleSelectionResult,
    individualTools: Tool[],
    context: ToolSelectionContext
  ): Promise<BundleSelectionResult> {
    // Remove duplicate tools between bundles and individual selection
    const bundleToolIds = new Set<string>();
    bundleResult.selectedBundles.forEach(bundle => {
      bundle.tools.forEach(toolId => bundleToolIds.add(toolId));
    });

    const uniqueIndividualTools = individualTools.filter(tool => 
      !bundleToolIds.has(tool.name)
    );

    // Combine and re-plan execution
    const allTools = [...bundleResult.selectedTools, ...uniqueIndividualTools];
    const executionPlan = this.bundleSystem['createExecutionPlan'](bundleResult.selectedBundles, allTools);

    return {
      ...bundleResult,
      selectedTools: allTools,
      executionPlan,
      reasoning: `Hybrid selection: ${bundleResult.selectedBundles.length} bundles + ${uniqueIndividualTools.length} individual tools`
    };
  }

  private calculateConfidence(result: EnhancedSelectionResult, context: ToolSelectionContext): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on selection completeness
    if (result.selectedBundles.length > 0 || result.selectedTools.length > 0) {
      confidence += 0.2;
    }

    // Increase confidence for clear task matches
    if (result.reasoning.includes('auto-trigger')) {
      confidence += 0.15;
    }

    // Adjust based on strategy certainty
    switch (result.selectionStrategy) {
      case 'claude-direct':
        confidence += 0.3;
        break;
      case 'bundle-first':
        confidence += 0.25;
        break;
      case 'hybrid':
        confidence += 0.2;
        break;
      case 'tool-first':
        confidence += 0.15;
        break;
    }

    return Math.min(confidence, 1.0);
  }

  private generateRecommendations(result: EnhancedSelectionResult, context: ToolSelectionContext): string[] {
    const recommendations: string[] = [];

    if (result.selectedBundles.length === 0 && result.selectedTools.length === 0) {
      recommendations.push('Consider providing more specific context about your project structure');
    }

    if (result.totalTokenCost > 10) {
      recommendations.push('This selection may be token-intensive. Consider breaking down the task into smaller parts');
    }

    if (result.estimatedTime > 60) {
      recommendations.push('This operation may take over a minute. Consider running it in the background');
    }

    if (result.selectionStrategy === 'tool-first' && result.selectedBundles.length === 0) {
      recommendations.push('Your task might benefit from using tool bundles for more comprehensive results');
    }

    return recommendations;
  }

  private getFallbackSelection(context: ToolSelectionContext): EnhancedSelectionResult {
    return {
      selectedBundles: [],
      selectedTools: [],
      executionPlan: [],
      reasoning: 'Fallback selection due to error in primary selection logic',
      totalTokenCost: 1,
      estimatedTime: 10,
      fallbackToIndividual: true,
      selectionStrategy: 'claude-direct',
      confidence: 0.3,
      recommendations: ['An error occurred during tool selection. The query will be handled directly by Claude.']
    };
  }

  private generateCacheKey(context: ToolSelectionContext): string {
    const key = JSON.stringify({
      task: context.task,
      projectPath: context.projectPath,
      codebaseSize: context.codebaseContext?.size,
      languages: context.codebaseContext?.primaryLanguages,
      optimization: context.optimization
    });
    
    return Buffer.from(key).toString('base64').substring(0, 50);
  }

  private getFromCache(key: string): EnhancedSelectionResult | null {
    const cached = this.selectionCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }
    return null;
  }

  private cacheResult(key: string, result: EnhancedSelectionResult): void {
    this.selectionCache.set(key, {
      result,
      timestamp: Date.now()
    });

    // Clean old entries
    if (this.selectionCache.size > 100) {
      const entries = Array.from(this.selectionCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 20 entries
      for (let i = 0; i < 20; i++) {
        this.selectionCache.delete(entries[i][0]);
      }
    }
  }

  private async recordSelectionMetrics(
    context: ToolSelectionContext,
    result: EnhancedSelectionResult,
    selectionTime: number
  ): Promise<void> {
    const metrics: SelectionMetrics = {
      selectionTime,
      totalTools: result.selectedTools.length,
      totalBundles: result.selectedBundles.length,
      averageToolRelevance: 0.8, // Would be calculated based on actual relevance
      executionComplexity: result.executionPlan.length,
      expectedTokenSavings: this.calculateExpectedTokenSavings(result)
    };

    this.performanceMonitor.recordMetric('tool_selection_time', metrics.selectionTime, 'ms');
    this.performanceMonitor.recordMetric('tool_selection_confidence', result.confidence, 'score');

    this.logger.debug('Selection metrics recorded', metrics);
  }

  private calculateExpectedTokenSavings(result: EnhancedSelectionResult): number {
    // Estimate token savings compared to not using tools
    const baseTokenCost = 1000; // Estimated cost without tools
    const toolBasedCost = result.totalTokenCost * 50; // Convert to actual token estimate
    
    return Math.max(0, baseTokenCost - toolBasedCost);
  }

  // Public methods for dashboard integration
  async getBundleSystem(): Promise<ToolBundleSystem> {
    return this.bundleSystem;
  }

  async getSelectionStats(): Promise<any> {
    const allBundles = this.bundleSystem.getAllBundles();
    const activeBundles = allBundles.filter(b => b.isActive);
    
    return {
      totalBundles: allBundles.length,
      activeBundles: activeBundles.length,
      cacheSize: this.selectionCache.size,
      categories: [...new Set(allBundles.map(b => b.category))],
      averageToolsPerBundle: activeBundles.reduce((sum, b) => sum + b.tools.length, 0) / activeBundles.length
    };
  }

  clearCache(): void {
    this.selectionCache.clear();
    this.logger.info('Selection cache cleared');
  }
}