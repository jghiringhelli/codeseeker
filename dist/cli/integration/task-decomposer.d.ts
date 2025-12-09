/**
 * Task Decomposer - Single Responsibility: Decomposing requests into executable tasks
 */
export declare class TaskDecomposer {
    decompose(userRequest: string, intent: any): Promise<any[]>;
    decomposeRequest(requestObj: any): Promise<{
        tasks: any[];
    }>;
}
//# sourceMappingURL=task-decomposer.d.ts.map