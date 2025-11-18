/**
 * Project Service Factory - Dependency Injection
 * Creates and wires up project services following Dependency Inversion Principle
 */
import { DatabaseConnections } from '../../config/database-config';
import { ProjectManager } from '../../cli/managers/project-manager';
import { IProjectDetector, ILanguageDetector, IProjectRegistry } from '../interfaces/project-interfaces';
export declare class ProjectServiceFactory {
    private static instance;
    private dbConnections;
    private constructor();
    static getInstance(): ProjectServiceFactory;
    /**
     * Create project detector service
     */
    createProjectDetector(): IProjectDetector;
    /**
     * Create language manager service
     */
    createLanguageManager(): ILanguageDetector;
    /**
     * Create project registry service
     */
    createProjectRegistry(): IProjectRegistry;
    /**
     * Create fully configured project manager with all dependencies injected
     */
    createProjectManager(): ProjectManager;
    /**
     * Create project manager with custom dependencies (for testing)
     */
    createProjectManagerWithDependencies(detector: IProjectDetector, languageManager: ILanguageDetector, registry: IProjectRegistry): ProjectManager;
    /**
     * Get database connections instance
     */
    getDatabaseConnections(): DatabaseConnections;
}
//# sourceMappingURL=project-service-factory.d.ts.map