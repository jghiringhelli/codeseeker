"use strict";
/**
 * Claude Code Executor Service
 * Single Responsibility: Handle all Claude Code CLI execution with consistent error handling
 * Dependency Inversion: Abstract interface for Claude Code interactions
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
exports.ClaudeCodeExecutor = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const platform_utils_1 = require("../../../shared/platform-utils");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ClaudeCodeExecutor {
    static DEFAULT_TIMEOUT = 120000; // 2 minutes
    static DEFAULT_MAX_TOKENS = 8000;
    /**
     * Execute Claude Code CLI with the provided prompt and options
     * All Claude Code interactions should go through this method
     */
    static async execute(prompt, options = {}) {
        try {
            console.log(`🤖 Processing with Claude Code...`);
            // Set defaults
            const timeout = options.timeout || this.DEFAULT_TIMEOUT;
            const maxTokens = options.maxTokens || this.DEFAULT_MAX_TOKENS;
            // Create temporary input file
            const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
            const tmpDir = platform_utils_1.PlatformUtils.getTempDir();
            const inputFile = path.join(tmpDir, `claude-prompt-${randomBytes(8).toString('hex')}.txt`);
            // Convert to Windows path for PowerShell compatibility
            const windowsInputFile = platform_utils_1.PlatformUtils.isWindows() ? inputFile.replace(/\//g, '\\') : inputFile;
            // Write prompt to temp file
            await fs.writeFile(inputFile, prompt, 'utf8');
            try {
                // Build command arguments - remove --print to allow interactive mode
                const args = [];
                if (options.outputFormat === 'json') {
                    args.push('--output-format', 'json');
                }
                if (options.model) {
                    args.push('--model', options.model);
                }
                if (options.systemPrompt) {
                    args.push('--system-prompt', options.systemPrompt);
                }
                // Use PlatformUtils for proper command generation
                const primaryCommand = platform_utils_1.PlatformUtils.getClaudeCodeCommand(inputFile);
                const commands = [primaryCommand];
                let lastError;
                for (const command of commands) {
                    try {
                        // Only show debug info in verbose mode
                        if (process.env.CODEMIND_DEBUG) {
                            console.log(`🔧 Trying: ${command.split('|')[0].trim()}...`);
                            console.log(`📁 File exists: ${await fs.access(inputFile).then(() => true).catch(() => false)}`);
                            console.log(`📄 File size: ${(await fs.stat(inputFile).catch(() => ({ size: 0 }))).size} bytes`);
                        }
                        // Use platform-specific execution options
                        const baseOptions = {
                            timeout,
                            env: { ...process.env },
                            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                            encoding: 'utf8'
                        };
                        // Set working directory if provided
                        if (options.projectPath) {
                            baseOptions.cwd = options.projectPath;
                        }
                        const execOptions = platform_utils_1.PlatformUtils.getExecOptions(baseOptions);
                        const { stdout, stderr } = await execAsync(command, execOptions);
                        // Check for errors but allow informational messages
                        if (stderr && (stderr.includes('Error:') || stderr.includes('Failed:'))) {
                            throw new Error(`Claude CLI error: ${stderr}`);
                        }
                        if (stdout && String(stdout).trim().length > 0) {
                            const responseData = String(stdout).trim();
                            const tokensUsed = Math.ceil(responseData.length / 4); // Rough token estimate
                            console.log(`✅ Claude Code response received`);
                            return {
                                success: true,
                                data: responseData,
                                tokensUsed
                            };
                        }
                        throw new Error('Empty response from Claude Code');
                    }
                    catch (error) {
                        lastError = error;
                        // Only show detailed error info in debug mode
                        if (process.env.CODEMIND_DEBUG) {
                            console.log(`⚠️ Command failed: ${error.message || error}`);
                            console.log(`   Full command: ${command}`);
                        }
                        continue;
                    }
                }
                // If all commands failed, throw the last error
                throw lastError || new Error('All Claude Code command formats failed');
            }
            finally {
                // Clean up temp file
                try {
                    await fs.unlink(inputFile);
                }
                catch {
                    // Ignore cleanup errors
                }
            }
        }
        catch (error) {
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
    static extractAssumptions(responseData) {
        const assumptions = [];
        try {
            if (responseData && typeof responseData === 'object') {
                if (responseData.assumptions && Array.isArray(responseData.assumptions)) {
                    assumptions.push(...responseData.assumptions);
                }
            }
            else if (typeof responseData === 'string') {
                // Try to parse JSON from string response
                const jsonMatch = responseData.match(/\{[\s\S]*"assumptions"[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.assumptions && Array.isArray(parsed.assumptions)) {
                        assumptions.push(...parsed.assumptions);
                    }
                }
            }
        }
        catch (error) {
            // Silent fail - assumptions extraction is optional
        }
        return assumptions;
    }
    /**
     * Estimate token usage for a given text
     */
    static estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
}
exports.ClaudeCodeExecutor = ClaudeCodeExecutor;
//# sourceMappingURL=claude-code-executor.js.map