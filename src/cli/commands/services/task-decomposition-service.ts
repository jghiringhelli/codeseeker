/**
 * Task Decomposition Service
 * Single Responsibility: Analyze complex queries and decompose them into focused sub-tasks
 *
 * This service enables the "Task Split" capability where complex multi-part requests
 * are broken down into smaller, focused tasks. Each sub-task gets its own tailored
 * context from the semantic search and graph analysis.
 *
 * Benefits:
 * - Better Focus: Claude concentrates on one thing at a time
 * - Optimized Context: Each sub-task gets precisely relevant files
 * - Reduced Token Usage: No wasted tokens on irrelevant context
 * - Improved Accuracy: Smaller, focused tasks produce better results
 */

import { QueryAnalysis } from './natural-language-processor';
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';

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
  // Patterns that indicate complex, multi-part requests
  private readonly complexityIndicators = [
    /\band\b.*\b(also|then|after|before)\b/i,
    /\bfirst\b.*\bthen\b/i,
    /\b(create|add|implement).*\b(test|document)/i,
    /\b(fix|update).*\b(and|also)\b.*\b(add|create)/i,
    /\bmultiple\b|\bseveral\b|\ball\b/i,
    /\bstep\s*\d/i,
    /\b\d+\.\s/,  // Numbered list
  ];

  // Action verbs and their corresponding task types
  private readonly actionTypeMap: Record<string, SubTaskType> = {
    'understand': 'analyze',
    'explain': 'analyze',
    'analyze': 'analyze',
    'review': 'analyze',
    'find': 'analyze',
    'search': 'analyze',
    'create': 'create',
    'add': 'create',
    'implement': 'create',
    'build': 'create',
    'write': 'create',
    'make': 'create',
    'change': 'modify',
    'update': 'modify',
    'modify': 'modify',
    'edit': 'modify',
    'refactor': 'refactor',
    'restructure': 'refactor',
    'reorganize': 'refactor',
    'clean': 'refactor',
    'test': 'test',
    'verify': 'test',
    'check': 'test',
    'fix': 'fix',
    'debug': 'fix',
    'resolve': 'fix',
    'repair': 'fix',
    'document': 'document',
    'describe': 'document',
    'configure': 'configure',
    'setup': 'configure',
    'install': 'configure',
  };

  /**
   * Analyze a query and decompose it into sub-tasks if complex
   */
  decomposeQuery(query: string, queryAnalysis: QueryAnalysis): DecompositionResult {
    const isComplex = this.isComplexQuery(query);

    if (!isComplex) {
      // Simple query - single task
      return {
        isComplex: false,
        originalQuery: query,
        subTasks: [this.createSingleTask(query, queryAnalysis)],
        executionPlan: {
          phases: [{ phaseNumber: 1, taskIds: [1], description: 'Execute query' }],
          totalEstimatedSteps: 1
        }
      };
    }

    // Complex query - decompose into sub-tasks
    const subTasks = this.extractSubTasks(query, queryAnalysis);
    const executionPlan = this.createExecutionPlan(subTasks);

    return {
      isComplex: true,
      originalQuery: query,
      subTasks,
      executionPlan
    };
  }

  /**
   * Determine if a query is complex enough to warrant decomposition
   */
  private isComplexQuery(query: string): boolean {
    // Check for complexity indicators
    for (const pattern of this.complexityIndicators) {
      if (pattern.test(query)) {
        return true;
      }
    }

    // Check for multiple distinct actions
    const actions = this.extractActions(query);
    if (actions.length > 1) {
      return true;
    }

    // Check query length as a heuristic
    const wordCount = query.split(/\s+/).length;
    if (wordCount > 30) {
      return true;
    }

    return false;
  }

  /**
   * Extract action verbs from query
   */
  private extractActions(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const actions: string[] = [];

    for (const word of words) {
      if (this.actionTypeMap[word] && !actions.includes(word)) {
        actions.push(word);
      }
    }

    return actions;
  }

  /**
   * Create a single task for simple queries
   */
  private createSingleTask(query: string, queryAnalysis: QueryAnalysis): SubTask {
    const taskType = this.determineTaskType(query, queryAnalysis.intent);

    return {
      id: 1,
      type: taskType,
      description: query,
      searchTerms: this.extractSearchTerms(query),
      priority: 1,
      dependencies: [],
      estimatedComplexity: 'medium'
    };
  }

  /**
   * Extract sub-tasks from a complex query
   */
  private extractSubTasks(query: string, queryAnalysis: QueryAnalysis): SubTask[] {
    const subTasks: SubTask[] = [];
    let taskId = 1;

    // Split by common conjunctions and separators
    const segments = this.splitQueryIntoSegments(query);

    for (const segment of segments) {
      if (segment.trim().length < 5) continue; // Skip very short segments

      const taskType = this.determineTaskType(segment, queryAnalysis.intent);
      const searchTerms = this.extractSearchTerms(segment);
      const complexity = this.estimateComplexity(segment, taskType);
      const contextFilter = this.createContextFilter(taskType, searchTerms);

      subTasks.push({
        id: taskId,
        type: taskType,
        description: segment.trim(),
        searchTerms,
        priority: this.calculatePriority(taskType, taskId),
        dependencies: this.calculateDependencies(taskId, taskType, subTasks),
        contextFilter,
        estimatedComplexity: complexity
      });

      taskId++;
    }

    // If no sub-tasks were created, create at least one
    if (subTasks.length === 0) {
      subTasks.push(this.createSingleTask(query, queryAnalysis));
    }

    // Sort by priority
    subTasks.sort((a, b) => a.priority - b.priority);

    return subTasks;
  }

  /**
   * Split a complex query into segments
   */
  private splitQueryIntoSegments(query: string): string[] {
    // First, try to split by numbered items
    const numberedMatch = query.match(/\d+\.\s+[^.]+/g);
    if (numberedMatch && numberedMatch.length > 1) {
      return numberedMatch.map(s => s.replace(/^\d+\.\s*/, ''));
    }

    // Split by common conjunctions
    const segments = query
      .split(/\band\s+(?:also\s+)?|\bthen\s+|\bafter\s+that\s+|\bfirst\s+|\bnext\s+|\bfinally\s+/i)
      .filter(s => s.trim().length > 0);

    if (segments.length > 1) {
      return segments;
    }

    // Split by sentence boundaries
    const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      return sentences;
    }

    // Return as single segment
    return [query];
  }

  /**
   * Determine the task type from the segment text
   */
  private determineTaskType(segment: string, fallbackIntent: string): SubTaskType {
    const lowerSegment = segment.toLowerCase();

    for (const [action, type] of Object.entries(this.actionTypeMap)) {
      if (lowerSegment.includes(action)) {
        return type;
      }
    }

    // Use fallback intent
    const intentMap: Record<string, SubTaskType> = {
      'understand': 'analyze',
      'create': 'create',
      'modify': 'modify',
      'fix': 'fix',
      'delete': 'modify',
      'general': 'general'
    };

    return intentMap[fallbackIntent] || 'general';
  }

  /**
   * Extract search terms from a segment
   */
  private extractSearchTerms(segment: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
      'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
      'please', 'help', 'me', 'want', 'need', 'like', 'make', 'sure'
    ]);

    const words = segment.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Return unique terms
    return [...new Set(words)];
  }

  /**
   * Estimate task complexity
   */
  private estimateComplexity(segment: string, taskType: SubTaskType): 'low' | 'medium' | 'high' {
    const wordCount = segment.split(/\s+/).length;

    // High complexity types
    if (['refactor', 'create'].includes(taskType) && wordCount > 10) {
      return 'high';
    }

    // Low complexity types
    if (['analyze', 'document'].includes(taskType) && wordCount < 10) {
      return 'low';
    }

    // Check for complexity keywords
    const highComplexityPatterns = [
      /comprehensive/i, /complete/i, /all/i, /entire/i, /full/i,
      /refactor/i, /restructure/i, /migrate/i, /rewrite/i
    ];

    for (const pattern of highComplexityPatterns) {
      if (pattern.test(segment)) {
        return 'high';
      }
    }

    return 'medium';
  }

  /**
   * Create context filter based on task type
   */
  private createContextFilter(taskType: SubTaskType, searchTerms: string[]): ContextFilter {
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
   * Calculate task priority (lower = earlier)
   */
  private calculatePriority(taskType: SubTaskType, taskId: number): number {
    // Analysis tasks should run first
    const typePriority: Record<SubTaskType, number> = {
      'analyze': 1,
      'fix': 2,
      'modify': 3,
      'refactor': 4,
      'create': 5,
      'test': 6,
      'document': 7,
      'configure': 8,
      'general': 5
    };

    return typePriority[taskType] * 10 + taskId;
  }

  /**
   * Calculate task dependencies
   */
  private calculateDependencies(taskId: number, taskType: SubTaskType, existingTasks: SubTask[]): number[] {
    const dependencies: number[] = [];

    // Tests depend on create/modify tasks
    if (taskType === 'test') {
      for (const task of existingTasks) {
        if (['create', 'modify', 'refactor'].includes(task.type)) {
          dependencies.push(task.id);
        }
      }
    }

    // Documentation depends on implementation
    if (taskType === 'document') {
      for (const task of existingTasks) {
        if (['create', 'modify'].includes(task.type)) {
          dependencies.push(task.id);
        }
      }
    }

    // Refactor depends on analysis
    if (taskType === 'refactor') {
      for (const task of existingTasks) {
        if (task.type === 'analyze') {
          dependencies.push(task.id);
        }
      }
    }

    return dependencies;
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
        filter.filePatterns!.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return regex.test(r.file);
        })
      );
    }

    // Filter by file types
    if (filter.fileTypes && filter.fileTypes.length > 0) {
      filteredResults = filteredResults.filter(r =>
        filter.fileTypes!.includes(r.type)
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
