"use strict";
/**
 * CommandProcessor - Handles command parsing, routing, and help system
 * Single Responsibility: Command processing and routing
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
exports.CommandProcessor = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const theme_1 = require("../ui/theme");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class CommandProcessor {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Process any input - either command or natural language
     */
    async processInput(input) {
        const trimmedInput = input.trim();
        if (trimmedInput.startsWith('/')) {
            return this.processCommand(trimmedInput.substring(1));
        }
        else {
            return this.processNaturalLanguage(trimmedInput);
        }
    }
    /**
     * Process slash commands
     */
    async processCommand(commandInput) {
        const parts = commandInput.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');
        switch (command) {
            case 'setup':
                return this.handleSetup(args);
            case 'init':
                return this.handleInit(args);
            case 'status':
                return this.handleStatus();
            case 'project':
                return this.handleProject(args);
            case 'search':
                return this.handleSearch(args);
            case 'analyze':
                return this.handleAnalyze(args);
            case 'help':
                return this.handleHelp(args);
            case 'exit':
            case 'quit':
                return this.handleExit();
            default:
                return {
                    success: false,
                    message: `Unknown command: ${command}. Type "/help" for available commands.`
                };
        }
    }
    /**
     * Process natural language queries through Claude Code
     */
    async processNaturalLanguage(query) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first to set up your project.'
            };
        }
        console.log(theme_1.Theme.colors.info('🤖 Processing through AI pipeline...'));
        try {
            const result = await this.context.claudeOrchestrator.processRequest(query, this.context.currentProject.projectPath);
            if (result.success) {
                this.context.userInterface.displayProcessingResults(result.data);
                return {
                    success: true,
                    message: 'Request processed successfully',
                    data: result.data
                };
            }
            else {
                return {
                    success: false,
                    message: result.error || 'Processing failed'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Processing error: ${error.message}`
            };
        }
    }
    // Command Handlers
    async handleSetup(args) {
        console.log(theme_1.Theme.colors.info('🔧 Starting complete CodeMind setup...'));
        try {
            // Use our new consolidated setup script
            const setupScript = path.join(__dirname, '../../../scripts/setup-complete.js');
            console.log(theme_1.Theme.colors.info('Running consolidated setup script...'));
            await execAsync(`node "${setupScript}"`, {
                cwd: path.join(__dirname, '../../..')
            });
            return {
                success: true,
                message: '✅ Infrastructure setup complete! Docker containers are running and databases are initialized.\nYou can now run "/init" in any project directory to populate project data.'
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Setup failed: ${error.message || error}`
            };
        }
    }
    async handleInit(args) {
        console.log(theme_1.Theme.colors.info('📝 Starting project initialization...'));
        try {
            const resetFlag = args.includes('--reset') || args.includes('-r');
            // If reset flag is provided, offer to reset database
            if (resetFlag) {
                const confirmReset = await this.context.userInterface.confirm('This will delete all existing project data from the database. Continue?');
                if (!confirmReset) {
                    return {
                        success: false,
                        message: 'Initialization cancelled by user'
                    };
                }
                console.log(theme_1.Theme.colors.warning('🗑️  Resetting database tables...'));
                await this.resetDatabase();
                console.log(theme_1.Theme.colors.success('✅ Database reset complete'));
            }
            // Get project information through UI
            const projectOptions = await this.context.userInterface.getProjectInitOptions();
            // Initialize project
            const result = await this.context.projectManager.initializeProject(process.cwd(), projectOptions);
            if (result.success) {
                this.context.currentProject = result.config;
                return {
                    success: true,
                    message: 'Project initialized successfully!',
                    data: result.config
                };
            }
            else {
                return {
                    success: false,
                    message: result.error || 'Project initialization failed'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Initialization error: ${error.message}`
            };
        }
    }
    async handleStatus() {
        console.log(theme_1.Theme.colors.primary('📊 CodeMind Status'));
        console.log(theme_1.Theme.colors.border('═'.repeat(60)));
        // System status
        console.log(theme_1.Theme.colors.primary('\nSystem:'));
        const healthStatus = await this.context.databaseManager.checkSystemHealth();
        Object.entries(healthStatus).forEach(([service, status]) => {
            const statusColor = status ? theme_1.Theme.colors.success : theme_1.Theme.colors.error;
            const statusText = status ? 'Connected' : 'Disconnected';
            console.log(theme_1.Theme.colors.result(`  • ${service}: ${statusColor(statusText)}`));
        });
        // Project status
        if (this.context.currentProject) {
            console.log(theme_1.Theme.colors.primary('\nProject:'));
            console.log(theme_1.Theme.colors.result(`  • Name: ${this.context.currentProject.projectName}`));
            console.log(theme_1.Theme.colors.result(`  • Type: ${this.context.currentProject.projectType}`));
            console.log(theme_1.Theme.colors.result(`  • Path: ${this.context.currentProject.projectPath}`));
            // Get additional project info
            const projectInfo = await this.context.projectManager.getProjectInfo(this.context.currentProject.projectId);
            if (projectInfo) {
                console.log(theme_1.Theme.colors.result(`  • Files: ${projectInfo.total_files || 0}`));
                console.log(theme_1.Theme.colors.result(`  • Embeddings: ${projectInfo.statistics?.embeddings || 0}`));
            }
        }
        else {
            console.log(theme_1.Theme.colors.warning('\nNo project loaded'));
        }
        return { success: true };
    }
    async handleProject(args) {
        const subCommand = args.split(' ')[0];
        switch (subCommand) {
            case 'switch':
                const targetPath = args.split(' ')[1] || process.cwd();
                const config = await this.context.projectManager.switchProject(targetPath);
                if (config) {
                    this.context.currentProject = config;
                    return {
                        success: true,
                        message: `Switched to project: ${config.projectName}`
                    };
                }
                else {
                    return {
                        success: false,
                        message: 'No CodeMind project found in target directory'
                    };
                }
            case 'info':
                if (!this.context.currentProject) {
                    return {
                        success: false,
                        message: 'No project loaded'
                    };
                }
                const info = await this.context.projectManager.getProjectInfo(this.context.currentProject.projectId);
                this.context.userInterface.displayProjectInfo(info);
                return { success: true };
            default:
                return {
                    success: false,
                    message: 'Usage: /project [switch <path>|info]'
                };
        }
    }
    async handleSearch(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        if (!args.trim()) {
            return {
                success: false,
                message: 'Usage: /search <query>'
            };
        }
        try {
            const results = await this.context.claudeOrchestrator.performSemanticSearch(args, this.context.currentProject.projectPath);
            this.context.userInterface.displaySearchResults(results);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                message: `Search failed: ${error.message}`
            };
        }
    }
    async handleAnalyze(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        console.log(theme_1.Theme.colors.info('🔍 Starting project analysis...'));
        try {
            const analysis = await this.context.claudeOrchestrator.analyzeProject(this.context.currentProject.projectPath);
            this.context.userInterface.displayAnalysisResults(analysis);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                message: `Analysis failed: ${error.message}`
            };
        }
    }
    handleHelp(args) {
        this.context.userInterface.displayHelp();
        return { success: true };
    }
    handleExit() {
        console.log(theme_1.Theme.colors.primary('\n👋 Goodbye! Thank you for using CodeMind.'));
        process.exit(0);
    }
    /**
     * Reset database tables for clean initialization
     */
    async resetDatabase() {
        try {
            const pgClient = await this.context.databaseManager.getPostgresConnection();
            // List of tables to truncate in dependency order
            const tables = [
                'semantic_search_embeddings',
                'analysis_results',
                'projects',
                'session_store',
                'workflow_state',
                'resume_states',
                'system_configuration',
                'authentication_sessions'
            ];
            // Disable foreign key constraints temporarily
            await pgClient.query('SET session_replication_role = replica;');
            // Truncate tables
            for (const table of tables) {
                try {
                    await pgClient.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
                    console.log(theme_1.Theme.colors.muted(`  ✓ Cleared ${table}`));
                }
                catch (error) {
                    // Table might not exist, continue
                    console.log(theme_1.Theme.colors.muted(`  ⚠ Skipped ${table} (not found)`));
                }
            }
            // Re-enable foreign key constraints
            await pgClient.query('SET session_replication_role = DEFAULT;');
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`Failed to reset database: ${error.message}`));
            throw error;
        }
    }
}
exports.CommandProcessor = CommandProcessor;
//# sourceMappingURL=CommandProcessor.js.map