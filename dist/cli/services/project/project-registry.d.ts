/**
 * Project Registry Service - Single Responsibility
 * Handles database operations for project management
 */
import { IProjectRegistry, ProjectConfig } from '../../../core/interfaces/project-interfaces';
import { DatabaseConnections } from '../../../config/database-config';
export declare class ProjectRegistry implements IProjectRegistry {
    private dbConnections;
    constructor(dbConnections: DatabaseConnections);
    registerProject(config: ProjectConfig): Promise<void>;
    updateProject(projectId: string, updates: Partial<ProjectConfig>): Promise<void>;
    getProject(projectId: string): Promise<ProjectConfig | null>;
    verifyProjectExists(projectId: string): Promise<boolean>;
    private camelToSnake;
}
//# sourceMappingURL=project-registry.d.ts.map