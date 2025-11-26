/**
 * Intent Analysis Service
 * SOLID Principles: Single Responsibility - Handle user intent analysis and tool selection only
 */

import { Logger } from '../../../shared/logger';
import { ClaudeCodeIntegration } from '../../../integrations/claude/claude-cli-integration';
import {
  IIntentAnalysisService,
  UserFeatureRequest,
  ProcessedIntent
} from '../interfaces/index';

export class IntentAnalysisService implements IIntentAnalysisService {
  private logger = Logger.getInstance();
  private claudeIntegration: ClaudeCodeIntegration;

  constructor(claudeIntegration?: ClaudeCodeIntegration) {
    this.claudeIntegration = claudeIntegration || new ClaudeCodeIntegration();
  }

  async analyzeIntentAndSelectTools(request: UserFeatureRequest): Promise<ProcessedIntent> {
    this.logger.info('🎯 Analyzing user intent with Claude Code CLI...');

    try {
      // Use the simple, more reliable intent detection
      const simpleIntentResult = await this.claudeIntegration.detectUserIntentSimple(request.query);

      // Convert to legacy format for compatibility
      const intentResult = {
        category: simpleIntentResult.category,
        confidence: simpleIntentResult.confidence,
        params: {
          requiresModifications: simpleIntentResult.requiresModifications,
          reasoning: simpleIntentResult.reasoning
        }
      };

      // Transform ClaudeCodeIntegration result to ProcessedIntent format
      const processedIntent: ProcessedIntent = {
        intention: intentResult.category,
        complexity: this.mapComplexity(intentResult.confidence),
        estimatedFiles: this.estimateFiles(intentResult.category),
        suggestedTools: this.suggestTools(intentResult.category),
        riskLevel: this.assessRisk(intentResult.category),
        primaryDomains: this.extractDomains(request.query, intentResult.category),
        timeEstimate: this.estimateTime(intentResult.category, intentResult.confidence),
        confidence: intentResult.confidence
      };

      this.logger.debug('Intent analysis completed:', processedIntent);
      return processedIntent;
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);

      // Fallback to simple analysis
      return this.createFallbackIntent(request.query);
    }
  }

  mapComplexity(confidence: number): 'simple' | 'medium' | 'complex' {
    if (confidence > 0.8) return 'simple';
    if (confidence > 0.5) return 'medium';
    return 'complex';
  }

  estimateFiles(category: string): number {
    const estimates: Record<string, number> = {
      'create_functionality': 3,
      'modify_existing': 2,
      'fix_bug': 1,
      'refactor_code': 4,
      'add_tests': 2,
      'update_documentation': 1,
      'analyze_code': 0,
      'explain_code': 0,
      'report': 0
    };

    return estimates[category] || 2;
  }

  suggestTools(category: string): string[] {
    const toolMappings: Record<string, string[]> = {
      'create_functionality': ['semantic_search', 'code_generation', 'git_management', 'quality_checks'],
      'modify_existing': ['semantic_search', 'dependency_analysis', 'git_management', 'quality_checks'],
      'fix_bug': ['semantic_search', 'debugging_tools', 'git_management', 'quality_checks'],
      'refactor_code': ['solid_analysis', 'semantic_search', 'dependency_analysis', 'quality_checks'],
      'add_tests': ['test_generation', 'code_coverage', 'quality_checks'],
      'update_documentation': ['documentation_generator', 'semantic_search'],
      'analyze_code': ['semantic_search', 'graph_analysis', 'solid_analysis'],
      'explain_code': ['semantic_search', 'graph_analysis'],
      'report': ['semantic_search', 'graph_analysis', 'quality_analysis']
    };

    return toolMappings[category] || ['semantic_search', 'quality_checks'];
  }

  assessRisk(category: string): 'low' | 'medium' | 'high' {
    const riskLevels: Record<string, 'low' | 'medium' | 'high'> = {
      'create_functionality': 'medium',
      'modify_existing': 'high',
      'fix_bug': 'medium',
      'refactor_code': 'high',
      'add_tests': 'low',
      'update_documentation': 'low',
      'analyze_code': 'low',
      'explain_code': 'low',
      'report': 'low'
    };

    return riskLevels[category] || 'medium';
  }

  private extractDomains(query: string, category: string): string[] {
    const domains: string[] = [];
    const queryLower = query.toLowerCase();

    // Technical domains
    if (queryLower.includes('auth') || queryLower.includes('login')) domains.push('authentication');
    if (queryLower.includes('api') || queryLower.includes('endpoint')) domains.push('api');
    if (queryLower.includes('database') || queryLower.includes('db')) domains.push('database');
    if (queryLower.includes('frontend') || queryLower.includes('ui')) domains.push('frontend');
    if (queryLower.includes('backend') || queryLower.includes('server')) domains.push('backend');
    if (queryLower.includes('test') || queryLower.includes('testing')) domains.push('testing');
    if (queryLower.includes('security') || queryLower.includes('vulnerability')) domains.push('security');
    if (queryLower.includes('performance') || queryLower.includes('optimization')) domains.push('performance');

    // Add category as domain if no specific domains found
    if (domains.length === 0) {
      domains.push(category);
    }

    return domains;
  }

  private estimateTime(category: string, confidence: number): number {
    const baseEstimates: Record<string, number> = {
      'create_functionality': 45,
      'modify_existing': 30,
      'fix_bug': 20,
      'refactor_code': 60,
      'add_tests': 25,
      'update_documentation': 15,
      'analyze_code': 10,
      'explain_code': 5,
      'report': 10
    };

    const baseTime = baseEstimates[category] || 30;

    // Adjust based on confidence (lower confidence = more time)
    const confidenceMultiplier = 1 + (1 - confidence);

    return Math.round(baseTime * confidenceMultiplier);
  }

  private createFallbackIntent(query: string): ProcessedIntent {
    // Simple keyword-based fallback
    const queryLower = query.toLowerCase();

    let category = 'analyze_code';
    if (queryLower.includes('create') || queryLower.includes('add') || queryLower.includes('implement')) {
      category = 'create_functionality';
    } else if (queryLower.includes('fix') || queryLower.includes('bug') || queryLower.includes('error')) {
      category = 'fix_bug';
    } else if (queryLower.includes('modify') || queryLower.includes('update') || queryLower.includes('change')) {
      category = 'modify_existing';
    }

    return {
      intention: category,
      complexity: 'medium',
      estimatedFiles: this.estimateFiles(category),
      suggestedTools: this.suggestTools(category),
      riskLevel: this.assessRisk(category),
      primaryDomains: this.extractDomains(query, category),
      timeEstimate: this.estimateTime(category, 0.5),
      confidence: 0.5
    };
  }
}