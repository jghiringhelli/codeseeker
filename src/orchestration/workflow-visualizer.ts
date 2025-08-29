// Workflow Visualizer - DAG Visualization and Analysis

import { WorkflowDAG, WorkflowNode, WorkflowExecution, ExecutionStatus, RoleType } from './types';
import { WorkflowDefinitions } from './workflow-definitions';

export class WorkflowVisualizer {
  
  static generateMermaidDiagram(workflow: WorkflowDAG): string {
    let mermaid = `graph TD\n`;
    mermaid += `    classDef entryPoint fill:#e1f5fe\n`;
    mermaid += `    classDef mergePoint fill:#f3e5f5\n`;
    mermaid += `    classDef exitPoint fill:#e8f5e8\n`;
    mermaid += `    classDef qualityGate fill:#fff3e0\n`;
    mermaid += `    classDef parallel fill:#fce4ec\n`;
    
    // Add nodes
    for (const [nodeId, node] of workflow.nodes) {
      const displayName = this?.formatNodeName(node.name, node.roleType);
      mermaid += `    ${nodeId}[${displayName}]\n`;
      
      // Add styling based on node type
      if (workflow.entryPoints?.includes(nodeId)) {
        mermaid += `    ${nodeId}:::entryPoint\n`;
      } else if (workflow.exitPoints?.includes(nodeId)) {
        mermaid += `    ${nodeId}:::exitPoint\n`;
      } else if (workflow.mergePoints?.includes(nodeId)) {
        mermaid += `    ${nodeId}:::mergePoint\n`;
      } else if (node.qualityGates && node.qualityGates?.length > 0) {
        mermaid += `    ${nodeId}:::qualityGate\n`;
      } else if (node.parallelWith && node.parallelWith?.length > 0) {
        mermaid += `    ${nodeId}:::parallel\n`;
      }
    }
    
    // Add edges
    for (const edge of workflow.edges) {
      const label = edge.condition ? `|${edge.condition.type}|` : '';
      mermaid += `    ${edge.from} -->${label} ${edge.to}\n`;
    }
    
    return mermaid;
  }

  static generateDotDiagram(workflow: WorkflowDAG): string {
    let dot = `digraph "${workflow.name}" {\n`;
    dot += `    rankdir=TD;\n`;
    dot += `    node [shape=box, style=rounded];\n`;
    
    // Define styles
    dot += `    node [fillcolor=lightblue, style="rounded,filled"] entryNodes;\n`;
    dot += `    node [fillcolor=lightgreen, style="rounded,filled"] exitNodes;\n`;
    dot += `    node [fillcolor=lightyellow, style="rounded,filled"] qualityGates;\n`;
    dot += `    node [fillcolor=lightpink, style="rounded,filled"] parallelNodes;\n`;
    
    // Add subgraphs for parallel execution groups
    const parallelGroups = this?.identifyParallelGroups(workflow);
    parallelGroups?.forEach((nodeIds, groupIndex) => {
      dot += `    subgraph cluster_${groupIndex} {\n`;
      dot += `        label="Parallel Group ${groupIndex + 1}";\n`;
      dot += `        style=dashed;\n`;
      nodeIds?.forEach(nodeId => {
        const node = workflow.nodes?.get(nodeId)!;
        dot += `        "${nodeId}" [label="${this?.formatNodeName(node.name, node.roleType)}"];\n`;
      });
      dot += `    }\n`;
    });
    
    // Add regular nodes
    for (const [nodeId, node] of workflow.nodes) {
      if (!parallelGroups?.some(group => group?.includes(nodeId))) {
        dot += `    "${nodeId}" [label="${this?.formatNodeName(node.name, node.roleType)}"];\n`;
        
        // Add node styling
        if (workflow.entryPoints?.includes(nodeId)) {
          dot += `    "${nodeId}" [fillcolor=lightblue];\n`;
        } else if (workflow.exitPoints?.includes(nodeId)) {
          dot += `    "${nodeId}" [fillcolor=lightgreen];\n`;
        } else if (node.qualityGates && node.qualityGates?.length > 0) {
          dot += `    "${nodeId}" [fillcolor=lightyellow];\n`;
        }
      }
    }
    
    // Add edges
    for (const edge of workflow.edges) {
      const label = edge.condition ? `[label="${edge.condition.type}"]` : '';
      dot += `    "${edge.from}" -> "${edge.to}" ${label};\n`;
    }
    
    dot += `}\n`;
    return dot;
  }

  static generateTextualFlow(workflow: WorkflowDAG): string {
    let output = `\n📋 ${workflow.name} (${workflow.flowType})\n`;
    output += `${'='.repeat(60)}\n`;
    
    // Entry points
    output += `\n🚀 Entry Points:\n`;
    workflow.entryPoints?.forEach(nodeId => {
      const node = workflow.nodes?.get(nodeId)!;
      output += `   • ${node.name} (${node.roleType})\n`;
    });
    
    // Flow execution
    output += `\n🔄 Execution Flow:\n`;
    const executed = new Set<string>();
    const queue = [...workflow.entryPoints];
    let level = 1;
    
    while (queue?.length > 0) {
      const currentLevelNodes = this?.getNodesAtLevel(workflow, queue, executed);
      
      if (currentLevelNodes?.length === 0) break;
      
      output += `\nLevel ${level}:\n`;
      
      // Group parallel nodes
      const parallelGroups = this?.groupParallelNodes(workflow, currentLevelNodes);
      
      parallelGroups?.forEach((group, index) => {
        if (group?.length > 1) {
          output += `   🔀 Parallel Group ${index + 1}:\n`;
          group?.forEach(nodeId => {
            const node = workflow.nodes?.get(nodeId)!;
            output += `      ├─ ${node.name} (${node.roleType})\n`;
            output += `      │  ⏱️  Timeout: ${(node?.executionTimeoutMs / 60000).toFixed(1)}min\n`;
            if (node.qualityGates && node.qualityGates?.length > 0) {
              output += `      │  🚧 Quality Gates: ${node.qualityGates?.length}\n`;
            }
          });
        } else {
          const nodeId = group[0];
          const node = workflow.nodes?.get(nodeId)!;
          output += `   📦 ${node.name} (${node.roleType})\n`;
          output += `      ⏱️  Timeout: ${(node?.executionTimeoutMs / 60000).toFixed(1)}min\n`;
          if (node.qualityGates && node.qualityGates?.length > 0) {
            output += `      🚧 Quality Gates: ${node.qualityGates?.length}\n`;
          }
        }
      });
      
      // Mark as executed and add next nodes
      currentLevelNodes?.forEach(nodeId => executed?.add(nodeId));
      const nextNodes = this?.getNextNodes(workflow, currentLevelNodes);
      nextNodes?.forEach(nodeId => {
        if (!queue?.includes(nodeId) && !executed?.has(nodeId)) {
          queue?.push(nodeId);
        }
      });
      
      // Remove current level nodes from queue
      currentLevelNodes?.forEach(nodeId => {
        const index = queue?.indexOf(nodeId);
        if (index > -1) queue?.splice(index, 1);
      });
      
      level++;
    }
    
    // Merge points
    output += `\n🔀 Quality Gate Merge Points:\n`;
    workflow.mergePoints?.forEach(nodeId => {
      const node = workflow.nodes?.get(nodeId)!;
      output += `   • ${node.name} (${node.roleType})\n`;
    });
    
    // Exit points
    output += `\n🏁 Exit Points:\n`;
    workflow.exitPoints?.forEach(nodeId => {
      const node = workflow.nodes?.get(nodeId)!;
      output += `   • ${node.name} (${node.roleType})\n`;
    });
    
    // Backtrack rules
    if (workflow.backtrackRules?.length > 0) {
      output += `\n🔄 Backtrack Rules:\n`;
      workflow.backtrackRules?.forEach(rule => {
        output += `   • ${rule.trigger} → ${rule.targetNode} (Max attempts: ${rule.maxBacktrackCount})\n`;
      });
    }
    
    // Statistics
    const stats = this?.calculateWorkflowStatistics(workflow);
    output += `\n📊 Workflow Statistics:\n`;
    output += `   • Total Nodes: ${stats.totalNodes}\n`;
    output += `   • Parallel Groups: ${stats.parallelGroups}\n`;
    output += `   • Quality Gates: ${stats.qualityGates}\n`;
    output += `   • Max Parallel Execution: ${stats.maxParallelNodes}\n`;
    output += `   • Estimated Total Time: ${stats.estimatedTotalTimeHours?.toFixed(1)} hours\n`;
    output += `   • Estimated Parallel Time: ${stats.estimatedParallelTimeHours?.toFixed(1)} hours\n`;
    
    return output;
  }

  static generateExecutionReport(
    workflow: WorkflowDAG, 
    execution: WorkflowExecution
  ): string {
    let report = `\n📈 Execution Report: ${execution.id}\n`;
    report += `${'='.repeat(60)}\n`;
    
    report += `📋 Basic Information:\n`;
    report += `   • Workflow: ${workflow.name}\n`;
    report += `   • Work Item: ${execution.workItemId}\n`;
    report += `   • Status: ${this?.getStatusEmoji(execution.status)} ${execution.status}\n`;
    report += `   • Started: ${execution.startTime?.toLocaleString()}\n`;
    if (execution.endTime) {
      const duration = (execution.endTime?.getTime() - execution.startTime?.getTime()) / 1000 / 60;
      report += `   • Completed: ${execution.endTime?.toLocaleString()}\n`;
      report += `   • Duration: ${duration?.toFixed(1)} minutes\n`;
    }
    
    // Current progress
    const totalNodes = workflow.nodes.size;
    const completedNodes = execution.completedNodes?.length;
    const progressPercentage = (completedNodes / totalNodes * 100).toFixed(1);
    
    report += `\n📊 Progress:\n`;
    report += `   • Completed: ${completedNodes}/${totalNodes} nodes (${progressPercentage}%)\n`;
    report += `   • Current Node: ${execution.currentNode || 'None'}\n`;
    if (execution.failedNodes?.length > 0) {
      report += `   • Failed Nodes: ${execution.failedNodes?.join(', ')}\n`;
    }
    
    // Quality scores
    if (execution.qualityScores.size > 0) {
      report += `\n🏆 Quality Scores:\n`;
      for (const [metric, score] of execution.qualityScores) {
        const percentage = (score * 100).toFixed(1);
        const emoji = score >= 0.9 ? '🟢' : score >= 0.7 ? '🟡' : '🔴';
        report += `   ${emoji} ${metric}: ${percentage}%\n`;
      }
    }
    
    // Branch information
    if (execution.branchRefs.size > 0) {
      report += `\n🌿 Git Branches:\n`;
      for (const [nodeId, branchName] of execution.branchRefs) {
        const node = workflow.nodes?.get(nodeId);
        report += `   • ${node?.name || nodeId}: ${branchName}\n`;
      }
    }
    
    // Backtrack history
    if (execution.backtrackHistory?.length > 0) {
      report += `\n🔄 Backtrack Events:\n`;
      execution.backtrackHistory?.forEach((event, index) => {
        report += `   ${index + 1}. ${event.reason}: ${event.fromNode} → ${event.toNode}\n`;
        report += `      Time: ${event.timestamp?.toLocaleString()}\n`;
        report += `      Attempts: ${event.attempts}\n`;
      });
    }
    
    return report;
  }

  static generateRoleUtilizationReport(executions: WorkflowExecution[]): string {
    let report = `\n👥 Role Utilization Report\n`;
    report += `${'='.repeat(40)}\n`;
    
    const roleStats = new Map<RoleType, {
      totalExecutions: number;
      successfulExecutions: number;
      failedExecutions: number;
      avgDurationMs: number;
      totalDurationMs: number;
    }>();
    
    // Initialize stats for all roles
    Object.values(RoleType)?.forEach(roleType => {
      roleStats?.set(roleType, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgDurationMs: 0,
        totalDurationMs: 0
      });
    });
    
    // Calculate statistics (simplified - would need actual node execution data)
    executions?.forEach(execution => {
      // This would be expanded with actual role execution data
    });
    
    for (const [roleType, stats] of roleStats) {
      if (stats.totalExecutions > 0) {
        const successRate = (stats?.successfulExecutions / stats?.totalExecutions * 100).toFixed(1);
        const avgDurationMin = (stats?.avgDurationMs / 60000).toFixed(1);
        
        report += `\n${roleType}:\n`;
        report += `   • Total Executions: ${stats.totalExecutions}\n`;
        report += `   • Success Rate: ${successRate}%\n`;
        report += `   • Avg Duration: ${avgDurationMin} min\n`;
      }
    }
    
    return report;
  }

  // Helper methods
  private static formatNodeName(name: string, roleType: RoleType): string {
    const emoji = this?.getRoleEmoji(roleType);
    return `${emoji} ${name}`;
  }

  private static getRoleEmoji(roleType: RoleType): string {
    const emojiMap: Record<RoleType, string> = {
      [RoleType.ORCHESTRATOR]: '🎭',
      [RoleType.WORK_CLASSIFIER]: '📋',
      [RoleType.REQUIREMENT_ANALYST]: '📝',
      [RoleType.TEST_DESIGNER]: '🧪',
      [RoleType.IMPLEMENTATION_DEVELOPER]: '💻',
      [RoleType.CODE_REVIEWER]: '🔍',
      [RoleType.COMPILER_BUILDER]: '🔨',
      [RoleType.DEVOPS_ENGINEER]: '⚙️',
      [RoleType.DEPLOYER]: '🚀',
      [RoleType.UNIT_TEST_EXECUTOR]: '✅',
      [RoleType.INTEGRATION_TEST_ENGINEER]: '🔗',
      [RoleType.E2E_TEST_ENGINEER]: '🎭',
      [RoleType.SECURITY_AUDITOR]: '🔒',
      [RoleType.PERFORMANCE_AUDITOR]: '⚡',
      [RoleType.QUALITY_AUDITOR]: '⭐',
      [RoleType.TECHNICAL_DOCUMENTER]: '📚',
      [RoleType.USER_DOCUMENTER]: '📖',
      [RoleType.DOCUMENTATION_WRITER]: '📄',
      [RoleType.RELEASE_MANAGER]: '🏷️',
      [RoleType.COMMITTER]: '📝'
    };
    return emojiMap[roleType] || '📦';
  }

  private static getStatusEmoji(status: ExecutionStatus): string {
    const statusMap: Record<ExecutionStatus, string> = {
      [ExecutionStatus.PENDING]: '⏳',
      [ExecutionStatus.RUNNING]: '⚡',
      [ExecutionStatus.COMPLETED]: '✅',
      [ExecutionStatus.FAILED]: '❌',
      [ExecutionStatus.CANCELLED]: '⏹️',
      [ExecutionStatus.BACKTRACKING]: '🔄'
    };
    return statusMap[status] || '❓';
  }

  private static identifyParallelGroups(workflow: WorkflowDAG): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    
    for (const [nodeId, node] of workflow.nodes) {
      if (!processed?.has(nodeId) && node.parallelWith && node.parallelWith?.length > 0) {
        const group = [nodeId, ...node.parallelWith];
        groups?.push(group);
        group?.forEach(id => processed?.add(id));
      }
    }
    
    return groups;
  }

  private static getNodesAtLevel(
    workflow: WorkflowDAG, 
    queue: string[], 
    executed: Set<string>
  ): string[] {
    const readyNodes: string[] = [];
    
    for (const nodeId of queue) {
      const node = workflow.nodes?.get(nodeId);
      if (!node || executed?.has(nodeId)) continue;
      
      const dependenciesSatisfied = node.dependencies?.every(depId => executed?.has(depId));
      if (dependenciesSatisfied) {
        readyNodes?.push(nodeId);
      }
    }
    
    return readyNodes;
  }

  private static groupParallelNodes(workflow: WorkflowDAG, nodeIds: string[]): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    
    for (const nodeId of nodeIds) {
      if (processed?.has(nodeId)) continue;
      
      const node = workflow.nodes?.get(nodeId);
      if (node && node.parallelWith && node.parallelWith?.length > 0) {
        const parallelNodes = node.parallelWith?.filter(id => nodeIds?.includes(id));
        const group = [nodeId, ...parallelNodes];
        groups?.push(group);
        group?.forEach(id => processed?.add(id));
      } else {
        groups?.push([nodeId]);
        processed?.add(nodeId);
      }
    }
    
    return groups;
  }

  private static getNextNodes(workflow: WorkflowDAG, completedNodes: string[]): string[] {
    const nextNodes: string[] = [];
    
    for (const edge of workflow.edges) {
      if (completedNodes?.includes(edge.from)) {
        nextNodes?.push(edge.to);
      }
    }
    
    return [...new Set(nextNodes)];
  }

  private static calculateWorkflowStatistics(workflow: WorkflowDAG) {
    const totalNodes = workflow.nodes.size;
    const parallelGroups = this?.identifyParallelGroups(workflow).length;
    const qualityGates = Array.from(workflow.nodes?.values()).filter(
      node => node.qualityGates && node.qualityGates?.length > 0
    ).length;
    
    // Calculate max parallel nodes
    let maxParallelNodes = 1;
    const parallelGroupSizes = this?.identifyParallelGroups(workflow).map(group => group?.length);
    if (parallelGroupSizes?.length > 0) {
      maxParallelNodes = Math.max(...parallelGroupSizes);
    }
    
    // Estimate execution times
    const totalTimeMs = Array.from(workflow.nodes?.values()).reduce(
      (sum, node) => sum + node.executionTimeoutMs, 0
    );
    
    // Simplified parallel time estimation (would need actual dependency analysis)
    const parallelTimeMs = totalTimeMs * 0.4; // Rough estimate
    
    return {
      totalNodes,
      parallelGroups,
      qualityGates,
      maxParallelNodes,
      estimatedTotalTimeHours: totalTimeMs / 3600000,
      estimatedParallelTimeHours: parallelTimeMs / 3600000
    };
  }
}