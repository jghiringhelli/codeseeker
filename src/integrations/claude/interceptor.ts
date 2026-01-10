import { EventEmitter } from 'events';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

/**
 * Claude Code Interceptor
 * Intercepts and enhances Claude Code CLI commands with additional context
 */
export interface InterceptorOptions {
  projectPath: string;
  enhance?: boolean;
  enableQualityChecks?: boolean;
  enableContextOptimization?: boolean;
  enableRealTimeGuidance?: boolean;
  enableLearning?: boolean;
  maxContextTokens?: number;
  logLevel?: 'silent' | 'normal' | 'verbose';
}

export interface InterceptedCommand {
  command: string;
  args: string[];
  timestamp: Date;
  enhanced: boolean;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class ClaudeCodeInterceptor extends EventEmitter {
  private options: InterceptorOptions;
  private activeProcess?: ChildProcessWithoutNullStreams;
  private commandHistory: InterceptedCommand[] = [];

  constructor(options: InterceptorOptions) {
    super();
    this.options = options;
  }

  /**
   * Initialize the interceptor
   */
  async initialize(config?: any): Promise<void> {
    // Check if Claude Code is available
    const available = await ClaudeCodeInterceptor.isAvailable();
    if (!available) {
      throw new Error('Claude Code CLI is not available. Please install it first.');
    }
  }

  /**
   * Start Claude Code in the background
   */
  async startClaudeCode(options?: any): Promise<void> {
    // This would start Claude Code CLI in interactive mode
    // For now, we just ensure it's available
    const available = await ClaudeCodeInterceptor.isAvailable();
    if (!available) {
      throw new Error('Cannot start Claude Code: CLI not available');
    }
  }

  /**
   * Intercept and enhance a Claude Code command
   */
  async intercept(command: string, args: string[] = []): Promise<CommandResult> {
    const interceptedCommand: InterceptedCommand = {
      command,
      args,
      timestamp: new Date(),
      enhanced: this.options.enhance || false
    };

    this.commandHistory.push(interceptedCommand);
    this.emit('command-intercepted', interceptedCommand);

    if (this.options.enhance) {
      args = await this.enhanceArguments(command, args);
    }

    return this.executeCommand(command, args);
  }

  /**
   * Enhance command arguments with additional context
   */
  private async enhanceArguments(command: string, args: string[]): Promise<string[]> {
    const enhanced = [...args];

    // Add project context if not already present
    if (!args.includes('--project') && this.options.projectPath) {
      enhanced.push('--project', this.options.projectPath);
    }

    // Add context flag for better results
    if (!args.includes('--with-context')) {
      enhanced.push('--with-context');
    }

    this.emit('arguments-enhanced', { original: args, enhanced });
    return enhanced;
  }

  /**
   * Execute the actual Claude Code command
   */
  private executeCommand(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve) => {
      const claudeCommand = 'claude';
      const fullArgs = [command, ...args];

      if (this.options.logLevel === 'verbose') {
        console.log(`🔧 Executing: ${claudeCommand} ${fullArgs.join(' ')}`);
      }

      this.activeProcess = spawn(claudeCommand, fullArgs, {
        cwd: this.options.projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      this.activeProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        if (this.options.logLevel !== 'silent') {
          process.stdout.write(chunk);
        }
      });

      this.activeProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        
        if (this.options.logLevel !== 'silent') {
          process.stderr.write(chunk);
        }
      });

      this.activeProcess.on('close', (code) => {
        this.activeProcess = undefined;
        
        const result: CommandResult = {
          success: code === 0,
          output: output.trim(),
          error: error.trim(),
          exitCode: code || 0
        };

        this.emit('command-completed', result);
        resolve(result);
      });

      this.activeProcess.on('error', (err) => {
        this.activeProcess = undefined;
        
        const result: CommandResult = {
          success: false,
          error: err.message,
          exitCode: -1
        };

        this.emit('command-error', err);
        resolve(result);
      });
    });
  }

  /**
   * Generate enhanced context for Claude Code
   */
  async generateEnhancedContext(query: string, projectPath: string): Promise<string> {
    // This would integrate with the tool selection system
    // For now, return a simple enhanced context
    return `
Project: ${projectPath}
Query: ${query}
Enhanced Context: This query has been enhanced with CodeSeeker's intelligent tool selection.
    `.trim();
  }

  /**
   * Stop any active process
   */
  stop(): void {
    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = undefined;
    }
  }

  /**
   * Get command history
   */
  getHistory(): InterceptedCommand[] {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * Check if Claude Code CLI is available
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn('claude', ['--version'], {
        stdio: 'ignore'
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }
}

export default ClaudeCodeInterceptor;