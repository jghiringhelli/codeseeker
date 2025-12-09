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
}
