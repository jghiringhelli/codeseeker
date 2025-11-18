/**
 * ProjectManager - SOLID Principles Compliant
 * Uses dependency injection and single responsibility services
 * Now includes proper error handling following SOLID principles
 */
import { ProjectConfig, ProjectInitOptions, IProjectDetector, ILanguageDetector, IProjectRegistry } from '../../core/interfaces/project-interfaces';
export declare class ProjectManager {
    private projectDetector;
    private languageManager;
    private projectRegistry;
    private currentProjectPath;
    constructor(projectDetector: IProjectDetector, languageManager: ILanguageDetector, projectRegistry: IProjectRegistry);
    /**
     * Initialize a new project using dependency-injected services
     */
    initializeProject(projectPath: string, options: ProjectInitOptions, _syncMode?: boolean): Promise<{
        success: boolean;
        config?: ProjectConfig;
        error?: string;
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