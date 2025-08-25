// Workflow Orchestrator - Core Execution Engine

import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import {
  WorkflowDAG,
  WorkflowExecution,
  WorkflowNode,
  ExecutionStatus,
  BacktrackTrigger,
  RoleType,
  QualityMetric,
  ConcurrencyConfig,
  TerminalSession,
  MultiplexorConfig,
  BacktrackEvent
} from './types';
import { WorkflowDefinitions } from './workflow-definitions';

export class WorkflowOrchestrator extends EventEmitter {
  private logger: Logger;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private roleInstances: Map<RoleType, number> = new Map();
  private terminalSessions: Map<string, TerminalSession> = new Map();
  private concurrencyConfig: ConcurrencyConfig;
  private multiplexorConfig: MultiplexorConfig;
  private workflowDefinitions: Map<string, WorkflowDAG> = new Map();

  constructor(
    logger: Logger,
    concurrencyConfig: ConcurrencyConfig,
    multiplexorConfig: MultiplexorConfig
  ) {
    super();
    this.logger = logger;
    this.concurrencyConfig = concurrencyConfig;
    this.multiplexorConfig = multiplexorConfig;
    
    // Initialize workflow definitions
    this.loadWorkflowDefinitions();
    
    // Initialize role instance tracking
    this.initializeRoleInstanceTracking();
  }

  private loadWorkflowDefinitions(): void {
    const workflows = WorkflowDefinitions.getAllWorkflows();
    workflows.forEach(workflow => {
      this.workflowDefinitions.set(workflow.id, workflow);
    });
    this.logger.info(`Loaded ${workflows.length} workflow definitions`);
  }

  private initializeRoleInstanceTracking(): void {
    // Initialize role instance limits
    Object.values(RoleType).forEach(roleType => {
      const limit = this.concurrencyConfig.roleInstanceLimits.get(roleType) || 1;
      this.roleInstances.set(roleType, 0);
    });
  }

  async startWorkflow(
    workItemId: string,
    workflowId: string,
    inputs: any,
    metadata: any
  ): Promise<string> {
    const workflow = this.workflowDefinitions.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = `${workItemId}-${Date.now()}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workItemId,
      status: ExecutionStatus.PENDING,
      currentNode: null,
      completedNodes: [],
      failedNodes: [],
      startTime: new Date(),
      qualityScores: new Map(),
      branchRefs: new Map(),
      backtrackHistory: [],
      metadata
    };

    this.activeExecutions.set(executionId, execution);
    this.logger.info(`Started workflow execution: ${executionId} for workflow: ${workflowId}`);

    // Start execution asynchronously
    this.executeWorkflow(executionId).catch(error => {
      this.logger.error(`Workflow execution failed: ${executionId}`, error);
      this.handleExecutionFailure(executionId, error);
    });

    return executionId;
  }

  private async executeWorkflow(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const workflow = this.workflowDefinitions.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${execution.workflowId} not found`);
    }

    execution.status = ExecutionStatus.RUNNING;
    this.emit('execution-started', execution);

    try {
      // Start from entry points
      const entryNodes = workflow.entryPoints.map(nodeId => workflow.nodes.get(nodeId)!);
      await this.executeNodesInParallel(execution, entryNodes);

      // Continue execution based on DAG
      await this.traverseWorkflow(execution, workflow);

      execution.status = ExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      
      this.logger.info(`Workflow execution completed: ${executionId}`);
      this.emit('execution-completed', execution);

    } catch (error) {
      this.logger.error(`Workflow execution error: ${executionId}`, error);
      await this.handleExecutionError(execution, error);
    }
  }

  private async traverseWorkflow(
    execution: WorkflowExecution, 
    workflow: WorkflowDAG
  ): Promise<void> {
    const visited = new Set<string>(execution.completedNodes);
    const queue: string[] = [...workflow.entryPoints];

    while (queue.length > 0) {
      // Get next batch of nodes that can execute concurrently
      const readyNodes = this.getReadyNodes(workflow, visited, queue);
      
      if (readyNodes.length === 0) {
        // Check if we're waiting for backtrack resolution
        if (execution.status === ExecutionStatus.BACKTRACKING) {
          await this.handleBacktrackResolution(execution, workflow);
          continue;
        }
        break;
      }

      // Execute ready nodes in parallel
      const nodes = readyNodes.map(nodeId => workflow.nodes.get(nodeId)!);
      await this.executeNodesInParallel(execution, nodes);

      // Mark nodes as completed and update queue
      readyNodes.forEach(nodeId => {
        visited.add(nodeId);
        execution.completedNodes.push(nodeId);
        queue.splice(queue.indexOf(nodeId), 1);
      });

      // Add next nodes to queue
      const nextNodes = this.getNextNodes(workflow, readyNodes);
      nextNodes.forEach(nodeId => {
        if (!queue.includes(nodeId) && !visited.has(nodeId)) {
          queue.push(nodeId);
        }
      });

      // Check quality gates at merge points
      if (readyNodes.some(nodeId => workflow.mergePoints.includes(nodeId))) {
        const gateResult = await this.evaluateQualityGates(execution, workflow, readyNodes);
        if (!gateResult.passed) {
          await this.handleQualityGateFailure(execution, workflow, gateResult);
        }
      }
    }
  }

  private getReadyNodes(
    workflow: WorkflowDAG, 
    visited: Set<string>, 
    queue: string[]
  ): string[] {
    const readyNodes: string[] = [];
    const parallelGroups = new Map<string, string[]>();

    for (const nodeId of queue) {
      const node = workflow.nodes.get(nodeId);
      if (!node) continue;

      // Check if all dependencies are satisfied
      const dependenciesSatisfied = node.dependencies.every(depId => visited.has(depId));
      
      if (dependenciesSatisfied) {
        // Check if this node can run in parallel with others
        if (node.parallelWith && node.parallelWith.length > 0) {
          const groupKey = node.parallelWith.sort().join(',');
          if (!parallelGroups.has(groupKey)) {
            parallelGroups.set(groupKey, []);
          }
          parallelGroups.get(groupKey)!.push(nodeId);
        } else {
          readyNodes.push(nodeId);
        }
      }
    }

    // Add parallel groups that are ready
    for (const [groupKey, nodeIds] of parallelGroups) {
      const allNodesReady = nodeIds.every(nodeId => {
        const node = workflow.nodes.get(nodeId)!;
        return node.dependencies.every(depId => visited.has(depId));
      });
      
      if (allNodesReady && this.canExecuteParallelGroup(nodeIds)) {
        readyNodes.push(...nodeIds);
      }
    }

    return readyNodes;
  }

  private canExecuteParallelGroup(nodeIds: string[]): boolean {
    // Check resource availability for parallel execution
    const totalResourcesRequired = nodeIds.length;
    return totalResourcesRequired <= this.concurrencyConfig.maxParallelNodes;
  }

  private getNextNodes(workflow: WorkflowDAG, completedNodes: string[]): string[] {
    const nextNodes: string[] = [];
    
    for (const edge of workflow.edges) {
      if (completedNodes.includes(edge.from)) {
        nextNodes.push(edge.to);
      }
    }
    
    return [...new Set(nextNodes)]; // Remove duplicates
  }

  private async executeNodesInParallel(
    execution: WorkflowExecution, 
    nodes: WorkflowNode[]
  ): Promise<void> {
    const promises = nodes.map(node => this.executeNode(execution, node));
    
    try {
      await Promise.all(promises);
    } catch (error) {
      this.logger.error(`Parallel node execution failed`, error);
      throw error;
    }
  }

  private async executeNode(
    execution: WorkflowExecution, 
    node: WorkflowNode
  ): Promise<void> {
    // Check role instance limits
    const currentInstances = this.roleInstances.get(node.roleType) || 0;
    const maxInstances = this.concurrencyConfig.roleInstanceLimits.get(node.roleType) || 1;
    
    if (currentInstances >= maxInstances) {
      await this.waitForRoleAvailability(node.roleType);
    }

    // Increment role instance count
    this.roleInstances.set(node.roleType, currentInstances + 1);
    execution.currentNode = node.id;

    this.logger.info(`Executing node: ${node.id} (${node.roleType}) for execution: ${execution.id}`);
    this.emit('node-started', { execution, node });

    try {
      // Create terminal session for the node execution
      const session = await this.createTerminalSession(execution, node);
      
      // Execute the node logic
      const result = await this.executeNodeLogic(execution, node, session);
      
      // Process node results
      await this.processNodeResult(execution, node, result);
      
      // Clean up terminal session
      await this.cleanupTerminalSession(session.id);
      
      this.logger.info(`Node completed: ${node.id} for execution: ${execution.id}`);
      this.emit('node-completed', { execution, node, result });

    } catch (error) {
      this.logger.error(`Node execution failed: ${node.id}`, error);
      execution.failedNodes.push(node.id);
      
      // Determine if we should backtrack
      if (await this.shouldBacktrack(execution, node, error)) {
        await this.initiateBacktrack(execution, node, error);
      } else {
        throw error;
      }
    } finally {
      // Decrement role instance count
      const instances = this.roleInstances.get(node.roleType) || 0;
      this.roleInstances.set(node.roleType, Math.max(0, instances - 1));
    }
  }

  private async createTerminalSession(
    execution: WorkflowExecution, 
    node: WorkflowNode
  ): Promise<TerminalSession> {
    const sessionId = `${execution.id}-${node.id}-${Date.now()}`;
    
    // Create branch if needed
    const branchName = this.resolveBranchName(node.branchStrategy.pattern, execution);
    
    const session: TerminalSession = {
      id: sessionId,
      nodeId: node.id,
      roleType: node.roleType,
      sessionName: `${node.roleType.toLowerCase()}-${execution.workItemId}`,
      command: await this.buildNodeCommand(execution, node),
      workingDirectory: process.cwd(),
      environmentVariables: new Map([
        ['WORK_ITEM_ID', execution.workItemId],
        ['EXECUTION_ID', execution.id],
        ['NODE_ID', node.id],
        ['BRANCH_NAME', branchName]
      ]),
      status: 'ACTIVE',
      startTime: new Date(),
      output: []
    };

    this.terminalSessions.set(sessionId, session);
    
    // Create git branch if needed
    await this.createGitBranch(branchName, node.branchStrategy.baseRef, execution);
    execution.branchRefs.set(node.id, branchName);
    
    return session;
  }

  private async executeNodeLogic(
    execution: WorkflowExecution,
    node: WorkflowNode,
    session: TerminalSession
  ): Promise<any> {
    // This is where we would integrate with actual role implementations
    // For now, return mock results based on role type
    
    switch (node.roleType) {
      case RoleType.WORK_CLASSIFIER:
        return await this.executeWorkClassifier(execution, node, session);
      
      case RoleType.TEST_DESIGNER:
        return await this.executeTestDesigner(execution, node, session);
      
      case RoleType.IMPLEMENTATION_DEVELOPER:
        return await this.executeImplementationDeveloper(execution, node, session);
      
      case RoleType.SECURITY_AUDITOR:
        return await this.executeSecurityAuditor(execution, node, session);
        
      // Add other role implementations...
      
      default:
        return await this.executeGenericRole(execution, node, session);
    }
  }

  private async shouldBacktrack(
    execution: WorkflowExecution,
    node: WorkflowNode, 
    error: any
  ): Promise<boolean> {
    const workflow = this.workflowDefinitions.get(execution.workflowId);
    if (!workflow) return false;

    // Check backtrack rules
    for (const rule of workflow.backtrackRules) {
      if (this.evaluateBacktrackRule(rule, execution, node, error)) {
        // Check if we haven't exceeded max backtrack count
        const backtrackCount = execution.backtrackHistory.filter(
          event => event.reason === rule.trigger
        ).length;
        
        return backtrackCount < rule.maxBacktrackCount;
      }
    }
    
    return false;
  }

  private async initiateBacktrack(
    execution: WorkflowExecution,
    node: WorkflowNode,
    error: any
  ): Promise<void> {
    const workflow = this.workflowDefinitions.get(execution.workflowId);
    if (!workflow) return;

    execution.status = ExecutionStatus.BACKTRACKING;
    
    // Find applicable backtrack rule
    const applicableRule = workflow.backtrackRules.find(rule =>
      this.evaluateBacktrackRule(rule, execution, node, error)
    );
    
    if (!applicableRule) return;

    const backtrackEvent: BacktrackEvent = {
      id: `bt-${Date.now()}`,
      fromNode: node.id,
      toNode: applicableRule.targetNode,
      reason: applicableRule.trigger,
      timestamp: new Date(),
      context: this.gatherBacktrackContext(applicableRule.includeContext, execution, error),
      attempts: execution.backtrackHistory.filter(e => e.reason === applicableRule.trigger).length + 1
    };

    execution.backtrackHistory.push(backtrackEvent);
    
    this.logger.info(`Initiating backtrack from ${node.id} to ${applicableRule.targetNode}`);
    this.emit('backtrack-initiated', { execution, backtrackEvent });

    // Reset execution state to target node
    await this.resetExecutionToNode(execution, applicableRule.targetNode);
  }

  private evaluateBacktrackRule(
    rule: any,
    execution: WorkflowExecution,
    node: WorkflowNode,
    error: any
  ): boolean {
    // Simple condition evaluation - in production, this would be more sophisticated
    switch (rule.trigger) {
      case BacktrackTrigger.TEST_FAILURE:
        return error.type === 'TEST_FAILURE';
        
      case BacktrackTrigger.BUILD_FAILURE:
        return error.type === 'BUILD_FAILURE';
        
      case BacktrackTrigger.QUALITY_GATE_FAILURE:
        return error.type === 'QUALITY_GATE_FAILURE';
        
      case BacktrackTrigger.SECURITY_VIOLATION:
        return error.type === 'SECURITY_VIOLATION';
        
      default:
        return false;
    }
  }

  // Mock role implementations (to be replaced with actual implementations)
  private async executeWorkClassifier(
    execution: WorkflowExecution,
    node: WorkflowNode,
    session: TerminalSession
  ): Promise<any> {
    // Mock work classification logic
    return {
      workType: execution.metadata.workItemType,
      complexity: execution.metadata.complexity,
      priority: execution.metadata.priority,
      estimatedDuration: execution.metadata.estimatedDuration
    };
  }

  private async executeTestDesigner(
    execution: WorkflowExecution,
    node: WorkflowNode,
    session: TerminalSession
  ): Promise<any> {
    // Mock test design logic
    return {
      unitTests: ['test1.ts', 'test2.ts'],
      integrationTests: ['integration1.ts'],
      testCoverage: 0.95,
      testCount: 25
    };
  }

  private async executeImplementationDeveloper(
    execution: WorkflowExecution,
    node: WorkflowNode,
    session: TerminalSession
  ): Promise<any> {
    // Mock implementation logic
    return {
      filesModified: ['src/feature.ts', 'src/utils.ts'],
      linesAdded: 250,
      linesRemoved: 30,
      buildStatus: 'SUCCESS'
    };
  }

  private async executeSecurityAuditor(
    execution: WorkflowExecution,
    node: WorkflowNode,
    session: TerminalSession
  ): Promise<any> {
    // Mock security audit logic
    const securityScore = 0.95;
    execution.qualityScores.set(QualityMetric.SECURITY_SCORE, securityScore);
    
    return {
      securityScore,
      vulnerabilities: [],
      criticalIssues: 0,
      recommendations: []
    };
  }

  private async executeGenericRole(
    execution: WorkflowExecution,
    node: WorkflowNode,
    session: TerminalSession
  ): Promise<any> {
    // Generic role execution
    return { status: 'completed', nodeId: node.id };
  }

  // Additional helper methods would be implemented here...
  
  private async waitForRoleAvailability(roleType: RoleType): Promise<void> {
    // Implementation for waiting for role availability
  }

  private async processNodeResult(execution: WorkflowExecution, node: WorkflowNode, result: any): Promise<void> {
    // Process and store node execution results
  }

  private async cleanupTerminalSession(sessionId: string): Promise<void> {
    // Cleanup terminal session
    this.terminalSessions.delete(sessionId);
  }

  private resolveBranchName(pattern: string, execution: WorkflowExecution): string {
    return pattern.replace('{workItemId}', execution.workItemId);
  }

  private async buildNodeCommand(execution: WorkflowExecution, node: WorkflowNode): Promise<string> {
    // Build appropriate command for the node
    return `echo "Executing ${node.roleType} for ${execution.workItemId}"`;
  }

  private async createGitBranch(branchName: string, baseRef: string, execution: WorkflowExecution): Promise<void> {
    // Git branch creation logic
  }

  private async evaluateQualityGates(execution: WorkflowExecution, workflow: WorkflowDAG, nodeIds: string[]): Promise<any> {
    // Quality gate evaluation logic
    return { passed: true, results: [] };
  }

  private async handleQualityGateFailure(execution: WorkflowExecution, workflow: WorkflowDAG, gateResult: any): Promise<void> {
    // Handle quality gate failures
  }

  private async handleBacktrackResolution(execution: WorkflowExecution, workflow: WorkflowDAG): Promise<void> {
    // Handle backtrack resolution
  }

  private async resetExecutionToNode(execution: WorkflowExecution, targetNodeId: string): Promise<void> {
    // Reset execution state to target node
  }

  private gatherBacktrackContext(contextTypes: any[], execution: WorkflowExecution, error: any): any {
    // Gather context for backtrack
    return {};
  }

  private async handleExecutionError(execution: WorkflowExecution, error: any): Promise<void> {
    execution.status = ExecutionStatus.FAILED;
    execution.endTime = new Date();
    this.emit('execution-failed', { execution, error });
  }

  private handleExecutionFailure(executionId: string, error: any): void {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.status = ExecutionStatus.FAILED;
      execution.endTime = new Date();
    }
  }

  // Public API methods
  async getExecutionStatus(executionId: string): Promise<WorkflowExecution | null> {
    return this.activeExecutions.get(executionId) || null;
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.status === ExecutionStatus.RUNNING) {
      execution.status = ExecutionStatus.CANCELLED;
      execution.endTime = new Date();
      this.emit('execution-cancelled', execution);
      return true;
    }
    return false;
  }

  async getActiveExecutions(): Promise<WorkflowExecution[]> {
    return Array.from(this.activeExecutions.values()).filter(
      exec => exec.status === ExecutionStatus.RUNNING || exec.status === ExecutionStatus.BACKTRACKING
    );
  }

  async getTerminalSessions(): Promise<TerminalSession[]> {
    return Array.from(this.terminalSessions.values());
  }
}