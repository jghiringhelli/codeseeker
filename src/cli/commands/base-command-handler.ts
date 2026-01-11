/**
 * Base Command Handler
 * Single Responsibility: Provide common functionality for all command handlers
 * Open/Closed Principle: Extensible base class for new command types
 */

import * as path from 'path';
import { CommandContext, CommandResult, PathAnalysisOptions } from './command-context';

export abstract class BaseCommandHandler {
  protected context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  /**
   * Parse path and flags from command arguments
   */
  protected parsePathAndFlags(args: string): PathAnalysisOptions {
    const parts = args.trim().split(/\s+/);
    let targetPath = parts[0] || '/';  // Default to root if no path
    let recursive = true;  // Default to recursive

    // Check for --no-recursive flag
    if (parts.includes('--no-recursive') || parts.includes('--nr')) {
      recursive = false;
    }

    // Resolve path relative to project or current directory
    const projectPath = this.context.currentProject?.projectPath || process.env.CODESEEKER_USER_CWD || process.cwd();

    let resolvedPath: string;
    if (targetPath === '/' || targetPath === '.') {
      resolvedPath = projectPath;
    } else if (path.isAbsolute(targetPath)) {
      resolvedPath = targetPath;
    } else {
      resolvedPath = path.join(projectPath, targetPath);
    }

    return {
      path: targetPath,
      recursive,
      resolvedPath
    };
  }

  /**
   * Check if current project is available
   */
  protected requireProject(): CommandResult | null {
    if (!this.context.currentProject) {
      return {
        success: false,
        message: 'No project loaded. Run "init" first to set up a project.'
      };
    }
    return null;
  }

  /**
   * Parse boolean flags from arguments
   */
  protected parseFlags(args: string, flagMappings: Record<string, string[]>): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    const argParts = args.toLowerCase().split(/\s+/);

    for (const [key, aliases] of Object.entries(flagMappings)) {
      flags[key] = aliases.some(alias => argParts.includes(alias));
    }

    return flags;
  }

  /**
   * Extract specific argument values (e.g., --tech-stack=react,node)
   */
  protected extractArgValue(args: string, argName: string): string | null {
    const regex = new RegExp(`--${argName}=([^\\s]+)`, 'i');
    const match = args.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Abstract method that each command handler must implement
   */
  abstract handle(args: string): Promise<CommandResult>;
}