/**
 * Task Orchestration Service
 * SOLID Principles: Single Responsibility - Handle task decomposition and execution only
 */

import { Logger } from '../../../shared/logger';
import { TaskDecomposer } from '../../integration/task-decomposer';
import { TaskExecutor } from '../../integration/task-executor';
import {
  ITaskOrchestrationService,
  UserFeatureRequest,
  ProcessedIntent,
  EnhancementContext,
  SubTask,
  SubTaskResult
} from '../interfaces/index';

export class TaskOrchestrationService implements ITaskOrchestrationService {
  private logger = Logger.getInstance();
  private taskDecomposer: TaskDecomposer;
  private taskExecutor: TaskExecutor;

  constructor(
    taskDecomposer?: TaskDecomposer,
    taskExecutor?: TaskExecutor
  ) {
    this.taskDecomposer = taskDecomposer || new TaskDecomposer();
    this.taskExecutor = taskExecutor || new TaskExecutor();
  }

  async splitIntoSubTasks(
    request: UserFeatureRequest,
    intent: ProcessedIntent,
    context: EnhancementContext
  ): Promise<SubTask[]> {
    this.logger.info('🔪 Splitting request into manageable sub-tasks...');

    try {
      // Use the TaskDecomposer to analyze and split the request
      const decomposition = await this.taskDecomposer.decomposeRequest({
        userRequest: request.query,
        intent: intent.intention,
        complexity: intent.complexity,
        relevantFiles: context.relevantFiles,
        relationships: context.relationships
      });

      // Convert decomposition result to SubTask format
      const subTasks: SubTask[] = decomposition.tasks.map((task, index) => ({
        id: `task_${index + 1}`,
        description: task.description,
        files: task.targetFiles || [],
        dependencies: task.dependencies || [],
        estimatedTime: task.estimatedTime || this.estimateTaskTime(task.description, intent.complexity),
        priority: task.priority || (index + 1)
      }));

      // Sort tasks by dependencies and priority
      const sortedTasks = this.sortTasksByDependencies(subTasks);

      this.logger.info(`Created ${sortedTasks.length} sub-tasks`);
      return sortedTasks;
    } catch (error) {
      this.logger.error('Task decomposition failed:', error);

      // Fallback to simple single-task approach
      return this.createFallbackTasks(request, intent);
    }
  }

  async processAllSubTasks(tasks: SubTask[], context: EnhancementContext): Promise<SubTaskResult[]> {
    this.logger.info(`🔄 Processing ${tasks.length} sub-tasks...`);

    const results: SubTaskResult[] = [];
    const maxConcurrentTasks = 3; // Configurable concurrency limit

    // Process tasks in dependency order with limited concurrency
    for (let i = 0; i < tasks.length; i += maxConcurrentTasks) {
      const batch = tasks.slice(i, i + maxConcurrentTasks);

      // Filter out tasks that have unresolved dependencies
      const readyTasks = batch.filter(task =>
        this.areDependenciesResolved(task, results)
      );

      if (readyTasks.length > 0) {
        this.logger.debug(`Processing batch: ${readyTasks.map(t => t.id).join(', ')}`);

        // Process tasks in parallel
        const batchPromises = readyTasks.map(task =>
          this.executeSubTask(task, context)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        // Collect results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // Handle failed task
            const failedTask = readyTasks[batchResults.indexOf(result)];
            results.push(this.createFailedTaskResult(failedTask, result.reason));
          }
        }
      }

      // Add any tasks that still have unresolved dependencies back to the queue
      const unresolvedTasks = batch.filter(task =>
        !this.areDependenciesResolved(task, results)
      );

      if (unresolvedTasks.length > 0 && i + maxConcurrentTasks >= tasks.length) {
        // If we're at the end and still have unresolved tasks, process them anyway
        this.logger.warn(`Processing ${unresolvedTasks.length} tasks with unresolved dependencies`);

        for (const task of unresolvedTasks) {
          try {
            const result = await this.executeSubTask(task, context);
            results.push(result);
          } catch (error) {
            results.push(this.createFailedTaskResult(task, error));
          }
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Completed ${successCount}/${tasks.length} sub-tasks successfully`);

    return results;
  }

  async executeSubTask(task: SubTask, context: EnhancementContext): Promise<SubTaskResult> {
    const startTime = Date.now();
    this.logger.debug(`Executing sub-task: ${task.id} - ${task.description}`);

    try {
      // Prepare task-specific context
      const taskContext = this.prepareTaskContext(task, context);

      // Execute the task using TaskExecutor
      const executionResult = await this.taskExecutor.executeTask({
        description: task.description,
        targetFiles: task.files,
        enhancedContext: taskContext,
        maxTokens: 4000 // Configurable per task
      });

      const duration = Date.now() - startTime;

      const result: SubTaskResult = {
        taskId: task.id,
        success: executionResult.success,
        filesModified: executionResult.filesModified || [],
        output: executionResult.response || '',
        duration,
        error: executionResult.success ? undefined : 'Task execution failed'
      };

      this.logger.debug(`Task ${task.id} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Task ${task.id} failed:`, error);

      return {
        taskId: task.id,
        success: false,
        filesModified: [],
        output: '',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private sortTasksByDependencies(tasks: SubTask[]): SubTask[] {
    // Topological sort to handle dependencies
    const sorted: SubTask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: SubTask): void => {
      if (visiting.has(task.id)) {
        this.logger.warn(`Circular dependency detected involving task: ${task.id}`);
        return;
      }

      if (visited.has(task.id)) {
        return;
      }

      visiting.add(task.id);

      // Visit dependencies first
      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) {
          visit(depTask);
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    };

    // Sort by priority first, then handle dependencies
    const prioritySorted = [...tasks].sort((a, b) => a.priority - b.priority);

    for (const task of prioritySorted) {
      visit(task);
    }

    return sorted;
  }

  private areDependenciesResolved(task: SubTask, completedResults: SubTaskResult[]): boolean {
    if (task.dependencies.length === 0) {
      return true;
    }

    const completedTaskIds = new Set(
      completedResults.filter(r => r.success).map(r => r.taskId)
    );

    return task.dependencies.every(depId => completedTaskIds.has(depId));
  }

  private prepareTaskContext(task: SubTask, context: EnhancementContext): string {
    const relevantFiles = task.files.length > 0 ? task.files : context.relevantFiles.slice(0, 5);

    const lines = [
      `# Task Context: ${task.description}`,
      '',
      `## Target Files`,
      ...relevantFiles.map(file => `- ${file}`),
      '',
      `## Relevant Relationships`,
      ...context.relationships
        .filter(rel =>
          relevantFiles.includes(rel.source_file) ||
          relevantFiles.includes(rel.target_file)
        )
        .slice(0, 10)
        .map(rel => `- ${rel.source_file} ${rel.relationship_type} ${rel.target_file}`),
      '',
      `## Estimated Time: ${task.estimatedTime} minutes`,
      `## Priority: ${task.priority}`,
    ];

    if (task.dependencies.length > 0) {
      lines.push('', '## Dependencies', ...task.dependencies.map(dep => `- ${dep}`));
    }

    return lines.join('\n');
  }

  private estimateTaskTime(description: string, complexity: 'simple' | 'medium' | 'complex'): number {
    const baseTime = {
      simple: 15,
      medium: 25,
      complex: 40
    }[complexity];

    // Adjust based on task description keywords
    let multiplier = 1;
    const desc = description.toLowerCase();

    if (desc.includes('create') || desc.includes('implement')) multiplier *= 1.2;
    if (desc.includes('test') || desc.includes('testing')) multiplier *= 0.8;
    if (desc.includes('refactor') || desc.includes('restructure')) multiplier *= 1.5;
    if (desc.includes('fix') || desc.includes('debug')) multiplier *= 0.9;

    return Math.round(baseTime * multiplier);
  }

  private createFallbackTasks(request: UserFeatureRequest, intent: ProcessedIntent): SubTask[] {
    // Simple single-task fallback
    return [{
      id: 'main_task',
      description: request.query,
      files: [],
      dependencies: [],
      estimatedTime: intent.timeEstimate,
      priority: 1
    }];
  }

  private createFailedTaskResult(task: SubTask, error: any): SubTaskResult {
    return {
      taskId: task.id,
      success: false,
      filesModified: [],
      output: '',
      duration: 0,
      error: error instanceof Error ? error.message : 'Task failed'
    };
  }

  // Additional utility methods
  getTaskExecutionSummary(results: SubTaskResult[]): {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    totalDuration: number;
    averageDuration: number;
    totalFilesModified: number;
  } {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const allModifiedFiles = new Set<string>();

    results.forEach(r => r.filesModified.forEach(f => allModifiedFiles.add(f)));

    return {
      totalTasks: results.length,
      successfulTasks: successful.length,
      failedTasks: failed.length,
      totalDuration,
      averageDuration: results.length > 0 ? totalDuration / results.length : 0,
      totalFilesModified: allModifiedFiles.size
    };
  }
}