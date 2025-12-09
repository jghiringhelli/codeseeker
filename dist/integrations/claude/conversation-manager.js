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
const command_processor_1 = require("../../cli/managers/command-processor");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ClaudeConversationManager {
    sessions = new Map();
    MAX_HISTORY_LENGTH = 20; // Keep last 20 exchanges
    COMPRESSION_THRESHOLD = 15; // Compress when we have 15+ messages
    constructor() {
    }
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
        // Execute Claude Code with full context using centralized method
        const result = await command_processor_1.CommandProcessor.executeClaudeCode(conversationContext, {
            projectPath: session.projectPath
        });
        // Handle the centralized method response format
        if (!result.success) {
            throw new Error(result.error || 'Claude Code execution failed');
        }
        // Add assistant response to history
        const assistantMsg = {
            role: 'assistant',
            content: result.data || '',
            timestamp: Date.now(),
            tokens: result.tokensUsed || Math.ceil((result.data || '').length / 4)
        };
        session.messages.push(assistantMsg);
        // Update session metadata
        session.lastActivity = Date.now();
        session.totalTokens += userMsg.tokens + assistantMsg.tokens;
        return {
            response: result.data || '',
            tokensUsed: assistantMsg.tokens
        };
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
     * Check if Claude Code output contains a permission request
     */
    isPermissionRequest(output) {
        const permissionPatterns = [
            /would you like me to/i,
            /do you want me to/i,
            /should I/i,
            /can I/i,
            /proceed with/i,
            /continue with/i,
            /\[y\/n\]/i,
            /\(y\/n\)/i,
            /yes\/no/i,
            /allow/i,
            /permission/i,
            /\?[\s]*$/m // Lines ending with question marks
        ];
        return permissionPatterns.some(pattern => pattern.test(output));
    }
    /**
     * Extract the question/permission request from Claude Code output
     */
    extractQuestion(output) {
        // Try to find the last question in the output
        const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        // Find lines with question marks or permission indicators
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (line.includes('?') || this.isPermissionRequest(line)) {
                return line;
            }
        }
        // Fallback to last few lines
        return lines.slice(-2).join(' ');
    }
    /**
     * Prompt user for permission through CodeMind interface
     */
    async promptUserForPermission(question) {
        console.log(`\n🤖 Claude Code is asking for permission:`);
        console.log(`❓ ${question}`);
        // Check if we're in command mode (non-interactive)
        const isCommandMode = process.argv.includes('-c') || process.argv.includes('--command');
        if (isCommandMode) {
            // In command mode, provide sensible automatic responses
            const autoResponse = this.getAutomaticResponse(question);
            console.log(`🤖 Auto-responding in command mode: ${autoResponse}`);
            return autoResponse;
        }
        // Interactive mode - prompt user
        const readline = await Promise.resolve().then(() => __importStar(require('readline')));
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise((resolve) => {
            // Check for common patterns and provide smart defaults
            const smartOptions = this.getSmartOptions(question);
            if (smartOptions.length > 0) {
                console.log(`\n📋 Quick options:`);
                smartOptions.forEach((option, index) => {
                    console.log(`  ${index + 1}. ${option.label}`);
                });
                console.log(`  ${smartOptions.length + 1}. Custom response`);
            }
            const promptText = smartOptions.length > 0
                ? `\n👤 Your choice [1-${smartOptions.length + 1}] or type your response: `
                : `\n👤 Your response: `;
            rl.question(promptText, (answer) => {
                rl.close();
                // Handle numbered choices
                if (smartOptions.length > 0) {
                    const choice = parseInt(answer.trim());
                    if (choice >= 1 && choice <= smartOptions.length) {
                        console.log(`✅ Selected: ${smartOptions[choice - 1].label}`);
                        resolve(smartOptions[choice - 1].value);
                        return;
                    }
                }
                // Use custom response
                const response = answer.trim() || 'yes';
                console.log(`✅ Response: ${response}`);
                resolve(response);
            });
        });
    }
    /**
     * Get automatic response for command mode (non-interactive)
     */
    getAutomaticResponse(question) {
        const lowerQuestion = question.toLowerCase();
        // For destructive operations, be more conservative
        if (lowerQuestion.includes('delete') || lowerQuestion.includes('remove')) {
            return 'show details'; // Be cautious
        }
        // For modifications, proceed but be selective
        if (lowerQuestion.includes('modify') || lowerQuestion.includes('change') || lowerQuestion.includes('edit')) {
            return 'yes'; // Allow modifications in analysis/improvement tasks
        }
        // For creation, generally allow
        if (lowerQuestion.includes('create') || lowerQuestion.includes('add')) {
            return 'yes';
        }
        // Default to yes for most permission requests in analysis mode
        return 'yes';
    }
    /**
     * Get smart response options based on the question
     */
    getSmartOptions(question) {
        const lowerQuestion = question.toLowerCase();
        if (lowerQuestion.includes('modify') || lowerQuestion.includes('change') || lowerQuestion.includes('edit')) {
            return [
                { label: 'Yes, proceed with modifications', value: 'yes' },
                { label: 'Yes, and apply to all similar files', value: 'yes to all' },
                { label: 'No, skip this modification', value: 'no' },
                { label: 'Show me what will be changed first', value: 'show changes' }
            ];
        }
        if (lowerQuestion.includes('create') || lowerQuestion.includes('add')) {
            return [
                { label: 'Yes, create it', value: 'yes' },
                { label: 'Yes, and create similar items automatically', value: 'yes to all' },
                { label: 'No, skip creation', value: 'no' }
            ];
        }
        if (lowerQuestion.includes('delete') || lowerQuestion.includes('remove')) {
            return [
                { label: 'Yes, delete it', value: 'yes' },
                { label: 'No, keep it', value: 'no' },
                { label: 'Show me what will be deleted', value: 'show details' }
            ];
        }
        // Default options for any permission request
        return [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
            { label: 'Yes to all similar requests', value: 'yes to all' }
        ];
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
            // Use Claude Code to compress via centralized method
            const result = await command_processor_1.CommandProcessor.executeClaudeCode(compressionPrompt, {
                projectPath: session.projectPath
            });
            if (!result.success) {
                throw new Error(result.error || 'Compression failed');
            }
            // Replace old messages with compressed summary
            const compressedMessage = {
                role: 'assistant',
                content: `[COMPRESSED HISTORY] ${result.data}`,
                timestamp: Date.now(),
                tokens: result.tokensUsed || Math.ceil((result.data || '').length / 4)
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
     * End a session and clean up resources
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.delete(sessionId);
            console.log(`🔚 Session ended: ${sessionId}`);
        }
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
//# sourceMappingURL=conversation-manager.js.map