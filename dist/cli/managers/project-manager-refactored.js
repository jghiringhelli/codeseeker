"use strict";
/**
 * Refactored ProjectManager - SOLID Principles Compliant
 * Uses dependency injection and single responsibility services
 * Now includes proper error handling following SOLID principles
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectManagerRefactored = void 0;
const uuid_1 = require("uuid");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const theme_1 = require("../ui/theme");
const error_utils_1 = require("../../core/utils/error-utils");
class ProjectManagerRefactored {
    projectDetector;
    languageManager;
    projectRegistry;
    currentProjectPath;
    constructor(projectDetector, languageManager, projectRegistry) {
        this.projectDetector = projectDetector;
        this.languageManager = languageManager;
        this.projectRegistry = projectRegistry;
        this.currentProjectPath = process.env.CODEMIND_USER_CWD || process.cwd();
    }
    /**
     * Initialize a new project using dependency-injected services
     */
    async initializeProject(projectPath, options, syncMode) {
        try {
            console.log(theme_1.Theme.colors.info(`🔄 Initializing project: ${options.projectName}`));
            // Use injected detector service
            const detectedType = await this.projectDetector.detectProjectType(projectPath);
            const projectType = options.projectType || detectedType;
            // Use injected language manager
            const detectedLanguages = await this.languageManager.detectLanguages(projectPath);
            const languageSetup = await this.languageManager.setupLanguageSupport(detectedLanguages);
            // Create project configuration
            const config = {
                projectId: (0, uuid_1.v4)(),
                projectName: options.projectName,
                projectPath,
                projectType,
                languages: languageSetup.detectedLanguages,
                primaryLanguage: this.determinePrimaryLanguage(languageSetup.detectedLanguages),
                frameworks: this.detectFrameworks(projectPath),
                features: options.features,
                createdAt: new Date().toISOString()
            };
            // Use injected registry service
            await this.projectRegistry.registerProject(config);
            // Create local configuration
            await this.createLocalConfig(config);
            console.log(theme_1.Theme.colors.success(`✅ Project initialized: ${config.projectId}`));
            return { success: true, config };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.log(theme_1.Theme.colors.error(`❌ Project initialization failed: ${errorMessage}`));
            return { success: false, error: errorMessage };
        }
    }
    /**
     * Switch to a different project
     */
    async switchProject(targetPath) {
        // Use injected detector service
        const existingConfig = await this.projectDetector.getProjectConfig(targetPath);
        if (existingConfig) {
            this.currentProjectPath = targetPath;
            console.log(theme_1.Theme.colors.info(`🔄 Switched to project: ${existingConfig.projectName}`));
            return existingConfig;
        }
        console.log(theme_1.Theme.colors.warning(`⚠️ No project found at: ${targetPath}`));
        return null;
    }
    /**
     * Get project information from registry
     */
    async getProjectInfo(projectId) {
        return await this.projectRegistry.getProject(projectId);
    }
    /**
     * Scan project files using detector service
     */
    async scanProjectFiles(projectPath) {
        return await this.projectDetector.getProjectConfig(projectPath);
    }
    /**
     * Compatibility methods for existing code
     */
    // Detect project type and configuration (compatibility)
    async detectProject(projectPath) {
        const targetPath = projectPath || this.currentProjectPath;
        const result = await (0, error_utils_1.withErrorHandling)(() => this.projectDetector.getProjectConfig(targetPath), { projectPath: targetPath, operation: 'detectProject' });
        if (result.success) {
            return result.data;
        }
        else {
            // Log error but return null for compatibility
            console.warn(`Project detection failed: ${result.error.message}`);
            return null;
        }
    }
    // Set current project path (compatibility)
    setProjectPath(projectPath) {
        this.currentProjectPath = projectPath;
    }
    // Get current project path
    getCurrentProjectPath() {
        return this.currentProjectPath;
    }
    // Private helper methods (single responsibility)
    async createLocalConfig(config) {
        const configDir = path.join(config.projectPath, '.codemind');
        const configPath = path.join(configDir, 'project.json');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    determinePrimaryLanguage(languages) {
        const priorityOrder = ['typescript', 'javascript', 'python', 'java', 'rust', 'go'];
        for (const priority of priorityOrder) {
            if (languages.includes(priority)) {
                return priority;
            }
        }
        return languages[0];
    }
    detectFrameworks(projectPath) {
        const frameworks = [];
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (dependencies.express)
                    frameworks.push('express');
                if (dependencies.react)
                    frameworks.push('react');
                if (dependencies.vue)
                    frameworks.push('vue');
                if (dependencies.angular)
                    frameworks.push('angular');
                if (dependencies.nest)
                    frameworks.push('nestjs');
            }
            catch (error) {
                console.warn(`Failed to read package.json: ${error.message}`);
            }
        }
        return frameworks;
    }
}
exports.ProjectManagerRefactored = ProjectManagerRefactored;
//# sourceMappingURL=project-manager-refactored.js.map