"use strict";
/**
 * Git Branch Manager - Safe git operations for feature development
 * Manages branch creation, commits, merges, and rollbacks for CodeMind workflow
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
exports.GitBranchManager = void 0;
const logger_1 = require("../utils/logger");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs_1 = require("fs");
class GitBranchManager {
    logger = logger_1.Logger.getInstance();
    projectRoot;
    defaultBaseBranch = 'main'; // or 'master'
    constructor(projectRoot) {
        this.projectRoot = projectRoot || process.cwd();
    }
    async createFeatureBranch(workflowId, description) {
        this.logger.info(`🌿 Creating feature branch for workflow: ${workflowId}`);
        try {
            // Ensure we're in a git repository
            await this.ensureGitRepository();
            // Determine base branch (main or master)
            const baseBranch = await this.determineBaseBranch();
            // Ensure working directory is clean
            const isClean = await this.ensureCleanWorkingDirectory();
            if (!isClean) {
                throw new Error('Working directory has uncommitted changes. Please commit or stash changes before proceeding.');
            }
            // Switch to base branch and pull latest
            await this.switchToBaseBranch(baseBranch);
            await this.pullLatestChanges(baseBranch);
            // Create feature branch with descriptive name
            const branchName = this.generateBranchName(workflowId, description);
            const createResult = await this.executeGitCommand(['checkout', '-b', branchName]);
            if (!createResult.success) {
                throw new Error(`Failed to create branch: ${createResult.error}`);
            }
            this.logger.info(`✅ Created feature branch: ${branchName}`);
            return branchName;
        }
        catch (error) {
            this.logger.error('Failed to create feature branch:', error);
            throw error;
        }
    }
    async commitAndMerge(branchName, message) {
        this.logger.info(`📝 Committing and merging branch: ${branchName}`);
        try {
            // Ensure we're on the correct branch
            await this.switchToBranch(branchName);
            // Stage all changes
            const stageResult = await this.stageAllChanges();
            if (!stageResult.success) {
                throw new Error(`Failed to stage changes: ${stageResult.error}`);
            }
            // Check if there are any changes to commit
            const hasChanges = await this.hasUncommittedChanges();
            if (!hasChanges) {
                this.logger.info('No changes to commit, proceeding to merge check...');
            }
            else {
                // Commit changes
                const commitResult = await this.commitChanges(message);
                if (!commitResult.success) {
                    throw new Error(`Failed to commit changes: ${commitResult.error}`);
                }
                this.logger.info(`✅ Committed changes: ${commitResult.output?.substring(0, 50)}...`);
            }
            // Switch to base branch
            const baseBranch = await this.determineBaseBranch();
            await this.switchToBaseBranch(baseBranch);
            await this.pullLatestChanges(baseBranch);
            // Merge feature branch
            const mergeResult = await this.mergeBranch(branchName, baseBranch);
            if (mergeResult.success) {
                // Clean up feature branch
                await this.deleteFeatureBranch(branchName);
                this.logger.info(`✅ Successfully merged and cleaned up branch: ${branchName}`);
            }
            return mergeResult;
        }
        catch (error) {
            this.logger.error('Failed to commit and merge:', error);
            return {
                success: false,
                branch: branchName,
                targetBranch: await this.determineBaseBranch().catch(() => 'main'),
                message: `Merge failed: ${error.message}`
            };
        }
    }
    async rollbackBranch(branchName) {
        this.logger.info(`↩️ Rolling back branch: ${branchName}`);
        try {
            // Switch to base branch
            const baseBranch = await this.determineBaseBranch();
            await this.switchToBaseBranch(baseBranch);
            // Delete the feature branch (this will discard all changes)
            const deleteResult = await this.deleteFeatureBranch(branchName);
            if (deleteResult.success) {
                this.logger.info(`✅ Successfully rolled back branch: ${branchName}`);
                return {
                    success: true,
                    message: `Branch ${branchName} has been rolled back and deleted`
                };
            }
            else {
                throw new Error(deleteResult.error || 'Failed to delete branch');
            }
        }
        catch (error) {
            this.logger.error('Failed to rollback branch:', error);
            return {
                success: false,
                message: `Rollback failed: ${error.message}`,
                error: error.message
            };
        }
    }
    async getBranchInfo(branchName) {
        try {
            // Check if branch exists
            const branchExists = await this.branchExists(branchName);
            if (!branchExists) {
                return null;
            }
            // Get branch commits
            const commitsResult = await this.executeGitCommand(['log', '--oneline', '--pretty=format:%H|%s|%ai|%an', branchName]);
            const commits = [];
            if (commitsResult.success && commitsResult.output) {
                const commitLines = commitsResult.output.trim().split('\n');
                for (const line of commitLines.slice(0, 10)) { // Last 10 commits
                    const [hash, message, timestamp, author] = line.split('|');
                    if (hash && message) {
                        // Get files changed in this commit
                        const filesResult = await this.executeGitCommand(['show', '--name-only', '--pretty=format:', hash]);
                        const filesChanged = filesResult.success && filesResult.output ?
                            filesResult.output.trim().split('\n').filter(f => f.trim()) : [];
                        commits.push({
                            hash: hash.trim(),
                            message: message.trim(),
                            timestamp: timestamp.trim(),
                            author: author.trim(),
                            filesChanged
                        });
                    }
                }
            }
            // Extract workflow ID from branch name
            const workflowIdMatch = branchName.match(/workflow_(\d+)/);
            const workflowId = workflowIdMatch ? workflowIdMatch[1] : 'unknown';
            // Get creation timestamp
            const creationResult = await this.executeGitCommand(['log', '--reverse', '--pretty=format:%ai', branchName]);
            const createdAt = creationResult.success && creationResult.output ?
                creationResult.output.trim().split('\n')[0] : new Date().toISOString();
            // Get all modified files in branch
            const diffResult = await this.executeGitCommand(['diff', '--name-only', `${await this.determineBaseBranch()}..${branchName}`]);
            const filesModified = diffResult.success && diffResult.output ?
                diffResult.output.trim().split('\n').filter(f => f.trim()) : [];
            return {
                name: branchName,
                workflowId,
                description: commits[0]?.message || 'Feature branch',
                createdAt,
                filesModified,
                commits
            };
        }
        catch (error) {
            this.logger.error(`Failed to get branch info for ${branchName}:`, error);
            return null;
        }
    }
    async listActiveFeatureBranches() {
        try {
            const branchesResult = await this.executeGitCommand(['branch', '--list', 'feature/*']);
            if (!branchesResult.success || !branchesResult.output) {
                return [];
            }
            const branchNames = branchesResult.output
                .trim()
                .split('\n')
                .map(line => line.replace(/^\*?\s*/, '').trim())
                .filter(name => name.startsWith('feature/'));
            const branchInfos = [];
            for (const branchName of branchNames) {
                const info = await this.getBranchInfo(branchName);
                if (info) {
                    branchInfos.push(info);
                }
            }
            return branchInfos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        catch (error) {
            this.logger.error('Failed to list active feature branches:', error);
            return [];
        }
    }
    // Private helper methods
    async ensureGitRepository() {
        const gitDir = path.join(this.projectRoot, '.git');
        try {
            await fs_1.promises.access(gitDir);
        }
        catch {
            throw new Error('Not a git repository. Please run "git init" first.');
        }
    }
    async determineBaseBranch() {
        // Check if 'main' branch exists
        const mainExists = await this.branchExists('main');
        if (mainExists)
            return 'main';
        // Check if 'master' branch exists
        const masterExists = await this.branchExists('master');
        if (masterExists)
            return 'master';
        // Check current branch if no main/master
        const currentResult = await this.executeGitCommand(['branch', '--show-current']);
        if (currentResult.success && currentResult.output?.trim()) {
            return currentResult.output.trim();
        }
        // Default fallback
        return this.defaultBaseBranch;
    }
    async branchExists(branchName) {
        const result = await this.executeGitCommand(['show-ref', '--verify', `refs/heads/${branchName}`]);
        return result.success;
    }
    async switchToBaseBranch(baseBranch) {
        const result = await this.executeGitCommand(['checkout', baseBranch]);
        if (!result.success) {
            throw new Error(`Failed to switch to base branch ${baseBranch}: ${result.error}`);
        }
    }
    async switchToBranch(branchName) {
        const result = await this.executeGitCommand(['checkout', branchName]);
        if (!result.success) {
            throw new Error(`Failed to switch to branch ${branchName}: ${result.error}`);
        }
    }
    async pullLatestChanges(branch) {
        // Only pull if we have a remote
        const remoteResult = await this.executeGitCommand(['remote']);
        if (remoteResult.success && remoteResult.output?.trim()) {
            const pullResult = await this.executeGitCommand(['pull', 'origin', branch]);
            if (!pullResult.success) {
                this.logger.warn(`Warning: Could not pull latest changes for ${branch}:`, pullResult.error);
            }
        }
    }
    async ensureCleanWorkingDirectory() {
        const statusResult = await this.executeGitCommand(['status', '--porcelain']);
        return statusResult.success && (!statusResult.output || statusResult.output.trim() === '');
    }
    async hasUncommittedChanges() {
        const statusResult = await this.executeGitCommand(['status', '--porcelain']);
        return statusResult.success && statusResult.output && statusResult.output.trim() !== '';
    }
    generateBranchName(workflowId, description) {
        // Clean and truncate description for branch name
        const cleanDescription = description
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50)
            .replace(/-+$/, '');
        return `feature/${workflowId}-${cleanDescription}`;
    }
    async stageAllChanges() {
        return await this.executeGitCommand(['add', '.']);
    }
    async commitChanges(message) {
        const fullMessage = `${message}\n\n🤖 Generated with CodeMind CLI\n\nCo-Authored-By: CodeMind <noreply@codemind.dev>`;
        return await this.executeGitCommand(['commit', '-m', fullMessage]);
    }
    async mergeBranch(featureBranch, targetBranch) {
        // Attempt merge
        const mergeResult = await this.executeGitCommand(['merge', '--no-ff', featureBranch, '-m', `Merge ${featureBranch} into ${targetBranch}`]);
        if (mergeResult.success) {
            // Get commit hash
            const hashResult = await this.executeGitCommand(['rev-parse', 'HEAD']);
            const commitHash = hashResult.success ? hashResult.output?.trim() : undefined;
            return {
                success: true,
                branch: featureBranch,
                targetBranch,
                commitHash,
                message: `Successfully merged ${featureBranch} into ${targetBranch}`
            };
        }
        else {
            // Check for merge conflicts
            const statusResult = await this.executeGitCommand(['status', '--porcelain']);
            const conflictFiles = [];
            if (statusResult.success && statusResult.output) {
                const lines = statusResult.output.trim().split('\n');
                for (const line of lines) {
                    if (line.startsWith('UU') || line.startsWith('AA')) {
                        const file = line.substring(3).trim();
                        conflictFiles.push(file);
                    }
                }
            }
            // Abort merge to clean state
            await this.executeGitCommand(['merge', '--abort']);
            return {
                success: false,
                branch: featureBranch,
                targetBranch,
                conflictFiles: conflictFiles.length > 0 ? conflictFiles : undefined,
                message: `Merge failed: ${mergeResult.error || 'Unknown error'}`
            };
        }
    }
    async deleteFeatureBranch(branchName) {
        return await this.executeGitCommand(['branch', '-d', branchName]);
    }
    async executeGitCommand(args) {
        return new Promise((resolve) => {
            const gitProcess = (0, child_process_1.spawn)('git', args, {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            let stdout = '';
            let stderr = '';
            gitProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            gitProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            gitProcess.on('close', (code) => {
                const success = code === 0;
                resolve({
                    success,
                    message: success ? 'Git command executed successfully' : 'Git command failed',
                    output: stdout.trim() || undefined,
                    error: stderr.trim() || undefined
                });
            });
            gitProcess.on('error', (error) => {
                resolve({
                    success: false,
                    message: 'Failed to execute git command',
                    error: error.message
                });
            });
        });
    }
}
exports.GitBranchManager = GitBranchManager;
exports.default = GitBranchManager;
//# sourceMappingURL=git-branch-manager.js.map