#!/usr/bin/env node
"use strict";
/**
 * CodeMind Cycle-Enhanced CLI
 *
 * Integrates automatic validation cycles for quality-aware AI assistance.
 * Runs safety and quality checks before every response to prevent issues.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CycleEnhancedCLI = void 0;
const commander_1 = require("commander");
const logger_1 = require("../utils/logger");
const cli_logger_1 = require("../utils/cli-logger");
const validation_cycle_1 = require("../shared/validation-cycle");
const semantic_orchestrator_1 = require("../orchestration/semantic-orchestrator");
const context_optimizer_1 = require("./context-optimizer");
const intelligent_tool_selector_1 = require("../shared/intelligent-tool-selector");
const enhanced_context_provider_1 = require("../shared/enhanced-context-provider");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
const logger = logger_1.Logger.getInstance();
const cliLogger = cli_logger_1.CLILogger.getInstance();
class CycleEnhancedCLI {
    validationCycle;
    semanticOrchestrator;
    contextOptimizer;
    toolSelector;
    contextProvider;
    constructor() {
        this.validationCycle = new validation_cycle_1.CodeMindValidationCycle({
            enableCoreCycle: true,
            enableQualityCycle: true,
            maxDuration: 3000, // 3 seconds max
            qualityThresholds: {
                solidMinScore: 0.7,
                maxDuplicationLines: 15,
                maxComplexityPerFunction: 12
            }
        });
        this.semanticOrchestrator = new semantic_orchestrator_1.SemanticOrchestrator();
        this.contextOptimizer = new context_optimizer_1.ContextOptimizer();
        this.toolSelector = new intelligent_tool_selector_1.IntelligentToolSelector();
        this.contextProvider = new enhanced_context_provider_1.EnhancedContextProvider();
    }
    /**
     * Main request processing with integrated validation cycles
     */
    async processRequest(userRequest, projectPath, options = {}) {
        try {
            logger.info('🚀 Processing request with cycle validation...');
            // 1. Build project context
            const context = await this.buildProjectContext(userRequest, projectPath);
            // 2. Run validation cycles (unless skipped)
            if (!options.skipCycles) {
                const cycleResults = await this.runValidationCycles(context, options.force);
                // If core cycle fails and not forcing, return error
                if (!cycleResults.core.success && !options.force) {
                    return this.formatErrorResponse(cycleResults);
                }
                // Add cycle insights to response
                const cycleInsights = this.validationCycle.formatCycleResults(cycleResults.core, cycleResults.quality);
                if (cycleInsights.trim()) {
                    cliLogger.info('\\n' + chalk_1.default.blue('📊 Validation Results:'));
                    cliLogger.info(cycleInsights);
                }
            }
            // 3. Execute the actual request with intelligent tool selection
            const response = await this.executeIntelligentRequest(userRequest, context);
            // 4. Post-execution validation (if code was modified)
            if (context.requestType === 'code_modification') {
                await this.runPostExecutionValidation(context);
            }
            return response;
        }
        catch (error) {
            logger.error('Request processing failed:', error);
            return `❌ Request failed: ${error.message}`;
        }
    }
    /**
     * Build comprehensive project context
     */
    async buildProjectContext(userRequest, projectPath) {
        const requestType = this.classifyRequestType(userRequest);
        // Get recently modified files (git status)
        let changedFiles = [];
        try {
            const gitStatus = (0, child_process_1.execSync)('git status --porcelain', {
                cwd: projectPath,
                encoding: 'utf-8',
                timeout: 5000
            });
            changedFiles = gitStatus
                .split('\\n')
                .filter(line => line.trim())
                .map(line => line.substring(3)) // Remove git status prefix
                .filter(file => file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.json'));
        }
        catch (error) {
            // Not a git repo or git not available - use current directory scan
            try {
                const recentFiles = await this.findRecentlyModifiedFiles(projectPath);
                changedFiles = recentFiles;
            }
            catch (scanError) {
                // If we can't determine changed files, we'll work with what we have
                changedFiles = [];
            }
        }
        // Detect language and framework
        const { language, framework } = await this.detectProjectTechnology(projectPath);
        return {
            projectPath,
            changedFiles,
            requestType,
            language,
            framework
        };
    }
    /**
     * Classify the type of user request
     */
    classifyRequestType(userRequest) {
        const codeWords = [
            'write', 'create', 'add', 'implement', 'build', 'generate', 'modify', 'update', 'refactor',
            'fix', 'change', 'delete', 'remove', 'edit', 'replace', 'insert'
        ];
        const analysisWords = [
            'analyze', 'review', 'check', 'examine', 'explain', 'understand', 'show', 'list',
            'find', 'search', 'locate', 'identify', 'describe'
        ];
        const lowerRequest = userRequest.toLowerCase();
        if (codeWords.some(word => lowerRequest.includes(word))) {
            return 'code_modification';
        }
        else if (analysisWords.some(word => lowerRequest.includes(word))) {
            return 'analysis';
        }
        else {
            return 'general';
        }
    }
    /**
     * Find recently modified files
     */
    async findRecentlyModifiedFiles(projectPath) {
        const files = [];
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        const scanDirectory = async (dir) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.'))
                        continue; // Skip hidden files/dirs
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(projectPath, fullPath);
                    if (entry.isDirectory()) {
                        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
                            await scanDirectory(fullPath);
                        }
                    }
                    else if (entry.isFile()) {
                        if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
                            const stats = await fs.stat(fullPath);
                            if (stats.mtime.getTime() > cutoffTime) {
                                files.push(relativePath);
                            }
                        }
                    }
                }
            }
            catch (error) {
                // Skip directories we can't read
            }
        };
        await scanDirectory(projectPath);
        return files.slice(0, 20); // Limit to 20 most recent files
    }
    /**
     * Detect project language and framework
     */
    async detectProjectTechnology(projectPath) {
        let language;
        let framework;
        try {
            // Check package.json for clues
            const packageJsonPath = path.join(projectPath, 'package.json');
            try {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
                // Detect TypeScript
                if (packageJson.dependencies?.typescript || packageJson.devDependencies?.typescript) {
                    language = 'typescript';
                }
                else {
                    language = 'javascript';
                }
                // Detect frameworks
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (deps.react)
                    framework = 'react';
                else if (deps.vue)
                    framework = 'vue';
                else if (deps.angular || deps['@angular/core'])
                    framework = 'angular';
                else if (deps.express)
                    framework = 'express';
                else if (deps.next)
                    framework = 'nextjs';
                else if (deps.nuxt)
                    framework = 'nuxtjs';
            }
            catch (error) {
                // No package.json, check for other indicators
            }
            // Check tsconfig.json
            if (!language) {
                try {
                    await fs.access(path.join(projectPath, 'tsconfig.json'));
                    language = 'typescript';
                }
                catch (error) {
                    language = 'javascript';
                }
            }
        }
        catch (error) {
            // Default fallback
            language = 'javascript';
        }
        return { language, framework };
    }
    /**
     * Run validation cycles
     */
    async runValidationCycles(context, force = false) {
        logger.info('🔄 Running validation cycles...');
        // Always run core safety cycle
        const coreResult = await this.validationCycle.runCoreCycle(context);
        let qualityResult;
        // Run quality cycle for code modifications or analysis
        if (context.requestType === 'code_modification' || context.requestType === 'analysis') {
            qualityResult = await this.validationCycle.runQualityCycle(context);
        }
        return { core: coreResult, quality: qualityResult };
    }
    /**
     * Execute request using intelligent tool selection
     */
    async executeIntelligentRequest(userRequest, context) {
        try {
            // Use semantic orchestrator for complex requests
            if (context.requestType === 'code_modification') {
                const result = await this.semanticOrchestrator.analyzeWithSemanticContext({
                    query: userRequest,
                    projectPath: context.projectPath,
                    intent: 'coding',
                    maxResults: 10,
                    includeRelated: true
                });
                return this.formatSemanticResponse(result);
            }
            else {
                // For analysis requests, use context optimization
                const optimizedContext = await this.contextOptimizer.optimizeContext({
                    query: userRequest,
                    projectPath: context.projectPath,
                    tokenBudget: 8000,
                    strategy: 'smart'
                });
                return `Context optimization completed. ${optimizedContext.priorityFiles.length} files prioritized for analysis.`;
            }
        }
        catch (error) {
            logger.error('Intelligent request execution failed:', error);
            return `Request execution failed: ${error.message}. Please try again or use --force to bypass validation.`;
        }
    }
    /**
     * Run post-execution validation
     */
    async runPostExecutionValidation(context) {
        try {
            // Quick compilation check after code changes
            const postResult = await this.validationCycle.runCoreCycle(context);
            if (!postResult.success) {
                cliLogger.warning(chalk_1.default.yellow('\\n⚠️ Post-execution validation found issues:'));
                postResult.errors.forEach(error => {
                    cliLogger.warning(`   • ${error.message}`);
                });
                cliLogger.info(chalk_1.default.blue('\\nConsider running: npm run build'));
            }
            else {
                cliLogger.success(chalk_1.default.green('✅ Post-execution validation passed'));
            }
        }
        catch (error) {
            logger.warn('Post-execution validation failed:', error);
        }
    }
    /**
     * Format error response for validation failures
     */
    formatErrorResponse(cycleResults) {
        const lines = [];
        lines.push(chalk_1.default.red('❌ Safety Validation Failed\\n'));
        if (cycleResults.core.errors.length > 0) {
            lines.push(chalk_1.default.red('Critical Issues:'));
            cycleResults.core.errors.forEach((error) => {
                lines.push(`   • ${error.message}${error.file ? ` (${error.file})` : ''}`);
            });
        }
        lines.push('\\n' + chalk_1.default.yellow('Please fix these issues before proceeding.'));
        lines.push(chalk_1.default.gray('Use --force to bypass validation (not recommended).'));
        return lines.join('\\n');
    }
    /**
     * Format semantic orchestrator response
     */
    formatSemanticResponse(result) {
        const lines = [];
        if (result.success) {
            lines.push(chalk_1.default.green('✅ Task completed successfully\\n'));
            if (result.analysis) {
                lines.push(chalk_1.default.blue('📊 Analysis Results:'));
                lines.push(result.analysis);
                lines.push('');
            }
            if (result.recommendations?.length > 0) {
                lines.push(chalk_1.default.cyan('💡 Recommendations:'));
                result.recommendations.forEach((rec) => {
                    lines.push(`   • ${rec}`);
                });
            }
        }
        else {
            lines.push(chalk_1.default.red('❌ Task failed:'));
            lines.push(result.error || 'Unknown error occurred');
        }
        return lines.join('\\n');
    }
}
exports.CycleEnhancedCLI = CycleEnhancedCLI;
// CLI Commands
program
    .name('codemind-enhanced')
    .description('CodeMind CLI with integrated validation cycles')
    .version('3.0.0');
program
    .command('analyze')
    .description('Analyze project with quality validation')
    .argument('<query>', 'Analysis query')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .option('--skip-cycles', 'Skip validation cycles')
    .action(async (query, options) => {
    const cli = new CycleEnhancedCLI();
    const result = await cli.processRequest(query, options.path, {
        skipCycles: options.skipCycles
    });
    console.log(result);
});
program
    .command('code')
    .description('Execute code modification with full validation')
    .argument('<request>', 'Code modification request')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .option('--force', 'Force execution even with validation errors')
    .option('--skip-cycles', 'Skip validation cycles')
    .action(async (request, options) => {
    const cli = new CycleEnhancedCLI();
    const result = await cli.processRequest(request, options.path, {
        force: options.force,
        skipCycles: options.skipCycles
    });
    console.log(result);
});
program
    .command('validate')
    .description('Run validation cycles only')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .action(async (options) => {
    const validationCycle = new validation_cycle_1.CodeMindValidationCycle();
    const cli = new CycleEnhancedCLI();
    // Build context for validation
    const context = await cli.buildProjectContext('validate project', options.path);
    console.log(chalk_1.default.blue('🔄 Running validation cycles...\\n'));
    // Run core cycle
    const coreResult = await validationCycle.runCoreCycle(context);
    // Run quality cycle
    const qualityResult = await validationCycle.runQualityCycle(context);
    // Display results
    const output = validationCycle.formatCycleResults(coreResult, qualityResult);
    console.log(output);
    // Exit with appropriate code
    if (!coreResult.success) {
        process.exit(1);
    }
});
program
    .command('status')
    .description('Show project and validation status')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .action(async (options) => {
    try {
        console.log(chalk_1.default.blue('📊 CodeMind Project Status\\n'));
        // Project info
        console.log(chalk_1.default.cyan('Project Path:'), options.path);
        // Git status
        try {
            const gitStatus = (0, child_process_1.execSync)('git status --porcelain', {
                cwd: options.path,
                encoding: 'utf-8',
                timeout: 5000
            });
            const changedFileCount = gitStatus.split('\\n').filter(l => l.trim()).length;
            console.log(chalk_1.default.cyan('Modified Files:'), changedFileCount);
        }
        catch (error) {
            console.log(chalk_1.default.cyan('Git Status:'), 'Not a git repository');
        }
        // Package info
        try {
            const packagePath = path.join(options.path, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            console.log(chalk_1.default.cyan('Project Name:'), packageJson.name);
            console.log(chalk_1.default.cyan('Version:'), packageJson.version);
        }
        catch (error) {
            console.log(chalk_1.default.cyan('Package Info:'), 'No package.json found');
        }
        // Quick validation
        const validationCycle = new validation_cycle_1.CodeMindValidationCycle();
        const cli = new CycleEnhancedCLI();
        const context = await cli.buildProjectContext('status check', options.path);
        console.log(chalk_1.default.blue('\\n🔄 Running quick validation...'));
        const coreResult = await validationCycle.runCoreCycle(context);
        if (coreResult.success) {
            console.log(chalk_1.default.green('✅ Core validation passed'));
        }
        else {
            console.log(chalk_1.default.red('❌ Core validation failed'));
            coreResult.errors.forEach((error) => {
                console.log(chalk_1.default.red(`   • ${error.message}`));
            });
        }
        console.log(chalk_1.default.gray(`\\nValidation completed in ${coreResult.duration}ms`));
    }
    catch (error) {
        console.error(chalk_1.default.red('Status check failed:'), error.message);
    }
});
// Default command for backwards compatibility
program
    .argument('[request]', 'Request to process')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .option('--force', 'Force execution even with validation errors')
    .option('--skip-cycles', 'Skip validation cycles')
    .action(async (request, options) => {
    if (!request) {
        program.help();
        return;
    }
    const cli = new CycleEnhancedCLI();
    const result = await cli.processRequest(request, options.path, {
        force: options.force,
        skipCycles: options.skipCycles
    });
    console.log(result);
});
// Error handling
program.configureOutput({
    writeErr: (str) => process.stderr.write(chalk_1.default.red(str))
});
program.exitOverride();
try {
    program.parse();
}
catch (error) {
    if (error.exitCode === 0) {
        // Help command
        process.exit(0);
    }
    console.error(chalk_1.default.red('CLI Error:'), error.message);
    process.exit(1);
}
exports.default = program;
//# sourceMappingURL=codemind-cycle-enhanced.js.map