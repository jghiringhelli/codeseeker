/**
 * Task Executor - Single Responsibility: Executing individual tasks
 */
export declare class TaskExecutor {
    execute(task: any, context: string): Promise<any>;
    private executeAnalysisTask;
    private executeSOLIDAnalysisTask;
    private executeRefactorTask;
    private executeGeneralTask;
}
//# sourceMappingURL=task-executor.d.ts.map