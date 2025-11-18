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
import { ProjectCommandHandler } from './handlers/project-command-handler';
import { SyncCommandHandler } from './handlers/sync-command-handler';
import { SearchCommandHandler } from './handlers/search-command-handler';
import { AnalyzeCommandHandler } from './handlers/analyze-command-handler';
import { DedupCommandHandler } from './handlers/dedup-command-handler';
import { SolidCommandHandler } from './handlers/solid-command-handler';
import { DocsCommandHandler } from './handlers/docs-command-handler';
import { InstructionsCommandHandler } from './handlers/instructions-command-handler';
import { WatcherCommandHandler } from './handlers/watcher-command-handler';

export class CommandRouter {
  private context: CommandContext;
  private handlers: Map<string, BaseCommandHandler> = new Map();
  private rl?: readline.Interface;
  private workflowOrchestrator: WorkflowOrchestrator;

  constructor(
    context: CommandContext,
    workflowOrchestrator?: WorkflowOrchestrator
  ) {
    this.context = context;
    this.workflowOrchestrator = workflowOrchestrator || new WorkflowOrchestrator(context.currentProject?.path || process.cwd());
    this.initializeHandlers();
  }

  /**
   * Set the readline interface for user interaction
   */
  setReadlineInterface(rl: readline.Interface): void {
    this.rl = rl;
  }

  /**
   * Initialize all command handlers
   * Open/Closed: Add new handlers here without modifying existing code
   */
  private initializeHandlers(): void {
    this.handlers.set('setup', new SetupCommandHandler(this.context));
    this.handlers.set('init', new SetupCommandHandler(this.context)); // Alias
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
  }

  /**
   * Process user input and route to appropriate handler
   */
  async processInput(input: string): Promise<CommandResult> {
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
${Theme.colors.primary('CodeMind Commands:')}

${Theme.colors.success('Project Management:')}
  init, setup [path]     Initialize or setup project
  project [subcommand]   Manage project settings
  status                 Show current project status

${Theme.colors.success('Code Analysis:')}
  analyze [path]         Analyze code structure and patterns
  search <query>         Semantic search across codebase
  solid [subcommand]     SOLID principles analysis
  dedup                  Detect and handle duplicate code

${Theme.colors.success('Documentation:')}
  docs [subcommand]      Manage documentation and RAG system
  instructions [cmd]     Manage CODEMIND.md instructions

${Theme.colors.success('Synchronization:')}
  sync [subcommand]      Sync project with databases
  watch [subcommand]     File watching operations

${Theme.colors.success('General:')}
  help                   Show this help message
  exit, quit             Exit CodeMind

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
    console.log(Theme.colors.success('👋 Goodbye! CodeMind session ended.'));
    return { success: true, message: 'exit', data: { shouldExit: true } };
  }

  /**
   * Handle status command
   */
  private async handleStatus(): Promise<CommandResult> {
    console.log(Theme.colors.primary('\n📊 CodeMind Status:'));

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
    console.log(Theme.colors.result(`  • Services initialized: ${this.workflowOrchestrator.validateServices() ? 'Yes' : 'No'}`));

    return { success: true, message: 'Status displayed' };
  }

  /**
   * Get available commands
   */
  getAvailableCommands(): string[] {
    return Array.from(this.handlers.keys()).concat(['help', 'exit', 'quit', 'status']);
  }

  /**
   * Handle natural language queries using the workflow orchestrator
   * Delegates to WorkflowOrchestrator following SOLID principles
   */
  private async handleNaturalLanguage(input: string): Promise<CommandResult> {
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