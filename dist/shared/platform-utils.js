"use strict";
/**
 * Cross-platform utilities for CodeMind
 * Handles differences between Windows, macOS, and Linux
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformUtils = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
class PlatformUtils {
    static _platform = null;
    /**
     * Get the current platform
     */
    static getPlatform() {
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
    static isWindows() {
        return this.getPlatform() === 'windows';
    }
    /**
     * Check if running on macOS
     */
    static isMacOS() {
        return this.getPlatform() === 'macos';
    }
    /**
     * Check if running on Linux
     */
    static isLinux() {
        return this.getPlatform() === 'linux';
    }
    /**
     * Check if running on Unix-like system (macOS or Linux)
     */
    static isUnix() {
        const platform = this.getPlatform();
        return platform === 'macos' || platform === 'linux';
    }
    /**
     * Detect if running inside Claude Code environment
     */
    static isRunningInClaudeCode() {
        // Check for various Claude Code environment indicators
        return !!(process.env.CLAUDE_CLI_SESSION ||
            process.env.ANTHROPIC_CLI_SESSION ||
            process.env.CLAUDE_CODE_SESSION ||
            process.env.CLAUDECODE ||
            process.env.CLAUDE_CODE_SSE_PORT ||
            process.env.CLAUDE_CODE_ENTRYPOINT ||
            // Check if parent process might be Claude Code
            process.env._ && process.env._.includes('claude') ||
            // Check process title for Claude
            process.title && process.title.includes('claude'));
    }
    /**
     * Get the appropriate file reading command for the platform
     */
    static getFileReadCommand() {
        // For Windows, even in Git Bash, prefer a more compatible approach
        if (this.isWindows()) {
            // In Git Bash, 'cat' should be available, but let's be explicit
            // Try cat first (works in Git Bash), fallback to type (native Windows)
            return 'cat';
        }
        else {
            // True Unix environments (macOS, Linux)
            return 'cat';
        }
    }
    /**
     * Get the appropriate shell for exec commands
     */
    static getShell() {
        if (this.isWindows()) {
            return 'cmd.exe';
        }
        else {
            return '/bin/bash';
        }
    }
    /**
     * Get platform-specific exec options
     */
    static getExecOptions(baseOptions = {}) {
        const options = {
            ...baseOptions,
            encoding: 'utf8' // Ensure string output, not Buffer
        };
        // For Windows environments, detect the actual shell being used
        if (this.isWindows()) {
            options.windowsHide = true;
            // Check if we're in Git Bash or WSL
            const shell = process.env.SHELL || process.env.ComSpec || '';
            const isGitBash = shell.includes('bash') || !!process.env.MSYSTEM;
            const isWSL = !!process.env.WSL_DISTRO_NAME;
            if (isGitBash || isWSL) {
                // In Git Bash or WSL, use bash explicitly
                options.shell = 'bash';
            }
            else {
                // In Windows CMD or PowerShell, let Node.js handle it
                options.shell = true;
            }
        }
        else {
            // True Unix environments (macOS, Linux)
            options.shell = '/bin/bash';
        }
        return options;
    }
    /**
     * Get the appropriate pipe command for Claude Code execution
     * Note: Environment variables should be set via execOptions.env in Node.js, not via export/set commands
     */
    static getClaudeCodeCommand(inputFile) {
        // If running inside Claude Code, use fallback approach
        if (this.isRunningInClaudeCode()) {
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
                unixPath = unixPath.replace(/^([A-Z]):/i, (match, drive) => `/${drive.toLowerCase()}`);
                return `${readCmd} "${unixPath}" | claude --print`;
            }
            else {
                // In Windows CMD/PowerShell, use Windows path format
                return `${readCmd} "${inputFile}" | claude --print`;
            }
        }
        else {
            // Unix environments (macOS, Linux)
            return `${readCmd} "${inputFile}" | claude --print`;
        }
    }
    /**
     * Fallback command when running inside Claude Code (to avoid recursion)
     */
    static getClaudeCodeFallbackCommand(inputFile) {
        // Instead of calling Claude CLI, just echo a fallback message
        // This prevents the infinite hang while still allowing CodeMind to continue
        return `echo "CodeMind is running inside Claude Code environment. Fallback mode activated."`;
    }
    /**
     * Get platform-specific temporary directory
     */
    static getTempDir() {
        return os.tmpdir();
    }
    /**
     * Get platform-specific path separator
     */
    static getPathSeparator() {
        return path.sep;
    }
    /**
     * Get platform-specific environment variable handling
     */
    static getEnvVar(name) {
        return process.env[name];
    }
    /**
     * Set environment variable with platform-specific handling
     */
    static setEnvVar(name, value) {
        process.env[name] = value;
    }
    /**
     * Get platform-specific line ending
     */
    static getLineEnding() {
        return os.EOL;
    }
    /**
     * Get platform information for debugging
     */
    static getPlatformInfo() {
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
exports.PlatformUtils = PlatformUtils;
exports.default = PlatformUtils;
//# sourceMappingURL=platform-utils.js.map