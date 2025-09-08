/**
 * Semantic Graph Service - Neo4j Integration
 * Provides intelligent graph-based search and analysis for CodeMind
 */

import neo4j, { Driver, Session, Node, Relationship } from 'neo4j-driver';
import { Logger } from '../utils/logger';

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
}

export interface SemanticSearchResult {
  node: GraphNode;
  relatedNodes: Array<{
    node: GraphNode;
    relationship: string;
  }>;
  relevanceScore: number;
}

export interface ImpactAnalysisResult {
  affectedNodes: GraphNode[];
  relationships: GraphRelationship[];
  impact: {
    codeFiles: number;
    documentation: number;
    tests: number;
    uiComponents: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CrossReferenceResult {
  concept: GraphNode;
  relatedCode: GraphNode[];
  relatedDocs: GraphNode[];
  relatedUI: GraphNode[];
  relatedTests: GraphNode[];
}

export type NodeType = 'Code' | 'Documentation' | 'BusinessConcept' | 'UIComponent' | 'TestCase';
export type RelationshipType = 'IMPORTS' | 'USES' | 'IMPLEMENTS' | 'DESCRIBES' | 'TESTS' | 'DEFINES' | 'RELATES_TO' | 'DEPENDS_ON';

export interface SearchContext {
  includeTypes?: NodeType[];
  maxDepth?: number;
  domain?: string;
  language?: string;
}

export class SemanticGraphService {
  private driver: Driver;
  private logger = Logger.getInstance();

  constructor(uri: string = 'bolt://localhost:7687', username: string = 'neo4j', password: string = 'codemind123') {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      disableLosslessIntegers: true
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.driver.verifyConnectivity();
      this.logger.info('🔗 Semantic graph connected successfully');
      
      // Ensure indexes exist
      await this.ensureIndexes();
    } catch (error) {
      this.logger.error('❌ Failed to connect to semantic graph:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  // ============================================
  // CORE GRAPH OPERATIONS
  // ============================================

  async addNode(type: NodeType, properties: Record<string, any>): Promise<string> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `CREATE (n:${type} $properties) RETURN id(n) as nodeId`,
        { properties: { ...properties, created_at: new Date().toISOString() } }
      );
      
      const nodeId = result.records[0].get('nodeId').toString();
      this.logger.debug(`Created ${type} node with ID: ${nodeId}`);
      return nodeId;
    } finally {
      await session.close();
    }
  }

  async addRelationship(
    fromId: string, 
    toId: string, 
    type: RelationshipType, 
    properties: Record<string, any> = {}
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (from), (to) 
         WHERE id(from) = $fromId AND id(to) = $toId
         CREATE (from)-[r:${type} $properties]->(to)
         RETURN r`,
        { fromId: parseInt(fromId), toId: parseInt(toId), properties }
      );
      
      this.logger.debug(`Created ${type} relationship: ${fromId} -> ${toId}`);
    } finally {
      await session.close();
    }
  }

  async batchCreateNodes(nodes: Array<{ type: NodeType; properties: Record<string, any> }>): Promise<string[]> {
    const session = this.driver.session();
    try {
      const nodeData = nodes.map(n => ({
        labels: [n.type],
        properties: { ...n.properties, created_at: new Date().toISOString() }
      }));

      const result = await session.run(
        'CALL custom.batchCreateNodes($nodes) YIELD created_count RETURN created_count',
        { nodes: nodeData }
      );

      const createdCount = result.records[0].get('created_count');
      this.logger.info(`Batch created ${createdCount} nodes`);
      
      // Return node IDs (would need to modify procedure to return IDs)
      return Array(createdCount).fill(0).map((_, i) => i.toString());
    } finally {
      await session.close();
    }
  }

  // ============================================
  // SEMANTIC SEARCH
  // ============================================

  async semanticSearch(query: string, context: SearchContext = {}): Promise<SemanticSearchResult[]> {
    const session = this.driver.session();
    try {
      // Tokenize query
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2);

      // Simple semantic search using MATCH and WHERE clauses
      const result = await session.run(`
        MATCH (n)
        WHERE ANY(keyword IN $keywords WHERE 
          toLower(n.name) CONTAINS keyword OR 
          toLower(n.description) CONTAINS keyword OR
          (n.keywords IS NOT NULL AND ANY(k IN n.keywords WHERE toLower(k) CONTAINS keyword))
        )
        OPTIONAL MATCH (n)-[r]-(related)
        WITH n, collect(DISTINCT {node: related, relationship: type(r)}) as related_nodes
        RETURN n, related_nodes
        ORDER BY 
          CASE 
            WHEN toLower(n.name) CONTAINS $keywords[0] THEN 3
            WHEN toLower(n.description) CONTAINS $keywords[0] THEN 2  
            ELSE 1
          END DESC
        LIMIT $limit
      `, { 
        keywords, 
        limit: neo4j.int(context.maxDepth || 20)
      });

      return result.records.map(record => {
        const node = this.convertNeo4jNode(record.get('n'));
        const relatedNodesData = record.get('related_nodes');
        const relatedNodes = relatedNodesData.map((rel: any) => ({
          node: rel.node ? this.convertNeo4jNode(rel.node) : null,
          relationship: rel.relationship || 'unknown'
        })).filter(rel => rel.node);

        return {
          node,
          relatedNodes,
          relevanceScore: this.calculateRelevanceScore(node, keywords)
        };
      });
    } finally {
      await session.close();
    }
  }

  async findRelated(
    nodeId: string, 
    maxDepth: number = 2, 
    relationshipTypes: RelationshipType[] = []
  ): Promise<GraphNode[]> {
    const session = this.driver.session();
    try {
      // Simple traversal without APOC
      const relationshipFilter = relationshipTypes.length > 0 
        ? `[${relationshipTypes.map(t => `'${t}'`).join(',')}]`
        : '';

      const query = relationshipTypes.length > 0 
        ? `MATCH (start)-[r*1..${maxDepth}]-(related) 
           WHERE id(start) = $nodeId AND type(r) IN ${relationshipFilter}
           RETURN collect(DISTINCT related) as related_nodes`
        : `MATCH (start)-[r*1..${maxDepth}]-(related) 
           WHERE id(start) = $nodeId
           RETURN collect(DISTINCT related) as related_nodes`;

      const result = await session.run(query, { 
        nodeId: neo4j.int(nodeId)
      });

      const nodes = result.records[0]?.get('related_nodes') || [];
      return nodes.map((node: Node) => this.convertNeo4jNode(node));
    } finally {
      await session.close();
    }
  }

  // ============================================
  // IMPACT ANALYSIS
  // ============================================

  async analyzeImpact(nodeId: string, maxDepth: number = 3): Promise<ImpactAnalysisResult> {
    const session = this.driver.session();
    try {
      // Simple impact analysis using basic traversal
      const result = await session.run(`
        MATCH (start)-[r*1..${maxDepth}]-(related)
        WHERE id(start) = $nodeId
        RETURN collect(DISTINCT related) as nodes,
               collect(DISTINCT r) as relationships
      `, { nodeId: neo4j.int(nodeId) });

      const record = result.records[0];
      const nodes = (record?.get('nodes') || []).map((node: Node) => this.convertNeo4jNode(node));
      const relationships = (record?.get('relationships') || []).flat().map((rel: Relationship) => this.convertNeo4jRelationship(rel));
      
      const impact = {
        codeFiles: nodes.filter(n => n.labels.includes('Code')).length,
        documentation: nodes.filter(n => n.labels.includes('Documentation')).length,
        tests: nodes.filter(n => n.labels.includes('TestCase')).length,
        uiComponents: nodes.filter(n => n.labels.includes('UIComponent')).length
      };

      const riskLevel = this.calculateRiskLevel(impact);

      return {
        affectedNodes: nodes,
        relationships,
        impact,
        riskLevel
      };
    } finally {
      await session.close();
    }
  }

  // ============================================
  // CROSS-DOMAIN QUERIES  
  // ============================================

  async findCrossReferences(conceptName: string): Promise<CrossReferenceResult> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (concept:BusinessConcept {name: $conceptName})
        OPTIONAL MATCH (concept)<-[:IMPLEMENTS]-(code:Code)
        OPTIONAL MATCH (concept)<-[:DEFINES]-(doc:Documentation)  
        OPTIONAL MATCH (concept)<-[:RELATES_TO]-(ui:UIComponent)
        OPTIONAL MATCH (concept)<-[:TESTS_CONCEPT]-(test:TestCase)
        RETURN concept,
          collect(DISTINCT code) as related_code,
          collect(DISTINCT doc) as related_docs,
          collect(DISTINCT ui) as related_ui,
          collect(DISTINCT test) as related_tests
      `, { conceptName });

      const record = result.records[0];
      if (!record) {
        // Return empty result if concept not found
        return {
          concept: null as any,
          relatedCode: [],
          relatedDocs: [],
          relatedUI: [],
          relatedTests: []
        };
      }

      return {
        concept: this.convertNeo4jNode(record.get('concept')),
        relatedCode: (record.get('related_code') || []).filter((n: any) => n).map((node: Node) => this.convertNeo4jNode(node)),
        relatedDocs: (record.get('related_docs') || []).filter((n: any) => n).map((node: Node) => this.convertNeo4jNode(node)),
        relatedUI: (record.get('related_ui') || []).filter((n: any) => n).map((node: Node) => this.convertNeo4jNode(node)),
        relatedTests: (record.get('related_tests') || []).filter((n: any) => n).map((node: Node) => this.convertNeo4jNode(node))
      };
    } finally {
      await session.close();
    }
  }

  // ============================================
  // GRAPH STATISTICS
  // ============================================

  async getGraphStatistics(): Promise<any> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (n) 
        WITH labels(n)[0] as label, count(n) as node_count
        WITH collect({label: label, count: node_count}) as node_stats
        MATCH ()-[r]->()
        WITH node_stats, type(r) as rel_type, count(r) as rel_count  
        WITH node_stats, collect({type: rel_type, count: rel_count}) as rel_stats
        RETURN {
          total_nodes: size([x IN node_stats | x.count]),
          total_relationships: size([x IN rel_stats | x.count]), 
          node_distribution: node_stats,
          relationship_distribution: rel_stats
        } as statistics
      `);

      return result.records[0]?.get('statistics') || {
        total_nodes: 0,
        total_relationships: 0,
        node_distribution: [],
        relationship_distribution: []
      };
    } finally {
      await session.close();
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private async ensureIndexes(): Promise<void> {
    const session = this.driver.session();
    try {
      // Create basic indexes for performance
      const indexCommands = [
        'CREATE INDEX code_name_index IF NOT EXISTS FOR (c:Code) ON (c.name)',
        'CREATE INDEX code_type_index IF NOT EXISTS FOR (c:Code) ON (c.type)',
        'CREATE INDEX doc_title_index IF NOT EXISTS FOR (d:Documentation) ON (d.title)',
        'CREATE INDEX concept_name_index IF NOT EXISTS FOR (bc:BusinessConcept) ON (bc.name)',
        'CREATE INDEX concept_domain_index IF NOT EXISTS FOR (bc:BusinessConcept) ON (bc.domain)'
      ];

      for (const command of indexCommands) {
        try {
          await session.run(command);
        } catch (error: any) {
          // Ignore if index already exists
          if (!error.message?.includes('already exists')) {
            this.logger.warn(`Index creation warning: ${error.message}`);
          }
        }
      }
    } finally {
      await session.close();
    }
  }

  private convertNeo4jNode(node: Node): GraphNode {
    return {
      id: node.identity.toString(),
      labels: node.labels,
      properties: node.properties
    };
  }

  private convertNeo4jRelationship(rel: Relationship): GraphRelationship {
    return {
      id: rel.identity.toString(),
      type: rel.type,
      startNodeId: rel.start.toString(),
      endNodeId: rel.end.toString(),
      properties: rel.properties
    };
  }

  private calculateRelevanceScore(node: GraphNode, keywords: string[]): number {
    let score = 0;
    const name = node.properties.name?.toLowerCase() || '';
    const description = node.properties.description?.toLowerCase() || '';
    
    keywords.forEach(keyword => {
      if (name.includes(keyword)) score += 3;
      if (description.includes(keyword)) score += 2;
      if (node.properties.keywords?.some((k: string) => k.includes(keyword))) score += 1;
    });
    
    return Math.min(score / keywords.length, 1);
  }

  private calculateRiskLevel(impact: ImpactAnalysisResult['impact']): ImpactAnalysisResult['riskLevel'] {
    const totalImpact = impact.codeFiles + impact.documentation + impact.tests + impact.uiComponents;
    
    if (totalImpact > 50) return 'critical';
    if (totalImpact > 20) return 'high';
    if (totalImpact > 10) return 'medium';
    return 'low';
  }
}

export default SemanticGraphService;