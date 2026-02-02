/**
 * Graph Traversal Manager
 * Handles traversal operations and navigation through the graph
 */

import { KnowledgeNode, KnowledgeTriad, TraversalQuery, SemanticCluster, RelationType, NodeType } from '../types';
import { IGraphStateManager } from './graph-state-manager';
import { IGraphUtilityService } from '../services/graph-utility-service';
import { Logger } from '../../../../utils/logger';

export interface IGraphTraversalManager {
  // Traversal operations
  traverse(query: TraversalQuery, stateManager: IGraphStateManager): Promise<{ nodes: KnowledgeNode[]; path: string[] }>;
  traverseFromNode(startNodeId: string, maxDepth: number, relationFilter: RelationType[], stateManager: IGraphStateManager): Promise<{ nodes: KnowledgeNode[]; depth: number }>;

  // Semantic clustering
  expandSemanticCluster(startNodeId: string, visited: Set<string>, stateManager: IGraphStateManager, utilityService: IGraphUtilityService): Promise<SemanticCluster>;

  // Navigation and pathfinding
  findPath(startId: string, endId: string, stateManager: IGraphStateManager): string[];
  findAllPaths(startId: string, endId: string, maxDepth: number, stateManager: IGraphStateManager): string[][];
  findLongestPath(startId: string, stateManager: IGraphStateManager, maxDepth?: number): string[];

  // Graph exploration
  exploreFromNode(startNodeId: string, explorationDepth: number, stateManager: IGraphStateManager): Promise<{ exploredNodes: string[]; exploredTriads: string[] }>;
  randomWalk(startNodeId: string, steps: number, stateManager: IGraphStateManager): string[];

  // Subgraph operations
  extractSubgraph(nodeIds: string[], stateManager: IGraphStateManager): { nodes: KnowledgeNode[]; triads: KnowledgeTriad[] };
  findConnectedComponent(startNodeId: string, stateManager: IGraphStateManager): string[];
}

export class GraphTraversalManager implements IGraphTraversalManager {
  private logger = Logger.getInstance().child('GraphTraversalManager');

  async traverse(
    query: TraversalQuery,
    stateManager: IGraphStateManager
  ): Promise<{ nodes: KnowledgeNode[]; path: string[] }> {
    const startNodeId = query.startNodes[0]; // Use first node for now
    const maxDepth = query.maxDepth || 5;
    const relationFilter = query.relations || [];

    if (!stateManager.getNodes().has(startNodeId)) {
      throw new Error(`Start node ${startNodeId} not found`);
    }

    const result = await this.traverseFromNode(startNodeId, maxDepth, relationFilter, stateManager);

    // Convert node IDs to actual nodes
    const nodes = result.nodes;
    const path = nodes.map(node => node.id);

    this.logger.debug(`Traversed ${nodes.length} nodes from ${startNodeId} with depth ${result.depth}`);

    return { nodes, path };
  }

  async traverseFromNode(
    startNodeId: string,
    maxDepth: number,
    relationFilter: RelationType[],
    stateManager: IGraphStateManager
  ): Promise<{ nodes: KnowledgeNode[]; depth: number }> {
    const visited = new Set<string>();
    const nodes: KnowledgeNode[] = [];
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];
    let maxDepthReached = 0;

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();

      if (visited.has(nodeId) || depth > maxDepth) continue;

      visited.add(nodeId);
      maxDepthReached = Math.max(maxDepthReached, depth);

      const node = stateManager.getNodes().get(nodeId);
      if (node) {
        nodes.push(node);
      }

      if (depth < maxDepth) {
        // Find connected nodes through filtered relations
        const connectedTriads = Array.from(stateManager.getTriads().values())
          .filter(triad => {
            const isConnected = triad.subject === nodeId || triad.object === nodeId;
            const relationAllowed = relationFilter.length === 0 || relationFilter.includes(triad.predicate);
            return isConnected && relationAllowed;
          });

        for (const triad of connectedTriads) {
          const nextNodeId = triad.subject === nodeId ? triad.object : triad.subject;
          if (!visited.has(nextNodeId)) {
            queue.push({ nodeId: nextNodeId, depth: depth + 1 });
          }
        }
      }
    }

    return { nodes, depth: maxDepthReached };
  }

  async expandSemanticCluster(
    startNodeId: string,
    visited: Set<string>,
    stateManager: IGraphStateManager,
    utilityService: IGraphUtilityService
  ): Promise<SemanticCluster> {
    const clusterNodes = new Set<string>();
    const representativeTriads: KnowledgeTriad[] = [];
    const queue = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      clusterNodes.add(nodeId);

      // Find semantically similar nodes
      const similarTriads = Array.from(stateManager.getTriads().values()).filter(triad =>
        (triad.subject === nodeId && triad.predicate === RelationType.IS_SIMILAR_TO) ||
        (triad.object === nodeId && triad.predicate === RelationType.IS_SIMILAR_TO) ||
        (triad.subject === nodeId && triad.predicate === RelationType.IS_TYPE_OF) ||
        (triad.object === nodeId && triad.predicate === RelationType.IS_TYPE_OF)
      );

      for (const triad of similarTriads) {
        representativeTriads.push(triad);
        const relatedNode = triad.subject === nodeId ? triad.object : triad.subject;
        if (!visited.has(relatedNode)) {
          queue.push(relatedNode);
        }
      }
    }

    const coherenceScore = utilityService.calculateClusterCoherence(Array.from(clusterNodes), stateManager.getTriads());
    const nodeList = Array.from(clusterNodes);
    const triadIds = representativeTriads.map(t => t.id);

    const cluster: SemanticCluster = {
      id: utilityService.generateNodeId(NodeType.CONCEPT, `cluster_${startNodeId}`, 'semantic'),
      nodes: nodeList,
      triads: triadIds,
      semanticScore: coherenceScore,
      density: triadIds.length / (nodeList.length * (nodeList.length - 1) || 1),
      // Backward compatibility
      name: `Semantic Cluster ${startNodeId}`,
      coherenceScore,
      representativeTriads
    };

    this.logger.debug(`Expanded semantic cluster from ${startNodeId} with ${nodeList.length} nodes`);
    return cluster;
  }

  findPath(startId: string, endId: string, stateManager: IGraphStateManager): string[] {
    if (startId === endId) return [startId];

    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startId, path: [startId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift();

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      if (nodeId === endId) {
        return path;
      }

      // Find connected nodes
      for (const triad of stateManager.getTriads().values()) {
        let nextNodeId: string | null = null;

        if (triad.subject === nodeId) {
          nextNodeId = triad.object;
        } else if (triad.object === nodeId) {
          nextNodeId = triad.subject;
        }

        if (nextNodeId && !visited.has(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            path: [...path, nextNodeId]
          });
        }
      }
    }

    return []; // No path found
  }

  findAllPaths(startId: string, endId: string, maxDepth: number, stateManager: IGraphStateManager): string[][] {
    const paths: string[][] = [];

    const dfs = (currentId: string, targetId: string, currentPath: string[], visited: Set<string>, depth: number) => {
      if (depth > maxDepth) return;

      if (currentId === targetId && currentPath.length > 1) {
        paths.push([...currentPath]);
        return;
      }

      for (const triad of stateManager.getTriads().values()) {
        let nextNodeId: string | null = null;

        if (triad.subject === currentId) {
          nextNodeId = triad.object;
        } else if (triad.object === currentId) {
          nextNodeId = triad.subject;
        }

        if (nextNodeId && !visited.has(nextNodeId)) {
          visited.add(nextNodeId);
          currentPath.push(nextNodeId);
          dfs(nextNodeId, targetId, currentPath, visited, depth + 1);
          currentPath.pop();
          visited.delete(nextNodeId);
        }
      }
    };

    const visited = new Set<string>([startId]);
    dfs(startId, endId, [startId], visited, 0);

    return paths;
  }

  findLongestPath(startId: string, stateManager: IGraphStateManager, maxDepth = 20): string[] {
    let longestPath: string[] = [];

    const dfs = (currentId: string, currentPath: string[], visited: Set<string>, depth: number) => {
      if (depth > maxDepth) return;

      if (currentPath.length > longestPath.length) {
        longestPath = [...currentPath];
      }

      for (const triad of stateManager.getTriads().values()) {
        let nextNodeId: string | null = null;

        if (triad.subject === currentId) {
          nextNodeId = triad.object;
        } else if (triad.object === currentId) {
          nextNodeId = triad.subject;
        }

        if (nextNodeId && !visited.has(nextNodeId)) {
          visited.add(nextNodeId);
          currentPath.push(nextNodeId);
          dfs(nextNodeId, currentPath, visited, depth + 1);
          currentPath.pop();
          visited.delete(nextNodeId);
        }
      }
    };

    const visited = new Set<string>([startId]);
    dfs(startId, [startId], visited, 0);

    return longestPath;
  }

  async exploreFromNode(
    startNodeId: string,
    explorationDepth: number,
    stateManager: IGraphStateManager
  ): Promise<{ exploredNodes: string[]; exploredTriads: string[] }> {
    const exploredNodes = new Set<string>();
    const exploredTriads = new Set<string>();
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();

      if (exploredNodes.has(nodeId) || depth > explorationDepth) continue;

      exploredNodes.add(nodeId);

      if (depth < explorationDepth) {
        // Find all connected triads
        for (const triad of stateManager.getTriads().values()) {
          if (triad.subject === nodeId || triad.object === nodeId) {
            exploredTriads.add(triad.id);

            const connectedNodeId = triad.subject === nodeId ? triad.object : triad.subject;
            if (!exploredNodes.has(connectedNodeId)) {
              queue.push({ nodeId: connectedNodeId, depth: depth + 1 });
            }
          }
        }
      }
    }

    return {
      exploredNodes: Array.from(exploredNodes),
      exploredTriads: Array.from(exploredTriads)
    };
  }

  randomWalk(startNodeId: string, steps: number, stateManager: IGraphStateManager): string[] {
    const path: string[] = [startNodeId];
    let currentNodeId = startNodeId;

    for (let i = 0; i < steps; i++) {
      // Find all neighbors
      const neighbors: string[] = [];

      for (const triad of stateManager.getTriads().values()) {
        if (triad.subject === currentNodeId) {
          neighbors.push(triad.object);
        } else if (triad.object === currentNodeId) {
          neighbors.push(triad.subject);
        }
      }

      if (neighbors.length === 0) break; // No more neighbors

      // Choose random neighbor
      const randomIndex = Math.floor(Math.random() * neighbors.length);
      currentNodeId = neighbors[randomIndex];
      path.push(currentNodeId);
    }

    return path;
  }

  extractSubgraph(
    nodeIds: string[],
    stateManager: IGraphStateManager
  ): { nodes: KnowledgeNode[]; triads: KnowledgeTriad[] } {
    const nodeSet = new Set(nodeIds);
    const nodes: KnowledgeNode[] = [];
    const triads: KnowledgeTriad[] = [];

    // Collect nodes
    for (const nodeId of nodeIds) {
      const node = stateManager.getNodes().get(nodeId);
      if (node) {
        nodes.push(node);
      }
    }

    // Collect triads that connect the nodes
    for (const triad of stateManager.getTriads().values()) {
      if (nodeSet.has(triad.subject) && nodeSet.has(triad.object)) {
        triads.push(triad);
      }
    }

    return { nodes, triads };
  }

  findConnectedComponent(startNodeId: string, stateManager: IGraphStateManager): string[] {
    const component: string[] = [];
    const visited = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift();

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      component.push(nodeId);

      // Find all directly connected nodes
      for (const triad of stateManager.getTriads().values()) {
        if (triad.subject === nodeId && !visited.has(triad.object)) {
          queue.push(triad.object);
        } else if (triad.object === nodeId && !visited.has(triad.subject)) {
          queue.push(triad.subject);
        }
      }
    }

    return component;
  }

  // Advanced traversal patterns

  /**
   * Breadth-first search with custom node filter
   */
  bfsWithFilter(
    startNodeId: string,
    nodeFilter: (node: KnowledgeNode) => boolean,
    maxDepth: number,
    stateManager: IGraphStateManager
  ): KnowledgeNode[] {
    const result: KnowledgeNode[] = [];
    const visited = new Set<string>();
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();

      if (visited.has(nodeId) || depth > maxDepth) continue;
      visited.add(nodeId);

      const node = stateManager.getNodes().get(nodeId);
      if (node && nodeFilter(node)) {
        result.push(node);
      }

      if (depth < maxDepth) {
        // Add neighbors to queue
        for (const triad of stateManager.getTriads().values()) {
          let nextNodeId: string | null = null;

          if (triad.subject === nodeId) {
            nextNodeId = triad.object;
          } else if (triad.object === nodeId) {
            nextNodeId = triad.subject;
          }

          if (nextNodeId && !visited.has(nextNodeId)) {
            queue.push({ nodeId: nextNodeId, depth: depth + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Depth-first search with custom relation filter
   */
  dfsWithRelationFilter(
    startNodeId: string,
    relationFilter: (relation: RelationType) => boolean,
    maxDepth: number,
    stateManager: IGraphStateManager
  ): string[] {
    const result: string[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string, depth: number) => {
      if (visited.has(nodeId) || depth > maxDepth) return;

      visited.add(nodeId);
      result.push(nodeId);

      if (depth < maxDepth) {
        for (const triad of stateManager.getTriads().values()) {
          if (!relationFilter(triad.predicate)) continue;

          let nextNodeId: string | null = null;

          if (triad.subject === nodeId) {
            nextNodeId = triad.object;
          } else if (triad.object === nodeId) {
            nextNodeId = triad.subject;
          }

          if (nextNodeId && !visited.has(nextNodeId)) {
            dfs(nextNodeId, depth + 1);
          }
        }
      }
    };

    dfs(startNodeId, 0);
    return result;
  }

  /**
   * Find articulation points (nodes whose removal disconnects the graph)
   */
  findArticulationPoints(stateManager: IGraphStateManager): string[] {
    const articulationPoints: string[] = [];
    const nodeIds = Array.from(stateManager.getNodes().keys());

    for (const nodeId of nodeIds) {
      // Count connected components before removal
      const componentsBefore = this.countConnectedComponents(stateManager);

      // Temporarily remove node and count components
      const componentsAfter = this.countConnectedComponentsWithoutNode(nodeId, stateManager);

      if (componentsAfter > componentsBefore) {
        articulationPoints.push(nodeId);
      }
    }

    return articulationPoints;
  }

  private countConnectedComponents(stateManager: IGraphStateManager): number {
    const visited = new Set<string>();
    let components = 0;

    for (const nodeId of stateManager.getNodes().keys()) {
      if (!visited.has(nodeId)) {
        const component = this.findConnectedComponent(nodeId, stateManager);
        component.forEach(id => visited.add(id));
        components++;
      }
    }

    return components;
  }

  private countConnectedComponentsWithoutNode(excludeNodeId: string, stateManager: IGraphStateManager): number {
    const visited = new Set<string>([excludeNodeId]); // Exclude the node
    let components = 0;

    for (const nodeId of stateManager.getNodes().keys()) {
      if (!visited.has(nodeId)) {
        const component = this.findConnectedComponentExcludingNode(nodeId, excludeNodeId, stateManager);
        component.forEach(id => visited.add(id));
        components++;
      }
    }

    return components;
  }

  private findConnectedComponentExcludingNode(
    startNodeId: string,
    excludeNodeId: string,
    stateManager: IGraphStateManager
  ): string[] {
    const component: string[] = [];
    const visited = new Set<string>([excludeNodeId]); // Start with excluded node as visited
    const queue = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift();

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      component.push(nodeId);

      // Find connected nodes (excluding the excluded node)
      for (const triad of stateManager.getTriads().values()) {
        if (triad.subject === excludeNodeId || triad.object === excludeNodeId) continue;

        if (triad.subject === nodeId && !visited.has(triad.object)) {
          queue.push(triad.object);
        } else if (triad.object === nodeId && !visited.has(triad.subject)) {
          queue.push(triad.subject);
        }
      }
    }

    return component;
  }
}