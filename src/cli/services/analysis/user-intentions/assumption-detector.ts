/**
 * Assumption Detector Service
 * Analyzes user requests to identify potential assumptions and ambiguities
 * Uses LLM-based analysis with keyword-based fallback
 * Provides structured feedback for Claude Code integration
 */

import { LLMIntentionDetector, IntentionAnalysis } from './llm-intention-detector';

export interface DetectedAssumption {
  category: 'implementation' | 'scope' | 'format' | 'integration' | 'data' | 'behavior' | 'approach' | 'bugfix';
  assumption: string;
  alternatives?: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface AmbiguityAnalysis {
  hasAmbiguities: boolean;
  assumptions: DetectedAssumption[];
  clarificationNeeded: string[];
  suggestedQuestions: string[];
}

export class AssumptionDetector {
  private llmDetector: LLMIntentionDetector;
  private enableLLM: boolean;

  constructor(enableLLM: boolean = true) {
    this.llmDetector = new LLMIntentionDetector(enableLLM);
    this.enableLLM = enableLLM;
  }

  /**
   * Get the full LLM intention analysis (new enhanced method)
   */
  async analyzeIntentionWithLLM(userInput: string): Promise<IntentionAnalysis | null> {
    if (!this.enableLLM) {
      return null;
    }

    try {
      return await this.llmDetector.analyzeIntention(userInput);
    } catch (error) {
      console.warn('LLM intention analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Enable or disable LLM analysis
   */
  setLLMEnabled(enabled: boolean): void {
    this.enableLLM = enabled;
    this.llmDetector.setEnabled(enabled);
  }

  /**
   * Check if LLM is enabled and available
   */
  isLLMEnabled(): boolean {
    return this.enableLLM && this.llmDetector.isEnabled();
  }

  /**
   * Analyze user input for assumptions and ambiguities using LLM with keyword fallback
   */
  async analyzeRequest(userInput: string, projectContext?: any): Promise<AmbiguityAnalysis> {
    // Try LLM-based analysis first
    if (this.enableLLM) {
      try {
        const llmAnalysis = await this.llmDetector.analyzeIntention(userInput);
        if (llmAnalysis) {
          console.log('✅ Using LLM-based intention analysis');
          return this.convertLLMAnalysisToAmbiguityAnalysis(llmAnalysis);
        }
      } catch (error) {
        console.warn('⚠️ LLM analysis failed, falling back to keyword analysis:', error.message);
      }
    }

    // Fallback to keyword-based analysis
    console.log('📋 Using keyword-based intention analysis (fallback)');
    return this.analyzeRequestKeywordBased(userInput, projectContext);
  }

  /**
   * Convert LLM intention analysis to legacy AmbiguityAnalysis format
   */
  private convertLLMAnalysisToAmbiguityAnalysis(llmAnalysis: IntentionAnalysis): AmbiguityAnalysis {
    const assumptions: DetectedAssumption[] = llmAnalysis.assumptions.map(assumption => ({
      category: this.mapLLMCategoryToLegacy(assumption.category),
      assumption: assumption.description,
      alternatives: assumption.alternatives,
      confidence: this.mapLLMConfidenceToLegacy(assumption.confidence)
    }));

    const clarificationNeeded: string[] = llmAnalysis.ambiguities.map(amb => amb.clarificationNeeded);
    const suggestedQuestions: string[] = llmAnalysis.ambiguities.flatMap(amb => amb.options);

    // Add intent-specific assumptions if not already covered
    if (llmAnalysis.primaryIntent === 'bug_fix') {
      const hasBugfixAssumption = assumptions.some(a => a.category === 'bugfix');
      if (!hasBugfixAssumption) {
        assumptions.push({
          category: 'bugfix',
          assumption: 'Will assume this is a single class/limited scope fix that can be resolved with minimal changes',
          alternatives: [
            'Wider architectural changes may be needed',
            'Multiple classes or modules might require updates',
            'Root cause analysis might reveal deeper issues'
          ],
          confidence: 'high'
        });
      }
    }

    return {
      hasAmbiguities: assumptions.length > 0 || clarificationNeeded.length > 0,
      assumptions,
      clarificationNeeded,
      suggestedQuestions
    };
  }

  /**
   * Map LLM categories to legacy DetectedAssumption categories
   */
  private mapLLMCategoryToLegacy(llmCategory: string): DetectedAssumption['category'] {
    const categoryMap: Record<string, DetectedAssumption['category']> = {
      'scope': 'scope',
      'approach': 'approach',
      'data': 'data',
      'integration': 'integration',
      'behavior': 'behavior',
      'format': 'format',
      'timeline': 'scope', // Map timeline to scope
      'quality': 'implementation', // Map quality to implementation
      'technology': 'implementation',
      'architecture': 'implementation',
      'performance': 'implementation',
      'security': 'implementation',
      'testing': 'implementation',
      'deployment': 'implementation',
      'maintenance': 'implementation',
      'compatibility': 'implementation',
      'resources': 'scope'
    };
    return categoryMap[llmCategory] || 'implementation';
  }

  /**
   * Map LLM confidence (0-1) to legacy confidence levels
   */
  private mapLLMConfidenceToLegacy(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Legacy keyword-based analysis (fallback method)
   */
  private analyzeRequestKeywordBased(userInput: string, projectContext?: any): AmbiguityAnalysis {
    const input = userInput.toLowerCase();
    const assumptions: DetectedAssumption[] = [];
    const clarificationNeeded: string[] = [];
    const suggestedQuestions: string[] = [];

    // Bug fix scoping assumptions
    if (this.hasBugFixIntent(input)) {
      assumptions.push({
        category: 'bugfix',
        assumption: 'Will assume this is a single class/limited scope fix that can be resolved with minimal changes',
        alternatives: [
          'Wider architectural changes may be needed',
          'Multiple classes or modules might require updates',
          'Root cause analysis might reveal deeper issues',
          'Cross-cutting concerns may need attention'
        ],
        confidence: 'high'
      });

      clarificationNeeded.push('Bug fix scope and impact assessment');
      suggestedQuestions.push('Should I start with a minimal fix or do a broader impact analysis first?');
    }

    // Approach assumptions: Implementation vs Research
    if (this.hasApproachAmbiguity(input)) {
      assumptions.push({
        category: 'approach',
        assumption: 'Will implement a custom solution rather than researching existing libraries',
        alternatives: [
          'Research and recommend existing libraries/tools first',
          'Evaluate multiple approaches before implementing',
          'Provide analysis of build vs buy options',
          'Survey the ecosystem before writing code'
        ],
        confidence: 'high'
      });

      clarificationNeeded.push('Implementation vs research approach');
      suggestedQuestions.push('Should I implement a solution or first research existing libraries/tools?');
    }

    // Implementation approach assumptions
    if (this.hasImplementationAmbiguity(input)) {
      assumptions.push({
        category: 'implementation',
        assumption: 'Will use existing codebase patterns and architectural style',
        alternatives: [
          'Create new utilities from scratch',
          'Use external libraries/frameworks',
          'Follow specific design patterns'
        ],
        confidence: 'high'
      });

      clarificationNeeded.push('Implementation approach preference');
      suggestedQuestions.push('Should I use existing code patterns or create new implementations?');
    }

    // Scope and completeness assumptions
    if (this.hasScopeAmbiguity(input)) {
      assumptions.push({
        category: 'scope',
        assumption: 'Will implement complete production-ready feature with error handling',
        alternatives: [
          'Minimal working prototype',
          'Basic functionality only',
          'Full enterprise-grade implementation'
        ],
        confidence: 'high'
      });

      clarificationNeeded.push('Implementation scope and completeness level');
      suggestedQuestions.push('Do you want a complete feature or a minimal prototype?');
    }

    // Data/mock assumptions
    if (this.hasDataAmbiguity(input)) {
      assumptions.push({
        category: 'data',
        assumption: 'Will create realistic mock data and placeholder implementations',
        alternatives: [
          'Use minimal placeholder data',
          'Leave TODO comments for real data integration',
          'Connect to actual data sources'
        ],
        confidence: 'medium'
      });

      clarificationNeeded.push('Data handling approach');
      suggestedQuestions.push('Should I use mock data, connect to real data, or leave integration TODOs?');
    }

    // Format and structure assumptions
    if (this.hasFormatAmbiguity(input)) {
      assumptions.push({
        category: 'format',
        assumption: 'Will match existing code style and project conventions',
        alternatives: [
          'Use modern best practices',
          'Follow specific style guide',
          'Ask for detailed formatting preferences'
        ],
        confidence: 'medium'
      });

      clarificationNeeded.push('Code style and formatting preferences');
    }

    // Integration assumptions
    if (this.hasIntegrationAmbiguity(input)) {
      assumptions.push({
        category: 'integration',
        assumption: 'Will integrate with existing project structure and dependencies',
        alternatives: [
          'Create standalone implementation',
          'Add new dependencies as needed',
          'Modify existing integrations'
        ],
        confidence: 'high'
      });

      clarificationNeeded.push('Integration approach with existing code');
      suggestedQuestions.push('Should this integrate with existing systems or be standalone?');
    }

    // Behavior assumptions
    if (this.hasBehaviorAmbiguity(input)) {
      assumptions.push({
        category: 'behavior',
        assumption: 'Will implement standard behavior patterns for this type of feature',
        alternatives: [
          'Custom behavior specific to your needs',
          'Configurable behavior options',
          'Minimal behavior with extension points'
        ],
        confidence: 'medium'
      });

      clarificationNeeded.push('Expected behavior and interaction patterns');
      suggestedQuestions.push('Are there specific behaviors or interactions you want?');
    }

    return {
      hasAmbiguities: assumptions.length > 0,
      assumptions,
      clarificationNeeded,
      suggestedQuestions
    };
  }

  /**
   * Generate structured prompt enhancement for Claude Code
   */
  generatePromptEnhancement(analysis: AmbiguityAnalysis): string {
    if (!analysis.hasAmbiguities) {
      return '';
    }

    // Much more concise assumption reporting
    let enhancement = '\n[Assumptions: ';

    // Simple, concise assumptions
    const keyAssumptions = analysis.assumptions.slice(0, 2); // Only top 2
    const assumptionTexts = keyAssumptions.map(a => a.assumption.split('.')[0]); // First sentence only
    enhancement += assumptionTexts.join(', ');

    enhancement += ']';

    return enhancement;
  }

  // Detection methods for different types of ambiguities

  /**
   * Detect when user might want research vs immediate implementation
   */
  private hasApproachAmbiguity(input: string): boolean {
    const implementationKeywords = [
      'create', 'implement', 'build', 'add', 'make', 'develop',
      'write', 'code', 'setup', 'configure', 'install'
    ];

    const systemKeywords = [
      'system', 'service', 'component', 'feature', 'functionality',
      'solution', 'tool', 'utility', 'library', 'framework',
      'authentication', 'logging', 'validation', 'caching', 'testing',
      'monitoring', 'analytics', 'dashboard', 'api', 'database',
      'queue', 'scheduler', 'parser', 'generator', 'converter'
    ];

    const hasImplementationIntent = implementationKeywords.some(keyword => input.includes(keyword));
    const hasSystemKeyword = systemKeywords.some(keyword => input.includes(keyword));

    // Exclude research indicators
    const researchKeywords = [
      'research', 'find', 'recommend', 'suggest', 'compare', 'evaluate',
      'best', 'options', 'alternatives', 'libraries', 'tools', 'existing',
      'available', 'popular', 'which', 'what are', 'how do'
    ];
    const hasResearchIntent = researchKeywords.some(keyword => input.includes(keyword));

    // High chance of approach ambiguity if requesting to implement complex systems
    // without explicit research intent
    return hasImplementationIntent && hasSystemKeyword && !hasResearchIntent;
  }

  private hasImplementationAmbiguity(input: string): boolean {
    const keywords = [
      'create', 'implement', 'build', 'add', 'make', 'develop',
      'system', 'service', 'component', 'feature', 'function',
      'module', 'class', 'interface'
    ];
    return keywords.some(keyword => input.includes(keyword));
  }

  private hasScopeAmbiguity(input: string): boolean {
    const ambiguousScopes = [
      'complete', 'full', 'entire', 'comprehensive', 'robust',
      'system', 'solution', 'functionality', 'feature'
    ];
    const minimalIndicators = [
      'simple', 'basic', 'quick', 'minimal', 'prototype'
    ];

    return ambiguousScopes.some(scope => input.includes(scope)) &&
           !minimalIndicators.some(minimal => input.includes(minimal));
  }

  private hasDataAmbiguity(input: string): boolean {
    const dataKeywords = [
      'data', 'mock', 'sample', 'example', 'test data',
      'placeholder', 'dummy', 'fake', 'api', 'database'
    ];
    return dataKeywords.some(keyword => input.includes(keyword));
  }

  private hasFormatAmbiguity(input: string): boolean {
    const formatKeywords = [
      'format', 'style', 'structure', 'layout', 'design',
      'ui', 'interface', 'display', 'show', 'present'
    ];
    return formatKeywords.some(keyword => input.includes(keyword));
  }

  private hasIntegrationAmbiguity(input: string): boolean {
    const integrationKeywords = [
      'integrate', 'connect', 'link', 'combine', 'merge'
    ];
    const contextualKeywords = [
      'existing project', 'existing code', 'existing system',
      'current project', 'current system', 'current code',
      'with existing', 'using existing', 'extend existing'
    ];

    return integrationKeywords.some(keyword => input.includes(keyword)) ||
           contextualKeywords.some(phrase => input.includes(phrase));
  }

  private hasBehaviorAmbiguity(input: string): boolean {
    const behaviorKeywords = [
      'handle', 'manage', 'process', 'when', 'if', 'should',
      'behavior', 'action', 'response', 'react', 'trigger'
    ];
    return behaviorKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Detect when user is requesting bug fixes
   */
  private hasBugFixIntent(input: string): boolean {
    const bugKeywords = [
      'fix', 'bug', 'error', 'issue', 'problem', 'broken',
      'not working', 'failing', 'crash', 'exception',
      'incorrect', 'wrong', 'unexpected', 'debug'
    ];

    const fixActionKeywords = [
      'fix the', 'fix this', 'resolve', 'solve', 'repair',
      'correct', 'address', 'handle the issue', 'handle the error',
      'debug the', 'troubleshoot'
    ];

    const maintenanceKeywords = [
      'patch', 'hotfix', 'bugfix', 'maintenance'
    ];

    return bugKeywords.some(keyword => input.includes(keyword)) ||
           fixActionKeywords.some(keyword => input.includes(keyword)) ||
           maintenanceKeywords.some(keyword => input.includes(keyword));
  }
}

export default AssumptionDetector;