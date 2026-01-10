/**
 * Claude Code Conversation Manager
 * Manages conversation history and context for local Claude Code CLI interactions
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PlatformUtils } from '../../shared/platform-utils';
import { CommandProcessor } from '../../cli/managers/command-processor';

const execAsync = promisify(exec);

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: number;
}

export interface ConversationSession {
  sessionId: string;
  projectPath: string;
  messages: ConversationMessage[];
  startTime: number;
  lastActivity: number;
  totalTokens: number;
}

export class ClaudeConversationManager {
  private sessions: Map<string, ConversationSession> = new Map();
  private readonly MAX_HISTORY_LENGTH = 20; // Keep last 20 exchanges
  private readonly COMPRESSION_THRESHOLD = 15; // Compress when we have 15+ messages

  constructor() {
  }

  /**
   * Start or continue a conversation session
   */
  async startSession(projectPath: string): Promise<string> {
    const sessionId = this.generateSessionId(projectPath);

    if (!this.sessions.has(sessionId)) {
      const session: ConversationSession = {
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
  async sendMessage(
    sessionId: string,
    userMessage: string,
    additionalContext?: string
  ): Promise<{ response: string; tokensUsed: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add user message to history
    const userMsg: ConversationMessage = {
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
    const result = await CommandProcessor.executeClaudeCode(conversationContext, {
      projectPath: session.projectPath
    });

    // Handle the centralized method response format
    if (!result.success) {
      throw new Error(result.error || 'Claude Code execution failed');
    }

    // Add assistant response to history
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: result.data || '',
      timestamp: Date.now(),
      tokens: result.tokensUsed || Math.ceil((result.data || '').length / 4)
    };
    session.messages.push(assistantMsg);

    // Update session metadata
    session.lastActivity = Date.now();
    session.totalTokens += userMsg.tokens! + assistantMsg.tokens!;

    return {
      response: result.data || '',
      tokensUsed: assistantMsg.tokens!
    };
  }

  /**
   * Build conversation context with history for Claude Code
   */
  private buildConversationContext(session: ConversationSession, additionalContext?: string): string {
    const parts: string[] = [];

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
        } else {
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
  private isPermissionRequest(output: string): boolean {
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
  private extractQuestion(output: string): string {
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
   * Prompt user for permission through CodeSeeker interface
   */
  private async promptUserForPermission(question: string): Promise<string> {
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
    const readline = await import('readline');
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
  private getAutomaticResponse(question: string): string {
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
  private getSmartOptions(question: string): { label: string; value: string }[] {
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
  private async compressHistory(session: ConversationSession): Promise<void> {
    if (session.messages.length <= 10) {
      return; // Not enough to compress
    }

    try {
      // Take the oldest messages (excluding the most recent 5)
      const messagesToCompress = session.messages.slice(0, -5);
      const recentMessages = session.messages.slice(-5);

      // Build compression prompt
      const historyText = messagesToCompress.map(msg =>
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n\n');

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
      const result = await CommandProcessor.executeClaudeCode(compressionPrompt, {
        projectPath: session.projectPath
      });

      if (!result.success) {
        throw new Error(result.error || 'Compression failed');
      }

      // Replace old messages with compressed summary
      const compressedMessage: ConversationMessage = {
        role: 'assistant',
        content: `[COMPRESSED HISTORY] ${result.data}`,
        timestamp: Date.now(),
        tokens: result.tokensUsed || Math.ceil((result.data || '').length / 4)
      };

      // Update session with compressed history
      session.messages = [compressedMessage, ...recentMessages];

      console.log(`📦 Compressed ${messagesToCompress.length} messages into summary`);

    } catch (error) {
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
  private generateSessionId(projectPath: string): string {
    const projectName = path.basename(projectPath);
    const timestamp = Date.now();
    return `${projectName}_${timestamp}`;
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * End a session and clean up resources
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      console.log(`🔚 Session ended: ${sessionId}`);
    }
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > maxAgeMs) {
        this.sessions.delete(sessionId);
        console.log(`🧹 Cleaned up old session: ${sessionId}`);
      }
    }
  }
}

export default ClaudeConversationManager;