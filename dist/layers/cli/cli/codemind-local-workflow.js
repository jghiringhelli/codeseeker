#!/usr/bin/env node
"use strict";
/**
 * CodeMind Local Workflow CLI
 * Self-contained CLI that executes the complete workflow cycle locally:
 * 1. Infer user intention
 * 2. Select tools based on intention
 * 3. Find exact files related to request
 * 4. Split request into manageable steps
 * 5. Execute each step with enhanced context
 * 6. Quality checks after each step
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
exports.CodeMindLocalWorkflow = void 0;
const commander_1 = require("commander");
const logger_1 = require("../utils/logger");
const cli_logger_1 = require("../utils/cli-logger");
const intelligent_tool_selector_1 = require("../shared/intelligent-tool-selector");
const enhanced_context_provider_1 = require("../shared/enhanced-context-provider");
const change_assessment_system_1 = require("../shared/change-assessment-system");
const hybrid_file_discovery_1 = require("../shared/hybrid-file-discovery");
const comprehensive_impact_analyzer_1 = require("../shared/comprehensive-impact-analyzer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const program = new commander_1.Command();
const logger = logger_1.Logger.getInstance();
const cliLogger = cli_logger_1.CLILogger.getInstance();
class CodeMindLocalWorkflow {
    toolSelector;
    contextProvider;
    changeAssessment;
    fileDiscovery;
    impactAnalyzer;
    constructor() {
        this.toolSelector = new intelligent_tool_selector_1.IntelligentToolSelector();
        this.contextProvider = new enhanced_context_provider_1.EnhancedContextProvider();
        this.changeAssessment = new change_assessment_system_1.ChangeAssessmentSystem();
        this.fileDiscovery = new hybrid_file_discovery_1.HybridFileDiscovery();
        this.impactAnalyzer = new comprehensive_impact_analyzer_1.ComprehensiveImpactAnalyzer();
    }
    /**
     * Step 1: Infer user intention from the request
     */
    inferUserIntention(userRequest, projectPath) {
        logger.info('🧠 Step 1: Inferring user intention...');
        // Analyze request patterns
        const request = userRequest.toLowerCase();
        let type = 'feature';
        let complexity = 'moderate';
        let affectedAreas = [];
        let requiredTools = [];
        // Intent classification
        if (request.includes('fix') || request.includes('bug') || request.includes('error')) {
            type = 'bugfix';
            requiredTools.push('compilation-verifier', 'solid-principles');
        }
        else if (request.includes('refactor') || request.includes('clean') || request.includes('improve')) {
            type = 'refactor';
            requiredTools.push('solid-principles', 'centralization-detector');
        }
        else if (request.includes('test') || request.includes('spec')) {
            type = 'test';
            requiredTools.push('compilation-verifier');
        }
        else if (request.includes('doc') || request.includes('comment')) {
            type = 'documentation';
            requiredTools.push('tree-navigation');
        }
        else if (request.includes('optimize') || request.includes('performance')) {
            type = 'optimization';
            requiredTools.push('solid-principles', 'compilation-verifier');
        }
        else {
            type = 'feature';
            requiredTools.push('compilation-verifier', 'solid-principles', 'tree-navigation');
        }
        // Complexity assessment
        if (request.includes('simple') || request.includes('quick') || request.length < 50) {
            complexity = 'simple';
        }
        else if (request.includes('complex') || request.includes('architecture') || request.includes('system')) {
            complexity = 'complex';
        }
        // Affected areas detection
        if (request.includes('cli') || request.includes('command'))
            affectedAreas.push('cli');
        if (request.includes('dashboard') || request.includes('ui'))
            affectedAreas.push('dashboard');
        if (request.includes('database') || request.includes('db'))
            affectedAreas.push('database');
        if (request.includes('api') || request.includes('endpoint'))
            affectedAreas.push('api');
        if (request.includes('test'))
            affectedAreas.push('tests');
        if (request.includes('doc'))
            affectedAreas.push('docs');
        const intention = {
            type,
            description: userRequest,
            complexity,
            affectedAreas,
            requiredTools
        };
        logger.info(`   Intent: ${type} (${complexity})`);
        logger.info(`   Areas: ${affectedAreas.join(', ') || 'general'}`);
        logger.info(`   Tools: ${requiredTools.join(', ')}`);
        return intention;
    }
    /**
     * Step 2: Select relevant tools based on intention
     */
    async selectTools(intention, projectPath) {
        logger.info('🔧 Step 2: Selecting relevant tools...');
        try {
            // Get intelligent tool recommendations
            const projectId = await this.resolveProjectId(projectPath);
            const toolRecommendations = await this.toolSelector.selectToolsForRequest({
                projectPath,
                projectId,
                userQuery: intention.description,
                cliCommand: 'analyze',
                intent: intention.type
            });
            // Merge with required tools from intention
            const allTools = [...new Set([
                    ...intention.requiredTools,
                    ...toolRecommendations.selectedTools.map(t => t.metadata.name)
                ])];
            logger.info(`   Selected tools: ${allTools.join(', ')}`);
            return allTools;
        }
        catch (error) {
            logger.warn('   Tool selection failed, using basic set:', error);
            return intention.requiredTools;
        }
    }
    /**
     * Step 3: Find exact files related to the request
     */
    async findRelevantFiles(intention, tools, projectPath) {
        logger.info('📁 Step 3: Finding relevant files...');
        try {
            const projectId = await this.resolveProjectId(projectPath);
            const discoveryResult = await this.fileDiscovery.discoverFiles({
                query: intention.description,
                projectPath,
                projectId,
                maxFiles: intention.complexity === 'simple' ? 5 : intention.complexity === 'moderate' ? 15 : 30
            });
            const relevantFiles = [...discoveryResult.primaryFiles, ...discoveryResult.relatedFiles].map(f => f.filePath);
            logger.info(`   Found ${relevantFiles.length} relevant files:`);
            relevantFiles.slice(0, 5).forEach(file => {
                logger.info(`     • ${path.relative(projectPath, file)}`);
            });
            if (relevantFiles.length > 5) {
                logger.info(`     • ... and ${relevantFiles.length - 5} more`);
            }
            return relevantFiles;
        }
        catch (error) {
            logger.warn('   File discovery failed, using pattern-based approach:', error);
            return this.fallbackFileDiscovery(intention, projectPath);
        }
    }
    /**
     * Fallback file discovery using patterns
     */
    fallbackFileDiscovery(intention, projectPath) {
        const files = [];
        for (const area of intention.affectedAreas) {
            const areaPath = path.join(projectPath, 'src', area);
            if (fs.existsSync(areaPath)) {
                const areaFiles = this.getAllTSFiles(areaPath);
                files.push(...areaFiles);
            }
        }
        // If no specific areas, search common locations
        if (files.length === 0) {
            const commonPaths = ['src/cli', 'src/shared', 'src/features'];
            for (const commonPath of commonPaths) {
                const fullPath = path.join(projectPath, commonPath);
                if (fs.existsSync(fullPath)) {
                    const commonFiles = this.getAllTSFiles(fullPath);
                    files.push(...commonFiles.slice(0, 3)); // Limit per directory
                }
            }
        }
        return files;
    }
    /**
     * Step 4: Split request into manageable steps
     */
    async planWorkflowSteps(intention, tools, files, projectPath) {
        logger.info('📋 Step 4: Planning workflow steps...');
        try {
            const impact = await this.impactAnalyzer.analyzeCompleteImpact(intention.description, projectPath);
            const steps = [];
            // Step 1: Analysis and Planning
            steps.push({
                id: 'analyze',
                description: 'Analyze current codebase and plan changes',
                files: files.slice(0, 3),
                action: 'analyze',
                context: { intention, impact },
                priority: 'high'
            });
            // Step 2: Core Implementation
            if (intention.type === 'feature' || intention.type === 'bugfix') {
                steps.push({
                    id: 'implement',
                    description: `Implement ${intention.type}`,
                    files: files.filter(f => f.includes('src/')),
                    action: 'modify',
                    context: { intention },
                    priority: 'high'
                });
            }
            // Step 3: Tests (if needed)
            if (intention.type !== 'documentation' && files.some(f => f.includes('test'))) {
                steps.push({
                    id: 'test',
                    description: 'Update or create tests',
                    files: files.filter(f => f.includes('test')),
                    action: 'test',
                    context: { intention },
                    priority: 'medium'
                });
            }
            // Step 4: Quality Check
            steps.push({
                id: 'quality',
                description: 'Quality check and validation',
                files: files,
                action: 'validate',
                context: { intention, tools },
                priority: 'high'
            });
            logger.info(`   Planned ${steps.length} workflow steps:`);
            steps.forEach((step, i) => {
                logger.info(`     ${i + 1}. ${step.description} (${step.files.length} files)`);
            });
            return steps;
        }
        catch (error) {
            logger.warn('   Workflow planning failed, using simple steps:', error);
            return this.createSimpleWorkflowSteps(intention, files);
        }
    }
    /**
     * Step 5: Execute each step with enhanced context
     */
    async executeWorkflowStep(step, projectPath, userRequest) {
        logger.info(`🚀 Executing: ${step.description}`);
        try {
            // Generate enhanced context for this step
            const projectId = await this.resolveProjectId(projectPath);
            const enhancedContext = await this.contextProvider.generateEnhancedContext({
                userQuery: userRequest,
                projectPath,
                projectId,
                cliCommand: 'execute-step',
                intent: step.action,
                tokenBudget: 2000
            });
            // Display context to user for Claude Code execution
            logger.info(`\n📝 Enhanced Context for Step: ${step.description}`);
            logger.info('='.repeat(60));
            if (step.files.length > 0) {
                logger.info(`📁 Files to focus on (${step.files.length}):`);
                step.files.forEach(file => {
                    logger.info(`   • ${path.relative(projectPath, file)}`);
                });
            }
            if (enhancedContext.toolsUsed.length > 0) {
                logger.info(`🔧 Tools used: ${enhancedContext.toolsUsed.join(', ')}`);
            }
            if (enhancedContext.recommendedActions.length > 0) {
                logger.info(`💡 Recommended actions:`);
                enhancedContext.recommendedActions.slice(0, 3).forEach(action => {
                    logger.info(`   • ${action}`);
                });
            }
            // Provide specific guidance for Claude Code
            logger.info(`\n🎯 For Claude Code execution:`);
            logger.info(`   Request: ${userRequest}`);
            logger.info(`   Step: ${step.description}`);
            logger.info(`   Action: ${step.action}`);
            if (step.context.intention) {
                logger.info(`   Intent: ${step.context.intention.type} (${step.context.intention.complexity})`);
            }
            logger.info('='.repeat(60));
            logger.info(`\n⏸️  Please execute this step with Claude Code and press Enter when complete...`);
            // Wait for user confirmation
            await this.waitForUserConfirmation();
            return true;
        }
        catch (error) {
            logger.error(`   Step execution failed: ${error}`);
            return false;
        }
    }
    /**
     * Step 6: Quality checks after each step
     */
    async performQualityCheck(step, projectPath) {
        logger.info(`🔍 Quality check for: ${step.description}`);
        const issues = [];
        try {
            // 1. Compilation check
            if (step.files.some(f => f.endsWith('.ts') || f.endsWith('.js'))) {
                const compileResult = await this.checkCompilation(projectPath);
                if (!compileResult.success) {
                    issues.push(`Compilation failed: ${compileResult.error}`);
                }
            }
            // 2. SOLID principles check (for implementation steps)
            if (step.action === 'modify' || step.action === 'implement') {
                const solidResult = await this.checkSOLIDPrinciples(step.files, projectPath);
                if (solidResult.violations.length > 0) {
                    issues.push(`SOLID violations: ${solidResult.violations.join(', ')}`);
                }
            }
            // 3. Test execution (if test files are involved)
            if (step.files.some(f => f.includes('test')) || step.action === 'test') {
                const testResult = await this.runTests(projectPath);
                if (!testResult.success) {
                    issues.push(`Tests failed: ${testResult.failures}`);
                }
            }
            // 4. No code duplication check
            const duplicationResult = await this.checkCodeDuplication(step.files);
            if (duplicationResult.hasDuplication) {
                issues.push(`Code duplication detected in ${duplicationResult.files.length} files`);
            }
            const passed = issues.length === 0;
            if (passed) {
                logger.info(`   ✅ Quality check passed`);
            }
            else {
                logger.warn(`   ⚠️  Quality issues found:`);
                issues.forEach(issue => logger.warn(`     • ${issue}`));
            }
            return { passed, issues };
        }
        catch (error) {
            logger.error(`   Quality check failed: ${error}`);
            return { passed: false, issues: [`Quality check error: ${error}`] };
        }
    }
    /**
     * Main workflow execution
     */
    async executeWorkflow(userRequest, projectPath) {
        logger.info(`🚀 CodeMind Local Workflow: "${userRequest}"`);
        logger.info(`📁 Project: ${projectPath}\n`);
        try {
            // Step 1: Infer user intention
            const intention = this.inferUserIntention(userRequest, projectPath);
            // Step 2: Select tools
            const tools = await this.selectTools(intention, projectPath);
            // Step 3: Find relevant files
            const files = await this.findRelevantFiles(intention, tools, projectPath);
            // Step 4: Plan workflow steps
            const steps = await this.planWorkflowSteps(intention, tools, files, projectPath);
            // Step 5 & 6: Execute steps with quality checks
            let totalIssues = 0;
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                logger.info(`\n${'='.repeat(80)}`);
                logger.info(`📍 STEP ${i + 1}/${steps.length}: ${step.description}`);
                logger.info(`${'='.repeat(80)}`);
                // Execute the step
                const stepResult = await this.executeWorkflowStep(step, projectPath, userRequest);
                if (!stepResult) {
                    logger.error(`❌ Step ${i + 1} failed. Stopping workflow.`);
                    return;
                }
                // Quality check after step
                const qualityResult = await this.performQualityCheck(step, projectPath);
                totalIssues += qualityResult.issues.length;
                if (!qualityResult.passed && step.priority === 'high') {
                    logger.warn(`⚠️  Quality issues in critical step. Please fix before continuing.`);
                    logger.info(`   Issues: ${qualityResult.issues.join('; ')}`);
                    // Give user chance to fix
                    logger.info(`\n🔧 Please fix the quality issues and press Enter to continue...`);
                    await this.waitForUserConfirmation();
                }
            }
            // Final assessment
            logger.info(`\n${'🎉'.repeat(20)}`);
            logger.info(`🎉 Workflow completed!`);
            logger.info(`📊 Summary:`);
            logger.info(`   • ${steps.length} steps executed`);
            logger.info(`   • ${files.length} files involved`);
            logger.info(`   • ${tools.length} tools used`);
            logger.info(`   • ${totalIssues} quality issues ${totalIssues === 0 ? '(Perfect!)' : '(Review needed)'}`);
            if (totalIssues === 0) {
                logger.info(`✨ All quality checks passed! Your implementation follows best practices.`);
            }
        }
        catch (error) {
            logger.error(`💥 Workflow failed: ${error}`);
        }
    }
    // Helper methods
    async resolveProjectId(projectPath) {
        try {
            const configPath = path.join(projectPath, '.codemind', 'project.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.projectId)
                    return config.projectId;
            }
        }
        catch (error) {
            // Ignore
        }
        return `proj_${Buffer.from(projectPath).toString('base64').replace(/[+=]/g, '').substring(0, 8)}`;
    }
    createSimpleWorkflowSteps(intention, files) {
        return [
            {
                id: 'analyze',
                description: 'Analyze and implement changes',
                files: files.slice(0, 10),
                action: 'modify',
                context: { intention },
                priority: 'high'
            },
            {
                id: 'validate',
                description: 'Validate implementation',
                files: files,
                action: 'validate',
                context: { intention },
                priority: 'high'
            }
        ];
    }
    getAllTSFiles(dirPath) {
        const files = [];
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    files.push(...this.getAllTSFiles(fullPath));
                }
                else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            // Ignore directory read errors
        }
        return files;
    }
    async waitForUserConfirmation() {
        return new Promise((resolve) => {
            const stdin = process.stdin;
            stdin.setRawMode(true);
            stdin.resume();
            stdin.once('data', () => {
                stdin.setRawMode(false);
                stdin.pause();
                resolve();
            });
        });
    }
    async checkCompilation(projectPath) {
        try {
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec('npx tsc --noEmit', { cwd: projectPath }, (error, stdout, stderr) => {
                    if (error) {
                        resolve({ success: false, error: stderr || error.message });
                    }
                    else {
                        resolve({ success: true });
                    }
                });
            });
        }
        catch (error) {
            return { success: false, error: `Compilation check failed: ${error}` };
        }
    }
    async checkSOLIDPrinciples(files, projectPath) {
        // Simplified SOLID check - in real implementation would use AST analysis
        const violations = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                // Simple heuristics for SOLID violations
                if (content.split('\n').length > 200) {
                    violations.push(`${path.basename(file)}: Potentially violates SRP (too large)`);
                }
                if (content.includes('instanceof') && content.split('instanceof').length > 3) {
                    violations.push(`${path.basename(file)}: Potentially violates OCP (type checking)`);
                }
            }
            catch (error) {
                // Ignore file read errors
            }
        }
        return { violations };
    }
    async runTests(projectPath) {
        try {
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec('npm test -- --passWithNoTests', { cwd: projectPath }, (error, stdout, stderr) => {
                    if (error) {
                        resolve({ success: false, failures: stderr || error.message });
                    }
                    else {
                        resolve({ success: true, failures: '' });
                    }
                });
            });
        }
        catch (error) {
            return { success: false, failures: `Test execution failed: ${error}` };
        }
    }
    async checkCodeDuplication(files) {
        // Simplified duplication check
        const duplicatedFiles = [];
        try {
            const codeBlocks = new Map();
            for (const file of files) {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const lines = content.split('\n');
                    // Check for blocks of 5+ similar lines
                    for (let i = 0; i < lines.length - 4; i++) {
                        const block = lines.slice(i, i + 5).join('\n').trim();
                        if (block.length > 50) { // Only check substantial blocks
                            if (codeBlocks.has(block)) {
                                codeBlocks.get(block).push(file);
                                duplicatedFiles.push(file);
                            }
                            else {
                                codeBlocks.set(block, [file]);
                            }
                        }
                    }
                }
                catch (error) {
                    // Ignore file read errors
                }
            }
        }
        catch (error) {
            // Ignore duplication check errors
        }
        return { hasDuplication: duplicatedFiles.length > 0, files: duplicatedFiles };
    }
}
exports.CodeMindLocalWorkflow = CodeMindLocalWorkflow;
// CLI Commands
program
    .name('codemind-local')
    .description('CodeMind Local Workflow - Self-contained intelligent CLI')
    .version('2.0.0');
program
    .command('execute')
    .description('Execute complete local workflow for a request')
    .argument('<request>', 'Your request description')
    .argument('<projectPath>', 'Path to project directory')
    .action(async (request, projectPath) => {
    const workflow = new CodeMindLocalWorkflow();
    await workflow.executeWorkflow(request, projectPath);
});
program
    .command('analyze')
    .description('Analyze and plan workflow without execution')
    .argument('<request>', 'Your request description')
    .argument('<projectPath>', 'Path to project directory')
    .action(async (request, projectPath) => {
    const workflow = new CodeMindLocalWorkflow();
    // Just do the analysis steps
    logger.info('🧠 Analyzing request and planning workflow...');
    const intention = workflow.inferUserIntention(request, projectPath);
    const tools = await workflow.selectTools(intention, projectPath);
    const files = await workflow.findRelevantFiles(intention, tools, projectPath);
    const steps = await workflow.planWorkflowSteps(intention, tools, files, projectPath);
    logger.info('\n📋 Workflow Plan:');
    steps.forEach((step, i) => {
        logger.info(`  ${i + 1}. ${step.description}`);
        logger.info(`     Files: ${step.files.length}`);
        logger.info(`     Action: ${step.action}`);
    });
});
// Run if called directly
if (require.main === module) {
    program.parse();
}
//# sourceMappingURL=codemind-local-workflow.js.map