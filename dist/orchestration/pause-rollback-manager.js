"use strict";
// ⚠️ DEPRECATED: Legacy Pause and Rollback Manager with Git Integration
// This file is part of the legacy parallel orchestration system.
// New implementations should handle error recovery within the sequential workflow system.
// This file will be removed in a future version.
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
exports.PauseRollbackManager = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class PauseRollbackManager extends events_1.EventEmitter {
    logger;
    states = new Map();
    rollbackPoints = new Map();
    pausedExecutions = new Set();
    escapeKeyHandler;
    gitEnabled = true;
    stateStorePath;
    constructor(logger, stateStorePath = './workflow-states') {
        super();
        this.logger = logger;
        this.stateStorePath = stateStorePath;
        this?.initializeEscapeHandler();
        this?.checkGitAvailability();
    }
    initializeEscapeHandler() {
        // Set up escape key listener
        if (process.stdin.isTTY) {
            process.stdin?.setRawMode(true);
            process.stdin?.resume();
            process.stdin?.setEncoding('utf8');
            this.escapeKeyHandler = (key) => {
                // ESC key
                if (key === '\u001b') {
                    this?.handleEscapeKey();
                }
                // Ctrl+C
                if (key === '\u0003') {
                    this?.handleInterrupt();
                }
            };
            process.stdin?.on('data', this.escapeKeyHandler);
            this.logger.info('Escape key handler initialized - Press ESC to pause workflow');
        }
    }
    checkGitAvailability() {
        try {
            (0, child_process_1.execSync)('git --version', { encoding: 'utf8' });
            this.gitEnabled = true;
            this.logger.info('Git integration enabled');
        }
        catch {
            this.gitEnabled = false;
            this.logger.warn('Git not available - rollback functionality limited');
        }
    }
    async handleEscapeKey() {
        this.logger.info('ESC key pressed - Pausing all active workflows');
        // Emit pause event
        this?.emit('escape-pressed');
        // Pause all active executions
        const activeExecutions = await this?.getActiveExecutions();
        for (const execution of activeExecutions) {
            await this?.pauseExecution(execution.id, 'User pressed ESC');
        }
        // Show pause menu
        await this?.showPauseMenu();
    }
    async handleInterrupt() {
        this.logger.info('Interrupt signal received - Saving state and exiting');
        // Save all states
        await this?.saveAllStates();
        // Clean up
        this?.cleanup();
        process?.exit(0);
    }
    async pauseExecution(executionId, reason, trigger = 'user') {
        this.pausedExecutions?.add(executionId);
        // Create state snapshot
        const state = await this?.createStateSnapshot(executionId, trigger, reason);
        // Create git commit if enabled
        if (this.gitEnabled) {
            const commitMessage = `Workflow paused: ${reason}`;
            state.gitCommit = await this?.createGitCommit(commitMessage);
        }
        // Save state to disk
        await this?.saveState(state);
        this.logger.info(`Execution ${executionId} paused: ${reason}`);
        this?.emit('execution-paused', { executionId, state, reason });
        return state;
    }
    async resumeExecution(executionId) {
        if (!this.pausedExecutions?.has(executionId)) {
            throw new Error(`Execution ${executionId} is not paused`);
        }
        this.pausedExecutions?.delete(executionId);
        // Restore state
        const state = await this?.getLatestState(executionId);
        if (state) {
            await this?.restoreState(state);
        }
        this.logger.info(`Execution ${executionId} resumed`);
        this?.emit('execution-resumed', { executionId });
    }
    async createRollbackPoint(executionId, name, type, nodeId) {
        const point = {
            id: `rbp-${Date?.now()}`,
            name,
            type,
            executionId,
            nodeId,
            gitCommit: '',
            branch: await this?.getCurrentBranch(),
            timestamp: new Date(),
            description: `Rollback point: ${name} (${type})`
        };
        // Create git tag if enabled
        if (this.gitEnabled) {
            const tagName = `rollback-${point.id}`;
            point.gitCommit = await this?.createGitTag(tagName, point.description);
        }
        this.rollbackPoints?.set(point.id, point);
        this.logger.info(`Created rollback point: ${name} at ${point.gitCommit || 'current state'}`);
        this?.emit('rollback-point-created', point);
        return point;
    }
    async rollbackToPoint(rollbackPointId) {
        const point = this.rollbackPoints?.get(rollbackPointId);
        if (!point) {
            throw new Error(`Rollback point ${rollbackPointId} not found`);
        }
        this.logger.info(`Rolling back to: ${point.name} (${point.timestamp})`);
        // Git rollback if enabled
        if (this.gitEnabled && point.gitCommit) {
            await this?.gitRollback(point.gitCommit, point.branch);
        }
        // Restore workflow state
        const state = await this?.getStateAtPoint(point);
        if (state) {
            await this?.restoreState(state);
        }
        this.logger.info(`Rollback completed to point: ${point.name}`);
        this?.emit('rollback-completed', point);
    }
    async rollbackToNode(executionId, nodeId) {
        this.logger.info(`Rolling back execution ${executionId} to node ${nodeId}`);
        // Find the state when node started
        const nodeState = await this?.findNodeStartState(executionId, nodeId);
        if (!nodeState) {
            throw new Error(`No state found for node ${nodeId}`);
        }
        // Perform rollback
        await this?.restoreState(nodeState);
        // Git rollback if enabled
        if (this.gitEnabled && nodeState.gitCommit) {
            await this?.gitRollback(nodeState.gitCommit, nodeState.branch);
        }
        this.logger.info(`Rolled back to node: ${nodeId}`);
        this?.emit('node-rollback-completed', { executionId, nodeId });
    }
    async rollbackToWorkflowStart(executionId) {
        this.logger.info(`Rolling back execution ${executionId} to workflow start`);
        // Find initial state
        const initialState = await this?.findInitialState(executionId);
        if (!initialState) {
            throw new Error(`No initial state found for execution ${executionId}`);
        }
        // Perform rollback
        await this?.restoreState(initialState);
        // Git rollback if enabled
        if (this.gitEnabled && initialState.gitCommit) {
            await this?.gitRollback(initialState.gitCommit, initialState.branch);
        }
        this.logger.info('Rolled back to workflow start');
        this?.emit('workflow-rollback-completed', { executionId });
    }
    async createStateSnapshot(executionId, trigger, reason) {
        // Get current workflow state
        const execution = await this?.getCurrentExecution(executionId);
        const nodeStates = await this?.captureNodeStates(execution);
        const contextSnapshot = await this?.captureContext(execution);
        const state = {
            id: `state-${Date?.now()}`,
            executionId,
            nodeId: execution.currentNode || '',
            timestamp: new Date(),
            gitCommit: '',
            branch: await this?.getCurrentBranch(),
            contextSnapshot,
            nodeStates,
            metadata: {
                trigger,
                reason,
                canRollback: true,
                dependencies: Array.from(nodeStates?.keys())
            }
        };
        this.states?.set(state.id, state);
        return state;
    }
    async captureNodeStates(execution) {
        const nodeStates = new Map();
        // Capture state of each node in the execution
        // This would integrate with the actual workflow execution
        // Simplified for demonstration
        return nodeStates;
    }
    async captureContext(execution) {
        // Capture full execution context
        return {
            workflowId: execution.workflowId,
            workItemId: execution.workItemId,
            status: execution.status,
            completedNodes: execution.completedNodes,
            failedNodes: execution.failedNodes,
            qualityScores: execution.qualityScores,
            branchRefs: execution.branchRefs,
            metadata: execution.metadata
        };
    }
    async restoreState(state) {
        // Restore node states
        for (const [nodeId, nodeState] of state.nodeStates) {
            await this?.restoreNodeState(nodeId, nodeState);
        }
        // Restore context
        await this?.restoreContext(state.contextSnapshot);
        this.logger.info(`State restored: ${state.id}`);
    }
    async restoreNodeState(nodeId, state) {
        // Restore individual node state
        // This would integrate with the workflow orchestrator
        this?.emit('node-state-restored', { nodeId, state });
    }
    async restoreContext(context) {
        // Restore execution context
        this?.emit('context-restored', context);
    }
    async createGitCommit(message) {
        try {
            // Stage all changes
            (0, child_process_1.execSync)('git add -A', { encoding: 'utf8' });
            // Create commit
            (0, child_process_1.execSync)(`git commit -m "${message}" --allow-empty`, { encoding: 'utf8' });
            // Get commit hash
            const hash = (0, child_process_1.execSync)('git rev-parse HEAD', { encoding: 'utf8' }).trim();
            return hash;
        }
        catch (error) {
            this.logger.error('Failed to create git commit', error);
            return '';
        }
    }
    async createGitTag(tagName, message) {
        try {
            // Create annotated tag
            (0, child_process_1.execSync)(`git tag -a ${tagName} -m "${message}"`, { encoding: 'utf8' });
            // Get commit hash for the tag
            const hash = (0, child_process_1.execSync)(`git rev-list -n 1 ${tagName}`, { encoding: 'utf8' }).trim();
            return hash;
        }
        catch (error) {
            this.logger.error('Failed to create git tag', error);
            return '';
        }
    }
    async gitRollback(commit, branch) {
        try {
            // Ensure we're on the correct branch
            const currentBranch = await this?.getCurrentBranch();
            if (currentBranch !== branch) {
                (0, child_process_1.execSync)(`git checkout ${branch}`, { encoding: 'utf8' });
            }
            // Reset to the specified commit
            (0, child_process_1.execSync)(`git reset --hard ${commit}`, { encoding: 'utf8' });
            this.logger.info(`Git rolled back to ${commit} on branch ${branch}`);
        }
        catch (error) {
            this.logger.error('Git rollback failed', error);
            throw error;
        }
    }
    async getCurrentBranch() {
        if (!this.gitEnabled)
            return 'main';
        try {
            return (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        }
        catch {
            return 'main';
        }
    }
    async showPauseMenu() {
        console?.log('\n=== WORKFLOW PAUSED ===');
        console?.log('Options:');
        console?.log('  [R] Resume execution');
        console?.log('  [B] Rollback to previous node');
        console?.log('  [W] Rollback to workflow start');
        console?.log('  [S] Save and exit');
        console?.log('  [C] Continue (ignore pause)');
        console?.log('  [Q] Quit without saving');
        console?.log('========================\n');
        // Wait for user input
        const choice = await this?.getUserChoice();
        await this?.handleMenuChoice(choice);
    }
    async getUserChoice() {
        return new Promise((resolve) => {
            const handler = (key) => {
                process.stdin?.removeListener('data', handler);
                resolve(key?.toLowerCase());
            };
            process.stdin?.once('data', handler);
        });
    }
    async handleMenuChoice(choice) {
        switch (choice) {
            case 'r':
                await this?.resumeAllExecutions();
                break;
            case 'b':
                await this?.rollbackToPreviousNode();
                break;
            case 'w':
                await this?.rollbackAllToStart();
                break;
            case 's':
                await this?.saveAndExit();
                break;
            case 'c':
                this?.continueExecution();
                break;
            case 'q':
                this?.quitWithoutSaving();
                break;
            default:
                console?.log('Invalid choice. Resuming execution...');
                await this?.resumeAllExecutions();
        }
    }
    async resumeAllExecutions() {
        for (const executionId of this.pausedExecutions) {
            await this?.resumeExecution(executionId);
        }
    }
    async rollbackToPreviousNode() {
        // Rollback logic for all paused executions
        for (const executionId of this.pausedExecutions) {
            const state = await this?.getLatestState(executionId);
            if (state && state.nodeId) {
                const previousNode = await this?.getPreviousNode(executionId, state.nodeId);
                if (previousNode) {
                    await this?.rollbackToNode(executionId, previousNode);
                }
            }
        }
    }
    async rollbackAllToStart() {
        for (const executionId of this.pausedExecutions) {
            await this?.rollbackToWorkflowStart(executionId);
        }
    }
    async saveAndExit() {
        await this?.saveAllStates();
        this?.cleanup();
        process?.exit(0);
    }
    continueExecution() {
        // Simply continue without any action
        this.logger.info('Continuing execution without changes');
    }
    quitWithoutSaving() {
        this?.cleanup();
        process?.exit(0);
    }
    async saveState(state) {
        try {
            await fs?.mkdir(this.stateStorePath, { recursive: true });
            const filePath = path?.join(this.stateStorePath, `${state.id}.json`);
            await fs?.writeFile(filePath, JSON.stringify(state, null, 2));
            this.logger.info(`State saved: ${state.id}`);
        }
        catch (error) {
            this.logger.error('Failed to save state', error);
        }
    }
    async saveAllStates() {
        for (const state of this.states?.values()) {
            await this?.saveState(state);
        }
        this.logger.info(`Saved ${this.states.size} states`);
    }
    async loadStates() {
        try {
            const files = await fs?.readdir(this.stateStorePath).catch(() => []);
            for (const file of files) {
                if (file?.endsWith('.json')) {
                    const content = await fs?.readFile(path?.join(this.stateStorePath, file), 'utf-8');
                    const state = JSON.parse(content);
                    this.states?.set(state.id, state);
                }
            }
            this.logger.info(`Loaded ${this.states.size} states`);
        }
        catch (error) {
            this.logger.error('Failed to load states', error);
        }
    }
    cleanup() {
        if (process.stdin.isTTY) {
            process.stdin?.removeListener('data', this.escapeKeyHandler);
            process.stdin?.setRawMode(false);
            process.stdin?.pause();
        }
    }
    // Helper methods
    async getActiveExecutions() {
        // Get active executions from orchestrator
        // Simplified for demonstration
        return [];
    }
    async getCurrentExecution(executionId) {
        // Get current execution state
        // Simplified for demonstration
        return {
            id: executionId,
            currentNode: null,
            workflowId: '',
            workItemId: '',
            status: 'paused'
        };
    }
    async getLatestState(executionId) {
        const states = Array.from(this.states?.values())
            .filter(s => s?.executionId === executionId)
            .sort((a, b) => b.timestamp?.getTime() - a.timestamp?.getTime());
        return states[0] || null;
    }
    async getStateAtPoint(point) {
        // Find state at rollback point
        const states = Array.from(this.states?.values())
            .filter(s => s?.executionId === point.executionId)
            .filter(s => s.timestamp <= point.timestamp)
            .sort((a, b) => b.timestamp?.getTime() - a.timestamp?.getTime());
        return states[0] || null;
    }
    async findNodeStartState(executionId, nodeId) {
        const states = Array.from(this.states?.values())
            .filter(s => s?.executionId === executionId && s?.nodeId === nodeId)
            .sort((a, b) => a.timestamp?.getTime() - b.timestamp?.getTime());
        return states[0] || null;
    }
    async findInitialState(executionId) {
        const states = Array.from(this.states?.values())
            .filter(s => s?.executionId === executionId)
            .sort((a, b) => a.timestamp?.getTime() - b.timestamp?.getTime());
        return states[0] || null;
    }
    async getPreviousNode(executionId, currentNodeId) {
        // Get previous node in execution
        // This would integrate with workflow DAG
        return null;
    }
    // Public API
    isPaused(executionId) {
        return this.pausedExecutions?.has(executionId);
    }
    async getRollbackPoints(executionId) {
        const points = Array.from(this.rollbackPoints?.values());
        if (executionId) {
            return points?.filter(p => p?.executionId === executionId);
        }
        return points;
    }
    async getStates(executionId) {
        const states = Array.from(this.states?.values());
        if (executionId) {
            return states?.filter(s => s?.executionId === executionId);
        }
        return states;
    }
}
exports.PauseRollbackManager = PauseRollbackManager;
//# sourceMappingURL=pause-rollback-manager.js.map