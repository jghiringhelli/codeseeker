"use strict";
/**
 * Command Router - Refactored for SOLID Principles
 * Single Responsibility: Route commands to appropriate handlers
 * Open/Closed Principle: Easy to add new command handlers without modification
 * Dependency Inversion: Depends on abstractions and uses dependency injection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandRouter = void 0;
const theme_1 = require("../ui/theme");
const workflow_orchestrator_1 = require("./services/workflow-orchestrator");
// Import command handlers
const setup_command_handler_1 = require("./handlers/setup-command-handler");
const project_command_handler_1 = require("./handlers/project-command-handler");
const sync_command_handler_1 = require("./handlers/sync-command-handler");
const search_command_handler_1 = require("./handlers/search-command-handler");
const analyze_command_handler_1 = require("./handlers/analyze-command-handler");
const dedup_command_handler_1 = require("./handlers/dedup-command-handler");
const solid_command_handler_1 = require("./handlers/solid-command-handler");
const docs_command_handler_1 = require("./handlers/docs-command-handler");
const instructions_command_handler_1 = require("./handlers/instructions-command-handler");
const watcher_command_handler_1 = require("./handlers/watcher-command-handler");
class CommandRouter {
    context;
    handlers = new Map();
    rl;
    workflowOrchestrator;
    constructor(context, workflowOrchestrator) {
        this.context = context;
        this.workflowOrchestrator = workflowOrchestrator || workflow_orchestrator_1.WorkflowOrchestrator.create();
        this.initializeHandlers();
    }
    /**
     * Set the readline interface for user interaction
     */
    setReadlineInterface(rl) {
        this.rl = rl;
    }
    /**
     * Initialize all command handlers
     * Open/Closed: Add new handlers here without modifying existing code
     */
    initializeHandlers() {
        this.handlers.set('setup', new setup_command_handler_1.SetupCommandHandler(this.context));
        this.handlers.set('init', new setup_command_handler_1.SetupCommandHandler(this.context)); // Alias
        this.handlers.set('project', new project_command_handler_1.ProjectCommandHandler(this.context));
        this.handlers.set('sync', new sync_command_handler_1.SyncCommandHandler(this.context));
        this.handlers.set('search', new search_command_handler_1.SearchCommandHandler(this.context));
        this.handlers.set('analyze', new analyze_command_handler_1.AnalyzeCommandHandler(this.context));
        this.handlers.set('dedup', new dedup_command_handler_1.DedupCommandHandler(this.context));
        this.handlers.set('solid', new solid_command_handler_1.SolidCommandHandler(this.context));
        this.handlers.set('docs', new docs_command_handler_1.DocsCommandHandler(this.context));
        this.handlers.set('instructions', new instructions_command_handler_1.InstructionsCommandHandler(this.context));
        this.handlers.set('watch', new watcher_command_handler_1.WatcherCommandHandler(this.context));
        this.handlers.set('watcher', new watcher_command_handler_1.WatcherCommandHandler(this.context)); // Alias
    }
    /**
     * Process user input and route to appropriate handler
     */
    async processInput(input) {
        const trimmedInput = input.trim();
        if (!trimmedInput) {
            return { success: false, message: 'Empty command' };
        }
        // First, check if this looks like natural language before parsing as commands
        if (this.workflowOrchestrator.shouldUseWorkflow(trimmedInput)) {
            return await this.handleNaturalLanguage(trimmedInput);
        }
        // Parse command and arguments for traditional commands
        const [command, ...argParts] = trimmedInput.split(' ');
        const args = argParts.join(' ');
        // Handle built-in commands
        switch (command) {
            case 'help':
                return this.handleHelp(args);
            case 'exit':
            case 'quit':
                return this.handleExit();
            case 'status':
                return this.handleStatus();
            default:
                return this.routeToHandler(command, args);
        }
    }
    /**
     * Route command to appropriate handler
     */
    async routeToHandler(command, args) {
        const handler = this.handlers.get(command);
        if (!handler) {
            return {
                success: false,
                message: `Unknown command: ${command}. Type 'help' for available commands.`
            };
        }
        try {
            return await handler.handle(args);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Command failed: ${errorMessage}`
            };
        }
    }
    /**
     * Handle help command
     */
    handleHelp(args) {
        const helpText = `
${theme_1.Theme.colors.primary('CodeMind Commands:')}

${theme_1.Theme.colors.success('Project Management:')}
  init, setup [path]     Initialize or setup project
  project [subcommand]   Manage project settings
  status                 Show current project status

${theme_1.Theme.colors.success('Code Analysis:')}
  analyze [path]         Analyze code structure and patterns
  search <query>         Semantic search across codebase
  solid [subcommand]     SOLID principles analysis
  dedup                  Detect and handle duplicate code

${theme_1.Theme.colors.success('Documentation:')}
  docs [subcommand]      Manage documentation and RAG system
  instructions [cmd]     Manage CODEMIND.md instructions

${theme_1.Theme.colors.success('Synchronization:')}
  sync [subcommand]      Sync project with databases
  watch [subcommand]     File watching operations

${theme_1.Theme.colors.success('General:')}
  help                   Show this help message
  exit, quit             Exit CodeMind

${theme_1.Theme.colors.info('Natural Language:')}
  You can also use natural language queries like:
  "add authentication middleware to the API routes"
  "search for database connection code"
  "analyze the project structure"
    `;
        console.log(helpText);
        return { success: true, message: 'Help displayed' };
    }
    /**
     * Handle exit command
     */
    handleExit() {
        console.log(theme_1.Theme.colors.success('👋 Goodbye! CodeMind session ended.'));
        return { success: true, message: 'exit', data: { shouldExit: true } };
    }
    /**
     * Handle status command
     */
    async handleStatus() {
        console.log(theme_1.Theme.colors.primary('\n📊 CodeMind Status:'));
        // Project status
        if (this.context.currentProject) {
            console.log(theme_1.Theme.colors.primary('\nProject:'));
            console.log(theme_1.Theme.colors.result(`  • Name: ${this.context.currentProject.projectName}`));
            console.log(theme_1.Theme.colors.result(`  • Path: ${this.context.currentProject.projectPath}`));
            console.log(theme_1.Theme.colors.result(`  • ID: ${this.context.currentProject.projectId}`));
            // Get additional project info from database
            try {
                const projectInfo = await this.context.databaseManager.getProjectStats(this.context.currentProject.projectId);
                if (projectInfo) {
                    console.log(theme_1.Theme.colors.result(`  • Files: ${projectInfo.total_files || 0}`));
                    console.log(theme_1.Theme.colors.result(`  • Embeddings: ${projectInfo.statistics?.embeddings || 0}`));
                    console.log(theme_1.Theme.colors.result(`  • Last Updated: ${projectInfo.statistics?.lastUpdated || 'Never'}`));
                }
            }
            catch (error) {
                console.log(theme_1.Theme.colors.warning(`  • Database: Error retrieving stats`));
            }
        }
        else {
            console.log(theme_1.Theme.colors.warning('\nNo project loaded. Run "init" to setup a project.'));
        }
        // Workflow orchestrator status
        console.log(theme_1.Theme.colors.primary('\nWorkflow Services:'));
        console.log(theme_1.Theme.colors.result(`  • Services initialized: ${this.workflowOrchestrator.validateServices() ? 'Yes' : 'No'}`));
        return { success: true, message: 'Status displayed' };
    }
    /**
     * Get available commands
     */
    getAvailableCommands() {
        return Array.from(this.handlers.keys()).concat(['help', 'exit', 'quit', 'status']);
    }
    /**
     * Handle natural language queries using the workflow orchestrator
     * Delegates to WorkflowOrchestrator following SOLID principles
     */
    async handleNaturalLanguage(input) {
        try {
            const projectPath = this.context.currentProject?.projectPath || process.cwd();
            const workflowResult = await this.workflowOrchestrator.executeWorkflow(input, projectPath);
            if (workflowResult.success) {
                const stats = this.workflowOrchestrator.getWorkflowStats(workflowResult);
                return {
                    success: true,
                    message: 'Enhanced query processed successfully',
                    data: {
                        workflowResult,
                        stats
                    }
                };
            }
            else {
                return {
                    success: false,
                    message: workflowResult.error || 'Workflow execution failed'
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(theme_1.Theme.colors.error('❌ Error in natural language processing: ' + errorMessage));
            return { success: false, message: errorMessage };
        }
    }
    /**
     * Get the workflow orchestrator instance for testing
     */
    getWorkflowOrchestrator() {
        return this.workflowOrchestrator;
    }
    /**
     * Set a new workflow orchestrator (for testing or different configurations)
     */
    setWorkflowOrchestrator(orchestrator) {
        this.workflowOrchestrator = orchestrator;
    }
}
exports.CommandRouter = CommandRouter;
//# sourceMappingURL=command-router.js.map