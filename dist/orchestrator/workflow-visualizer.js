"use strict";
// Workflow Visualizer - DAG Visualization and Analysis
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowVisualizer = void 0;
class WorkflowVisualizer {
    static generateMermaidDiagram(workflow) {
        let mermaid = `graph TD\n`;
        mermaid += `    classDef entryPoint fill:#e1f5fe\n`;
        mermaid += `    classDef mergePoint fill:#f3e5f5\n`;
        mermaid += `    classDef exitPoint fill:#e8f5e8\n`;
        mermaid += `    classDef qualityGate fill:#fff3e0\n`;
        mermaid += `    classDef parallel fill:#fce4ec\n`;
        // Add nodes
        for (const node of workflow.nodes) {
            const extNode = node;
            const displayName = this.formatNodeName(node.name, extNode.roleType);
            mermaid += `    ${node.id}[${displayName}]\n`;
            // Add styling based on node type
            if (workflow.entryPoints?.includes(node.id)) {
                mermaid += `    ${node.id}:::entryPoint\n`;
            }
            else if (workflow.exitPoints?.includes(node.id)) {
                mermaid += `    ${node.id}:::exitPoint\n`;
            }
            else if (workflow.mergePoints?.includes(node.id)) {
                mermaid += `    ${node.id}:::mergePoint\n`;
            }
            else if (extNode.qualityGates && extNode.qualityGates.length > 0) {
                mermaid += `    ${node.id}:::qualityGate\n`;
            }
            else if (extNode.parallelWith && extNode.parallelWith.length > 0) {
                mermaid += `    ${node.id}:::parallel\n`;
            }
        }
        // Add edges
        for (const edge of workflow.edges) {
            const extEdge = edge;
            const label = extEdge.condition ? `|${extEdge.condition.type}|` : '';
            mermaid += `    ${edge.from} -->${label} ${edge.to}\n`;
        }
        return mermaid;
    }
    static generateDotDiagram(workflow) {
        let dot = `digraph "${workflow.name || 'workflow'}" {\n`;
        dot += `    rankdir=TD;\n`;
        dot += `    node [shape=box, style=rounded];\n`;
        // Define styles
        dot += `    node [fillcolor=lightblue, style="rounded,filled"] entryNodes;\n`;
        dot += `    node [fillcolor=lightgreen, style="rounded,filled"] exitNodes;\n`;
        dot += `    node [fillcolor=lightyellow, style="rounded,filled"] qualityGates;\n`;
        dot += `    node [fillcolor=lightpink, style="rounded,filled"] parallelNodes;\n`;
        // Create node map for quick lookup
        const nodeMap = new Map();
        for (const node of workflow.nodes) {
            nodeMap.set(node.id, node);
        }
        // Add nodes with labels
        for (const node of workflow.nodes) {
            const extNode = node;
            const label = this.formatNodeLabel(node.name, extNode.roleType, node.status);
            const style = this.getNodeStyle(node.id, workflow, extNode);
            dot += `    "${node.id}" [label="${label}", ${style}];\n`;
        }
        // Add edges
        for (const edge of workflow.edges) {
            const extEdge = edge;
            const edgeStyle = this.getEdgeStyle(extEdge);
            dot += `    "${edge.from}" -> "${edge.to}" [${edgeStyle}];\n`;
        }
        // Define entry points
        if (workflow.entryPoints) {
            dot += `    { rank=source; ${workflow.entryPoints.map(id => `"${id}"`).join('; ')} }\n`;
        }
        // Define exit points
        if (workflow.exitPoints) {
            dot += `    { rank=sink; ${workflow.exitPoints.map(id => `"${id}"`).join('; ')} }\n`;
        }
        dot += `}\n`;
        return dot;
    }
    static analyzeWorkflowComplexity(workflow) {
        const nodeMap = new Map();
        for (const node of workflow.nodes) {
            nodeMap.set(node.id, node);
        }
        // Calculate cyclomatic complexity
        const cyclomaticComplexity = workflow.edges.length - workflow.nodes.length + 2;
        // Calculate depth
        const depth = this.calculateDepth(workflow, nodeMap);
        // Calculate parallelism
        const parallelism = this.calculateMaxParallelism(workflow, nodeMap);
        // Find critical path
        const criticalPath = this.findCriticalPath(workflow, nodeMap);
        return {
            cyclomaticComplexity,
            depth,
            parallelism,
            criticalPath
        };
    }
    static calculateDepth(workflow, nodeMap) {
        const depths = new Map();
        const visited = new Set();
        function dfs(nodeId) {
            if (visited.has(nodeId)) {
                return depths.get(nodeId) || 0;
            }
            visited.add(nodeId);
            const incomingEdges = workflow.edges.filter(e => e.to === nodeId);
            if (incomingEdges.length === 0) {
                depths.set(nodeId, 0);
                return 0;
            }
            const maxDepth = Math.max(...incomingEdges.map(e => dfs(e.from) + 1));
            depths.set(nodeId, maxDepth);
            return maxDepth;
        }
        let maxDepth = 0;
        for (const node of workflow.nodes) {
            maxDepth = Math.max(maxDepth, dfs(node.id));
        }
        return maxDepth;
    }
    static calculateMaxParallelism(workflow, nodeMap) {
        const levels = new Map();
        const depths = new Map();
        // Calculate depth for each node
        for (const node of workflow.nodes) {
            const depth = this.getNodeDepth(node.id, workflow);
            depths.set(node.id, depth);
            if (!levels.has(depth)) {
                levels.set(depth, []);
            }
            levels.get(depth).push(node.id);
        }
        // Find maximum parallelism
        let maxParallelism = 0;
        for (const [_, nodeIds] of levels) {
            maxParallelism = Math.max(maxParallelism, nodeIds.length);
        }
        return maxParallelism;
    }
    static getNodeDepth(nodeId, workflow) {
        const incomingEdges = workflow.edges.filter(e => e.to === nodeId);
        if (incomingEdges.length === 0) {
            return 0;
        }
        return Math.max(...incomingEdges.map(e => this.getNodeDepth(e.from, workflow) + 1));
    }
    static findCriticalPath(workflow, nodeMap) {
        const distances = new Map();
        const previous = new Map();
        // Initialize distances
        for (const node of workflow.nodes) {
            distances.set(node.id, node.id === workflow.nodes[0]?.id ? 0 : -Infinity);
        }
        // Relax edges
        for (let i = 0; i < workflow.nodes.length - 1; i++) {
            for (const edge of workflow.edges) {
                const fromDist = distances.get(edge.from) || -Infinity;
                const toDist = distances.get(edge.to) || -Infinity;
                if (fromDist + 1 > toDist) {
                    distances.set(edge.to, fromDist + 1);
                    previous.set(edge.to, edge.from);
                }
            }
        }
        // Find the node with maximum distance
        let maxNode = '';
        let maxDist = -Infinity;
        for (const [nodeId, dist] of distances) {
            if (dist > maxDist) {
                maxDist = dist;
                maxNode = nodeId;
            }
        }
        // Reconstruct path
        const path = [];
        let current = maxNode;
        while (current) {
            path.unshift(current);
            current = previous.get(current) || '';
        }
        return path;
    }
    static validateWorkflowStructure(workflow) {
        const errors = [];
        const warnings = [];
        // Check for orphaned nodes
        const connectedNodes = new Set();
        for (const edge of workflow.edges) {
            connectedNodes.add(edge.from);
            connectedNodes.add(edge.to);
        }
        for (const node of workflow.nodes) {
            if (!connectedNodes.has(node.id) && workflow.nodes.length > 1) {
                warnings.push(`Node '${node.id}' is orphaned (not connected to any other node)`);
            }
        }
        // Check for cycles
        if (this.hasCycles(workflow)) {
            errors.push('Workflow contains cycles');
        }
        // Check for duplicate edges
        const edgeSet = new Set();
        for (const edge of workflow.edges) {
            const edgeKey = `${edge.from}->${edge.to}`;
            if (edgeSet.has(edgeKey)) {
                warnings.push(`Duplicate edge found: ${edgeKey}`);
            }
            edgeSet.add(edgeKey);
        }
        // Check for invalid node references in edges
        const nodeIds = new Set(workflow.nodes.map(n => n.id));
        for (const edge of workflow.edges) {
            if (!nodeIds.has(edge.from)) {
                errors.push(`Edge references non-existent source node: ${edge.from}`);
            }
            if (!nodeIds.has(edge.to)) {
                errors.push(`Edge references non-existent target node: ${edge.to}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    static hasCycles(workflow) {
        const visited = new Set();
        const recursionStack = new Set();
        const hasCycleDFS = (nodeId) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            const outgoingEdges = workflow.edges.filter(e => e.from === nodeId);
            for (const edge of outgoingEdges) {
                if (!visited.has(edge.to)) {
                    if (hasCycleDFS(edge.to)) {
                        return true;
                    }
                }
                else if (recursionStack.has(edge.to)) {
                    return true;
                }
            }
            recursionStack.delete(nodeId);
            return false;
        };
        for (const node of workflow.nodes) {
            if (!visited.has(node.id)) {
                if (hasCycleDFS(node.id)) {
                    return true;
                }
            }
        }
        return false;
    }
    // Helper methods
    static formatNodeName(name, roleType) {
        const emoji = roleType ? this.getRoleEmoji(roleType) : '📦';
        return `${emoji} ${name}`;
    }
    static getRoleEmoji(roleType) {
        const emojiMap = {
            'orchestrator': '🎭',
            'analyzer': '📋',
            'validator': '🔍',
            'executor': '💻',
            'reporter': '📊'
        };
        return emojiMap[roleType] || '📦';
    }
    static getStatusEmoji(status) {
        if (!status)
            return '❓';
        const statusMap = {
            'pending': '⏳',
            'running': '⚡',
            'completed': '✅',
            'failed': '❌',
            'cancelled': '⏹️',
            'skipped': '⏭️'
        };
        return statusMap[status] || '❓';
    }
    static identifyParallelGroups(workflow) {
        const groups = [];
        const processed = new Set();
        for (const node of workflow.nodes) {
            const extNode = node;
            if (!processed.has(node.id) && extNode.parallelWith) {
                const group = [node.id, ...extNode.parallelWith];
                groups.push(group);
                group.forEach(id => processed.add(id));
            }
        }
        return groups;
    }
    static formatNodeLabel(name, roleType, status) {
        const statusEmoji = status ? this.getStatusEmoji(status) : '';
        const roleEmoji = roleType ? this.getRoleEmoji(roleType) : '';
        return `${statusEmoji} ${roleEmoji} ${name}`;
    }
    static getNodeStyle(nodeId, workflow, node) {
        if (workflow.entryPoints?.includes(nodeId)) {
            return 'fillcolor=lightblue';
        }
        else if (workflow.exitPoints?.includes(nodeId)) {
            return 'fillcolor=lightgreen';
        }
        else if (node.qualityGates && node.qualityGates.length > 0) {
            return 'fillcolor=lightyellow';
        }
        else if (node.parallelWith && node.parallelWith.length > 0) {
            return 'fillcolor=lightpink';
        }
        return 'fillcolor=white';
    }
    static getEdgeStyle(edge) {
        if (edge.condition) {
            return `label="${edge.condition.type}", style=dashed`;
        }
        return 'style=solid';
    }
    static summarizeExecution(execution, workflow) {
        let summary = `Workflow: ${execution.workflowId}\n`;
        summary += `Status: ${execution.status}\n`;
        summary += `Started: ${execution.startTime}\n`;
        if (execution.endTime) {
            summary += `Ended: ${execution.endTime}\n`;
            const duration = new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime();
            summary += `Duration: ${(duration / 1000).toFixed(2)}s\n`;
        }
        if (execution.currentStep) {
            summary += `Current Step: ${execution.currentStep}\n`;
        }
        if (execution.error) {
            summary += `Error: ${execution.error}\n`;
        }
        // Add workflow details if provided
        if (workflow) {
            summary += `\nWorkflow Details:\n`;
            summary += `  Total Steps: ${workflow.steps.length}\n`;
            if (workflow.qualityGates) {
                summary += `  Quality Gates: ${workflow.qualityGates.length}\n`;
            }
            if (workflow.executionTimeoutMs) {
                summary += `  Timeout: ${(workflow.executionTimeoutMs / 1000).toFixed(0)}s\n`;
            }
        }
        return summary;
    }
}
exports.WorkflowVisualizer = WorkflowVisualizer;
//# sourceMappingURL=workflow-visualizer.js.map