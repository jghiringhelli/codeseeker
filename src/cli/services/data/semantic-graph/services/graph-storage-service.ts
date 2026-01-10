/**
 * Graph Storage Service
 * SOLID Principles: Single Responsibility - Handle Neo4j database operations only
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { Logger } from '../../../../../utils/logger';
import {
  IGraphStorageService,
  NodeType,
  RelationshipType,
  GraphNode,
  SearchResult,
  SearchContext
} from '../interfaces/index';

export class GraphStorageService implements IGraphStorageService {
  private driver: Driver;
  private logger = Logger.getInstance();

  constructor(
    uri: string = 'bolt://localhost:7687',
    username: string = 'neo4j',
    password: string = 'codeseeker123'
  ) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      disableLosslessIntegers: true
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.driver.verifyConnectivity();
      this.logger.debug('🔗 Graph storage connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to graph storage:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async addNode(type: NodeType, properties: Record<string, any>): Promise<string> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `CREATE (n:${type} $properties) RETURN id(n) as nodeId`,
        { properties }
      );

      const nodeId = result.records[0]?.get('nodeId');
      return nodeId ? nodeId.toString() : '';
    } catch (error) {
      this.logger.error(`Failed to add node of type ${type}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async addRelationship(
    fromId: string,
    toId: string,
    type: RelationshipType,
    properties?: Record<string, any>
  ): Promise<void> {
    const session = this.driver.session();
    try {
      const query = properties
        ? `MATCH (a), (b) WHERE id(a) = $fromId AND id(b) = $toId CREATE (a)-[r:${type} $properties]->(b)`
        : `MATCH (a), (b) WHERE id(a) = $fromId AND id(b) = $toId CREATE (a)-[r:${type}]->(b)`;

      await session.run(query, { fromId: parseInt(fromId), toId: parseInt(toId), properties });
    } catch (error) {
      this.logger.error(`Failed to add relationship ${type} from ${fromId} to ${toId}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async batchCreateNodes(nodes: Array<{ type: NodeType; properties: Record<string, any> }>): Promise<string[]> {
    const session = this.driver.session();
    const nodeIds: string[] = [];

    try {
      // Create nodes in batches for better performance
      const batchSize = 100;
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const batchIds = await this.processBatch(session, batch);
        nodeIds.push(...batchIds);
      }

      return nodeIds;
    } catch (error) {
      this.logger.error('Failed to batch create nodes:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async searchNodes(query: string, context?: SearchContext): Promise<SearchResult> {
    const session = this.driver.session();
    const startTime = Date.now();

    try {
      const searchTerms = this.extractSearchTerms(query);
      const cypherQuery = this.buildSearchQuery(searchTerms, context);

      this.logger.debug(`🔍 Executing search query: ${cypherQuery}`);

      const result = await session.run(cypherQuery, { searchTerms });
      const nodes = this.processSearchResults(result);

      // Get relationships for found nodes
      const relationships = await this.getRelationshipsForNodes(session, nodes);

      return {
        nodes,
        relationships,
        stats: {
          totalResults: nodes.length,
          relevantNodes: nodes.length,
          searchTime: Date.now() - startTime
        }
      };
    } catch (error) {
      this.logger.error('Search failed:', error);
      return {
        nodes: [],
        relationships: [],
        stats: {
          totalResults: 0,
          relevantNodes: 0,
          searchTime: Date.now() - startTime
        }
      };
    } finally {
      await session.close();
    }
  }

  async findRelatedNodes(nodeId: string, maxDepth: number = 2): Promise<GraphNode[]> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (start)
        WHERE id(start) = $nodeId
        CALL apoc.path.expand(start, null, null, 0, $maxDepth)
        YIELD path
        WITH nodes(path) as pathNodes
        UNWIND pathNodes as node
        RETURN DISTINCT
          id(node) as id,
          labels(node)[0] as type,
          properties(node) as properties
      `;

      const result = await session.run(query, {
        nodeId: parseInt(nodeId),
        maxDepth
      });

      return result.records.map(record => ({
        id: record.get('id').toString(),
        type: record.get('type') as NodeType,
        properties: record.get('properties'),
        name: record.get('properties').name || 'Unknown'
      }));
    } catch (error) {
      this.logger.error(`Failed to find related nodes for ${nodeId}:`, error);
      // Fallback to simple traversal if APOC is not available
      return this.findRelatedNodesSimple(session, nodeId, maxDepth);
    } finally {
      await session.close();
    }
  }

  async clearGraph(): Promise<void> {
    const session = this.driver.session();
    try {
      this.logger.info('🗑️ Clearing semantic graph...');
      await session.run('MATCH (n) DETACH DELETE n');
      this.logger.info('✅ Semantic graph cleared');
    } catch (error) {
      this.logger.error('Failed to clear graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getNodeCount(): Promise<number> {
    const session = this.driver.session();
    try {
      const result = await session.run('MATCH (n) RETURN count(n) as count');
      return result.records[0]?.get('count').toNumber() || 0;
    } catch (error) {
      this.logger.error('Failed to get node count:', error);
      return 0;
    } finally {
      await session.close();
    }
  }

  async getRelationshipCount(): Promise<number> {
    const session = this.driver.session();
    try {
      const result = await session.run('MATCH ()-[r]->() RETURN count(r) as count');
      return result.records[0]?.get('count').toNumber() || 0;
    } catch (error) {
      this.logger.error('Failed to get relationship count:', error);
      return 0;
    } finally {
      await session.close();
    }
  }

  private async processBatch(
    session: Session,
    batch: Array<{ type: NodeType; properties: Record<string, any> }>
  ): Promise<string[]> {
    const queries = batch.map((node, index) =>
      `CREATE (n${index}:${node.type} $props${index}) RETURN id(n${index}) as id${index}`
    ).join(' ');

    const parameters = batch.reduce((params, node, index) => {
      params[`props${index}`] = node.properties;
      return params;
    }, {} as any);

    const result = await session.run(queries, parameters);
    return result.records.map((record, index) =>
      record.get(`id${index}`).toString()
    );
  }

  private extractSearchTerms(query: string): string[] {
    // Simple term extraction - in production, this could be more sophisticated
    return query.toLowerCase()
      .split(/[\s,]+/)
      .filter(term => term.length > 2)
      .slice(0, 10); // Limit to 10 terms for performance
  }

  private buildSearchQuery(searchTerms: string[], context?: SearchContext): string {
    let whereClause = 'WHERE ';
    const conditions: string[] = [];

    // Text search conditions
    if (searchTerms.length > 0) {
      const textConditions = searchTerms.map(term =>
        `(toLower(n.name) CONTAINS $searchTerm_${term} OR toLower(n.description) CONTAINS $searchTerm_${term})`
      );
      conditions.push(`(${textConditions.join(' OR ')})`);
    }

    // Type filtering
    if (context?.includeTypes && context.includeTypes.length > 0) {
      const typeLabels = context.includeTypes.map(type => `n:${type}`).join(' OR ');
      conditions.push(`(${typeLabels})`);
    }

    // Language filtering
    if (context?.language) {
      conditions.push(`n.language = '${context.language}'`);
    }

    // Domain filtering
    if (context?.domain) {
      conditions.push(`n.domain = '${context.domain}'`);
    }

    if (conditions.length === 0) {
      whereClause = '';
    } else {
      whereClause += conditions.join(' AND ');
    }

    return `
      MATCH (n)
      ${whereClause}
      RETURN
        id(n) as id,
        labels(n)[0] as type,
        properties(n) as properties
      LIMIT 100
    `;
  }

  private processSearchResults(result: any): GraphNode[] {
    return result.records.map((record: any) => ({
      id: record.get('id').toString(),
      type: record.get('type') as NodeType,
      properties: record.get('properties'),
      name: record.get('properties').name || 'Unknown'
    }));
  }

  private async getRelationshipsForNodes(session: Session, nodes: GraphNode[]): Promise<any[]> {
    if (nodes.length === 0) return [];

    const nodeIds = nodes.map(node => parseInt(node.id));
    const query = `
      MATCH (a)-[r]->(b)
      WHERE id(a) IN $nodeIds AND id(b) IN $nodeIds
      RETURN
        id(a) as fromId,
        id(b) as toId,
        type(r) as type,
        properties(r) as properties
    `;

    const result = await session.run(query, { nodeIds });
    return result.records.map(record => ({
      fromId: record.get('fromId').toString(),
      toId: record.get('toId').toString(),
      type: record.get('type'),
      properties: record.get('properties')
    }));
  }

  private async findRelatedNodesSimple(session: Session, nodeId: string, maxDepth: number): Promise<GraphNode[]> {
    // Simple traversal without APOC
    const query = `
      MATCH (start)-[*1..${maxDepth}]-(related)
      WHERE id(start) = $nodeId
      RETURN DISTINCT
        id(related) as id,
        labels(related)[0] as type,
        properties(related) as properties
      LIMIT 50
    `;

    const result = await session.run(query, { nodeId: parseInt(nodeId) });
    return result.records.map(record => ({
      id: record.get('id').toString(),
      type: record.get('type') as NodeType,
      properties: record.get('properties'),
      name: record.get('properties').name || 'Unknown'
    }));
  }
}