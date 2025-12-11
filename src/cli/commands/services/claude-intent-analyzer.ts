/**
 * Claude Intent Analyzer Service
 * Single Responsibility: Use Claude Code CLI to analyze user queries and detect intent
 *
 * This service replaces all hardcoded keyword-based intent detection with actual
 * Claude AI analysis, providing accurate and context-aware query understanding.
 */

import { ClaudeCodeExecutor } from '../../services/claude/claude-code-executor';
import { Logger } from '../../../utils/logger';

export interface IntentAnalysis {
  intent: 'create' | 'modify' | 'fix' | 'delete' | 'understand' | 'analyze' | 'search' | 'general';
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  requiresModifications: boolean;
  assumptions: string[];
  ambiguities: string[];
  suggestedClarifications: string[];
  targetEntities: string[]; // Classes, functions, files that the query targets
  actionVerbs: string[]; // Key action verbs detected
}

export interface TaskDecomposition {
  isComplex: boolean;
  reasoning: string;
  subTasks: DecomposedTask[];
}

export interface DecomposedTask {
  id: number;
  type: 'analyze' | 'create' | 'modify' | 'refactor' | 'test' | 'fix' | 'document' | 'configure' | 'general';
  description: string;
  searchTerms: string[];
  priority: number;
  dependencies: number[];
  complexity: 'low' | 'medium' | 'high';
}

export interface DecompositionResult {
  success: boolean;
  decomposition?: TaskDecomposition;
  error?: string;
  fallbackUsed?: boolean;
}

export interface QueryAnalysisResult {
  success: boolean;
  analysis?: IntentAnalysis;
  error?: string;
  fallbackUsed?: boolean;
}

export class ClaudeIntentAnalyzer {
  private logger = Logger.getInstance();
  private static instance: ClaudeIntentAnalyzer;

  /**
   * Get singleton instance
   */
  static getInstance(): ClaudeIntentAnalyzer {
    if (!ClaudeIntentAnalyzer.instance) {
      ClaudeIntentAnalyzer.instance = new ClaudeIntentAnalyzer();
    }
    return ClaudeIntentAnalyzer.instance;
  }

  /**
   * Analyze a user query using Claude Code CLI
   * This is the main method that replaces all hardcoded intent detection
   */
  async analyzeQuery(query: string, projectContext?: string): Promise<QueryAnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(query, projectContext);

      this.logger.debug('🧠 Analyzing query intent with Claude...');

      const result = await ClaudeCodeExecutor.execute(prompt, {
        outputFormat: 'json',
        maxTokens: 2000,
        timeout: 30000 // 30 second timeout for intent analysis
      });

      if (!result.success || !result.data) {
        this.logger.warn('Claude intent analysis failed, using fallback');
        return {
          success: true,
          analysis: this.fallbackAnalysis(query),
          fallbackUsed: true
        };
      }

      // Parse Claude's response
      const analysis = this.parseClaudeResponse(result.data, query);

      return {
        success: true,
        analysis,
        fallbackUsed: false
      };

    } catch (error) {
      this.logger.error(`Intent analysis error: ${error instanceof Error ? error.message : error}`);
      return {
        success: true,
        analysis: this.fallbackAnalysis(query),
        fallbackUsed: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build the prompt for Claude to analyze the query
   */
  private buildAnalysisPrompt(query: string, projectContext?: string): string {
    const contextSection = projectContext
      ? `\n\nProject Context:\n${projectContext}`
      : '';

    return `You are an intent analyzer for a code assistant CLI tool. Analyze the following user query and provide a structured JSON response.

User Query: "${query}"${contextSection}

Analyze this query and respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "intent": "create|modify|fix|delete|understand|analyze|search|general",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this intent was detected",
  "requiresModifications": true|false,
  "assumptions": ["List of assumptions the user might be making"],
  "ambiguities": ["List of unclear or ambiguous aspects that might need clarification"],
  "suggestedClarifications": ["Questions to ask the user for better understanding"],
  "targetEntities": ["Classes, functions, or files the query seems to target"],
  "actionVerbs": ["Key action verbs from the query"]
}

Intent Definitions:
- "create": User wants to ADD new code, features, files, or functionality
- "modify": User wants to CHANGE/UPDATE/REFACTOR existing code
- "fix": User wants to FIX bugs, errors, or issues
- "delete": User wants to REMOVE code or features
- "understand": User wants to LEARN about/EXPLAIN how code works
- "analyze": User wants to ANALYZE code quality, patterns, or structure
- "search": User wants to FIND specific code, files, or patterns
- "general": Other requests that don't fit above categories

Important:
- Be precise with intent detection
- List any assumptions the user might be making
- Identify ambiguities that could lead to misunderstanding
- Suggest clarifying questions if the query is vague
- Extract specific entities (class names, file names) if mentioned

Respond with ONLY the JSON object, no other text.`;
  }

  /**
   * Parse Claude's JSON response
   */
  private parseClaudeResponse(response: string, originalQuery: string): IntentAnalysis {
    try {
      // Try to extract JSON from response (Claude might wrap it in markdown)
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and normalize the response
      return {
        intent: this.normalizeIntent(parsed.intent),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || ''),
        requiresModifications: Boolean(parsed.requiresModifications),
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [],
        ambiguities: Array.isArray(parsed.ambiguities) ? parsed.ambiguities.map(String) : [],
        suggestedClarifications: Array.isArray(parsed.suggestedClarifications) ? parsed.suggestedClarifications.map(String) : [],
        targetEntities: Array.isArray(parsed.targetEntities) ? parsed.targetEntities.map(String) : [],
        actionVerbs: Array.isArray(parsed.actionVerbs) ? parsed.actionVerbs.map(String) : []
      };

    } catch (parseError) {
      this.logger.warn('Failed to parse Claude response, using fallback analysis');
      return this.fallbackAnalysis(originalQuery);
    }
  }

  /**
   * Normalize intent string to valid enum value
   */
  private normalizeIntent(intent: string): IntentAnalysis['intent'] {
    const normalized = String(intent || '').toLowerCase().trim();
    const validIntents: IntentAnalysis['intent'][] = [
      'create', 'modify', 'fix', 'delete', 'understand', 'analyze', 'search', 'general'
    ];

    if (validIntents.includes(normalized as IntentAnalysis['intent'])) {
      return normalized as IntentAnalysis['intent'];
    }

    // Map common variations
    const mappings: Record<string, IntentAnalysis['intent']> = {
      'add': 'create',
      'new': 'create',
      'implement': 'create',
      'build': 'create',
      'change': 'modify',
      'update': 'modify',
      'refactor': 'modify',
      'edit': 'modify',
      'bug': 'fix',
      'error': 'fix',
      'debug': 'fix',
      'repair': 'fix',
      'remove': 'delete',
      'explain': 'understand',
      'what': 'understand',
      'how': 'understand',
      'why': 'understand',
      'find': 'search',
      'locate': 'search',
      'where': 'search'
    };

    return mappings[normalized] || 'general';
  }

  /**
   * Fallback analysis when Claude is unavailable
   * This is minimal and should rarely be used
   */
  private fallbackAnalysis(query: string): IntentAnalysis {
    this.logger.debug('Using fallback intent analysis');

    return {
      intent: 'general',
      confidence: 0.5,
      reasoning: 'Fallback analysis - Claude unavailable',
      requiresModifications: false,
      assumptions: [],
      ambiguities: ['Query intent could not be determined automatically'],
      suggestedClarifications: ['What specifically would you like me to do with this request?'],
      targetEntities: [],
      actionVerbs: []
    };
  }

  /**
   * Quick check if query is a natural language request (vs a command)
   * This is a simple heuristic check, not AI-based
   */
  isNaturalLanguageQuery(input: string): boolean {
    const trimmed = input.trim();

    // Known commands start with these
    const knownCommands = new Set([
      'help', 'exit', 'quit', 'status', 'setup', 'init', 'project', 'sync',
      'search', 'analyze', 'dedup', 'solid', 'docs', 'instructions', 'watch', 'watcher'
    ]);

    const firstWord = trimmed.split(' ')[0].toLowerCase();
    if (knownCommands.has(firstWord)) {
      return false;
    }

    // If it's longer than a typical command, assume it's natural language
    return trimmed.length > 2;
  }

  /**
   * Decompose a complex query into sub-tasks using Claude
   * This replaces all hardcoded keyword matching for task decomposition
   */
  async decomposeQuery(query: string, intentAnalysis: IntentAnalysis): Promise<DecompositionResult> {
    try {
      const prompt = this.buildDecompositionPrompt(query, intentAnalysis);

      this.logger.debug('🔀 Decomposing query with Claude...');

      const result = await ClaudeCodeExecutor.execute(prompt, {
        outputFormat: 'json',
        maxTokens: 3000,
        timeout: 45000 // 45 second timeout for decomposition
      });

      if (!result.success || !result.data) {
        this.logger.warn('Claude task decomposition failed, using fallback');
        return {
          success: true,
          decomposition: this.fallbackDecomposition(query, intentAnalysis),
          fallbackUsed: true
        };
      }

      const decomposition = this.parseDecompositionResponse(result.data, query, intentAnalysis);

      return {
        success: true,
        decomposition,
        fallbackUsed: false
      };

    } catch (error) {
      this.logger.error(`Task decomposition error: ${error instanceof Error ? error.message : error}`);
      return {
        success: true,
        decomposition: this.fallbackDecomposition(query, intentAnalysis),
        fallbackUsed: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build the prompt for Claude to decompose the query into sub-tasks
   */
  private buildDecompositionPrompt(query: string, intentAnalysis: IntentAnalysis): string {
    return `You are a task decomposition expert for a code assistant. Analyze the following user query and determine if it should be split into multiple sub-tasks.

User Query: "${query}"

Detected Intent: ${intentAnalysis.intent}
Target Entities: ${intentAnalysis.targetEntities.join(', ') || 'none detected'}
Action Verbs: ${intentAnalysis.actionVerbs.join(', ') || 'none detected'}

Analyze this query and respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "isComplex": true|false,
  "reasoning": "Brief explanation of why this is/isn't complex",
  "subTasks": [
    {
      "id": 1,
      "type": "analyze|create|modify|refactor|test|fix|document|configure|general",
      "description": "Clear description of what this sub-task should accomplish",
      "searchTerms": ["terms", "to", "search", "for"],
      "priority": 1,
      "dependencies": [],
      "complexity": "low|medium|high"
    }
  ]
}

Task Type Definitions:
- "analyze": Understanding, reviewing, or explaining code
- "create": Adding new files, classes, functions, or features
- "modify": Changing existing code without restructuring
- "refactor": Restructuring code for better design (e.g., SOLID compliance)
- "test": Writing or updating tests
- "fix": Bug fixes or error resolution
- "document": Documentation updates
- "configure": Configuration or setup changes
- "general": Other tasks

Guidelines for decomposition:
1. A query is "complex" if it contains MULTIPLE DISTINCT ACTIONS or MULTI-PART CONCEPTS
2. Domain concepts should be expanded:
   - "SOLID principles" = 5 separate sub-tasks (S, O, L, I, D)
   - "CRUD operations" = 4 separate sub-tasks (Create, Read, Update, Delete)
   - "authentication flow" = login, logout, registration, password reset
3. Each sub-task should be FOCUSED on ONE thing
4. Dependencies: later tasks may depend on earlier ones (e.g., tests depend on implementation)
5. Priority: 1 = do first, higher numbers = do later
6. If query is simple (single action, single target), set isComplex: false with ONE sub-task

Examples:
- "add a button" → isComplex: false, 1 sub-task
- "add a button and write tests" → isComplex: true, 2 sub-tasks
- "make this SOLID compliant" → isComplex: true, 5 sub-tasks (one per principle)
- "implement user auth" → isComplex: true, multiple sub-tasks (register, login, logout, etc.)

Respond with ONLY the JSON object, no other text.`;
  }

  /**
   * Parse Claude's decomposition response
   */
  private parseDecompositionResponse(response: string, originalQuery: string, intentAnalysis: IntentAnalysis): TaskDecomposition {
    try {
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and normalize
      const subTasks: DecomposedTask[] = (parsed.subTasks || []).map((task: any, index: number) => ({
        id: task.id || index + 1,
        type: this.normalizeTaskType(task.type),
        description: String(task.description || ''),
        searchTerms: Array.isArray(task.searchTerms) ? task.searchTerms.map(String) : [],
        priority: Number(task.priority) || index + 1,
        dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(Number) : [],
        complexity: this.normalizeComplexity(task.complexity)
      }));

      return {
        isComplex: Boolean(parsed.isComplex),
        reasoning: String(parsed.reasoning || ''),
        subTasks: subTasks.length > 0 ? subTasks : [this.createSingleTask(originalQuery, intentAnalysis)]
      };

    } catch (parseError) {
      this.logger.warn('Failed to parse decomposition response, using fallback');
      return this.fallbackDecomposition(originalQuery, intentAnalysis);
    }
  }

  /**
   * Normalize task type to valid enum value
   */
  private normalizeTaskType(type: string): DecomposedTask['type'] {
    const normalized = String(type || '').toLowerCase().trim();
    const validTypes: DecomposedTask['type'][] = [
      'analyze', 'create', 'modify', 'refactor', 'test', 'fix', 'document', 'configure', 'general'
    ];

    if (validTypes.includes(normalized as DecomposedTask['type'])) {
      return normalized as DecomposedTask['type'];
    }

    return 'general';
  }

  /**
   * Normalize complexity level
   */
  private normalizeComplexity(complexity: string): DecomposedTask['complexity'] {
    const normalized = String(complexity || '').toLowerCase().trim();
    if (['low', 'medium', 'high'].includes(normalized)) {
      return normalized as DecomposedTask['complexity'];
    }
    return 'medium';
  }

  /**
   * Create a single task from the original query
   */
  private createSingleTask(query: string, intentAnalysis: IntentAnalysis): DecomposedTask {
    // Map intent to task type
    const intentToType: Record<string, DecomposedTask['type']> = {
      'create': 'create',
      'modify': 'modify',
      'fix': 'fix',
      'delete': 'modify',
      'understand': 'analyze',
      'analyze': 'analyze',
      'search': 'analyze',
      'general': 'general'
    };

    return {
      id: 1,
      type: intentToType[intentAnalysis.intent] || 'general',
      description: query,
      searchTerms: intentAnalysis.targetEntities,
      priority: 1,
      dependencies: [],
      complexity: 'medium'
    };
  }

  /**
   * Fallback decomposition when Claude is unavailable
   */
  private fallbackDecomposition(query: string, intentAnalysis: IntentAnalysis): TaskDecomposition {
    this.logger.debug('Using fallback task decomposition');

    return {
      isComplex: false,
      reasoning: 'Fallback decomposition - Claude unavailable',
      subTasks: [this.createSingleTask(query, intentAnalysis)]
    };
  }
}
