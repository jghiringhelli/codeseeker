"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeInterceptor = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
class ClaudeCodeInterceptor extends events_1.EventEmitter {
    options;
    activeProcess;
    commandHistory = [];
    constructor(options) {
        super();
        this.options = options;
    }
    /**
     * Initialize the interceptor
     */
    async initialize(config) {
        // Check if Claude Code is available
        const available = await ClaudeCodeInterceptor.isAvailable();
        if (!available) {
            throw new Error('Claude Code CLI is not available. Please install it first.');
        }
    }
    /**
     * Start Claude Code in the background
     */
    async startClaudeCode(options) {
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
    async intercept(command, args = []) {
        const interceptedCommand = {
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
    async enhanceArguments(command, args) {
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
    executeCommand(command, args) {
        return new Promise((resolve) => {
            const claudeCommand = 'claude';
            const fullArgs = [command, ...args];
            if (this.options.logLevel === 'verbose') {
                console.log(`🔧 Executing: ${claudeCommand} ${fullArgs.join(' ')}`);
            }
            this.activeProcess = (0, child_process_1.spawn)(claudeCommand, fullArgs, {
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
                const result = {
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
                const result = {
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
    async generateEnhancedContext(query, projectPath) {
        // This would integrate with the tool selection system
        // For now, return a simple enhanced context
        return `
Project: ${projectPath}
Query: ${query}
Enhanced Context: This query has been enhanced with CodeMind's intelligent tool selection.
    `.trim();
    }
    /**
     * Stop any active process
     */
    stop() {
        if (this.activeProcess) {
            this.activeProcess.kill();
            this.activeProcess = undefined;
        }
    }
    /**
     * Get command history
     */
    getHistory() {
        return [...this.commandHistory];
    }
    /**
     * Clear command history
     */
    clearHistory() {
        this.commandHistory = [];
    }
    /**
     * Check if Claude Code CLI is available
     */
    static async isAvailable() {
        return new Promise((resolve) => {
            const process = (0, child_process_1.spawn)('claude', ['--version'], {
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
exports.ClaudeCodeInterceptor = ClaudeCodeInterceptor;
exports.default = ClaudeCodeInterceptor;
//# sourceMappingURL=claude-code-interceptor.js.map