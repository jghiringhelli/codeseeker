import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { RoleType } from './types';
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
export declare class PauseRollbackManager extends EventEmitter {
    private logger;
    private states;
    private rollbackPoints;
    private pausedExecutions;
    private escapeKeyHandler;
    private gitEnabled;
    private stateStorePath;
    constructor(logger: Logger, stateStorePath?: string);
    private initializeEscapeHandler;
    private checkGitAvailability;
    private handleEscapeKey;
    private handleInterrupt;
    pauseExecution(executionId: string, reason: string, trigger?: StateMetadata['trigger']): Promise<SystemState>;
    resumeExecution(executionId: string): Promise<void>;
    createRollbackPoint(executionId: string, name: string, type: RollbackPoint['type'], nodeId?: string): Promise<RollbackPoint>;
    rollbackToPoint(rollbackPointId: string): Promise<void>;
    rollbackToNode(executionId: string, nodeId: string): Promise<void>;
    rollbackToWorkflowStart(executionId: string): Promise<void>;
    private createStateSnapshot;
    private captureNodeStates;
    private captureContext;
    private restoreState;
    private restoreNodeState;
    private restoreContext;
    private createGitCommit;
    private createGitTag;
    private gitRollback;
    private getCurrentBranch;
    private showPauseMenu;
    private getUserChoice;
    private handleMenuChoice;
    private resumeAllExecutions;
    private rollbackToPreviousNode;
    private rollbackAllToStart;
    private saveAndExit;
    private continueExecution;
    private quitWithoutSaving;
    private saveState;
    private saveAllStates;
    private loadStates;
    private cleanup;
    private getActiveExecutions;
    private getCurrentExecution;
    private getLatestState;
    private getStateAtPoint;
    private findNodeStartState;
    private findInitialState;
    private getPreviousNode;
    isPaused(executionId: string): boolean;
    getRollbackPoints(executionId?: string): Promise<RollbackPoint[]>;
    getStates(executionId?: string): Promise<SystemState[]>;
}
//# sourceMappingURL=pause-rollback-manager.d.ts.map