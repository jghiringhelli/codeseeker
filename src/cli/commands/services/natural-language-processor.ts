/**
 * Natural Language Processor Service
 * Single Responsibility: Process and analyze natural language queries
 * Handles assumption detection and ambiguity analysis
 */

export interface QueryAnalysis {
  assumptions: string[];
  ambiguities: string[];
  intent: string;
  confidence: number;
}

export class NaturalLanguageProcessor {
  // Cache expensive pattern compilations and arrays for better performance
  private static readonly KNOWN_COMMANDS = new Set([
    'help', 'exit', 'quit', 'status', 'setup', 'init', 'project', 'sync',
    'search', 'analyze', 'dedup', 'solid', 'docs', 'instructions', 'watch', 'watcher'
  ]);

  // Removed pattern matching - let Claude Code be the brain for everything

  // Removed assumption patterns - let Claude Code detect and clarify assumptions

  // Removed ambiguity patterns - let Claude Code detect and clarify ambiguities

  /**
   * Analyze user query using Claude Code CLI as the brain
   * This will be called by the workflow orchestrator which will use Claude Code to detect:
   * - Intent, assumptions, and ambiguities
   * - For now, return minimal analysis and let Claude Code handle the complexity
   */
  analyzeQuery(query: string): QueryAnalysis {
    // Simple, lightweight analysis - let Claude Code be the brain for everything else
    return {
      assumptions: [], // Claude Code will detect these
      ambiguities: [], // Claude Code will detect these
      intent: 'general', // Claude Code will determine the real intent
      confidence: 80.0 // Default confidence, Claude Code will refine this
    };
  }

  /**
   * Determine if input is a natural language query vs a command
   */
  isNaturalLanguageQuery(input: string): boolean {
    const trimmed = input.trim();

    // Use cached command set for O(1) lookup - if it starts with a known command, it's not natural language
    const firstWord = trimmed.split(' ')[0].toLowerCase();
    if (NaturalLanguageProcessor.KNOWN_COMMANDS.has(firstWord)) {
      return false;
    }

    // If it's not a known command and longer than a typical command, assume it's natural language
    // Let Claude Code be the brain to decide what to do with it
    return trimmed.length > 2;
  }

  // Removed all pattern-based helper methods - Claude Code will handle intent detection, confidence calculation, etc.
}