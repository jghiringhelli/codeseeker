/**
 * Project Intelligence Service
 * Provides AI-driven insights about projects using PostgreSQL
 */
export interface ProjectContext {
    projectId: string;
    name: string;
    type: string;
    languages: string[];
    frameworks: string[];
    patterns: string[];
    complexity: number;
    lastAnalyzed: Date;
}
export declare class ProjectIntelligence {
    private logger;
    private dbConnections;
    constructor();
    /**
     * Get intelligent project context
     */
    getProjectContext(projectId: string): Promise<ProjectContext | null>;
    /**
     * Update project intelligence
     */
    updateProjectIntelligence(projectId: string, data: any): Promise<void>;
    /**
     * Get project insights
     */
    getProjectInsights(projectId: string): Promise<any>;
    /**
     * Learn from tool execution
     */
    learnFromToolExecution(projectId: string, toolName: string, result: any): Promise<void>;
    /**
     * Get smart recommendations
     */
    getRecommendations(projectId: string): Promise<string[]>;
    /**
     * Generate recommendations based on project data
     */
    private generateRecommendations;
}
export declare const projectIntelligence: ProjectIntelligence;
//# sourceMappingURL=project-intelligence.d.ts.map