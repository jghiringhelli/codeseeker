"use strict";
/**
 * Command Processor
 * Single Responsibility: Coordinate command routing and provide static Claude Code execution
 * Dependency Inversion: Uses command router and handlers for actual processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandProcessor = void 0;
const command_router_1 = require("../commands/command-router");
const claude_code_executor_1 = require("../services/claude/claude-code-executor");
const theme_1 = require("../ui/theme");
class CommandProcessor {
    router;
    context;
    transparentMode = false;
    constructor(context) {
        this.context = context;
        this.router = new command_router_1.CommandRouter(context);
    }
    /**
     * Set the readline interface for user interaction
     */
    setReadlineInterface(rl) {
        this.router.setReadlineInterface(rl);
    }
    /**
     * Set transparent mode (skip interactive prompts)
     */
    setTransparentMode(enabled) {
        this.transparentMode = enabled;
        this.router.setTransparentMode(enabled);
    }
    /**
     * Set history callbacks (for /history command)
     */
    setHistoryCallbacks(callbacks) {
        this.router.setHistoryCallbacks(callbacks);
    }
    /**
     * Process user input and route to appropriate handler
     */
    async processInput(input) {
        return await this.router.processInput(input);
    }
    /**
     * Centralized Claude Code CLI execution method
     * All Claude Code interactions should go through this method
     * STATIC: Can be used without instantiating CommandProcessor
     */
    static async executeClaudeCode(prompt, options = {}) {
        const result = await claude_code_executor_1.ClaudeCodeExecutor.execute(prompt, options);
        // Check for assumptions in response
        if (result.success && result.data) {
            const assumptions = claude_code_executor_1.ClaudeCodeExecutor.extractAssumptions(result.data);
            if (assumptions.length > 0) {
                console.log(theme_1.Theme.colors.info('\n💭 Claude Code reported these assumptions:'));
                assumptions.forEach((assumption, index) => {
                    console.log(theme_1.Theme.colors.muted(`   ${index + 1}. ${assumption}`));
                });
            }
        }
        return result;
    }
    /**
     * Get available commands from router
     */
    getAvailableCommands() {
        return this.router.getAvailableCommands();
    }
}
exports.CommandProcessor = CommandProcessor;
//# sourceMappingURL=command-processor.js.map