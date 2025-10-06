"use strict";
/**
 * Claude Code Conversation Manager
 * Manages conversation history and context for local Claude Code CLI interactions
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
exports.ClaudeConversationManager = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const platform_utils_1 = require("../shared/platform-utils");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ClaudeConversationManager {
    sessions = new Map();
    MAX_HISTORY_LENGTH = 20; // Keep last 20 exchanges
    COMPRESSION_THRESHOLD = 15; // Compress when we have 15+ messages
    /**
     * Start or continue a conversation session
     */
    async startSession(projectPath) {
        const sessionId = this.generateSessionId(projectPath);
        if (!this.sessions.has(sessionId)) {
            const session = {
                sessionId,
                projectPath,
                messages: [],
                startTime: Date.now(),
                lastActivity: Date.now(),
                totalTokens: 0
            };
            this.sessions.set(sessionId, session);
        }
        return sessionId;
    }
    /**
     * Send a message to Claude Code CLI and get response with conversation context
     */
    async sendMessage(sessionId, userMessage, additionalContext) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        // Add user message to history
        const userMsg = {
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
            tokens: Math.ceil(userMessage.length / 4)
        };
        session.messages.push(userMsg);
        // Compress history if needed
        if (session.messages.length > this.COMPRESSION_THRESHOLD) {
            await this.compressHistory(session);
        }
        // Build conversation context
        const conversationContext = this.buildConversationContext(session, additionalContext);
        // Execute Claude Code with full context
        const result = await this.executeClaudeCode(conversationContext, session.projectPath);
        // Add assistant response to history
        const assistantMsg = {
            role: 'assistant',
            content: result.response,
            timestamp: Date.now(),
            tokens: result.tokensUsed
        };
        session.messages.push(assistantMsg);
        // Update session metadata
        session.lastActivity = Date.now();
        session.totalTokens += userMsg.tokens + result.tokensUsed;
        return result;
    }
    /**
     * Build conversation context with history for Claude Code
     */
    buildConversationContext(session, additionalContext) {
        const parts = [];
        // Add project context if provided
        if (additionalContext) {
            parts.push(`# Project Context\n${additionalContext}\n`);
        }
        // Add conversation history if we have any
        if (session.messages.length > 0) {
            parts.push(`# Conversation History\n`);
            // Include recent conversation history
            const recentMessages = session.messages.slice(-10); // Last 5 exchanges (10 messages)
            for (const msg of recentMessages) {
                if (msg.role === 'user') {
                    parts.push(`User: ${msg.content}\n`);
                }
                else {
                    parts.push(`Assistant: ${msg.content}\n`);
                }
            }
            parts.push('');
        }
        // Add the current request
        const latestUserMessage = session.messages[session.messages.length - 1];
        if (latestUserMessage && latestUserMessage.role === 'user') {
            parts.push(`# Current Request\n${latestUserMessage.content}`);
        }
        return parts.join('\n');
    }
    /**
     * Execute Claude Code CLI with the conversation context
     */
    async executeClaudeCode(prompt, projectPath) {
        try {
            // Create temporary input file
            const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
            const tmpDir = platform_utils_1.PlatformUtils.getTempDir();
            const inputFile = path.join(tmpDir, `claude-conversation-${randomBytes(8).toString('hex')}.txt`);
            // Write prompt to temp file
            await fs.writeFile(inputFile, prompt, 'utf8');
            // Try multiple authentication strategies in order of preference
            const strategies = [
                () => this.executeWithCleanEnvironment(inputFile, projectPath),
                () => this.executeWithLongLivedToken(inputFile, projectPath),
                () => this.executeWithDirectAuth(inputFile, projectPath)
            ];
            let lastError = null;
            for (let i = 0; i < strategies.length; i++) {
                try {
                    console.log(`🔄 Trying authentication strategy ${i + 1}/${strategies.length}`);
                    const result = await strategies[i]();
                    // Clean up temp file on success
                    try {
                        await fs.unlink(inputFile);
                    }
                    catch {
                        // Ignore cleanup errors
                    }
                    return result;
                }
                catch (error) {
                    lastError = error;
                    console.log(`❌ Strategy ${i + 1} failed: ${error}`);
                    continue;
                }
            }
            // Clean up temp file if all strategies failed
            try {
                await fs.unlink(inputFile);
            }
            catch {
                // Ignore cleanup errors
            }
            // If all strategies failed, return fallback response
            const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
            console.error(`❌ All Claude Code authentication strategies failed. Last error: ${errorMessage}`);
            return {
                response: `I apologize, but I'm having trouble processing your request right now. All Claude CLI authentication strategies failed. Please try running 'claude setup-token' in your terminal to establish authentication, or check that Claude CLI is properly configured.`,
                tokensUsed: 0
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Claude Code execution setup failed: ${errorMessage}`);
            return {
                response: `I apologize, but I'm having trouble processing your request right now. The Claude Code CLI setup encountered an issue: ${errorMessage}`,
                tokensUsed: 0
            };
        }
    }
    /**
     * Strategy 1: Execute with completely clean environment (no Claude Code vars)
     */
    async executeWithCleanEnvironment(inputFile, projectPath) {
        console.log(`🧪 Strategy 1: Clean environment (isolated from Claude Code session)`);
        const command = platform_utils_1.PlatformUtils.getClaudeCodeCommand(inputFile);
        const homeDir = process.env.HOME || process.env.USERPROFILE || projectPath;
        // Create completely clean environment, removing ALL Claude Code related variables
        const cleanEnv = {
            PATH: process.env.PATH,
            HOME: process.env.HOME || process.env.USERPROFILE,
            USERPROFILE: process.env.USERPROFILE,
            USER: process.env.USER || process.env.USERNAME,
            USERNAME: process.env.USERNAME,
            FORCE_COLOR: '0'
        };
        // Explicitly remove any Claude Code environment variables
        const claudeVarsToRemove = [
            'CLAUDECODE', 'CLAUDE_CODE_SSE_PORT', 'CLAUDE_CODE_ENTRYPOINT',
            'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'CLAUDE_MODEL'
        ];
        claudeVarsToRemove.forEach(varName => {
            if (varName in cleanEnv) {
                delete cleanEnv[varName];
            }
        });
        const execOptions = platform_utils_1.PlatformUtils.getExecOptions({
            cwd: homeDir,
            timeout: 300000,
            maxBuffer: 10 * 1024 * 1024,
            encoding: 'utf8',
            env: cleanEnv
        });
        console.log(`🤖 Executing with clean environment: ${command}`);
        console.log(`🏠 Working directory: ${homeDir}`);
        const execResult = await execAsync(command, execOptions);
        const response = String(execResult.stdout).trim();
        const tokensUsed = Math.ceil((response.length) / 4);
        if (execResult.stderr && String(execResult.stderr).trim()) {
            console.warn(`⚠️ Claude Code stderr: ${String(execResult.stderr).trim()}`);
        }
        // Handle fallback mode response
        if (response.includes('Fallback mode activated')) {
            const fallbackResponse = `I understand you're trying to use CodeMind within Claude Code. Since this creates a recursive situation, I'm running in fallback mode. I can help you with:

• Code analysis and suggestions
• Project structure recommendations
• Best practices and patterns
• Technical decision guidance

However, I won't be able to execute actual Claude CLI commands. How can I assist you with your ${path.basename(projectPath)} project?`;
            console.log(`🔄 Using fallback response for recursive environment`);
            return { response: fallbackResponse, tokensUsed: Math.ceil(fallbackResponse.length / 4) };
        }
        if (!response || response.includes('Invalid API key')) {
            throw new Error('Clean environment authentication failed');
        }
        console.log(`✅ Strategy 1 SUCCESS: Clean environment worked`);
        return { response, tokensUsed };
    }
    /**
     * Strategy 2: Try using long-lived token authentication
     */
    async executeWithLongLivedToken(inputFile, projectPath) {
        console.log(`🧪 Strategy 2: Long-lived token authentication`);
        // First, try to set up a long-lived token if one doesn't exist
        try {
            const homeDir = process.env.HOME || process.env.USERPROFILE || projectPath;
            const cleanEnv = {
                PATH: process.env.PATH,
                HOME: homeDir,
                USERPROFILE: process.env.USERPROFILE,
                FORCE_COLOR: '0'
            };
            const setupOptions = platform_utils_1.PlatformUtils.getExecOptions({
                cwd: homeDir,
                timeout: 60000, // 1 minute for token setup
                env: cleanEnv
            });
            // Check if token setup is needed (this will fail gracefully if token exists)
            console.log(`🔑 Checking token authentication...`);
            // Try the actual command with token auth
            const command = platform_utils_1.PlatformUtils.getClaudeCodeCommand(inputFile);
            const execOptions = platform_utils_1.PlatformUtils.getExecOptions({
                cwd: homeDir,
                timeout: 300000,
                maxBuffer: 10 * 1024 * 1024,
                encoding: 'utf8',
                env: cleanEnv
            });
            const execResult = await execAsync(command, execOptions);
            const response = String(execResult.stdout).trim();
            const tokensUsed = Math.ceil((response.length) / 4);
            if (execResult.stderr && String(execResult.stderr).trim()) {
                console.warn(`⚠️ Claude Code stderr: ${String(execResult.stderr).trim()}`);
            }
            if (!response || response.includes('Invalid API key')) {
                throw new Error('Token authentication failed');
            }
            console.log(`✅ Strategy 2 SUCCESS: Token authentication worked`);
            return { response, tokensUsed };
        }
        catch (error) {
            console.log(`❌ Strategy 2 failed: ${error}`);
            throw error;
        }
    }
    /**
     * Strategy 3: Try direct authentication with existing credentials
     */
    async executeWithDirectAuth(inputFile, projectPath) {
        console.log(`🧪 Strategy 3: Direct credential authentication`);
        const command = platform_utils_1.PlatformUtils.getClaudeCodeCommand(inputFile);
        const homeDir = process.env.HOME || process.env.USERPROFILE || projectPath;
        // Use minimal environment with explicit credential paths
        const execOptions = platform_utils_1.PlatformUtils.getExecOptions({
            cwd: homeDir,
            timeout: 300000,
            maxBuffer: 10 * 1024 * 1024,
            encoding: 'utf8',
            env: {
                PATH: process.env.PATH,
                HOME: homeDir,
                USERPROFILE: process.env.USERPROFILE,
                USER: process.env.USER || process.env.USERNAME,
                USERNAME: process.env.USERNAME,
                FORCE_COLOR: '0',
                // Explicitly point to credential file location
                CLAUDE_CONFIG_DIR: path.join(homeDir, '.claude')
            }
        });
        console.log(`🤖 Executing with direct auth: ${command}`);
        console.log(`🏠 Credential path: ${execOptions.env.CLAUDE_CONFIG_DIR}`);
        const execResult = await execAsync(command, execOptions);
        const response = String(execResult.stdout).trim();
        const tokensUsed = Math.ceil((response.length) / 4);
        if (execResult.stderr && String(execResult.stderr).trim()) {
            console.warn(`⚠️ Claude Code stderr: ${String(execResult.stderr).trim()}`);
        }
        if (!response || response.includes('Invalid API key')) {
            throw new Error('Direct authentication failed');
        }
        console.log(`✅ Strategy 3 SUCCESS: Direct authentication worked`);
        return { response, tokensUsed };
    }
    /**
     * Compress conversation history using Claude Code itself
     */
    async compressHistory(session) {
        if (session.messages.length <= 10) {
            return; // Not enough to compress
        }
        try {
            // Take the oldest messages (excluding the most recent 5)
            const messagesToCompress = session.messages.slice(0, -5);
            const recentMessages = session.messages.slice(-5);
            // Build compression prompt
            const historyText = messagesToCompress.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');
            const compressionPrompt = `
Please summarize this conversation history into a concise summary that preserves:
1. Key decisions made
2. Important context established
3. Files or code discussed
4. Any ongoing tasks or threads

Conversation to summarize:
${historyText}

Provide a summary in 2-3 paragraphs that can serve as context for future messages.
`;
            // Use Claude Code to compress
            const result = await this.executeClaudeCode(compressionPrompt, session.projectPath);
            // Replace old messages with compressed summary
            const compressedMessage = {
                role: 'assistant',
                content: `[COMPRESSED HISTORY] ${result.response}`,
                timestamp: Date.now(),
                tokens: result.tokensUsed
            };
            // Update session with compressed history
            session.messages = [compressedMessage, ...recentMessages];
            console.log(`📦 Compressed ${messagesToCompress.length} messages into summary`);
        }
        catch (error) {
            console.warn(`⚠️ History compression failed: ${error}. Keeping original history.`);
            // If compression fails, just trim to max length
            if (session.messages.length > this.MAX_HISTORY_LENGTH) {
                session.messages = session.messages.slice(-this.MAX_HISTORY_LENGTH);
            }
        }
    }
    /**
     * Generate a session ID based on project path
     */
    generateSessionId(projectPath) {
        const projectName = path.basename(projectPath);
        const timestamp = Date.now();
        return `${projectName}_${timestamp}`;
    }
    /**
     * Get session info
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Clean up old sessions
     */
    cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivity > maxAgeMs) {
                this.sessions.delete(sessionId);
                console.log(`🧹 Cleaned up old session: ${sessionId}`);
            }
        }
    }
}
exports.ClaudeConversationManager = ClaudeConversationManager;
exports.default = ClaudeConversationManager;
//# sourceMappingURL=claude-conversation-manager.js.map