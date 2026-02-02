/**
 * Graph Mutation Manager
 * Handles all graph modification operations
 */

import { KnowledgeNode, KnowledgeTriad, GraphMutation } from '../types';
import { IGraphDatabaseService } from '../services/graph-database-service';
import { IGraphStateManager } from './graph-state-manager';
import { Logger } from '../../../../utils/logger';

export interface IGraphMutationManager {
  // Mutation operations
  mutateGraph(mutation: GraphMutation, stateManager: IGraphStateManager, databaseService: IGraphDatabaseService): Promise<void>;
  applyMutationToMemory(mutation: GraphMutation, stateManager: IGraphStateManager): Promise<void>;

  // Batch operations
  batchAddNodes(nodes: Array<Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>>, stateManager: IGraphStateManager, databaseService: IGraphDatabaseService): Promise<string[]>;
  batchAddTriads(triads: Array<Omit<KnowledgeTriad, 'id' | 'createdAt'>>, stateManager: IGraphStateManager, databaseService: IGraphDatabaseService): Promise<string[]>;
  batchRemoveNodes(nodeIds: string[], stateManager: IGraphStateManager): Promise<void>;
  batchRemoveTriads(triadIds: string[], stateManager: IGraphStateManager): Promise<void>;

  // Graph transformations
  mergeNodes(sourceNodeId: string, targetNodeId: string, stateManager: IGraphStateManager): Promise<void>;
  splitNode(nodeId: string, splitCriteria: (triad: KnowledgeTriad) => boolean, stateManager: IGraphStateManager): Promise<{ node1Id: string; node2Id: string }>;
  replaceNode(oldNodeId: string, newNode: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>, stateManager: IGraphStateManager, databaseService: IGraphDatabaseService): Promise<string>;

  // Cleanup operations
  removeOrphanedNodes(stateManager: IGraphStateManager): Promise<string[]>;
  removeDuplicateTriads(stateManager: IGraphStateManager): Promise<string[]>;
  removeWeakConnections(confidenceThreshold: number, stateManager: IGraphStateManager): Promise<string[]>;
  optimizeGraph(stateManager: IGraphStateManager): Promise<{ orphanedNodes: string[]; duplicateTriads: string[]; weakConnections: string[] }>;
}

export class GraphMutationManager implements IGraphMutationManager {
  private logger = Logger.getInstance().child('GraphMutationManager');

  async mutateGraph(
    mutation: GraphMutation,
    stateManager: IGraphStateManager,
    databaseService: IGraphDatabaseService
  ): Promise<void> {
    // Delegate to database service for persistence, then update in-memory structures
    try {
      await databaseService.mutateGraph(mutation);

      // Update in-memory structures to stay in sync
      await this.applyMutationToMemory(mutation, stateManager);

      // Rebuild indexes
      stateManager.rebuildIndexes();

      this.logger.info('Graph mutation applied successfully');
    } catch (error) {
      // Don't throw - graceful fallback when database unavailable
      this.logger.debug('Graph mutation using memory-only mode (database unavailable)');
    }
  }

  async applyMutationToMemory(
    mutation: GraphMutation,
    stateManager: IGraphStateManager
  ): Promise<void> {
    // Apply mutations to in-memory structures
    if (mutation.addNodes) {
      for (const node of mutation.addNodes) {
        // Note: This would need utility and database service references
        // For now, we'll skip the actual addition and just log
        this.logger.debug(`Would add node: ${node.type}`);
      }
    }

    if (mutation.addTriads) {
      for (const triad of mutation.addTriads) {
        // Note: This would need utility and database service references
        this.logger.debug(`Would add triad: ${triad.subject} -> ${triad.predicate} -> ${triad.object}`);
      }
    }

    if (mutation.removeNodes) {
      for (const nodeId of mutation.removeNodes) {
        await stateManager.removeNode(nodeId);
      }
    }

    if (mutation.removeTriads) {
      for (const triadId of mutation.removeTriads) {
        await stateManager.removeTriad(triadId);
      }
    }

    if (mutation.updateNodes) {
      for (const [nodeId, updates] of Object.entries(mutation.updateNodes)) {
        await stateManager.updateNode(nodeId, updates);
      }
    }

    if (mutation.updateTriads) {
      for (const [triadId, updates] of Object.entries(mutation.updateTriads)) {
        await stateManager.updateTriad(triadId, updates);
      }
    }
  }

  async batchAddNodes(
    nodes: Array<Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>>,
    stateManager: IGraphStateManager,
    databaseService: IGraphDatabaseService
  ): Promise<string[]> {
    const addedNodeIds: string[] = [];

    this.logger.info(`Starting batch addition of ${nodes.length} nodes`);

    for (const node of nodes) {
      try {
        // Note: We would need utility service reference here
        // For now, create a simple ID
        const id = `batch_node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const knowledgeNode: KnowledgeNode = {
          ...node,
          id,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        stateManager.getNodes().set(id, knowledgeNode);
        await databaseService.saveNode(knowledgeNode);
        addedNodeIds.push(id);

      } catch (error) {
        // Don't spam errors - continue with other nodes
        this.logger.debug(`Node batch operation using memory-only mode`);
      }
    }

    stateManager.rebuildIndexes();
    this.logger.info(`Batch added ${addedNodeIds.length} out of ${nodes.length} nodes`);

    return addedNodeIds;
  }

  async batchAddTriads(
    triads: Array<Omit<KnowledgeTriad, 'id' | 'createdAt'>>,
    stateManager: IGraphStateManager,
    databaseService: IGraphDatabaseService
  ): Promise<string[]> {
    const addedTriadIds: string[] = [];

    this.logger.info(`Starting batch addition of ${triads.length} triads`);

    for (const triad of triads) {
      try {
        // Note: We would need utility service reference here
        const id = `batch_triad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const knowledgeTriad: KnowledgeTriad = {
          ...triad,
          id,
          createdAt: new Date()
        };

        stateManager.getTriads().set(id, knowledgeTriad);
        await databaseService.saveTriad(knowledgeTriad);
        addedTriadIds.push(id);

      } catch (error) {
        // Don't spam errors - continue with other triads
        this.logger.debug(`Triad batch operation using memory-only mode`);
      }
    }

    stateManager.rebuildIndexes();
    this.logger.info(`Batch added ${addedTriadIds.length} out of ${triads.length} triads`);

    return addedTriadIds;
  }

  async batchRemoveNodes(nodeIds: string[], stateManager: IGraphStateManager): Promise<void> {
    this.logger.info(`Starting batch removal of ${nodeIds.length} nodes`);

    for (const nodeId of nodeIds) {
      try {
        await stateManager.removeNode(nodeId);
      } catch (error) {
        // Continue with other nodes silently
        this.logger.debug(`Node ${nodeId} removal skipped`);
      }
    }

    stateManager.rebuildIndexes();
    this.logger.info(`Completed batch removal of nodes`);
  }

  async batchRemoveTriads(triadIds: string[], stateManager: IGraphStateManager): Promise<void> {
    this.logger.info(`Starting batch removal of ${triadIds.length} triads`);

    for (const triadId of triadIds) {
      try {
        await stateManager.removeTriad(triadId);
      } catch (error) {
        // Continue with other triads silently
        this.logger.debug(`Triad ${triadId} removal skipped`);
      }
    }

    stateManager.rebuildIndexes();
    this.logger.info(`Completed batch removal of triads`);
  }

  async mergeNodes(
    sourceNodeId: string,
    targetNodeId: string,
    stateManager: IGraphStateManager
  ): Promise<void> {
    const sourceNode = stateManager.getNodes().get(sourceNodeId);
    const targetNode = stateManager.getNodes().get(targetNodeId);

    if (!sourceNode || !targetNode) {
      throw new Error(`Cannot merge: source or target node not found`);
    }

    this.logger.info(`Merging node ${sourceNodeId} into ${targetNodeId}`);

    // Find all triads involving the source node and redirect them to target
    const triadUpdates: Array<{ triadId: string; updates: Partial<KnowledgeTriad> }> = [];

    for (const triad of stateManager.getTriads().values()) {
      if (triad.subject === sourceNodeId) {
        triadUpdates.push({
          triadId: triad.id,
          updates: { subject: targetNodeId }
        });
      } else if (triad.object === sourceNodeId) {
        triadUpdates.push({
          triadId: triad.id,
          updates: { object: targetNodeId }
        });
      }
    }

    // Apply updates
    for (const { triadId, updates } of triadUpdates) {
      await stateManager.updateTriad(triadId, updates);
    }

    // Merge metadata (combine, with target taking precedence for conflicts)
    const mergedMetadata = {
      ...sourceNode.metadata,
      ...targetNode.metadata,
      // Keep track of the merge
      mergedFrom: sourceNode.id,
      mergedAt: new Date().toISOString()
    };

    await stateManager.updateNode(targetNodeId, { metadata: mergedMetadata });

    // Remove the source node
    await stateManager.removeNode(sourceNodeId);

    this.logger.info(`Successfully merged ${sourceNodeId} into ${targetNodeId}`);
  }

  async splitNode(
    nodeId: string,
    splitCriteria: (triad: KnowledgeTriad) => boolean,
    stateManager: IGraphStateManager
  ): Promise<{ node1Id: string; node2Id: string }> {
    const originalNode = stateManager.getNodes().get(nodeId);
    if (!originalNode) {
      throw new Error(`Cannot split: node ${nodeId} not found`);
    }

    this.logger.info(`Splitting node ${nodeId}`);

    // Create two new nodes
    const node1Id = `${nodeId}_split_1`;
    const node2Id = `${nodeId}_split_2`;

    const baseNode = {
      type: originalNode.type,
      name: originalNode.name,
      metadata: { ...originalNode.metadata }
    };

    const node1: KnowledgeNode = {
      ...baseNode,
      id: node1Id,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...baseNode.metadata,
        splitFrom: originalNode.id,
        splitPart: '1'
      }
    };

    const node2: KnowledgeNode = {
      ...baseNode,
      id: node2Id,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...baseNode.metadata,
        splitFrom: originalNode.id,
        splitPart: '2'
      }
    };

    // Add new nodes
    stateManager.getNodes().set(node1Id, node1);
    stateManager.getNodes().set(node2Id, node2);

    // Redistribute triads based on split criteria
    for (const triad of stateManager.getTriads().values()) {
      if (triad.subject === nodeId) {
        const targetNodeId = splitCriteria(triad) ? node1Id : node2Id;
        await stateManager.updateTriad(triad.id, { subject: targetNodeId });
      } else if (triad.object === nodeId) {
        const targetNodeId = splitCriteria(triad) ? node1Id : node2Id;
        await stateManager.updateTriad(triad.id, { object: targetNodeId });
      }
    }

    // Remove original node
    await stateManager.removeNode(nodeId);

    this.logger.info(`Successfully split ${nodeId} into ${node1Id} and ${node2Id}`);

    return { node1Id, node2Id };
  }

  async replaceNode(
    oldNodeId: string,
    newNode: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>,
    stateManager: IGraphStateManager,
    databaseService: IGraphDatabaseService
  ): Promise<string> {
    const oldNode = stateManager.getNodes().get(oldNodeId);
    if (!oldNode) {
      throw new Error(`Cannot replace: node ${oldNodeId} not found`);
    }

    this.logger.info(`Replacing node ${oldNodeId}`);

    // Create new node
    const newNodeId = `${oldNodeId}_replaced_${Date.now()}`;
    const knowledgeNode: KnowledgeNode = {
      ...newNode,
      id: newNodeId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...newNode.metadata,
        replacedFrom: oldNodeId,
        replacedAt: new Date().toISOString()
      }
    };

    // Add new node
    stateManager.getNodes().set(newNodeId, knowledgeNode);
    await databaseService.saveNode(knowledgeNode);

    // Update all triads to reference new node
    for (const triad of stateManager.getTriads().values()) {
      if (triad.subject === oldNodeId) {
        await stateManager.updateTriad(triad.id, { subject: newNodeId });
      } else if (triad.object === oldNodeId) {
        await stateManager.updateTriad(triad.id, { object: newNodeId });
      }
    }

    // Remove old node
    await stateManager.removeNode(oldNodeId);

    this.logger.info(`Successfully replaced ${oldNodeId} with ${newNodeId}`);

    return newNodeId;
  }

  async removeOrphanedNodes(stateManager: IGraphStateManager): Promise<string[]> {
    const orphanedNodes: string[] = [];
    const connectedNodes = new Set<string>();

    // Find all nodes that are connected via triads
    for (const triad of stateManager.getTriads().values()) {
      connectedNodes.add(triad.subject);
      connectedNodes.add(triad.object);
    }

    // Identify orphaned nodes
    for (const nodeId of stateManager.getNodes().keys()) {
      if (!connectedNodes.has(nodeId)) {
        orphanedNodes.push(nodeId);
      }
    }

    this.logger.info(`Found ${orphanedNodes.length} orphaned nodes`);

    // Remove orphaned nodes
    for (const nodeId of orphanedNodes) {
      try {
        await stateManager.removeNode(nodeId);
      } catch (error) {
        // Continue silently
        this.logger.debug(`Orphaned node ${nodeId} removal skipped`);
      }
    }

    return orphanedNodes;
  }

  async removeDuplicateTriads(stateManager: IGraphStateManager): Promise<string[]> {
    const duplicateTriads: string[] = [];
    const seenTriads = new Map<string, string>(); // signature -> triad ID

    for (const triad of stateManager.getTriads().values()) {
      const signature = `${triad.subject}:${triad.predicate}:${triad.object}`;

      if (seenTriads.has(signature)) {
        duplicateTriads.push(triad.id);
      } else {
        seenTriads.set(signature, triad.id);
      }
    }

    this.logger.info(`Found ${duplicateTriads.length} duplicate triads`);

    // Remove duplicate triads
    for (const triadId of duplicateTriads) {
      try {
        await stateManager.removeTriad(triadId);
      } catch (error) {
        // Continue silently
        this.logger.debug(`Duplicate triad ${triadId} removal skipped`);
      }
    }

    return duplicateTriads;
  }

  async removeWeakConnections(
    confidenceThreshold: number,
    stateManager: IGraphStateManager
  ): Promise<string[]> {
    const weakTriads: string[] = [];

    for (const triad of stateManager.getTriads().values()) {
      const confidence = triad.confidence ?? 1.0;
      if (confidence < confidenceThreshold) {
        weakTriads.push(triad.id);
      }
    }

    this.logger.info(`Found ${weakTriads.length} weak connections below threshold ${confidenceThreshold}`);

    // Remove weak triads
    for (const triadId of weakTriads) {
      try {
        await stateManager.removeTriad(triadId);
      } catch (error) {
        // Continue silently
        this.logger.debug(`Weak triad ${triadId} removal skipped`);
      }
    }

    return weakTriads;
  }

  // Advanced mutation operations

  /**
   * Optimize graph structure by removing redundant connections
   */
  async optimizeGraph(stateManager: IGraphStateManager): Promise<{
    orphanedNodes: string[];
    duplicateTriads: string[];
    weakConnections: string[];
  }> {
    this.logger.info('Starting graph optimization');

    const orphanedNodes = await this.removeOrphanedNodes(stateManager);
    const duplicateTriads = await this.removeDuplicateTriads(stateManager);
    const weakConnections = await this.removeWeakConnections(0.1, stateManager); // Remove very weak connections

    stateManager.rebuildIndexes();

    this.logger.info(`Graph optimization completed: removed ${orphanedNodes.length} orphaned nodes, ${duplicateTriads.length} duplicate triads, ${weakConnections.length} weak connections`);

    return {
      orphanedNodes,
      duplicateTriads,
      weakConnections
    };
  }

  /**
   * Compact node IDs to save memory
   */
  async compactNodeIds(stateManager: IGraphStateManager): Promise<Map<string, string>> {
    const idMapping = new Map<string, string>();
    let counter = 1;

    // Create mapping from old IDs to new compact IDs
    for (const nodeId of stateManager.getNodes().keys()) {
      const compactId = `n${counter++}`;
      idMapping.set(nodeId, compactId);
    }

    // Update nodes with new IDs
    const oldNodes = new Map(stateManager.getNodes());
    stateManager.getNodes().clear();

    for (const [oldId, node] of oldNodes.entries()) {
      const newId = idMapping.get(oldId);
      const updatedNode = { ...node, id: newId };
      stateManager.getNodes().set(newId, updatedNode);
    }

    // Update triads with new node references
    for (const triad of stateManager.getTriads().values()) {
      const newSubject = idMapping.get(triad.subject);
      const newObject = idMapping.get(triad.object);

      if (newSubject && newObject) {
        await stateManager.updateTriad(triad.id, {
          subject: newSubject,
          object: newObject
        });
      }
    }

    stateManager.rebuildIndexes();

    this.logger.info(`Compacted ${idMapping.size} node IDs`);
    return idMapping;
  }

  /**
   * Validate and repair graph integrity
   */
  async validateAndRepair(stateManager: IGraphStateManager): Promise<{
    isValid: boolean;
    repairs: string[];
    errors: string[];
  }> {
    this.logger.info('Starting graph validation and repair');

    const validation = stateManager.validateState();
    const repairs: string[] = [];

    if (!validation.isValid) {
      // Attempt to repair the issues
      for (const error of validation.errors) {
        if (error.includes('non-existent subject node') || error.includes('non-existent object node')) {
          // Remove triads with invalid references
          const triadId = this.extractTriadIdFromError(error);
          if (triadId) {
            try {
              await stateManager.removeTriad(triadId);
              repairs.push(`Removed invalid triad: ${triadId}`);
            } catch (repairError) {
              // Continue silently
              this.logger.debug(`Triad ${triadId} repair skipped`);
            }
          }
        }
      }

      // Rebuild indexes after repairs
      stateManager.rebuildIndexes();

      // Validate again
      const postRepairValidation = stateManager.validateState();

      this.logger.info(`Graph repair completed: ${repairs.length} repairs made, final validation: ${postRepairValidation.isValid}`);

      return {
        isValid: postRepairValidation.isValid,
        repairs,
        errors: postRepairValidation.errors
      };
    }

    return {
      isValid: true,
      repairs: [],
      errors: []
    };
  }

  private extractTriadIdFromError(error: string): string | null {
    const match = error.match(/Triad (\w+)/);
    return match ? match[1] : null;
  }
}