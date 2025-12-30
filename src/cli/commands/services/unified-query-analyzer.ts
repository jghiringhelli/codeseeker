/**
 * Unified Query Analyzer Service
 * Single Responsibility: ONE Claude call for query analysis, intent detection, and complexity assessment
 *
 * This replaces the separate NaturalLanguageProcessor + TaskDecompositionService + ClaudeIntentAnalyzer
 * with a single, efficient Claude call that provides all needed information.
 *
 * Benefits:
 * - 50% faster startup (one Claude call instead of two)
 * - Simpler code path
 * - Better consistency (same Claude instance analyzes everything)
 * - Natural clarification handling (Claude asks if truly needed)
 */

import { ClaudeCodeExecutor } from '../../services/claude/claude-code-executor';
import { Logger } from '../../../utils/logger';

export interface UnifiedAnalysis {
  // Intent
  intent: 'create' | 'modify' | 'fix' | 'delete' | 'understand' | 'analyze' | 'search' | 'general';
  confidence: number;

  // Complexity
  isComplex: boolean;
  subTasks: SubTask[];

  // Context
  targetEntities: string[];
  searchTerms: string[];

  // Clarification (Claude asks if truly critical)
  clarificationNeeded: boolean;
  clarificationQuestion?: string;

  // Summary for logging
  reasoning: string;
}

export interface SubTask {
  id: number;
  type: 'analyze' | 'create' | 'modify' | 'refactor' | 'test' | 'fix' | 'document' | 'configure' | 'general';
  description: string;
  searchTerms: string[];
  priority: number;
  dependencies: number[];
}

export interface UnifiedAnalysisResult {
  success: boolean;
  analysis: UnifiedAnalysis;
  fallbackUsed?: boolean;
  error?: string;
}

export class UnifiedQueryAnalyzer {
  private logger = Logger.getInstance();
  private static instance: UnifiedQueryAnalyzer;

  static getInstance(): UnifiedQueryAnalyzer {
    if (!UnifiedQueryAnalyzer.instance) {
      UnifiedQueryAnalyzer.instance = new UnifiedQueryAnalyzer();
    }
    return UnifiedQueryAnalyzer.instance;
  }

  /**
   * Analyze query in ONE Claude call - intent + complexity + clarification
   */
  async analyzeQuery(query: string, projectContext?: string): Promise<UnifiedAnalysisResult> {
    try {
      const prompt = this.buildUnifiedPrompt(query, projectContext);

      this.logger.debug('🧠 Analyzing query...');

      const result = await ClaudeCodeExecutor.execute(prompt, {
        outputFormat: 'json',
        maxTokens: 2000,
        timeout: 30000
      });

      if (!result.success || !result.data) {
        this.logger.warn('Query analysis failed, using fallback');
        return {
          success: true,
          analysis: this.fallbackAnalysis(query),
          fallbackUsed: true
        };
      }

      const analysis = this.parseResponse(result.data, query);
      return {
        success: true,
        analysis,
        fallbackUsed: false
      };

    } catch (error) {
      this.logger.error(`Analysis error: ${error instanceof Error ? error.message : error}`);
      return {
        success: true,
        analysis: this.fallbackAnalysis(query),
        fallbackUsed: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build unified prompt that does everything in one call
   */
  private buildUnifiedPrompt(query: string, projectContext?: string): string {
    const contextSection = projectContext ? `\nProject Context: ${projectContext}` : '';

    return `Analyze this user query for a code assistant CLI. Respond with ONLY a JSON object.

Query: "${query}"${contextSection}

Respond with this exact JSON structure:
{
  "intent": "create|modify|fix|delete|understand|analyze|search|general",
  "confidence": 0.0-1.0,
  "isComplex": true|false,
  "subTasks": [
    {
      "id": 1,
      "type": "analyze|create|modify|refactor|test|fix|document|configure|general",
      "description": "What this task does",
      "searchTerms": ["relevant", "search", "terms"],
      "priority": 1,
      "dependencies": []
    }
  ],
  "targetEntities": ["class names", "file names", "function names mentioned"],
  "searchTerms": ["key", "terms", "to", "search"],
  "clarificationNeeded": false,
  "clarificationQuestion": null,
  "reasoning": "Brief one-line explanation"
}

Guidelines:
1. Intent: What the user wants (create=new code, modify=change existing, fix=debug, etc.)
2. isComplex: TRUE only if multiple DISTINCT actions needed (e.g., "add X and test it" = 2 tasks)
3. subTasks: For simple queries, just ONE task. For complex, break into focused steps.
4. clarificationNeeded: Usually FALSE. Only TRUE when there's a CLEAR ambiguity that would lead to wrong action.
   - "SOLIDify this codebase" → FALSE (proceed with full analysis + refactoring)
   - "fix the auth bug" → TRUE (which bug specifically?)
   - "add a feature" → TRUE (what feature?)
   - "analyze the project" → FALSE (analyze everything)
5. confidence: 0.7-0.9 for clear requests, 0.5-0.7 for somewhat ambiguous, below 0.5 only for truly vague.

Keep clarification questions SPECIFIC and ACTIONABLE. One question max.
Respond with ONLY the JSON, no markdown or explanation.`;
  }

  /**
   * Parse Claude's response
   */
  private parseResponse(response: string, originalQuery: string): UnifiedAnalysis {
    try {
      let jsonStr = response.trim();

      // Remove markdown if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Normalize subTasks
      const subTasks: SubTask[] = (parsed.subTasks || []).map((task: any, index: number) => ({
        id: task.id || index + 1,
        type: this.normalizeTaskType(task.type),
        description: String(task.description || originalQuery),
        searchTerms: Array.isArray(task.searchTerms) ? task.searchTerms.map(String) : [],
        priority: Number(task.priority) || index + 1,
        dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(Number) : []
      }));

      // Ensure at least one subTask
      if (subTasks.length === 0) {
        subTasks.push({
          id: 1,
          type: this.normalizeIntent(parsed.intent) as SubTask['type'],
          description: originalQuery,
          searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [],
          priority: 1,
          dependencies: []
        });
      }

      return {
        intent: this.normalizeIntent(parsed.intent),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
        isComplex: Boolean(parsed.isComplex) && subTasks.length > 1,
        subTasks,
        targetEntities: Array.isArray(parsed.targetEntities) ? parsed.targetEntities.map(String) : [],
        searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms.map(String) : [],
        clarificationNeeded: Boolean(parsed.clarificationNeeded),
        clarificationQuestion: parsed.clarificationQuestion || undefined,
        reasoning: String(parsed.reasoning || '')
      };

    } catch (parseError) {
      this.logger.warn('Failed to parse analysis response');
      return this.fallbackAnalysis(originalQuery);
    }
  }

  /**
   * Normalize intent to valid value
   */
  private normalizeIntent(intent: string): UnifiedAnalysis['intent'] {
    const normalized = String(intent || '').toLowerCase().trim();
    const valid: UnifiedAnalysis['intent'][] = [
      'create', 'modify', 'fix', 'delete', 'understand', 'analyze', 'search', 'general'
    ];

    if (valid.includes(normalized as UnifiedAnalysis['intent'])) {
      return normalized as UnifiedAnalysis['intent'];
    }

    // Map common variations
    const mappings: Record<string, UnifiedAnalysis['intent']> = {
      'add': 'create', 'new': 'create', 'implement': 'create', 'build': 'create',
      'change': 'modify', 'update': 'modify', 'refactor': 'modify', 'edit': 'modify',
      'bug': 'fix', 'error': 'fix', 'debug': 'fix', 'repair': 'fix',
      'remove': 'delete',
      'explain': 'understand', 'what': 'understand', 'how': 'understand', 'why': 'understand',
      'find': 'search', 'locate': 'search', 'where': 'search'
    };

    return mappings[normalized] || 'general';
  }

  /**
   * Normalize task type
   */
  private normalizeTaskType(type: string): SubTask['type'] {
    const normalized = String(type || '').toLowerCase().trim();
    const valid: SubTask['type'][] = [
      'analyze', 'create', 'modify', 'refactor', 'test', 'fix', 'document', 'configure', 'general'
    ];

    if (valid.includes(normalized as SubTask['type'])) {
      return normalized as SubTask['type'];
    }
    return 'general';
  }

  /**
   * Fallback when Claude is unavailable
   */
  private fallbackAnalysis(query: string): UnifiedAnalysis {
    // Simple keyword detection for fallback
    const lowerQuery = query.toLowerCase();

    let intent: UnifiedAnalysis['intent'] = 'general';
    if (lowerQuery.includes('create') || lowerQuery.includes('add') || lowerQuery.includes('new')) {
      intent = 'create';
    } else if (lowerQuery.includes('fix') || lowerQuery.includes('bug') || lowerQuery.includes('error')) {
      intent = 'fix';
    } else if (lowerQuery.includes('change') || lowerQuery.includes('update') || lowerQuery.includes('modify')) {
      intent = 'modify';
    } else if (lowerQuery.includes('explain') || lowerQuery.includes('what') || lowerQuery.includes('how')) {
      intent = 'understand';
    }

    // Extract potential entities (capitalized words, quoted strings)
    const entities: string[] = [];
    const quoted = query.match(/"([^"]+)"|'([^']+)'/g);
    if (quoted) {
      entities.push(...quoted.map(s => s.replace(/['"]/g, '')));
    }
    const capitalized = query.match(/\b[A-Z][a-zA-Z]+\b/g);
    if (capitalized) {
      entities.push(...capitalized.filter(w => !['I', 'The', 'A', 'An'].includes(w)));
    }

    return {
      intent,
      confidence: 0.6,
      isComplex: false,
      subTasks: [{
        id: 1,
        type: intent === 'fix' ? 'fix' : intent === 'create' ? 'create' : 'general',
        description: query,
        searchTerms: entities.slice(0, 5),
        priority: 1,
        dependencies: []
      }],
      targetEntities: entities.slice(0, 5),
      searchTerms: entities.slice(0, 5),
      clarificationNeeded: false,
      reasoning: 'Fallback analysis - Claude unavailable'
    };
  }

  /**
   * Quick check if input is natural language vs command
   * Natural language queries have multiple words and don't look like commands.
   * Single-word inputs matching known commands are treated as commands.
   * Multi-word inputs starting with a command word are natural language (e.g., "Analyze this codebase")
   */
  isNaturalLanguageQuery(input: string): boolean {
    const trimmed = input.trim();

    // Empty or very short inputs are not natural language
    if (trimmed.length <= 2) {
      return false;
    }

    // Known single-word commands
    const knownCommands = new Set([
      'help', 'exit', 'quit', 'status', 'setup', 'init', 'project', 'sync',
      'search', 'analyze', 'dedup', 'solid', 'docs', 'instructions', 'watch', 'watcher'
    ]);

    const words = trimmed.split(/\s+/);
    const firstWord = words[0].toLowerCase();

    // Single word that matches a known command = command
    // e.g., "analyze", "search", "help"
    if (words.length === 1 && knownCommands.has(firstWord)) {
      return false;
    }

    // Multi-word input = natural language (even if it starts with a command word)
    // e.g., "Analyze this codebase" or "search for authentication code" or "help me understand this"
    // Exception: command with simple argument like "search auth" (2 words, first is command)
    if (words.length === 2 && knownCommands.has(firstWord)) {
      // Could be "search auth" (command) or "search authentication" (NL)
      // If second word is short (< 5 chars), treat as command with arg
      if (words[1].length < 5) {
        return false;
      }
    }

    // Multi-word sentences are natural language
    return true;
  }
}
