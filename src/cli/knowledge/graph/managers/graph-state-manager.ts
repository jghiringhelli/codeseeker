/**
 * Graph State Manager
 * Manages the in-memory state of nodes, triads, and indexes
 */

import { KnowledgeNode, KnowledgeTriad, NodeType, RelationType } from '../types';
import { IGraphDatabaseService } from '../services/graph-database-service';
import { IGraphUtilityService } from '../services/graph-utility-service';
import { Logger } from '../../../../utils/logger';

export interface IGraphStateManager {
  // State access
  getNodes(): Map<string, KnowledgeNode>;
  getTriads(): Map<string, KnowledgeTriad>;
  getNodeIndex(): Map<NodeType, Set<string>>;
  getRelationIndex(): Map<RelationType, Set<string>>;

  // State initialization
  initializeIndexes(): void;
  rebuildIndexes(): void;
  loadState(databaseService: IGraphDatabaseService): Promise<void>;

  // Node management
  addNode(node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>, utilityService: IGraphUtilityService, databaseService: IGraphDatabaseService): Promise<string>;
  updateNode(nodeId: string, updates: Partial<KnowledgeNode>): Promise<void>;
  removeNode(nodeId: string): Promise<void>;

  // Triad management
  addTriad(triad: Omit<KnowledgeTriad, 'id' | 'createdAt'>, utilityService: IGraphUtilityService, databaseService: IGraphDatabaseService): Promise<string>;
  updateTriad(triadId: string, updates: Partial<KnowledgeTriad>): Promise<void>;
  removeTriad(triadId: string): Promise<void>;

  // State inspection
  getNodeCount(): number;
  getTriadCount(): number;
  validateState(): { isValid: boolean; errors: string[] };
  getMemoryUsage(): { nodes: number; triads: number; indexes: number; total: number };
}

export class GraphStateManager implements IGraphStateManager {
  private logger = Logger.getInstance().child('GraphStateManager');

  private nodes: Map<string, KnowledgeNode> = new Map();
  private triads: Map<string, KnowledgeTriad> = new Map();
  private nodeIndex: Map<NodeType, Set<string>> = new Map();
  private relationIndex: Map<RelationType, Set<string>> = new Map();

  getNodes(): Map<string, KnowledgeNode> {
    return this.nodes;
  }

  getTriads(): Map<string, KnowledgeTriad> {
    return this.triads;
  }

  getNodeIndex(): Map<NodeType, Set<string>> {
    return this.nodeIndex;
  }

  getRelationIndex(): Map<RelationType, Set<string>> {
    return this.relationIndex;
  }

  initializeIndexes(): void {
    // Initialize type and relation indexes for fast queries
    Object.values(NodeType).forEach(type => {
      this.nodeIndex.set(type as NodeType, new Set());
    });

    Object.values(RelationType).forEach(relation => {
      this.relationIndex.set(relation as RelationType, new Set());
    });

    this.logger.debug('Initialized graph indexes');
  }

  rebuildIndexes(): void {
    // Clear existing indexes
    this.nodeIndex.forEach(set => set.clear());
    this.relationIndex.forEach(set => set.clear());

    // Rebuild node indexes
    for (const node of this.nodes.values()) {
      const typeSet = this.nodeIndex.get(node.type);
      if (typeSet) {
        typeSet.add(node.id);
      }
    }

    // Rebuild relation indexes
    for (const triad of this.triads.values()) {
      const relationSet = this.relationIndex.get(triad.predicate);
      if (relationSet) {
        relationSet.add(triad.id);
      }
    }

    this.logger.debug('Graph indexes rebuilt');
  }

  async loadState(databaseService: IGraphDatabaseService): Promise<void> {
    try {
      // Load existing data from database
      this.nodes = await databaseService.loadNodes();
      this.triads = await databaseService.loadTriads();

      this.logger.debug(`Loaded ${this.nodes.size} nodes and ${this.triads.size} triads`);

      // Rebuild indexes after loading
      this.rebuildIndexes();
    } catch (error) {
      // Don't throw - graceful fallback when database unavailable
      this.logger.debug('Graph state using in-memory mode (database unavailable)');
    }
  }

  async addNode(
    node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>,
    utilityService: IGraphUtilityService,
    databaseService: IGraphDatabaseService
  ): Promise<string> {
    const id = utilityService.generateNodeId(node.type, node.metadata?.name || 'unnamed', node.metadata?.namespace);
    const now = new Date();

    const knowledgeNode: KnowledgeNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now
    };

    // Update in-memory structures
    this.nodes.set(id, knowledgeNode);
    const typeSet = this.nodeIndex.get(node.type);
    if (typeSet) {
      typeSet.add(id);
    }

    // Persist to database via service (don't throw on failure)
    try {
      await databaseService.saveNode(knowledgeNode);
    } catch (error) {
      // Keep node in memory even if database save fails
      this.logger.debug(`Node ${id} saved to memory only (database unavailable)`);
    }

    this.logger.debug(`Added node ${id} of type ${node.type}`);
    return id;
  }

  async addTriad(
    triad: Omit<KnowledgeTriad, 'id' | 'createdAt'>,
    utilityService: IGraphUtilityService,
    databaseService: IGraphDatabaseService
  ): Promise<string> {
    const id = utilityService.generateTriadId(triad.subject, triad.predicate, triad.object);
    const now = new Date();

    const knowledgeTriad: KnowledgeTriad = {
      ...triad,
      id,
      createdAt: now
    };

    // Update in-memory structures
    this.triads.set(id, knowledgeTriad);
    const relationSet = this.relationIndex.get(triad.predicate);
    if (relationSet) {
      relationSet.add(id);
    }

    // Persist to database via service (don't throw on failure)
    try {
      await databaseService.saveTriad(knowledgeTriad);
    } catch (error) {
      // Keep triad in memory even if database save fails
      this.logger.debug(`Triad ${id} saved to memory only (database unavailable)`);
    }

    this.logger.debug(`Added triad ${id}: ${triad.subject} -> ${triad.predicate} -> ${triad.object}`);
    return id;
  }

  async updateNode(nodeId: string, updates: Partial<KnowledgeNode>): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (node) {
      const updatedNode = { ...node, ...updates, updatedAt: new Date() };
      this.nodes.set(nodeId, updatedNode);
      this.logger.debug(`Updated node ${nodeId}`);
    } else {
      throw new Error(`Node ${nodeId} not found`);
    }
  }

  async updateTriad(triadId: string, updates: Partial<KnowledgeTriad>): Promise<void> {
    const triad = this.triads.get(triadId);
    if (triad) {
      const updatedTriad = { ...triad, ...updates };
      this.triads.set(triadId, updatedTriad);
      this.logger.debug(`Updated triad ${triadId}`);
    } else {
      throw new Error(`Triad ${triadId} not found`);
    }
  }

  async removeNode(nodeId: string): Promise<void> {
    if (this.nodes.delete(nodeId)) {
      // Remove from indexes
      this.nodeIndex.forEach(set => set.delete(nodeId));
      this.logger.debug(`Removed node ${nodeId}`);
    } else {
      throw new Error(`Node ${nodeId} not found`);
    }
  }

  async removeTriad(triadId: string): Promise<void> {
    if (this.triads.delete(triadId)) {
      // Remove from indexes
      this.relationIndex.forEach(set => set.delete(triadId));
      this.logger.debug(`Removed triad ${triadId}`);
    } else {
      throw new Error(`Triad ${triadId} not found`);
    }
  }

  // Utility methods for state inspection
  getNodeCount(): number {
    return this.nodes.size;
  }

  getTriadCount(): number {
    return this.triads.size;
  }

  getNodesByType(type: NodeType): KnowledgeNode[] {
    const nodeIds = this.nodeIndex.get(type) || new Set();
    return Array.from(nodeIds).map(id => this.nodes.get(id)).filter(Boolean);
  }

  getTriadsByRelation(relation: RelationType): KnowledgeTriad[] {
    const triadIds = this.relationIndex.get(relation) || new Set();
    return Array.from(triadIds).map(id => this.triads.get(id)).filter(Boolean);
  }

  // State validation
  validateState(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    let isValid = true;

    // Check for orphaned triads (triads referencing non-existent nodes)
    for (const triad of this.triads.values()) {
      if (!this.nodes.has(triad.subject)) {
        errors.push(`Triad ${triad.id} references non-existent subject node ${triad.subject}`);
        isValid = false;
      }
      if (!this.nodes.has(triad.object)) {
        errors.push(`Triad ${triad.id} references non-existent object node ${triad.object}`);
        isValid = false;
      }
    }

    // Check index consistency
    for (const [type, nodeIds] of this.nodeIndex.entries()) {
      for (const nodeId of nodeIds) {
        const node = this.nodes.get(nodeId);
        if (!node) {
          errors.push(`Node index contains non-existent node ${nodeId} for type ${type}`);
          isValid = false;
        } else if (node.type !== type) {
          errors.push(`Node ${nodeId} has type ${node.type} but is indexed under ${type}`);
          isValid = false;
        }
      }
    }

    for (const [relation, triadIds] of this.relationIndex.entries()) {
      for (const triadId of triadIds) {
        const triad = this.triads.get(triadId);
        if (!triad) {
          errors.push(`Triad index contains non-existent triad ${triadId} for relation ${relation}`);
          isValid = false;
        } else if (triad.predicate !== relation) {
          errors.push(`Triad ${triadId} has predicate ${triad.predicate} but is indexed under ${relation}`);
          isValid = false;
        }
      }
    }

    if (!isValid) {
      this.logger.warn(`Graph state validation failed with ${errors.length} errors`);
    }

    return { isValid, errors };
  }

  // Memory usage estimation
  getMemoryUsage(): { nodes: number; triads: number; indexes: number; total: number } {
    const nodeMemory = this.nodes.size * 1024; // Rough estimate
    const triadMemory = this.triads.size * 512; // Rough estimate
    const indexMemory = (this.nodeIndex.size + this.relationIndex.size) * 256; // Rough estimate

    return {
      nodes: nodeMemory,
      triads: triadMemory,
      indexes: indexMemory,
      total: nodeMemory + triadMemory + indexMemory
    };
  }

  // Clear all state
  clear(): void {
    this.nodes.clear();
    this.triads.clear();
    this.nodeIndex.forEach(set => set.clear());
    this.relationIndex.forEach(set => set.clear());
    this.logger.info('Graph state cleared');
  }
}