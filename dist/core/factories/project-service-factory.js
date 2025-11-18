"use strict";
/**
 * Project Service Factory - Dependency Injection
 * Creates and wires up project services following Dependency Inversion Principle
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectServiceFactory = void 0;
const database_config_1 = require("../../config/database-config");
const project_detector_1 = require("../../cli/services/project/project-detector");
const language_manager_1 = require("../../cli/services/project/language-manager");
const project_registry_1 = require("../../cli/services/project/project-registry");
const project_manager_1 = require("../../cli/managers/project-manager");
class ProjectServiceFactory {
    static instance;
    dbConnections;
    constructor() {
        this.dbConnections = new database_config_1.DatabaseConnections();
    }
    static getInstance() {
        if (!ProjectServiceFactory.instance) {
            ProjectServiceFactory.instance = new ProjectServiceFactory();
        }
        return ProjectServiceFactory.instance;
    }
    /**
     * Create project detector service
     */
    createProjectDetector() {
        return new project_detector_1.ProjectDetector();
    }
    /**
     * Create language manager service
     */
    createLanguageManager() {
        return new language_manager_1.LanguageManager();
    }
    /**
     * Create project registry service
     */
    createProjectRegistry() {
        return new project_registry_1.ProjectRegistry(this.dbConnections);
    }
    /**
     * Create fully configured project manager with all dependencies injected
     */
    createProjectManager() {
        const detector = this.createProjectDetector();
        const languageManager = this.createLanguageManager();
        const registry = this.createProjectRegistry();
        return new project_manager_1.ProjectManager(detector, languageManager, registry);
    }
    /**
     * Create project manager with custom dependencies (for testing)
     */
    createProjectManagerWithDependencies(detector, languageManager, registry) {
        return new project_manager_1.ProjectManager(detector, languageManager, registry);
    }
    /**
     * Get database connections instance
     */
    getDatabaseConnections() {
        return this.dbConnections;
    }
}
exports.ProjectServiceFactory = ProjectServiceFactory;
//# sourceMappingURL=project-service-factory.js.map