/**
 * Enhanced Context Provider
 * Uses selected tools to generate comprehensive context for Claude Code requests
 */

import { IntelligentToolSelector, ToolSelectionRequest, ToolSelectionResult } from './intelligent-tool-selector';
import { InternalTool, AnalysisResult } from './tool-interface';
import { HybridFileDiscovery, FileDiscoveryRequest } from './hybrid-file-discovery';
import { Logger } from './logger';

export interface EnhancedContextRequest {
  userQuery: string;
  projectPath: string;
  projectId: string;
  cliCommand: string;
  intent?: string;
  tokenBudget?: number;
  previousResults?: any;
}

export interface EnhancedContextResult {
  contextSections: Array<{
    toolName: string;
    category: string;
    priority: number;
    tokenWeight: number;
    content: string;
    insights: string[];
    confidence: number;
  }>;
  totalTokensUsed: number;
  toolsUsed: string[];
  selectionReasoning: string;
  recommendedActions: string[];
  crossToolInsights: string[];
  discoveredFiles?: Array<{
    filePath: string;
    contentType: string;
    relevanceScore: number;
    discoveryPhase: string;
  }>;
}

export interface ContextOptimizationConfig {
  maxTokens: number;
  prioritizeRecent: boolean;
  includeRecommendations: boolean;
  crossReferenceResults: boolean;
  semanticBoost: boolean;
}

export class EnhancedContextProvider {
  private logger: Logger;
  private toolSelector: IntelligentToolSelector;
  private fileDiscovery: HybridFileDiscovery;
  private claudeCodeApiUrl: string;

  constructor() {
    this.logger = Logger.getInstance();
    this.toolSelector = new IntelligentToolSelector();
    this.fileDiscovery = new HybridFileDiscovery();
    this.claudeCodeApiUrl = process.env.CLAUDE_CODE_API_URL || 'http://localhost:3007';
  }

  /**
   * Generate enhanced context using intelligently selected tools
   */
  async generateEnhancedContext(request: EnhancedContextRequest): Promise<EnhancedContextResult> {
    this.logger.info(`📝 Generating enhanced context for: "${request.userQuery}"`);

    try {
      // Step 0: Initialize file discovery system
      await this.fileDiscovery.initialize();
      
      // Step 1: Discover relevant files using hybrid approach
      const fileDiscoveryResult = await this.discoverRelevantFiles(request);
      
      // Step 2: Select appropriate tools (now with file context)
      const toolSelection = await this.selectToolsForContext(request, fileDiscoveryResult);
      
      // Step 3: Run analysis with selected tools (focused on discovered files)
      const toolResults = await this.runToolAnalyses(request, toolSelection, fileDiscoveryResult);
      
      // Step 4: Generate context sections from tool results
      const contextSections = await this.generateContextSections(toolResults, request);
      
      // Step 5: Optimize context within token budget
      const optimizedContext = await this.optimizeContextForTokens(contextSections, request.tokenBudget || 4000);
      
      // Step 6: Generate cross-tool insights
      const crossToolInsights = await this.generateCrossToolInsights(toolResults);
      
      // Step 7: Generate recommended actions
      const recommendedActions = await this.generateRecommendedActions(toolResults, request);

      const result: EnhancedContextResult = {
        contextSections: optimizedContext.sections,
        totalTokensUsed: optimizedContext.totalTokens,
        toolsUsed: toolSelection.selectedTools.map(t => t.metadata.name),
        selectionReasoning: toolSelection.selectionReasoning,
        recommendedActions,
        crossToolInsights,
        discoveredFiles: fileDiscoveryResult ? fileDiscoveryResult.primaryFiles.concat(fileDiscoveryResult.relatedFiles).map(f => ({
          filePath: f.filePath,
          contentType: f.contentType,
          relevanceScore: f.relevanceScore,
          discoveryPhase: f.discoveryPhase
        })) : undefined
      };

      this.logger.info(`✅ Generated context with ${result.contextSections.length} sections using ${result.totalTokensUsed} tokens`);
      return result;

    } catch (error) {
      this.logger.error('❌ Enhanced context generation failed:', error);
      throw error;
    }
  }

  /**
   * Discover relevant files using hybrid vector + graph approach
   */
  private async discoverRelevantFiles(request: EnhancedContextRequest): Promise<any> {
    try {
      this.logger.info(`🔍 Discovering relevant files for: "${request.userQuery}"`);
      
      const fileDiscoveryRequest: FileDiscoveryRequest = {
        query: request.userQuery,
        projectPath: request.projectPath,
        projectId: request.projectId,
        intent: this.mapIntentForFileDiscovery(request.intent),
        maxFiles: 20, // Limit for context efficiency
        includeRelated: true // Enable graph expansion
      };

      const discoveryResult = await this.fileDiscovery.discoverFiles(fileDiscoveryRequest);
      
      this.logger.info(`📁 Discovered ${discoveryResult.totalFiles} files (${discoveryResult.phases.vectorResults} vector + ${discoveryResult.phases.graphExpansions} graph)`);
      
      return discoveryResult;
    } catch (error) {
      this.logger.warn(`File discovery failed: ${error}, continuing without file context`);
      return null;
    }
  }

  /**
   * Map context intent to file discovery intent
   */
  private mapIntentForFileDiscovery(intent?: string): 'search' | 'refactor' | 'test' | 'debug' | 'security' | 'optimize' {
    switch (intent) {
      case 'debugging': return 'debug';
      case 'architecture': return 'refactor';
      case 'coding': return 'search';
      default: return 'search';
    }
  }

  /**
   * Select tools specifically for context generation
   */
  private async selectToolsForContext(request: EnhancedContextRequest, fileContext?: any): Promise<ToolSelectionResult> {
    const selectionRequest: ToolSelectionRequest = {
      userQuery: request.userQuery,
      projectPath: request.projectPath,
      projectId: request.projectId,
      cliCommand: `context-generation: ${request.cliCommand}`,
      intent: request.intent,
      previousContext: request.previousResults
    };

    return await this.toolSelector.selectToolsForRequest(selectionRequest);
  }

  /**
   * Run analysis with all selected tools
   */
  private async runToolAnalyses(
    request: EnhancedContextRequest, 
    toolSelection: ToolSelectionResult,
    fileContext?: any
  ): Promise<Array<{
    tool: InternalTool;
    metadata: any;
    result: AnalysisResult;
    selectionInfo: any;
  }>> {
    const analyses = [];

    for (const selection of toolSelection.selectedTools) {
      try {
        this.logger.info(`  🔍 Running analysis with ${selection.metadata.name}...`);
        
        // TODO: Pass discovered files to tools to focus their analysis
        // Tools can use fileContext.primaryFiles and fileContext.relatedFiles to limit scope
        const result = await selection.tool.analyzeProject(request.projectPath, request.projectId);
        
        analyses.push({
          tool: selection.tool,
          metadata: selection.metadata,
          result,
          selectionInfo: {
            confidence: selection.confidence,
            reasoning: selection.reasoning,
            priority: selection.priority
          }
        });

      } catch (error) {
        this.logger.warn(`⚠️ Analysis failed for ${selection.metadata.name}:`, error);
      }
    }

    return analyses;
  }

  /**
   * Generate context sections from tool results
   */
  private async generateContextSections(
    toolResults: any[], 
    request: EnhancedContextRequest
  ): Promise<Array<{
    toolName: string;
    category: string;
    priority: number;
    tokenWeight: number;
    content: string;
    insights: string[];
    confidence: number;
  }>> {
    const sections = [];

    for (const toolResult of toolResults) {
      const { tool, metadata, result, selectionInfo } = toolResult;
      
      // Generate rich context content for this tool
      const content = await this.generateToolContextContent(result, request);
      
      // Extract insights and recommendations
      const insights = result.recommendations || [];
      
      // Calculate token weight based on priority and confidence
      const tokenWeight = this.calculateTokenWeight(selectionInfo, metadata, request);

      sections.push({
        toolName: metadata.name,
        category: metadata.category,
        priority: selectionInfo.priority,
        tokenWeight,
        content,
        insights,
        confidence: result.metrics?.confidence || selectionInfo.confidence
      });
    }

    // Sort by priority and token weight
    sections.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.tokenWeight - a.tokenWeight;
    });

    return sections;
  }

  /**
   * Generate context content for a specific tool result
   */
  private async generateToolContextContent(result: AnalysisResult, request: EnhancedContextRequest): Promise<string> {
    const sections = [];

    // Tool-specific context generation
    sections.push(`=== ${result.toolName.toUpperCase()} ANALYSIS ===`);
    
    // Add execution metrics
    if (result.metrics) {
      sections.push(`Execution: ${result.metrics.executionTime}ms, Confidence: ${(result.metrics.confidence * 100).toFixed(1)}%`);
    }

    // Add key data insights
    if (result.data) {
      sections.push('\nKEY FINDINGS:');
      
      // Convert data object to readable insights
      const dataInsights = this.extractDataInsights(result.data);
      sections.push(dataInsights);
    }

    // Add recommendations if available
    if (result.recommendations && result.recommendations.length > 0) {
      sections.push('\nRECOMMENDations:');
      result.recommendations.forEach((rec, i) => {
        sections.push(`${i + 1}. ${rec}`);
      });
    }

    return sections.join('\n');
  }

  /**
   * Extract readable insights from tool data
   */
  private extractDataInsights(data: any): string {
    const insights = [];
    
    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'number') {
          insights.push(`• ${key}: ${value}`);
        } else if (Array.isArray(value)) {
          insights.push(`• ${key}: ${value.length} items`);
          if (value.length > 0 && typeof value[0] === 'object') {
            // Show first few items of complex arrays
            value.slice(0, 3).forEach(item => {
              if (item.name || item.path || item.type) {
                insights.push(`  - ${item.name || item.path || item.type}`);
              }
            });
          }
        } else if (typeof value === 'string' && value.length < 100) {
          insights.push(`• ${key}: ${value}`);
        }
      });
    }

    return insights.join('\n');
  }

  /**
   * Calculate token weight for prioritization
   */
  private calculateTokenWeight(selectionInfo: any, metadata: any, request: EnhancedContextRequest): number {
    let weight = selectionInfo.confidence * 100; // Base weight from confidence
    
    // Boost based on tool category relevance
    if (request.intent) {
      const intentBoosts = {
        'architecture': { 'architecture': 50, 'optimization': 30 },
        'debugging': { 'quality': 40, 'compilation': 35 },
        'optimization': { 'optimization': 45, 'performance': 40 },
        'search': { 'search': 50, 'navigation': 30 }
      };
      
      const boosts = intentBoosts[request.intent as keyof typeof intentBoosts];
      if (boosts && boosts[metadata.category as keyof typeof boosts]) {
        weight += boosts[metadata.category as keyof typeof boosts];
      }
    }

    // Trust level boost
    weight += metadata.trustLevel * 5;
    
    // Priority boost (lower number = higher priority)
    weight += (10 - selectionInfo.priority) * 10;

    return Math.round(weight);
  }

  /**
   * Optimize context sections within token budget
   */
  private async optimizeContextForTokens(
    sections: any[], 
    tokenBudget: number
  ): Promise<{ sections: any[], totalTokens: number }> {
    const optimizedSections = [];
    let totalTokens = 0;
    
    // Reserve tokens for cross-tool insights and recommendations
    const reservedTokens = Math.min(tokenBudget * 0.2, 800);
    const availableTokens = tokenBudget - reservedTokens;

    for (const section of sections) {
      // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
      const sectionTokens = Math.ceil(section.content.length / 4);
      
      if (totalTokens + sectionTokens <= availableTokens) {
        optimizedSections.push(section);
        totalTokens += sectionTokens;
      } else {
        // Try to fit a truncated version
        const remainingTokens = availableTokens - totalTokens;
        if (remainingTokens > 100) { // Only if we have meaningful space left
          const truncatedContent = section.content.substring(0, remainingTokens * 4 - 100) + '\n[TRUNCATED...]';
          optimizedSections.push({
            ...section,
            content: truncatedContent
          });
          totalTokens += remainingTokens;
        }
        break; // No more space
      }
    }

    return { sections: optimizedSections, totalTokens };
  }

  /**
   * Generate insights from cross-tool analysis
   */
  private async generateCrossToolInsights(toolResults: any[]): Promise<string[]> {
    const insights = [];
    
    // Look for patterns across tool results
    const allRecommendations = toolResults.flatMap(r => r.result.recommendations || []);
    const commonThemes = this.extractCommonThemes(allRecommendations);
    
    if (commonThemes.length > 0) {
      insights.push(`Common themes across tools: ${commonThemes.join(', ')}`);
    }

    // Check for conflicting recommendations
    const conflicts = this.detectRecommendationConflicts(toolResults);
    if (conflicts.length > 0) {
      insights.push(`Note: Some tools suggest different approaches for: ${conflicts.join(', ')}`);
    }

    // Look for synergistic opportunities
    const synergies = this.identifySynergies(toolResults);
    insights.push(...synergies);

    return insights;
  }

  /**
   * Extract common themes from recommendations
   */
  private extractCommonThemes(recommendations: string[]): string[] {
    const themes = new Map<string, number>();
    const keywords = ['refactor', 'optimize', 'improve', 'update', 'fix', 'enhance', 'simplify'];
    
    recommendations.forEach(rec => {
      keywords.forEach(keyword => {
        if (rec.toLowerCase().includes(keyword)) {
          themes.set(keyword, (themes.get(keyword) || 0) + 1);
        }
      });
    });

    return Array.from(themes.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([theme, _]) => theme)
      .slice(0, 3);
  }

  /**
   * Detect conflicting recommendations
   */
  private detectRecommendationConflicts(toolResults: any[]): string[] {
    // Simple conflict detection - look for opposite recommendations
    const conflicts = [];
    const recommendations = toolResults.map(r => r.result.recommendations || []).flat();
    
    // Look for patterns like "centralize" vs "distribute", "optimize" vs "simplify", etc.
    const conflictPairs = [
      ['centralize', 'distribute'],
      ['optimize', 'simplify'],
      ['increase', 'reduce'],
      ['add', 'remove']
    ];

    conflictPairs.forEach(([word1, word2]) => {
      const hasWord1 = recommendations.some(r => r.toLowerCase().includes(word1));
      const hasWord2 = recommendations.some(r => r.toLowerCase().includes(word2));
      
      if (hasWord1 && hasWord2) {
        conflicts.push(`${word1} vs ${word2}`);
      }
    });

    return conflicts;
  }

  /**
   * Identify synergistic opportunities
   */
  private identifySynergies(toolResults: any[]): string[] {
    const synergies = [];
    
    // Look for tools that complement each other
    const toolCategories = toolResults.map(r => r.metadata.category);
    
    if (toolCategories.includes('optimization') && toolCategories.includes('quality')) {
      synergies.push('Optimization and quality tools suggest a comprehensive refactoring approach');
    }
    
    if (toolCategories.includes('search') && toolCategories.includes('architecture')) {
      synergies.push('Search and architecture insights can guide better code organization');
    }

    return synergies;
  }

  /**
   * Generate recommended actions based on all tool results
   */
  private async generateRecommendedActions(toolResults: any[], request: EnhancedContextRequest): Promise<string[]> {
    const actions = [];
    const allRecommendations = toolResults.flatMap(r => r.result.recommendations || []);
    
    // Prioritize recommendations by tool confidence and frequency
    const actionPriority = new Map<string, { count: number, confidence: number }>();
    
    toolResults.forEach(toolResult => {
      const confidence = toolResult.result.metrics?.confidence || 0.7;
      toolResult.result.recommendations?.forEach((rec: string) => {
        const existing = actionPriority.get(rec);
        if (existing) {
          existing.count++;
          existing.confidence = Math.max(existing.confidence, confidence);
        } else {
          actionPriority.set(rec, { count: 1, confidence });
        }
      });
    });

    // Sort by priority (count * confidence)
    const sortedActions = Array.from(actionPriority.entries())
      .sort((a, b) => (b[1].count * b[1].confidence) - (a[1].count * a[1].confidence))
      .slice(0, 5) // Top 5 actions
      .map(([action, _]) => action);

    return sortedActions;
  }
}