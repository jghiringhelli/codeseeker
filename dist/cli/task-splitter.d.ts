/**
 * Task Splitter - Breaks complex requests into manageable sub-tasks
 * Analyzes user requests and semantic context to create optimal task breakdown
 */
import { ProcessedIntent } from './intent-analyzer';
import { EnhancementContext } from '../shared/semantic-enhancement-engine';
export interface UserFeatureRequest {
    query: string;
    userId?: string;
    projectId: string;
    timestamp: number;
}
export interface SubTask {
    id: string;
    description: string;
    files: string[];
    dependencies: string[];
    estimatedTime: number;
    priority: number;
    type: 'create' | 'modify' | 'test' | 'config' | 'cleanup';
    context: {
        primaryFiles: string[];
        relatedFiles: string[];
        domainKnowledge: string;
    };
}
export interface TaskSplitRequest {
    userRequest: UserFeatureRequest;
    intent: ProcessedIntent;
    context: EnhancementContext;
}
export interface TaskSplitResult {
    subTasks: SubTask[];
    estimatedDuration: number;
    complexity: 'simple' | 'medium' | 'complex';
    riskAssessment: string;
    dependencies: {
        external: string[];
        internal: string[];
    };
}
export declare class TaskSplitter {
    private logger;
    private claudeIntegration;
    createSubTasks(request: UserFeatureRequest, intent: ProcessedIntent, context: EnhancementContext): Promise<SubTask[]>;
    private buildTaskSplitPrompt;
    private processWithClaude;
    private generateMockClaudeTaskSplit;
    private parseTaskSplitResponse;
    private validateSubTasks;
    private validateTaskType;
    private validateComplexity;
    private optimizeTaskOrder;
    private validateTasks;
    private generateFallbackTasks;
    private generateFallbackTaskSplit;
}
export default TaskSplitter;
//# sourceMappingURL=task-splitter.d.ts.map