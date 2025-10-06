#!/usr/bin/env node
"use strict";
/**
 * CodeMindCLI - SOLID Principles Implementation
 * Single Responsibility: Orchestrate components and manage CLI lifecycle
 * Following SOLID architecture with proper dependency injection
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
exports.CodeMindCLI = void 0;
exports.main = main;
const readline = __importStar(require("readline"));
const dotenv = __importStar(require("dotenv"));
const theme_1 = require("./ui/theme");
const welcome_display_1 = require("./ui/welcome-display");
const project_manager_1 = require("./managers/project-manager");
const command_processor_1 = require("./managers/command-processor");
const workflow_orchestration_adapter_1 = require("./managers/workflow-orchestration-adapter");
const database_manager_1 = require("./managers/database-manager");
const user_interface_1 = require("./managers/user-interface");
const platform_utils_1 = require("../shared/platform-utils");
const codemind_instruction_service_1 = require("./services/codemind-instruction-service");
const interrupt_manager_1 = require("./managers/interrupt-manager");
const claude_code_forwarder_1 = require("./managers/claude-code-forwarder");
// Environment variables will be loaded in start() method based on current working directory
class CodeMindCLI {
    rl;
    projectManager;
    commandProcessor;
    databaseManager;
    userInterface;
    instructionService;
    interruptManager;
    claudeForwarder;
    currentProject = null;
    activeOperations = new Set();
    constructor() {
        // Initialize all components following SOLID dependency injection
        this.projectManager = new project_manager_1.ProjectManager();
        this.databaseManager = new database_manager_1.DatabaseManager();
        this.userInterface = new user_interface_1.UserInterface();
        this.instructionService = new codemind_instruction_service_1.CodeMindInstructionService();
        this.interruptManager = interrupt_manager_1.InterruptManager.getInstance();
        this.claudeForwarder = new claude_code_forwarder_1.ClaudeCodeForwarder({
            showTimestamps: false,
            prefixLines: true
        });
        // Create command processor with context including workflow orchestrator
        const workflowOrchestrator = new workflow_orchestration_adapter_1.WorkflowOrchestrationAdapter();
        const context = {
            projectManager: this.projectManager,
            claudeOrchestrator: workflowOrchestrator, // Workflow orchestrator adapter
            databaseManager: this.databaseManager,
            userInterface: this.userInterface,
            instructionService: this.instructionService,
            interruptManager: this.interruptManager,
            claudeForwarder: this.claudeForwarder
        };
        this.commandProcessor = new command_processor_1.CommandProcessor(context);
        // Setup readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: theme_1.Theme.colors.prompt('codemind> ')
        });
        // We'll handle escape through the interrupt manager instead of raw mode
        // to avoid conflicts with readline
        // Pass readline interface to command processor for assumption detection
        this.commandProcessor.setReadlineInterface(this.rl);
        this.setupEventHandlers();
        // Setup cleanup on exit - with immediate exit option
        process.on('exit', () => this.cleanup());
        // Enhanced SIGINT handling for Ctrl+C
        let sigintCount = 0;
        process.on('SIGINT', () => {
            sigintCount++;
            if (sigintCount === 1) {
                console.log(theme_1.Theme.colors.warning('\n\n⚠ Interrupt received. Press Ctrl+C again to force exit.'));
                this.cleanup();
                // Give cleanup 3 seconds to complete
                setTimeout(() => {
                    if (sigintCount === 1) {
                        console.log(theme_1.Theme.colors.warning('Cleanup taking too long. Press Ctrl+C to force exit.'));
                    }
                }, 3000);
            }
            else {
                console.log(theme_1.Theme.colors.error('\n❌ Force exit!'));
                process.exit(1);
            }
        });
        process.on('SIGTERM', () => this.cleanup());
        // Handle uncaught exceptions to prevent CLI from freezing
        process.on('uncaughtException', (error) => {
            console.error(theme_1.Theme.colors.error(`\n❌ Uncaught exception: ${error.message}`));
            console.error(theme_1.Theme.colors.muted('CLI will attempt to continue. Type "/help" if you need assistance.'));
            if (this.rl) {
                this.rl.prompt();
            }
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error(theme_1.Theme.colors.error(`\n❌ Unhandled promise rejection: ${reason}`));
            console.error(theme_1.Theme.colors.muted('CLI will attempt to continue. Type "/help" if you need assistance.'));
            if (this.rl) {
                this.rl.prompt();
            }
        });
    }
    /**
     * Start the CLI - SOLID implementation with immediate prompt
     */
    async start() {
        try {
            // Get user's original working directory (set by bin/codemind.js)
            const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
            // Load environment variables from user's working directory (not CodeMind installation)
            dotenv.config({ path: userCwd + '/.env' });
            // Display welcome message
            welcome_display_1.WelcomeDisplay.displayWelcome();
            // Show platform information for debugging
            const platformInfo = platform_utils_1.PlatformUtils.getPlatformInfo();
            console.log(theme_1.Theme.colors.muted(`\n💻 Platform: ${platformInfo.platform} (${platformInfo.arch}) Node ${platformInfo.nodeVersion}`));
            console.log(theme_1.Theme.colors.muted(`🐚 Shell: ${platformInfo.shell} | File Command: ${platformInfo.fileCommand}${platformInfo.isGitBash ? ' (Git Bash)' : ''}${platformInfo.isWSL ? ' (WSL)' : ''}`));
            // Start interactive session immediately (fixes the exit issue)
            console.log(theme_1.Theme.colors.primary('\n🎯 CodeMind CLI is ready! You can now:'));
            console.log(theme_1.Theme.colors.muted('   • Type /help to see available commands'));
            console.log(theme_1.Theme.colors.muted('   • Ask natural language questions directly'));
            console.log(theme_1.Theme.colors.muted('   • Use /init to initialize a new project'));
            console.log(theme_1.Theme.colors.muted('   • Press Ctrl+Z to interrupt operations'));
            console.log(theme_1.Theme.colors.muted('   • Press Ctrl+C twice to force exit\n'));
            this.rl.prompt();
            // Auto-detect project in background (non-blocking)
            this.autoDetectProject().catch(error => {
                console.log(theme_1.Theme.colors.warning(`\n⚠ Project detection failed: ${error.message}`));
                this.rl.prompt();
            });
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`Failed to start CLI: ${error.message}`));
            process.exit(1);
        }
    }
    /**
     * Setup event handlers for readline - SOLID event handling
     */
    setupEventHandlers() {
        // Handle user input with robust error handling
        this.rl.on('line', async (input) => {
            try {
                if (input.trim()) {
                    await this.processInput(input.trim());
                }
            }
            catch (error) {
                // Ensure errors don't break the readline interface
                console.error(theme_1.Theme.colors.error(`❌ Unexpected error: ${error.message}`));
                console.error(theme_1.Theme.colors.muted('CLI will continue running. Type "/help" for available commands.'));
            }
            finally {
                // Always show prompt, even if there was an error
                this.rl.prompt();
            }
        });
        // Handle Ctrl+Z as an interrupt signal (similar to Escape in Claude Code)
        // Note: We use Ctrl+Z instead of Escape to avoid conflicts with readline
        this.rl.on('SIGTSTP', () => {
            // If there are active operations, interrupt them
            if (this.activeOperations.size > 0) {
                console.log(theme_1.Theme.colors.warning('\n\n⏸ Operation interrupted (Ctrl+Z pressed)...'));
                // The interrupt manager tracks operations but doesn't have a public interrupt method
                // We'll rely on the abort controller and clearing operations
                // Abort the current operation if available
                const abortController = this.currentAbortController;
                if (abortController) {
                    abortController.abort();
                }
                // Clear active operations
                this.activeOperations.clear();
                console.log(theme_1.Theme.colors.muted('Operation cancelled. Ready for new input.'));
            }
            else {
                // No operations running
                console.log(theme_1.Theme.colors.muted('\n✓ Ready for new command.'));
            }
            this.rl.prompt();
        });
        // Handle CLI exit - wait for active operations
        this.rl.on('close', async () => {
            console.log(theme_1.Theme.colors.primary('\n👋 Goodbye! Thank you for using CodeMind.'));
            // Wait for all active operations to complete
            if (this.activeOperations.size > 0) {
                console.log(theme_1.Theme.colors.warning(`⏳ Waiting for ${this.activeOperations.size} active operation(s) to complete...`));
                await Promise.allSettled(Array.from(this.activeOperations));
            }
            process.exit(0);
        });
        // Handle Ctrl+C gracefully
        this.rl.on('SIGINT', () => {
            if (this.activeOperations.size > 0) {
                console.log(theme_1.Theme.colors.warning(`\n\n⚠ ${this.activeOperations.size} active operation(s) running. Use "/exit" to quit gracefully or Ctrl+C again to force exit.`));
            }
            else {
                console.log(theme_1.Theme.colors.warning('\n\nUse "/exit" to quit or Ctrl+C again to force exit.'));
            }
            this.rl.prompt();
        });
    }
    /**
     * Process user input through command processor - Single Responsibility
     */
    async processInput(input) {
        // Create operation promise for tracking
        const operation = this.processInputOperation(input);
        this.activeOperations.add(operation);
        try {
            await operation;
        }
        finally {
            this.activeOperations.delete(operation);
        }
    }
    /**
     * Internal operation handler to be tracked
     */
    async processInputOperation(input) {
        try {
            // Update command context with current project
            this.commandProcessor.context.currentProject = this.currentProject;
            // Create an AbortController for cancellation
            const abortController = new AbortController();
            // Store the abort controller so it can be triggered by Ctrl+Z
            this.currentAbortController = abortController;
            // Add timeout protection to prevent hanging operations
            const timeoutPromise = new Promise((_, reject) => {
                const timeout = setTimeout(() => reject(new Error('Operation timed out after 5 minutes')), 5 * 60 * 1000);
                // Cancel timeout if operation is aborted
                abortController.signal.addEventListener('abort', () => {
                    clearTimeout(timeout);
                    reject(new Error('Operation cancelled by user'));
                });
            });
            // Process input through command processor (SOLID delegation) with timeout and abort
            const result = await Promise.race([
                this.commandProcessor.processInput(input),
                timeoutPromise
            ]);
            // Handle results through UserInterface (SOLID separation)
            if (!result.success && result.message) {
                this.userInterface.showError(result.message);
            }
            else if (result.success && result.message) {
                this.userInterface.showSuccess(result.message);
            }
            // Update current project if it changed
            if (result.data && result.data.projectId) {
                this.currentProject = result.data;
            }
            console.log(theme_1.Theme.colors.success('🎯 Command completed - returning to prompt...'));
        }
        catch (error) {
            // Enhanced error handling with more context
            console.error(theme_1.Theme.colors.error(`❌ Command processing failed: ${error.message}`));
            if (error.stack && !error.message.includes('timed out')) {
                console.error(theme_1.Theme.colors.muted('Stack trace:'));
                console.error(theme_1.Theme.colors.muted(error.stack));
            }
            if (error.message.includes('timed out')) {
                console.error(theme_1.Theme.colors.warning('⏰ The operation took too long and was cancelled to prevent CLI hanging.'));
                console.error(theme_1.Theme.colors.muted('Try breaking down complex requests into smaller parts.'));
            }
            console.error(theme_1.Theme.colors.muted('The CLI will continue running. Try again or type "/help" for assistance.'));
        }
    }
    /**
     * Auto-detect CodeMind project - Delegated to ProjectManager (SOLID)
     */
    async autoDetectProject() {
        const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
        const projectConfig = this.projectManager.detectProject(userCwd);
        if (projectConfig) {
            this.currentProject = projectConfig;
            console.log(theme_1.Theme.colors.success(`✓ Project loaded: ${projectConfig.projectName}`));
            // Load CODEMIND.md instructions
            try {
                const instructionsSummary = await this.instructionService.getInstructionsSummary(userCwd);
                if (instructionsSummary.length > 1 || instructionsSummary[0] !== 'No CODEMIND.md instructions found') {
                    console.log(theme_1.Theme.colors.info(`📋 Loaded instructions:`));
                    instructionsSummary.forEach(summary => {
                        console.log(theme_1.Theme.colors.muted(`   ${summary}`));
                    });
                }
            }
            catch (error) {
                console.log(theme_1.Theme.colors.warning(`⚠ Failed to load instructions: ${error.message}`));
            }
        }
        else {
            console.log(theme_1.Theme.colors.warning('\n⚠ No CodeMind project found in current directory'));
            console.log(theme_1.Theme.colors.muted('Run "/init" to initialize this directory as a CodeMind project'));
        }
        // Ensure prompt is shown after project detection messages
        this.rl.prompt();
    }
    /**
     * Set project path programmatically (for command-line options)
     */
    setProjectPath(projectPath) {
        this.projectManager.setProjectPath(projectPath);
    }
    /**
     * Cleanup resources on exit
     */
    async cleanup() {
        console.log(theme_1.Theme.colors.muted('\n🧹 Cleaning up resources...'));
        try {
            // Cleanup with timeout protection
            const cleanupPromise = async () => {
                // Cleanup interrupt manager
                this.interruptManager.cleanup();
                // Cleanup Claude Code forwarder
                this.claudeForwarder.stopForwarding();
                // Cleanup database connections
                if (this.databaseManager) {
                    try {
                        await Promise.race([
                            this.databaseManager.cleanup?.(),
                            new Promise(resolve => setTimeout(resolve, 1000)) // 1 second timeout
                        ]);
                    }
                    catch (error) {
                        // Ignore database cleanup errors
                    }
                }
                // Close readline interface
                if (this.rl) {
                    this.rl.close();
                }
            };
            // Run cleanup with 2 second timeout
            await Promise.race([
                cleanupPromise(),
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
            console.log(theme_1.Theme.colors.muted('✅ Cleanup complete'));
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`❌ Cleanup error: ${error.message}`));
        }
    }
}
exports.CodeMindCLI = CodeMindCLI;
/**
 * Main entry point - SOLID architecture
 */
async function main() {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const hasCommand = args.includes('-c') || args.includes('--command');
    const hasProject = args.includes('-p') || args.includes('--project');
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
${theme_1.Theme.colors.primary('CodeMind Interactive CLI - Intelligent Code Assistant')}

${theme_1.Theme.colors.secondary('Usage:')}
  codemind [options]

${theme_1.Theme.colors.secondary('Options:')}
  -V, --version         output the version number
  -p, --project <path>  Project path
  -c, --command <cmd>   Execute single command
  --no-color            Disable colored output
  -h, --help            display help for command

${theme_1.Theme.colors.secondary('Examples:')}
  codemind                    Start interactive mode in current directory
  codemind -p /path/to/proj   Start with specific project path
  codemind -c "analyze main"  Execute single command and exit
`);
        return;
    }
    if (args.includes('--version') || args.includes('-V')) {
        console.log('2.0.0');
        return;
    }
    const cli = new CodeMindCLI();
    // Handle project path option
    if (hasProject) {
        const projectIndex = args.findIndex(arg => arg === '-p' || arg === '--project');
        if (projectIndex !== -1 && args[projectIndex + 1]) {
            cli.setProjectPath(args[projectIndex + 1]);
        }
    }
    // Handle command option
    if (hasCommand) {
        const commandIndex = args.findIndex(arg => arg === '-c' || arg === '--command');
        if (commandIndex !== -1 && args[commandIndex + 1]) {
            // Execute single command and exit
            await cli.start();
            await cli.processInput(args[commandIndex + 1]);
            process.exit(0);
        }
    }
    // Start interactive mode
    await cli.start();
}
// Error handling
process.on('uncaughtException', (error) => {
    console.error(theme_1.Theme.colors.error(`\n❌ Fatal error: ${error.message}`));
    console.error('Stack trace:', error.stack);
    process.exit(1);
});
process.on('unhandledRejection', (error) => {
    console.error(theme_1.Theme.colors.error(`\n❌ Unhandled rejection: ${error}`));
    console.error('This error should be handled properly in the application code.');
    console.error('CodeMind will continue running, but this issue should be fixed.');
    // Don't exit immediately - let the application handle it
    // process.exit(1);
});
// Start CLI if this is the main module
if (require.main === module) {
    main().catch((error) => {
        console.error(theme_1.Theme.colors.error(`\n❌ Failed to start CodeMind CLI: ${error.message}`));
        process.exit(1);
    });
}
exports.default = CodeMindCLI;
//# sourceMappingURL=codemind-cli.js.map