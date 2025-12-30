/**
 * Claude Code Output Forwarder
 * Captures and forwards Claude Code output in real-time with distinctive styling
 * Mirrors Claude Code's prompt-level output within CodeMind CLI
 */

import { EventEmitter } from 'events';
import { Theme } from '../ui/theme';
import { spawn, ChildProcess } from 'child_process';

export interface ClaudeCodeOutputOptions {
  showTimestamps?: boolean;
  prefixLines?: boolean;
  bufferOutput?: boolean;
}

export class ClaudeCodeForwarder extends EventEmitter {
  private claudeProcess: ChildProcess | null = null;
  private outputBuffer: string[] = [];
  private options: ClaudeCodeOutputOptions;

  constructor(options: ClaudeCodeOutputOptions = {}) {
    super();
    this.options = {
      showTimestamps: false,
      prefixLines: true,
      bufferOutput: true,
      ...options
    };
  }

  /**
   * Start forwarding output from a Claude Code process
   */
  startForwarding(process: ChildProcess): void {
    this.claudeProcess = process;

    // Forward stdout with Claude Code styling
    if (process.stdout) {
      process.stdout.on('data', (data: Buffer) => {
        this.handleClaudeOutput(data.toString(), 'stdout');
      });
    }

    // Forward stderr with Claude Code styling
    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        this.handleClaudeOutput(data.toString(), 'stderr');
      });
    }

    // Handle process events
    process.on('close', (code) => {
      this.handleClaudeClose(code);
    });

    process.on('error', (error) => {
      this.handleClaudeError(error);
    });
  }

  /**
   * Handle Claude Code output and format it with distinctive colors
   */
  private handleClaudeOutput(data: string, stream: 'stdout' | 'stderr'): void {
    const lines = data.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const formattedLine = this.formatClaudeOutput(line, stream);

      // Output immediately for real-time feedback
      console.log(formattedLine);

      // Buffer if enabled
      if (this.options.bufferOutput) {
        this.outputBuffer.push(formattedLine);
      }

      // Emit for other components to listen
      this.emit('claudeOutput', {
        original: line,
        formatted: formattedLine,
        stream,
        timestamp: new Date()
      });
    }
  }

  /**
   * Format Claude Code output with distinctive styling
   */
  private formatClaudeOutput(line: string, stream: 'stdout' | 'stderr'): string {
    const prefix = this.options.prefixLines ? '🤖 ' : '';
    const timestamp = this.options.showTimestamps
      ? `[${new Date().toLocaleTimeString()}] `
      : '';

    // Different styling for different types of Claude output
    if (stream === 'stderr') {
      return Theme.colors.error(`${prefix}${timestamp}${line}`);
    }

    // Detect different types of Claude Code output and style accordingly
    if (line.includes('✓') || line.includes('success')) {
      return Theme.colors.claudeCode(`${prefix}${timestamp}`) + Theme.colors.success(line);
    } else if (line.includes('⚠') || line.includes('warning')) {
      return Theme.colors.claudeCode(`${prefix}${timestamp}`) + Theme.colors.warning(line);
    } else if (line.includes('❌') || line.includes('error')) {
      return Theme.colors.claudeCode(`${prefix}${timestamp}`) + Theme.colors.error(line);
    } else if (line.includes('🔍') || line.includes('analyzing') || line.includes('processing')) {
      return Theme.colors.claudeCode(`${prefix}${timestamp}`) + Theme.colors.claudeCodeMuted(line);
    } else {
      // Default Claude Code output styling
      return Theme.colors.claudeCode(`${prefix}${timestamp}${line}`);
    }
  }

  /**
   * Handle Claude Code process close
   */
  private handleClaudeClose(code: number | null): void {
    const message = code === 0
      ? '✅ Claude Code process completed successfully'
      : `⚠️  Claude Code process exited with code: ${code}`;

    console.log(Theme.colors.claudeCodeMuted(`\n🤖 ${message}`));

    this.emit('claudeClose', {
      code,
      outputBuffer: this.outputBuffer.slice()
    });
  }

  /**
   * Handle Claude Code process error
   */
  private handleClaudeError(error: Error): void {
    console.log(Theme.colors.error(`\n🤖 Claude Code Error: ${error.message}`));
    this.emit('claudeError', error);
  }

  /**
   * Send input to Claude Code process
   */
  sendToClaudeCode(input: string): boolean {
    if (this.claudeProcess && this.claudeProcess.stdin) {
      try {
        this.claudeProcess.stdin.write(input + '\n');

        // Show what we sent in a muted style
        console.log(Theme.colors.claudeCodeMuted(`🤖 → ${input}`));
        return true;
      } catch (error) {
        console.log(Theme.colors.error(`Failed to send input to Claude Code: ${error.message}`));
        return false;
      }
    }
    return false;
  }

  /**
   * Interrupt Claude Code process (send escape/interrupt signal)
   */
  interruptClaudeCode(): void {
    if (this.claudeProcess) {
      // Try to send escape key first (graceful)
      if (this.claudeProcess.stdin) {
        this.claudeProcess.stdin.write('\x1b'); // ESC key
        console.log(Theme.colors.interrupt('🤖 ⏸️  Sending interrupt to Claude Code...'));
      }

      // If process doesn't respond, force kill after timeout
      setTimeout(() => {
        if (this.claudeProcess && !this.claudeProcess.killed) {
          console.log(Theme.colors.interrupt('🤖 🛑 Force terminating Claude Code process...'));
          this.claudeProcess.kill('SIGTERM');
        }
      }, 5000);
    }
  }

  /**
   * Execute a Claude Code command with real-time output forwarding
   */
  async executeClaudeCodeCommand(
    command: string,
    args: string[] = [],
    workingDirectory?: string
  ): Promise<{ success: boolean; output: string[]; code: number | null }> {
    return new Promise((resolve, reject) => {
      console.log(Theme.colors.claudeCode(`\n🤖 Executing: ${command} ${args.join(' ')}`));

      const childProcess = spawn(command, args, {
        cwd: workingDirectory || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.startForwarding(childProcess);

      const results: string[] = [];

      this.on('claudeOutput', (output) => {
        results.push(output.original);
      });

      this.on('claudeClose', ({ code, outputBuffer }) => {
        resolve({
          success: code === 0,
          output: results,
          code
        });
      });

      this.on('claudeError', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get buffered output
   */
  getBufferedOutput(): string[] {
    return this.outputBuffer.slice();
  }

  /**
   * Clear output buffer
   */
  clearBuffer(): void {
    this.outputBuffer = [];
  }

  /**
   * Stop forwarding and cleanup
   */
  stopForwarding(): void {
    if (this.claudeProcess) {
      this.claudeProcess.removeAllListeners();
      if (!this.claudeProcess.killed) {
        this.claudeProcess.kill();
      }
      this.claudeProcess = null;
    }
    this.removeAllListeners();
  }
}

export default ClaudeCodeForwarder;