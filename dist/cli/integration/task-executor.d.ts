/**
 * Task Executor - Single Responsibility: Executing individual tasks
 */
export declare class TaskExecutor {
    execute(task: any, context: string): Promise<any>;
    private executeAnalysisTask;
    private executeSOLIDAnalysisTask;
    private executeRefactorTask;
    private executeGeneralTask;
    executeTask(taskObj: any): Promise<any>;
}
//# sourceMappingURL=task-executor.d.ts.map