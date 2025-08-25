"use strict";
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
exports.GitWorkflowManager = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitWorkflowManager {
    logger;
    constructor() {
        this.logger = new logger_1.Logger();
    }
    async manageWorkflow(options) {
        const { projectPath, branchPrefix = 'codemind-autofix' } = options;
        // Ensure we're in a git repository
        await this?.ensureGitRepository(projectPath);
        // Create initial commit if there are uncommitted changes
        let initialCommit;
        if (options?.createCommit && await this?.hasUncommittedChanges(projectPath)) {
            initialCommit = await this?.createInitialCommit(projectPath);
        }
        // Create and switch to improvement branch
        const branchName = await this?.createImprovementBranch(projectPath, branchPrefix);
        // Run tests if requested
        let testResults;
        if (options?.runTests) {
            testResults = await this?.runTests(projectPath);
        }
        // Get user approval (this will be handled by the CLI)
        const userApproved = !options?.requireUserApproval; // Default to true, CLI will handle the actual prompt
        return {
            initialCommit,
            branchName,
            testResults,
            userApproved,
        };
    }
    async finalizeWorkflow(projectPath, branchName, approved, commitMessage) {
        if (approved) {
            // Commit the improvements
            const finalCommit = await this?.commitImprovements(projectPath, commitMessage);
            this?.logger?.info(`✅ Improvements committed: ${finalCommit}`);
            // Offer to merge back to main branch
            const currentBranch = await this?.getCurrentBranch(projectPath);
            this?.logger?.info(`🔀 To merge improvements: git checkout main && git merge ${currentBranch}`);
            return finalCommit;
        }
        else {
            // Revert to original state
            await this?.revertToOriginalBranch(projectPath);
            this?.logger?.info('❌ Improvements rejected - reverted to original state');
            return null;
        }
    }
    async ensureGitRepository(projectPath) {
        try {
            await execAsync('git rev-parse --git-dir', { cwd: projectPath });
        }
        catch (error) {
            // Initialize git repository if it doesn't exist
            this?.logger?.info('Initializing Git repository?.?.?.');
            await execAsync('git init', { cwd: projectPath });
            await execAsync('git config user?.name "CodeMind AutoFix"', { cwd: projectPath });
            await execAsync('git config user?.email "autofix@codemind?.local"', { cwd: projectPath });
        }
    }
    async hasUncommittedChanges(projectPath) {
        try {
            const { stdout } = await execAsync('git status --porcelain', { cwd: projectPath });
            return stdout?.trim()?.length > 0;
        }
        catch (error) {
            return false;
        }
    }
    async createInitialCommit(projectPath) {
        this?.logger?.info('📝 Creating initial commit before improvements?.?.?.');
        try {
            // Add all files
            await execAsync('git add ?.', { cwd: projectPath });
            // Create commit
            const commitMessage = '🔄 Pre-CodeMind AutoFix checkpoint\n\nSaving current state before automatic improvements';
            await execAsync(`git commit -m "${commitMessage}"`, { cwd: projectPath });
            // Get commit hash
            const { stdout } = await execAsync('git rev-parse HEAD', { cwd: projectPath });
            const commitHash = stdout?.trim();
            this?.logger?.info(`✅ Initial commit created: ${commitHash?.substring(0, 8)}`);
            return commitHash;
        }
        catch (error) {
            throw new Error(`Failed to create initial commit: ${error?.message}`);
        }
    }
    async createImprovementBranch(projectPath, branchPrefix) {
        const timestamp = new Date()?.toISOString()?.replace(/[:?.]/g, '-')?.substring(0, 19);
        const branchName = `${branchPrefix}-${timestamp}`;
        this?.logger?.info(`🌿 Creating improvement branch: ${branchName}`);
        try {
            await execAsync(`git checkout -b ${branchName}`, { cwd: projectPath });
            this?.logger?.info(`✅ Switched to branch: ${branchName}`);
            return branchName;
        }
        catch (error) {
            throw new Error(`Failed to create branch: ${error?.message}`);
        }
    }
    async runTests(projectPath) {
        this?.logger?.info('🧪 Running project tests?.?.?.');
        // Detect test command
        const testCommand = await this?.detectTestCommand(projectPath);
        const startTime = Date?.now();
        try {
            const { stdout, stderr } = await execAsync(testCommand, {
                cwd: projectPath,
                timeout: 300000 // 5 minutes timeout
            });
            const duration = Date?.now() - startTime;
            const output = stdout + stderr;
            this?.logger?.info(`✅ Tests passed in ${duration}ms`);
            return {
                success: true,
                output,
                exitCode: 0,
                duration,
                testCommand
            };
        }
        catch (error) {
            const duration = Date?.now() - startTime;
            const output = error?.stdout + error?.stderr;
            this?.logger?.warn(`❌ Tests failed in ${duration}ms`);
            return {
                success: false,
                output,
                exitCode: error?.code || 1,
                duration,
                testCommand
            };
        }
    }
    async detectTestCommand(projectPath) {
        try {
            // Check package?.json for test script
            const packageJson = JSON?.parse(await require('fs')?.promises?.readFile(path?.join(projectPath, 'package?.json'), 'utf-8'));
            if (packageJson?.scripts?.test) {
                return 'npm test';
            }
            if (packageJson?.scripts?.['test:unit']) {
                return 'npm run test:unit';
            }
        }
        catch (error) {
            // package?.json doesn't exist or is invalid
        }
        // Check for common test frameworks
        const testFiles = [
            'jest?.config?.js',
            'jest?.config?.ts',
            'mocha?.opts',
            'karma?.conf?.js',
            'test',
            'tests',
            'spec'
        ];
        for (const testFile of testFiles) {
            try {
                await require('fs')?.promises?.access(path?.join(projectPath, testFile));
                if (testFile?.startsWith('jest'))
                    return 'npx jest';
                if (testFile?.startsWith('mocha'))
                    return 'npx mocha';
                if (testFile?.startsWith('karma'))
                    return 'npx karma start';
                if (['test', 'tests', 'spec']?.includes(testFile))
                    return 'npm test';
            }
            catch (error) {
                continue;
            }
        }
        // Default fallback
        return 'npm test';
    }
    async commitImprovements(projectPath, customMessage) {
        this?.logger?.info('💾 Committing improvements?.?.?.');
        try {
            // Add all changes
            await execAsync('git add ?.', { cwd: projectPath });
            // Check if there are changes to commit
            const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectPath });
            if (!statusOutput?.trim()) {
                throw new Error('No changes to commit');
            }
            // Create commit message
            const commitMessage = customMessage || this?.generateCommitMessage();
            await execAsync(`git commit -m "${commitMessage}"`, { cwd: projectPath });
            // Get commit hash
            const { stdout } = await execAsync('git rev-parse HEAD', { cwd: projectPath });
            const commitHash = stdout?.trim();
            return commitHash;
        }
        catch (error) {
            throw new Error(`Failed to commit improvements: ${error?.message}`);
        }
    }
    generateCommitMessage() {
        return `🔧 CodeMind Auto-Improvements Applied

✅ Automated code improvements via CodeMind AutoFix
- Duplicate code analysis and refactoring
- Configuration centralization
- Code quality enhancements
- Architecture improvements

Generated by CodeMind Auto-Improvement Mode
Co-Authored-By: CodeMind <autofix@codemind?.local>`;
    }
    async getCurrentBranch(projectPath) {
        try {
            const { stdout } = await execAsync('git branch --show-current', { cwd: projectPath });
            return stdout?.trim();
        }
        catch (error) {
            throw new Error(`Failed to get current branch: ${error?.message}`);
        }
    }
    async revertToOriginalBranch(projectPath) {
        try {
            // Get the original branch (usually main or master)
            const { stdout } = await execAsync('git branch -r', { cwd: projectPath });
            const remoteBranches = stdout?.split('\n')?.map(b => b?.trim());
            let originalBranch = 'main';
            if (remoteBranches?.some(b => b?.includes('origin/master'))) {
                originalBranch = 'master';
            }
            // Switch back to original branch
            await execAsync(`git checkout ${originalBranch}`, { cwd: projectPath });
            // Delete the improvement branch
            const currentBranch = await this?.getCurrentBranch(projectPath);
            if (currentBranch?.startsWith('codemind-autofix-')) {
                await execAsync(`git branch -D ${currentBranch}`, { cwd: projectPath });
            }
        }
        catch (error) {
            this?.logger?.warn(`Warning: Could not fully revert to original state: ${error?.message}`);
        }
    }
    async getGitStatus(projectPath) {
        try {
            const isGitRepo = await execAsync('git rev-parse --git-dir', { cwd: projectPath })
                ?.then(() => true)
                ?.catch(() => false);
            if (!isGitRepo) {
                return { isGitRepo: false, currentBranch: '', hasChanges: false };
            }
            const currentBranch = await this?.getCurrentBranch(projectPath);
            const hasChanges = await this?.hasUncommittedChanges(projectPath);
            let lastCommit;
            try {
                const { stdout } = await execAsync('git log -1 --format="%h %s"', { cwd: projectPath });
                lastCommit = stdout?.trim();
            }
            catch (error) {
                lastCommit = undefined;
            }
            return {
                isGitRepo: true,
                currentBranch,
                hasChanges,
                lastCommit
            };
        }
        catch (error) {
            return { isGitRepo: false, currentBranch: '', hasChanges: false };
        }
    }
}
exports.GitWorkflowManager = GitWorkflowManager;
//# sourceMappingURL=git-workflow-manager.js.map