/**
 * User Clarification Service
 * Handles user interaction for assumption clarification
 * Integrates with readline interface for real-time feedback
 */

import * as readline from 'readline';
import { Theme } from '../ui/theme';
import { AmbiguityAnalysis, DetectedAssumption } from './assumption-detector';

export interface ClarificationResponse {
  originalRequest: string;
  assumptions: DetectedAssumption[];
  userChoices: Map<string, string>;
  clarifiedPrompt: string;
  shouldProceed: boolean;
}

export class UserClarificationService {
  private rl: readline.Interface;

  constructor(rl: readline.Interface) {
    this.rl = rl;
  }

  /**
   * Present assumptions to user and collect clarifications
   */
  async requestClarification(
    originalRequest: string,
    analysis: AmbiguityAnalysis
  ): Promise<ClarificationResponse> {
    if (!analysis.hasAmbiguities) {
      return {
        originalRequest,
        assumptions: [],
        userChoices: new Map(),
        clarifiedPrompt: originalRequest,
        shouldProceed: true
      };
    }

    console.log(Theme.colors.warning('\n🤔 I detected some assumptions in your request.'));
    console.log(Theme.colors.info('Let me clarify a few things to ensure Claude Code builds exactly what you need:\n'));

    // Show detected assumptions
    console.log(Theme.colors.primary('📋 DETECTED ASSUMPTIONS:'));
    analysis.assumptions.forEach((assumption, index) => {
      console.log(Theme.colors.info(`${index + 1}. ${assumption.assumption}`));
      if (assumption.alternatives && assumption.alternatives.length > 0) {
        console.log(Theme.colors.muted('   Alternatives:'));
        assumption.alternatives.forEach(alt => {
          console.log(Theme.colors.muted(`   • ${alt}`));
        });
      }
      console.log('');
    });

    // Ask user for preferences
    const userChoices = new Map<string, string>();

    for (const question of analysis.suggestedQuestions) {
      console.log(Theme.colors.secondary(`❓ ${question}`));
      const answer = await this.promptUser();
      userChoices.set(question, answer);
      console.log('');
    }

    // Confirm proceeding with assumptions
    console.log(Theme.colors.warning('📝 SUMMARY:'));
    console.log(Theme.colors.info('I will proceed with the following approach:'));

    // Show final approach based on user input
    const finalApproach = this.generateFinalApproach(analysis, userChoices);
    finalApproach.forEach((approach, index) => {
      console.log(Theme.colors.muted(`${index + 1}. ${approach}`));
    });

    const shouldProceed = await this.confirmProceed();

    // Generate clarified prompt
    const clarifiedPrompt = this.buildClarifiedPrompt(originalRequest, analysis, userChoices);

    return {
      originalRequest,
      assumptions: analysis.assumptions,
      userChoices,
      clarifiedPrompt,
      shouldProceed
    };
  }

  /**
   * Simple prompt for user input
   */
  private async promptUser(): Promise<string> {
    return new Promise((resolve) => {
      // Temporarily pause the main prompt
      this.rl.pause();
      this.rl.question(Theme.colors.prompt('   Your preference: '), (answer) => {
        // Resume the main prompt after getting input
        this.rl.resume();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Confirm if user wants to proceed
   */
  private async confirmProceed(): Promise<boolean> {
    return new Promise((resolve) => {
      // Temporarily pause the main prompt
      this.rl.pause();
      this.rl.question(
        Theme.colors.prompt('\n✅ Proceed with this approach? [Y/n]: '),
        (answer) => {
          const proceed = answer.trim().toLowerCase();
          const shouldProceed = proceed === '' || proceed === 'y' || proceed === 'yes';

          if (shouldProceed) {
            console.log(Theme.colors.success('🚀 Great! Sending clarified request to Claude Code...'));
          } else {
            console.log(Theme.colors.info('🔄 Let\'s refine the request. Please rephrase your original request.'));
          }

          // Resume the main prompt after getting input
          this.rl.resume();
          resolve(shouldProceed);
        }
      );
    });
  }

  /**
   * Generate final approach summary based on user choices
   */
  private generateFinalApproach(
    analysis: AmbiguityAnalysis,
    userChoices: Map<string, string>
  ): string[] {
    const approach: string[] = [];

    // Add interpretations based on user choices
    for (const [question, answer] of userChoices) {
      if (answer.toLowerCase().includes('existing') || answer.toLowerCase().includes('current')) {
        approach.push('Use existing codebase patterns and integrate with current architecture');
      } else if (answer.toLowerCase().includes('new') || answer.toLowerCase().includes('scratch')) {
        approach.push('Create new implementation from scratch');
      } else if (answer.toLowerCase().includes('minimal') || answer.toLowerCase().includes('simple')) {
        approach.push('Create minimal working implementation');
      } else if (answer.toLowerCase().includes('complete') || answer.toLowerCase().includes('full')) {
        approach.push('Build complete production-ready feature');
      } else if (answer.toLowerCase().includes('mock') || answer.toLowerCase().includes('placeholder')) {
        approach.push('Use mock data and placeholder implementations');
      } else if (answer.toLowerCase().includes('real') || answer.toLowerCase().includes('actual')) {
        approach.push('Connect to real data sources and services');
      } else {
        approach.push(`Follow user preference: "${answer}"`);
      }
    }

    // Add default assumptions that weren't clarified
    const unclarifiedAssumptions = analysis.assumptions.filter(assumption =>
      !Array.from(userChoices.keys()).some(question =>
        question.toLowerCase().includes(assumption.category)
      )
    );

    unclarifiedAssumptions.forEach(assumption => {
      approach.push(`Default assumption: ${assumption.assumption}`);
    });

    return approach;
  }

  /**
   * Build enhanced prompt with clarifications for Claude Code
   */
  private buildClarifiedPrompt(
    originalRequest: string,
    analysis: AmbiguityAnalysis,
    userChoices: Map<string, string>
  ): string {
    let clarifiedPrompt = originalRequest;

    // Add clarification section
    clarifiedPrompt += '\n\n**USER CLARIFICATIONS:**\n';

    for (const [question, answer] of userChoices) {
      clarifiedPrompt += `- ${question}\n  → ${answer}\n\n`;
    }

    // Add structured requirements
    clarifiedPrompt += '**IMPORTANT REQUIREMENTS:**\n';
    clarifiedPrompt += '1. Please acknowledge these clarifications in your response\n';
    clarifiedPrompt += '2. Include an "assumptions" field in your JSON response listing any remaining assumptions\n';
    clarifiedPrompt += '3. If you still need clarification on anything, ask specific questions before implementing\n';
    clarifiedPrompt += '4. Structure your response to be clear about what you\'re building\n\n';

    // Add assumption context
    clarifiedPrompt += '**DETECTED ASSUMPTIONS (for context):**\n';
    analysis.assumptions.forEach((assumption, index) => {
      clarifiedPrompt += `${index + 1}. [${assumption.category}] ${assumption.assumption}\n`;
    });

    return clarifiedPrompt;
  }

  /**
   * Quick yes/no confirmation
   */
  async quickConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Temporarily pause the main prompt
      this.rl.pause();
      this.rl.question(
        Theme.colors.prompt(`${message} [y/N]: `),
        (answer) => {
          const confirmed = answer.trim().toLowerCase();
          // Resume the main prompt after getting input
          this.rl.resume();
          resolve(confirmed === 'y' || confirmed === 'yes');
        }
      );
    });
  }

  /**
   * Present simple multiple choice
   */
  async multipleChoice(question: string, choices: string[]): Promise<number> {
    console.log(Theme.colors.secondary(question));
    choices.forEach((choice, index) => {
      console.log(Theme.colors.info(`${index + 1}. ${choice}`));
    });

    return new Promise((resolve) => {
      // Temporarily pause the main prompt
      this.rl.pause();
      this.rl.question(
        Theme.colors.prompt(`Choose [1-${choices.length}]: `),
        (answer) => {
          const choice = parseInt(answer.trim());
          if (choice >= 1 && choice <= choices.length) {
            console.log(Theme.colors.success(`✓ Selected: ${choices[choice - 1]}`));
            resolve(choice - 1);
          } else {
            console.log(Theme.colors.error('Invalid choice. Defaulting to option 1.'));
            resolve(0);
          }
          // Resume the main prompt after getting input
          this.rl.resume();
        }
      );
    });
  }
}

export default UserClarificationService;