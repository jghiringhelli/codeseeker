/**
 * Graphology-based Graph Store
 *
 * Provides in-memory graph database functionality using graphology with:
 * - Directed graph for code relationships
 * - Automatic JSON persistence to disk
 * - Rich traversal and query capabilities
 * - Zero external dependencies (no Neo4j server required)
 *
 * Persists graph state to JSON file periodically and on close.
 */

import Graph from 'graphology';
import * as path from 'path';
import * as fs from 'fs';
import {
  IGraphStore,
  GraphNode,
  GraphEdge
} from '../interfaces';

export class GraphologyGraphStore implements IGraphStore {
  private graph: Graph;
  private dataDir: string;
  private dbPath: string;
  private isDirty = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    dataDir: string,
    private flushIntervalSeconds = 30
  ) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'graph.json');

    // Ensure data directory exists
    fs.mkdirSync(dataDir, { recursive: true });

    // Create or load graph
    this.graph = new Graph({ type: 'directed', allowSelfLoops: false });
    this.loadFromDisk();
    this.startFlushTimer();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(data);

        // Import nodes
        if (parsed.nodes) {
          for (const node of parsed.nodes) {
            this.graph.addNode(node.key, node.attributes);
          }
        }

        // Import edges
        if (parsed.edges) {
          for (const edge of parsed.edges) {
            if (!this.graph.hasEdge(edge.source, edge.target)) {
              this.graph.addEdge(edge.source, edge.target, edge.attributes);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load graph from disk, starting fresh:', error);
      this.graph = new Graph({ type: 'directed', allowSelfLoops: false });
    }
  }

  private saveToDisk(): void {
    try {
      const data = {
        nodes: this.graph.nodes().map(key => ({
          key,
          attributes: this.graph.getNodeAttributes(key)
        })),
        edges: this.graph.edges().map(key => ({
          key,
          source: this.graph.source(key),
          target: this.graph.target(key),
          attributes: this.graph.getEdgeAttributes(key)
        }))
      };

      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf-8');
      this.isDirty = false;
    } catch (error) {
      console.error('Failed to save graph to disk:', error);
    }
  }

  private startFlushTimer(): void {
    if (this.flushIntervalSeconds > 0) {
      this.flushTimer = setInterval(() => {
        if (this.isDirty) {
          this.flush().catch(console.error);
        }
      }, this.flushIntervalSeconds * 1000);
    }
  }

  async upsertNode(node: GraphNode): Promise<void> {
    const attributes = {
      type: node.type,
      name: node.name,
      filePath: node.filePath,
      projectId: node.projectId,
      ...node.properties
    };

    if (this.graph.hasNode(node.id)) {
      this.graph.mergeNodeAttributes(node.id, attributes);
    } else {
      this.graph.addNode(node.id, attributes);
    }

    this.isDirty = true;
  }

  async upsertEdge(edge: GraphEdge): Promise<void> {
    // Ensure both nodes exist
    if (!this.graph.hasNode(edge.source)) {
      this.graph.addNode(edge.source, {});
    }
    if (!this.graph.hasNode(edge.target)) {
      this.graph.addNode(edge.target, {});
    }

    const attributes = {
      type: edge.type,
      ...edge.properties
    };

    // Check if edge already exists
    const existingEdge = this.graph.edge(edge.source, edge.target);
    if (existingEdge) {
      this.graph.mergeEdgeAttributes(existingEdge, attributes);
    } else {
      this.graph.addEdge(edge.source, edge.target, attributes);
    }

    this.isDirty = true;
  }

  async upsertNodes(nodes: GraphNode[]): Promise<void> {
    for (const node of nodes) {
      await this.upsertNode(node);
    }
  }

  async upsertEdges(edges: GraphEdge[]): Promise<void> {
    for (const edge of edges) {
      await this.upsertEdge(edge);
    }
  }

  async findNodes(projectId: string, type?: GraphNode['type']): Promise<GraphNode[]> {
    const nodes: GraphNode[] = [];

    this.graph.forEachNode((nodeId, attributes) => {
      if (attributes.projectId === projectId) {
        if (!type || attributes.type === type) {
          nodes.push({
            id: nodeId,
            type: attributes.type,
            name: attributes.name,
            filePath: attributes.filePath,
            projectId: attributes.projectId,
            properties: this.extractProperties(attributes)
          });
        }
      }
    });

    return nodes;
  }

  async getNode(id: string): Promise<GraphNode | null> {
    if (!this.graph.hasNode(id)) {
      return null;
    }

    const attributes = this.graph.getNodeAttributes(id);
    return {
      id,
      type: attributes.type,
      name: attributes.name,
      filePath: attributes.filePath,
      projectId: attributes.projectId,
      properties: this.extractProperties(attributes)
    };
  }

  async getEdges(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<GraphEdge[]> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const edges: GraphEdge[] = [];

    if (direction === 'out' || direction === 'both') {
      this.graph.forEachOutEdge(nodeId, (edgeId, attributes, source, target) => {
        edges.push({
          id: edgeId,
          source,
          target,
          type: attributes.type,
          properties: this.extractProperties(attributes)
        });
      });
    }

    if (direction === 'in' || direction === 'both') {
      this.graph.forEachInEdge(nodeId, (edgeId, attributes, source, target) => {
        edges.push({
          id: edgeId,
          source,
          target,
          type: attributes.type,
          properties: this.extractProperties(attributes)
        });
      });
    }

    return edges;
  }

  async getNeighbors(nodeId: string, edgeType?: GraphEdge['type']): Promise<GraphNode[]> {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const neighbors: GraphNode[] = [];
    const neighborIds = new Set<string>();

    this.graph.forEachNeighbor(nodeId, (neighborId, attributes) => {
      // Check edge type if specified
      if (edgeType) {
        const edge = this.graph.edge(nodeId, neighborId) || this.graph.edge(neighborId, nodeId);
        if (edge) {
          const edgeAttrs = this.graph.getEdgeAttributes(edge);
          if (edgeAttrs.type !== edgeType) {
            return;
          }
        }
      }

      if (!neighborIds.has(neighborId)) {
        neighborIds.add(neighborId);
        neighbors.push({
          id: neighborId,
          type: attributes.type,
          name: attributes.name,
          filePath: attributes.filePath,
          projectId: attributes.projectId,
          properties: this.extractProperties(attributes)
        });
      }
    });

    return neighbors;
  }

  async findPath(sourceId: string, targetId: string, maxDepth = 5): Promise<GraphNode[]> {
    if (!this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) {
      return [];
    }

    // BFS to find shortest path
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: sourceId, depth: 0 }];

    visited.add(sourceId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.id === targetId) {
        // Reconstruct path
        const path: string[] = [];
        let node: string | undefined = targetId;
        while (node) {
          path.unshift(node);
          node = parent.get(node);
        }

        // Convert to GraphNode[]
        const result: GraphNode[] = [];
        for (const nodeId of path) {
          const graphNode = await this.getNode(nodeId);
          if (graphNode) {
            result.push(graphNode);
          }
        }
        return result;
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      this.graph.forEachNeighbor(current.id, (neighborId) => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          parent.set(neighborId, current.id);
          queue.push({ id: neighborId, depth: current.depth + 1 });
        }
      });
    }

    return [];
  }

  async deleteByProject(projectId: string): Promise<number> {
    const nodesToDelete: string[] = [];

    this.graph.forEachNode((nodeId, attributes) => {
      if (attributes.projectId === projectId) {
        nodesToDelete.push(nodeId);
      }
    });

    for (const nodeId of nodesToDelete) {
      this.graph.dropNode(nodeId);
    }

    this.isDirty = true;
    return nodesToDelete.length;
  }

  async countNodes(projectId: string): Promise<number> {
    let count = 0;
    this.graph.forEachNode((_, attributes) => {
      if (attributes.projectId === projectId) {
        count++;
      }
    });
    return count;
  }

  async flush(): Promise<void> {
    this.saveToDisk();
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  // Extract custom properties from attributes
  private extractProperties(attributes: Record<string, unknown>): Record<string, unknown> | undefined {
    const reserved = ['type', 'name', 'filePath', 'projectId'];
    const properties: Record<string, unknown> = {};
    let hasProperties = false;

    for (const [key, value] of Object.entries(attributes)) {
      if (!reserved.includes(key)) {
        properties[key] = value;
        hasProperties = true;
      }
    }

    return hasProperties ? properties : undefined;
  }
}