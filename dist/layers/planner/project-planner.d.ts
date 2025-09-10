/**
 * Project Planner - Layer 3: Long-Term Planning
 *
 * Manages multi-phase project execution with milestone tracking and dependency management.
 * Uses the Orchestrator (Layer 2) to execute complex workflows.
 */
export interface ProjectPhase {
    id: string;
    name: string;
    description: string;
    estimatedDuration: number;
    dependencies: string[];
    milestones: Milestone[];
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}
export interface Milestone {
    id: string;
    name: string;
    description: string;
    targetDate: Date;
    status: 'pending' | 'achieved' | 'overdue';
    deliverables: string[];
}
export interface ProjectPlan {
    id: string;
    name: string;
    description: string;
    startDate: Date;
    targetEndDate: Date;
    phases: ProjectPhase[];
    overallProgress: number;
    status: 'planning' | 'active' | 'completed' | 'paused';
}
export declare class ProjectPlanner {
    private plans;
    /**
     * Create a new project plan with phases and milestones
     */
    createProjectPlan(name: string, description: string, requirements: string[]): Promise<ProjectPlan>;
    /**
     * Execute a project phase using the orchestrator
     */
    executePhase(planId: string, phaseId: string): Promise<void>;
    /**
     * Get project status and progress
     */
    getProjectStatus(planId: string): ProjectPlan | undefined;
    /**
     * Generate project phases based on requirements
     */
    private generatePhases;
    /**
     * Calculate project end date based on phases
     */
    private calculateEndDate;
    /**
     * Execute workflows for a phase using the orchestrator
     */
    private executePhaseWorkflows;
    /**
     * Update overall project progress
     */
    private updateProjectProgress;
}
//# sourceMappingURL=project-planner.d.ts.map