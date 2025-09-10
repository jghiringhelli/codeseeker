#!/usr/bin/env node
"use strict";
/**
 * CodeMind Cycle-Enhanced CLI - Simplified Version
 *
 * Demonstrates the validation cycle system without complex integrations.
 * Focus on showing how validation cycles work before every request.
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
exports.SimpleCycleEnhancedCLI = void 0;
const commander_1 = require("commander");
const logger_1 = require("../utils/logger");
const cli_logger_1 = require("../utils/cli-logger");
const validation_cycle_1 = require("../shared/validation-cycle");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
const logger = logger_1.Logger.getInstance();
const cliLogger = cli_logger_1.CLILogger.getInstance();
class SimpleCycleEnhancedCLI {
    validationCycle;
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
    }
    /**
     * Main request processing with integrated validation cycles
     */
    async processRequest(userRequest, projectPath, options = {}) {
        try {
            cliLogger.info(chalk_1.default.blue('🚀 Processing request with cycle validation...'));
            // 1. Build project context
            const context = await this.buildProjectContext(userRequest, projectPath);
            cliLogger.info(chalk_1.default.gray(`📂 Project: ${path.basename(projectPath)} (${context.language})`));
            cliLogger.info(chalk_1.default.gray(`🎯 Request type: ${context.requestType}`));
            if (context.changedFiles && context.changedFiles.length > 0) {
                cliLogger.info(chalk_1.default.gray(`📝 Modified files: ${context.changedFiles.length}`));
            }
            // 2. Run validation cycles (unless skipped)
            if (!options.skipCycles) {
                const cycleResults = await this.runValidationCycles(context, options.force);
                // If core cycle fails and not forcing, return error
                if (!cycleResults.core.success && !options.force) {
                    return this.formatErrorResponse(cycleResults);
                }
                // Show cycle insights
                const cycleInsights = this.validationCycle.formatCycleResults(cycleResults.core, cycleResults.quality);
                if (cycleInsights.trim()) {
                    console.log(chalk_1.default.blue('\\n📊 Validation Results:'));
                    console.log(cycleInsights);
                }
            }
            // 3. Simulate request processing
            const response = await this.simulateRequestExecution(userRequest, context);
            // 4. Post-execution validation (if code was modified)
            if (context.requestType === 'code_modification' && !options.skipCycles) {
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
            // Not a git repo or git not available
            changedFiles = [];
        }
        // Detect language and framework
        const { language, framework } = await this.detectProjectTechnology(projectPath);
        return {
            projectPath,
            changedFiles,
            requestType,
            language,
            framework,
            userIntent: userRequest
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
                else if (deps.express)
                    framework = 'express';
                else if (deps.next)
                    framework = 'nextjs';
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
            language = 'javascript';
        }
        return { language, framework };
    }
    /**
     * Run validation cycles
     */
    async runValidationCycles(context, force = false) {
        cliLogger.info(chalk_1.default.blue('🔄 Running validation cycles...'));
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
     * Simulate request execution
     */
    async simulateRequestExecution(userRequest, context) {
        const lines = [];
        lines.push(chalk_1.default.green('✅ Request processed successfully\\n'));
        // Simulate different response types
        if (context.requestType === 'code_modification') {
            lines.push(chalk_1.default.cyan('💻 Code Modification Request:'));
            lines.push(`   Request: "${userRequest}"`);
            lines.push(`   Language: ${context.language || 'javascript'}`);
            lines.push(`   Framework: ${context.framework || 'none'}`);
            if (context.changedFiles && context.changedFiles.length > 0) {
                lines.push(`   Files to consider: ${context.changedFiles.slice(0, 3).join(', ')}${context.changedFiles.length > 3 ? '...' : ''}`);
            }
            lines.push('\\n💡 In a real implementation, this would:');
            lines.push('   • Generate appropriate code based on validation results');
            lines.push('   • Apply architectural patterns suggested by SOLID analyzer');
            lines.push('   • Avoid creating duplicate code flagged by duplication detector');
            lines.push('   • Ensure the result compiles and passes tests');
        }
        else if (context.requestType === 'analysis') {
            lines.push(chalk_1.default.cyan('🔍 Analysis Request:'));
            lines.push(`   Query: "${userRequest}"`);
            lines.push(`   Project type: ${context.language}/${context.framework || 'vanilla'}`);
            lines.push('\\n📊 Analysis would include:');
            lines.push('   • Code quality metrics from validation cycles');
            lines.push('   • SOLID principles adherence scores');
            lines.push('   • Security and duplication analysis results');
            lines.push('   • Compilation and test status');
        }
        else {
            lines.push(chalk_1.default.cyan('💬 General Request:'));
            lines.push(`   Query: "${userRequest}"`);
            lines.push('\\n📋 Response would be enhanced with:');
            lines.push('   • Project-specific context');
            lines.push('   • Quality insights from validation cycles');
            lines.push('   • Best practices for this codebase');
        }
        return lines.join('\\n');
    }
    /**
     * Run post-execution validation
     */
    async runPostExecutionValidation(context) {
        try {
            cliLogger.info(chalk_1.default.blue('\\n🔄 Running post-execution validation...'));
            // Quick compilation check after code changes
            const postResult = await this.validationCycle.runCoreCycle(context);
            if (!postResult.success) {
                cliLogger.warning(chalk_1.default.yellow('⚠️ Post-execution validation found issues:'));
                postResult.errors.forEach(error => {
                    cliLogger.warning(`   • ${error.message}`);
                });
                cliLogger.info(chalk_1.default.blue('Consider running: npm run build'));
            }
            else {
                cliLogger.success('✅ Post-execution validation passed');
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
}
exports.SimpleCycleEnhancedCLI = SimpleCycleEnhancedCLI;
// CLI Commands
program
    .name('codemind-cycle')
    .description('CodeMind CLI with integrated validation cycles (demo)')
    .version('3.0.0');
program
    .command('analyze')
    .description('Analyze project with quality validation')
    .argument('<query>', 'Analysis query')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .option('--skip-cycles', 'Skip validation cycles')
    .action(async (query, options) => {
    const cli = new SimpleCycleEnhancedCLI();
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
    const cli = new SimpleCycleEnhancedCLI();
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
    const cli = new SimpleCycleEnhancedCLI();
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
    .command('demo')
    .description('Demo the cycle system with sample requests')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .action(async (options) => {
    const cli = new SimpleCycleEnhancedCLI();
    const demoRequests = [
        { type: 'analysis', request: 'analyze the architecture of this project' },
        { type: 'code', request: 'add a new user authentication function' },
        { type: 'general', request: 'explain how dependency injection works' }
    ];
    console.log(chalk_1.default.bold.cyan('🎭 CodeMind Cycle System Demo\\n'));
    console.log(chalk_1.default.gray('This demonstrates how validation cycles work before every request.\\n'));
    for (const demo of demoRequests) {
        console.log(chalk_1.default.bold.yellow(`\\n${'='.repeat(60)}`));
        console.log(chalk_1.default.bold.yellow(`DEMO: ${demo.type.toUpperCase()} REQUEST`));
        console.log(chalk_1.default.bold.yellow(`${'='.repeat(60)}`));
        const result = await cli.processRequest(demo.request, options.path);
        console.log(result);
    }
    console.log(chalk_1.default.bold.green('\\n🎉 Demo completed! This shows how CodeMind now validates every request.'));
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
    const cli = new SimpleCycleEnhancedCLI();
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
        process.exit(0);
    }
    console.error(chalk_1.default.red('CLI Error:'), error.message);
    process.exit(1);
}
exports.default = program;
//# sourceMappingURL=codemind-cycle-simple.js.map