/**
 * Graph Query Service
 * SOLID Principles: Single Responsibility - Handle graph querying and analysis only
 */

import { Logger } from '../../../../../utils/logger';
import {
  IGraphQueryService,
  IGraphStorageService,
  IQualityAnalyzer,
  GraphNode,
  NodeType,
  SearchResult,
  SearchContext,
  ImpactAnalysisResult,
  CrossReferenceResult
} from '../interfaces/index';

export class GraphQueryService implements IGraphQueryService {
  private logger = Logger.getInstance();

  constructor(
    private storageService: IGraphStorageService,
    private qualityAnalyzer?: IQualityAnalyzer
  ) {}

  async searchNodes(query: string, context?: SearchContext): Promise<SearchResult> {
    try {
      this.logger.debug(`🔍 Searching nodes with query: "${query}"`);
      return await this.storageService.searchNodes(query, context);
    } catch (error) {
      this.logger.error('Failed to search nodes:', error);
      return {
        nodes: [],
        relationships: [],
        stats: { totalResults: 0, relevantNodes: 0, searchTime: 0 }
      };
    }
  }

  async findRelatedNodes(nodeId: string, maxDepth: number = 2): Promise<GraphNode[]> {
    try {
      this.logger.debug(`🔗 Finding nodes related to ${nodeId} (depth: ${maxDepth})`);
      return await this.storageService.findRelatedNodes(nodeId, maxDepth);
    } catch (error) {
      this.logger.error(`Failed to find related nodes for ${nodeId}:`, error);
      return [];
    }
  }

  async findPathBetweenNodes(fromId: string, toId: string): Promise<GraphNode[]> {
    try {
      this.logger.debug(`🗺️ Finding path from ${fromId} to ${toId}`);

      // This is a simplified implementation
      // In a full implementation, this would use graph algorithms like Dijkstra
      const fromRelated = await this.findRelatedNodes(fromId, 3);
      const toRelated = await this.findRelatedNodes(toId, 3);

      // Find common nodes as a simple path approximation
      const commonNodes = fromRelated.filter(fromNode =>
        toRelated.some(toNode => toNode.id === fromNode.id)
      );

      return commonNodes;
    } catch (error) {
      this.logger.error(`Failed to find path between ${fromId} and ${toId}:`, error);
      return [];
    }
  }

  async getNodesByType(type: NodeType): Promise<GraphNode[]> {
    try {
      this.logger.debug(`📋 Getting all nodes of type: ${type}`);

      // Use search with type filter
      const context: SearchContext = {
        includeTypes: [type]
      };

      const result = await this.storageService.searchNodes('*', context);
      return result.nodes;
    } catch (error) {
      this.logger.error(`Failed to get nodes of type ${type}:`, error);
      return [];
    }
  }

  async analyzeImpact(nodeId: string): Promise<ImpactAnalysisResult> {
    try {
      this.logger.debug(`📊 Analyzing impact for node: ${nodeId}`);

      const affectedNodes = await this.findRelatedNodes(nodeId, 3);
      const relationships = await this.getNodeRelationships(nodeId);

      // Categorize affected nodes
      const impact = this.categorizeImpactNodes(affectedNodes);
      const riskLevel = this.calculateRiskLevel(affectedNodes, impact);

      return {
        affectedNodes,
        relationships,
        impact,
        riskLevel
      };
    } catch (error) {
      this.logger.error(`Failed to analyze impact for ${nodeId}:`, error);
      return {
        affectedNodes: [],
        relationships: [],
        impact: { codeFiles: 0, documentation: 0, tests: 0, uiComponents: 0 },
        riskLevel: 'low'
      };
    }
  }

  async performCrossReference(concept: string): Promise<CrossReferenceResult> {
    try {
      this.logger.debug(`🔄 Performing cross-reference analysis for: ${concept}`);

      // Search for the main concept
      const searchResult = await this.searchNodes(concept);
      const mainConcept = searchResult.nodes[0];

      if (!mainConcept) {
        return this.createEmptyCrossReference(concept);
      }

      // Find related nodes by category
      const relatedNodes = await this.findRelatedNodes(mainConcept.id, 2);

      const relatedCode = this.filterByType(relatedNodes, 'Code');
      const relatedDocs = this.filterByType(relatedNodes, 'Documentation');
      const relatedUI = this.filterByType(relatedNodes, 'UIComponent');
      const relatedTests = this.filterByType(relatedNodes, 'TestCase');

      return {
        concept: mainConcept,
        relatedCode,
        relatedDocs,
        relatedUI,
        relatedTests
      };
    } catch (error) {
      this.logger.error(`Failed to perform cross-reference for ${concept}:`, error);
      return this.createEmptyCrossReference(concept);
    }
  }

  // Advanced query methods
  async findBusinessConcepts(): Promise<GraphNode[]> {
    return this.getNodesByType('BusinessConcept');
  }

  async findOrphanedNodes(): Promise<GraphNode[]> {
    try {
      // This would require a custom Cypher query to find nodes with no relationships
      // For now, return empty array as placeholder
      this.logger.debug('🔍 Finding orphaned nodes...');
      return [];
    } catch (error) {
      this.logger.error('Failed to find orphaned nodes:', error);
      return [];
    }
  }

  async getGraphStatistics(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    typeDistribution: Record<string, number>;
  }> {
    try {
      const nodeCount = await (this.storageService as any).getNodeCount?.() || 0;
      const relationshipCount = await (this.storageService as any).getRelationshipCount?.() || 0;

      // Get type distribution
      const allNodes = await this.searchNodes('*');
      const typeDistribution = this.calculateTypeDistribution(allNodes.nodes);

      return {
        nodeCount,
        relationshipCount,
        typeDistribution
      };
    } catch (error) {
      this.logger.error('Failed to get graph statistics:', error);
      return {
        nodeCount: 0,
        relationshipCount: 0,
        typeDistribution: {}
      };
    }
  }

  private async getNodeRelationships(nodeId: string): Promise<any[]> {
    try {
      // This is a placeholder - in a full implementation, this would query relationships
      return [];
    } catch (error) {
      this.logger.error(`Failed to get relationships for ${nodeId}:`, error);
      return [];
    }
  }

  private categorizeImpactNodes(nodes: GraphNode[]): {
    codeFiles: number;
    documentation: number;
    tests: number;
    uiComponents: number;
  } {
    const impact = {
      codeFiles: 0,
      documentation: 0,
      tests: 0,
      uiComponents: 0
    };

    for (const node of nodes) {
      switch (node.type) {
        case 'Code':
          impact.codeFiles++;
          break;
        case 'Documentation':
          impact.documentation++;
          break;
        case 'TestCase':
          impact.tests++;
          break;
        case 'UIComponent':
          impact.uiComponents++;
          break;
      }
    }

    return impact;
  }

  private calculateRiskLevel(nodes: GraphNode[], impact: any): 'low' | 'medium' | 'high' | 'critical' {
    const totalAffected = nodes.length;
    const criticalTypes = impact.codeFiles + impact.uiComponents;

    if (totalAffected > 20 || criticalTypes > 10) return 'critical';
    if (totalAffected > 10 || criticalTypes > 5) return 'high';
    if (totalAffected > 5 || criticalTypes > 2) return 'medium';
    return 'low';
  }

  private filterByType(nodes: GraphNode[], type: NodeType): GraphNode[] {
    return nodes.filter(node => node.type === type);
  }

  private createEmptyCrossReference(concept: string): CrossReferenceResult {
    return {
      concept: {
        id: '',
        type: 'BusinessConcept',
        properties: { name: concept },
        name: concept
      },
      relatedCode: [],
      relatedDocs: [],
      relatedUI: [],
      relatedTests: []
    };
  }

  private calculateTypeDistribution(nodes: GraphNode[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const node of nodes) {
      distribution[node.type] = (distribution[node.type] || 0) + 1;
    }

    return distribution;
  }

  // Quality analysis integration
  calculateRelevanceScore(node: GraphNode, keywords: string[]): number {
    if (this.qualityAnalyzer) {
      return this.qualityAnalyzer.calculateRelevanceScore(node, keywords);
    }

    // Simple fallback scoring
    const name = node.name?.toLowerCase() || '';
    const description = node.properties?.description?.toLowerCase() || '';

    let score = 0;
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (name.includes(keywordLower)) score += 10;
      if (description.includes(keywordLower)) score += 5;
    }

    return Math.min(100, score);
  }

  // Additional methods required by interface
  async performSemanticSearch(query: string, context?: SearchContext): Promise<SearchResult[]> {
    try {
      this.logger.debug(`🔍 Performing semantic search: "${query}"`);
      const result = await this.searchNodes(query, context);
      // Return array of single result for now
      return [result];
    } catch (error) {
      this.logger.error(`Failed to perform semantic search:`, error);
      return [];
    }
  }

  async findCrossReferences(nodeId: string): Promise<CrossReferenceResult[]> {
    try {
      this.logger.debug(`🔗 Finding cross-references for node: ${nodeId}`);
      const relatedNodes = await this.findRelatedNodes(nodeId, 2);

      // Group related nodes by type and create cross-reference results
      const crossRef: CrossReferenceResult = {
        concept: relatedNodes[0] || { id: nodeId, type: 'BusinessConcept', properties: {}, name: nodeId },
        relatedCode: this.filterByType(relatedNodes, 'Code'),
        relatedDocs: this.filterByType(relatedNodes, 'Documentation'),
        relatedUI: this.filterByType(relatedNodes, 'UIComponent'),
        relatedTests: this.filterByType(relatedNodes, 'TestCase')
      };

      return [crossRef];
    } catch (error) {
      this.logger.error(`Failed to find cross-references:`, error);
      return [];
    }
  }
}