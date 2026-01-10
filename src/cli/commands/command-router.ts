/**
 * Command Router - Refactored for SOLID Principles
 * Single Responsibility: Route commands to appropriate handlers
 * Open/Closed Principle: Easy to add new command handlers without modification
 * Dependency Inversion: Depends on abstractions and uses dependency injection
 */

import * as readline from 'readline';
import { BaseCommandHandler } from './base-command-handler';
import { CommandContext, CommandResult } from './command-context';
import { Theme } from '../ui/theme';
import { WorkflowOrchestrator } from './services/workflow-orchestrator';

// Import command handlers
import { SetupCommandHandler } from './handlers/setup-command-handler';
import { InfrastructureSetupHandler } from './handlers/infrastructure-setup-handler';
import { ProjectCommandHandler } from './handlers/project-command-handler';
import { SyncCommandHandler } from './handlers/sync-command-handler';
import { SearchCommandHandler } from './handlers/search-command-handler';
import { AnalyzeCommandHandler } from './handlers/analyze-command-handler';
import { DedupCommandHandler } from './handlers/dedup-command-handler';
import { SolidCommandHandler } from './handlers/solid-command-handler';
import { DocsCommandHandler } from './handlers/docs-command-handler';
import { InstructionsCommandHandler } from './handlers/instructions-command-handler';
import { WatcherCommandHandler } from './handlers/watcher-command-handler';
import { SynonymsCommandHandler } from './handlers/synonyms-command-handler';
import { InstallCommandHandler } from './handlers/install-command-handler';

export interface HistoryCallbacks {
  getHistory: () => string[];
  clearHistory: () => void;
  getHistoryFile: () => string;
}

export class CommandRouter {
  private context: CommandContext;
  private handlers: Map<string, BaseCommandHandler> = new Map();
  private rl?: readline.Interface;
  private workflowOrchestrator: WorkflowOrchestrator;
  private transparentMode = false;
  private verboseMode = false;
  private commandMode = false;  // True when running with -c flag (always search)
  private noSearchMode = false; // True when --no-search flag is used (overrides commandMode)
  private historyCallbacks?: HistoryCallbacks;

  constructor(
    context: CommandContext,
    workflowOrchestrator?: WorkflowOrchestrator
  ) {
    this.context = context;
    this.workflowOrchestrator = workflowOrchestrator || new WorkflowOrchestrator(
      context.currentProject?.projectPath || process.cwd(),
      context.currentProject?.projectId
    );
    this.initializeHandlers();
  }

  /**
   * Set the readline interface for user interaction
   * Passes it to the workflow orchestrator to avoid readline/inquirer conflicts
   */
  setReadlineInterface(rl: readline.Interface): void {
    this.rl = rl;
    this.workflowOrchestrator.setReadlineInterface(rl);
  }

  /**
   * Set transparent mode (skip interactive prompts)
   */
  setTransparentMode(enabled: boolean): void {
    this.transparentMode = enabled;
  }

  /**
   * Set verbose mode (show full debug output: files, relationships, prompt)
   */
  setVerboseMode(enabled: boolean): void {
    this.verboseMode = enabled;
    this.workflowOrchestrator.setVerboseMode(enabled);
  }

  /**
   * Set command mode (when running with -c flag)
   * In command mode, search is always forced on
   */
  setCommandMode(enabled: boolean): void {
    this.commandMode = enabled;
  }

  /**
   * Set no-search mode (skip semantic search)
   * When enabled, prompts go directly to Claude without file discovery
   * This flag overrides commandMode - if noSearchMode is true, search is always OFF
   */
  setNoSearchMode(enabled: boolean): void {
    this.noSearchMode = enabled;
    // Immediately set search mode in the user interaction service
    this.workflowOrchestrator.getUserInteractionService().setSearchMode(!enabled);
  }

  /**
   * Prepare for a new prompt (manages search toggle state)
   * Call this before processing each new prompt
   */
  prepareForNewPrompt(): void {
    // If --no-search flag was set, always keep search OFF
    if (this.noSearchMode) {
      this.workflowOrchestrator.getUserInteractionService().setSearchMode(false);
      return;
    }
    // In command mode (-c), always force search on
    // In REPL mode, search state persists (user can toggle with /s)
    this.workflowOrchestrator.getUserInteractionService().prepareForNewPrompt(this.commandMode);
  }

  /**
   * Mark conversation as complete (for REPL mode)
   * Note: Search state now persists between prompts (no auto-disable)
   */
  markConversationComplete(): void {
    this.workflowOrchestrator.getUserInteractionService().markConversationComplete();
  }

  /**
   * Set history callbacks (for /history command)
   */
  setHistoryCallbacks(callbacks: HistoryCallbacks): void {
    this.historyCallbacks = callbacks;
  }

  /**
   * Initialize all command handlers
   * Open/Closed: Add new handlers here without modifying existing code
   */
  private initializeHandlers(): void {
    this.handlers.set('setup', new InfrastructureSetupHandler(this.context)); // Infrastructure setup
    this.handlers.set('init', new SetupCommandHandler(this.context));         // Project initialization
    this.handlers.set('project', new ProjectCommandHandler(this.context));
    this.handlers.set('sync', new SyncCommandHandler(this.context));
    this.handlers.set('search', new SearchCommandHandler(this.context));
    this.handlers.set('analyze', new AnalyzeCommandHandler(this.context));
    this.handlers.set('dedup', new DedupCommandHandler(this.context));
    this.handlers.set('solid', new SolidCommandHandler(this.context));
    this.handlers.set('docs', new DocsCommandHandler(this.context));
    this.handlers.set('instructions', new InstructionsCommandHandler(this.context));
    this.handlers.set('watch', new WatcherCommandHandler(this.context));
    this.handlers.set('watcher', new WatcherCommandHandler(this.context)); // Alias
    this.handlers.set('synonyms', new SynonymsCommandHandler(this.context));
    this.handlers.set('install', new InstallCommandHandler(this.context)); // MCP IDE configuration
  }

  /**
   * Process user input and route to appropriate handler
   */
  async processInput(input: string): Promise<CommandResult> {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return { success: false, message: 'Empty command' };
    }

    // Handle search toggle command (s or /s) - short circuit before other processing
    if (trimmedInput.toLowerCase() === 's' || trimmedInput.toLowerCase() === '/s') {
      return this.handleSearchToggle();
    }

    // Detect and passthrough Claude CLI commands (login, logout, version, etc.)
    if (this.isClaudeCLICommand(trimmedInput)) {
      return await this.passthroughClaudeCLI(trimmedInput);
    }

    // Handle slash commands (explicit commands)
    if (trimmedInput.startsWith('/')) {
      const commandWithoutSlash = trimmedInput.substring(1);
      const [command, ...argParts] = commandWithoutSlash.split(' ');
      const args = argParts.join(' ');

      // Handle built-in slash commands
      switch (command) {
        case 'help':
          return this.handleHelp(args);
        case 'exit':
        case 'quit':
          return this.handleExit();
        case 'status':
          return this.handleStatus();
        case 'history':
          return this.handleHistory(args);
        default:
          return this.routeToHandler(command, args);
      }
    }

    // Check if this looks like natural language before parsing as commands
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
      case 'history':
        return this.handleHistory(args);
      default:
        return this.routeToHandler(command, args);
    }
  }

  /**
   * Route command to appropriate handler
   */
  private async routeToHandler(command: string, args: string): Promise<CommandResult> {
    const handler = this.handlers.get(command);

    if (!handler) {
      return {
        success: false,
        message: `Unknown command: ${command}. Type 'help' for available commands.`
      };
    }

    try {
      return await handler.handle(args);
    } catch (error) {
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
  private handleHelp(args: string): CommandResult {
    const helpText = `
${Theme.colors.primary('CodeSeeker Commands:')}

${Theme.colors.success('Project Management:')}
  setup [--force] [--skip-docker] [--skip-db]  Setup infrastructure (Docker, databases)
  setup --project-path <path>                  Setup from specific directory
  init [--reset] [path]  Initialize project for analysis (includes indexing)
  init --quick           Initialize project without indexing (faster setup)
  project [subcommand]   Manage project settings
  status                 Show current project status

${Theme.colors.success('Code Analysis:')}
  analyze [path]         Analyze code structure and patterns
  search <query>         Semantic search across codebase
  solid [subcommand]     SOLID principles analysis
  dedup                  Detect and handle duplicate code

${Theme.colors.success('Documentation:')}
  docs [subcommand]      Manage documentation and RAG system
  instructions [cmd]     Manage CODESEEKER.md instructions

${Theme.colors.success('Synchronization:')}
  sync [subcommand]      Sync project with databases
  watch [subcommand]     File watching operations

${Theme.colors.success('General:')}
  s, /s                  Toggle semantic search on/off
  help                   Show this help message
  history                View/clear command history
  exit, quit             Exit CodeSeeker

${Theme.colors.success('Claude CLI Passthrough:')}
  claude login           Pass through to Claude CLI (login, logout, version, etc.)
  claude <command>       Any Claude CLI command will be passed through directly

${Theme.colors.info('Natural Language:')}
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
  private handleExit(): CommandResult {
    console.log(Theme.colors.success('👋 Goodbye! CodeSeeker session ended.'));
    return { success: true, message: 'exit', data: { shouldExit: true } };
  }

  /**
   * Handle search toggle command (s or /s)
   */
  private handleSearchToggle(): CommandResult {
    const userInteractionService = this.workflowOrchestrator.getUserInteractionService();
    const newState = userInteractionService.toggleSearchMode();
    const indicator = userInteractionService.getSearchToggleIndicator();
    console.log(`\n  ${indicator}\n`);
    return {
      success: true,
      message: `Search ${newState ? 'enabled' : 'disabled'}`
    };
  }

  /**
   * Display the search toggle indicator
   * Called before showing the prompt in REPL mode
   */
  displaySearchToggleIndicator(): void {
    this.workflowOrchestrator.getUserInteractionService().displaySearchToggleIndicator();
  }

  /**
   * Get the user interaction service
   * Allows access to search toggle state and methods
   */
  getUserInteractionService() {
    return this.workflowOrchestrator.getUserInteractionService();
  }

  /**
   * Handle status command
   */
  private async handleStatus(): Promise<CommandResult> {
    console.log(Theme.colors.primary('\n📊 CodeSeeker Status:'));

    // Project status
    if (this.context.currentProject) {
      console.log(Theme.colors.primary('\nProject:'));
      console.log(Theme.colors.result(`  • Name: ${this.context.currentProject.projectName}`));
      console.log(Theme.colors.result(`  • Path: ${this.context.currentProject.projectPath}`));
      console.log(Theme.colors.result(`  • ID: ${this.context.currentProject.projectId}`));

      // Get additional project info from database
      try {
        const projectInfo = await this.context.databaseManager.getProjectStats(this.context.currentProject.projectId);
        if (projectInfo) {
          console.log(Theme.colors.result(`  • Files: ${projectInfo.total_files || 0}`));
          console.log(Theme.colors.result(`  • Embeddings: ${projectInfo.statistics?.embeddings || 0}`));
          console.log(Theme.colors.result(`  • Last Updated: ${projectInfo.statistics?.lastUpdated || 'Never'}`));
        }
      } catch (error) {
        console.log(Theme.colors.warning(`  • Database: Error retrieving stats`));
      }
    } else {
      console.log(Theme.colors.warning('\nNo project loaded. Run "init" to setup a project.'));
    }

    // Workflow orchestrator status
    console.log(Theme.colors.primary('\nWorkflow Services:'));
    console.log(Theme.colors.result(`  • Workflow ready: Yes`));

    return { success: true, message: 'Status displayed' };
  }

  /**
   * Handle history command
   */
  private handleHistory(args: string): CommandResult {
    if (!this.historyCallbacks) {
      return { success: false, message: 'History callbacks not configured' };
    }

    const subcommand = args.trim().toLowerCase();
    const history = this.historyCallbacks.getHistory();
    const historyFile = this.historyCallbacks.getHistoryFile();

    switch (subcommand) {
      case '':
      case 'show':
        // Show history
        if (history.length === 0) {
          console.log(Theme.colors.muted('\n📜 No command history yet.\n'));
        } else {
          console.log(Theme.colors.primary(`\n📜 Command History (${history.length} entries):`));
          console.log(Theme.colors.muted(`   File: ${historyFile}\n`));

          // Show last 20 entries (most recent at bottom for readability)
          const displayHistory = history.slice(-20);
          const startIndex = Math.max(0, history.length - 20);

          displayHistory.forEach((cmd, i) => {
            const num = String(startIndex + i + 1).padStart(3, ' ');
            console.log(Theme.colors.muted(`  ${num}. `) + Theme.colors.result(cmd));
          });

          if (history.length > 20) {
            console.log(Theme.colors.muted(`\n  ... ${history.length - 20} older entries not shown`));
          }
          console.log('');
        }
        return { success: true, message: 'History displayed' };

      case 'clear':
        // Clear all history
        this.historyCallbacks.clearHistory();
        console.log(Theme.colors.success('\n✓ Command history cleared.\n'));
        return { success: true, message: 'History cleared' };

      case 'help':
        console.log(`
${Theme.colors.primary('History Command:')}

  /history              Show recent command history
  /history show         Show recent command history
  /history clear        Clear all command history
  /history help         Show this help message
`);
        return { success: true, message: 'History help displayed' };

      default:
        return { success: false, message: `Unknown history subcommand: ${subcommand}. Try /history help` };
    }
  }

  /**
   * Get available commands
   */
  getAvailableCommands(): string[] {
    return Array.from(this.handlers.keys()).concat(['help', 'exit', 'quit', 'status', 'history']);
  }

  /**
   * Handle natural language queries using the workflow orchestrator
   * Delegates to WorkflowOrchestrator following SOLID principles
   */
  private async handleNaturalLanguage(input: string): Promise<CommandResult> {
    try {
      const projectPath = this.context.currentProject?.projectPath || process.cwd();
      const projectId = this.context.currentProject?.projectId;

      const workflowResult = await this.workflowOrchestrator.executeWorkflow(input, projectPath, {
        projectId,
        transparentMode: this.transparentMode
      });

      if (workflowResult.success) {
        return {
          success: true,
          message: 'Enhanced query processed successfully',
          data: { workflowResult }
        };
      } else {
        return {
          success: false,
          message: workflowResult.error || 'Workflow execution failed'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(Theme.colors.error('❌ Error in natural language processing: ' + errorMessage));
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Detect if the user input is a Claude CLI command that should be passed through
   * Handles commands like: claude login, claude logout, claude --version, etc.
   */
  private isClaudeCLICommand(input: string): boolean {
    const trimmed = input.trim().toLowerCase();

    // Check if it starts with "claude " (user explicitly wants Claude CLI)
    if (trimmed.startsWith('claude ')) {
      return true;
    }

    // Check for standalone "claude" (might be checking if it's installed)
    if (trimmed === 'claude') {
      return true;
    }

    return false;
  }

  /**
   * Pass a command directly through to Claude CLI
   * Used for commands like "claude login", "claude logout", etc.
   */
  private async passthroughClaudeCLI(input: string): Promise<CommandResult> {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      // Extract the claude command (remove "claude " prefix if present)
      let claudeCommand = input.trim();
      if (claudeCommand.toLowerCase().startsWith('claude ')) {
        claudeCommand = claudeCommand.substring(7); // Remove "claude " prefix
      } else {
        claudeCommand = ''; // Just "claude" with no args
      }

      console.log(Theme.colors.muted(`\n  Passing through to Claude CLI...\n`));

      // Spawn Claude CLI with inherited stdio so user can interact directly
      const child = spawn('claude', claudeCommand ? claudeCommand.split(' ') : [], {
        stdio: 'inherit', // Inherit stdin/stdout/stderr for direct user interaction
        shell: true
      });

      child.on('close', (code: number | null) => {
        if (code === 0) {
          console.log(Theme.colors.muted(`\n  Returned to CodeSeeker.\n`));
          resolve({
            success: true,
            message: 'Claude CLI command completed'
          });
        } else if (code === null) {
          // Process was killed/terminated
          resolve({
            success: false,
            message: 'Claude CLI command was terminated'
          });
        } else {
          // Non-zero exit code
          resolve({
            success: false,
            message: `Claude CLI command failed with exit code ${code}`
          });
        }
      });

      child.on('error', (err: Error) => {
        let errorMessage = `Error: ${err.message}`;
        if (err.message.includes('ENOENT') || err.message.includes('not found')) {
          errorMessage = '❌ Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code';
        }

        console.error(Theme.colors.error(`\n  ${errorMessage}\n`));
        resolve({
          success: false,
          message: errorMessage
        });
      });
    });
  }

  /**
   * Get the workflow orchestrator instance for testing
   */
  getWorkflowOrchestrator(): WorkflowOrchestrator {
    return this.workflowOrchestrator;
  }

  /**
   * Set a new workflow orchestrator (for testing or different configurations)
   */
  setWorkflowOrchestrator(orchestrator: WorkflowOrchestrator): void {
    this.workflowOrchestrator = orchestrator;
  }
}