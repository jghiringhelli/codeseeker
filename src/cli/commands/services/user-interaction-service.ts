/**
 * User Interaction Service
 * Single Responsibility: Handle user interactions and Claude Code detection
 * Manages user clarification prompts and Claude Code command execution
 */

import { PlatformUtils } from '../../../shared/platform-utils';
import { spawn } from 'child_process';
import * as readline from 'readline';
import inquirer from 'inquirer';
import { QueryAnalysis } from './natural-language-processor';
import { Spinner, Theme } from '../../ui/theme';
import { Logger } from '../../../utils/logger';

export interface UserClarification {
  question: string;
  answer: string;
}

export interface ClaudeResponse {
  response: string;
  filesToModify: string[];
  summary: string;
}

/**
 * Represents a file change proposed by Claude
 */
export interface ProposedChange {
  tool: 'Write' | 'Edit';
  filePath: string;
  content?: string;       // For Write operations
  oldString?: string;     // For Edit operations
  newString?: string;     // For Edit operations
}

/**
 * Result from first phase of Claude execution (before permissions)
 */
interface ClaudeFirstPhaseResult {
  sessionId: string;
  response: string;
  proposedChanges: ProposedChange[];
  hasPermissionDenials: boolean;
}

/**
 * User's choice for file changes approval
 */
export type ApprovalChoice = 'yes' | 'yes_always' | 'no_feedback' | 'cancelled';

/**
 * Result of approval prompt
 */
export interface ApprovalResult {
  choice: ApprovalChoice;
  feedback?: string;  // User feedback when choice is 'no_feedback'
}

export class UserInteractionService {
  private rl?: readline.Interface;
  private skipApproval = false;  // When true, auto-approve changes (user selected "Yes, always")

  constructor() {
    // No initialization needed - we pipe directly to claude stdin
  }

  /**
   * Set skip approval mode (when user selects "Yes, always")
   */
  setSkipApproval(skip: boolean): void {
    this.skipApproval = skip;
  }

  /**
   * Set the readline interface (passed from main CLI)
   */
  setReadlineInterface(rl: readline.Interface): void {
    this.rl = rl;
  }

  /**
   * Pause readline before inquirer prompts to avoid conflicts
   */
  private pauseReadline(): void {
    if (this.rl) {
      this.rl.pause();
    }
  }

  /**
   * Resume readline after inquirer prompts
   */
  private resumeReadline(): void {
    if (this.rl) {
      this.rl.resume();
    }
  }

  /**
   * Prompt user for clarifications based on detected assumptions and ambiguities
   */
  async promptForClarifications(queryAnalysis: QueryAnalysis): Promise<string[]> {
    const clarifications: string[] = [];

    // Create questions based on assumptions and ambiguities
    const questions = this.generateClarificationQuestions(queryAnalysis);

    if (questions.length === 0) {
      return clarifications;
    }

    console.log('\n🤔 CodeMind detected some assumptions and ambiguities in your request.');
    console.log('Please help clarify the following:\n');

    this.pauseReadline();
    Logger.mute();

    try {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];

        try {
          const answer = await inquirer.prompt([
            {
              type: 'input',
              name: 'response',
              message: `${i + 1}. ${question}`,
              validate: (input) => input.trim().length > 0 || 'Please provide an answer or type "skip" to skip this question'
            }
          ]);

          if (answer.response && answer.response.toLowerCase() !== 'skip') {
            clarifications.push(`${question} → ${answer.response}`);
          }
        } catch (error: any) {
          // Handle Ctrl+C gracefully - skip remaining questions
          if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
            console.log('\n⚠️  Prompt cancelled - skipping remaining questions');
            break;
          }
          throw error;
        }
      }
    } finally {
      Logger.unmute();
      this.resumeReadline();
    }

    return clarifications;
  }

  /**
   * Execute Claude Code with enhanced prompt
   * When running inside Claude Code, outputs context transparently for the current Claude instance
   */
  async executeClaudeCode(enhancedPrompt: string): Promise<ClaudeResponse> {
    try {
      // Check if running inside Claude Code
      if (PlatformUtils.isRunningInClaudeCode()) {
        // TRANSPARENT MODE: Pass enhanced context to Claude
        // Output the context in a clear, visible format that Claude will process
        console.log('\n┌─ 📤 CodeMind Enhanced Context ─────────────────────────────┐');
        console.log('│ The following context is being provided to Claude Code:');
        console.log('└──────────────────────────────────────────────────────────────┘\n');

        // Show a summary of what's being provided
        const lines = enhancedPrompt.split('\n');
        const contextPreview = lines.slice(0, 15).join('\n');
        console.log(contextPreview);
        if (lines.length > 15) {
          console.log(`\n... (${lines.length - 15} more lines of context)`);
        }

        // Output the full context in the special tags for Claude to process
        console.log('\n<codemind-context>');
        console.log(enhancedPrompt);
        console.log('</codemind-context>\n');

        console.log('┌─ ℹ️  Transparent Mode Active ───────────────────────────────┐');
        console.log('│ CodeMind detected it\'s running inside Claude Code.');
        console.log('│ The enhanced context above will inform Claude\'s response.');
        console.log('│ Claude Code will now continue with this additional context.');
        console.log('└──────────────────────────────────────────────────────────────┘\n');

        // Return success - Claude (already running) will process this context
        return {
          response: 'Context provided to Claude Code - see enhanced context above',
          filesToModify: [],
          summary: 'Transparent mode: context provided to running Claude Code instance'
        };
      }

      // EXTERNAL MODE: Execute Claude CLI with streaming output
      return await this.executeClaudeCodeWithStreaming(enhancedPrompt);

    } catch (error) {
      console.error('❌ Failed to execute Claude Code:', error);
      return {
        response: 'Failed to execute Claude Code command',
        filesToModify: [],
        summary: 'Execution failed'
      };
    }
  }

  /**
   * Execute Claude Code with two-phase permission handling and feedback loop
   * Phase 1: Run Claude and collect proposed changes (permission denials)
   * Phase 2: If user approves, resume session with permissions to execute changes
   * Feedback Loop: If user provides feedback, retry with modified prompt
   */
  private async executeClaudeCodeWithStreaming(enhancedPrompt: string): Promise<ClaudeResponse> {
    let currentPrompt = enhancedPrompt;
    let allModifiedFiles: string[] = [];
    let iterationCount = 0;
    const MAX_ITERATIONS = 10; // Safety limit

    // Main feedback loop
    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      // Show compact context summary (only on first iteration or when prompt changes significantly)
      if (iterationCount === 1) {
        this.showCompactContextSummary(currentPrompt);
      }

      // Phase 1: Run Claude and collect proposed changes
      const spinner = Spinner.create(iterationCount === 1 ? 'Claude is analyzing...' : 'Claude is re-analyzing with your feedback...');
      const firstPhase = await this.executeClaudeFirstPhase(currentPrompt);
      spinner.succeed(iterationCount === 1 ? 'Analysis complete' : 'Re-analysis complete');

      // Show Claude's plan (not the permission message, but the actual plan)
      this.showClaudePlan(firstPhase.response);

      // If there are proposed changes, show them and ask for approval
      if (firstPhase.hasPermissionDenials && firstPhase.proposedChanges.length > 0) {
        // Deduplicate changes (same file path should only appear once)
        const uniqueChanges = this.deduplicateChanges(firstPhase.proposedChanges);

        const approval = await this.showProposedChangesAndConfirm(uniqueChanges);

        if (approval.choice === 'yes' || approval.choice === 'yes_always') {
          if (approval.choice === 'yes_always') {
            this.skipApproval = true;
          }

          // Phase 2: Resume session with permissions to execute changes
          console.log(Theme.colors.muted('\n  Applying changes...'));
          const finalResponse = await this.executeClaudeSecondPhase(firstPhase.sessionId);

          // Show what was modified
          this.showAppliedChanges(uniqueChanges);

          // Add to total modified files
          allModifiedFiles = [...allModifiedFiles, ...uniqueChanges.map(c => c.filePath)];

          return {
            response: finalResponse,
            filesToModify: [...new Set(allModifiedFiles)], // Deduplicate
            summary: `Applied ${uniqueChanges.length} file change(s)`
          };

        } else if (approval.choice === 'no_feedback' && approval.feedback) {
          // User provided feedback - incorporate into prompt and retry
          console.log(Theme.colors.info('\n  Retrying with your feedback...'));

          // Build new prompt with feedback
          currentPrompt = this.incorporateFeedback(enhancedPrompt, approval.feedback, iterationCount);

          // Continue loop to retry
          continue;

        } else if (approval.choice === 'cancelled') {
          // User explicitly cancelled (Ctrl+C)
          console.log(Theme.colors.muted('\n  Operation cancelled.'));
          return {
            response: firstPhase.response,
            filesToModify: allModifiedFiles,
            summary: 'Operation cancelled by user'
          };
        }
      } else {
        // No file changes proposed - check if this is expected or needs retry
        if (iterationCount === 1) {
          // First attempt, no changes - this is fine
          return {
            response: firstPhase.response,
            filesToModify: [],
            summary: 'Claude Code has processed the request (no file changes needed)'
          };
        } else {
          // After feedback, still no changes - ask if user wants to try again
          console.log(Theme.colors.warning('\n  Claude didn\'t propose any file changes this time.'));
          const continueChoice = await this.askToContinue();
          if (continueChoice.choice === 'no_feedback' && continueChoice.feedback) {
            currentPrompt = this.incorporateFeedback(enhancedPrompt, continueChoice.feedback, iterationCount);
            continue;
          } else {
            return {
              response: firstPhase.response,
              filesToModify: allModifiedFiles,
              summary: 'No additional changes proposed'
            };
          }
        }
      }
    }

    // Max iterations reached
    console.log(Theme.colors.warning('\n  Maximum retry attempts reached.'));
    return {
      response: 'Maximum retry attempts reached',
      filesToModify: allModifiedFiles,
      summary: 'Feedback loop exhausted after maximum iterations'
    };
  }

  /**
   * Incorporate user feedback into the prompt for retry
   */
  private incorporateFeedback(originalPrompt: string, feedback: string, iteration: number): string {
    return `${originalPrompt}

# User Feedback (Iteration ${iteration})
The user reviewed the proposed changes and requested modifications:
"${feedback}"

Please revise your approach based on this feedback and propose new changes.`;
  }

  /**
   * Ask user if they want to continue with more feedback
   */
  private async askToContinue(): Promise<ApprovalResult> {
    this.pauseReadline();
    Logger.mute();

    try {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'What would you like to do?',
          choices: [
            { name: 'Provide more guidance', value: 'no_feedback' },
            { name: 'Done (accept current state)', value: 'yes' }
          ],
          default: 'yes'
        }
      ]);

      if (answer.choice === 'no_feedback') {
        const feedbackAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'What should Claude do?',
            validate: (input) => input.trim().length > 0 || 'Please provide guidance'
          }
        ]);
        return { choice: 'no_feedback', feedback: feedbackAnswer.feedback };
      }

      return { choice: answer.choice as ApprovalChoice };
    } catch (error: any) {
      if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
        return { choice: 'cancelled' as ApprovalChoice };
      }
      throw error;
    } finally {
      Logger.unmute();
      this.resumeReadline();
    }
  }

  /**
   * Show compact context summary - just a single line showing what's being sent
   */
  private showCompactContextSummary(prompt: string): void {
    const lines = prompt.split('\n');
    const totalChars = prompt.length;

    // Extract file count from the prompt
    const filesMatch = prompt.match(/# Relevant Files \((\d+) found\)/);
    const fileCount = filesMatch ? filesMatch[1] : '0';

    // Single compact line
    console.log(Theme.colors.muted(`\n  📤 Sending: ${fileCount} files, ${lines.length} lines (${totalChars} chars)`));
  }

  /**
   * Show Claude's plan (filtering out permission-related messages)
   */
  private showClaudePlan(response: string): void {
    // Filter out permission-related messages that aren't useful to show
    const filteredResponse = response
      .replace(/It seems I need permission.*?(\n|$)/gi, '')
      .replace(/Could you grant permission.*?(\n|$)/gi, '')
      .replace(/Would you like to grant.*?(\n|$)/gi, '')
      .replace(/Once granted.*?(\n|$)/gi, '')
      .trim();

    if (filteredResponse) {
      console.log(Theme.colors.claudeCode('\n┌─ 🤖 Plan ────────────────────────────────────────────────────┐'));
      // Show all lines without truncation
      const responseLines = filteredResponse.split('\n');
      responseLines.forEach(line => {
        console.log(Theme.colors.claudeCodeMuted('│ ') + Theme.colors.claudeCode(line));
      });
      console.log(Theme.colors.claudeCode('└──────────────────────────────────────────────────────────────┘'));
    }
  }

  /**
   * Deduplicate proposed changes (same file path should only appear once)
   */
  private deduplicateChanges(changes: ProposedChange[]): ProposedChange[] {
    const seen = new Map<string, ProposedChange>();
    for (const change of changes) {
      // Keep the last change for each file path
      seen.set(change.filePath, change);
    }
    return Array.from(seen.values());
  }

  /**
   * Show what changes were applied
   */
  private showAppliedChanges(changes: ProposedChange[]): void {
    console.log(Theme.colors.success('\n✓ Changes applied:'));
    changes.forEach((change, i) => {
      const fileName = change.filePath.split(/[/\\]/).pop() || change.filePath;
      const operation = change.tool === 'Write' ? 'Created' : 'Modified';
      console.log(Theme.colors.success(`  ${i + 1}. ${operation}: ${fileName}`));
    });
  }

  /**
   * Phase 1: Execute Claude and collect proposed changes without applying them
   */
  private async executeClaudeFirstPhase(prompt: string): Promise<ClaudeFirstPhaseResult> {
    return new Promise((resolve) => {
      const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();

      // Use JSON output format to get structured response with permission_denials
      const claudeArgs = ['-p', '--output-format', 'json'];

      const child = spawn('claude', claudeArgs, {
        cwd: userCwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdoutData = '';
      let stderrData = '';

      child.stdin?.write(prompt);
      child.stdin?.end();

      child.stdout?.on('data', (data: Buffer) => {
        stdoutData += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderrData += data.toString();
      });

      child.on('close', () => {
        try {
          const result = JSON.parse(stdoutData);

          // Extract proposed changes from permission_denials
          const proposedChanges: ProposedChange[] = (result.permission_denials || []).map((denial: any) => {
            const change: ProposedChange = {
              tool: denial.tool_name as 'Write' | 'Edit',
              filePath: denial.tool_input.file_path
            };

            if (denial.tool_name === 'Write') {
              change.content = denial.tool_input.content;
            } else if (denial.tool_name === 'Edit') {
              change.oldString = denial.tool_input.old_string;
              change.newString = denial.tool_input.new_string;
            }

            return change;
          });

          resolve({
            sessionId: result.session_id || '',
            response: result.result || '',
            proposedChanges,
            hasPermissionDenials: (result.permission_denials || []).length > 0
          });
        } catch (error) {
          // If JSON parsing fails, return the raw output
          resolve({
            sessionId: '',
            response: stdoutData || stderrData,
            proposedChanges: [],
            hasPermissionDenials: false
          });
        }
      });

      child.on('error', (err) => {
        resolve({
          sessionId: '',
          response: `Error: ${err.message}`,
          proposedChanges: [],
          hasPermissionDenials: false
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        child.kill('SIGTERM');
      }, 300000);
    });
  }

  /**
   * Phase 2: Resume the session with permissions to apply changes
   */
  private async executeClaudeSecondPhase(sessionId: string): Promise<string> {
    return new Promise((resolve) => {
      const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();

      // Resume the session with permission mode to apply changes
      const claudeArgs = [
        '-p',
        '--resume', sessionId,
        '--permission-mode', 'acceptEdits',
        '--output-format', 'json'
      ];

      const child = spawn('claude', claudeArgs, {
        cwd: userCwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdoutData = '';

      // Send a simple "proceed" message
      child.stdin?.write('Please proceed with the file changes.');
      child.stdin?.end();

      child.stdout?.on('data', (data: Buffer) => {
        stdoutData += data.toString();
      });

      child.on('close', () => {
        try {
          const result = JSON.parse(stdoutData);
          resolve(result.result || 'Changes applied');
        } catch {
          resolve(stdoutData || 'Changes applied');
        }
      });

      child.on('error', (err) => {
        resolve(`Error applying changes: ${err.message}`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        child.kill('SIGTERM');
      }, 300000);
    });
  }

  /**
   * Show proposed changes to user and ask for confirmation
   * Uses list-style prompt like Claude Code with Yes/Yes always/No/No with feedback options
   */
  private async showProposedChangesAndConfirm(changes: ProposedChange[]): Promise<ApprovalResult> {
    // If skip approval is enabled, auto-approve
    if (this.skipApproval) {
      console.log(Theme.colors.muted(`\n  Auto-approving ${changes.length} change(s)...`));
      return { choice: 'yes' };
    }

    // Show full changes - no truncation
    console.log(Theme.colors.warning('\n┌─ 📝 Proposed Changes ─────────────────────────────────────┐'));

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const fileName = change.filePath.split(/[/\\]/).pop() || change.filePath;
      const operation = change.tool === 'Write' ? '+ Create' : '~ Modify';
      const opColor = change.tool === 'Write' ? Theme.colors.success : Theme.colors.warning;

      console.log(Theme.colors.muted('│'));
      console.log(Theme.colors.muted('│ ') + opColor(`${operation}: ${change.filePath}`));

      if (change.tool === 'Write' && change.content) {
        // Show full file content for new files
        const contentLines = change.content.split('\n');
        console.log(Theme.colors.muted('│'));
        contentLines.forEach(line => {
          console.log(Theme.colors.muted('│   ') + Theme.colors.success(`+ ${line}`));
        });
      } else if (change.tool === 'Edit') {
        // Show full diff view
        if (change.oldString) {
          console.log(Theme.colors.muted('│'));
          const oldLines = change.oldString.split('\n');
          oldLines.forEach(line => {
            console.log(Theme.colors.muted('│   ') + Theme.colors.error(`- ${line}`));
          });
        }
        if (change.newString) {
          console.log(Theme.colors.muted('│'));
          const newLines = change.newString.split('\n');
          newLines.forEach(line => {
            console.log(Theme.colors.muted('│   ') + Theme.colors.success(`+ ${line}`));
          });
        }
      }
    }

    console.log(Theme.colors.muted('│'));
    console.log(Theme.colors.warning('└───────────────────────────────────────────────────────────┘'));

    // Ask for confirmation with list-style prompt (like Claude Code)
    // Note: No standalone "No" option - user must provide feedback or cancel with Ctrl+C
    this.pauseReadline();
    Logger.mute();

    try {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: `Apply ${changes.length} change(s)?`,
          choices: [
            { name: 'Yes', value: 'yes' },
            { name: 'Yes, and don\'t ask again', value: 'yes_always' },
            { name: 'No, tell me what to do differently', value: 'no_feedback' }
          ],
          default: 'yes'
        }
      ]);

      // If user wants to provide feedback, prompt for it
      if (answer.choice === 'no_feedback') {
        const feedbackAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'What should be done differently?',
            validate: (input) => input.trim().length > 0 || 'Please provide feedback (or Ctrl+C to cancel)'
          }
        ]);
        return { choice: 'no_feedback', feedback: feedbackAnswer.feedback };
      }

      return { choice: answer.choice as ApprovalChoice };
    } catch (error: any) {
      if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
        console.log('\n⚠️  Cancelled');
        return { choice: 'cancelled' };
      }
      throw error;
    } finally {
      Logger.unmute();
      this.resumeReadline();
    }
  }

  /**
   * This method is now deprecated - file changes are confirmed before being applied
   * via showProposedChangesAndConfirm. Keeping for backwards compatibility.
   */
  async confirmFileModifications(_filesToModify: string[]): Promise<{approved: boolean, dontAskAgain: boolean}> {
    // Changes are now confirmed via showProposedChangesAndConfirm before being applied
    // This method is kept for backwards compatibility but no longer prompts
    return { approved: true, dontAskAgain: true };
  }

  /**
   * Ask user if they want to run build/tests after changes
   */
  async confirmBuildAndTest(): Promise<ApprovalResult> {
    if (this.skipApproval) {
      return { choice: 'yes' };
    }

    this.pauseReadline();
    Logger.mute();

    try {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Run build and tests?',
          choices: [
            { name: 'Yes', value: 'yes' },
            { name: 'Yes, and don\'t ask again', value: 'yes_always' },
            { name: 'No, skip build/test', value: 'cancelled' }
          ],
          default: 'yes'
        }
      ]);

      if (answer.choice === 'yes_always') {
        this.skipApproval = true;
      }

      return { choice: answer.choice as ApprovalChoice };
    } catch (error: any) {
      if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
        console.log('\n⚠️  Prompt cancelled');
        return { choice: 'cancelled' };
      }
      throw error;
    } finally {
      Logger.unmute();
      this.resumeReadline();
    }
  }

  /**
   * Display execution summary
   */
  displayExecutionSummary(summary: string, stats: any): void {
    console.log('\n✅ CodeMind Execution Summary');
    console.log('━'.repeat(50));
    console.log(summary);

    if (stats) {
      console.log('\n📊 Analysis Statistics:');
      console.log(`  • Files analyzed: ${stats.filesFound}`);
      console.log(`  • Relationships found: ${stats.relationshipsFound}`);
      console.log(`  • Assumptions detected: ${stats.assumptionsDetected}`);
      console.log(`  • Clarifications provided: ${stats.clarificationsProvided}`);
    }
    console.log('');
  }

  /**
   * Generate clarification questions based on analysis
   */
  private generateClarificationQuestions(queryAnalysis: QueryAnalysis): string[] {
    const questions: string[] = [];

    // Questions based on assumptions
    queryAnalysis.assumptions.forEach(assumption => {
      if (assumption.includes('authentication')) {
        questions.push('What authentication method should be used? (JWT, session-based, OAuth, etc.)');
      }
      if (assumption.includes('database')) {
        questions.push('Which database tables/models should be involved in this operation?');
      }
      if (assumption.includes('API')) {
        questions.push('Should this be a REST endpoint, GraphQL resolver, or other API pattern?');
      }
      if (assumption.includes('testing')) {
        questions.push('What type of tests are needed? (unit, integration, e2e)');
      }
    });

    // Questions based on ambiguities
    queryAnalysis.ambiguities.forEach(ambiguity => {
      if (ambiguity.includes('Pronouns detected')) {
        questions.push('Which specific files or components should be modified?');
      }
      if (ambiguity.includes('Improvement request')) {
        questions.push('What specific improvements are you looking for? (performance, readability, security, etc.)');
      }
      if (ambiguity.includes('Comparison requested')) {
        questions.push('What should this be similar to? Please provide a reference example.');
      }
    });

    // Remove duplicates and limit to 3 questions to avoid overwhelming user
    return [...new Set(questions)].slice(0, 3);
  }

  /**
   * Parse Claude Code response to extract files and summary
   */
  private parseClaudeResponse(output: string): ClaudeResponse {
    // In a real implementation, this would parse Claude's structured output
    // For now, return a basic structure
    const filesToModify: string[] = [];

    // Look for file mentions in the output
    const fileMatches = output.match(/(?:src\/|\.\/)[a-zA-Z0-9\/_-]+\.[a-zA-Z]{2,4}/g);
    if (fileMatches) {
      filesToModify.push(...fileMatches);
    }

    return {
      response: output,
      filesToModify: [...new Set(filesToModify)], // Remove duplicates
      summary: 'Claude Code has processed the request and provided implementation suggestions'
    };
  }
}