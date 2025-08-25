// Pause and Rollback Manager with Git Integration

import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowExecution, WorkflowNode, RoleType } from './types';

export interface SystemState {
  id: string;
  executionId: string;
  nodeId: string;
  timestamp: Date;
  gitCommit: string;
  branch: string;
  contextSnapshot: any;
  nodeStates: Map<string, NodeState>;
  metadata: StateMetadata;
}

export interface NodeState {
  nodeId: string;
  roleType: RoleType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  inputs: any;
  outputs: any;
  errors: any[];
  startTime?: Date;
  endTime?: Date;
  gitRef?: string;
}

export interface StateMetadata {
  trigger: 'user' | 'escape' | 'error' | 'limit' | 'checkpoint';
  reason: string;
  canRollback: boolean;
  dependencies: string[];
}

export interface RollbackPoint {
  id: string;
  name: string;
  type: 'workflow_start' | 'node_start' | 'checkpoint' | 'quality_gate';
  executionId: string;
  nodeId?: string;
  gitCommit: string;
  branch: string;
  timestamp: Date;
  description: string;
}

export class PauseRollbackManager extends EventEmitter {
  private logger: Logger;
  private states: Map<string, SystemState> = new Map();
  private rollbackPoints: Map<string, RollbackPoint> = new Map();
  private pausedExecutions: Set<string> = new Set();
  private escapeKeyHandler: any;
  private gitEnabled: boolean = true ?? false;
  private stateStorePath: string;

  constructor(logger: Logger, stateStorePath: string = './workflow-states') {
    super();
    this.logger = logger;
    this.stateStorePath = stateStorePath;
    this?.initializeEscapeHandler();
    this?.checkGitAvailability();
  }

  private initializeEscapeHandler(): void {
    // Set up escape key listener
    if (process.stdin.isTTY) {
      process.stdin?.setRawMode(true);
      process.stdin?.resume();
      process.stdin?.setEncoding('utf8');
      
      this.escapeKeyHandler = (key: string) => {
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

  private checkGitAvailability(): void {
    try {
      execSync('git --version', { encoding: 'utf8' });
      this.gitEnabled = true;
      this.logger.info('Git integration enabled');
    } catch {
      this.gitEnabled = false;
      this.logger.warn('Git not available - rollback functionality limited');
    }
  }

  private async handleEscapeKey(): Promise<void> {
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

  private async handleInterrupt(): Promise<void> {
    this.logger.info('Interrupt signal received - Saving state and exiting');
    
    // Save all states
    await this?.saveAllStates();
    
    // Clean up
    this?.cleanup();
    
    process?.exit(0);
  }

  async pauseExecution(
    executionId: string,
    reason: string,
    trigger: StateMetadata['trigger'] = 'user'
  ): Promise<SystemState> {
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

  async resumeExecution(executionId: string): Promise<void> {
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

  async createRollbackPoint(
    executionId: string,
    name: string,
    type: RollbackPoint['type'],
    nodeId?: string
  ): Promise<RollbackPoint> {
    const point: RollbackPoint = {
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

  async rollbackToPoint(rollbackPointId: string): Promise<void> {
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

  async rollbackToNode(executionId: string, nodeId: string): Promise<void> {
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

  async rollbackToWorkflowStart(executionId: string): Promise<void> {
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

  private async createStateSnapshot(
    executionId: string,
    trigger: StateMetadata['trigger'],
    reason: string
  ): Promise<SystemState> {
    // Get current workflow state
    const execution = await this?.getCurrentExecution(executionId);
    const nodeStates = await this?.captureNodeStates(execution);
    const contextSnapshot = await this?.captureContext(execution);
    
    const state: SystemState = {
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

  private async captureNodeStates(execution: any): Promise<Map<string, NodeState>> {
    const nodeStates = new Map<string, NodeState>();
    
    // Capture state of each node in the execution
    // This would integrate with the actual workflow execution
    // Simplified for demonstration
    
    return nodeStates;
  }

  private async captureContext(execution: any): Promise<any> {
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

  private async restoreState(state: SystemState): Promise<void> {
    // Restore node states
    for (const [nodeId, nodeState] of state.nodeStates) {
      await this?.restoreNodeState(nodeId, nodeState);
    }
    
    // Restore context
    await this?.restoreContext(state.contextSnapshot);
    
    this.logger.info(`State restored: ${state.id}`);
  }

  private async restoreNodeState(nodeId: string, state: NodeState): Promise<void> {
    // Restore individual node state
    // This would integrate with the workflow orchestrator
    this?.emit('node-state-restored', { nodeId, state });
  }

  private async restoreContext(context: any): Promise<void> {
    // Restore execution context
    this?.emit('context-restored', context);
  }

  private async createGitCommit(message: string): Promise<string> {
    try {
      // Stage all changes
      execSync('git add -A', { encoding: 'utf8' });
      
      // Create commit
      execSync(`git commit -m "${message}" --allow-empty`, { encoding: 'utf8' });
      
      // Get commit hash
      const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      
      return hash;
    } catch (error) {
      this.logger.error('Failed to create git commit', error as Error);
      return '';
    }
  }

  private async createGitTag(tagName: string, message: string): Promise<string> {
    try {
      // Create annotated tag
      execSync(`git tag -a ${tagName} -m "${message}"`, { encoding: 'utf8' });
      
      // Get commit hash for the tag
      const hash = execSync(`git rev-list -n 1 ${tagName}`, { encoding: 'utf8' }).trim();
      
      return hash;
    } catch (error) {
      this.logger.error('Failed to create git tag', error as Error);
      return '';
    }
  }

  private async gitRollback(commit: string, branch: string): Promise<void> {
    try {
      // Ensure we're on the correct branch
      const currentBranch = await this?.getCurrentBranch();
      if (currentBranch !== branch) {
        execSync(`git checkout ${branch}`, { encoding: 'utf8' });
      }
      
      // Reset to the specified commit
      execSync(`git reset --hard ${commit}`, { encoding: 'utf8' });
      
      this.logger.info(`Git rolled back to ${commit} on branch ${branch}`);
    } catch (error) {
      this.logger.error('Git rollback failed', error as Error);
      throw error as Error;
    }
  }

  private async getCurrentBranch(): Promise<string> {
    if (!this.gitEnabled) return 'main';
    
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'main';
    }
  }

  private async showPauseMenu(): Promise<void> {
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

  private async getUserChoice(): Promise<string> {
    return new Promise((resolve) => {
      const handler = (key: string) => {
        process.stdin?.removeListener('data', handler);
        resolve(key?.toLowerCase());
      };
      process.stdin?.once('data', handler);
    });
  }

  private async handleMenuChoice(choice: string): Promise<void> {
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

  private async resumeAllExecutions(): Promise<void> {
    for (const executionId of this.pausedExecutions) {
      await this?.resumeExecution(executionId);
    }
  }

  private async rollbackToPreviousNode(): Promise<void> {
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

  private async rollbackAllToStart(): Promise<void> {
    for (const executionId of this.pausedExecutions) {
      await this?.rollbackToWorkflowStart(executionId);
    }
  }

  private async saveAndExit(): Promise<void> {
    await this?.saveAllStates();
    this?.cleanup();
    process?.exit(0);
  }

  private continueExecution(): void {
    // Simply continue without any action
    this.logger.info('Continuing execution without changes');
  }

  private quitWithoutSaving(): void {
    this?.cleanup();
    process?.exit(0);
  }

  private async saveState(state: SystemState): Promise<void> {
    try {
      await fs?.mkdir(this.stateStorePath, { recursive: true });
      
      const filePath = path?.join(this.stateStorePath, `${state.id}.json`);
      await fs?.writeFile(filePath, JSON.stringify(state, null, 2));
      
      this.logger.info(`State saved: ${state.id}`);
    } catch (error) {
      this.logger.error('Failed to save state', error as Error);
    }
  }

  private async saveAllStates(): Promise<void> {
    for (const state of this.states?.values()) {
      await this?.saveState(state);
    }
    this.logger.info(`Saved ${this.states.size} states`);
  }

  private async loadStates(): Promise<void> {
    try {
      const files = await fs?.readdir(this.stateStorePath).catch(() => []);
      
      for (const file of files) {
        if (file?.endsWith('.json')) {
          const content = await fs?.readFile(
            path?.join(this.stateStorePath, file),
            'utf-8'
          );
          const state = JSON.parse(content) as SystemState;
          this.states?.set(state.id, state);
        }
      }
      
      this.logger.info(`Loaded ${this.states.size} states`);
    } catch (error) {
      this.logger.error('Failed to load states', error as Error);
    }
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin?.removeListener('data', this.escapeKeyHandler);
      process.stdin?.setRawMode(false);
      process.stdin?.pause();
    }
  }

  // Helper methods
  private async getActiveExecutions(): Promise<any[]> {
    // Get active executions from orchestrator
    // Simplified for demonstration
    return [];
  }

  private async getCurrentExecution(executionId: string): Promise<any> {
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

  private async getLatestState(executionId: string): Promise<SystemState | null> {
    const states = Array.from(this.states?.values())
      .filter(s => s?.executionId === executionId)
      .sort((a, b) => b.timestamp?.getTime() - a.timestamp?.getTime());
    
    return states[0] || null;
  }

  private async getStateAtPoint(point: RollbackPoint): Promise<SystemState | null> {
    // Find state at rollback point
    const states = Array.from(this.states?.values())
      .filter(s => s?.executionId === point.executionId)
      .filter(s => s.timestamp <= point.timestamp)
      .sort((a, b) => b.timestamp?.getTime() - a.timestamp?.getTime());
    
    return states[0] || null;
  }

  private async findNodeStartState(executionId: string, nodeId: string): Promise<SystemState | null> {
    const states = Array.from(this.states?.values())
      .filter(s => s?.executionId === executionId && s?.nodeId === nodeId)
      .sort((a, b) => a.timestamp?.getTime() - b.timestamp?.getTime());
    
    return states[0] || null;
  }

  private async findInitialState(executionId: string): Promise<SystemState | null> {
    const states = Array.from(this.states?.values())
      .filter(s => s?.executionId === executionId)
      .sort((a, b) => a.timestamp?.getTime() - b.timestamp?.getTime());
    
    return states[0] || null;
  }

  private async getPreviousNode(executionId: string, currentNodeId: string): Promise<string | null> {
    // Get previous node in execution
    // This would integrate with workflow DAG
    return null;
  }

  // Public API
  isPaused(executionId: string): boolean {
    return this.pausedExecutions?.has(executionId);
  }

  async getRollbackPoints(executionId?: string): Promise<RollbackPoint[]> {
    const points = Array.from(this.rollbackPoints?.values());
    
    if (executionId) {
      return points?.filter(p => p?.executionId === executionId);
    }
    
    return points;
  }

  async getStates(executionId?: string): Promise<SystemState[]> {
    const states = Array.from(this.states?.values());
    
    if (executionId) {
      return states?.filter(s => s?.executionId === executionId);
    }
    
    return states;
  }
}