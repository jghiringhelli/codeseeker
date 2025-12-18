/**
 * Command Processor
 * Single Responsibility: Coordinate command routing and provide static Claude Code execution
 * Dependency Inversion: Uses command router and handlers for actual processing
 */

import * as readline from 'readline';
import { CommandRouter, HistoryCallbacks } from '../commands/command-router';
import { CommandContext, CommandResult } from '../commands/command-context';
import { ClaudeCodeExecutor, ClaudeCodeExecutionOptions, ClaudeCodeExecutionResult } from '../services/claude/claude-code-executor';
import { ProjectManager } from './project-manager';
import { DatabaseManager } from './database-manager';
import { UserInterface } from './user-interface';
import { CodeMindInstructionService } from '../services/integration/codemind-instruction-service';
import { InterruptManager } from './interrupt-manager';
import { ClaudeCodeForwarder } from './claude-code-forwarder';
import { Theme } from '../ui/theme';

export class CommandProcessor {
  private router: CommandRouter;
  private context: CommandContext;
  private transparentMode = false;

  constructor(context: CommandContext) {
    this.context = context;
    this.router = new CommandRouter(context);
  }

  /**
   * Set the readline interface for user interaction
   */
  setReadlineInterface(rl: readline.Interface): void {
    this.router.setReadlineInterface(rl);
  }

  /**
   * Set transparent mode (skip interactive prompts)
   */
  setTransparentMode(enabled: boolean): void {
    this.transparentMode = enabled;
    this.router.setTransparentMode(enabled);
  }

  /**
   * Set verbose mode (show full debug output: files, relationships, prompt)
   */
  setVerboseMode(enabled: boolean): void {
    this.router.setVerboseMode(enabled);
  }

  /**
   * Set command mode (when running with -c flag)
   * In command mode, search is always forced on
   */
  setCommandMode(enabled: boolean): void {
    this.router.setCommandMode(enabled);
  }

  /**
   * Set no-search mode (skip semantic search)
   * When enabled, prompts go directly to Claude without file discovery
   */
  setNoSearchMode(enabled: boolean): void {
    this.router.setNoSearchMode(enabled);
  }

  /**
   * Prepare for a new prompt (manages search toggle state)
   */
  prepareForNewPrompt(): void {
    this.router.prepareForNewPrompt();
  }

  /**
   * Mark conversation as complete (for REPL mode)
   */
  markConversationComplete(): void {
    this.router.markConversationComplete();
  }

  /**
   * Set history callbacks (for /history command)
   */
  setHistoryCallbacks(callbacks: HistoryCallbacks): void {
    this.router.setHistoryCallbacks(callbacks);
  }

  /**
   * Process user input and route to appropriate handler
   */
  async processInput(input: string): Promise<CommandResult> {
    return await this.router.processInput(input);
  }

  /**
   * Centralized Claude Code CLI execution method
   * All Claude Code interactions should go through this method
   * STATIC: Can be used without instantiating CommandProcessor
   */
  static async executeClaudeCode(
    prompt: string,
    options: ClaudeCodeExecutionOptions = {}
  ): Promise<ClaudeCodeExecutionResult> {
    const result = await ClaudeCodeExecutor.execute(prompt, options);

    // Check for assumptions in response
    if (result.success && result.data) {
      const assumptions = ClaudeCodeExecutor.extractAssumptions(result.data);
      if (assumptions.length > 0) {
        console.log(Theme.colors.info('\n💭 Claude Code reported these assumptions:'));
        assumptions.forEach((assumption, index) => {
          console.log(Theme.colors.muted(`   ${index + 1}. ${assumption}`));
        });
      }
    }

    return result;
  }

  /**
   * Get available commands from router
   */
  getAvailableCommands(): string[] {
    return this.router.getAvailableCommands();
  }

  /**
   * Display the search toggle indicator
   * Shows radio-button style indicator: "( * ) Search files and knowledge graph"
   */
  displaySearchToggleIndicator(): void {
    this.router.displaySearchToggleIndicator();
  }

  /**
   * Get the user interaction service (for advanced search toggle control)
   */
  getUserInteractionService() {
    return this.router.getUserInteractionService();
  }
}

// Export the interfaces and types for external use
export { CommandContext, CommandResult } from '../commands/command-context';
export { ClaudeCodeExecutionOptions, ClaudeCodeExecutionResult } from '../services/claude/claude-code-executor';