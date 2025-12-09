/**
 * Claude Execution Service
 * SOLID Principles: Single Responsibility - Handle Claude Code command execution only
 */

import { Logger } from '../../../utils/logger';
import { CommandProcessor } from '../../../cli/managers/command-processor';
import {
  IClaudeExecutionService,
  ClaudeCodeOptions,
  ClaudeCodeResponse,
  CommandExecutionOptions,
  CommandExecutionResult
} from '../interfaces/index';

export class ClaudeExecutionService implements IClaudeExecutionService {
  private logger = Logger.getInstance();

  async executeClaudeCode(
    prompt: string,
    context: string,
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeCodeResponse> {
    try {
      this.logger.info('🤖 Executing Claude Code command');

      // Combine prompt and context
      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

      this.logger.debug(`📏 Prompt size: ${fullPrompt.length} characters`);

      // Execute using centralized command processor
      const result = await CommandProcessor.executeClaudeCode(fullPrompt, {
        projectPath: options.projectPath,
        maxTokens: options.maxTokens,
        outputFormat: 'text',
        timeout: 120000 // 2 minutes
      });

      if (!result.success) {
        throw new Error(result.error || 'Claude Code execution failed');
      }

      return {
        success: true,
        data: result.data,
        tokensUsed: result.tokensUsed || 0,
        resumeToken: options.resumeToken
      };
    } catch (error) {
      this.logger.error(`❌ Claude Code execution failed: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async executeCommand(command: string, options: CommandExecutionOptions = {}): Promise<CommandExecutionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(`🔧 Executing command: ${command.substring(0, 100)}...`);

      const result = await CommandProcessor.executeClaudeCode(command, {
        projectPath: options.projectPath || '.',
        maxTokens: options.maxTokens || 4000,
        outputFormat: (options.outputFormat as "json" | "text") || 'text',
        timeout: options.timeout || 120000
      });

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Command execution failed',
          executionTime
        };
      }

      return {
        success: true,
        data: result.data,
        tokensUsed: result.tokensUsed,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ Command execution failed: ${error instanceof Error ? error.message : error}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }

  // Helper methods for execution validation and optimization
  validatePromptSize(prompt: string): { valid: boolean; size: number; warning?: string } {
    const size = prompt.length;
    const maxSize = 25000; // 25K character limit

    if (size > maxSize) {
      return {
        valid: false,
        size,
        warning: `Prompt size (${size} chars) exceeds maximum (${maxSize} chars)`
      };
    }

    if (size > 15000) {
      return {
        valid: true,
        size,
        warning: `Large prompt (${size} chars) - consider chunking for better performance`
      };
    }

    return { valid: true, size };
  }

  async testConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      this.logger.debug('🔍 Testing Claude Code connection...');

      const result = await this.executeCommand('echo "Connection test"', {
        timeout: 10000 // 10 second timeout for connection test
      });

      if (result.success) {
        return {
          connected: true,
          version: 'Claude Code CLI'
        };
      } else {
        return {
          connected: false,
          error: result.error
        };
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  // Performance monitoring
  getExecutionStats(): {
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    // This would track execution statistics
    // For now, return mock data
    return {
      totalExecutions: 0,
      averageExecutionTime: 0,
      successRate: 1.0
    };
  }
}