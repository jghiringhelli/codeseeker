/**
 * Context-Aware Clarification Service
 * Single Responsibility: Generate intelligent clarification questions AFTER research phase
 *
 * This service analyzes the semantic search results and code relationships to generate
 * specific, actionable questions that help clarify user intent before Claude Code executes.
 *
 * Key Principle: Ask questions based on ACTUAL codebase state, not generic patterns.
 */

import inquirer from 'inquirer';
import * as readline from 'readline';
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';
import { QueryAnalysis } from './natural-language-processor';
import { Logger } from '../../../utils/logger';

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'choice' | 'confirm' | 'input';
  choices?: string[];
  context: string; // Why this question is being asked
  impact: 'high' | 'medium' | 'low'; // How much this affects execution
}

export interface ClarificationResult {
  questionsAsked: number;
  questionsAnswered: number;
  clarifications: Map<string, string>;
  enhancedQuery: string;
  skipped: boolean;
}

export interface AmbiguityDetection {
  type: 'multiple_implementations' | 'unclear_target' | 'missing_pattern' | 'conflicting_approaches' | 'scope_unclear';
  description: string;
  relatedFiles: string[];
  suggestedQuestion: ClarificationQuestion;
}

export class ContextAwareClarificationService {
  private rl?: readline.Interface;

  /**
   * Set readline interface for pausing during prompts
   */
  setReadlineInterface(rl: readline.Interface): void {
    this.rl = rl;
  }

  /**
   * Analyze context and generate clarification questions if needed
   * This runs AFTER semantic search and relationship analysis
   */
  async analyzeAndClarify(
    query: string,
    queryAnalysis: QueryAnalysis,
    semanticResults: SemanticResult[],
    graphContext: GraphContext,
    options: { skipClarification?: boolean; maxQuestions?: number } = {}
  ): Promise<ClarificationResult> {
    if (options.skipClarification) {
      return this.createSkippedResult(query);
    }

    // Detect ambiguities based on actual research results
    const ambiguities = this.detectAmbiguities(query, queryAnalysis, semanticResults, graphContext);

    if (ambiguities.length === 0) {
      return this.createSkippedResult(query);
    }

    // Generate questions from detected ambiguities
    const questions = ambiguities
      .sort((a, b) => this.impactScore(b.suggestedQuestion.impact) - this.impactScore(a.suggestedQuestion.impact))
      .slice(0, options.maxQuestions || 3)
      .map(a => a.suggestedQuestion);

    // Display what we found and ask questions
    console.log('\n┌─ 🔍 Pre-Execution Clarification ────────────────────────────┐');
    console.log('│ Based on the codebase analysis, I have some questions that');
    console.log('│ will help ensure the best approach:');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const clarifications = await this.askQuestions(questions);

    // Build enhanced query with clarifications
    const enhancedQuery = this.buildEnhancedQuery(query, clarifications);

    return {
      questionsAsked: questions.length,
      questionsAnswered: clarifications.size,
      clarifications,
      enhancedQuery,
      skipped: false
    };
  }

  /**
   * Detect ambiguities based on actual codebase context
   */
  private detectAmbiguities(
    query: string,
    queryAnalysis: QueryAnalysis,
    semanticResults: SemanticResult[],
    graphContext: GraphContext
  ): AmbiguityDetection[] {
    const ambiguities: AmbiguityDetection[] = [];
    const lowerQuery = query.toLowerCase();

    // 1. Multiple implementations of similar functionality
    // Only relevant for CREATE intent - for modify/refactor, we'll ask about target files instead
    const similarClasses = this.findSimilarImplementations(semanticResults, graphContext);
    if (similarClasses.length > 1 && queryAnalysis.intent === 'create') {
      // Format class list with descriptions for better context
      const classListWithDescriptions = similarClasses.map((c, i) => {
        const desc = c.description ? `\n      ${c.description}` : '';
        return `  ${i + 1}. ${c.name} (${c.file})${desc}`;
      }).join('\n');

      ambiguities.push({
        type: 'multiple_implementations',
        description: `Found ${similarClasses.length} similar implementations`,
        relatedFiles: similarClasses.map(c => c.file),
        suggestedQuestion: {
          id: 'impl_choice',
          question: `Your request "${query}" will CREATE new code.\n\nI found ${similarClasses.length} existing implementations with similar patterns:\n${classListWithDescriptions}\n\nWhich existing code should Claude use as a REFERENCE for style and structure?`,
          type: 'choice',
          choices: [...similarClasses.map(c => `Use ${c.name} as reference`), 'Create fresh (no reference)', 'Let Claude decide'],
          context: 'Choosing a reference helps Claude match your existing code style and patterns',
          impact: 'high'
        }
      });
    }

    // 2. Unclear target when modifying
    if (queryAnalysis.intent === 'modify' || queryAnalysis.intent === 'fix') {
      const potentialTargets = semanticResults.filter(r => r.similarity > 0.7);
      if (potentialTargets.length > 3) {
        // Explain the action that will be taken
        const actionExplanation = queryAnalysis.intent === 'fix'
          ? `Claude will FIX/DEBUG the selected file(s) based on your request.`
          : `Claude will MODIFY the selected file(s) to: "${query}"`;

        // Build file list with descriptions from graphContext
        const fileListWithDescriptions = potentialTargets.slice(0, 5).map((r, i) => {
          // Find matching class from graphContext for description
          const classInfo = graphContext.classes?.find(c =>
            c.filePath === r.file ||
            r.file.toLowerCase().includes(c.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase().substring(1))
          );
          const description = classInfo?.description || r.type || 'unknown';
          const similarity = (r.similarity * 100).toFixed(0);
          return `  ${i + 1}. ${r.file} (${similarity}% match)\n      ${description}`;
        }).join('\n');

        ambiguities.push({
          type: 'unclear_target',
          description: 'Multiple files could be the modification target',
          relatedFiles: potentialTargets.slice(0, 5).map(r => r.file),
          suggestedQuestion: {
            id: 'target_file',
            question: `${actionExplanation}\n\nSeveral files match your request. Which should be modified?\n${fileListWithDescriptions}`,
            type: 'choice',
            choices: [...potentialTargets.slice(0, 5).map(r => r.file), 'All of them', 'Let Claude decide'],
            context: 'Select the file(s) that Claude will modify. Others will be used as context only.',
            impact: 'high'
          }
        });
      }
    }

    // 3. Creating something that might already exist
    if (queryAnalysis.intent === 'create') {
      const existingPatterns = this.findExistingPatterns(query, semanticResults, graphContext);
      if (existingPatterns.length > 0) {
        // Format patterns list with descriptions
        const patternsWithDescriptions = existingPatterns.slice(0, 3).map((p, i) => {
          const desc = p.description ? `\n      ${p.description}` : '';
          return `  ${i + 1}. ${p.name} in ${p.file}${desc}`;
        }).join('\n');

        ambiguities.push({
          type: 'conflicting_approaches',
          description: 'Similar functionality might already exist',
          relatedFiles: existingPatterns.map(p => p.file),
          suggestedQuestion: {
            id: 'existing_pattern',
            question: `Your request "${query}" may duplicate existing functionality.\n\nI found similar code:\n${patternsWithDescriptions}\n\n• "Extend existing" → Claude will ADD to the existing code\n• "Create new" → Claude will CREATE separate, new code\n\nWhat should Claude do?`,
            type: 'choice',
            choices: ['Extend existing code', 'Create new (separate)', 'Show me the existing code first'],
            context: 'This choice determines whether Claude adds to existing files or creates new ones',
            impact: 'medium'
          }
        });
      }
    }

    // 4. Scope unclear for broad queries
    if (this.isBroadQuery(query) && semanticResults.length > 10) {
      ambiguities.push({
        type: 'scope_unclear',
        description: 'Query scope is broad with many matching files',
        relatedFiles: semanticResults.slice(0, 5).map(r => r.file),
        suggestedQuestion: {
          id: 'scope',
          question: `Your request "${query}" matches ${semanticResults.length} files.\n\n• "Top 5" → Claude will ONLY modify the 5 most relevant files\n• "All files" → Claude MAY modify all ${semanticResults.length} matching files\n• "Specify" → You choose which directory to focus on\n\nHow many files should Claude be allowed to modify?`,
          type: 'choice',
          choices: ['Focus on top 5 most relevant', 'Work across all files', 'Let me specify a directory'],
          context: 'This limits which files Claude can modify. More files = larger changes.',
          impact: 'medium'
        }
      });
    }

    // 5. Test-related queries without clear test strategy
    if ((lowerQuery.includes('test') || lowerQuery.includes('spec')) && queryAnalysis.intent === 'create') {
      const existingTestPatterns = semanticResults.filter(r =>
        r.file.includes('.test.') || r.file.includes('.spec.') || r.file.includes('__tests__')
      );
      if (existingTestPatterns.length > 0) {
        const testFramework = this.detectTestFramework(existingTestPatterns);
        ambiguities.push({
          type: 'missing_pattern',
          description: 'Test creation needs pattern clarification',
          relatedFiles: existingTestPatterns.slice(0, 3).map(r => r.file),
          suggestedQuestion: {
            id: 'test_pattern',
            question: `Claude will CREATE new tests using ${testFramework}.\n\n• "Unit" → Isolated tests with mocked dependencies\n• "Integration" → Tests with real database/services\n• "Follow existing" → Match pattern from ${existingTestPatterns[0]?.file || 'tests/'}\n\nWhat type of tests should Claude create?`,
            type: 'choice',
            choices: ['Unit tests', 'Integration tests', 'Follow existing pattern', 'Both unit and integration'],
            context: 'This determines how Claude structures the test files',
            impact: 'medium'
          }
        });
      }
    }

    return ambiguities;
  }

  /**
   * Find similar implementations in the codebase
   */
  private findSimilarImplementations(
    semanticResults: SemanticResult[],
    graphContext: GraphContext
  ): Array<{ name: string; file: string; type: string; description: string }> {
    const implementations: Array<{ name: string; file: string; type: string; description: string }> = [];

    // Group by similar types/patterns
    const classGroups = new Map<string, typeof implementations>();

    for (const cls of graphContext.classes || []) {
      // Extract pattern from class name (e.g., "AuthService" -> "Service")
      const pattern = cls.name.replace(/^[A-Z][a-z]+/, '');
      if (!classGroups.has(pattern)) {
        classGroups.set(pattern, []);
      }
      classGroups.get(pattern)!.push({
        name: cls.name,
        file: cls.filePath || '',
        type: cls.type,
        description: cls.description || ''
      });
    }

    // Return groups with multiple implementations
    for (const [, group] of classGroups) {
      if (group.length > 1) {
        implementations.push(...group);
      }
    }

    return implementations.slice(0, 5);
  }

  /**
   * Find existing patterns that might overlap with the request
   */
  private findExistingPatterns(
    query: string,
    semanticResults: SemanticResult[],
    graphContext: GraphContext
  ): Array<{ name: string; file: string; description: string }> {
    const patterns: Array<{ name: string; file: string; description: string }> = [];
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    for (const cls of graphContext.classes || []) {
      const nameLower = cls.name.toLowerCase();
      const matchCount = queryWords.filter(w => nameLower.includes(w)).length;
      if (matchCount >= 1) {
        patterns.push({
          name: cls.name,
          file: cls.filePath || '',
          description: cls.description || ''
        });
      }
    }

    return patterns.slice(0, 5);
  }

  /**
   * Check if query is too broad
   */
  private isBroadQuery(query: string): boolean {
    const broadIndicators = [
      'all', 'every', 'across', 'throughout', 'entire', 'whole',
      'refactor', 'update', 'change', 'improve', 'optimize'
    ];
    const lowerQuery = query.toLowerCase();
    return broadIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  /**
   * Detect test framework from file patterns
   */
  private detectTestFramework(testFiles: SemanticResult[]): string {
    const fileContent = testFiles.map(f => f.file.toLowerCase()).join(' ');
    if (fileContent.includes('jest') || fileContent.includes('.test.')) return 'Jest';
    if (fileContent.includes('mocha') || fileContent.includes('.spec.')) return 'Mocha';
    if (fileContent.includes('vitest')) return 'Vitest';
    return 'a testing framework';
  }

  /**
   * Ask clarification questions interactively
   */
  private async askQuestions(questions: ClarificationQuestion[]): Promise<Map<string, string>> {
    const clarifications = new Map<string, string>();

    if (this.rl) {
      this.rl.pause();
    }
    Logger.mute();

    try {
      for (const question of questions) {
        const answer = await this.askSingleQuestion(question);
        if (answer && answer !== 'Let Claude decide') {
          clarifications.set(question.id, answer);
        }
      }
    } finally {
      Logger.unmute();
      if (this.rl) {
        this.rl.resume();
      }
    }

    return clarifications;
  }

  /**
   * Ask a single question based on type
   */
  private async askSingleQuestion(question: ClarificationQuestion): Promise<string> {
    console.log(`\n💡 ${question.context}\n`);

    try {
      if (question.type === 'choice' && question.choices) {
        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'response',
          message: question.question,
          choices: question.choices
        }]);
        return answer.response;
      } else if (question.type === 'confirm') {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'response',
          message: question.question,
          default: true
        }]);
        return answer.response ? 'yes' : 'no';
      } else {
        const answer = await inquirer.prompt([{
          type: 'input',
          name: 'response',
          message: question.question
        }]);
        return answer.response;
      }
    } catch (error: any) {
      // Handle Ctrl+C gracefully - treat as skip
      if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
        console.log('\n⚠️  Prompt cancelled');
        return 'Let Claude decide'; // Skip this question
      }
      throw error;
    }
  }

  /**
   * Build enhanced query incorporating clarifications
   */
  private buildEnhancedQuery(originalQuery: string, clarifications: Map<string, string>): string {
    if (clarifications.size === 0) {
      return originalQuery;
    }

    const clarificationText = Array.from(clarifications.entries())
      .map(([id, answer]) => `- ${this.formatClarification(id, answer)}`)
      .join('\n');

    return `${originalQuery}

## User Clarifications (from codebase analysis):
${clarificationText}`;
  }

  /**
   * Format a clarification for the enhanced query
   */
  private formatClarification(id: string, answer: string): string {
    const labels: Record<string, string> = {
      'impl_choice': 'Implementation approach',
      'target_file': 'Target file',
      'existing_pattern': 'Existing code strategy',
      'scope': 'Scope',
      'test_pattern': 'Test strategy'
    };
    return `${labels[id] || id}: ${answer}`;
  }

  /**
   * Get impact score for sorting
   */
  private impactScore(impact: 'high' | 'medium' | 'low'): number {
    return { high: 3, medium: 2, low: 1 }[impact];
  }

  /**
   * Create a skipped result
   */
  private createSkippedResult(query: string): ClarificationResult {
    return {
      questionsAsked: 0,
      questionsAnswered: 0,
      clarifications: new Map(),
      enhancedQuery: query,
      skipped: true
    };
  }
}
