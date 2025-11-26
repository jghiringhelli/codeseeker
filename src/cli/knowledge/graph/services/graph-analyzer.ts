/**
 * Graph Analysis Service
 * Handles complex graph analysis operations following Single Responsibility Principle
 */

import { KnowledgeNode, KnowledgeTriad, GraphAnalysis, SemanticCluster, RelationType, NodeType } from '../types';
import { Logger } from '../../../../utils/logger';

export interface IGraphAnalyzer {
  analyzeGraph(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<GraphAnalysis>;
  findSemanticClusters(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>, minClusterSize?: number): Promise<SemanticCluster[]>;
  calculateCentralityScores(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<Record<string, number>>;
  findStronglyConnectedComponents(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<string[][]>;
  calculateClusteringCoefficient(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): number;
}

export class GraphAnalyzer implements IGraphAnalyzer {
  private logger = Logger.getInstance().child('GraphAnalyzer');

  async analyzeGraph(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<GraphAnalysis> {
    const nodeCount = nodes.size;
    const triadCount = triads.size;

    const relationshipDistribution = {} as Record<RelationType, number>;
    const nodeTypeDistribution = {} as Record<NodeType, number>;

    // Count relationships and node types
    for (const triad of triads.values()) {
      relationshipDistribution[triad.predicate] =
        (relationshipDistribution[triad.predicate] || 0) + 1;
    }

    for (const node of nodes.values()) {
      nodeTypeDistribution[node.type] =
        (nodeTypeDistribution[node.type] || 0) + 1;
    }

    // Calculate centrality scores (simplified PageRank-like algorithm)
    const centralityScores = await this.calculateCentralityScores(nodes, triads);

    // Find strongly connected components
    const stronglyConnectedComponents = await this.findStronglyConnectedComponents(nodes, triads);

    // Calculate clustering coefficient
    const clusteringCoefficient = this.calculateClusteringCoefficient(nodes, triads);

    return {
      nodeCount,
      triadCount,
      relationshipDistribution,
      nodeTypeDistribution,
      centralityScores,
      clusteringCoefficient,
      stronglyConnectedComponents
    };
  }

  async findSemanticClusters(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>,
    minClusterSize = 3
  ): Promise<SemanticCluster[]> {
    const clusters: SemanticCluster[] = [];
    const visited = new Set<string>();

    for (const node of nodes.values()) {
      if (visited.has(node.id)) continue;

      const cluster = await this.expandSemanticCluster(node.id, nodes, triads, visited);
      if (cluster.nodes.length >= minClusterSize) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  async calculateCentralityScores(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};
    const damping = 0.85;
    const iterations = 50;

    // Initialize scores
    for (const node of nodes.values()) {
      scores[node.id] = 1.0;
    }

    // Build adjacency list
    const adjacency: Record<string, string[]> = {};
    const incomingLinks: Record<string, string[]> = {};

    for (const node of nodes.values()) {
      adjacency[node.id] = [];
      incomingLinks[node.id] = [];
    }

    for (const triad of triads.values()) {
      if (adjacency[triad.subject] && adjacency[triad.object]) {
        adjacency[triad.subject].push(triad.object);
        incomingLinks[triad.object].push(triad.subject);
      }
    }

    // Iterative PageRank calculation
    for (let i = 0; i < iterations; i++) {
      const newScores: Record<string, number> = {};

      for (const nodeId of nodes.keys()) {
        let score = (1 - damping) / nodes.size;

        for (const incomingNodeId of incomingLinks[nodeId]) {
          const incomingScore = scores[incomingNodeId];
          const outgoingLinksCount = adjacency[incomingNodeId].length || 1;
          score += damping * (incomingScore / outgoingLinksCount);
        }

        newScores[nodeId] = score;
      }

      // Update scores
      Object.assign(scores, newScores);
    }

    return scores;
  }

  async findStronglyConnectedComponents(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<string[][]> {
    const components: string[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];
    const indices: Record<string, number> = {};
    const lowLinks: Record<string, number> = {};
    const onStack = new Set<string>();
    let index = 0;

    // Build adjacency list
    const adjacency: Record<string, string[]> = {};
    for (const node of nodes.values()) {
      adjacency[node.id] = [];
    }

    for (const triad of triads.values()) {
      if (adjacency[triad.subject] && adjacency[triad.object]) {
        adjacency[triad.subject].push(triad.object);
      }
    }

    // Tarjan's algorithm
    const strongConnect = (v: string) => {
      indices[v] = index;
      lowLinks[v] = index;
      index++;
      stack.push(v);
      onStack.add(v);

      for (const w of adjacency[v] || []) {
        if (indices[w] === undefined) {
          strongConnect(w);
          lowLinks[v] = Math.min(lowLinks[v], lowLinks[w]);
        } else if (onStack.has(w)) {
          lowLinks[v] = Math.min(lowLinks[v], indices[w]);
        }
      }

      if (lowLinks[v] === indices[v]) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== v);

        if (component.length > 1) {
          components.push(component);
        }
      }
    };

    for (const nodeId of nodes.keys()) {
      if (indices[nodeId] === undefined) {
        strongConnect(nodeId);
      }
    }

    return components;
  }

  calculateClusteringCoefficient(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): number {
    let totalCoefficient = 0;
    let nodeCount = 0;

    // Build adjacency list
    const adjacency: Record<string, Set<string>> = {};
    for (const node of nodes.values()) {
      adjacency[node.id] = new Set();
    }

    for (const triad of triads.values()) {
      if (adjacency[triad.subject] && adjacency[triad.object]) {
        adjacency[triad.subject].add(triad.object);
        adjacency[triad.object].add(triad.subject); // Treat as undirected
      }
    }

    for (const nodeId of nodes.keys()) {
      const neighbors = Array.from(adjacency[nodeId]);
      const k = neighbors.length;

      if (k < 2) {
        continue; // Clustering coefficient is 0 for nodes with < 2 neighbors
      }

      let triangles = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (adjacency[neighbors[i]].has(neighbors[j])) {
            triangles++;
          }
        }
      }

      const possibleTriangles = (k * (k - 1)) / 2;
      const coefficient = triangles / possibleTriangles;
      totalCoefficient += coefficient;
      nodeCount++;
    }

    return nodeCount > 0 ? totalCoefficient / nodeCount : 0;
  }

  private async expandSemanticCluster(
    startNodeId: string,
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>,
    visited: Set<string>,
    semanticThreshold = 0.7
  ): Promise<SemanticCluster> {
    const clusterNodes: string[] = [];
    const clusterTriads: string[] = [];
    const queue: string[] = [startNodeId];
    const clusterVisited = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (clusterVisited.has(nodeId)) continue;

      clusterVisited.add(nodeId);
      visited.add(nodeId);
      clusterNodes.push(nodeId);

      // Find related triads
      for (const triad of triads.values()) {
        if ((triad.subject === nodeId || triad.object === nodeId) &&
            !clusterTriads.includes(triad.id)) {
          clusterTriads.push(triad.id);

          // Add connected nodes if they meet semantic similarity threshold
          const connectedNodeId = triad.subject === nodeId ? triad.object : triad.subject;
          if (!clusterVisited.has(connectedNodeId)) {
            const similarity = await this.calculateSemanticSimilarity(nodeId, connectedNodeId, nodes);
            if (similarity >= semanticThreshold) {
              queue.push(connectedNodeId);
            }
          }
        }
      }
    }

    return {
      id: `cluster_${startNodeId}`,
      nodes: clusterNodes,
      triads: clusterTriads,
      semanticScore: await this.calculateClusterSemanticScore(clusterNodes, nodes),
      density: clusterTriads.length / (clusterNodes.length * (clusterNodes.length - 1))
    };
  }

  private async calculateSemanticSimilarity(
    nodeId1: string,
    nodeId2: string,
    nodes: Map<string, KnowledgeNode>
  ): Promise<number> {
    const node1 = nodes.get(nodeId1);
    const node2 = nodes.get(nodeId2);

    if (!node1 || !node2) return 0;

    // Simple semantic similarity based on node type and metadata
    if (node1.type === node2.type) {
      // Same type gets base similarity
      let similarity = 0.5;

      // Check metadata similarity
      const metadata1 = node1.metadata || {};
      const metadata2 = node2.metadata || {};

      const commonKeys = Object.keys(metadata1).filter(key => key in metadata2);
      const totalKeys = new Set([...Object.keys(metadata1), ...Object.keys(metadata2)]).size;

      if (totalKeys > 0) {
        similarity += (commonKeys.length / totalKeys) * 0.3;
      }

      // Check name/label similarity
      if (node1.name && node2.name) {
        const name1 = node1.name.toLowerCase();
        const name2 = node2.name.toLowerCase();

        if (name1.includes(name2) || name2.includes(name1)) {
          similarity += 0.2;
        }
      }

      return Math.min(1.0, similarity);
    }

    return 0.1; // Different types have minimal similarity
  }

  private async calculateClusterSemanticScore(
    clusterNodes: string[],
    nodes: Map<string, KnowledgeNode>
  ): Promise<number> {
    if (clusterNodes.length < 2) return 1.0;

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < clusterNodes.length; i++) {
      for (let j = i + 1; j < clusterNodes.length; j++) {
        const similarity = await this.calculateSemanticSimilarity(
          clusterNodes[i],
          clusterNodes[j],
          nodes
        );
        totalSimilarity += similarity;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }
}