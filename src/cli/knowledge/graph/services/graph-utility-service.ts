/**
 * Graph Utility Service
 * Contains helper methods and utility functions for knowledge graph operations
 */

import { KnowledgeNode, KnowledgeTriad, NodeType, RelationType } from '../types';
import { Logger } from '../../../../utils/logger';

export interface IGraphUtilityService {
  generateNodeId(type: NodeType, name: string, namespace?: string): string;
  generateTriadId(subject: string, predicate: RelationType, object: string): string;
  hasConnection(nodeId1: string, nodeId2: string, triads: Map<string, KnowledgeTriad>): boolean;
  calculateClusterCoherence(nodes: string[], triads: Map<string, KnowledgeTriad>): number;
  calculateClusteringCoefficient(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): number;
  groupDuplicates(duplicateTriads: KnowledgeTriad[]): string[][];
  dfsComponent(startNode: string, nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>, visited: Set<string>): Promise<string[]>;
}

export class GraphUtilityService implements IGraphUtilityService {
  private logger = Logger.getInstance().child('GraphUtilityService');

  generateNodeId(type: NodeType, name: string, namespace?: string): string {
    const components = [type, name];
    if (namespace) {
      components.push(namespace);
    }

    // Create a deterministic ID based on type, name, and namespace
    const combined = components.join('::');
    const hash = this.simpleHash(combined);
    return `${type}_${hash}`;
  }

  generateTriadId(subject: string, predicate: RelationType, object: string): string {
    const combined = `${subject}::${predicate}::${object}`;
    const hash = this.simpleHash(combined);
    return `triad_${hash}`;
  }

  hasConnection(nodeId1: string, nodeId2: string, triads: Map<string, KnowledgeTriad>): boolean {
    for (const triad of triads.values()) {
      if ((triad.subject === nodeId1 && triad.object === nodeId2) ||
          (triad.subject === nodeId2 && triad.object === nodeId1)) {
        return true;
      }
    }
    return false;
  }

  calculateClusterCoherence(nodes: string[], triads: Map<string, KnowledgeTriad>): number {
    if (nodes.length < 2) return 1.0;

    let totalConnections = 0;
    let possibleConnections = nodes.length * (nodes.length - 1) / 2;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (this.hasConnection(nodes[i], nodes[j], triads)) {
          totalConnections++;
        }
      }
    }

    return possibleConnections > 0 ? totalConnections / possibleConnections : 0;
  }

  groupDuplicates(duplicateTriads: KnowledgeTriad[]): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();

    for (const triad of duplicateTriads) {
      if (processed.has(triad.id)) continue;

      const group: string[] = [triad.subject, triad.object];
      processed.add(triad.id);

      // Find related duplicates
      for (const otherTriad of duplicateTriads) {
        if (otherTriad.id !== triad.id && !processed.has(otherTriad.id)) {
          if (group.includes(otherTriad.subject) || group.includes(otherTriad.object)) {
            if (!group.includes(otherTriad.subject)) group.push(otherTriad.subject);
            if (!group.includes(otherTriad.object)) group.push(otherTriad.object);
            processed.add(otherTriad.id);
          }
        }
      }

      if (group.length >= 2) {
        groups.push(group);
      }
    }

    return groups;
  }

  async dfsComponent(
    startNode: string,
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>,
    visited: Set<string>
  ): Promise<string[]> {
    const component: string[] = [];
    const stack: string[] = [startNode];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      component.push(nodeId);

      // Find connected nodes
      for (const triad of triads.values()) {
        if (triad.subject === nodeId && !visited.has(triad.object) && nodes.has(triad.object)) {
          stack.push(triad.object);
        } else if (triad.object === nodeId && !visited.has(triad.subject) && nodes.has(triad.subject)) {
          stack.push(triad.subject);
        }
      }
    }

    return component;
  }

  /**
   * Calculate clustering coefficient for the graph
   */
  calculateClusteringCoefficient(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): number {
    let totalCoefficient = 0;
    let nodeCount = 0;

    // Build adjacency list
    const adjacency: Record<string, Set<string>> = {};
    for (const nodeId of nodes.keys()) {
      adjacency[nodeId] = new Set();
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

  /**
   * Check if a node is semantically similar to another
   */
  isSemanticallySimilar(
    nodeId1: string,
    nodeId2: string,
    triads: Map<string, KnowledgeTriad>,
    threshold = 0.7
  ): boolean {
    // Look for direct similarity relationships
    for (const triad of triads.values()) {
      if ((triad.subject === nodeId1 && triad.object === nodeId2) ||
          (triad.subject === nodeId2 && triad.object === nodeId1)) {
        if (triad.predicate === RelationType.IS_SIMILAR_TO ||
            triad.predicate === RelationType.IS_TYPE_OF ||
            triad.predicate === RelationType.RELATES_TO) {
          return (triad.confidence || 1.0) >= threshold;
        }
      }
    }

    return false;
  }

  /**
   * Find all nodes that are semantically related to a given node
   */
  findSemanticNeighbors(
    nodeId: string,
    triads: Map<string, KnowledgeTriad>,
    semanticRelations = [
      RelationType.IS_SIMILAR_TO,
      RelationType.IS_TYPE_OF,
      RelationType.RELATES_TO,
      RelationType.REPRESENTS
    ]
  ): string[] {
    const neighbors: string[] = [];

    for (const triad of triads.values()) {
      if (semanticRelations.includes(triad.predicate)) {
        if (triad.subject === nodeId && !neighbors.includes(triad.object)) {
          neighbors.push(triad.object);
        } else if (triad.object === nodeId && !neighbors.includes(triad.subject)) {
          neighbors.push(triad.subject);
        }
      }
    }

    return neighbors;
  }

  /**
   * Calculate semantic density of a subgraph
   */
  calculateSemanticDensity(
    nodeIds: string[],
    triads: Map<string, KnowledgeTriad>
  ): number {
    if (nodeIds.length < 2) return 1.0;

    const semanticRelations = [
      RelationType.IS_SIMILAR_TO,
      RelationType.IS_TYPE_OF,
      RelationType.RELATES_TO,
      RelationType.REPRESENTS
    ];

    let semanticConnections = 0;
    const possibleConnections = nodeIds.length * (nodeIds.length - 1) / 2;

    for (const triad of triads.values()) {
      if (semanticRelations.includes(triad.predicate) &&
          nodeIds.includes(triad.subject) &&
          nodeIds.includes(triad.object)) {
        semanticConnections++;
      }
    }

    return possibleConnections > 0 ? semanticConnections / possibleConnections : 0;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}