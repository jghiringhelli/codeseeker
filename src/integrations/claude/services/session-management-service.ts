/**
 * Session Management Service
 * SOLID Principles: Single Responsibility - Handle session management only
 */

import { Logger } from '../../../utils/logger';
import { ClaudeConversationManager } from '../conversation-manager';
import {
  ISessionManagementService
} from '../interfaces/index';

export class SessionManagementService implements ISessionManagementService {
  private logger = Logger.getInstance();
  private conversationManager: ClaudeConversationManager;
  private activeSessions: Map<string, string> = new Map(); // projectPath -> sessionId
  private sessionTimestamps: Map<string, number> = new Map(); // sessionId -> timestamp
  private readonly SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
  private cleanupTimer?: NodeJS.Timeout;

  constructor(conversationManager?: ClaudeConversationManager) {
    this.conversationManager = conversationManager || new ClaudeConversationManager();

    // Start cleanup timer only in production (not during tests)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredSessions().catch(error => {
          this.logger.error('Failed to cleanup expired sessions:', error);
        });
      }, 30 * 60 * 1000); // Cleanup every 30 minutes
    }
  }

  /**
   * Cleanup method to stop timers and release resources
   * Should be called when shutting down the service
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.activeSessions.clear();
    this.sessionTimestamps.clear();
  }

  async getSessionForProject(projectPath: string): Promise<string> {
    try {
      // Normalize project path
      const normalizedPath = this.normalizePath(projectPath);

      let sessionId = this.activeSessions.get(normalizedPath);

      if (sessionId && this.isSessionActive(sessionId)) {
        this.updateSessionTimestamp(sessionId);
        return sessionId;
      }

      // Create new session
      sessionId = await this.startNewSession(normalizedPath);
      return sessionId;
    } catch (error) {
      this.logger.error(`Failed to get session for project ${projectPath}:`, error);
      throw error;
    }
  }

  async startNewSession(projectPath: string): Promise<string> {
    try {
      this.logger.debug(`🚀 Starting new session for project: ${projectPath}`);

      const normalizedPath = this.normalizePath(projectPath);

      // End existing session if any
      const existingSessionId = this.activeSessions.get(normalizedPath);
      if (existingSessionId) {
        await this.endSession(existingSessionId);
      }

      // Start new session
      const sessionId = await this.conversationManager.startSession(normalizedPath);

      this.activeSessions.set(normalizedPath, sessionId);
      this.sessionTimestamps.set(sessionId, Date.now());

      this.logger.info(`✅ New session started: ${sessionId} for ${normalizedPath}`);
      return sessionId;
    } catch (error) {
      this.logger.error(`Failed to start new session for ${projectPath}:`, error);
      throw error;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      this.logger.debug(`🔚 Ending session: ${sessionId}`);

      // Find and remove from active sessions
      for (const [projectPath, activeSessionId] of this.activeSessions.entries()) {
        if (activeSessionId === sessionId) {
          this.activeSessions.delete(projectPath);
          break;
        }
      }

      // Remove timestamp
      this.sessionTimestamps.delete(sessionId);

      // End conversation
      await this.conversationManager.endSession(sessionId);

      this.logger.debug(`✅ Session ended: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to end session ${sessionId}:`, error);
      throw error;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = Date.now();
      const expiredSessions: string[] = [];

      // Find expired sessions
      for (const [sessionId, timestamp] of this.sessionTimestamps.entries()) {
        if (now - timestamp > this.SESSION_TIMEOUT) {
          expiredSessions.push(sessionId);
        }
      }

      if (expiredSessions.length > 0) {
        this.logger.info(`🧹 Cleaning up ${expiredSessions.length} expired sessions`);

        // End expired sessions
        for (const sessionId of expiredSessions) {
          try {
            await this.endSession(sessionId);
          } catch (error) {
            this.logger.warn(`Failed to end expired session ${sessionId}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
    }
  }

  // Session information methods
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  getSessionInfo(sessionId: string): {
    sessionId: string;
    startTime: Date;
    lastActivity: Date;
    isActive: boolean;
  } | null {
    const timestamp = this.sessionTimestamps.get(sessionId);
    if (!timestamp) return null;

    return {
      sessionId,
      startTime: new Date(timestamp),
      lastActivity: new Date(timestamp),
      isActive: this.isSessionActive(sessionId)
    };
  }

  getAllActiveSessions(): Array<{
    sessionId: string;
    projectPath: string;
    startTime: Date;
    lastActivity: Date;
  }> {
    const sessions: Array<{
      sessionId: string;
      projectPath: string;
      startTime: Date;
      lastActivity: Date;
    }> = [];

    for (const [projectPath, sessionId] of this.activeSessions.entries()) {
      const timestamp = this.sessionTimestamps.get(sessionId);
      if (timestamp) {
        sessions.push({
          sessionId,
          projectPath,
          startTime: new Date(timestamp),
          lastActivity: new Date(timestamp)
        });
      }
    }

    return sessions;
  }

  // Session validation methods
  isSessionActive(sessionId: string): boolean {
    const timestamp = this.sessionTimestamps.get(sessionId);
    if (!timestamp) return false;

    const now = Date.now();
    return (now - timestamp) <= this.SESSION_TIMEOUT;
  }

  async validateSession(sessionId: string, projectPath: string): Promise<boolean> {
    try {
      const normalizedPath = this.normalizePath(projectPath);
      const activeSessionId = this.activeSessions.get(normalizedPath);

      return activeSessionId === sessionId && this.isSessionActive(sessionId);
    } catch (error) {
      this.logger.error(`Failed to validate session ${sessionId}:`, error);
      return false;
    }
  }

  // Session management utilities
  private updateSessionTimestamp(sessionId: string): void {
    this.sessionTimestamps.set(sessionId, Date.now());
  }

  private normalizePath(projectPath: string): string {
    // Normalize path for consistent key usage
    return projectPath.replace(/\\/g, '/').toLowerCase();
  }

  async refreshSession(sessionId: string): Promise<void> {
    if (this.isSessionActive(sessionId)) {
      this.updateSessionTimestamp(sessionId);
      this.logger.debug(`🔄 Refreshed session: ${sessionId}`);
    } else {
      throw new Error(`Session ${sessionId} is not active`);
    }
  }

  // Statistics and monitoring
  getSessionStats(): {
    totalActiveSessions: number;
    oldestSessionAge: number;
    newestSessionAge: number;
    averageSessionAge: number;
  } {
    const now = Date.now();
    const ages = Array.from(this.sessionTimestamps.values()).map(timestamp => now - timestamp);

    if (ages.length === 0) {
      return {
        totalActiveSessions: 0,
        oldestSessionAge: 0,
        newestSessionAge: 0,
        averageSessionAge: 0
      };
    }

    return {
      totalActiveSessions: ages.length,
      oldestSessionAge: Math.max(...ages),
      newestSessionAge: Math.min(...ages),
      averageSessionAge: ages.reduce((sum, age) => sum + age, 0) / ages.length
    };
  }
}