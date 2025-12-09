/**
 * Cross-platform utilities for CodeMind
 * Handles differences between Windows, macOS, and Linux
 */

import * as os from 'os';
import * as path from 'path';

export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

export class PlatformUtils {
  private static _platform: Platform | null = null;

  /**
   * Get the current platform
   */
  static getPlatform(): Platform {
    if (this._platform) {
      return this._platform;
    }

    const platform = os.platform();
    switch (platform) {
      case 'win32':
        this._platform = 'windows';
        break;
      case 'darwin':
        this._platform = 'macos';
        break;
      case 'linux':
        this._platform = 'linux';
        break;
      default:
        this._platform = 'unknown';
    }

    return this._platform;
  }

  /**
   * Check if running on Windows
   */
  static isWindows(): boolean {
    return this.getPlatform() === 'windows';
  }

  /**
   * Check if running on macOS
   */
  static isMacOS(): boolean {
    return this.getPlatform() === 'macos';
  }

  /**
   * Check if running on Linux
   */
  static isLinux(): boolean {
    return this.getPlatform() === 'linux';
  }

  /**
   * Check if running on Unix-like system (macOS or Linux)
   */
  static isUnix(): boolean {
    const platform = this.getPlatform();
    return platform === 'macos' || platform === 'linux';
  }

  /**
   * Detect if running inside Claude Code's TOOL EXECUTION context
   * This is used to decide whether to output context for the current Claude instance
   * or try to spawn a new Claude CLI process
   *
   * IMPORTANT: We only want to detect when CodeMind is being EXECUTED AS A TOOL by Claude Code,
   * NOT just when Claude Code VSCode extension is installed or running in background.
   *
   * - CLAUDECODE and CLAUDE_CODE_ENTRYPOINT are set when VSCode extension is active
   *   but do NOT indicate we're being run as a tool - ignore these
   * - MCP_TOOL_CALL_ID indicates actual tool execution context
   * - CLAUDE_CLI_SESSION / ANTHROPIC_CLI_SESSION indicate actual CLI session context
   */
  static isRunningInClaudeCode(): boolean {
    // Check for explicit CodeMind transparent mode flag (manual override)
    if (process.env.CODEMIND_TRANSPARENT_MODE === 'true') {
      return true;
    }

    // Check for MCP tool execution context - this is the most reliable indicator
    // that we're being called AS A TOOL by Claude Code
    if (process.env.MCP_TOOL_CALL_ID) {
      return true;
    }

    // Check for actual Claude CLI session context (when spawned by Claude CLI)
    if (process.env.CLAUDE_CLI_SESSION || process.env.ANTHROPIC_CLI_SESSION || process.env.CLAUDE_CODE_SESSION) {
      return true;
    }

    // Note: We intentionally DO NOT check for:
    // - CLAUDECODE - just means VSCode extension is installed
    // - CLAUDE_CODE_ENTRYPOINT - just means VSCode extension is the entrypoint
    // - CLAUDE_CODE_SSE_PORT - just means Claude is running somewhere
    // These variables indicate Claude Code is AVAILABLE, not that we're being run BY it

    return false;
  }

  /**
   * Force transparent mode for testing or when running inside Claude Code
   * Set CODEMIND_TRANSPARENT_MODE=true to force this behavior
   */
  static setTransparentMode(enabled: boolean): void {
    if (enabled) {
      process.env.CODEMIND_TRANSPARENT_MODE = 'true';
    } else {
      delete process.env.CODEMIND_TRANSPARENT_MODE;
    }
  }

  /**
   * Get the appropriate file reading command for the platform
   */
  static getFileReadCommand(): string {
    if (this.isWindows()) {
      // Check if we're in Git Bash environment
      const shell = process.env.SHELL || process.env.ComSpec || '';
      const isGitBash = shell.includes('bash') || !!process.env.MSYSTEM;

      if (isGitBash) {
        // In Git Bash, use cat
        return 'cat';
      } else {
        // In Windows CMD/PowerShell, use type
        return 'type';
      }
    } else {
      // True Unix environments (macOS, Linux)
      return 'cat';
    }
  }

  /**
   * Get the appropriate shell for exec commands
   */
  static getShell(): string | boolean {
    if (this.isWindows()) {
      return 'cmd.exe';
    } else {
      return '/bin/bash';
    }
  }

  /**
   * Get platform-specific exec options
   */
  static getExecOptions(baseOptions: Record<string, unknown> = {}): Record<string, unknown> {
    const options: Record<string, unknown> = {
      ...baseOptions,
      encoding: 'utf8' // Ensure string output, not Buffer
    };

    // For Windows environments, detect the actual shell being used
    if (this.isWindows()) {
      (options as { windowsHide?: boolean }).windowsHide = true;

      // Check if we're in Git Bash or WSL
      const shell = process.env.SHELL || process.env.ComSpec || '';
      const isGitBash = shell.includes('bash') || !!process.env.MSYSTEM;
      const isWSL = !!process.env.WSL_DISTRO_NAME;

      if (isGitBash || isWSL) {
        // In Git Bash or WSL, use bash explicitly
        (options as { shell?: string | boolean }).shell = 'bash';
      } else {
        // In Windows CMD or PowerShell, let Node.js handle it
        (options as { shell?: string | boolean }).shell = true;
      }
    } else {
      // True Unix environments (macOS, Linux)
      (options as { shell?: string | boolean }).shell = '/bin/bash';
    }

    return options;
  }

  /**
   * Get the appropriate pipe command for Claude Code execution
   * Note: Environment variables should be set via execOptions.env in Node.js, not via export/set commands
   */
  static getClaudeCodeCommand(inputFile: string): string {
    // Allow override for testing/development
    if (process.env.CODEMIND_FORCE_CLAUDE_CLI === 'true') {
      console.log('🔧 Forcing Claude CLI usage (CODEMIND_FORCE_CLAUDE_CLI=true)');
    } else if (this.isRunningInClaudeCode()) {
      console.log('🔄 Detected CodeMind running inside Claude Code - using fallback mode');
      return this.getClaudeCodeFallbackCommand(inputFile);
    }

    const readCmd = this.getFileReadCommand();

    if (this.isWindows()) {
      // Check if we're in Git Bash environment
      const shell = process.env.SHELL || process.env.ComSpec || '';
      const isGitBash = shell.includes('bash') || !!process.env.MSYSTEM;

      if (isGitBash) {
        // In Git Bash, convert Windows path to Git Bash format
        let unixPath = inputFile.replace(/\\/g, '/');
        // Convert C:\path to /c/path format
        unixPath = unixPath.replace(/^([A-Z]):/i, (_, drive: string) => `/${drive.toLowerCase()}`);
        return `cat "${unixPath}" | claude -p`;
      } else {
        // In Windows CMD/PowerShell, use type with proper quoting
        const escapedPath = inputFile.replace(/"/g, '""'); // Escape quotes for Windows
        return `type "${escapedPath}" | claude -p`;
      }
    } else {
      // Unix environments (macOS, Linux)
      return `${readCmd} "${inputFile}" | claude -p`;
    }
  }

  /**
   * Fallback command when running inside Claude Code (to avoid recursion)
   */
  private static getClaudeCodeFallbackCommand(_inputFile: string): string {
    // Instead of calling Claude CLI, just echo a fallback message
    // This prevents the infinite hang while still allowing CodeMind to continue
    return `echo "CodeMind is running inside Claude Code environment. Fallback mode activated."`;
  }

  /**
   * Get platform-specific temporary directory
   */
  static getTempDir(): string {
    return os.tmpdir();
  }

  /**
   * Get platform-specific path separator
   */
  static getPathSeparator(): string {
    return path.sep;
  }

  /**
   * Get platform-specific environment variable handling
   */
  static getEnvVar(name: string): string | undefined {
    return process.env[name];
  }

  /**
   * Set environment variable with platform-specific handling
   */
  static setEnvVar(name: string, value: string): void {
    process.env[name] = value;
  }

  /**
   * Get platform-specific line ending
   */
  static getLineEnding(): string {
    return os.EOL;
  }

  /**
   * Get platform information for debugging
   */
  static getPlatformInfo(): {
    platform: Platform;
    arch: string;
    version: string;
    nodeVersion: string;
    isWindows: boolean;
    isUnix: boolean;
    shell: string;
    isGitBash: boolean;
    isWSL: boolean;
    fileCommand: string;
  } {
    const shell = process.env.SHELL || process.env.ComSpec || 'unknown';
    const isGitBash = shell.includes('bash') || !!process.env.MSYSTEM;
    const isWSL = !!process.env.WSL_DISTRO_NAME;

    return {
      platform: this.getPlatform(),
      arch: os.arch(),
      version: os.version?.() || 'unknown',
      nodeVersion: process.version,
      isWindows: this.isWindows(),
      isUnix: this.isUnix(),
      shell: shell,
      isGitBash,
      isWSL,
      fileCommand: this.getFileReadCommand()
    };
  }
}

export default PlatformUtils;