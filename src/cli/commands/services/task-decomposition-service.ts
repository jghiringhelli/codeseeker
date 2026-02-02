/**
 * Task Decomposition Service
 * Single Responsibility: Delegate query decomposition to Claude for intelligent task splitting
 *
 * This service enables the "Task Split" capability where complex multi-part requests
 * are broken down into smaller, focused tasks. Each sub-task gets its own tailored
 * context from the semantic search and graph analysis.
 *
 * All decomposition logic is now delegated to ClaudeIntentAnalyzer, which uses
 * actual Claude AI to analyze and decompose queries instead of hardcoded patterns.
 *
 * Benefits:
 * - Better Focus: Claude concentrates on one thing at a time
 * - Optimized Context: Each sub-task gets precisely relevant files
 * - Reduced Token Usage: No wasted tokens on irrelevant context
 * - Improved Accuracy: AI-powered decomposition understands domain concepts
 */

import { QueryAnalysis } from './natural-language-processor';
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';
import { ClaudeIntentAnalyzer, DecomposedTask, TaskDecomposition } from './claude-intent-analyzer';

export interface SubTask {
  id: number;
  type: SubTaskType;
  description: string;
  searchTerms: string[];      // Terms to use for semantic search
  priority: number;           // Execution order (lower = first)
  dependencies: number[];     // IDs of tasks that must complete first
  contextFilter?: ContextFilter;  // How to filter context for this task
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export type SubTaskType =
  | 'analyze'       // Understanding/reading code
  | 'create'        // Creating new files/components
  | 'modify'        // Modifying existing code
  | 'refactor'      // Restructuring without changing behavior
  | 'test'          // Writing or running tests
  | 'fix'           // Bug fixes
  | 'document'      // Documentation updates
  | 'configure'     // Configuration changes
  | 'general';      // Catch-all

export interface ContextFilter {
  filePatterns?: string[];    // Glob patterns to include
  fileTypes?: string[];       // e.g., ['service', 'controller', 'test']
  relationshipTypes?: string[]; // e.g., ['imports', 'calls', 'extends']
  maxFiles?: number;          // Limit files per sub-task
}

export interface DecompositionResult {
  isComplex: boolean;         // Whether decomposition was needed
  originalQuery: string;
  subTasks: SubTask[];
  executionPlan: ExecutionPlan;
  reasoning?: string;         // Claude's explanation for decomposition
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalEstimatedSteps: number;
}

export interface ExecutionPhase {
  phaseNumber: number;
  taskIds: number[];          // Tasks that can run in this phase
  description: string;
}

export interface SubTaskContext {
  subTask: SubTask;
  semanticResults: SemanticResult[];
  graphContext: GraphContext;
  enhancedPrompt: string;
}

export class TaskDecompositionService {
  private claudeAnalyzer: ClaudeIntentAnalyzer;

  constructor() {
    this.claudeAnalyzer = ClaudeIntentAnalyzer.getInstance();
  }

  /**
   * Analyze a query and decompose it into sub-tasks using Claude
   * This is the async version that uses AI for intelligent decomposition
   */
  async decomposeQueryAsync(query: string, queryAnalysis: QueryAnalysis): Promise<DecompositionResult> {
    // Convert QueryAnalysis to IntentAnalysis format for ClaudeIntentAnalyzer
    const intentAnalysis = {
      intent: queryAnalysis.intent as any,
      confidence: queryAnalysis.confidence,
      reasoning: queryAnalysis.reasoning || '',
      requiresModifications: queryAnalysis.requiresModifications || false,
      assumptions: queryAnalysis.assumptions,
      ambiguities: queryAnalysis.ambiguities,
      suggestedClarifications: queryAnalysis.suggestedClarifications || [],
      targetEntities: queryAnalysis.targetEntities || [],
      actionVerbs: []
    };

    const result = await this.claudeAnalyzer.decomposeQuery(query, intentAnalysis);

    if (!result.success || !result.decomposition) {
      // Fallback to single task
      return this.createSingleTaskResult(query, queryAnalysis);
    }

    const decomposition = result.decomposition;
    const subTasks = this.convertToSubTasks(decomposition.subTasks);
    const executionPlan = this.createExecutionPlan(subTasks);

    return {
      isComplex: decomposition.isComplex,
      originalQuery: query,
      subTasks,
      executionPlan,
      reasoning: decomposition.reasoning
    };
  }

  /**
   * Synchronous version for backward compatibility
   * Returns single task - callers should migrate to decomposeQueryAsync
   */
  decomposeQuery(query: string, queryAnalysis: QueryAnalysis): DecompositionResult {
    // Synchronous version returns single task
    // The workflow orchestrator should use decomposeQueryAsync for Claude-based decomposition
    return this.createSingleTaskResult(query, queryAnalysis);
  }

  /**
   * Convert Claude's DecomposedTask format to our SubTask format
   */
  private convertToSubTasks(decomposedTasks: DecomposedTask[]): SubTask[] {
    return decomposedTasks.map(task => ({
      id: task.id,
      type: task.type as SubTaskType,
      description: task.description,
      searchTerms: task.searchTerms,
      priority: task.priority,
      dependencies: task.dependencies,
      contextFilter: this.createContextFilter(task.type as SubTaskType),
      estimatedComplexity: task.complexity
    }));
  }

  /**
   * Create a single task result for simple queries
   */
  private createSingleTaskResult(query: string, queryAnalysis: QueryAnalysis): DecompositionResult {
    const taskType = this.mapIntentToTaskType(queryAnalysis.intent);

    const subTask: SubTask = {
      id: 1,
      type: taskType,
      description: query,
      searchTerms: queryAnalysis.targetEntities || [],
      priority: 1,
      dependencies: [],
      contextFilter: this.createContextFilter(taskType),
      estimatedComplexity: 'medium'
    };

    return {
      isComplex: false,
      originalQuery: query,
      subTasks: [subTask],
      executionPlan: {
        phases: [{ phaseNumber: 1, taskIds: [1], description: 'Execute query' }],
        totalEstimatedSteps: 1
      }
    };
  }

  /**
   * Map intent to task type
   */
  private mapIntentToTaskType(intent: string): SubTaskType {
    const intentMap: Record<string, SubTaskType> = {
      'create': 'create',
      'modify': 'modify',
      'fix': 'fix',
      'delete': 'modify',
      'understand': 'analyze',
      'analyze': 'analyze',
      'search': 'analyze',
      'general': 'general'
    };

    return intentMap[intent] || 'general';
  }

  /**
   * Create context filter based on task type
   */
  private createContextFilter(taskType: SubTaskType): ContextFilter {
    const baseFilter: ContextFilter = {
      maxFiles: 10
    };

    switch (taskType) {
      case 'test':
        return {
          ...baseFilter,
          filePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*'],
          fileTypes: ['test', 'spec'],
          maxFiles: 8
        };
      case 'configure':
        return {
          ...baseFilter,
          filePatterns: ['**/*.config.*', '**/config/**/*', '**/*.json', '**/*.yaml', '**/*.yml'],
          fileTypes: ['configuration'],
          maxFiles: 6
        };
      case 'document':
        return {
          ...baseFilter,
          filePatterns: ['**/*.md', '**/docs/**/*', '**/README*'],
          fileTypes: ['documentation'],
          maxFiles: 5
        };
      case 'analyze':
        return {
          ...baseFilter,
          relationshipTypes: ['imports', 'extends', 'implements', 'calls'],
          maxFiles: 15
        };
      case 'refactor':
        return {
          ...baseFilter,
          relationshipTypes: ['imports', 'exports', 'extends', 'implements'],
          maxFiles: 12
        };
      default:
        return baseFilter;
    }
  }

  /**
   * Create execution plan from sub-tasks
   */
  private createExecutionPlan(subTasks: SubTask[]): ExecutionPlan {
    const phases: ExecutionPhase[] = [];
    const completedTasks = new Set<number>();
    let phaseNumber = 1;

    while (completedTasks.size < subTasks.length) {
      const readyTasks = subTasks.filter(task => {
        if (completedTasks.has(task.id)) return false;
        return task.dependencies.every(depId => completedTasks.has(depId));
      });

      if (readyTasks.length === 0) {
        // Circular dependency or bug - add remaining tasks
        const remainingTasks = subTasks.filter(t => !completedTasks.has(t.id));
        phases.push({
          phaseNumber,
          taskIds: remainingTasks.map(t => t.id),
          description: `Execute remaining tasks (phase ${phaseNumber})`
        });
        break;
      }

      phases.push({
        phaseNumber,
        taskIds: readyTasks.map(t => t.id),
        description: this.describePhase(readyTasks)
      });

      readyTasks.forEach(t => completedTasks.add(t.id));
      phaseNumber++;
    }

    return {
      phases,
      totalEstimatedSteps: subTasks.length
    };
  }

  /**
   * Generate human-readable phase description
   */
  private describePhase(tasks: SubTask[]): string {
    if (tasks.length === 1) {
      return tasks[0].description;
    }

    const types = [...new Set(tasks.map(t => t.type))];
    if (types.length === 1) {
      return `${types[0]} tasks (${tasks.length} items)`;
    }

    return `Multiple tasks: ${types.join(', ')}`;
  }

  /**
   * Filter semantic results for a specific sub-task
   */
  filterContextForSubTask(
    subTask: SubTask,
    allSemanticResults: SemanticResult[],
    allGraphContext: GraphContext
  ): SubTaskContext {
    const filter = subTask.contextFilter || {};

    // Filter semantic results
    let filteredResults = [...allSemanticResults];

    // Filter by file patterns
    if (filter.filePatterns && filter.filePatterns.length > 0) {
      filteredResults = filteredResults.filter(r =>
        filter.filePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return regex.test(r.file);
        })
      );
    }

    // Filter by file types
    if (filter.fileTypes && filter.fileTypes.length > 0) {
      filteredResults = filteredResults.filter(r =>
        filter.fileTypes.includes(r.type)
      );
    }

    // If filters produced no results, use search term matching
    if (filteredResults.length === 0) {
      filteredResults = allSemanticResults.filter(r => {
        const lowerFile = r.file.toLowerCase();
        const lowerContent = (r.content || '').toLowerCase();
        return subTask.searchTerms.some(term =>
          lowerFile.includes(term) || lowerContent.includes(term)
        );
      });
    }

    // Apply max files limit
    if (filter.maxFiles) {
      filteredResults = filteredResults.slice(0, filter.maxFiles);
    }

    // Filter graph context
    const filteredClasses = allGraphContext.classes?.filter(c => {
      const classFile = c.filePath?.toLowerCase() || '';
      return filteredResults.some(r =>
        classFile.includes(r.file.toLowerCase()) ||
        r.file.toLowerCase().includes(classFile)
      );
    }) || [];

    const filteredRelationships = allGraphContext.relationships?.filter(rel => {
      if (filter.relationshipTypes && !filter.relationshipTypes.includes(rel.type)) {
        return false;
      }
      return filteredClasses.some(c => c.name === rel.from || c.name === rel.to);
    }) || [];

    const filteredGraphContext: GraphContext = {
      classes: filteredClasses,
      relationships: filteredRelationships,
      relationshipDetails: filteredRelationships,
      packageStructure: allGraphContext.packageStructure,
      graphInsights: allGraphContext.graphInsights
    };

    // Build enhanced prompt for this sub-task
    const enhancedPrompt = this.buildSubTaskPrompt(subTask, filteredResults, filteredGraphContext);

    return {
      subTask,
      semanticResults: filteredResults,
      graphContext: filteredGraphContext,
      enhancedPrompt
    };
  }

  /**
   * Build an enhanced prompt for a specific sub-task
   */
  private buildSubTaskPrompt(
    subTask: SubTask,
    semanticResults: SemanticResult[],
    graphContext: GraphContext
  ): string {
    const parts: string[] = [];

    // Task description
    parts.push(`## Task: ${subTask.description}`);
    parts.push(`Type: ${subTask.type} | Complexity: ${subTask.estimatedComplexity}`);
    parts.push('');

    // Relevant files
    if (semanticResults.length > 0) {
      parts.push('### Relevant Files:');
      semanticResults.forEach(r => {
        parts.push(`- ${r.file} (${r.type}, ${(r.similarity * 100).toFixed(0)}% match)`);
      });
      parts.push('');
    }

    // Classes/Components
    if (graphContext.classes && graphContext.classes.length > 0) {
      parts.push('### Components:');
      graphContext.classes.forEach(c => {
        const location = c.filePath ? ` [${c.filePath}]` : '';
        parts.push(`- ${c.name}: ${c.type}${location}`);
      });
      parts.push('');
    }

    // Relationships
    if (graphContext.relationships && graphContext.relationships.length > 0) {
      parts.push('### Relationships:');
      graphContext.relationships.slice(0, 5).forEach(r => {
        parts.push(`- ${r.from} → ${r.to} (${r.type})`);
      });
      parts.push('');
    }

    // Instructions based on task type
    parts.push('### Instructions:');
    parts.push(this.getTaskTypeInstructions(subTask.type));

    return parts.join('\n');
  }

  /**
   * Get specific instructions based on task type
   */
  private getTaskTypeInstructions(taskType: SubTaskType): string {
    switch (taskType) {
      case 'analyze':
        return 'Focus on understanding the code structure and relationships. Explain how components interact.';
      case 'create':
        return 'Create the new component following existing patterns in the codebase. Ensure consistency with project conventions.';
      case 'modify':
        return 'Make targeted changes to existing code. Preserve existing behavior where not explicitly changing.';
      case 'refactor':
        return 'Restructure the code for better maintainability. Ensure all tests still pass after refactoring.';
      case 'test':
        return 'Write comprehensive tests following existing test patterns. Cover edge cases and error scenarios.';
      case 'fix':
        return 'Identify the root cause and implement a targeted fix. Add tests to prevent regression.';
      case 'document':
        return 'Update documentation to reflect current implementation. Use clear, concise language.';
      case 'configure':
        return 'Update configuration following project standards. Document any environment-specific settings.';
      default:
        return 'Complete the task following project conventions and best practices.';
    }
  }

  /**
   * Format decomposition result for display
   */
  formatDecompositionSummary(result: DecompositionResult): string {
    if (!result.isComplex) {
      return ''; // No summary needed for simple queries
    }

    const lines: string[] = [];
    lines.push('┌─ Task Decomposition ─────────────────────────────────────┐');
    lines.push(`│ Query split into ${result.subTasks.length} sub-tasks:`);

    for (const task of result.subTasks) {
      const deps = task.dependencies.length > 0
        ? ` (after: ${task.dependencies.join(', ')})`
        : '';
      lines.push(`│ ${task.id}. [${task.type}] ${task.description.substring(0, 45)}...${deps}`);
    }

    lines.push('│');
    lines.push(`│ Execution: ${result.executionPlan.phases.length} phase(s)`);
    lines.push('└──────────────────────────────────────────────────────────┘');

    return lines.join('\n');
  }
}
