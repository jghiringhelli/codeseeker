/**
 * Claude Code Executor Service
 * Single Responsibility: Handle all Claude Code CLI execution with consistent error handling
 * Dependency Inversion: Abstract interface for Claude Code interactions
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PlatformUtils } from '../../../shared/platform-utils';

const execAsync = promisify(exec);

export interface ClaudeCodeExecutionOptions {
  projectPath?: string;
  maxTokens?: number;
  outputFormat?: 'text' | 'json';
  model?: string;
  systemPrompt?: string;
  timeout?: number;
}

export interface ClaudeCodeExecutionResult {
  success: boolean;
  data?: string;
  error?: string;
  tokensUsed?: number;
}

export class ClaudeCodeExecutor {
  private static readonly DEFAULT_TIMEOUT = 120000; // 2 minutes
  private static readonly DEFAULT_MAX_TOKENS = 8000;

  /**
   * Execute Claude Code CLI with the provided prompt and options
   * All Claude Code interactions should go through this method
   */
  static async execute(
    prompt: string,
    options: ClaudeCodeExecutionOptions = {}
  ): Promise<ClaudeCodeExecutionResult> {
    try {
      console.log(`🤖 Processing with Claude Code...`);

      // Set defaults
      const timeout = options.timeout || this.DEFAULT_TIMEOUT;
      const maxTokens = options.maxTokens || this.DEFAULT_MAX_TOKENS;

      // Create temporary input file
      const { randomBytes } = await import('crypto');
      const tmpDir = PlatformUtils.getTempDir();
      const inputFile = path.join(tmpDir, `claude-prompt-${randomBytes(8).toString('hex')}.txt`);

      // Convert to Windows path for PowerShell compatibility
      const windowsInputFile = PlatformUtils.isWindows() ? inputFile.replace(/\//g, '\\') : inputFile;

      // Write prompt to temp file
      await fs.writeFile(inputFile, prompt, 'utf8');

      try {
        // Build command arguments
        const args: string[] = ['--print']; // Always use --print for non-interactive mode

        if (options.outputFormat === 'json') {
          args.push('--output-format', 'json');
        }

        if (options.model) {
          args.push('--model', options.model);
        }

        if (options.systemPrompt) {
          args.push('--system-prompt', options.systemPrompt);
        }

        // Try multiple command approaches for reliability
        const commands = [
          // Primary approach: PowerShell with file input
          `powershell -Command "Get-Content '${windowsInputFile}' -Raw | claude ${args.join(' ')}"`,
          // Alternative: Direct file input
          `claude ${args.join(' ')} < "${inputFile}"`,
          // PowerShell with proper escaping
          `powershell -Command "& { $content = Get-Content '${windowsInputFile}' -Raw; $content | claude ${args.join(' ')} }"`,
          // Command prompt approach
          `cmd /c "type \\"${windowsInputFile}\\" | claude ${args.join(' ')}"`,
          // Fallback: Basic pipe approach - use original path for Unix commands
          `cat "${inputFile}" | claude ${args.join(' ')}`
        ];

        let lastError: any;

        for (const command of commands) {
          try {
            console.log(`🔧 Trying: ${command.split('|')[0].trim()}...`);
            console.log(`📁 File exists: ${await fs.access(inputFile).then(() => true).catch(() => false)}`);
            console.log(`📄 File size: ${(await fs.stat(inputFile).catch(() => ({ size: 0 }))).size} bytes`);

            const execOptions: any = {
              timeout,
              env: { ...process.env },
              maxBuffer: 1024 * 1024 * 10, // 10MB buffer
              encoding: 'utf8'
            };

            // Set working directory if provided
            if (options.projectPath) {
              execOptions.cwd = options.projectPath;
            }

            const { stdout, stderr } = await execAsync(command, execOptions);

            // Check for errors but allow informational messages
            if (stderr && (stderr.includes('Error:') || stderr.includes('Failed:'))) {
              throw new Error(`Claude CLI error: ${stderr}`);
            }

            if (stdout && String(stdout).trim().length > 0) {
              const responseData = String(stdout).trim();
              const tokensUsed = Math.ceil(responseData.length / 4); // Rough token estimate

              console.log(`✅ Claude Code response received (${Math.ceil(responseData.length/1000)}KB)`);

              return {
                success: true,
                data: responseData,
                tokensUsed
              };
            }

            throw new Error('Empty response from Claude Code');

          } catch (error) {
            lastError = error;
            console.log(`⚠️ Command failed: ${error.message || error}`);
            console.log(`   Full command: ${command}`);
            continue;
          }
        }

        // If all commands failed, throw the last error
        throw lastError || new Error('All Claude Code command formats failed');

      } finally {
        // Clean up temp file
        try {
          await fs.unlink(inputFile);
        } catch {
          // Ignore cleanup errors
        }
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Claude Code execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        tokensUsed: 0
      };
    }
  }

  /**
   * Check if Claude Code response includes assumptions that need user attention
   */
  static extractAssumptions(responseData: any): string[] {
    const assumptions: string[] = [];

    try {
      if (responseData && typeof responseData === 'object') {
        if (responseData.assumptions && Array.isArray(responseData.assumptions)) {
          assumptions.push(...responseData.assumptions);
        }
      } else if (typeof responseData === 'string') {
        // Try to parse JSON from string response
        const jsonMatch = responseData.match(/\{[\s\S]*"assumptions"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.assumptions && Array.isArray(parsed.assumptions)) {
            assumptions.push(...parsed.assumptions);
          }
        }
      }
    } catch (error) {
      // Silent fail - assumptions extraction is optional
    }

    return assumptions;
  }

  /**
   * Estimate token usage for a given text
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}