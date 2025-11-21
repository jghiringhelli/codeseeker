"use strict";
/**
 * User Interaction Service
 * Single Responsibility: Handle user interactions and Claude Code detection
 * Manages user clarification prompts and Claude Code command execution
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInteractionService = void 0;
const platform_utils_1 = require("../../../shared/platform-utils");
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const inquirer_1 = __importDefault(require("inquirer"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class UserInteractionService {
    tempDir;
    rl;
    constructor() {
        this.tempDir = platform_utils_1.PlatformUtils.getTempDir();
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
        console.log('\n🤔 CodeMind detected some assumptions and ambiguities in your request.');
        console.log('Please help clarify the following:\n');
        this.pauseReadline();
        try {
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
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
        }
        finally {
            this.resumeReadline();
        }
        return clarifications;
    }
    /**
     * Execute Claude Code with enhanced prompt
     */
    async executeClaudeCode(enhancedPrompt) {
        try {
            // Check if running inside Claude Code (avoid recursion)
            if (platform_utils_1.PlatformUtils.isRunningInClaudeCode()) {
                console.log('🔄 Running inside Claude Code - using simulation mode');
                return this.simulateClaudeResponse(enhancedPrompt);
            }
            // Create temporary file for the prompt
            const promptFile = path.join(this.tempDir, `codemind-prompt-${Date.now()}.txt`);
            await fs.writeFile(promptFile, enhancedPrompt, 'utf8');
            // Execute Claude Code command
            const command = platform_utils_1.PlatformUtils.getClaudeCodeCommand(promptFile);
            console.log(`\n🚀 Executing Claude Code...`);
            const { stdout, stderr } = await execAsync(command, {
                ...platform_utils_1.PlatformUtils.getExecOptions(),
                timeout: 120000 // 2 minute timeout
            });
            // Clean up temp file
            await fs.unlink(promptFile).catch(() => { }); // Ignore errors
            if (stderr && !stderr.includes('warning')) {
                console.warn('⚠️  Claude Code warnings:', stderr);
            }
            return this.parseClaudeResponse(stdout);
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
     * Show file analysis results (not actual modifications)
     */
    async confirmFileModifications(filesToModify) {
        if (filesToModify.length === 0) {
            return { approved: true, dontAskAgain: false };
        }
        // NOTE: These are not actual modifications, just files found by search
        // The current implementation is misleading - these are search results, not diffs
        console.log('\n📁 Files found relevant to your request:');
        filesToModify.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file}`);
        });
        this.pauseReadline();
        try {
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: 'Would you like to proceed with analysis of these files?',
                    choices: [
                        { name: 'Yes, continue analysis', value: 'y' },
                        { name: 'No, skip analysis', value: 'n' },
                        { name: 'Yes, and don\'t ask me again for this session', value: 'a' }
                    ]
                }
            ]);
            return {
                approved: answer.choice !== 'n',
                dontAskAgain: answer.choice === 'a'
            };
        }
        finally {
            this.resumeReadline();
        }
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
     * Simulate user input for clarification questions
     */
    async getSimulatedUserInput(question) {
        // In a real implementation, this would use readline or inquirer
        // For now, provide reasonable default answers based on question type
        if (question.includes('authentication')) {
            return 'JWT-based authentication with middleware';
        }
        if (question.includes('database')) {
            return 'Users table and related authentication models';
        }
        if (question.includes('API')) {
            return 'REST endpoint with proper error handling';
        }
        if (question.includes('tests')) {
            return 'Unit tests for business logic and integration tests for API endpoints';
        }
        if (question.includes('files or components')) {
            return 'API routes and middleware components';
        }
        if (question.includes('improvements')) {
            return 'Security and code maintainability';
        }
        if (question.includes('similar to')) {
            return 'Follow existing project patterns and conventions';
        }
        return 'Follow project standards and best practices';
    }
    /**
     * Simulate Claude Code response when running inside Claude Code environment
     */
    simulateClaudeResponse(prompt) {
        return {
            response: 'Simulated Claude Code response - running in fallback mode within Claude Code environment',
            filesToModify: ['src/api/middleware/auth.ts', 'src/api/routes/auth.ts'],
            summary: 'Authentication middleware and routes would be implemented based on the enhanced prompt'
        };
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