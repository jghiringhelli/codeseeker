/**
 * Graph Query Manager
 * Handles all query operations and search functionality
 */

import { KnowledgeNode, KnowledgeTriad, GraphQuery, NodeType, RelationType } from '../types';
import { IGraphDatabaseService } from '../services/graph-database-service';
import { IGraphStateManager } from './graph-state-manager';
import { Logger } from '../../../../utils/logger';

export interface IGraphQueryManager {
  // Query operations
  queryNodes(query: GraphQuery, databaseService: IGraphDatabaseService, stateManager: IGraphStateManager): Promise<KnowledgeNode[]>;
  queryTriads(query: GraphQuery, databaseService: IGraphDatabaseService, stateManager: IGraphStateManager): Promise<KnowledgeTriad[]>;

  // In-memory fallback queries
  queryNodesInMemory(query: GraphQuery, stateManager: IGraphStateManager): KnowledgeNode[];
  queryTriadsInMemory(query: GraphQuery, stateManager: IGraphStateManager): KnowledgeTriad[];

  // Search operations
  findNodeById(id: string, stateManager: IGraphStateManager): KnowledgeNode | undefined;
  findTriadById(id: string, stateManager: IGraphStateManager): KnowledgeTriad | undefined;
  findNodesByType(type: NodeType, stateManager: IGraphStateManager): KnowledgeNode[];
  findTriadsByRelation(relation: RelationType, stateManager: IGraphStateManager): KnowledgeTriad[];

  // Advanced queries
  findConnectedNodes(nodeId: string, stateManager: IGraphStateManager): string[];
  findNodesByMetadata(metadata: Record<string, any>, stateManager: IGraphStateManager): KnowledgeNode[];
  findTriadsBySubject(subjectId: string, stateManager: IGraphStateManager): KnowledgeTriad[];
  findTriadsByObject(objectId: string, stateManager: IGraphStateManager): KnowledgeTriad[];
  findShortestPath(startId: string, endId: string, stateManager: IGraphStateManager): string[];
  getQueryStats(stateManager: IGraphStateManager): { totalNodes: number; totalTriads: number; averageDegree: number; maxDegree: number; nodeTypeDistribution: Record<string, number>; relationTypeDistribution: Record<string, number> };
}

export class GraphQueryManager implements IGraphQueryManager {
  private logger = Logger.getInstance().child('GraphQueryManager');

  async queryNodes(
    query: GraphQuery,
    databaseService: IGraphDatabaseService,
    stateManager: IGraphStateManager
  ): Promise<KnowledgeNode[]> {
    // Delegate to database service for complex queries, fallback to in-memory for simple ones
    try {
      return await databaseService.queryNodes(query);
    } catch (error) {
      this.logger.warn('Database query failed, using in-memory fallback:', error);
      return this.queryNodesInMemory(query, stateManager);
    }
  }

  async queryTriads(
    query: GraphQuery,
    databaseService: IGraphDatabaseService,
    stateManager: IGraphStateManager
  ): Promise<KnowledgeTriad[]> {
    // Delegate to database service for complex queries, fallback to in-memory for simple ones
    try {
      return await databaseService.queryTriads(query);
    } catch (error) {
      this.logger.warn('Database query failed, using in-memory fallback:', error);
      return this.queryTriadsInMemory(query, stateManager);
    }
  }

  queryNodesInMemory(query: GraphQuery, stateManager: IGraphStateManager): KnowledgeNode[] {
    let candidateNodes: KnowledgeNode[] = Array.from(stateManager.getNodes().values());

    // Apply node type filter
    if (query.nodes?.types) {
      const typeNodes = new Set<string>();
      query.nodes.types.forEach(type => {
        stateManager.getNodeIndex().get(type)?.forEach(id => typeNodes.add(id));
      });
      candidateNodes = candidateNodes.filter(node => typeNodes.has(node.id));
    }

    // Apply confidence filter
    if (query.confidence !== undefined) {
      candidateNodes = candidateNodes.filter(node =>
        (node.metadata?.confidence ?? 1.0) >= query.confidence!
      );
    }

    // Apply metadata filters
    if (query.metadata) {
      candidateNodes = candidateNodes.filter(node =>
        this.matchesMetadata(node.metadata, query.metadata!)
      );
    }

    // Apply name filter
    if (query.nodes?.names) {
      candidateNodes = candidateNodes.filter(node =>
        query.nodes!.names!.some(name =>
          node.name?.includes(name) || node.metadata?.name?.includes(name)
        )
      );
    }

    return candidateNodes.slice(0, query.limit || 100);
  }

  queryTriadsInMemory(query: GraphQuery, stateManager: IGraphStateManager): KnowledgeTriad[] {
    let candidateTriads: KnowledgeTriad[] = Array.from(stateManager.getTriads().values());

    // Apply predicate filter
    if (query.triads?.predicates) {
      const relationTriads = new Set<string>();
      query.triads.predicates.forEach(predicate => {
        stateManager.getRelationIndex().get(predicate)?.forEach(id => relationTriads.add(id));
      });
      candidateTriads = candidateTriads.filter(triad => relationTriads.has(triad.id));
    }

    // Apply subject filter
    if (query.subject) {
      candidateTriads = candidateTriads.filter(triad => triad.subject === query.subject);
    }

    // Apply object filter
    if (query.object) {
      candidateTriads = candidateTriads.filter(triad => triad.object === query.object);
    }

    // Apply predicate filter (direct)
    if (query.predicate) {
      candidateTriads = candidateTriads.filter(triad => triad.predicate === query.predicate);
    }

    // Apply confidence filter
    if (query.confidence !== undefined) {
      candidateTriads = candidateTriads.filter(triad =>
        (triad.confidence ?? 1.0) >= query.confidence!
      );
    }

    return candidateTriads.slice(0, query.limit || 100);
  }

  findNodeById(id: string, stateManager: IGraphStateManager): KnowledgeNode | undefined {
    return stateManager.getNodes().get(id);
  }

  findTriadById(id: string, stateManager: IGraphStateManager): KnowledgeTriad | undefined {
    return stateManager.getTriads().get(id);
  }

  findNodesByType(type: NodeType, stateManager: IGraphStateManager): KnowledgeNode[] {
    const nodeIds = stateManager.getNodeIndex().get(type) || new Set();
    return Array.from(nodeIds)
      .map(id => stateManager.getNodes().get(id)!)
      .filter(Boolean);
  }

  findTriadsByRelation(relation: RelationType, stateManager: IGraphStateManager): KnowledgeTriad[] {
    const triadIds = stateManager.getRelationIndex().get(relation) || new Set();
    return Array.from(triadIds)
      .map(id => stateManager.getTriads().get(id)!)
      .filter(Boolean);
  }

  findConnectedNodes(nodeId: string, stateManager: IGraphStateManager): string[] {
    const connectedNodes = new Set<string>();

    for (const triad of stateManager.getTriads().values()) {
      if (triad.subject === nodeId) {
        connectedNodes.add(triad.object);
      } else if (triad.object === nodeId) {
        connectedNodes.add(triad.subject);
      }
    }

    connectedNodes.delete(nodeId); // Remove self
    return Array.from(connectedNodes);
  }

  findNodesByMetadata(metadata: Record<string, any>, stateManager: IGraphStateManager): KnowledgeNode[] {
    return Array.from(stateManager.getNodes().values())
      .filter(node => this.matchesMetadata(node.metadata, metadata));
  }

  findTriadsBySubject(subjectId: string, stateManager: IGraphStateManager): KnowledgeTriad[] {
    return Array.from(stateManager.getTriads().values())
      .filter(triad => triad.subject === subjectId);
  }

  findTriadsByObject(objectId: string, stateManager: IGraphStateManager): KnowledgeTriad[] {
    return Array.from(stateManager.getTriads().values())
      .filter(triad => triad.object === objectId);
  }

  // Advanced query operations

  /**
   * Find nodes within N degrees of separation from a starting node
   */
  findNodesWithinDegrees(startNodeId: string, degrees: number, stateManager: IGraphStateManager): string[] {
    const visited = new Set<string>();
    const queue: { nodeId: string; degree: number }[] = [{ nodeId: startNodeId, degree: 0 }];
    const result: string[] = [];

    while (queue.length > 0) {
      const { nodeId, degree } = queue.shift()!;

      if (visited.has(nodeId) || degree > degrees) continue;

      visited.add(nodeId);
      if (degree > 0) { // Don't include the starting node
        result.push(nodeId);
      }

      if (degree < degrees) {
        const connected = this.findConnectedNodes(nodeId, stateManager);
        for (const connectedId of connected) {
          if (!visited.has(connectedId)) {
            queue.push({ nodeId: connectedId, degree: degree + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Find shortest path between two nodes
   */
  findShortestPath(startNodeId: string, endNodeId: string, stateManager: IGraphStateManager): string[] {
    if (startNodeId === endNodeId) return [startNodeId];

    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startNodeId, path: [startNodeId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      if (nodeId === endNodeId) {
        return path;
      }

      const connected = this.findConnectedNodes(nodeId, stateManager);
      for (const connectedId of connected) {
        if (!visited.has(connectedId)) {
          queue.push({
            nodeId: connectedId,
            path: [...path, connectedId]
          });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Find all cycles in the graph starting from a node
   */
  findCycles(startNodeId: string, stateManager: IGraphStateManager, maxDepth = 10): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string, path: string[], depth: number) => {
      if (depth > maxDepth) return;

      const cycleIndex = path.indexOf(nodeId);
      if (cycleIndex !== -1) {
        // Found a cycle
        const cycle = path.slice(cycleIndex);
        if (cycle.length > 2) { // Ignore trivial cycles
          cycles.push(cycle);
        }
        return;
      }

      if (visited.has(nodeId)) return;

      const newPath = [...path, nodeId];
      const connected = this.findConnectedNodes(nodeId, stateManager);

      for (const connectedId of connected) {
        dfs(connectedId, newPath, depth + 1);
      }
    };

    dfs(startNodeId, [], 0);
    return cycles;
  }

  /**
   * Get node degree (number of connections)
   */
  getNodeDegree(nodeId: string, stateManager: IGraphStateManager): { in: number; out: number; total: number } {
    let inDegree = 0;
    let outDegree = 0;

    for (const triad of stateManager.getTriads().values()) {
      if (triad.subject === nodeId) {
        outDegree++;
      }
      if (triad.object === nodeId) {
        inDegree++;
      }
    }

    return {
      in: inDegree,
      out: outDegree,
      total: inDegree + outDegree
    };
  }

  /**
   * Find hub nodes (nodes with high degree)
   */
  findHubNodes(stateManager: IGraphStateManager, threshold = 5): Array<{ nodeId: string; degree: number }> {
    const hubs: Array<{ nodeId: string; degree: number }> = [];

    for (const nodeId of stateManager.getNodes().keys()) {
      const degree = this.getNodeDegree(nodeId, stateManager).total;
      if (degree >= threshold) {
        hubs.push({ nodeId, degree });
      }
    }

    return hubs.sort((a, b) => b.degree - a.degree);
  }

  // Helper methods

  private matchesMetadata(nodeMetadata: any, queryMetadata: any): boolean {
    if (!nodeMetadata || !queryMetadata) return false;

    return Object.entries(queryMetadata).every(([key, value]) => {
      const nodeValue = nodeMetadata[key];

      // Handle different types of matching
      if (Array.isArray(value)) {
        return Array.isArray(nodeValue) &&
               value.some(v => nodeValue.includes(v));
      }

      if (typeof value === 'string' && typeof nodeValue === 'string') {
        return nodeValue.toLowerCase().includes(value.toLowerCase());
      }

      return nodeValue === value;
    });
  }

  private matchesNodeFilter(node: KnowledgeNode, filters?: any): boolean {
    if (!filters) return true;

    if (filters.types && !filters.types.includes(node.type)) return false;
    if (filters.names && !filters.names.some((name: string) =>
      node.name?.includes(name) || node.metadata?.name?.includes(name))) return false;
    if (filters.namespaces && node.metadata?.namespace &&
        !filters.namespaces.includes(node.metadata.namespace)) return false;

    return true;
  }

  // Statistics and analytics

  /**
   * Get query performance statistics
   */
  getQueryStats(stateManager: IGraphStateManager): {
    totalNodes: number;
    totalTriads: number;
    averageDegree: number;
    maxDegree: number;
    nodeTypeDistribution: Record<string, number>;
    relationTypeDistribution: Record<string, number>;
  } {
    const totalNodes = stateManager.getNodeCount();
    const totalTriads = stateManager.getTriadCount();

    let totalDegree = 0;
    let maxDegree = 0;

    for (const nodeId of stateManager.getNodes().keys()) {
      const degree = this.getNodeDegree(nodeId, stateManager).total;
      totalDegree += degree;
      maxDegree = Math.max(maxDegree, degree);
    }

    const averageDegree = totalNodes > 0 ? totalDegree / totalNodes : 0;

    const nodeTypeDistribution: Record<string, number> = {};
    for (const node of stateManager.getNodes().values()) {
      nodeTypeDistribution[node.type] = (nodeTypeDistribution[node.type] || 0) + 1;
    }

    const relationTypeDistribution: Record<string, number> = {};
    for (const triad of stateManager.getTriads().values()) {
      relationTypeDistribution[triad.predicate] = (relationTypeDistribution[triad.predicate] || 0) + 1;
    }

    return {
      totalNodes,
      totalTriads,
      averageDegree,
      maxDegree,
      nodeTypeDistribution,
      relationTypeDistribution
    };
  }
}