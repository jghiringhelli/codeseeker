/**
 * Claude LLM Executor
 *
 * Implementation of ILLMExecutor for Claude Code CLI.
 * Wraps the existing ClaudeCodeExecutor with the LLM-agnostic interface.
 *
 * This enables:
 * - Using Claude through the standardized interface
 * - Easy swapping with MockLLMExecutor for testing
 * - Future support for other Claude modes (API, SDK)
 * - Streaming mode to display intermediate tool calls
 */

import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PlatformUtils } from '../../../shared/platform-utils';
import {
  ILLMExecutor,
  IStreamingLLMExecutor,
  LLMExecutionOptions,
  LLMExecutionResult,
  LLMProviderInfo
} from './interfaces';

const execAsync = promisify(exec);

/**
 * Extended options for streaming execution
 */
export interface StreamingExecutionOptions extends LLMExecutionOptions {
  /** Show intermediate tool calls as they happen */
  showToolCalls?: boolean;
  /** Callback for each tool call */
  onToolCall?: (toolCall: ToolCallEvent) => void;
  /** Callback for each text chunk */
  onTextChunk?: (text: string) => void;
}

/**
 * Represents a tool call event from Claude
 */
export interface ToolCallEvent {
  type: 'tool_use' | 'tool_result';
  toolName: string;
  input?: Record<string, unknown>;
  output?: string;
  status?: 'running' | 'completed' | 'error';
}

export class ClaudeLLMExecutor implements ILLMExecutor, IStreamingLLMExecutor {
  private static readonly DEFAULT_TIMEOUT = 120000; // 2 minutes
  private static readonly MAX_PROMPT_SIZE = 25000; // characters

  /**
   * Execute a prompt using Claude Code CLI with streaming output
   * This shows intermediate tool calls (Glob, Bash, Read, etc.) as they happen
   */
  async executeWithStreaming(
    prompt: string,
    context?: string,
    options?: StreamingExecutionOptions
  ): Promise<LLMExecutionResult> {
    const startTime = Date.now();
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

    // Validate prompt size
    const validation = this.validatePromptSize(fullPrompt);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.warning || 'Prompt too large',
        executionTimeMs: Date.now() - startTime,
        metadata: { provider: 'claude' }
      };
    }

    // Check if running inside Claude Code (avoid recursion)
    if (PlatformUtils.isRunningInClaudeCode()) {
      console.log('🔄 Running inside Claude Code - using transparent passthrough');
      return {
        success: true,
        data: 'CodeMind is running inside Claude Code. Query passed through directly.',
        executionTimeMs: Date.now() - startTime,
        metadata: { provider: 'claude', mode: 'transparent' }
      };
    }

    return new Promise(async (resolve) => {
      try {
        // Create temporary input file
        const { randomBytes } = await import('crypto');
        const tmpDir = PlatformUtils.getTempDir();
        const inputFile = path.join(tmpDir, `claude-prompt-${randomBytes(8).toString('hex')}.txt`);
        await fs.writeFile(inputFile, fullPrompt, 'utf8');

        // Build command args for streaming JSON output
        const args = [
          '-p',  // print mode
          '--output-format', 'stream-json',
          '--include-partial-messages'
        ];

        // Spawn Claude CLI with streaming
        const claudeProcess: ChildProcess = spawn('claude', args, {
          cwd: options?.projectPath || process.cwd(),
          env: { ...process.env },
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let fullResponse = '';
        let lastToolName = '';
        const timeout = options?.timeout || ClaudeLLMExecutor.DEFAULT_TIMEOUT;

        // Set timeout
        const timeoutId = setTimeout(() => {
          claudeProcess.kill();
          resolve({
            success: false,
            error: 'Execution timed out',
            executionTimeMs: Date.now() - startTime,
            metadata: { provider: 'claude' }
          });
        }, timeout);

        // Pipe the prompt to stdin
        if (claudeProcess.stdin) {
          claudeProcess.stdin.write(fullPrompt);
          claudeProcess.stdin.end();
        }

        // Process streaming JSON output
        claudeProcess.stdout?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              this.handleStreamEvent(event, options, lastToolName, (name) => { lastToolName = name; });

              // Accumulate text for final response
              if (event.type === 'assistant' && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'text') {
                    fullResponse += block.text;
                  }
                }
              }
            } catch {
              // Not valid JSON, might be partial - accumulate as text
              fullResponse += line;
            }
          }
        });

        claudeProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          if (text.includes('Error:') || text.includes('Failed:')) {
            console.error('Claude CLI Error:', text);
          }
        });

        claudeProcess.on('close', async (code) => {
          clearTimeout(timeoutId);

          // Clean up temp file
          try {
            await fs.unlink(inputFile);
          } catch { /* ignore */ }

          if (code === 0 || fullResponse.trim()) {
            resolve({
              success: true,
              data: fullResponse.trim() || 'Completed',
              tokensUsed: this.estimateTokens(fullResponse),
              executionTimeMs: Date.now() - startTime,
              metadata: { provider: 'claude', model: 'claude-code-cli', streaming: true }
            });
          } else {
            resolve({
              success: false,
              error: `Claude CLI exited with code ${code}`,
              executionTimeMs: Date.now() - startTime,
              metadata: { provider: 'claude' }
            });
          }
        });

        claudeProcess.on('error', async (error) => {
          clearTimeout(timeoutId);
          try {
            await fs.unlink(inputFile);
          } catch { /* ignore */ }

          resolve({
            success: false,
            error: error.message,
            executionTimeMs: Date.now() - startTime,
            metadata: { provider: 'claude' }
          });
        });

      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime,
          metadata: { provider: 'claude' }
        });
      }
    });
  }

  /**
   * Handle a streaming event from Claude CLI
   */
  private handleStreamEvent(
    event: any,
    options?: StreamingExecutionOptions,
    lastToolName?: string,
    setLastToolName?: (name: string) => void
  ): void {
    const showToolCalls = options?.showToolCalls ?? true;

    // Handle tool use events
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      const toolName = event.content_block.name || 'Unknown';
      if (setLastToolName) setLastToolName(toolName);

      if (showToolCalls) {
        console.log(`\n${this.getToolIcon(toolName)} ${toolName}`);
      }

      if (options?.onToolCall) {
        options.onToolCall({
          type: 'tool_use',
          toolName,
          status: 'running'
        });
      }
    }

    // Handle tool input (shows what's being passed to the tool)
    if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
      // Tool input is being streamed - we could accumulate and display
    }

    // Handle tool result
    if (event.type === 'tool_result') {
      const output = typeof event.content === 'string'
        ? event.content
        : JSON.stringify(event.content, null, 2);

      if (showToolCalls && output) {
        // Show abbreviated output
        const lines = output.split('\n');
        if (lines.length > 10) {
          console.log(lines.slice(0, 5).join('\n'));
          console.log(`  ... (${lines.length - 10} more lines)`);
          console.log(lines.slice(-5).join('\n'));
        } else {
          console.log(output);
        }
      }

      if (options?.onToolCall) {
        options.onToolCall({
          type: 'tool_result',
          toolName: lastToolName || 'Unknown',
          output,
          status: 'completed'
        });
      }
    }

    // Handle text chunks
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const text = event.delta.text;
      if (options?.onTextChunk) {
        options.onTextChunk(text);
      }
    }
  }

  /**
   * Get an icon for a tool type
   */
  private getToolIcon(toolName: string): string {
    const icons: Record<string, string> = {
      'Read': '📖',
      'Write': '✏️',
      'Edit': '📝',
      'Bash': '💻',
      'Glob': '🔍',
      'Grep': '🔎',
      'Task': '📋',
      'WebFetch': '🌐',
      'WebSearch': '🔍',
      'TodoWrite': '✅'
    };
    return icons[toolName] || '🔧';
  }

  /**
   * Async generator for streaming (implements IStreamingLLMExecutor)
   */
  async *executeStream(
    prompt: string,
    context?: string,
    options?: LLMExecutionOptions
  ): AsyncIterable<string> {
    // For now, fall back to non-streaming and yield the full result
    const result = await this.execute(prompt, context, options);
    if (result.success && result.data) {
      yield typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }
  }

  /**
   * Execute a prompt using Claude Code CLI (non-streaming)
   */
  async execute(
    prompt: string,
    context?: string,
    options?: LLMExecutionOptions
  ): Promise<LLMExecutionResult> {
    const startTime = Date.now();

    try {
      // Combine prompt and context
      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

      // Validate prompt size
      const validation = this.validatePromptSize(fullPrompt);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.warning || 'Prompt too large',
          executionTimeMs: Date.now() - startTime,
          metadata: { provider: 'claude' }
        };
      }

      // Set defaults
      const timeout = options?.timeout || ClaudeLLMExecutor.DEFAULT_TIMEOUT;

      // Create temporary input file
      const { randomBytes } = await import('crypto');
      const tmpDir = PlatformUtils.getTempDir();
      const inputFile = path.join(tmpDir, `claude-prompt-${randomBytes(8).toString('hex')}.txt`);

      // Write prompt to temp file
      await fs.writeFile(inputFile, fullPrompt, 'utf8');

      try {
        // Build command
        const command = PlatformUtils.getClaudeCodeCommand(inputFile);

        // Execute
        const baseOptions: Parameters<typeof execAsync>[1] = {
          timeout,
          env: { ...process.env },
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          encoding: 'utf8' as BufferEncoding
        };

        if (options?.projectPath) {
          baseOptions.cwd = options.projectPath;
        }

        const execOptions = PlatformUtils.getExecOptions(baseOptions as any);
        const { stdout, stderr } = await execAsync(command, execOptions);

        // Check for errors
        if (stderr && (stderr.includes('Error:') || stderr.includes('Failed:'))) {
          return {
            success: false,
            error: `Claude CLI error: ${stderr}`,
            executionTimeMs: Date.now() - startTime,
            metadata: { provider: 'claude' }
          };
        }

        if (stdout && String(stdout).trim().length > 0) {
          const responseData = String(stdout).trim();
          const tokensUsed = this.estimateTokens(responseData);

          return {
            success: true,
            data: responseData,
            tokensUsed,
            executionTimeMs: Date.now() - startTime,
            metadata: {
              provider: 'claude',
              model: options?.model || 'claude-code-cli',
              finishReason: 'stop'
            }
          };
        }

        return {
          success: false,
          error: 'Empty response from Claude Code',
          executionTimeMs: Date.now() - startTime,
          metadata: { provider: 'claude' }
        };

      } finally {
        // Clean up temp file
        try {
          await fs.unlink(inputFile);
        } catch {
          // Ignore cleanup errors
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
        metadata: { provider: 'claude' }
      };
    }
  }

  /**
   * Get information about the Claude provider
   */
  getProviderInfo(): LLMProviderInfo {
    return {
      id: 'claude',
      name: 'Claude Code CLI',
      version: '1.0.0',
      availableModels: ['claude-code-cli'],
      maxContextTokens: 100000,
      isAvailable: true // Will be verified by testConnection
    };
  }

  /**
   * Test connection to Claude Code CLI
   */
  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      // Try a simple echo command through Claude
      const result = await this.execute('echo "Connection test"', undefined, {
        timeout: 10000
      });

      if (result.success) {
        return { connected: true };
      } else {
        return { connected: false, error: result.error };
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * Estimate tokens for text
   */
  estimateTokens(text: string): number {
    // Claude tokenization is roughly 4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate prompt size
   */
  validatePromptSize(prompt: string): {
    valid: boolean;
    size: number;
    maxSize: number;
    warning?: string;
  } {
    const size = prompt.length;
    const maxSize = ClaudeLLMExecutor.MAX_PROMPT_SIZE;

    if (size > maxSize) {
      return {
        valid: false,
        size,
        maxSize,
        warning: `Prompt size (${size} chars) exceeds maximum (${maxSize} chars)`
      };
    }

    if (size > 15000) {
      return {
        valid: true,
        size,
        maxSize,
        warning: `Large prompt (${size} chars) - consider chunking for better performance`
      };
    }

    return { valid: true, size, maxSize };
  }
}