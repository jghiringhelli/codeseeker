"use strict";
/**
 * CodeMindCLI - Lightweight orchestrator for the CLI
 * Single Responsibility: Orchestrate components and manage CLI lifecycle
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
const ProjectManager_1 = require("./managers/ProjectManager");
const CommandProcessor_1 = require("./managers/CommandProcessor");
const WorkflowOrchestrationAdapter_1 = require("./managers/WorkflowOrchestrationAdapter");
const DatabaseManager_1 = require("./managers/DatabaseManager");
const UserInterface_1 = require("./managers/UserInterface");
// Load environment variables
dotenv.config();
class CodeMindCLI {
    rl;
    projectManager;
    commandProcessor;
    databaseManager;
    userInterface;
    currentProject = null;
    constructor() {
        // Initialize all components
        this.projectManager = new ProjectManager_1.ProjectManager();
        this.databaseManager = new DatabaseManager_1.DatabaseManager();
        this.userInterface = new UserInterface_1.UserInterface();
        // Create command processor with context including workflow orchestrator
        const workflowOrchestrator = new WorkflowOrchestrationAdapter_1.WorkflowOrchestrationAdapter();
        const context = {
            projectManager: this.projectManager,
            claudeOrchestrator: workflowOrchestrator, // Workflow orchestrator adapter
            databaseManager: this.databaseManager,
            userInterface: this.userInterface
        };
        this.commandProcessor = new CommandProcessor_1.CommandProcessor(context);
        // Setup readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: theme_1.Theme.colors.prompt('codemind> ')
        });
        this.setupEventHandlers();
    }
    /**
     * Start the CLI
     */
    async start() {
        try {
            // Display welcome message
            welcome_display_1.WelcomeDisplay.displayWelcome();
            // Start interactive session immediately
            console.log(theme_1.Theme.colors.primary('\nCodeMind CLI ready. Type "/help" for commands or start typing your request.'));
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
     * Setup event handlers for readline
     */
    setupEventHandlers() {
        // Handle user input
        this.rl.on('line', async (input) => {
            if (input.trim()) {
                await this.processInput(input.trim());
            }
            this.rl.prompt();
        });
        // Handle CLI exit
        this.rl.on('close', () => {
            console.log(theme_1.Theme.colors.primary('\n👋 Goodbye! Thank you for using CodeMind.'));
            process.exit(0);
        });
        // Handle Ctrl+C
        this.rl.on('SIGINT', () => {
            console.log(theme_1.Theme.colors.warning('\n\nUse "/exit" to quit or Ctrl+C again to force exit.'));
            this.rl.prompt();
        });
    }
    /**
     * Process user input through command processor
     */
    async processInput(input) {
        try {
            // Update command context with current project
            this.commandProcessor.context.currentProject = this.currentProject;
            // Process input through command processor
            const result = await this.commandProcessor.processInput(input);
            // Handle results
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
        }
        catch (error) {
            this.userInterface.showError(`Processing error: ${error.message}`);
        }
    }
    /**
     * Auto-detect CodeMind project in current directory
     */
    async autoDetectProject() {
        const projectConfig = this.projectManager.detectProject(process.cwd());
        if (projectConfig) {
            this.currentProject = projectConfig;
            console.log(theme_1.Theme.colors.success(`✓ Project loaded: ${projectConfig.projectName}`));
        }
        else {
            console.log(theme_1.Theme.colors.warning('\n⚠ No CodeMind project found in current directory'));
            console.log(theme_1.Theme.colors.muted('Run "/init" to initialize this directory as a CodeMind project'));
        }
        // Ensure prompt is shown after project detection messages
        this.rl.prompt();
    }
}
exports.CodeMindCLI = CodeMindCLI;
/**
 * Main entry point
 */
async function main() {
    const cli = new CodeMindCLI();
    await cli.start();
}
// Error handling
process.on('uncaughtException', (error) => {
    console.error(theme_1.Theme.colors.error(`\n❌ Fatal error: ${error.message}`));
    process.exit(1);
});
process.on('unhandledRejection', (error) => {
    console.error(theme_1.Theme.colors.error(`\n❌ Unhandled rejection: ${error}`));
    process.exit(1);
});
// Start CLI if this is the main module
if (require.main === module) {
    main().catch((error) => {
        console.error(theme_1.Theme.colors.error(`\n❌ Failed to start CodeMind CLI: ${error.message}`));
        process.exit(1);
    });
}
exports.default = CodeMindCLI;
//# sourceMappingURL=CodeMindCLI.js.map