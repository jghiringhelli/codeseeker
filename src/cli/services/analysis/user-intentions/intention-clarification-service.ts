/**
 * Intention Clarification Service
 * Handles interactive user clarification for ambiguous requests
 * Provides numbered selection interface for intentions and assumptions
 */

import * as readline from 'readline';
import { Theme } from '../../../ui/theme';
import {
  IntentionAnalysis,
  AmbiguityDetail,
  UserClarification,
  ClarifiedIntentionAnalysis,
  LLMIntentionDetector,
  IntentionType
} from './llm-intention-detector';

export interface ClarificationSession {
  sessionId: string;
  originalRequest: string;
  analysis: IntentionAnalysis;
  clarifications: UserClarification[];
  isComplete: boolean;
  currentAmbiguityIndex: number;
}

export class IntentionClarificationService {
  private llmDetector: LLMIntentionDetector;
  private activeSessions: Map<string, ClarificationSession> = new Map();

  constructor() {
    this.llmDetector = new LLMIntentionDetector();
  }

  /**
   * Start a clarification session for ambiguous requests
   */
  async startClarificationSession(
    userRequest: string,
    analysis: IntentionAnalysis,
    rl: readline.Interface
  ): Promise<ClarifiedIntentionAnalysis> {
    const sessionId = this.generateSessionId();

    const session: ClarificationSession = {
      sessionId,
      originalRequest: userRequest,
      analysis,
      clarifications: [],
      isComplete: false,
      currentAmbiguityIndex: 0
    };

    this.activeSessions.set(sessionId, session);

    // Display intention analysis summary
    this.displayIntentionSummary(analysis);

    // Process ambiguities if any exist
    if (analysis.ambiguities.length > 0) {
      console.log(Theme.colors.warning('\n🔍 Some aspects of your request need clarification:'));
      await this.processAmbiguities(session, rl);
    } else {
      console.log(Theme.colors.success('\n✅ Request is clear - no clarifications needed'));
      session.isComplete = true;
    }

    // Apply clarifications and return final analysis
    const clarifiedAnalysis = this.llmDetector.applyClarifications(analysis, session.clarifications);
    this.activeSessions.delete(sessionId);

    return clarifiedAnalysis;
  }

  /**
   * Display a summary of the detected intention
   */
  private displayIntentionSummary(analysis: IntentionAnalysis): void {
    console.log(Theme.colors.primary('\n🎯 INTENTION ANALYSIS'));
    console.log(Theme.colors.secondary('━'.repeat(50)));

    // Primary intention
    console.log(Theme.colors.success(`✓ Primary Intent: ${this.formatIntentionName(analysis.primaryIntent)}`));
    console.log(Theme.colors.muted(`  Confidence: ${Math.round(analysis.confidence * 100)}%`));

    // Sub-intents
    if (analysis.subIntents.length > 0) {
      console.log(Theme.colors.info(`📋 Secondary Intents:`));
      analysis.subIntents.forEach(intent => {
        console.log(Theme.colors.muted(`  • ${this.formatIntentionName(intent)}`));
      });
    }

    // Key details
    console.log(Theme.colors.info(`\n📊 Analysis Summary:`));
    console.log(Theme.colors.muted(`  • Urgency: ${analysis.urgency}`));
    console.log(Theme.colors.muted(`  • Complexity: ${analysis.complexity}`));
    console.log(Theme.colors.muted(`  • Estimated Duration: ${analysis.estimatedDuration}`));

    if (analysis.requiredSkills.length > 0) {
      console.log(Theme.colors.muted(`  • Required Skills: ${analysis.requiredSkills.join(', ')}`));
    }

    if (analysis.potentialRisks.length > 0) {
      console.log(Theme.colors.warning(`  ⚠️  Potential Risks:`));
      analysis.potentialRisks.forEach(risk => {
        console.log(Theme.colors.muted(`     - ${risk}`));
      });
    }
  }

  /**
   * Process all ambiguities with user interaction
   */
  private async processAmbiguities(
    session: ClarificationSession,
    rl: readline.Interface
  ): Promise<void> {
    const { analysis } = session;

    for (let i = 0; i < analysis.ambiguities.length; i++) {
      session.currentAmbiguityIndex = i;
      const ambiguity = analysis.ambiguities[i];

      console.log(Theme.colors.primary(`\n🔍 Clarification ${i + 1} of ${analysis.ambiguities.length}`));
      console.log(Theme.colors.secondary('━'.repeat(30)));

      const clarification = await this.handleAmbiguity(ambiguity, rl);
      session.clarifications.push(clarification);
    }

    session.isComplete = true;
  }

  /**
   * Handle a single ambiguity with user selection
   */
  private async handleAmbiguity(
    ambiguity: AmbiguityDetail,
    rl: readline.Interface
  ): Promise<UserClarification> {
    // Display the ambiguity
    console.log(Theme.colors.warning(`❓ ${ambiguity.area}`));
    console.log(Theme.colors.muted(`   ${ambiguity.reason}`));
    console.log(Theme.colors.info(`\n${ambiguity.clarificationNeeded}`));

    // Display options
    console.log(Theme.colors.secondary('\nAvailable options:'));
    ambiguity.options.forEach((option, index) => {
      console.log(Theme.colors.muted(`  ${index + 1}. ${option}`));
    });

    if (ambiguity.allowCustomInput) {
      console.log(Theme.colors.muted(`  ${ambiguity.options.length + 1}. [Custom] Specify your own requirement`));
    }

    // Get user selection
    const userChoice = await this.getUserSelection(
      rl,
      ambiguity.options.length + (ambiguity.allowCustomInput ? 1 : 0)
    );

    // Handle custom input
    if (ambiguity.allowCustomInput && userChoice === ambiguity.options.length + 1) {
      const customInput = await this.getCustomInput(rl, ambiguity.clarificationNeeded);
      return {
        ambiguityId: ambiguity.id,
        customInput,
        timestamp: Date.now()
      };
    }

    // Handle standard selection
    return {
      ambiguityId: ambiguity.id,
      selectedOption: userChoice - 1, // Convert to 0-based index
      timestamp: Date.now()
    };
  }

  /**
   * Get user selection with validation
   */
  private async getUserSelection(rl: readline.Interface, maxOption: number): Promise<number> {
    return new Promise((resolve) => {
      const prompt = Theme.colors.prompt(`\nSelect option (1-${maxOption}): `);

      const askForInput = () => {
        rl.question(prompt, (answer) => {
          const choice = parseInt(answer.trim());

          if (isNaN(choice) || choice < 1 || choice > maxOption) {
            console.log(Theme.colors.error(`❌ Please enter a number between 1 and ${maxOption}`));
            askForInput();
          } else {
            resolve(choice);
          }
        });
      };

      askForInput();
    });
  }

  /**
   * Get custom input from user
   */
  private async getCustomInput(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
      const prompt = Theme.colors.prompt(`\n${question}\nYour requirement: `);

      const askForInput = () => {
        rl.question(prompt, (answer) => {
          const input = answer.trim();

          if (input.length === 0) {
            console.log(Theme.colors.error('❌ Please provide a non-empty requirement'));
            askForInput();
          } else {
            resolve(input);
          }
        });
      };

      askForInput();
    });
  }

  /**
   * Display final clarified instructions
   */
  displayFinalInstructions(clarifiedAnalysis: ClarifiedIntentionAnalysis): void {
    console.log(Theme.colors.primary('\n🎯 FINAL EXECUTION INSTRUCTIONS'));
    console.log(Theme.colors.secondary('━'.repeat(50)));

    console.log(Theme.colors.success('\n✅ Clarifications Complete'));
    console.log(Theme.colors.muted('The following instructions will be sent to Claude Code:\n'));

    // Display the final instructions in a formatted way
    const lines = clarifiedAnalysis.finalInstructions.split('\n');
    lines.forEach(line => {
      if (line.startsWith('PRIMARY INTENTION:')) {
        console.log(Theme.colors.success(line));
      } else if (line.startsWith('SECONDARY INTENTIONS:')) {
        console.log(Theme.colors.info(line));
      } else if (line.includes('CLARIFICATIONS:') || line.includes('ASSUMPTIONS:') || line.includes('CONSTRAINTS:')) {
        console.log(Theme.colors.primary(line));
      } else if (line.startsWith('- ')) {
        console.log(Theme.colors.muted(`  ${line}`));
      } else if (line.trim()) {
        console.log(Theme.colors.muted(line));
      }
    });

    console.log(Theme.colors.secondary('\n━'.repeat(50)));
  }

  /**
   * Format intention names for display (convert snake_case to readable format)
   */
  private formatIntentionName(intention: IntentionType): string {
    return intention
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `clarification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get intention categories for display
   */
  getIntentionCategories(): Record<string, IntentionType[]> {
    return this.llmDetector.getIntentionCategories();
  }

  /**
   * Check if a session exists
   */
  hasActiveSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ClarificationSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      // Check if any clarification is older than maxAge
      const hasExpiredClarifications = session.clarifications.some(
        clarification => now - clarification.timestamp > maxAgeMs
      );

      if (hasExpiredClarifications) {
        this.activeSessions.delete(sessionId);
      }
    }
  }
}