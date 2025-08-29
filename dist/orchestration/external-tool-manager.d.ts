import { Database } from '../database/database';
export interface ExternalTool {
    id: string;
    name: string;
    description: string;
    category: string;
    executable: string;
    installCommand: string;
    checkCommand: string;
    languages: string[];
    frameworks: string[];
    purposes: string[];
    packageManager?: 'npm' | 'pip' | 'cargo' | 'gem' | 'go' | 'system' | 'manual';
    globalInstall: boolean;
    version?: string;
    homepage?: string;
    documentation?: string;
    licenseType: string;
    trustLevel: 'safe' | 'verified' | 'community' | 'experimental';
    installationTime: 'instant' | 'fast' | 'medium' | 'slow';
    diskSpace: number;
    prerequisites: string[];
    configFiles?: string[];
    isActive: boolean;
}
export interface ToolInstallation {
    id: string;
    toolId: string;
    projectPath: string;
    installedVersion: string;
    installDate: Date;
    lastUsed: Date;
    usageCount: number;
    installationMethod: 'global' | 'local' | 'project';
    configPath?: string;
    isWorking: boolean;
    lastCheck: Date;
}
export interface RoleToolPermission {
    id: string;
    roleType: string;
    toolId: string;
    permission: 'allowed' | 'auto-approved' | 'ask-permission' | 'denied';
    autoInstall: boolean;
    maxUsagePerSession?: number;
    restrictToProjects?: string[];
    approvedBy?: string;
    approvalDate?: Date;
    notes?: string;
}
export interface ToolRecommendation {
    tool: ExternalTool;
    confidence: number;
    reasons: string[];
    urgency: 'low' | 'medium' | 'high' | 'critical';
    timing: 'now' | 'project-setup' | 'before-coding' | 'as-needed';
    estimatedBenefit: number;
}
export interface TechStackDetection {
    languages: Map<string, number>;
    frameworks: Map<string, string[]>;
    packageManagers: string[];
    buildTools: string[];
    testFrameworks: string[];
    linters: string[];
    formatters: string[];
    dependencies: Map<string, string>;
}
export declare class ExternalToolManager {
    private logger;
    private db;
    private toolCache;
    private installationCache;
    private permissionCache;
    constructor(database: Database);
    initialize(): Promise<void>;
    detectTechStack(projectPath: string): Promise<TechStackDetection>;
    private detectPackageManagers;
    private parsePackageJson;
    private detectLanguages;
    getToolRecommendations(projectPath: string, roleType: string): Promise<ToolRecommendation[]>;
    private evaluateToolRecommendation;
    installTool(toolId: string, projectPath: string, roleType: string, autoApprove?: boolean): Promise<boolean>;
    isToolAvailable(toolId: string, projectPath: string): Promise<boolean>;
    private checkSystemTool;
    executeTool(toolId: string, args: string[], projectPath: string, roleType: string): Promise<{
        success: boolean;
        output: string;
        error?: string;
    }>;
    private checkToolPermission;
    private getToolPermission;
    createToolPermission(roleType: string, toolId: string, permission: 'allowed' | 'auto-approved' | 'ask-permission' | 'denied', autoInstall: boolean, approvedBy?: string): Promise<string>;
    private loadDefaultTools;
    private saveToolToDatabase;
    private parseRequirementsTxt;
    private parsePipfile;
    private parseCargoToml;
    private parseGemfile;
    private parseGoMod;
    private parseComposerJson;
    private detectFrameworks;
    private detectExistingTools;
    getAvailableToolsForRole(roleType: string): Promise<ExternalTool[]>;
    getAvailableTools(filters?: {
        category?: string;
        language?: string;
    }): Promise<ExternalTool[]>;
    getInstalledTools(projectPath: string): Promise<ToolInstallation[]>;
    private checkPrerequisites;
    private executeInstallCommand;
    private verifyToolInstallation;
    private recordInstallation;
    private updateToolUsage;
    private refreshCaches;
    private saveToolPermission;
    private saveInstallation;
    private dbRowToExternalTool;
    private dbRowToToolInstallation;
    private dbRowToRoleToolPermission;
    saveTechStackDetection(projectPath: string, detection: TechStackDetection): Promise<void>;
    saveToolRecommendations(projectPath: string, roleType: string, recommendations: ToolRecommendation[]): Promise<void>;
    logToolUsage(projectPath: string, toolId: string, roleType: string, usage: {
        usageType: 'execute' | 'install' | 'check' | 'configure';
        executionDuration?: number;
        success: boolean;
        commandArgs?: string;
        outputSize?: number;
        errorMessage?: string;
        context?: any;
    }): Promise<void>;
}
//# sourceMappingURL=external-tool-manager.d.ts.map