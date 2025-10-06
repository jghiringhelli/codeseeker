"use strict";
/**
 * Claude Code Output Forwarder
 * Captures and forwards Claude Code output in real-time with distinctive styling
 * Mirrors Claude Code's prompt-level output within CodeMind CLI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeForwarder = void 0;
const events_1 = require("events");
const theme_1 = require("../ui/theme");
const child_process_1 = require("child_process");
class ClaudeCodeForwarder extends events_1.EventEmitter {
    claudeProcess = null;
    outputBuffer = [];
    options;
    constructor(options = {}) {
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
    startForwarding(process) {
        this.claudeProcess = process;
        // Forward stdout with Claude Code styling
        if (process.stdout) {
            process.stdout.on('data', (data) => {
                this.handleClaudeOutput(data.toString(), 'stdout');
            });
        }
        // Forward stderr with Claude Code styling
        if (process.stderr) {
            process.stderr.on('data', (data) => {
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
    handleClaudeOutput(data, stream) {
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
    formatClaudeOutput(line, stream) {
        const prefix = this.options.prefixLines ? '🤖 ' : '';
        const timestamp = this.options.showTimestamps
            ? `[${new Date().toLocaleTimeString()}] `
            : '';
        // Different styling for different types of Claude output
        if (stream === 'stderr') {
            return theme_1.Theme.colors.error(`${prefix}${timestamp}${line}`);
        }
        // Detect different types of Claude Code output and style accordingly
        if (line.includes('✓') || line.includes('success')) {
            return theme_1.Theme.colors.claudeCode(`${prefix}${timestamp}`) + theme_1.Theme.colors.success(line);
        }
        else if (line.includes('⚠') || line.includes('warning')) {
            return theme_1.Theme.colors.claudeCode(`${prefix}${timestamp}`) + theme_1.Theme.colors.warning(line);
        }
        else if (line.includes('❌') || line.includes('error')) {
            return theme_1.Theme.colors.claudeCode(`${prefix}${timestamp}`) + theme_1.Theme.colors.error(line);
        }
        else if (line.includes('🔍') || line.includes('analyzing') || line.includes('processing')) {
            return theme_1.Theme.colors.claudeCode(`${prefix}${timestamp}`) + theme_1.Theme.colors.claudeCodeMuted(line);
        }
        else {
            // Default Claude Code output styling
            return theme_1.Theme.colors.claudeCode(`${prefix}${timestamp}${line}`);
        }
    }
    /**
     * Handle Claude Code process close
     */
    handleClaudeClose(code) {
        const message = code === 0
            ? '✅ Claude Code process completed successfully'
            : `⚠️  Claude Code process exited with code: ${code}`;
        console.log(theme_1.Theme.colors.claudeCodeMuted(`\n🤖 ${message}`));
        this.emit('claudeClose', {
            code,
            outputBuffer: this.outputBuffer.slice()
        });
    }
    /**
     * Handle Claude Code process error
     */
    handleClaudeError(error) {
        console.log(theme_1.Theme.colors.error(`\n🤖 Claude Code Error: ${error.message}`));
        this.emit('claudeError', error);
    }
    /**
     * Send input to Claude Code process
     */
    sendToClaudeCode(input) {
        if (this.claudeProcess && this.claudeProcess.stdin) {
            try {
                this.claudeProcess.stdin.write(input + '\n');
                // Show what we sent in a muted style
                console.log(theme_1.Theme.colors.claudeCodeMuted(`🤖 → ${input}`));
                return true;
            }
            catch (error) {
                console.log(theme_1.Theme.colors.error(`Failed to send input to Claude Code: ${error.message}`));
                return false;
            }
        }
        return false;
    }
    /**
     * Interrupt Claude Code process (send escape/interrupt signal)
     */
    interruptClaudeCode() {
        if (this.claudeProcess) {
            // Try to send escape key first (graceful)
            if (this.claudeProcess.stdin) {
                this.claudeProcess.stdin.write('\x1b'); // ESC key
                console.log(theme_1.Theme.colors.interrupt('🤖 ⏸️  Sending interrupt to Claude Code...'));
            }
            // If process doesn't respond, force kill after timeout
            setTimeout(() => {
                if (this.claudeProcess && !this.claudeProcess.killed) {
                    console.log(theme_1.Theme.colors.interrupt('🤖 🛑 Force terminating Claude Code process...'));
                    this.claudeProcess.kill('SIGTERM');
                }
            }, 5000);
        }
    }
    /**
     * Execute a Claude Code command with real-time output forwarding
     */
    async executeClaudeCodeCommand(command, args = [], workingDirectory) {
        return new Promise((resolve, reject) => {
            console.log(theme_1.Theme.colors.claudeCode(`\n🤖 Executing: ${command} ${args.join(' ')}`));
            const childProcess = (0, child_process_1.spawn)(command, args, {
                cwd: workingDirectory || process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe']
            });
            this.startForwarding(childProcess);
            const results = [];
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
    getBufferedOutput() {
        return this.outputBuffer.slice();
    }
    /**
     * Clear output buffer
     */
    clearBuffer() {
        this.outputBuffer = [];
    }
    /**
     * Stop forwarding and cleanup
     */
    stopForwarding() {
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
exports.ClaudeCodeForwarder = ClaudeCodeForwarder;
exports.default = ClaudeCodeForwarder;
//# sourceMappingURL=claude-code-forwarder.js.map