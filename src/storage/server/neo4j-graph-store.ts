/**
 * Neo4j Graph Store
 *
 * Provides graph database operations using Neo4j:
 * - Nodes for code entities (files, classes, functions)
 * - Edges for relationships (imports, calls, extends)
 * - Cypher queries for traversal and path finding
 *
 * Requires Neo4j server running.
 * See docs/STORAGE.md for setup instructions.
 */

import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import {
  IGraphStore,
  GraphNode,
  GraphEdge,
  GraphQueryResult
} from '../interfaces';

export interface Neo4jGraphStoreConfig {
  uri: string;
  user: string;
  password: string;
  database?: string;
}

export class Neo4jGraphStore implements IGraphStore {
  private driver: Driver;
  private database: string;
  private initialized = false;

  constructor(private config: Neo4jGraphStoreConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password),
      {
        maxConnectionPoolSize: 50,
        connectionTimeout: 5000
      }
    );
    this.database = config.database || 'neo4j';
  }

  /**
   * Initialize schema (create indexes)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const session = this.driver.session({ database: this.database });
    try {
      // Create indexes for fast lookups
      await session.run(`
        CREATE INDEX node_id IF NOT EXISTS FOR (n:CodeNode) ON (n.id)
      `);
      await session.run(`
        CREATE INDEX node_project IF NOT EXISTS FOR (n:CodeNode) ON (n.projectId)
      `);
      await session.run(`
        CREATE INDEX node_type IF NOT EXISTS FOR (n:CodeNode) ON (n.type)
      `);
      await session.run(`
        CREATE INDEX node_filepath IF NOT EXISTS FOR (n:CodeNode) ON (n.filePath)
      `);

      this.initialized = true;
    } finally {
      await session.close();
    }
  }

  async upsertNode(node: GraphNode): Promise<void> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      await session.run(`
        MERGE (n:CodeNode {id: $id})
        SET n.type = $type,
            n.name = $name,
            n.filePath = $filePath,
            n.projectId = $projectId,
            n.properties = $properties
      `, {
        id: node.id,
        type: node.type,
        name: node.name,
        filePath: node.filePath,
        projectId: node.projectId,
        properties: JSON.stringify(node.properties || {})
      });
    } finally {
      await session.close();
    }
  }

  async upsertEdge(edge: GraphEdge): Promise<void> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      // Use dynamic relationship type
      const relType = edge.type.toUpperCase();
      await session.run(`
        MATCH (source:CodeNode {id: $sourceId})
        MATCH (target:CodeNode {id: $targetId})
        MERGE (source)-[r:${relType} {id: $edgeId}]->(target)
        SET r.properties = $properties
      `, {
        sourceId: edge.source,
        targetId: edge.target,
        edgeId: edge.id,
        properties: JSON.stringify(edge.properties || {})
      });
    } finally {
      await session.close();
    }
  }

  async upsertNodes(nodes: GraphNode[]): Promise<void> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      await session.executeWrite(async tx => {
        for (const node of nodes) {
          await tx.run(`
            MERGE (n:CodeNode {id: $id})
            SET n.type = $type,
                n.name = $name,
                n.filePath = $filePath,
                n.projectId = $projectId,
                n.properties = $properties
          `, {
            id: node.id,
            type: node.type,
            name: node.name,
            filePath: node.filePath,
            projectId: node.projectId,
            properties: JSON.stringify(node.properties || {})
          });
        }
      });
    } finally {
      await session.close();
    }
  }

  async upsertEdges(edges: GraphEdge[]): Promise<void> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      await session.executeWrite(async tx => {
        for (const edge of edges) {
          const relType = edge.type.toUpperCase();
          await tx.run(`
            MATCH (source:CodeNode {id: $sourceId})
            MATCH (target:CodeNode {id: $targetId})
            MERGE (source)-[r:${relType} {id: $edgeId}]->(target)
            SET r.properties = $properties
          `, {
            sourceId: edge.source,
            targetId: edge.target,
            edgeId: edge.id,
            properties: JSON.stringify(edge.properties || {})
          });
        }
      });
    } finally {
      await session.close();
    }
  }

  async findNodes(projectId: string, type?: GraphNode['type']): Promise<GraphNode[]> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      let query: string;
      let params: Record<string, string>;

      if (type) {
        query = `
          MATCH (n:CodeNode)
          WHERE n.projectId = $projectId AND n.type = $type
          RETURN n
        `;
        params = { projectId, type };
      } else {
        query = `
          MATCH (n:CodeNode)
          WHERE n.projectId = $projectId
          RETURN n
        `;
        params = { projectId };
      }

      const result = await session.run(query, params);
      return result.records.map(record => this.recordToNode(record.get('n')));
    } finally {
      await session.close();
    }
  }

  async getNode(id: string): Promise<GraphNode | null> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(`
        MATCH (n:CodeNode {id: $id})
        RETURN n
      `, { id });

      if (result.records.length === 0) return null;
      return this.recordToNode(result.records[0].get('n'));
    } finally {
      await session.close();
    }
  }

  async getEdges(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<GraphEdge[]> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      let query: string;

      if (direction === 'out') {
        query = `
          MATCH (n:CodeNode {id: $nodeId})-[r]->(target)
          RETURN r, n.id as sourceId, target.id as targetId, type(r) as relType
        `;
      } else if (direction === 'in') {
        query = `
          MATCH (source)-[r]->(n:CodeNode {id: $nodeId})
          RETURN r, source.id as sourceId, n.id as targetId, type(r) as relType
        `;
      } else {
        query = `
          MATCH (n:CodeNode {id: $nodeId})-[r]-(other)
          WITH r,
               CASE WHEN startNode(r).id = $nodeId THEN startNode(r).id ELSE endNode(r).id END as sourceId,
               CASE WHEN startNode(r).id = $nodeId THEN endNode(r).id ELSE startNode(r).id END as targetId,
               type(r) as relType
          RETURN DISTINCT r, sourceId, targetId, relType
        `;
      }

      const result = await session.run(query, { nodeId });
      return result.records.map(record => this.recordToEdge(record));
    } finally {
      await session.close();
    }
  }

  async getNeighbors(nodeId: string, edgeType?: GraphEdge['type']): Promise<GraphNode[]> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      let query: string;
      const params: Record<string, string> = { nodeId };

      if (edgeType) {
        const relType = edgeType.toUpperCase();
        query = `
          MATCH (n:CodeNode {id: $nodeId})-[:${relType}]-(neighbor)
          RETURN DISTINCT neighbor
        `;
      } else {
        query = `
          MATCH (n:CodeNode {id: $nodeId})--(neighbor)
          RETURN DISTINCT neighbor
        `;
      }

      const result = await session.run(query, params);
      return result.records.map(record => this.recordToNode(record.get('neighbor')));
    } finally {
      await session.close();
    }
  }

  async findPath(sourceId: string, targetId: string, maxDepth = 5): Promise<GraphNode[]> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(`
        MATCH path = shortestPath(
          (source:CodeNode {id: $sourceId})-[*1..${maxDepth}]-(target:CodeNode {id: $targetId})
        )
        RETURN nodes(path) as pathNodes
      `, { sourceId, targetId });

      if (result.records.length === 0) return [];

      const pathNodes = result.records[0].get('pathNodes');
      return pathNodes.map((n: any) => this.recordToNode(n));
    } finally {
      await session.close();
    }
  }

  async deleteByProject(projectId: string): Promise<number> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(`
        MATCH (n:CodeNode {projectId: $projectId})
        DETACH DELETE n
        RETURN count(n) as deleted
      `, { projectId });

      return result.records[0]?.get('deleted')?.toNumber() || 0;
    } finally {
      await session.close();
    }
  }

  async countNodes(projectId: string): Promise<number> {
    await this.initialize();

    const session = this.driver.session({ database: this.database });
    try {
      const result = await session.run(`
        MATCH (n:CodeNode {projectId: $projectId})
        RETURN count(n) as count
      `, { projectId });

      return result.records[0]?.get('count')?.toNumber() || 0;
    } finally {
      await session.close();
    }
  }

  async flush(): Promise<void> {
    // No-op for Neo4j (writes are immediate)
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  /**
   * Test connection health
   */
  async healthCheck(): Promise<boolean> {
    const session = this.driver.session({ database: this.database });
    try {
      await session.run('RETURN 1');
      return true;
    } catch {
      return false;
    } finally {
      await session.close();
    }
  }

  private recordToNode(record: any): GraphNode {
    const props = record.properties;
    return {
      id: props.id,
      type: props.type,
      name: props.name,
      filePath: props.filePath,
      projectId: props.projectId,
      properties: props.properties ? JSON.parse(props.properties) : undefined
    };
  }

  private recordToEdge(record: any): GraphEdge {
    const rel = record.get('r');
    const relType = record.get('relType').toLowerCase() as GraphEdge['type'];

    return {
      id: rel.properties.id || `${record.get('sourceId')}-${relType}-${record.get('targetId')}`,
      source: record.get('sourceId'),
      target: record.get('targetId'),
      type: relType,
      properties: rel.properties.properties ? JSON.parse(rel.properties.properties) : undefined
    };
  }
}