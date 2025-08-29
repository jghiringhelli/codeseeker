// ⚠️ DEPRECATED: Legacy Workflow Orchestrator - Core Execution Engine
// This file is part of the legacy parallel orchestration system.
// New implementations should use sequential-workflow-orchestrator.ts instead.
// This file will be removed in a future version.

import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { ClaudeIntegration } from '../cli/claude-integration';
import { Database } from '../database/database';
import { PerformanceMonitor } from '../shared/performance-monitor';
import { IntelligentToolSelector } from '../cli/intelligent-tool-selector';
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
  BacktrackEvent,
  ClaudeWorkflowDecision,
  WorkflowContext
} from './types';
import { WorkflowDefinitions } from './workflow-definitions';

export class WorkflowOrchestrator extends EventEmitter {
  private logger: Logger;
  private claude: ClaudeIntegration;
  private db: Database;
  private monitor: PerformanceMonitor;
  private toolSelector: IntelligentToolSelector;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private roleInstances: Map<RoleType, number> = new Map();
  private terminalSessions: Map<string, TerminalSession> = new Map();
  private concurrencyConfig: ConcurrencyConfig;
  private multiplexorConfig: MultiplexorConfig;
  private workflowDefinitions: Map<string, WorkflowDAG> = new Map();

  constructor(
    logger: Logger,
    claude: ClaudeIntegration,
    db: Database,
    monitor: PerformanceMonitor,
    toolSelector: IntelligentToolSelector,
    concurrencyConfig: ConcurrencyConfig,
    multiplexorConfig: MultiplexorConfig
  ) {
    super();
    this.logger = logger;
    this.claude = claude;
    this.db = db;
    this.monitor = monitor;
    this.toolSelector = toolSelector;
    this.concurrencyConfig = concurrencyConfig;
    this.multiplexorConfig = multiplexorConfig;
    
    // Initialize workflow definitions
    this.loadWorkflowDefinitions();
    
    // Initialize role instance tracking
    this.initializeRoleInstanceTracking();
  }

  private loadWorkflowDefinitions(): void {
    const workflows = WorkflowDefinitions?.getAllWorkflows();
    workflows?.forEach(workflow => {
      this.workflowDefinitions?.set(workflow.id, workflow);
    });
    this.logger.info(`Loaded ${workflows?.length} workflow definitions`);
  }

  private initializeRoleInstanceTracking(): void {
    // Initialize role instance limits
    Object.values(RoleType)?.forEach(roleType => {
      const limit = this.concurrencyConfig.roleInstanceLimits?.get(roleType) || 1;
      this.roleInstances?.set(roleType, 0);
    });
  }

  async startWorkflow(
    workItemId: string,
    workflowId: string,
    inputs: any,
    metadata: any
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`🧠 Claude analyzing workflow requirements for: ${workItemId}`);
      
      // Let Claude analyze the workflow requirements
      const workflowContext: WorkflowContext = {
        workItemId,
        projectPath: metadata.projectPath || '.',
        workflowId,
        inputs,
        metadata,
        projectContext: await this.gatherProjectContext(metadata.projectPath),
        systemLoad: await this.getSystemLoad()
      };

      // Claude makes workflow decisions
      const claudeDecision = await this.claudeAnalyzeWorkflow(workflowContext);
      
      // Get or optimize workflow based on Claude's analysis
      const workflow = await this.getOptimizedWorkflow(claudeDecision, workflowContext);
      
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found or could not be optimized`);
      }

      const executionId = `${workItemId}-${Date.now()}`;
      
      const execution: WorkflowExecution = {
        id: executionId,
        workflowId: claudeDecision.selectedWorkflow || workflowId,
        workItemId,
        status: ExecutionStatus.PENDING,
        currentNode: null,
        completedNodes: [],
        failedNodes: [],
        startTime: new Date(),
        qualityScores: new Map(),
        branchRefs: new Map(),
        backtrackHistory: [],
        metadata: {
          ...metadata,
          claudeDecision,
          optimizations: claudeDecision.optimizations
        }
      };

      this.activeExecutions.set(executionId, execution);
      
      // Record Claude's workflow decision
      await this.recordWorkflowDecision(execution, claudeDecision);
      
      this.logger.info(`🚀 Started workflow execution: ${executionId} with Claude optimizations`);

      // Monitor workflow initiation performance
      this.monitor.record('workflow_initiation', {
        duration: Date.now() - startTime,
        workflowId: execution.workflowId,
        optimizations: claudeDecision.optimizations.length
      });

      // Start execution asynchronously
      this.executeWorkflow(executionId).catch(error => {
        this.logger.error(`Workflow execution failed: ${executionId}`, error as Error);
        this.handleExecutionFailure(executionId, error);
      });

      return executionId;
      
    } catch (error) {
      this.logger.error('Failed to start workflow with Claude analysis, using fallback', error);
      return this.fallbackWorkflowStart(workItemId, workflowId, inputs, metadata);
    }
  }

  private async claudeAnalyzeWorkflow(context: WorkflowContext): Promise<ClaudeWorkflowDecision> {
    const prompt = this.buildWorkflowAnalysisPrompt(context);
    
    try {
      const response = await this.claude.askQuestion(prompt, {
        projectPath: context.projectContext?.projectPath || '.',
        estimatedTokens: 2000,
        priorityFiles: [],
        tokenBudget: 2000,
        strategy: 'smart',
        focusArea: 'orchestration'
      } as any);

      return this.parseWorkflowDecision(response.content);
      
    } catch (error) {
      this.logger.warn('Claude workflow analysis failed, using defaults');
      return this.getDefaultWorkflowDecision(context);
    }
  }

  private buildWorkflowAnalysisPrompt(context: WorkflowContext): string {
    return `# Intelligent Workflow Orchestration

You are Claude, the central brain of the CodeMind orchestration system. Analyze this work item and optimize the workflow execution.

## Work Item Analysis
**ID**: ${context.workItemId}
**Type**: ${context.metadata?.workItemType || 'unknown'}
**Complexity**: ${context.metadata?.complexity || 'medium'}
**Priority**: ${context.metadata?.priority || 'normal'}

## Project Context
${context.projectContext ? `
- Project Path: ${context.projectContext.projectPath}
- Size: ${context.projectContext.size} files
- Languages: ${context.projectContext.primaryLanguages?.join(', ')}
- Frameworks: ${context.projectContext.frameworks?.join(', ')}
- Has Tests: ${context.projectContext.hasTests}
- Architecture: ${context.projectContext.architecture || 'unknown'}
` : 'No project context available'}

## System Load
- Active Workflows: ${context.systemLoad?.activeWorkflows || 0}
- CPU Usage: ${context.systemLoad?.cpuUsage || 0}%
- Memory Usage: ${context.systemLoad?.memoryUsage || 0}%
- Queue Length: ${context.systemLoad?.queueLength || 0}

## Available Workflows
- feature_development: Complete feature development with quality gates
- bug_fix: Fast bug resolution with testing focus
- refactoring: Code improvement with safety checks
- security_audit: Security-focused analysis and fixes
- performance_optimization: Performance improvement workflow

## Your Task

As the orchestration brain, decide:

1. **Workflow Selection**: Which workflow best fits this work item?
2. **Role Optimization**: Which roles are essential vs optional?
3. **Execution Strategy**: Parallel, sequential, or adaptive?
4. **Quality Gates**: Which quality thresholds are appropriate?
5. **Performance**: How to optimize for current system load?

## Response Format

\`\`\`json
{
  "selectedWorkflow": "feature_development",
  "reasoning": "This work item requires full development cycle with testing",
  "confidence": 0.92,
  "optimizations": [
    "skip_documentation_role_due_to_low_priority",
    "parallel_test_design_and_security_audit",
    "reduce_quality_threshold_for_speed"
  ],
  "executionStrategy": "adaptive",
  "estimatedDuration": 1800,
  "roleAdjustments": {
    "documentation_writer": "optional",
    "performance_auditor": "required"
  },
  "qualityGates": {
    "test_coverage": 0.80,
    "security_score": 0.85,
    "code_quality": 0.90
  },
  "resourceAllocation": {
    "maxParallelRoles": 3,
    "memoryBudget": "512MB",
    "timeoutMinutes": 30
  }
}
\`\`\`

**Decision Criteria**:
- Consider work item complexity and type
- Account for current system load
- Balance speed vs quality based on priority
- Optimize resource usage
- Ensure quality gates are appropriate
- Plan for potential failures and backtracking`;
  }

  private parseWorkflowDecision(response: string): ClaudeWorkflowDecision {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      const directJsonMatch = response.match(/\{[\s\S]*\}/);
      if (directJsonMatch) {
        return JSON.parse(directJsonMatch[0]);
      }
    } catch (error) {
      this.logger.warn('Failed to parse Claude workflow decision:', error);
    }

    // Fallback decision
    return this.getDefaultWorkflowDecision();
  }

  private getDefaultWorkflowDecision(context?: WorkflowContext): ClaudeWorkflowDecision {
    return {
      selectedWorkflow: context?.workflowId || 'feature_development',
      reasoning: 'Default workflow selection due to parsing failure',
      confidence: 0.5,
      optimizations: [],
      executionStrategy: 'sequential',
      estimatedDuration: 3600,
      roleAdjustments: {},
      qualityGates: {
        test_coverage: 0.85,
        security_score: 0.90,
        code_quality: 0.85
      },
      resourceAllocation: {
        maxParallelRoles: 2,
        memoryBudget: '256MB',
        timeoutMinutes: 60
      }
    };
  }

  private async getOptimizedWorkflow(
    decision: ClaudeWorkflowDecision, 
    context: WorkflowContext
  ): Promise<WorkflowDAG | null> {
    const baseWorkflow = this.workflowDefinitions.get(decision.selectedWorkflow);
    if (!baseWorkflow) return null;

    // Apply Claude's optimizations to the workflow
    const optimizedWorkflow = await this.applyWorkflowOptimizations(
      baseWorkflow,
      decision,
      context
    );

    return optimizedWorkflow;
  }

  private async applyWorkflowOptimizations(
    workflow: WorkflowDAG,
    decision: ClaudeWorkflowDecision,
    context: WorkflowContext
  ): Promise<WorkflowDAG> {
    // Clone the workflow for optimization
    const optimized = JSON.parse(JSON.stringify(workflow));

    // Apply role adjustments
    for (const [roleType, adjustment] of Object.entries(decision.roleAdjustments)) {
      if (adjustment === 'optional') {
        // Mark role as optional (can be skipped under load)
        const nodes = Array.from(optimized.nodes.values())
          .filter((node: WorkflowNode) => node.roleType === roleType);
        nodes.forEach((node: WorkflowNode) => {
          node.optional = true;
        });
      }
    }

    // Update quality gates
    if (decision.qualityGates) {
      optimized.qualityGates = {
        ...optimized.qualityGates,
        ...decision.qualityGates
      };
    }

    // Apply execution strategy optimizations
    if (decision.executionStrategy === 'parallel') {
      // Mark more nodes as parallelizable
      this.optimizeForParallelExecution(optimized);
    }

    return optimized;
  }

  private async gatherProjectContext(projectPath?: string): Promise<any> {
    if (!projectPath) return null;
    
    try {
      // Use tool selector to gather project insights
      const toolChain = await this.toolSelector.selectOptimalTools({
        task: 'Analyze project for workflow optimization',
        projectPath,
        optimization: 'speed'
      });

      return {
        projectPath,
        // Add more context as needed
        size: 100, // placeholder
        primaryLanguages: ['TypeScript'],
        frameworks: ['Node.js'],
        hasTests: true,
        architecture: 'layered'
      };
    } catch (error) {
      this.logger.warn('Failed to gather project context:', error);
      return null;
    }
  }

  private async getSystemLoad(): Promise<any> {
    return {
      activeWorkflows: this.activeExecutions.size,
      cpuUsage: process.cpuUsage().system / 1000000, // Convert to percentage
      memoryUsage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      queueLength: Array.from(this.activeExecutions.values())
        .filter(exec => exec.status === ExecutionStatus.PENDING).length
    };
  }

  private async recordWorkflowDecision(
    execution: WorkflowExecution,
    decision: ClaudeWorkflowDecision
  ): Promise<void> {
    try {
      await this.db.recordClaudeDecision({
        project_id: execution.metadata.projectId,
        decision_type: 'workflow_orchestration',
        context: {
          workItemId: execution.workItemId,
          workItemType: execution.metadata.workItemType
        },
        decision: decision,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.warn('Failed to record workflow decision:', error);
    }
  }

  private async fallbackWorkflowStart(
    workItemId: string,
    workflowId: string,
    inputs: any,
    metadata: any
  ): Promise<string> {
    // Fallback to original implementation
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
    
    // Start execution
    this.executeWorkflow(executionId).catch(error => {
      this.handleExecutionFailure(executionId, error);
    });

    return executionId;
  }

  private optimizeForParallelExecution(workflow: WorkflowDAG): void {
    // Mark compatible roles as parallelizable
    const parallelizableRoles = [
      RoleType.TEST_DESIGNER,
      RoleType.SECURITY_AUDITOR,
      RoleType.PERFORMANCE_AUDITOR,
      RoleType.DOCUMENTATION_WRITER
    ];

    Array.from(workflow.nodes.values()).forEach((node: WorkflowNode) => {
      if (parallelizableRoles.includes(node.roleType)) {
        if (!node.parallelWith) node.parallelWith = [];
        // Add other parallelizable roles
        node.parallelWith.push(...parallelizableRoles.filter(r => r !== node.roleType));
      }
    });
  }

  private async executeWorkflow(executionId: string): Promise<void> {
    const execution = this.activeExecutions?.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const workflow = this.workflowDefinitions?.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${execution.workflowId} not found`);
    }

    execution.status = ExecutionStatus.RUNNING;
    this?.emit('execution-started', execution);

    try {
      // Start from entry points
      const entryNodes = workflow.entryPoints?.map(nodeId => workflow.nodes?.get(nodeId)!);
      await this?.executeNodesInParallel(execution, entryNodes);

      // Continue execution based on DAG
      await this?.traverseWorkflow(execution, workflow);

      execution.status = ExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      
      this.logger.info(`Workflow execution completed: ${executionId}`);
      this?.emit('execution-completed', execution);

    } catch (error) {
      this.logger.error(`Workflow execution error: ${executionId}`, error as Error);
      await this?.handleExecutionError(execution, error);
    }
  }

  private async traverseWorkflow(
    execution: WorkflowExecution, 
    workflow: WorkflowDAG
  ): Promise<void> {
    const visited = new Set<string>(execution.completedNodes);
    const queue: string[] = [...workflow.entryPoints];

    while (queue?.length > 0) {
      // Get next batch of nodes that can execute concurrently
      const readyNodes = this?.getReadyNodes(workflow, visited, queue);
      
      if (readyNodes?.length === 0) {
        // Check if we're waiting for backtrack resolution
        if (execution?.status === ExecutionStatus.BACKTRACKING) {
          await this?.handleBacktrackResolution(execution, workflow);
          continue;
        }
        break;
      }

      // Execute ready nodes in parallel
      const nodes = readyNodes?.map(nodeId => workflow.nodes?.get(nodeId)!);
      await this?.executeNodesInParallel(execution, nodes);

      // Mark nodes as completed and update queue
      readyNodes?.forEach(nodeId => {
        visited?.add(nodeId);
        execution.completedNodes?.push(nodeId);
        queue?.splice(queue?.indexOf(nodeId), 1);
      });

      // Add next nodes to queue
      const nextNodes = this?.getNextNodes(workflow, readyNodes);
      nextNodes?.forEach(nodeId => {
        if (!queue?.includes(nodeId) && !visited?.has(nodeId)) {
          queue?.push(nodeId);
        }
      });

      // Check quality gates at merge points
      if (readyNodes?.some(nodeId => workflow.mergePoints?.includes(nodeId))) {
        const gateResult = await this?.evaluateQualityGates(execution, workflow, readyNodes);
        if (!gateResult.passed) {
          await this?.handleQualityGateFailure(execution, workflow, gateResult);
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
      const node = workflow.nodes?.get(nodeId);
      if (!node) continue;

      // Check if all dependencies are satisfied
      const dependenciesSatisfied = node.dependencies?.every(depId => visited?.has(depId));
      
      if (dependenciesSatisfied) {
        // Check if this node can run in parallel with others
        if (node.parallelWith && node.parallelWith?.length > 0) {
          const groupKey = node.parallelWith?.sort().join(',');
          if (!parallelGroups?.has(groupKey)) {
            parallelGroups?.set(groupKey, []);
          }
          parallelGroups?.get(groupKey)!.push(nodeId);
        } else {
          readyNodes?.push(nodeId);
        }
      }
    }

    // Add parallel groups that are ready
    for (const [groupKey, nodeIds] of parallelGroups) {
      const allNodesReady = nodeIds?.every(nodeId => {
        const node = workflow.nodes?.get(nodeId)!;
        return node.dependencies?.every(depId => visited?.has(depId));
      });
      
      if (allNodesReady && this?.canExecuteParallelGroup(nodeIds)) {
        readyNodes?.push(...nodeIds);
      }
    }

    return readyNodes;
  }

  private canExecuteParallelGroup(nodeIds: string[]): boolean {
    // Check resource availability for parallel execution
    const totalResourcesRequired = nodeIds?.length;
    return totalResourcesRequired <= this.concurrencyConfig.maxParallelNodes;
  }

  private getNextNodes(workflow: WorkflowDAG, completedNodes: string[]): string[] {
    const nextNodes: string[] = [];
    
    for (const edge of workflow.edges) {
      if (completedNodes?.includes(edge.from)) {
        nextNodes?.push(edge.to);
      }
    }
    
    return [...new Set(nextNodes)]; // Remove duplicates
  }

  private async executeNodesInParallel(
    execution: WorkflowExecution, 
    nodes: WorkflowNode[]
  ): Promise<void> {
    const promises = nodes?.map(node => this?.executeNode(execution, node));
    
    try {
      await Promise?.all(promises);
    } catch (error) {
      this.logger.error(`Parallel node execution failed`, error as Error);
      throw error as Error;
    }
  }

  private async executeNode(
    execution: WorkflowExecution, 
    node: WorkflowNode
  ): Promise<void> {
    // Check role instance limits
    const currentInstances = this.roleInstances?.get(node.roleType) || 0;
    const maxInstances = this.concurrencyConfig.roleInstanceLimits?.get(node.roleType) || 1;
    
    if (currentInstances >= maxInstances) {
      await this?.waitForRoleAvailability(node.roleType);
    }

    // Increment role instance count
    this.roleInstances?.set(node.roleType, currentInstances + 1);
    execution.currentNode = node.id;

    this.logger.info(`Executing node: ${node.id} (${node.roleType}) for execution: ${execution.id}`);
    this?.emit('node-started', { execution, node });

    try {
      // Create terminal session for the node execution
      const session = await this?.createTerminalSession(execution, node);
      
      // Execute the node logic
      const result = await this?.executeNodeLogic(execution, node, session);
      
      // Process node results
      await this?.processNodeResult(execution, node, result);
      
      // Clean up terminal session
      await this?.cleanupTerminalSession(session.id);
      
      this.logger.info(`Node completed: ${node.id} for execution: ${execution.id}`);
      this?.emit('node-completed', { execution, node, result });

    } catch (error) {
      this.logger.error(`Node execution failed: ${node.id}`, error as Error);
      execution.failedNodes?.push(node.id);
      
      // Determine if we should backtrack
      if (await this?.shouldBacktrack(execution, node, error)) {
        await this?.initiateBacktrack(execution, node, error);
      } else {
        throw error as Error;
      }
    } finally {
      // Decrement role instance count
      const instances = this.roleInstances?.get(node.roleType) || 0;
      this.roleInstances?.set(node.roleType, Math.max(0, instances - 1));
    }
  }

  private async createTerminalSession(
    execution: WorkflowExecution, 
    node: WorkflowNode
  ): Promise<TerminalSession> {
    const sessionId = `${execution.id}-${node.id}-${Date?.now()}`;
    
    // Create branch if needed
    const branchName = this?.resolveBranchName(node.branchStrategy.pattern, execution);
    
    const session: TerminalSession = {
      id: sessionId,
      nodeId: node.id,
      roleType: node.roleType,
      sessionName: `${node.roleType?.toLowerCase()}-${execution.workItemId}`,
      command: await this?.buildNodeCommand(execution, node),
      workingDirectory: process?.cwd(),
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

    this.terminalSessions?.set(sessionId, session);
    
    // Create git branch if needed
    await this?.createGitBranch(branchName, node.branchStrategy.baseRef, execution);
    execution.branchRefs?.set(node.id, branchName);
    
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
        return await this?.executeWorkClassifier(execution, node, session);
      
      case RoleType.TEST_DESIGNER:
        return await this?.executeTestDesigner(execution, node, session);
      
      case RoleType.IMPLEMENTATION_DEVELOPER:
        return await this?.executeImplementationDeveloper(execution, node, session);
      
      case RoleType.SECURITY_AUDITOR:
        return await this?.executeSecurityAuditor(execution, node, session);
        
      // Add other role implementations...
      
      default:
        return await this?.executeGenericRole(execution, node, session);
    }
  }

  private async shouldBacktrack(
    execution: WorkflowExecution,
    node: WorkflowNode, 
    error: any
  ): Promise<boolean> {
    const workflow = this.workflowDefinitions?.get(execution.workflowId);
    if (!workflow) return false;

    // Check backtrack rules
    for (const rule of workflow.backtrackRules) {
      if (this?.evaluateBacktrackRule(rule, execution, node, error)) {
        // Check if we haven't exceeded max backtrack count
        const backtrackCount = execution.backtrackHistory?.filter(
          event => event?.reason === rule.trigger
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
    const workflow = this.workflowDefinitions?.get(execution.workflowId);
    if (!workflow) return;

    execution.status = ExecutionStatus.BACKTRACKING;
    
    // Find applicable backtrack rule
    const applicableRule = workflow.backtrackRules?.find(rule =>
      this?.evaluateBacktrackRule(rule, execution, node, error)
    );
    
    if (!applicableRule) return;

    const backtrackEvent: BacktrackEvent = {
      id: `bt-${Date?.now()}`,
      fromNode: node.id,
      toNode: applicableRule.targetNode,
      reason: applicableRule.trigger,
      timestamp: new Date(),
      context: this?.gatherBacktrackContext(applicableRule.includeContext, execution, error),
      attempts: execution.backtrackHistory?.filter(e => e?.reason === applicableRule.trigger).length + 1
    };

    execution.backtrackHistory?.push(backtrackEvent);
    
    this.logger.info(`Initiating backtrack from ${node.id} to ${applicableRule.targetNode}`);
    this?.emit('backtrack-initiated', { execution, backtrackEvent });

    // Reset execution state to target node
    await this?.resetExecutionToNode(execution, applicableRule.targetNode);
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
        return error?.type === 'TEST_FAILURE';
        
      case BacktrackTrigger.BUILD_FAILURE:
        return error?.type === 'BUILD_FAILURE';
        
      case BacktrackTrigger.QUALITY_GATE_FAILURE:
        return error?.type === 'QUALITY_GATE_FAILURE';
        
      case BacktrackTrigger.SECURITY_VIOLATION:
        return error?.type === 'SECURITY_VIOLATION';
        
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
    execution.qualityScores?.set(QualityMetric.SECURITY_SCORE, securityScore);
    
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
    this.terminalSessions?.delete(sessionId);
  }

  private resolveBranchName(pattern: string, execution: WorkflowExecution): string {
    return pattern?.replace('{workItemId}', execution.workItemId);
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
    this?.emit('execution-failed', { execution, error });
  }

  private handleExecutionFailure(executionId: string, error: any): void {
    const execution = this.activeExecutions?.get(executionId);
    if (execution) {
      execution.status = ExecutionStatus.FAILED;
      execution.endTime = new Date();
    }
  }

  // Public API methods
  async getExecutionStatus(executionId: string): Promise<WorkflowExecution | null> {
    return this.activeExecutions?.get(executionId) || null;
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions?.get(executionId);
    if (execution && execution?.status === ExecutionStatus.RUNNING) {
      execution.status = ExecutionStatus.CANCELLED;
      execution.endTime = new Date();
      this?.emit('execution-cancelled', execution);
      return true;
    }
    return false;
  }

  async getActiveExecutions(): Promise<WorkflowExecution[]> {
    return Array.from(this.activeExecutions?.values()).filter(
      exec => exec?.status === ExecutionStatus.RUNNING || exec?.status === ExecutionStatus.BACKTRACKING
    );
  }

  async getTerminalSessions(): Promise<TerminalSession[]> {
    return Array.from(this.terminalSessions?.values());
  }

  // Public wrapper for external tool integration
  async executeWorkflowPublic(params: any): Promise<any> {
    try {
      const workflowId = params.workflowId || 'default-workflow';
      const workItemId = params.workItemId || 'external-' + Date.now();
      
      const executionId = await this.startWorkflow(
        workItemId,
        workflowId,
        params,
        { 
          workItemType: 'SIMPLE_DEVELOPMENT',
          priority: 'MEDIUM',
          complexity: 'MODERATE',
          riskLevel: 'LOW',
          projectPath: params.projectPath || '.'
        }
      );
      
      return { executionId, status: 'started' };
    } catch (error) {
      this.logger.error('Failed to execute workflow:', error);
      throw error;
    }
  }
}