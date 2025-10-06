/**
 * Project Planner
 * Handles project planning and requirement analysis
 */
interface ProjectAnalysis {
    type: string;
    complexity: 'low' | 'medium' | 'high';
    recommendations: string[];
    technologies: string[];
    fileStats: {
        totalFiles: number;
        codeFiles: number;
        testFiles: number;
        configFiles: number;
    };
    architecture: string[];
}
interface ProjectPlan {
    phases: Array<{
        name: string;
        description: string;
        tasks: string[];
        estimatedDays: number;
    }>;
    timeline: string;
    resources: string[];
    risks: string[];
    dependencies: string[];
}
export declare class ProjectPlanner {
    analyzeProject(projectPath: string): Promise<ProjectAnalysis>;
    generatePlan(requirements: string[]): Promise<ProjectPlan>;
    private analyzeFileStats;
    private detectTechnologies;
    private determineProjectType;
    private calculateComplexity;
    private analyzeArchitecture;
    private generateRecommendations;
    private createPhases;
    private estimateTimeline;
    private identifyResources;
    private identifyRisks;
    private identifyDependencies;
}
export declare const projectPlanner: ProjectPlanner;
export {};
//# sourceMappingURL=project-planner.d.ts.map