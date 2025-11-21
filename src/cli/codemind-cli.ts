#!/usr/bin/env node

/**
 * CodeMindCLI - SOLID Principles Implementation
 * Single Responsibility: Orchestrate components and manage CLI lifecycle
 * Following SOLID architecture with proper dependency injection
 */

import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { Theme } from './ui/theme';
import { WelcomeDisplay } from './ui/welcome-display';
import { ProjectConfig } from '../core/interfaces/project-interfaces';
import { CommandServiceFactory } from '../core/factories/command-service-factory';
import { CommandProcessor } from './managers/command-processor';
import { CommandContext } from './commands/command-context';
import { DatabaseManager } from './managers/database-manager';
import { PlatformUtils } from '../shared/platform-utils';

// Environment variables will be loaded in start() method based on current working directory

export class CodeMindCLI {
  private rl: readline.Interface;
  private commandProcessor: CommandProcessor;
  private context: CommandContext;
  private currentProject: ProjectConfig | null = null;
  private activeOperations: Set<Promise<unknown>> = new Set();
  private currentAbortController?: AbortController;

  constructor() {
    // Initialize all components using SOLID dependency injection factory
    const commandServiceFactory = CommandServiceFactory.getInstance();
    this.context = commandServiceFactory.createCommandContext();
    this.commandProcessor = new CommandProcessor(this.context);

    // Setup readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: Theme.colors.prompt('codemind> ')
    });

    // We'll handle escape through the interrupt manager instead of raw mode
    // to avoid conflicts with readline

    // Pass readline interface to command processor for assumption detection
    this.commandProcessor.setReadlineInterface(this.rl);

    this.setupEventHandlers();

    // Setup cleanup on exit - with immediate exit option
    process.on('exit', () => void this.cleanup());

    // Enhanced SIGINT handling for Ctrl+C
    let sigintCount = 0;
    process.on('SIGINT', () => {
      sigintCount++;

      if (sigintCount === 1) {
        console.log(Theme.colors.warning('\n\n⚠ Interrupt received. Press Ctrl+C again to force exit.'));
        void this.cleanup();

        // Give cleanup 3 seconds to complete
        setTimeout(() => {
          if (sigintCount === 1) {
            console.log(Theme.colors.warning('Cleanup taking too long. Press Ctrl+C to force exit.'));
          }
        }, 3000);
      } else {
        console.log(Theme.colors.error('\n❌ Force exit!'));
        process.exit(1);
      }
    });

    process.on('SIGTERM', () => void this.cleanup());

    // Handle uncaught exceptions to prevent CLI from freezing
    process.on('uncaughtException', (error) => {
      console.error(Theme.colors.error(`\n❌ Uncaught exception: ${error.message}`));
      console.error(Theme.colors.muted('CLI will attempt to continue. Type "/help" if you need assistance.'));
      if (this.rl) {
        this.rl.prompt();
      }
    });

    process.on('unhandledRejection', (reason) => {
      console.error(Theme.colors.error(`\n❌ Unhandled promise rejection: ${String(reason)}`));
      console.error(Theme.colors.muted('CLI will attempt to continue. Type "/help" if you need assistance.'));
      if (this.rl) {
        this.rl.prompt();
      }
    });
  }

  /**
   * Start silently for command mode (no welcome, no interactive prompt)
   */
  async startSilent(): Promise<void> {
    try {

      // Get user's original working directory (set by bin/codemind.js)
      const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();

      // Load environment variables from user's working directory (not CodeMind installation)
      // Suppress dotenv logs during init for cleaner output
      const originalStderr = process.stderr.write.bind(process.stderr);
      try {
        // Temporarily suppress stderr to hide dotenv injection logs
        process.stderr.write = (): boolean => true;
        dotenv.config({ path: userCwd + '/.env' });
      } finally {
        // Restore stderr
        process.stderr.write = originalStderr;
      }

      // Auto-detect project in background (non-blocking)
      await this.autoDetectProjectSilent();

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(Theme.colors.error(`Failed to start CLI: ${errorMessage}`));
      process.exit(1);
    }
  }

  /**
   * Start the CLI - SOLID implementation with immediate prompt
   */
  async start(): Promise<void> {
    try {
      // Get user's original working directory (set by bin/codemind.js)
      const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();

      // Load environment variables from user's working directory (not CodeMind installation)
      // Suppress dotenv logs during init for cleaner output
      const originalStderr = process.stderr.write.bind(process.stderr);
      try {
        // Temporarily suppress stderr to hide dotenv injection logs
        process.stderr.write = (): boolean => true;
        dotenv.config({ path: userCwd + '/.env' });
      } finally {
        // Restore stderr
        process.stderr.write = originalStderr;
      }

      // Display welcome message
      WelcomeDisplay.displayWelcome();

      // Show platform information for debugging
      const platformInfo = PlatformUtils.getPlatformInfo();
      console.log(Theme.colors.muted(`\n💻 Platform: ${platformInfo.platform} (${platformInfo.arch}) Node ${platformInfo.nodeVersion}`));
      console.log(Theme.colors.muted(`🐚 Shell: ${platformInfo.shell} | File Command: ${platformInfo.fileCommand}${platformInfo.isGitBash ? ' (Git Bash)' : ''}${platformInfo.isWSL ? ' (WSL)' : ''}`));

      // Check database connections on startup (non-blocking)
      this.checkDatabaseConnections().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(Theme.colors.warning(`\n⚠️  Database check failed: ${errorMessage}`));
      });

      // Start interactive session immediately (fixes the exit issue)
      console.log(Theme.colors.primary('\n🎯 CodeMind CLI is ready! You can now:'));
      console.log(Theme.colors.muted('   • Type /help to see available commands'));
      console.log(Theme.colors.muted('   • Ask natural language questions directly'));
      console.log(Theme.colors.muted('   • Use /init to initialize a new project'));
      console.log(Theme.colors.muted('   • Press Ctrl+Z to interrupt operations'));
      console.log(Theme.colors.muted('   • Press Ctrl+C twice to force exit\n'));

      this.rl.prompt();

      // Auto-detect project in background (non-blocking)
      this.autoDetectProject().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(Theme.colors.warning(`\n⚠ Project detection failed: ${errorMessage}`));
        this.rl.prompt();
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(Theme.colors.error(`Failed to start CLI: ${errorMessage}`));
      process.exit(1);
    }
  }

  /**
   * Setup event handlers for readline - SOLID event handling
   */
  private setupEventHandlers(): void {
    // Handle user input with robust error handling
    this.rl.on('line', async (input: string) => {
      try {
        if (input.trim()) {
          await this.processInput(input.trim());
        }
      } catch (error: unknown) {
        // Ensure errors don't break the readline interface
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(Theme.colors.error(`❌ Unexpected error: ${errorMessage}`));
        console.error(Theme.colors.muted('CLI will continue running. Type "/help" for available commands.'));
      } finally {
        // Always show prompt, even if there was an error
        this.rl.prompt();
      }
    });

    // Handle Ctrl+Z as an interrupt signal (similar to Escape in Claude Code)
    // Note: We use Ctrl+Z instead of Escape to avoid conflicts with readline
    this.rl.on('SIGTSTP', () => {
      // If there are active operations, interrupt them
      if (this.activeOperations.size > 0) {
        console.log(Theme.colors.warning('\n\n⏸ Operation interrupted (Ctrl+Z pressed)...'));

        // The interrupt manager tracks operations but doesn't have a public interrupt method
        // We'll rely on the abort controller and clearing operations

        // Abort the current operation if available
        if (this.currentAbortController) {
          this.currentAbortController.abort();
        }

        // Clear active operations
        this.activeOperations.clear();

        console.log(Theme.colors.muted('Operation cancelled. Ready for new input.'));
      } else {
        // No operations running
        console.log(Theme.colors.muted('\n✓ Ready for new command.'));
      }

      this.rl.prompt();
    });

    // Handle CLI exit - wait for active operations
    this.rl.on('close', async () => {
      console.log(Theme.colors.primary('\n👋 Goodbye! Thank you for using CodeMind.'));

      // Wait for all active operations to complete
      if (this.activeOperations.size > 0) {
        console.log(Theme.colors.warning(`⏳ Waiting for ${this.activeOperations.size} active operation(s) to complete...`));
        await Promise.allSettled(Array.from(this.activeOperations));
      }

      process.exit(0);
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      if (this.activeOperations.size > 0) {
        console.log(Theme.colors.warning(`\n\n⚠ ${this.activeOperations.size} active operation(s) running. Use "/exit" to quit gracefully or Ctrl+C again to force exit.`));
      } else {
        console.log(Theme.colors.warning('\n\nUse "/exit" to quit or Ctrl+C again to force exit.'));
      }
      this.rl.prompt();
    });
  }

  /**
   * Process user input through command processor - Single Responsibility
   */
  private async processInput(input: string): Promise<void> {
    // Update command context with current project (only when it changes)
    this.syncProjectContext();

    // Create operation promise for tracking
    const operation = this.processInputOperation(input);
    this.activeOperations.add(operation);

    try {
      await operation;
    } finally {
      this.activeOperations.delete(operation);
    }
  }

  /**
   * Sync project context with command processor (optimized)
   */
  private syncProjectContext(): void {
    const processorContext = (this.commandProcessor as unknown as { context: { currentProject: ProjectConfig | null } }).context;
    if (processorContext.currentProject !== this.currentProject) {
      processorContext.currentProject = this.currentProject;
    }
  }

  /**
   * Create a timeout promise with abort controller support
   */
  private createTimeoutPromise(abortController: AbortController, timeoutMs: number = 5 * 60 * 1000): Promise<never> {
    return new Promise<never>((_, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs / 1000} seconds`)), timeoutMs);

      // Cancel timeout if operation is aborted
      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Operation cancelled by user'));
      });
    });
  }

  /**
   * Internal operation handler to be tracked
   */
  private async processInputOperation(input: string): Promise<void> {
    try {
      // Create an AbortController for cancellation (reuse if possible)
      if (!this.currentAbortController || this.currentAbortController.signal.aborted) {
        this.currentAbortController = new AbortController();
      }

      // Create timeout promise using utility method
      const timeoutPromise = this.createTimeoutPromise(this.currentAbortController);

      // Process input through command processor (SOLID delegation) with timeout and abort
      const result = await Promise.race([
        this.commandProcessor.processInput(input),
        timeoutPromise
      ]);

      // Handle results through UserInterface (SOLID separation)
      if (!result.success && result.message) {
        this.context.userInterface.showError(result.message);
      } else if (result.success && result.message) {
        this.context.userInterface.showSuccess(result.message);
      }

      // Handle exit command
      if (result.data?.shouldExit) {
        await this.cleanup();
        process.exit(0);
      }

      // Update current project if it changed
      if (result.data?.projectId) {
        this.currentProject = result.data;
      }

      // Don't show redundant completion message - commands show their own success/failure

      // Add a small delay to ensure all output is flushed before prompt
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error: unknown) {
      // Enhanced error handling with more context
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(Theme.colors.error(`❌ Command processing failed: ${errorMessage}`));

      if (error instanceof Error && error.stack && !errorMessage.includes('timed out')) {
        console.error(Theme.colors.muted('Stack trace:'));
        console.error(Theme.colors.muted(error.stack));
      }

      if (errorMessage.includes('timed out')) {
        console.error(Theme.colors.warning('⏰ The operation took too long and was cancelled to prevent CLI hanging.'));
        console.error(Theme.colors.muted('Try breaking down complex requests into smaller parts.'));
      }

      console.error(Theme.colors.muted('The CLI will continue running. Try again or type "/help" for assistance.'));
    } finally {
      // Always show prompt, even if there was an error
      this.rl.prompt();
    }
  }

  /**
   * Auto-detect CodeMind project silently (no output)
   */
  private async autoDetectProjectSilent(): Promise<void> {
    const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
    const projectConfig = await this.context.projectManager.detectProject(userCwd);

    if (projectConfig) {
      this.currentProject = projectConfig;
      // Skip instruction loading in silent mode to avoid authentication issues
    }
  }

  /**
   * Auto-detect CodeMind project - Delegated to ProjectManager (SOLID)
   */
  private async autoDetectProject(): Promise<void> {
    const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
    const projectConfig = await this.context.projectManager.detectProject(userCwd);

    if (projectConfig) {
      this.currentProject = projectConfig;
      console.log(Theme.colors.success(`✓ Project loaded: ${projectConfig.projectName}`));

      // Load CODEMIND.md instructions
      try {
        const instructionsSummary = await this.context.instructionService.getInstructionsSummary(userCwd);
        if (instructionsSummary.length > 1 || instructionsSummary[0] !== 'No CODEMIND.md instructions found') {
          console.log(Theme.colors.info(`📋 Loaded instructions:`));
          instructionsSummary.forEach(summary => {
            console.log(Theme.colors.muted(`   ${summary}`));
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(Theme.colors.warning(`⚠ Failed to load instructions: ${errorMessage}`));
      }
    } else {
      console.log(Theme.colors.warning('\n⚠ No CodeMind project found in current directory'));
      console.log(Theme.colors.muted('Run "/init" to initialize this directory as a CodeMind project'));
    }
    // Ensure prompt is shown after project detection messages
    this.rl.prompt();
  }


  /**
   * Set project path programmatically (for command-line options)
   */
  setProjectPath(projectPath: string): void {
    this.context.projectManager.setProjectPath(projectPath);
  }

  /**
   * Check database connections on startup
   */
  private async checkDatabaseConnections(): Promise<void> {
    console.log(Theme.colors.muted('\n🔍 Checking database connections...'));

    try {
      const databaseManager = new DatabaseManager();

      // Quick connection test with short timeout
      const connectionPromise = databaseManager.getDatabaseStatus();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout (3s)')), 3000)
      );

      const status = await Promise.race([connectionPromise, timeoutPromise]) as {
        postgresql?: { available: boolean };
        redis?: { available: boolean };
        neo4j?: { available: boolean };
      };

      // Check each database
      const postgresStatus = status.postgresql?.available ? '✅' : '❌';
      const redisStatus = status.redis?.available ? '✅' : '❌';
      const neo4jStatus = status.neo4j?.available ? '✅' : '❌';

      console.log(Theme.colors.muted(`   • PostgreSQL: ${postgresStatus}`));
      console.log(Theme.colors.muted(`   • Redis: ${redisStatus}`));
      console.log(Theme.colors.muted(`   • Neo4j: ${neo4jStatus}`));

      // Show warnings for failed connections
      const failedDatabases = [];
      if (!status.postgresql?.available) failedDatabases.push('PostgreSQL');
      if (!status.redis?.available) failedDatabases.push('Redis');
      if (!status.neo4j?.available) failedDatabases.push('Neo4j');

      if (failedDatabases.length > 0) {
        console.log(Theme.colors.warning(`\n⚠️  Warning: ${failedDatabases.join(', ')} ${failedDatabases.length === 1 ? 'is' : 'are'} not available`));
        console.log(Theme.colors.muted('   Some features may be limited. Use /init to set up databases.'));
      } else {
        console.log(Theme.colors.success('\n✅ All databases connected successfully'));
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(Theme.colors.warning(`\n⚠️  Database connection check failed: ${errorMessage}`));
      console.log(Theme.colors.muted('   CodeMind will work with limited functionality. Use /init to set up databases.'));
    }
  }

  /**
   * Cleanup resources on exit
   */
  private async cleanup(): Promise<void> {
    console.log(Theme.colors.muted('\n🧹 Cleaning up resources...'));

    try {
      // Cleanup with timeout protection
      const cleanupPromise = async () => {
        // Cleanup interrupt manager
        this.context.interruptManager.cleanup();

        // Cleanup Claude Code forwarder
        this.context.claudeForwarder.stopForwarding();

        // Cleanup database connections
        if (this.context.databaseManager) {
          try {
            await Promise.race([
              this.context.databaseManager.cleanup?.(),
              new Promise(resolve => setTimeout(resolve, 1000)) // 1 second timeout
            ]);
          } catch (error) {
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

      console.log(Theme.colors.muted('✅ Cleanup complete'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(Theme.colors.error(`❌ Cleanup error: ${errorMessage}`));
    }
  }
}

/**
 * Main entry point - SOLID architecture
 */
export async function main(): Promise<void> {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const hasCommand = args.includes('-c') || args.includes('--command');
  const hasProject = args.includes('-p') || args.includes('--project');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${Theme.colors.primary('CodeMind Interactive CLI - Intelligent Code Assistant')}

${Theme.colors.secondary('Usage:')}
  codemind [options] [command]

${Theme.colors.secondary('Options:')}
  -V, --version         output the version number
  -p, --project <path>  Project path
  -c, --command <cmd>   Execute single command
  --no-color            Disable colored output
  -h, --help            display help for command

${Theme.colors.secondary('Examples:')}
  codemind                    Start interactive mode in current directory
  codemind -p /path/to/proj   Start with specific project path
  codemind -c "analyze main"  Execute single command and exit
  codemind "what is this project about"  Execute direct command and exit
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
      // Execute single command and exit (streamlined for non-interactive mode)
      try {
        await cli.startSilent();
        await (cli as unknown as { processInput: (input: string) => Promise<void> }).processInput(args[commandIndex + 1]);
        console.log(Theme.colors.success('✅ Command completed'));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(Theme.colors.error(`❌ Command failed: ${errorMessage}`));
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
      }
      process.exit(0);
    }
  }

  // Handle direct command (positional argument that's not a flag)
  const commandStartIndex = args.findIndex(arg => !arg.startsWith('-') && !args[args.indexOf(arg) - 1]?.match(/^-[cp]|^--(?:command|project)$/));
  if (commandStartIndex !== -1 && !hasCommand && !hasProject) {
    // Execute direct command with all remaining arguments and exit
    const fullCommand = args.slice(commandStartIndex).join(' ');
    try {
      await cli.startSilent();
      await (cli as unknown as { processInput: (input: string) => Promise<void> }).processInput(fullCommand);
      console.log(Theme.colors.success('✅ Command completed'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(Theme.colors.error(`❌ Command failed: ${errorMessage}`));
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
    process.exit(0);
  }

  // Start interactive mode
  await cli.start();
}

// Error handling
process.on('uncaughtException', (error: Error) => {
  console.error(Theme.colors.error(`\n❌ Fatal error: ${error.message}`));
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (error: unknown) => {
  console.error(Theme.colors.error(`\n❌ Unhandled rejection: ${String(error)}`));
  console.error('This error should be handled properly in the application code.');
  console.error('CodeMind will continue running, but this issue should be fixed.');
  // Don't exit immediately - let the application handle it
  // process.exit(1);
});

// Start CLI if this is the main module
if (require.main === module) {
  main().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(Theme.colors.error(`\n❌ Failed to start CodeMind CLI: ${errorMessage}`));
    process.exit(1);
  });
}

export default CodeMindCLI;