#!/usr/bin/env node
"use strict";
/**
 * CodeMind CLI - User-facing CLI tool for enhanced Claude Code interactions
 *
 * This is the CLI that users interact with directly. It provides enhanced
 * Claude Code capabilities through integration with the CodeMind ecosystem.
 *
 * The Orchestrator (separate layer) can spawn multiple instances of Claude Code
 * terminals with specialized contexts for complex multi-role scenarios.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeMindCLI = void 0;
const child_process_1 = require("child_process");
const node_fetch_1 = __importDefault(require("node-fetch"));
const logger_1 = require("../utils/logger");
const context_optimizer_1 = require("./context-optimizer");
const database_1 = require("../database/database");
class CodeMindCLI {
    logger = logger_1.Logger.getInstance();
    contextOptimizer = new context_optimizer_1.ContextOptimizer();
    db = new database_1.Database();
    constructor() {
        this.logger.info('🧠 CodeMind CLI initialized - Enhanced Claude Code with intelligent context');
    }
    /**
     * Main CLI entry point - processes user commands with enhanced context
     */
    async run(args) {
        try {
            const { command, options, remainingArgs } = this.parseArgs(args);
            switch (command) {
                case 'analyze':
                    await this.runAnalysis(remainingArgs, options);
                    break;
                case 'orchestrate':
                    await this.requestOrchestration(remainingArgs, options);
                    break;
                case 'init':
                    await this.initializeProject(options);
                    break;
                case 'help':
                    this.showHelp();
                    break;
                default:
                    // Default behavior: enhance regular Claude Code interaction
                    await this.enhanceClaudeCodeInteraction(args, options);
            }
        }
        catch (error) {
            this.logger.error('❌ CodeMind CLI error:', error);
            process.exit(1);
        }
    }
    /**
     * Default behavior: enhance regular Claude Code with intelligent context
     */
    async enhanceClaudeCodeInteraction(args, options) {
        this.logger.info('🚀 Enhancing Claude Code interaction with intelligent context...');
        const projectPath = options.project || process.cwd();
        const userQuery = args.join(' ');
        // Generate optimized context for the user's query
        const optimizedContext = await this.contextOptimizer.optimizeContext({
            projectPath,
            query: userQuery,
            tokenBudget: options.contextBudget || 6000,
            optimization: options.optimization || 'balanced'
        });
        // Prepare enhanced Claude Code environment
        const claudeCodeArgs = this.prepareClaudeCodeArgs(optimizedContext, args);
        this.logger.info(`🎯 Context optimized: ${optimizedContext.relevantFiles?.length || 0} files selected`);
        this.logger.info(`📊 Token usage: ${optimizedContext.estimatedTokens || 0} tokens`);
        // Launch Claude Code with enhanced context
        try {
            (0, child_process_1.execSync)(`claude ${claudeCodeArgs.join(' ')}`, {
                stdio: 'inherit',
                cwd: projectPath
            });
            // Update database with usage
            if (options.updateDatabase !== false) {
                await this.updateUsageDatabase(userQuery, projectPath, optimizedContext);
            }
        }
        catch (error) {
            this.logger.error('❌ Claude Code execution failed:', error);
            throw error;
        }
    }
    /**
     * Run analysis tools and provide results
     */
    async runAnalysis(args, options) {
        this.logger.info('🔍 Running CodeMind analysis...');
        const projectPath = options.project || process.cwd();
        const analysisType = args[0] || 'full';
        // This would integrate with existing analysis tools
        console.log(`\n📊 Analysis Results for: ${projectPath}`);
        console.log(`Analysis Type: ${analysisType}`);
        console.log(`\n🎯 Use these insights to enhance your Claude Code interactions!`);
        console.log(`Run: codemind [your-query] --project="${projectPath}" for optimized context`);
    }
    /**
     * Request sequential workflow orchestration
     */
    async requestOrchestration(args, options) {
        this.logger.info('🎭 Requesting sequential workflow orchestration...');
        const orchestratorEndpoint = process.env.CODEMIND_ORCHESTRATOR_URL || 'http://localhost:3006';
        const projectPath = options.project || process.cwd();
        const userQuery = args.join(' ');
        if (!userQuery) {
            console.log('❌ Please provide a query for orchestration');
            console.log('Example: codemind orchestrate "comprehensive production readiness review"');
            return;
        }
        try {
            console.log('🚀 Starting sequential workflow orchestration...');
            console.log(`📝 Query: "${userQuery}"`);
            console.log(`📁 Project: ${projectPath}`);
            console.log('⏳ Analyzing complexity and building workflow graph...\n');
            const response = await (0, node_fetch_1.default)(`${orchestratorEndpoint}/api/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userQuery,
                    projectPath,
                    requestedBy: 'cli',
                    options: {
                        priority: options.optimization === 'speed' ? 'high' : 'normal',
                        timeoutMinutes: options.contextBudget ? Math.ceil(options.contextBudget / 200) : 30,
                        maxRetries: 3
                    }
                })
            });
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Sequential workflow orchestration initiated!');
                console.log(`\n🎭 Orchestration ID: ${result.orchestrationId}`);
                console.log(`📋 Workflow: ${result.workflowGraph.name}`);
                console.log(`📊 Role Sequence: ${result.workflowGraph.roles.map((r) => r.name).join(' → ')}`);
                console.log(`⏱️  Estimated Duration: ${Math.round(result.workflowGraph.estimatedDuration / 1000)}s`);
                console.log(`🧮 Estimated Tokens: ${result.workflowGraph.estimatedTokens}`);
                console.log('\n🔄 Role-based analysis pipeline initiated:');
                result.workflowGraph.roles.forEach((role, index) => {
                    console.log(`  ${index + 1}. ${role.name} - ${role.description}`);
                });
                console.log('\n📊 Monitor progress:');
                console.log(`   Dashboard: http://localhost:3005 (Orchestrator tab)`);
                console.log(`   API Status: ${orchestratorEndpoint}/api/orchestration/${result.orchestrationId}/status`);
                // Track CLI usage
                await this.trackSequentialWorkflowUsage(userQuery, projectPath, result.orchestrationId, options);
            }
            else {
                const errorResult = await response.json().catch(() => null);
                throw new Error(`Orchestrator request failed: ${response.statusText}${errorResult ? ' - ' + errorResult.message : ''}`);
            }
        }
        catch (error) {
            this.logger.error('❌ Sequential workflow orchestration failed:', error);
            console.log('\n💡 Troubleshooting:');
            console.log('   1. Ensure Sequential Workflow Orchestrator is running: npm run orchestrator');
            console.log('   2. Verify Redis is running: docker-compose up redis -d');
            console.log('   3. Check dashboard for service status: http://localhost:3005');
            console.log(`   4. Orchestrator API: ${orchestratorEndpoint}/api/system/status`);
        }
    }
    /**
     * Initialize CodeMind for a project
     */
    async initializeProject(options) {
        const projectPath = options.project || process.cwd();
        console.log(`\n🏗️  Initializing CodeMind for project: ${projectPath}`);
        try {
            // Run initialization script
            (0, child_process_1.execSync)('node scripts/initialize-cli-tools-data.js ' + projectPath, {
                stdio: 'inherit'
            });
            console.log('\n✅ CodeMind initialization completed!');
            console.log('\n🚀 You can now use enhanced Claude Code interactions:');
            console.log(`   codemind "your question" --project="${projectPath}"`);
            console.log('\n🎭 For complex tasks, try orchestration:');
            console.log(`   codemind orchestrate "complex analysis request" --project="${projectPath}"`);
        }
        catch (error) {
            this.logger.error('❌ Project initialization failed:', error);
            throw error;
        }
    }
    parseArgs(args) {
        const options = {};
        const remainingArgs = [];
        let command = '';
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--project=')) {
                options.project = arg.split('=')[1];
            }
            else if (arg.startsWith('--optimization=')) {
                options.optimization = arg.split('=')[1];
            }
            else if (arg.startsWith('--context-budget=')) {
                options.contextBudget = parseInt(arg.split('=')[1]);
            }
            else if (arg === '--use-orchestrator') {
                options.useOrchestrator = true;
            }
            else if (arg === '--no-db-update') {
                options.updateDatabase = false;
            }
            else if (i === 0 && ['analyze', 'orchestrate', 'init', 'help'].includes(arg)) {
                command = arg;
            }
            else {
                remainingArgs.push(arg);
            }
        }
        return { command, options, remainingArgs };
    }
    prepareClaudeCodeArgs(context, originalArgs) {
        const args = [...originalArgs];
        // Add context optimization flags to Claude Code
        if (context.relevantFiles?.length > 0) {
            args.push(`--files="${context.relevantFiles.join(',')}" `);
        }
        if (context.focusAreas?.length > 0) {
            args.push(`--focus="${context.focusAreas.join(',')}" `);
        }
        return args;
    }
    async updateUsageDatabase(query, projectPath, context) {
        try {
            await this.db.query(`
        INSERT INTO codemind_cli_usage (
          usage_type, user_query, project_path, context_files_count, 
          estimated_tokens, optimization_mode, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
                'single_analysis',
                query,
                projectPath,
                context.relevantFiles?.length || 0,
                context.estimatedTokens || 0,
                context.optimization || 'balanced'
            ]);
        }
        catch (error) {
            this.logger.warn('Failed to update usage database:', error);
        }
    }
    /**
     * Track sequential workflow usage in database
     */
    async trackSequentialWorkflowUsage(query, projectPath, orchestrationId, options) {
        try {
            await this.db.query(`
        INSERT INTO codemind_cli_usage (
          usage_type, user_query, project_path, optimization_mode, 
          estimated_tokens, tools_selected, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
                'sequential_workflow',
                query,
                projectPath,
                options.optimization || 'balanced',
                0, // Will be updated when workflow completes
                [] // Tools are determined by workflow graph
            ]);
            this.logger.info('📊 Sequential workflow usage tracked', {
                orchestrationId,
                query,
                projectPath
            });
        }
        catch (error) {
            this.logger.warn('Failed to track sequential workflow usage:', error);
        }
    }
    showHelp() {
        console.log(`
🧠 CodeMind CLI - Enhanced Claude Code with Sequential Workflow Orchestration

USAGE:
  codemind [command] [options] [query...]

COMMANDS:
  <query>              Enhanced single-perspective Claude Code analysis
  analyze [type]       Run CodeMind analysis tools on the project  
  orchestrate <query>  Start sequential multi-role workflow orchestration
  init                 Initialize CodeMind for the current project
  help                 Show this help message

OPTIONS:
  --project=<path>           Specify project path (default: current directory)
  --optimization=<mode>      Analysis optimization: speed|accuracy|balanced (default: balanced)
  --context-budget=<tokens>  Maximum tokens for context (default: 6000)
  --no-db-update            Skip database usage tracking

EXAMPLES:
  # Single-perspective enhanced Claude Code analysis
  codemind "fix authentication issues in my React app"
  
  # Analysis tools usage
  codemind analyze duplication --project=./my-app
  
  # Sequential multi-role workflow orchestration (ADVANCED)
  codemind orchestrate "comprehensive production readiness review"
  codemind orchestrate "full architectural analysis with security assessment"
  codemind orchestrate "code quality review with performance optimization"
  
  # Initialize new project
  codemind init --project=./new-project

SEQUENTIAL WORKFLOW ORCHESTRATION:
  🎭 Multi-role expert analysis with specialized terminals:
     • Architect: System design, dependencies, architecture patterns
     • Security: Vulnerability assessment, threat modeling, compliance
     • Quality: Code quality, testing coverage, maintainability 
     • Performance: Bottleneck identification, optimization opportunities
     • Coordinator: Synthesizes all insights into actionable recommendations

  🔄 Sequential pipeline: Each role enriches context for the next role
  📊 Monitor progress: Dashboard (http://localhost:3005) or API endpoints
  🚀 Start services: npm run orchestrator && npm run role-terminal

ARCHITECTURE:
  • CLI: Single-perspective enhanced Claude Code (this tool)
  • Orchestrator: Multi-role workflow coordination (sequential analysis)
  • Dashboard: Visual management and monitoring interface

For more information, visit: https://github.com/your-org/codemind
`);
    }
}
exports.CodeMindCLI = CodeMindCLI;
// CLI Entry Point
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('💡 CodeMind CLI - Type "codemind help" for usage information');
        return;
    }
    const cli = new CodeMindCLI();
    await cli.run(args);
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = CodeMindCLI;
//# sourceMappingURL=codemind-cli.js.map