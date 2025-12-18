/**
 * ProjectManager - SOLID Principles Compliant
 * Uses dependency injection and single responsibility services
 * Now includes proper error handling following SOLID principles
 *
 * Updated: Uses ProjectIdentityService for deterministic project IDs
 */
import { ProjectConfig, ProjectInitOptions, IProjectDetector, ILanguageDetector, IProjectRegistry } from '../../core/interfaces/project-interfaces';
import { ProjectResolutionResult } from '../services/project-identity-service';
export declare class ProjectManager {
    private projectDetector;
    private languageManager;
    private projectRegistry;
    private currentProjectPath;
    private identityService;
    constructor(projectDetector: IProjectDetector, languageManager: ILanguageDetector, projectRegistry: IProjectRegistry);
    /**
     * Initialize a new project using dependency-injected services
     * Uses ProjectIdentityService for deterministic ID generation
     */
    initializeProject(projectPath: string, options: ProjectInitOptions, _syncMode?: boolean): Promise<{
        success: boolean;
        config?: ProjectConfig;
        error?: string;
        resolution?: ProjectResolutionResult;
    }>;
    /**
     * Switch to a different project
     */
    switchProject(targetPath: string): Promise<ProjectConfig | null>;
    /**
     * Get project information from registry
     */
    getProjectInfo(projectId: string): Promise<ProjectConfig | null>;
    /**
     * Get deterministic project ID for a path
     * Same path always produces the same ID
     */
    getDeterministicProjectId(projectPath: string): string;
    /**
     * Clean up duplicate projects for a path
     * Merges data from duplicates into the canonical entry
     */
    cleanupDuplicates(projectPath: string): Promise<{
        success: boolean;
        projectsCleaned: number;
        embeddingsMerged: number;
        errors: string[];
    }>;
    /**
     * List all registered projects with their data statistics
     */
    listProjects(): Promise<Array<{
        id: string;
        projectName: string;
        currentPath: string;
        status: string;
        dataStats?: {
            embeddings: number;
            entities: number;
        };
    }>>;
    /**
     * Find all duplicate project entries
     */
    findDuplicateProjects(): Promise<Map<string, any[]>>;
    /**
     * Scan project files using detector service
     */
    scanProjectFiles(projectPath: string): Promise<ProjectConfig | null>;
    /**
     * Compatibility methods for existing code
     */
    detectProject(projectPath?: string): Promise<ProjectConfig | null>;
    setProjectPath(projectPath: string): void;
    getCurrentProjectPath(): string;
    private createLocalConfig;
    private determinePrimaryLanguage;
    private detectFrameworks;
}
export { ProjectInitOptions } from '../../core/interfaces/project-interfaces';
//# sourceMappingURL=project-manager.d.ts.map