"use strict";
/**
 * User Interaction Service
 * Single Responsibility: Handle user interactions and Claude Code detection
 * Manages user clarification prompts and Claude Code command execution
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInteractionService = void 0;
const platform_utils_1 = require("../../../shared/platform-utils");
const child_process_1 = require("child_process");
const inquirer_1 = __importDefault(require("inquirer"));
const theme_1 = require("../../ui/theme");
const logger_1 = require("../../../utils/logger");
class UserInteractionService {
    rl;
    skipApproval = false; // When true, auto-approve changes (user selected "Yes, always")
    verboseMode = false; // When true, show full debug output (files, relationships, prompt)
    activeChild = null; // Track active child process for cancellation
    isCancelled = false; // Flag to track user cancellation
    searchModeEnabled = true; // Toggle for semantic search (default: enabled)
    isFirstPromptInSession = true; // Track if this is the first prompt (for REPL mode)
    constructor() {
        // No initialization needed - we pipe directly to claude stdin
        // Set up SIGINT (Ctrl+C) handler for graceful cancellation
        process.on('SIGINT', () => {
            if (this.activeChild) {
                console.log(theme_1.Theme.colors.warning('\n\n  ⚠️  Cancelling... (press Ctrl+C again to force quit)'));
                this.isCancelled = true;
                this.activeChild.kill('SIGTERM');
                this.activeChild = null;
            }
            else {
                // If no active child, let the default handler take over
                process.exit(0);
            }
        });
    }
    /**
     * Set verbose mode (when user uses -v/--verbose flag)
     */
    setVerboseMode(enabled) {
        this.verboseMode = enabled;
    }
    /**
     * Set skip approval mode (when user selects "Yes, always")
     */
    setSkipApproval(skip) {
        this.skipApproval = skip;
    }
    /**
     * Set the readline interface (passed from main CLI)
     */
    setReadlineInterface(rl) {
        this.rl = rl;
    }
    /**
     * Pause readline before inquirer prompts to avoid conflicts
     */
    pauseReadline() {
        if (this.rl) {
            this.rl.pause();
        }
    }
    /**
     * Resume readline after inquirer prompts
     */
    resumeReadline() {
        if (this.rl) {
            this.rl.resume();
        }
    }
    /**
     * Prompt user for clarifications based on detected assumptions and ambiguities
     */
    async promptForClarifications(queryAnalysis) {
        const clarifications = [];
        // Create questions based on assumptions and ambiguities
        const questions = this.generateClarificationQuestions(queryAnalysis);
        if (questions.length === 0) {
            return clarifications;
        }
        console.log(theme_1.Theme.sectionTitle('Clarification Needed', '❓'));
        console.log(theme_1.Theme.colors.warning('  CodeMind detected some assumptions and ambiguities in your request.'));
        console.log(theme_1.Theme.colors.highlight('  Please help clarify the following questions:\n'));
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                try {
                    const answer = await inquirer_1.default.prompt([
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
                }
                catch (error) {
                    // Handle Ctrl+C gracefully - skip remaining questions
                    if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                        console.log('\n⚠️  Prompt cancelled - skipping remaining questions');
                        break;
                    }
                    throw error;
                }
            }
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
        return clarifications;
    }
    /**
     * Execute Claude Code with enhanced prompt
     * When running inside Claude Code, outputs context transparently for the current Claude instance
     * @param enhancedPrompt The prompt to send to Claude
     * @param options.autoApprove If true, auto-approve all file changes (for automated fix tasks)
     */
    async executeClaudeCode(enhancedPrompt, options) {
        // For automated tasks like build fixes, enable auto-approval
        if (options?.autoApprove) {
            this.skipApproval = true;
        }
        try {
            // Check if running inside Claude Code
            if (platform_utils_1.PlatformUtils.isRunningInClaudeCode()) {
                // TRANSPARENT MODE: Pass enhanced context to Claude
                // For auto-approve tasks (build fixes, test fixes), add execution directive
                let promptToSend = enhancedPrompt;
                if (options?.autoApprove) {
                    // Add directive to execute immediately without showing a plan
                    promptToSend = `<codemind-directive>
EXECUTE IMMEDIATELY - DO NOT SHOW A PLAN
This is an automated fix task. Execute the fix directly without asking for approval or showing a plan.
Just make the necessary changes to fix the issue.
</codemind-directive>

${enhancedPrompt}`;
                }
                // Output the context in a clear, visible format that Claude will process
                console.log(theme_1.Theme.sectionTitle('CodeMind Enhanced Context', '📤'));
                console.log(theme_1.Theme.colors.muted('  The following context is being provided to Claude Code:\n'));
                // Show a summary of what's being provided
                const lines = promptToSend.split('\n');
                const contextPreview = lines.slice(0, 15).join('\n');
                console.log(contextPreview);
                if (lines.length > 15) {
                    console.log(`\n... (${lines.length - 15} more lines of context)`);
                }
                // Output the full context in the special tags for Claude to process
                console.log('\n<codemind-context>');
                console.log(promptToSend);
                console.log('</codemind-context>\n');
                if (options?.autoApprove) {
                    console.log(theme_1.Theme.colors.warning('\n  ⚡ Auto-Execute Mode'));
                    console.log(theme_1.Theme.colors.muted('  Claude will execute the fix immediately without showing a plan.\n'));
                }
                else {
                    console.log(theme_1.Theme.colors.info('\n  ℹ️  Transparent Mode Active'));
                    console.log(theme_1.Theme.divider('─', 55));
                    console.log(theme_1.Theme.colors.muted('  CodeMind detected it\'s running inside Claude Code.'));
                    console.log(theme_1.Theme.colors.muted('  The enhanced context above will inform Claude\'s response.'));
                    console.log(theme_1.Theme.colors.muted('  Claude Code will now continue with this additional context.\n'));
                }
                // Return success - Claude (already running) will process this context
                return {
                    response: 'Context provided to Claude Code - see enhanced context above',
                    filesToModify: [],
                    summary: 'Transparent mode: context provided to running Claude Code instance'
                };
            }
            // EXTERNAL MODE: Execute Claude CLI with streaming output
            return await this.executeClaudeCodeWithStreaming(enhancedPrompt);
        }
        catch (error) {
            console.error('❌ Failed to execute Claude Code:', error);
            return {
                response: 'Failed to execute Claude Code command',
                filesToModify: [],
                summary: 'Execution failed'
            };
        }
    }
    /**
     * Execute a direct Claude command for autonomous fix tasks (build/test fixes)
     * This method bypasses the full workflow orchestrator and executes immediately.
     *
     * In transparent mode: Outputs a plain instruction for Claude to process without
     * triggering the CodeMind workflow (no <codemind-context> tags).
     *
     * In external mode: Runs Claude CLI with auto-approval for immediate execution.
     */
    async executeDirectFixCommand(fixPrompt, taskType) {
        const taskLabels = {
            'build': '🔨 Build Fix',
            'test': '🧪 Test Fix',
            'general': '🔧 Fix'
        };
        const label = taskLabels[taskType];
        if (platform_utils_1.PlatformUtils.isRunningInClaudeCode()) {
            // TRANSPARENT MODE: Output as a simple instruction for the running Claude instance
            // Use a special format that doesn't trigger CodeMind workflow
            console.log(theme_1.Theme.colors.info(`\n  ${label} - Direct Execution`));
            console.log(theme_1.Theme.colors.muted('  ─────────────────────────────────────────────'));
            // Output the instruction directly (Claude will see this as instruction to follow)
            console.log(theme_1.Theme.colors.claudeCode(`\n  INSTRUCTION: ${fixPrompt.split('\n')[0]}`));
            if (fixPrompt.split('\n').length > 1) {
                console.log(theme_1.Theme.colors.muted(`  ... (${fixPrompt.split('\n').length - 1} more lines of context)`));
            }
            // Output completion message
            console.log(theme_1.Theme.colors.muted('\n  Claude will now execute this fix directly.\n'));
            // Return success - the current Claude session will process this
            return { success: true, output: 'Instruction provided to Claude' };
        }
        // EXTERNAL MODE: Run Claude CLI with streaming and auto-approval
        return new Promise((resolve) => {
            const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
            // Use --dangerously-skip-permissions for auto-approved fix execution
            // Note: --verbose is required when using --output-format stream-json with -p (--print)
            const claudeArgs = ['-p', '--verbose', '--output-format', 'stream-json', '--dangerously-skip-permissions'];
            console.log(theme_1.Theme.colors.info(`\n  ${label} - Executing...`));
            const child = (0, child_process_1.spawn)('claude', claudeArgs, {
                cwd: userCwd,
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });
            let buffer = '';
            let lastDisplayedText = '';
            let isFirstOutput = true;
            let finalOutput = '';
            child.stdin?.write(fixPrompt);
            child.stdin?.end();
            child.stdout?.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.type === 'assistant') {
                            if (event.message?.content) {
                                for (const block of event.message.content) {
                                    if (block.type === 'text') {
                                        const newText = block.text || '';
                                        if (newText.length > lastDisplayedText.length) {
                                            const delta = newText.substring(lastDisplayedText.length);
                                            if (isFirstOutput) {
                                                process.stdout.write(theme_1.Theme.colors.claudeCode('\n  │ '));
                                                isFirstOutput = false;
                                            }
                                            const formattedDelta = delta.replace(/\n/g, theme_1.Theme.colors.claudeCode('\n  │ '));
                                            process.stdout.write(theme_1.Theme.colors.claudeCode(formattedDelta));
                                            lastDisplayedText = newText;
                                        }
                                    }
                                }
                            }
                        }
                        else if (event.type === 'result') {
                            if (!isFirstOutput) {
                                process.stdout.write('\n');
                            }
                            finalOutput = event.result || '';
                        }
                    }
                    catch {
                        // Skip non-JSON lines
                    }
                }
            });
            child.stderr?.on('data', (data) => {
                const errorText = data.toString();
                if (errorText.includes('Error') || errorText.includes('error')) {
                    console.error(theme_1.Theme.colors.error(`  Error: ${errorText}`));
                }
            });
            child.on('close', (code) => {
                if (code === 0) {
                    console.log(theme_1.Theme.colors.success(`  ✓ ${label} completed`));
                    resolve({ success: true, output: finalOutput || lastDisplayedText });
                }
                else {
                    console.log(theme_1.Theme.colors.error(`  ✗ ${label} failed (exit code: ${code})`));
                    resolve({ success: false, output: finalOutput || lastDisplayedText });
                }
            });
            child.on('error', (err) => {
                console.error(theme_1.Theme.colors.error(`  ✗ Failed to start Claude: ${err.message}`));
                resolve({ success: false, output: err.message });
            });
        });
    }
    /**
     * Execute Claude Code with two-phase permission handling and feedback loop
     * Phase 1: Run Claude and collect proposed changes (permission denials)
     * Phase 2: If user approves, resume session with permissions to execute changes
     * Feedback Loop: If user provides feedback, retry with modified prompt
     */
    async executeClaudeCodeWithStreaming(enhancedPrompt) {
        let currentPrompt = enhancedPrompt;
        let allModifiedFiles = [];
        let iterationCount = 0;
        const MAX_ITERATIONS = 10; // Safety limit
        // Main feedback loop
        while (iterationCount < MAX_ITERATIONS) {
            iterationCount++;
            // Show compact context summary (only on first iteration or when prompt changes significantly)
            if (iterationCount === 1) {
                this.showCompactContextSummary(currentPrompt);
            }
            // Phase 1: Run Claude and collect proposed changes (with real-time streaming output)
            console.log(theme_1.Theme.colors.info(iterationCount === 1 ? '\n  🤖 Claude is thinking...' : '\n  🤖 Claude is re-analyzing with your feedback...'));
            const firstPhase = await this.executeClaudeFirstPhase(currentPrompt);
            // Note: Claude's response is already shown during streaming (real-time output)
            // The "Plan" box was removed to avoid showing the same content twice
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
                    console.log(theme_1.Theme.colors.muted('\n  Applying changes...'));
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
                }
                else if (approval.choice === 'no_feedback' && approval.feedback) {
                    // User provided feedback - incorporate into prompt and retry
                    console.log(theme_1.Theme.colors.info('\n  Retrying with your feedback...'));
                    // Build new prompt with feedback
                    currentPrompt = this.incorporateFeedback(enhancedPrompt, approval.feedback, iterationCount);
                    // Continue loop to retry
                    continue;
                }
                else if (approval.choice === 'cancelled') {
                    // User explicitly cancelled (Ctrl+C)
                    console.log(theme_1.Theme.colors.muted('\n  Operation cancelled.'));
                    return {
                        response: firstPhase.response,
                        filesToModify: allModifiedFiles,
                        summary: 'Operation cancelled by user'
                    };
                }
            }
            else {
                // No file changes proposed - check if this is expected or needs retry
                if (iterationCount === 1) {
                    // First attempt, no changes - this is fine
                    return {
                        response: firstPhase.response,
                        filesToModify: [],
                        summary: 'Claude Code has processed the request (no file changes needed)'
                    };
                }
                else {
                    // After feedback, still no changes - ask if user wants to try again
                    console.log(theme_1.Theme.colors.warning('\n  Claude didn\'t propose any file changes this time.'));
                    const continueChoice = await this.askToContinue();
                    if (continueChoice.choice === 'no_feedback' && continueChoice.feedback) {
                        currentPrompt = this.incorporateFeedback(enhancedPrompt, continueChoice.feedback, iterationCount);
                        continue;
                    }
                    else {
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
        console.log(theme_1.Theme.colors.warning('\n  Maximum retry attempts reached.'));
        return {
            response: 'Maximum retry attempts reached',
            filesToModify: allModifiedFiles,
            summary: 'Feedback loop exhausted after maximum iterations'
        };
    }
    /**
     * Incorporate user feedback into the prompt for retry
     */
    incorporateFeedback(originalPrompt, feedback, iteration) {
        return `${originalPrompt}

# User Feedback (Iteration ${iteration})
The user reviewed the proposed changes and requested modifications:
"${feedback}"

Please revise your approach based on this feedback and propose new changes.`;
    }
    /**
     * Ask user if they want to continue with more feedback
     */
    async askToContinue() {
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            const answer = await inquirer_1.default.prompt([
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
                const feedbackAnswer = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'feedback',
                        message: 'What should Claude do?',
                        validate: (input) => input.trim().length > 0 || 'Please provide guidance'
                    }
                ]);
                return { choice: 'no_feedback', feedback: feedbackAnswer.feedback };
            }
            return { choice: answer.choice };
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                return { choice: 'cancelled' };
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
    }
    /**
     * Show compact context summary - just a single line showing what's being sent
     * In verbose mode, shows full context details
     */
    showCompactContextSummary(prompt) {
        const lines = prompt.split('\n');
        const totalChars = prompt.length;
        // Extract file count from the prompt
        const filesMatch = prompt.match(/## Relevant Files\n([\s\S]*?)(?=\n##|\n#|$)/);
        const fileSection = filesMatch ? filesMatch[1] : '';
        const fileMatches = fileSection.match(/\*\*([^*]+)\*\*/g) || [];
        const fileCount = fileMatches.length;
        // Single compact line
        console.log(theme_1.Theme.colors.muted(`\n  📤 Sending: ${fileCount} files, ${lines.length} lines (${totalChars} chars)`));
        // In verbose mode, show full details
        if (this.verboseMode) {
            console.log(theme_1.Theme.colors.info('\n  ┌─ 🔍 Verbose: Full Context Details ─────────────────────────┐'));
            // Show files found
            if (fileMatches.length > 0) {
                console.log(theme_1.Theme.colors.muted('  │'));
                console.log(theme_1.Theme.colors.info('  │ Files:'));
                fileMatches.forEach(match => {
                    const fileName = match.replace(/\*\*/g, '');
                    console.log(theme_1.Theme.colors.muted('  │   ') + theme_1.Theme.colors.highlight(fileName));
                });
            }
            // Extract and show relationships
            const relMatch = prompt.match(/## Dependencies\n([\s\S]*?)(?=\n##|\n#|$)/);
            if (relMatch) {
                const relSection = relMatch[1];
                const relLines = relSection.split('\n').filter(l => l.trim().startsWith('-'));
                if (relLines.length > 0) {
                    console.log(theme_1.Theme.colors.muted('  │'));
                    console.log(theme_1.Theme.colors.info('  │ Relationships:'));
                    relLines.slice(0, 10).forEach(line => {
                        console.log(theme_1.Theme.colors.muted('  │   ') + theme_1.Theme.colors.muted(line.trim()));
                    });
                    if (relLines.length > 10) {
                        console.log(theme_1.Theme.colors.muted(`  │   ... and ${relLines.length - 10} more`));
                    }
                }
            }
            // Extract and show components
            const compMatch = prompt.match(/## Components\n([\s\S]*?)(?=\n##|\n#|$)/);
            if (compMatch) {
                const compSection = compMatch[1];
                const compLines = compSection.split('\n').filter(l => l.trim().startsWith('-'));
                if (compLines.length > 0) {
                    console.log(theme_1.Theme.colors.muted('  │'));
                    console.log(theme_1.Theme.colors.info('  │ Components:'));
                    compLines.slice(0, 8).forEach(line => {
                        console.log(theme_1.Theme.colors.muted('  │   ') + theme_1.Theme.colors.muted(line.trim()));
                    });
                    if (compLines.length > 8) {
                        console.log(theme_1.Theme.colors.muted(`  │   ... and ${compLines.length - 8} more`));
                    }
                }
            }
            console.log(theme_1.Theme.colors.muted('  │'));
            console.log(theme_1.Theme.colors.info('  │ Full Prompt:'));
            // Show full prompt with line numbers
            lines.forEach((line, i) => {
                const lineNum = String(i + 1).padStart(4, ' ');
                console.log(theme_1.Theme.colors.muted(`  │ ${lineNum} │ `) + line);
            });
            console.log(theme_1.Theme.colors.info('  └──────────────────────────────────────────────────────────────┘'));
        }
    }
    /**
     * Deduplicate proposed changes (same file path should only appear once)
     */
    deduplicateChanges(changes) {
        const seen = new Map();
        for (const change of changes) {
            // Keep the last change for each file path
            seen.set(change.filePath, change);
        }
        return Array.from(seen.values());
    }
    /**
     * Show what changes were applied
     */
    showAppliedChanges(changes) {
        console.log(theme_1.Theme.colors.success('\n✓ Changes applied:'));
        changes.forEach((change, i) => {
            const fileName = change.filePath.split(/[/\\]/).pop() || change.filePath;
            const operation = change.tool === 'Write' ? 'Created' : 'Modified';
            console.log(theme_1.Theme.colors.success(`  ${i + 1}. ${operation}: ${fileName}`));
        });
    }
    /**
     * Phase 1: Execute Claude and collect proposed changes without applying them
     * Uses stream-json format to show Claude's thinking in real-time
     */
    async executeClaudeFirstPhase(prompt) {
        return new Promise((resolve) => {
            const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
            // Use stream-json for real-time output with partial messages
            // Note: --verbose is required when using --output-format stream-json with -p (--print)
            const claudeArgs = ['-p', '--verbose', '--output-format', 'stream-json', '--include-partial-messages'];
            const child = (0, child_process_1.spawn)('claude', claudeArgs, {
                cwd: userCwd,
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });
            let buffer = '';
            let sessionId = '';
            let finalResult = '';
            const proposedChanges = [];
            let lastDisplayedText = '';
            let lastDisplayedThinking = '';
            let isFirstOutput = true;
            let currentToolName = '';
            let lastToolStatus = '';
            // Rotating spinner characters for thinking/processing states
            const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let spinnerIdx = 0;
            // Status verbs that Claude Code shows during processing
            const thinkingVerbs = ['Thinking', 'Reasoning', 'Analyzing', 'Processing', 'Planning', 'Considering'];
            let verbIdx = 0;
            child.stdin?.write(prompt);
            child.stdin?.end();
            child.stdout?.on('data', (data) => {
                buffer += data.toString();
                // Process complete JSON lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const event = JSON.parse(line);
                        // Handle different event types
                        if (event.type === 'assistant') {
                            // Partial assistant message - show Claude's thinking and reasoning
                            if (event.message?.content) {
                                for (const block of event.message.content) {
                                    // Handle thinking/reasoning blocks (Claude's internal reasoning)
                                    if (block.type === 'thinking') {
                                        const thinkingText = block.thinking || '';
                                        if (thinkingText.length > lastDisplayedThinking.length) {
                                            const delta = thinkingText.substring(lastDisplayedThinking.length);
                                            // Show thinking with a distinct prefix
                                            const spinner = spinnerFrames[spinnerIdx++ % spinnerFrames.length];
                                            const verb = thinkingVerbs[verbIdx % thinkingVerbs.length];
                                            if (lastDisplayedThinking === '') {
                                                process.stdout.write(theme_1.Theme.colors.muted(`\n  ${spinner} ${verb}...\n`));
                                                verbIdx++;
                                            }
                                            // Show reasoning in muted/dim color with thinking prefix
                                            const formattedDelta = delta.replace(/\n/g, theme_1.Theme.colors.muted('\n  │ '));
                                            process.stdout.write(theme_1.Theme.colors.muted(`  │ ${formattedDelta}`));
                                            lastDisplayedThinking = thinkingText;
                                        }
                                    }
                                    // Handle regular text output
                                    else if (block.type === 'text') {
                                        const newText = block.text || '';
                                        // Only show new text (delta)
                                        if (newText.length > lastDisplayedText.length) {
                                            const delta = newText.substring(lastDisplayedText.length);
                                            if (isFirstOutput) {
                                                // Start with Claude-themed bar prefix
                                                process.stdout.write(theme_1.Theme.colors.claudeCode('\n  │ '));
                                                isFirstOutput = false;
                                            }
                                            // Show Claude's thinking with Claude theme color and handle newlines
                                            const formattedDelta = delta.replace(/\n/g, theme_1.Theme.colors.claudeCode('\n  │ '));
                                            process.stdout.write(theme_1.Theme.colors.claudeCode(formattedDelta));
                                            lastDisplayedText = newText;
                                        }
                                    }
                                    // Handle tool use blocks (Read, Edit, Write, Bash, etc.)
                                    else if (block.type === 'tool_use') {
                                        const toolName = block.name || 'Tool';
                                        currentToolName = toolName;
                                        // Show tool invocation with spinner
                                        const spinner = spinnerFrames[spinnerIdx++ % spinnerFrames.length];
                                        const toolDisplay = this.formatToolDisplay(toolName, block.input);
                                        if (toolDisplay !== lastToolStatus) {
                                            process.stdout.write(theme_1.Theme.colors.info(`\n  ${spinner} ${toolDisplay}`));
                                            lastToolStatus = toolDisplay;
                                        }
                                    }
                                }
                            }
                        }
                        // Handle content_block_start events (tool starts)
                        else if (event.type === 'content_block_start') {
                            if (event.content_block?.type === 'tool_use') {
                                const toolName = event.content_block.name || 'Tool';
                                currentToolName = toolName;
                                const spinner = spinnerFrames[spinnerIdx++ % spinnerFrames.length];
                                process.stdout.write(theme_1.Theme.colors.info(`\n  ${spinner} Using ${toolName}...`));
                            }
                            else if (event.content_block?.type === 'thinking') {
                                const verb = thinkingVerbs[verbIdx++ % thinkingVerbs.length];
                                const spinner = spinnerFrames[spinnerIdx++ % spinnerFrames.length];
                                process.stdout.write(theme_1.Theme.colors.muted(`\n  ${spinner} ${verb}...`));
                            }
                        }
                        // Handle tool result events
                        else if (event.type === 'tool_result' || event.type === 'content_block_stop') {
                            if (currentToolName) {
                                process.stdout.write(theme_1.Theme.colors.success(' ✓'));
                                currentToolName = '';
                            }
                        }
                        else if (event.type === 'result') {
                            // Final result - extract session_id and permission_denials
                            if (!isFirstOutput) {
                                process.stdout.write('\n');
                            }
                            sessionId = event.session_id || '';
                            finalResult = event.result || '';
                            // Extract proposed changes from permission_denials
                            const denials = event.permission_denials || [];
                            for (const denial of denials) {
                                const isFileOperation = denial.tool_name === 'Write' || denial.tool_name === 'Edit';
                                const hasFilePath = denial.tool_input?.file_path;
                                if (isFileOperation && hasFilePath) {
                                    const change = {
                                        tool: denial.tool_name,
                                        filePath: denial.tool_input.file_path
                                    };
                                    if (denial.tool_name === 'Write') {
                                        change.content = denial.tool_input.content;
                                    }
                                    else if (denial.tool_name === 'Edit') {
                                        change.oldString = denial.tool_input.old_string;
                                        change.newString = denial.tool_input.new_string;
                                    }
                                    proposedChanges.push(change);
                                }
                            }
                        }
                    }
                    catch {
                        // Ignore parse errors for incomplete lines
                    }
                }
            });
            child.stderr?.on('data', (data) => {
                // Show stderr in real-time as errors
                const text = data.toString().trim();
                if (text) {
                    console.error(theme_1.Theme.colors.error(`\n  ${text}`));
                }
            });
            child.on('close', () => {
                // Process any remaining buffer
                if (buffer.trim()) {
                    try {
                        const event = JSON.parse(buffer);
                        if (event.type === 'result') {
                            sessionId = event.session_id || sessionId;
                            finalResult = event.result || finalResult;
                        }
                    }
                    catch {
                        // Ignore
                    }
                }
                // Parse and display test results if any (language-agnostic)
                const testResults = this.parseTestResults(lastDisplayedText);
                if (testResults) {
                    this.displayTestSummary(testResults);
                }
                resolve({
                    sessionId,
                    response: finalResult,
                    proposedChanges,
                    hasPermissionDenials: proposedChanges.length > 0
                });
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
     * Uses streaming output to show Claude's reasoning and progress in real-time
     */
    async executeClaudeSecondPhase(sessionId) {
        return new Promise((resolve) => {
            const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
            // Resume the session with permission mode to apply changes
            // Use stream-json for real-time output
            const claudeArgs = [
                '-p',
                '--verbose',
                '--resume', sessionId,
                '--permission-mode', 'acceptEdits',
                '--output-format', 'stream-json',
                '--include-partial-messages'
            ];
            const child = (0, child_process_1.spawn)('claude', claudeArgs, {
                cwd: userCwd,
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });
            let buffer = '';
            let finalResult = '';
            let lastDisplayedText = '';
            let isFirstOutput = true;
            let currentToolName = '';
            // Rotating spinner characters
            const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let spinnerIdx = 0;
            // Send a simple "proceed" message
            child.stdin?.write('Please proceed with the file changes.');
            child.stdin?.end();
            child.stdout?.on('data', (data) => {
                buffer += data.toString();
                // Process complete JSON lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.type === 'assistant') {
                            // Show Claude's reasoning during changes
                            if (event.message?.content) {
                                for (const block of event.message.content) {
                                    if (block.type === 'text') {
                                        const newText = block.text || '';
                                        if (newText.length > lastDisplayedText.length) {
                                            const delta = newText.substring(lastDisplayedText.length);
                                            if (isFirstOutput) {
                                                process.stdout.write(theme_1.Theme.colors.claudeCode('\n  │ '));
                                                isFirstOutput = false;
                                            }
                                            const formattedDelta = delta.replace(/\n/g, theme_1.Theme.colors.claudeCode('\n  │ '));
                                            process.stdout.write(theme_1.Theme.colors.claudeCode(formattedDelta));
                                            lastDisplayedText = newText;
                                        }
                                    }
                                    else if (block.type === 'tool_use') {
                                        // Show tool invocations (Write, Edit, etc.)
                                        const toolName = block.name || 'Tool';
                                        currentToolName = toolName;
                                        const spinner = spinnerFrames[spinnerIdx++ % spinnerFrames.length];
                                        const toolDisplay = this.formatToolDisplay(toolName, block.input);
                                        process.stdout.write(theme_1.Theme.colors.info(`\n  ${spinner} ${toolDisplay}`));
                                    }
                                }
                            }
                        }
                        else if (event.type === 'content_block_start') {
                            if (event.content_block?.type === 'tool_use') {
                                const toolName = event.content_block.name || 'Tool';
                                currentToolName = toolName;
                                const spinner = spinnerFrames[spinnerIdx++ % spinnerFrames.length];
                                process.stdout.write(theme_1.Theme.colors.info(`\n  ${spinner} Using ${toolName}...`));
                            }
                        }
                        else if (event.type === 'tool_result' || event.type === 'content_block_stop') {
                            if (currentToolName) {
                                process.stdout.write(theme_1.Theme.colors.success(' ✓'));
                                currentToolName = '';
                            }
                        }
                        else if (event.type === 'result') {
                            if (!isFirstOutput) {
                                process.stdout.write('\n');
                            }
                            finalResult = event.result || '';
                        }
                    }
                    catch {
                        // Ignore parse errors for incomplete lines
                    }
                }
            });
            child.stderr?.on('data', (data) => {
                const text = data.toString().trim();
                if (text && (text.includes('Error') || text.includes('error'))) {
                    console.error(theme_1.Theme.colors.error(`\n  ${text}`));
                }
            });
            child.on('close', () => {
                // Process any remaining buffer
                if (buffer.trim()) {
                    try {
                        const event = JSON.parse(buffer);
                        if (event.type === 'result') {
                            finalResult = event.result || finalResult;
                        }
                    }
                    catch {
                        // Ignore
                    }
                }
                resolve(finalResult || lastDisplayedText || 'Changes applied');
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
    async showProposedChangesAndConfirm(changes) {
        // If skip approval is enabled, auto-approve
        if (this.skipApproval) {
            console.log(theme_1.Theme.colors.muted(`\n  Auto-approving ${changes.length} change(s)...`));
            return { choice: 'yes' };
        }
        // Show full changes - no truncation
        console.log(theme_1.Theme.colors.warning('\n┌─ 📝 Proposed Changes ───────────────────────────��─────────┐'));
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            const fileName = change.filePath.split(/[/\\]/).pop() || change.filePath;
            const operation = change.tool === 'Write' ? '+ Create' : '~ Modify';
            const opColor = change.tool === 'Write' ? theme_1.Theme.colors.success : theme_1.Theme.colors.warning;
            console.log(theme_1.Theme.colors.muted('│'));
            console.log(theme_1.Theme.colors.muted('│ ') + opColor(`${operation}: ${change.filePath}`));
            if (change.tool === 'Write' && change.content) {
                // Show full file content for new files
                const contentLines = change.content.split('\n');
                console.log(theme_1.Theme.colors.muted('│'));
                contentLines.forEach(line => {
                    console.log(theme_1.Theme.colors.muted('│   ') + theme_1.Theme.colors.success(`+ ${line}`));
                });
            }
            else if (change.tool === 'Edit') {
                // Show full diff view
                if (change.oldString) {
                    console.log(theme_1.Theme.colors.muted('│'));
                    const oldLines = change.oldString.split('\n');
                    oldLines.forEach(line => {
                        console.log(theme_1.Theme.colors.muted('│   ') + theme_1.Theme.colors.error(`- ${line}`));
                    });
                }
                if (change.newString) {
                    console.log(theme_1.Theme.colors.muted('│'));
                    const newLines = change.newString.split('\n');
                    newLines.forEach(line => {
                        console.log(theme_1.Theme.colors.muted('│   ') + theme_1.Theme.colors.success(`+ ${line}`));
                    });
                }
            }
        }
        console.log(theme_1.Theme.colors.muted('│'));
        console.log(theme_1.Theme.colors.warning('└───────────────────────────────────────────────────────────┘'));
        // Ask for confirmation with list-style prompt (like Claude Code)
        // Note: No standalone "No" option - user must provide feedback or cancel with Ctrl+C
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: `Apply ${changes.length} change(s)?`,
                    choices: [
                        { name: 'Yes', value: 'yes' },
                        { name: 'Yes, and don\'t ask again', value: 'yes_always' },
                        { name: 'No, and tell me what to do differently', value: 'no_feedback' }
                    ],
                    default: 'yes'
                }
            ]);
            // If user wants to provide feedback, prompt for it
            if (answer.choice === 'no_feedback') {
                const feedbackAnswer = await inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'feedback',
                        message: 'What should be done differently?',
                        validate: (input) => input.trim().length > 0 || 'Please provide feedback (or Ctrl+C to cancel)'
                    }
                ]);
                return { choice: 'no_feedback', feedback: feedbackAnswer.feedback };
            }
            return { choice: answer.choice };
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                console.log('\n⚠️  Cancelled');
                return { choice: 'cancelled' };
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
    }
    /**
     * This method is now deprecated - file changes are confirmed before being applied
     * via showProposedChangesAndConfirm. Keeping for backwards compatibility.
     */
    async confirmFileModifications(_filesToModify) {
        // Changes are now confirmed via showProposedChangesAndConfirm before being applied
        // This method is kept for backwards compatibility but no longer prompts
        return { approved: true, dontAskAgain: true };
    }
    /**
     * Ask user what verification steps to run after changes
     */
    async confirmBuildAndTest() {
        if (this.skipApproval) {
            return { runBuild: true, runTests: true, generateTests: false };
        }
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            console.log(theme_1.Theme.sectionTitle('Verification Options', '🔍'));
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'checkbox',
                    name: 'options',
                    message: 'Select verification steps to run:',
                    choices: [
                        { name: '🔨 Run build (npm run build)', value: 'build', checked: true },
                        { name: '🧪 Run existing tests (npm test)', value: 'test', checked: true },
                        { name: '📝 Generate new tests for changed files', value: 'generate_tests', checked: false }
                    ]
                }
            ]);
            const options = {
                runBuild: answer.options.includes('build'),
                runTests: answer.options.includes('test'),
                generateTests: answer.options.includes('generate_tests')
            };
            // If generate tests is selected, ask for test type
            if (options.generateTests) {
                const testTypeAnswer = await inquirer_1.default.prompt([
                    {
                        type: 'list',
                        name: 'testType',
                        message: 'What type of tests to generate?',
                        choices: [
                            { name: '🔬 Unit tests (test individual functions/classes in isolation)', value: 'unit' },
                            { name: '🔗 Integration tests (test component interactions)', value: 'integration' },
                            { name: '🖥️  E2E tests (test full user workflows)', value: 'e2e' }
                        ],
                        default: 'unit'
                    }
                ]);
                options.testType = testTypeAnswer.testType;
            }
            // If nothing selected, confirm skip
            if (!options.runBuild && !options.runTests && !options.generateTests) {
                const skipConfirm = await inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'skip',
                        message: 'Skip all verification?',
                        default: false
                    }
                ]);
                if (!skipConfirm.skip) {
                    logger_1.Logger.unmute();
                    this.resumeReadline();
                    return this.confirmBuildAndTest();
                }
            }
            return options;
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                console.log('\n⚠️  Prompt cancelled');
                return { runBuild: false, runTests: false, generateTests: false, cancelled: true };
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
    }
    /**
     * Ask user how to handle build/test failure
     */
    async promptFailureAction(failureType, errorMessage) {
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            console.log(theme_1.Theme.colors.error(`\n  ❌ ${failureType === 'build' ? 'Build' : 'Test'} failed`));
            console.log(theme_1.Theme.colors.muted(`  Error: ${errorMessage.substring(0, 200)}${errorMessage.length > 200 ? '...' : ''}\n`));
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: `How would you like to handle the ${failureType} failure?`,
                    choices: [
                        { name: `🔧 Ask Claude to fix the ${failureType} error`, value: 'fix' },
                        { name: '⏭️  Continue anyway (skip this step)', value: 'continue' },
                        { name: '📋 Show full error output', value: 'show_error' },
                        { name: '❌ Abort workflow', value: 'abort' }
                    ]
                }
            ]);
            return { action: answer.action, errorMessage };
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                return { action: 'abort', errorMessage };
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
    }
    /**
     * Ask user how to continue after an interruption
     * Used when user provides new input while a Claude session is active
     * @param hasActiveSession Whether there's an active Claude session that can be resumed
     * @returns The user's choice: continue (forward to Claude), new_search (fresh CodeMind search), or cancel
     */
    async promptContinuationChoice(hasActiveSession) {
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            const choices = hasActiveSession
                ? [
                    { name: 'Continue conversation (forward to Claude)', value: 'continue' },
                    { name: 'New search (find relevant files first)', value: 'new_search' },
                    { name: 'Cancel', value: 'cancel' }
                ]
                : [
                    { name: 'New search (find relevant files first)', value: 'new_search' },
                    { name: 'Skip search (pass directly to Claude)', value: 'continue' },
                    { name: 'Cancel', value: 'cancel' }
                ];
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: 'How should I continue?',
                    choices,
                    default: hasActiveSession ? 'continue' : 'new_search'
                }
            ]);
            return answer.choice;
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                return 'cancel';
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
    }
    /**
     * Check if cancellation was requested
     */
    wasCancelled() {
        return this.isCancelled;
    }
    /**
     * Reset cancellation flag
     */
    resetCancellation() {
        this.isCancelled = false;
    }
    /**
     * Get current search mode status
     */
    isSearchEnabled() {
        return this.searchModeEnabled;
    }
    /**
     * Set search mode enabled/disabled
     */
    setSearchMode(enabled) {
        this.searchModeEnabled = enabled;
    }
    /**
     * Toggle search mode on/off
     */
    toggleSearchMode() {
        this.searchModeEnabled = !this.searchModeEnabled;
        return this.searchModeEnabled;
    }
    /**
     * Prepare search mode for a new prompt
     * In REPL mode: First prompt = ON, subsequent prompts = OFF by default
     * In -c mode: Always ON (called with forceOn=true)
     * @param forceOn If true, always enable search (used for -c mode)
     */
    prepareForNewPrompt(forceOn = false) {
        if (forceOn) {
            // -c mode: always search
            this.searchModeEnabled = true;
        }
        else if (this.isFirstPromptInSession) {
            // REPL mode first prompt: enable search
            this.searchModeEnabled = true;
            this.isFirstPromptInSession = false;
        }
        else {
            // REPL mode subsequent prompts: disable search by default
            this.searchModeEnabled = false;
        }
    }
    /**
     * Mark a conversation as complete (for REPL mode)
     * After a conversation, search defaults to OFF for the next prompt
     */
    markConversationComplete() {
        // Don't change isFirstPromptInSession - it stays false after first use
        // searchModeEnabled will be set to false on next prepareForNewPrompt() call
    }
    /**
     * Reset session state (for new REPL sessions)
     */
    resetSession() {
        this.isFirstPromptInSession = true;
        this.searchModeEnabled = true;
    }
    /**
     * Show a compact pre-prompt menu for search mode toggle
     * Returns the user's choice and their prompt
     * @param hasActiveSession Whether there's an active Claude session (for context)
     */
    async promptWithSearchToggle(hasActiveSession = false) {
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            // Show current mode status
            const modeIndicator = this.searchModeEnabled
                ? theme_1.Theme.colors.success('🔍 Search: ON')
                : theme_1.Theme.colors.muted('🔍 Search: OFF');
            console.log(`\n  ${modeIndicator}`);
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Options:',
                    choices: [
                        {
                            name: `Enter prompt ${this.searchModeEnabled ? '(with search)' : '(direct to Claude)'}`,
                            value: 'prompt'
                        },
                        {
                            name: this.searchModeEnabled
                                ? 'Turn OFF search (skip file discovery)'
                                : 'Turn ON search (find relevant files first)',
                            value: 'toggle'
                        },
                        { name: 'Cancel', value: 'cancel' }
                    ],
                    default: 'prompt'
                }
            ]);
            // Handle toggle action - recursively call to show updated menu
            if (answer.action === 'toggle') {
                this.toggleSearchMode();
                logger_1.Logger.unmute();
                this.resumeReadline();
                return this.promptWithSearchToggle(hasActiveSession);
            }
            // Handle cancel
            if (answer.action === 'cancel') {
                return { searchEnabled: this.searchModeEnabled, prompt: '', cancelled: true };
            }
            // Get the user's prompt
            const promptAnswer = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'userPrompt',
                    message: '💬',
                    validate: (input) => input.trim().length > 0 || 'Please enter a prompt (or Ctrl+C to cancel)'
                }
            ]);
            return {
                searchEnabled: this.searchModeEnabled,
                prompt: promptAnswer.userPrompt.trim(),
                cancelled: false
            };
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                return { searchEnabled: this.searchModeEnabled, prompt: '', cancelled: true };
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
    }
    /**
     * Show a minimal inline search toggle (single key press style)
     * For quick mode switching without a full menu
     * Format: "[S] Search: ON/OFF | Enter prompt:"
     */
    async promptWithInlineToggle() {
        this.pauseReadline();
        logger_1.Logger.mute();
        try {
            // Compact inline display
            const searchStatus = this.searchModeEnabled ? 'ON' : 'OFF';
            const statusColor = this.searchModeEnabled ? theme_1.Theme.colors.success : theme_1.Theme.colors.muted;
            console.log(theme_1.Theme.colors.muted(`\n  [s] to toggle search | `) + statusColor(`Search: ${searchStatus}`));
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'input',
                    message: '›',
                    validate: (input) => {
                        const trimmed = input.trim().toLowerCase();
                        // Allow 's' to toggle, empty is not allowed, anything else is the prompt
                        if (trimmed === '') {
                            return 'Enter your prompt, or type "s" to toggle search mode';
                        }
                        return true;
                    }
                }
            ]);
            const input = answer.input.trim();
            // Check if user wants to toggle
            if (input.toLowerCase() === 's') {
                this.toggleSearchMode();
                logger_1.Logger.unmute();
                this.resumeReadline();
                // Recursively show the prompt again with updated status
                return this.promptWithInlineToggle();
            }
            return {
                searchEnabled: this.searchModeEnabled,
                prompt: input,
                cancelled: false
            };
        }
        catch (error) {
            if (error.name === 'ExitPromptError' || error.message?.includes('force closed')) {
                return { searchEnabled: this.searchModeEnabled, prompt: '', cancelled: true };
            }
            throw error;
        }
        finally {
            logger_1.Logger.unmute();
            this.resumeReadline();
        }
    }
    /**
     * Get the search toggle indicator string for display
     * Returns a radio-button style indicator like "( * ) Search files" or "( ) Search files"
     * @param enabled Optional override for the search state, defaults to current state
     */
    getSearchToggleIndicator(enabled) {
        const isEnabled = enabled !== undefined ? enabled : this.searchModeEnabled;
        const radioButton = isEnabled ? '(*)' : '( )';
        const color = isEnabled ? theme_1.Theme.colors.success : theme_1.Theme.colors.muted;
        return color(`${radioButton} Search files and knowledge graph`);
    }
    /**
     * Display the search toggle indicator (for use before prompts)
     * Shows: "( * ) Search files and knowledge graph" or "( ) Search files and knowledge graph"
     * Also shows toggle hint: "[s] to toggle"
     */
    displaySearchToggleIndicator() {
        const indicator = this.getSearchToggleIndicator();
        const toggleHint = theme_1.Theme.colors.muted('[s] toggle');
        console.log(`\n  ${indicator}  ${toggleHint}`);
    }
    /**
     * Check if input is a search toggle command
     * Returns true if input is 's' or '/s' (toggle search)
     */
    isSearchToggleCommand(input) {
        const trimmed = input.trim().toLowerCase();
        return trimmed === 's' || trimmed === '/s';
    }
    /**
     * Display execution summary
     */
    displayExecutionSummary(summary, stats) {
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
    generateClarificationQuestions(queryAnalysis) {
        const questions = [];
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
     * Parse test results from Claude's output (language-agnostic)
     * Supports: Jest, Mocha, pytest, Go test, Cargo test, PHPUnit, RSpec, JUnit, etc.
     */
    parseTestResults(output) {
        if (!output)
            return null;
        // Pattern matchers for different test frameworks
        const patterns = [
            // Jest/Vitest: "Tests: 5 passed, 2 failed, 7 total" or "Tests:  42 passed, 42 total"
            {
                regex: /Tests:\s*(\d+)\s*passed(?:,\s*(\d+)\s*failed)?(?:,\s*(\d+)\s*skipped)?(?:,\s*(\d+)\s*total)?/i,
                framework: 'jest',
                extractor: (m) => ({
                    passed: parseInt(m[1]) || 0,
                    failed: parseInt(m[2]) || 0,
                    skipped: parseInt(m[3]) || 0,
                    total: parseInt(m[4]) || (parseInt(m[1]) || 0) + (parseInt(m[2]) || 0) + (parseInt(m[3]) || 0),
                    framework: 'jest'
                })
            },
            // Mocha: "5 passing" / "2 failing" / "1 pending"
            {
                regex: /(\d+)\s*passing.*?(?:(\d+)\s*failing)?.*?(?:(\d+)\s*pending)?/is,
                framework: 'mocha',
                extractor: (m) => ({
                    passed: parseInt(m[1]) || 0,
                    failed: parseInt(m[2]) || 0,
                    skipped: parseInt(m[3]) || 0,
                    total: (parseInt(m[1]) || 0) + (parseInt(m[2]) || 0) + (parseInt(m[3]) || 0),
                    framework: 'mocha'
                })
            },
            // pytest: "5 passed, 2 failed, 1 skipped" or "===== 5 passed in 0.12s ====="
            {
                regex: /(?:=+\s*)?(\d+)\s*passed(?:[,\s]+(\d+)\s*failed)?(?:[,\s]+(\d+)\s*skipped)?/i,
                framework: 'pytest',
                extractor: (m) => ({
                    passed: parseInt(m[1]) || 0,
                    failed: parseInt(m[2]) || 0,
                    skipped: parseInt(m[3]) || 0,
                    total: (parseInt(m[1]) || 0) + (parseInt(m[2]) || 0) + (parseInt(m[3]) || 0),
                    framework: 'pytest'
                })
            },
            // Go test: "ok  	package	0.123s" (counts ok lines) or "PASS" / "FAIL"
            {
                regex: /(?:^|\n)(?:ok\s+|PASS\s*$)/gm,
                framework: 'go',
                extractor: (m) => {
                    // For Go, we need to count all matches
                    const okMatches = output.match(/(?:^|\n)ok\s+/gm) || [];
                    const failMatches = output.match(/(?:^|\n)FAIL\s+/gm) || [];
                    const passed = okMatches.length || (output.includes('PASS') ? 1 : 0);
                    const failed = failMatches.length;
                    return {
                        passed,
                        failed,
                        total: passed + failed,
                        framework: 'go'
                    };
                }
            },
            // Cargo test (Rust): "test result: ok. 5 passed; 0 failed; 0 ignored"
            {
                regex: /test result:\s*(?:ok|FAILED)\.\s*(\d+)\s*passed;\s*(\d+)\s*failed;\s*(\d+)\s*ignored/i,
                framework: 'cargo',
                extractor: (m) => ({
                    passed: parseInt(m[1]) || 0,
                    failed: parseInt(m[2]) || 0,
                    skipped: parseInt(m[3]) || 0,
                    total: (parseInt(m[1]) || 0) + (parseInt(m[2]) || 0) + (parseInt(m[3]) || 0),
                    framework: 'cargo'
                })
            },
            // PHPUnit: "OK (5 tests, 10 assertions)" or "FAILURES! Tests: 5, Failures: 2"
            {
                regex: /(?:OK\s*\((\d+)\s*tests?|Tests:\s*(\d+),\s*(?:Assertions:\s*\d+,\s*)?Failures:\s*(\d+))/i,
                framework: 'phpunit',
                extractor: (m) => {
                    if (m[1]) {
                        // OK case
                        return { passed: parseInt(m[1]), failed: 0, total: parseInt(m[1]), framework: 'phpunit' };
                    }
                    // FAILURES case
                    const total = parseInt(m[2]) || 0;
                    const failed = parseInt(m[3]) || 0;
                    return { passed: total - failed, failed, total, framework: 'phpunit' };
                }
            },
            // RSpec (Ruby): "5 examples, 2 failures, 1 pending"
            {
                regex: /(\d+)\s*examples?,\s*(\d+)\s*failures?(?:,\s*(\d+)\s*pending)?/i,
                framework: 'rspec',
                extractor: (m) => ({
                    passed: (parseInt(m[1]) || 0) - (parseInt(m[2]) || 0) - (parseInt(m[3]) || 0),
                    failed: parseInt(m[2]) || 0,
                    skipped: parseInt(m[3]) || 0,
                    total: parseInt(m[1]) || 0,
                    framework: 'rspec'
                })
            },
            // JUnit/Maven/Gradle: "Tests run: 5, Failures: 1, Errors: 0, Skipped: 1"
            {
                regex: /Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+)(?:,\s*Skipped:\s*(\d+))?/i,
                framework: 'junit',
                extractor: (m) => {
                    const total = parseInt(m[1]) || 0;
                    const failures = parseInt(m[2]) || 0;
                    const errors = parseInt(m[3]) || 0;
                    const skipped = parseInt(m[4]) || 0;
                    return {
                        passed: total - failures - errors - skipped,
                        failed: failures + errors,
                        skipped,
                        total,
                        framework: 'junit'
                    };
                }
            },
            // .NET/NUnit/xUnit: "Passed: 5, Failed: 2, Skipped: 1, Total: 8"
            {
                regex: /(?:Passed|Passed!):\s*(\d+)(?:.*?Failed:\s*(\d+))?(?:.*?Skipped:\s*(\d+))?(?:.*?Total:\s*(\d+))?/i,
                framework: 'dotnet',
                extractor: (m) => ({
                    passed: parseInt(m[1]) || 0,
                    failed: parseInt(m[2]) || 0,
                    skipped: parseInt(m[3]) || 0,
                    total: parseInt(m[4]) || (parseInt(m[1]) || 0) + (parseInt(m[2]) || 0) + (parseInt(m[3]) || 0),
                    framework: 'dotnet'
                })
            }
        ];
        // Try each pattern
        for (const { regex, extractor } of patterns) {
            const match = output.match(regex);
            if (match) {
                const result = extractor(match);
                // Validate we got meaningful results
                if (result.total > 0 || result.passed > 0 || result.failed > 0) {
                    return result;
                }
            }
        }
        return null;
    }
    /**
     * Display test result summary in a user-friendly format
     */
    displayTestSummary(summary) {
        const { passed, failed, skipped, framework } = summary;
        if (failed === 0) {
            // All tests passed
            console.log(theme_1.Theme.colors.success(`\n  ✅ ${passed} test${passed !== 1 ? 's' : ''} passed`));
        }
        else {
            // Some tests failed
            console.log(theme_1.Theme.colors.error(`\n  ❌ ${failed} test${failed !== 1 ? 's' : ''} failed, ${passed} passed`));
        }
        // Show skipped if any
        if (skipped && skipped > 0) {
            console.log(theme_1.Theme.colors.warning(`     ⏭️  ${skipped} skipped`));
        }
        // Show framework if detected
        if (framework) {
            console.log(theme_1.Theme.colors.muted(`     (${framework})`));
        }
    }
    /**
     * Format tool invocation for display
     * Shows human-readable descriptions like "Reading src/file.ts" or "Editing config.json"
     */
    formatToolDisplay(toolName, input) {
        const filePath = input?.file_path || input?.path || '';
        const fileName = filePath ? filePath.split(/[/\\]/).pop() : '';
        switch (toolName.toLowerCase()) {
            case 'read':
                return fileName ? `Reading ${fileName}` : 'Reading file...';
            case 'edit':
                return fileName ? `Editing ${fileName}` : 'Editing file...';
            case 'write':
                return fileName ? `Writing ${fileName}` : 'Writing file...';
            case 'bash':
                const cmd = input?.command || '';
                const shortCmd = cmd.length > 40 ? cmd.substring(0, 37) + '...' : cmd;
                return shortCmd ? `Running: ${shortCmd}` : 'Running command...';
            case 'glob':
                return input?.pattern ? `Searching: ${input.pattern}` : 'Searching files...';
            case 'grep':
                return input?.pattern ? `Grep: ${input.pattern}` : 'Searching content...';
            case 'todowrite':
                return 'Updating task list...';
            case 'task':
                return 'Launching sub-agent...';
            default:
                return `${toolName}...`;
        }
    }
    /**
     * Parse Claude Code response to extract files and summary
     */
    parseClaudeResponse(output) {
        // In a real implementation, this would parse Claude's structured output
        // For now, return a basic structure
        const filesToModify = [];
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
exports.UserInteractionService = UserInteractionService;
//# sourceMappingURL=user-interaction-service.js.map