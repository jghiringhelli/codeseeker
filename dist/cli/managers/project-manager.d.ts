/**
 * ProjectManager - Handles all project-related operations
 * Single Responsibility: Project initialization, detection, configuration
 */
export interface ProjectConfig {
    projectId: string;
    projectName: string;
    projectPath: string;
    projectType?: string;
    languages: string[];
    primaryLanguage?: string;
    installedParsers?: string[];
    frameworks?: string[];
    features?: string[];
    createdAt: string;
    lastUpdated?: string;
}
export interface ProjectInitOptions {
    projectName: string;
    projectType: string;
    features: string[];
    resumeToken?: string;
}
export interface LanguageSetupResult {
    detectedLanguages: string[];
    selectedLanguages: string[];
    installedPackages: string[];
    errors: string[];
}
export declare class ProjectManager {
    private dbConnections;
    private currentProjectPath;
    constructor();
    /**
     * Set the current project path
     */
    setProjectPath(projectPath: string): void;
    /**
     * Detect if current directory is a CodeMind project
     */
    detectProject(projectPath: string): ProjectConfig | null;
    /**
     * Initialize a new CodeMind project with full AI analysis
     */
    initializeProject(projectPath: string, options: ProjectInitOptions, syncMode?: boolean): Promise<{
        success: boolean;
        config?: ProjectConfig;
        error?: string;
    }>;
    /**
     * Switch between projects
     */
    switchProject(targetPath: string): Promise<ProjectConfig | null>;
    /**
     * Get project information and statistics
     */
    getProjectInfo(projectId: string): Promise<any>;
    private verifyInfrastructure;
    private verifyProjectInDatabase;
    private registerInDatabases;
    private createLocalConfig;
    /**
     * Detect languages and setup project environment
     */
    private detectLanguagesAndSetup;
    /**
     * Scan project files using SOLID file scanner
     */
    scanProjectFiles(projectPath: string): Promise<any>;
    /**
     * Perform complete project analysis using SOLID file scanner
     */
    private performCompleteAnalysis;
    /**
     * Populate databases with complete analysis data using status tracking
     */
    private populateDatabases;
    private detectArchitectureType;
    private extractArchitecturePatterns;
    private detectFrameworks;
    private extractUseCases;
}
//# sourceMappingURL=project-manager.d.ts.map