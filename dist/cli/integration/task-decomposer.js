"use strict";
/**
 * Task Decomposer - Single Responsibility: Decomposing requests into executable tasks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskDecomposer = void 0;
class TaskDecomposer {
    async decompose(userRequest, intent) {
        const tasks = [];
        switch (intent.category) {
            case 'analysis':
                tasks.push({ id: 1, type: 'analyze', description: 'Analyze code structure', priority: 1 }, { id: 2, type: 'report', description: 'Generate analysis report', priority: 2 });
                break;
            case 'refactor':
                tasks.push({ id: 1, type: 'identify', description: 'Identify refactoring opportunities', priority: 1 }, { id: 2, type: 'plan', description: 'Plan refactoring steps', priority: 2 }, { id: 3, type: 'validate', description: 'Validate refactoring safety', priority: 3 });
                break;
            case 'architecture':
                tasks.push({ id: 1, type: 'analyze-solid', description: 'Analyze SOLID principles compliance', priority: 1 }, { id: 2, type: 'suggest-patterns', description: 'Suggest architectural patterns', priority: 2 }, { id: 3, type: 'recommend-improvements', description: 'Recommend architectural improvements', priority: 3 });
                break;
            default:
                tasks.push({ id: 1, type: 'general', description: userRequest, priority: 1 });
        }
        return tasks;
    }
    async decomposeRequest(requestObj) {
        // Handle object parameter format
        const tasks = await this.decompose(requestObj.userRequest, { category: requestObj.intent });
        return { tasks };
    }
}
exports.TaskDecomposer = TaskDecomposer;
//# sourceMappingURL=task-decomposer.js.map