"use strict";
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
exports.ExternalToolManager = void 0;
const logger_1 = require("../utils/logger");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ExternalToolManager {
    logger = logger_1.Logger.getInstance();
    db;
    toolCache = new Map();
    installationCache = new Map();
    permissionCache = new Map();
    constructor(database) {
        this.db = database;
    }
    async initialize() {
        await this.loadDefaultTools();
        await this.refreshCaches();
        this.logger.info('External Tool Manager initialized');
    }
    // Tech Stack Detection
    async detectTechStack(projectPath) {
        const detection = {
            languages: new Map(),
            frameworks: new Map(),
            packageManagers: [],
            buildTools: [],
            testFrameworks: [],
            linters: [],
            formatters: [],
            dependencies: new Map()
        };
        try {
            // Detect package managers and dependencies
            await this.detectPackageManagers(projectPath, detection);
            // Detect languages by file extensions
            await this.detectLanguages(projectPath, detection);
            // Detect frameworks and libraries
            await this.detectFrameworks(projectPath, detection);
            // Detect existing tools
            await this.detectExistingTools(projectPath, detection);
            this.logger.debug('Tech stack detected', {
                languages: Array.from(detection.languages.keys()),
                frameworks: Array.from(detection.frameworks.keys()),
                packageManagers: detection.packageManagers
            });
        }
        catch (error) {
            this.logger.error('Error detecting tech stack:', error);
        }
        return detection;
    }
    async detectPackageManagers(projectPath, detection) {
        const packageFiles = [
            { file: 'package.json', manager: 'npm', parser: this.parsePackageJson },
            { file: 'requirements.txt', manager: 'pip', parser: this.parseRequirementsTxt },
            { file: 'Pipfile', manager: 'pip', parser: this.parsePipfile },
            { file: 'Cargo.toml', manager: 'cargo', parser: this.parseCargoToml },
            { file: 'Gemfile', manager: 'gem', parser: this.parseGemfile },
            { file: 'go.mod', manager: 'go', parser: this.parseGoMod },
            { file: 'composer.json', manager: 'composer', parser: this.parseComposerJson }
        ];
        for (const { file, manager, parser } of packageFiles) {
            const filePath = path.join(projectPath, file);
            if (fs.existsSync(filePath)) {
                detection.packageManagers.push(manager);
                try {
                    await parser.call(this, filePath, detection);
                }
                catch (error) {
                    this.logger.warn(`Failed to parse ${file}:`, error);
                }
            }
        }
    }
    async parsePackageJson(filePath, detection) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Extract dependencies
        const allDeps = {
            ...content.dependencies,
            ...content.devDependencies,
            ...content.peerDependencies
        };
        for (const [pkg, version] of Object.entries(allDeps)) {
            detection.dependencies.set(pkg, version);
        }
        // Detect frameworks from dependencies
        const frameworkIndicators = {
            'react': ['react'],
            'vue': ['vue'],
            'angular': ['@angular/core'],
            'express': ['express'],
            'fastify': ['fastify'],
            'next': ['next'],
            'nuxt': ['nuxt'],
            'nest': ['@nestjs/core']
        };
        for (const [framework, indicators] of Object.entries(frameworkIndicators)) {
            if (indicators.some(indicator => allDeps[indicator])) {
                detection.frameworks.set(framework, [filePath]);
            }
        }
        // Detect build tools
        const buildToolIndicators = ['webpack', 'vite', 'rollup', 'parcel', 'esbuild'];
        for (const tool of buildToolIndicators) {
            if (allDeps[tool]) {
                detection.buildTools.push(tool);
            }
        }
        // Detect test frameworks
        const testFrameworkIndicators = ['jest', 'mocha', 'chai', 'cypress', 'playwright', 'vitest'];
        for (const framework of testFrameworkIndicators) {
            if (allDeps[framework]) {
                detection.testFrameworks.push(framework);
            }
        }
        // Detect linters and formatters
        const lintFormatIndicators = {
            linters: ['eslint', 'tslint', 'jshint'],
            formatters: ['prettier', 'standard']
        };
        for (const linter of lintFormatIndicators.linters) {
            if (allDeps[linter]) {
                detection.linters.push(linter);
            }
        }
        for (const formatter of lintFormatIndicators.formatters) {
            if (allDeps[formatter]) {
                detection.formatters.push(formatter);
            }
        }
    }
    async detectLanguages(projectPath, detection) {
        const languageExtensions = {
            'javascript': ['.js', '.mjs', '.cjs'],
            'typescript': ['.ts', '.tsx'],
            'python': ['.py', '.pyw'],
            'rust': ['.rs'],
            'go': ['.go'],
            'java': ['.java'],
            'c#': ['.cs'],
            'php': ['.php'],
            'ruby': ['.rb'],
            'swift': ['.swift'],
            'kotlin': ['.kt'],
            'scala': ['.scala'],
            'clojure': ['.clj'],
            'html': ['.html', '.htm'],
            'css': ['.css', '.scss', '.sass', '.less'],
            'json': ['.json'],
            'yaml': ['.yml', '.yaml'],
            'xml': ['.xml'],
            'markdown': ['.md', '.mdx']
        };
        const fileCounts = new Map();
        let totalFiles = 0;
        // Walk through directory tree
        const walkDir = (dir) => {
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                        walkDir(fullPath);
                    }
                    else if (stat.isFile()) {
                        const ext = path.extname(file).toLowerCase();
                        for (const [lang, extensions] of Object.entries(languageExtensions)) {
                            if (extensions.includes(ext)) {
                                fileCounts.set(lang, (fileCounts.get(lang) || 0) + 1);
                                totalFiles++;
                                break;
                            }
                        }
                    }
                }
            }
            catch (error) {
                // Skip directories we can't read
            }
        };
        walkDir(projectPath);
        // Convert counts to percentages
        for (const [lang, count] of fileCounts) {
            const percentage = Math.round((count / Math.max(totalFiles, 1)) * 100);
            if (percentage > 0) {
                detection.languages.set(lang, percentage);
            }
        }
    }
    // Tool Recommendation System
    async getToolRecommendations(projectPath, roleType) {
        const techStack = await this.detectTechStack(projectPath);
        const availableTools = await this.getAvailableToolsForRole(roleType);
        const installedTools = await this.getInstalledTools(projectPath);
        const recommendations = [];
        for (const tool of availableTools) {
            const isInstalled = installedTools.some(installed => installed.toolId === tool.id);
            if (isInstalled)
                continue; // Skip already installed tools
            const recommendation = this.evaluateToolRecommendation(tool, techStack, roleType);
            if (recommendation.confidence > 0.3) { // Only recommend tools with decent confidence
                recommendations.push(recommendation);
            }
        }
        // Sort by confidence and urgency
        recommendations.sort((a, b) => {
            const urgencyWeight = { critical: 4, high: 3, medium: 2, low: 1 };
            const aScore = a.confidence * 0.7 + (urgencyWeight[a.urgency] / 4) * 0.3;
            const bScore = b.confidence * 0.7 + (urgencyWeight[b.urgency] / 4) * 0.3;
            return bScore - aScore;
        });
        return recommendations;
    }
    evaluateToolRecommendation(tool, techStack, roleType) {
        let confidence = 0;
        const reasons = [];
        let urgency = 'low';
        // Language match
        for (const [lang, percentage] of techStack.languages) {
            if (tool.languages.includes(lang)) {
                const boost = percentage / 100 * 0.4;
                confidence += boost;
                reasons.push(`Supports ${lang} (${percentage}% of project)`);
            }
        }
        // Framework match
        for (const [framework] of techStack.frameworks) {
            if (tool.frameworks.includes(framework)) {
                confidence += 0.3;
                reasons.push(`Optimized for ${framework}`);
            }
        }
        // Role-specific scoring
        const roleToolAffinities = {
            'DEVELOPER': ['linting', 'formatting', 'testing', 'debugging'],
            'TESTER': ['testing', 'coverage', 'e2e-testing', 'performance'],
            'DEVOPS': ['ci-cd', 'deployment', 'monitoring', 'security'],
            'SECURITY': ['vulnerability-scanning', 'static-analysis', 'security-testing'],
            'DOCUMENTATION_WRITER': ['documentation', 'api-docs', 'markdown']
        };
        const roleAffinities = roleToolAffinities[roleType] || [];
        for (const purpose of tool.purposes) {
            if (roleAffinities.includes(purpose)) {
                confidence += 0.2;
                reasons.push(`Relevant for ${roleType} role`);
            }
        }
        // Urgency assessment
        if (tool.purposes.includes('security') || tool.purposes.includes('vulnerability-scanning')) {
            urgency = 'critical';
        }
        else if (tool.purposes.includes('testing') && !techStack.testFrameworks.length) {
            urgency = 'high';
        }
        else if (tool.purposes.includes('linting') && !techStack.linters.length) {
            urgency = 'medium';
        }
        // Timing recommendation
        let timing = 'as-needed';
        if (tool.purposes.includes('project-setup') || tool.purposes.includes('scaffolding')) {
            timing = 'project-setup';
        }
        else if (tool.purposes.includes('linting') || tool.purposes.includes('formatting')) {
            timing = 'before-coding';
        }
        else if (urgency === 'critical' || urgency === 'high') {
            timing = 'now';
        }
        return {
            tool,
            confidence: Math.min(confidence, 1.0),
            reasons,
            urgency,
            timing,
            estimatedBenefit: confidence * 0.8 + (tool.trustLevel === 'safe' ? 0.2 : 0.1)
        };
    }
    // Tool Installation and Management
    async installTool(toolId, projectPath, roleType, autoApprove = false) {
        const tool = this.toolCache.get(toolId);
        if (!tool) {
            throw new Error(`Tool not found: ${toolId}`);
        }
        // Check permissions
        const hasPermission = await this.checkToolPermission(roleType, toolId, autoApprove);
        if (!hasPermission) {
            this.logger.warn(`Permission denied for tool installation: ${toolId} by role ${roleType}`);
            return false;
        }
        try {
            this.logger.info(`Installing tool: ${tool.name} for project: ${projectPath}`);
            // Check prerequisites
            await this.checkPrerequisites(tool);
            // Execute installation command
            const installResult = await this.executeInstallCommand(tool, projectPath);
            if (installResult.success) {
                // Verify installation
                const isWorking = await this.verifyToolInstallation(tool, projectPath);
                // Record installation
                await this.recordInstallation(tool, projectPath, installResult.version, isWorking);
                this.logger.info(`Successfully installed tool: ${tool.name}`);
                return true;
            }
            else {
                this.logger.error(`Failed to install tool: ${tool.name}`, new Error(installResult.error || 'Installation failed'));
                return false;
            }
        }
        catch (error) {
            this.logger.error(`Error installing tool ${tool.name}:`, error);
            return false;
        }
    }
    async isToolAvailable(toolId, projectPath) {
        const tool = this.toolCache.get(toolId);
        if (!tool)
            return false;
        const installations = this.installationCache.get(projectPath) || [];
        const installation = installations.find(inst => inst.toolId === toolId);
        if (installation && installation.isWorking) {
            // Update last used
            await this.updateToolUsage(installation.id);
            return true;
        }
        // Try to detect if tool is available system-wide
        return await this.checkSystemTool(tool);
    }
    async checkSystemTool(tool) {
        try {
            const result = await execAsync(tool.checkCommand, { timeout: 5000 });
            return result.stderr === '' || !result.stderr.includes('not found');
        }
        catch (error) {
            return false;
        }
    }
    async executeTool(toolId, args, projectPath, roleType) {
        const tool = this.toolCache.get(toolId);
        if (!tool) {
            return { success: false, output: '', error: 'Tool not found' };
        }
        // Check if tool is available
        const isAvailable = await this.isToolAvailable(toolId, projectPath);
        if (!isAvailable) {
            // Try to install if auto-approved
            const permission = await this.getToolPermission(roleType, toolId);
            if (permission?.autoInstall) {
                const installed = await this.installTool(toolId, projectPath, roleType, true);
                if (!installed) {
                    return { success: false, output: '', error: 'Tool not available and installation failed' };
                }
            }
            else {
                return { success: false, output: '', error: 'Tool not available and not approved for auto-install' };
            }
        }
        try {
            const command = `${tool.executable} ${args.join(' ')}`;
            this.logger.debug(`Executing tool command: ${command}`);
            const result = await execAsync(command, {
                cwd: projectPath,
                timeout: 30000 // 30 seconds timeout
            });
            return {
                success: true,
                output: result.stdout,
                error: result.stderr || undefined
            };
        }
        catch (error) {
            return {
                success: false,
                output: error.stdout || '',
                error: error.message
            };
        }
    }
    // Permission Management
    async checkToolPermission(roleType, toolId, autoApprove) {
        const permission = await this.getToolPermission(roleType, toolId);
        if (!permission) {
            // No explicit permission - create default based on tool trust level
            const tool = this.toolCache.get(toolId);
            if (tool?.trustLevel === 'safe' && autoApprove) {
                await this.createToolPermission(roleType, toolId, 'auto-approved', true);
                return true;
            }
            return false;
        }
        return permission.permission !== 'denied';
    }
    async getToolPermission(roleType, toolId) {
        const rolePermissions = this.permissionCache.get(roleType) || [];
        return rolePermissions.find(perm => perm.toolId === toolId);
    }
    async createToolPermission(roleType, toolId, permission, autoInstall, approvedBy) {
        const permissionId = `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newPermission = {
            id: permissionId,
            roleType,
            toolId,
            permission,
            autoInstall,
            approvedBy,
            approvalDate: new Date()
        };
        // Save to database (implementation would go here)
        await this.saveToolPermission(newPermission);
        // Update cache
        const rolePermissions = this.permissionCache.get(roleType) || [];
        rolePermissions.push(newPermission);
        this.permissionCache.set(roleType, rolePermissions);
        this.logger.info(`Created tool permission: ${roleType} -> ${toolId} (${permission})`);
        return permissionId;
    }
    // Default Tools Definition
    async loadDefaultTools() {
        // First try to load from database
        try {
            const existingTools = await this.db.query(`
        SELECT COUNT(*) as count FROM external_tools WHERE is_active = true
      `);
            if (existingTools.rows[0].count > 0) {
                this.logger.info('Loading existing tools from database');
                await this.refreshCaches();
                return;
            }
        }
        catch (error) {
            this.logger.warn('Could not check existing tools, will load defaults:', error);
        }
        // Load default tools if database is empty
        const defaultTools = [
            // JavaScript/TypeScript Tools
            {
                id: 'eslint',
                name: 'ESLint',
                description: 'Static analysis tool for JavaScript and TypeScript',
                category: 'linting',
                executable: 'npx eslint',
                installCommand: 'npm install -D eslint',
                checkCommand: 'npx eslint --version',
                languages: ['javascript', 'typescript'],
                frameworks: ['react', 'vue', 'angular', 'node'],
                purposes: ['linting', 'code-quality', 'static-analysis'],
                packageManager: 'npm',
                globalInstall: false,
                licenseType: 'MIT',
                trustLevel: 'safe',
                installationTime: 'fast',
                diskSpace: 15,
                prerequisites: ['node', 'npm'],
                configFiles: ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'],
                isActive: true
            },
            {
                id: 'prettier',
                name: 'Prettier',
                description: 'Opinionated code formatter',
                category: 'formatting',
                executable: 'npx prettier',
                installCommand: 'npm install -D prettier',
                checkCommand: 'npx prettier --version',
                languages: ['javascript', 'typescript', 'html', 'css', 'json', 'markdown'],
                frameworks: ['react', 'vue', 'angular'],
                purposes: ['formatting', 'code-style'],
                packageManager: 'npm',
                globalInstall: false,
                licenseType: 'MIT',
                trustLevel: 'safe',
                installationTime: 'fast',
                diskSpace: 8,
                prerequisites: ['node', 'npm'],
                configFiles: ['.prettierrc', 'prettier.config.js'],
                isActive: true
            },
            {
                id: 'jest',
                name: 'Jest',
                description: 'JavaScript testing framework',
                category: 'testing',
                executable: 'npx jest',
                installCommand: 'npm install -D jest',
                checkCommand: 'npx jest --version',
                languages: ['javascript', 'typescript'],
                frameworks: ['react', 'node'],
                purposes: ['testing', 'unit-testing', 'coverage'],
                packageManager: 'npm',
                globalInstall: false,
                licenseType: 'MIT',
                trustLevel: 'safe',
                installationTime: 'medium',
                diskSpace: 25,
                prerequisites: ['node', 'npm'],
                configFiles: ['jest.config.js', 'jest.config.json'],
                isActive: true
            },
            // Python Tools
            {
                id: 'pytest',
                name: 'pytest',
                description: 'Python testing framework',
                category: 'testing',
                executable: 'pytest',
                installCommand: 'pip install pytest',
                checkCommand: 'pytest --version',
                languages: ['python'],
                frameworks: ['django', 'flask', 'fastapi'],
                purposes: ['testing', 'unit-testing', 'integration-testing'],
                packageManager: 'pip',
                globalInstall: true,
                licenseType: 'MIT',
                trustLevel: 'safe',
                installationTime: 'fast',
                diskSpace: 12,
                prerequisites: ['python', 'pip'],
                configFiles: ['pytest.ini', 'pyproject.toml'],
                isActive: true
            },
            {
                id: 'black',
                name: 'Black',
                description: 'Python code formatter',
                category: 'formatting',
                executable: 'black',
                installCommand: 'pip install black',
                checkCommand: 'black --version',
                languages: ['python'],
                frameworks: ['django', 'flask', 'fastapi'],
                purposes: ['formatting', 'code-style'],
                packageManager: 'pip',
                globalInstall: true,
                licenseType: 'MIT',
                trustLevel: 'safe',
                installationTime: 'fast',
                diskSpace: 8,
                prerequisites: ['python', 'pip'],
                configFiles: ['pyproject.toml'],
                isActive: true
            },
            {
                id: 'pylint',
                name: 'Pylint',
                description: 'Python static analysis tool',
                category: 'linting',
                executable: 'pylint',
                installCommand: 'pip install pylint',
                checkCommand: 'pylint --version',
                languages: ['python'],
                frameworks: ['django', 'flask', 'fastapi'],
                purposes: ['linting', 'static-analysis', 'code-quality'],
                packageManager: 'pip',
                globalInstall: true,
                licenseType: 'GPL-2.0',
                trustLevel: 'safe',
                installationTime: 'fast',
                diskSpace: 15,
                prerequisites: ['python', 'pip'],
                configFiles: ['.pylintrc', 'pyproject.toml'],
                isActive: true
            },
            // Security Tools
            {
                id: 'npm-audit',
                name: 'npm audit',
                description: 'Security vulnerability scanner for npm packages',
                category: 'security',
                executable: 'npm audit',
                installCommand: '', // Built into npm
                checkCommand: 'npm audit --help',
                languages: ['javascript', 'typescript'],
                frameworks: ['node', 'react', 'vue'],
                purposes: ['security', 'vulnerability-scanning'],
                packageManager: 'npm',
                globalInstall: false,
                licenseType: 'Artistic-2.0',
                trustLevel: 'safe',
                installationTime: 'instant',
                diskSpace: 0,
                prerequisites: ['node', 'npm'],
                isActive: true
            },
            {
                id: 'safety',
                name: 'Safety',
                description: 'Security vulnerability scanner for Python packages',
                category: 'security',
                executable: 'safety',
                installCommand: 'pip install safety',
                checkCommand: 'safety --version',
                languages: ['python'],
                frameworks: ['django', 'flask'],
                purposes: ['security', 'vulnerability-scanning'],
                packageManager: 'pip',
                globalInstall: true,
                licenseType: 'MIT',
                trustLevel: 'verified',
                installationTime: 'fast',
                diskSpace: 5,
                prerequisites: ['python', 'pip'],
                isActive: true
            }
        ];
        // Save default tools to database
        try {
            for (const tool of defaultTools) {
                await this.saveToolToDatabase(tool);
                this.toolCache.set(tool.id, tool);
            }
            this.logger.info(`Loaded and saved ${defaultTools.length} default external tools to database`);
        }
        catch (error) {
            this.logger.error('Error saving default tools to database:', error);
            // Fallback to cache-only mode
            for (const tool of defaultTools) {
                this.toolCache.set(tool.id, tool);
            }
            this.logger.info(`Loaded ${defaultTools.length} default external tools (cache-only)`);
        }
    }
    async saveToolToDatabase(tool) {
        try {
            await this.db.query(`
        INSERT INTO external_tools (
          tool_id, tool_name, description, category, executable,
          install_command, check_command, languages, frameworks, purposes,
          package_manager, global_install, version, homepage, documentation,
          license_type, trust_level, installation_time, disk_space_mb,
          prerequisites, config_files, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (tool_id) DO NOTHING
      `, [
                tool.id,
                tool.name,
                tool.description,
                tool.category,
                tool.executable,
                tool.installCommand,
                tool.checkCommand,
                tool.languages,
                tool.frameworks,
                tool.purposes,
                tool.packageManager,
                tool.globalInstall,
                tool.version,
                tool.homepage,
                tool.documentation,
                tool.licenseType,
                tool.trustLevel,
                tool.installationTime,
                tool.diskSpace,
                tool.prerequisites,
                tool.configFiles,
                tool.isActive
            ]);
        }
        catch (error) {
            this.logger.error(`Error saving tool ${tool.id} to database:`, error);
            throw error;
        }
    }
    // Helper methods (simplified implementations)
    async parseRequirementsTxt(filePath, detection) {
        // Implementation would parse requirements.txt
    }
    async parsePipfile(filePath, detection) {
        // Implementation would parse Pipfile
    }
    async parseCargoToml(filePath, detection) {
        // Implementation would parse Cargo.toml
    }
    async parseGemfile(filePath, detection) {
        // Implementation would parse Gemfile
    }
    async parseGoMod(filePath, detection) {
        // Implementation would parse go.mod
    }
    async parseComposerJson(filePath, detection) {
        // Implementation would parse composer.json
    }
    async detectFrameworks(projectPath, detection) {
        // Additional framework detection logic
    }
    async detectExistingTools(projectPath, detection) {
        // Detect already configured tools
    }
    async getAvailableToolsForRole(roleType) {
        return Array.from(this.toolCache.values()).filter(tool => tool.isActive);
    }
    async getAvailableTools(filters = {}) {
        let tools = Array.from(this.toolCache.values()).filter(tool => tool.isActive);
        if (filters.category) {
            tools = tools.filter(tool => tool.category === filters.category);
        }
        if (filters.language) {
            tools = tools.filter(tool => tool.languages.includes(filters.language));
        }
        return tools;
    }
    async getInstalledTools(projectPath) {
        return this.installationCache.get(projectPath) || [];
    }
    async checkPrerequisites(tool) {
        for (const prereq of tool.prerequisites) {
            try {
                await execAsync(`${prereq} --version`, { timeout: 3000 });
            }
            catch (error) {
                throw new Error(`Missing prerequisite: ${prereq}`);
            }
        }
    }
    async executeInstallCommand(tool, projectPath) {
        try {
            const result = await execAsync(tool.installCommand, {
                cwd: projectPath,
                timeout: 120000 // 2 minutes
            });
            // Try to get version
            let version = 'unknown';
            try {
                const versionResult = await execAsync(tool.checkCommand, { cwd: projectPath, timeout: 5000 });
                version = versionResult.stdout.trim();
            }
            catch {
                // Version detection failed, but installation might have succeeded
            }
            return { success: true, version };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async verifyToolInstallation(tool, projectPath) {
        try {
            await execAsync(tool.checkCommand, { cwd: projectPath, timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
    async recordInstallation(tool, projectPath, version, isWorking) {
        const installation = {
            id: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            toolId: tool.id,
            projectPath,
            installedVersion: version,
            installDate: new Date(),
            lastUsed: new Date(),
            usageCount: 0,
            installationMethod: tool.globalInstall ? 'global' : 'local',
            isWorking,
            lastCheck: new Date()
        };
        // Save to database (implementation would go here)
        await this.saveInstallation(installation);
        // Update cache
        const installations = this.installationCache.get(projectPath) || [];
        installations.push(installation);
        this.installationCache.set(projectPath, installations);
    }
    async updateToolUsage(installationId) {
        // Update usage count and last used timestamp
        // Implementation would update database
    }
    async refreshCaches() {
        try {
            // Load tools from database
            const tools = await this.db.query(`
        SELECT * FROM external_tools WHERE is_active = true
      `);
            this.toolCache.clear();
            for (const tool of tools.rows) {
                this.toolCache.set(tool.tool_id, this.dbRowToExternalTool(tool));
            }
            // Load installations
            const installations = await this.db.query(`
        SELECT ti.*, p.project_path 
        FROM tool_installations ti
        JOIN projects p ON ti.project_id = p.id
        WHERE ti.is_working = true
      `);
            this.installationCache.clear();
            for (const install of installations.rows) {
                const projectInstalls = this.installationCache.get(install.project_path) || [];
                projectInstalls.push(this.dbRowToToolInstallation(install));
                this.installationCache.set(install.project_path, projectInstalls);
            }
            // Load permissions
            const permissions = await this.db.query(`
        SELECT * FROM role_tool_permissions
      `);
            this.permissionCache.clear();
            for (const perm of permissions.rows) {
                const rolePermissions = this.permissionCache.get(perm.role_type) || [];
                rolePermissions.push(this.dbRowToRoleToolPermission(perm));
                this.permissionCache.set(perm.role_type, rolePermissions);
            }
            this.logger.info('Caches refreshed from database');
        }
        catch (error) {
            this.logger.error('Error refreshing caches:', error);
        }
    }
    async saveToolPermission(permission) {
        try {
            await this.db.query(`
        INSERT INTO role_tool_permissions (
          id, role_type, tool_id, permission, auto_install, 
          max_usage_per_session, restrict_to_projects, approved_by, 
          approval_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (role_type, tool_id) 
        DO UPDATE SET 
          permission = EXCLUDED.permission,
          auto_install = EXCLUDED.auto_install,
          max_usage_per_session = EXCLUDED.max_usage_per_session,
          restrict_to_projects = EXCLUDED.restrict_to_projects,
          approved_by = EXCLUDED.approved_by,
          approval_date = EXCLUDED.approval_date,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `, [
                permission.id,
                permission.roleType,
                permission.toolId,
                permission.permission,
                permission.autoInstall,
                permission.maxUsagePerSession,
                permission.restrictToProjects,
                permission.approvedBy,
                permission.approvalDate,
                permission.notes
            ]);
        }
        catch (error) {
            this.logger.error('Error saving tool permission:', error);
            throw error;
        }
    }
    async saveInstallation(installation) {
        try {
            // Get project ID from path
            const projectResult = await this.db.query(`
        SELECT id FROM projects WHERE project_path = $1 LIMIT 1
      `, [installation.projectPath]);
            if (projectResult.rows.length === 0) {
                throw new Error(`Project not found for path: ${installation.projectPath}`);
            }
            const projectId = projectResult.rows[0].id;
            await this.db.query(`
        INSERT INTO tool_installations (
          id, project_id, tool_id, project_path, installed_version,
          installation_method, install_date, last_used, usage_count,
          config_path, is_working, last_check, installation_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
                installation.id,
                projectId,
                installation.toolId,
                installation.projectPath,
                installation.installedVersion,
                installation.installationMethod,
                installation.installDate,
                installation.lastUsed,
                installation.usageCount,
                installation.configPath,
                installation.isWorking,
                installation.lastCheck,
                'Installed via CodeMind'
            ]);
        }
        catch (error) {
            this.logger.error('Error saving installation:', error);
            throw error;
        }
    }
    // Database row conversion helpers
    dbRowToExternalTool(row) {
        return {
            id: row.tool_id,
            name: row.tool_name,
            description: row.description,
            category: row.category,
            executable: row.executable,
            installCommand: row.install_command,
            checkCommand: row.check_command,
            languages: row.languages || [],
            frameworks: row.frameworks || [],
            purposes: row.purposes || [],
            packageManager: row.package_manager,
            globalInstall: row.global_install,
            version: row.version,
            homepage: row.homepage,
            documentation: row.documentation,
            licenseType: row.license_type,
            trustLevel: row.trust_level,
            installationTime: row.installation_time,
            diskSpace: row.disk_space_mb,
            prerequisites: row.prerequisites || [],
            configFiles: row.config_files || [],
            isActive: row.is_active
        };
    }
    dbRowToToolInstallation(row) {
        return {
            id: row.id,
            toolId: row.tool_id,
            projectPath: row.project_path,
            installedVersion: row.installed_version,
            installDate: new Date(row.install_date),
            lastUsed: new Date(row.last_used),
            usageCount: row.usage_count,
            installationMethod: row.installation_method,
            configPath: row.config_path,
            isWorking: row.is_working,
            lastCheck: new Date(row.last_check)
        };
    }
    dbRowToRoleToolPermission(row) {
        return {
            id: row.id,
            roleType: row.role_type,
            toolId: row.tool_id,
            permission: row.permission,
            autoInstall: row.auto_install,
            maxUsagePerSession: row.max_usage_per_session,
            restrictToProjects: row.restrict_to_projects,
            approvedBy: row.approved_by,
            approvalDate: row.approval_date ? new Date(row.approval_date) : undefined,
            notes: row.notes
        };
    }
    // Public methods for database operations
    async saveTechStackDetection(projectPath, detection) {
        try {
            const projectResult = await this.db.query(`
        SELECT id FROM projects WHERE project_path = $1 LIMIT 1
      `, [projectPath]);
            if (projectResult.rows.length === 0) {
                throw new Error(`Project not found for path: ${projectPath}`);
            }
            const projectId = projectResult.rows[0].id;
            const detectionId = `tech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.db.query(`
        INSERT INTO tech_stack_detections (
          id, project_id, project_path, languages, frameworks,
          package_managers, build_tools, test_frameworks, linters,
          formatters, dependencies, detection_confidence, scan_duration_ms,
          file_count_analyzed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (project_id) DO UPDATE SET
          languages = EXCLUDED.languages,
          frameworks = EXCLUDED.frameworks,
          package_managers = EXCLUDED.package_managers,
          build_tools = EXCLUDED.build_tools,
          test_frameworks = EXCLUDED.test_frameworks,
          linters = EXCLUDED.linters,
          formatters = EXCLUDED.formatters,
          dependencies = EXCLUDED.dependencies,
          detection_confidence = EXCLUDED.detection_confidence,
          last_scan = NOW()
      `, [
                detectionId,
                projectId,
                projectPath,
                JSON.stringify(Object.fromEntries(detection.languages)),
                JSON.stringify(Object.fromEntries(detection.frameworks)),
                detection.packageManagers,
                detection.buildTools,
                detection.testFrameworks,
                detection.linters,
                detection.formatters,
                JSON.stringify(Object.fromEntries(detection.dependencies)),
                0.8, // Default confidence
                0, // Duration - would be calculated
                0 // File count - would be calculated
            ]);
            this.logger.info('Tech stack detection saved to database', { projectPath });
        }
        catch (error) {
            this.logger.error('Error saving tech stack detection:', error);
            throw error;
        }
    }
    async saveToolRecommendations(projectPath, roleType, recommendations) {
        try {
            const projectResult = await this.db.query(`
        SELECT id FROM projects WHERE project_path = $1 LIMIT 1
      `, [projectPath]);
            if (projectResult.rows.length === 0) {
                throw new Error(`Project not found for path: ${projectPath}`);
            }
            const projectId = projectResult.rows[0].id;
            for (const rec of recommendations) {
                const recId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await this.db.query(`
          INSERT INTO tool_recommendations (
            id, project_id, tool_id, role_type, confidence_score,
            reasons, urgency, timing, estimated_benefit
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (project_id, tool_id, role_type) DO UPDATE SET
            confidence_score = EXCLUDED.confidence_score,
            reasons = EXCLUDED.reasons,
            urgency = EXCLUDED.urgency,
            timing = EXCLUDED.timing,
            estimated_benefit = EXCLUDED.estimated_benefit,
            created_at = NOW()
        `, [
                    recId,
                    projectId,
                    rec.tool.id,
                    roleType,
                    rec.confidence,
                    rec.reasons,
                    rec.urgency,
                    rec.timing,
                    rec.estimatedBenefit
                ]);
            }
            this.logger.debug(`Saved ${recommendations.length} tool recommendations`, { projectPath, roleType });
        }
        catch (error) {
            this.logger.error('Error saving tool recommendations:', error);
            throw error;
        }
    }
    async logToolUsage(projectPath, toolId, roleType, usage) {
        try {
            const projectResult = await this.db.query(`
        SELECT id FROM projects WHERE project_path = $1 LIMIT 1
      `, [projectPath]);
            if (projectResult.rows.length === 0) {
                return; // Skip logging if project not found
            }
            const projectId = projectResult.rows[0].id;
            const usageId = `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.db.query(`
        INSERT INTO tool_usage_analytics (
          id, project_id, tool_id, role_type, usage_type,
          execution_duration_ms, success, command_args, output_size_bytes,
          error_message, context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
                usageId,
                projectId,
                toolId,
                roleType,
                usage.usageType,
                usage.executionDuration || null,
                usage.success,
                usage.commandArgs || null,
                usage.outputSize || null,
                usage.errorMessage || null,
                usage.context ? JSON.stringify(usage.context) : null
            ]);
            // Update installation usage count
            await this.db.query(`
        UPDATE tool_installations 
        SET usage_count = usage_count + 1, last_used = NOW()
        WHERE project_id = $1 AND tool_id = $2
      `, [projectId, toolId]);
        }
        catch (error) {
            this.logger.error('Error logging tool usage:', error);
            // Don't throw - logging failures shouldn't break workflow
        }
    }
}
exports.ExternalToolManager = ExternalToolManager;
//# sourceMappingURL=external-tool-manager.js.map