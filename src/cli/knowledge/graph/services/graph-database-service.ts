/**
 * Graph Database Service
 * Handles persistence and database operations for the knowledge graph
 */

import { KnowledgeNode, KnowledgeTriad, GraphQuery, GraphMutation, RelationType } from '../types';
import { Logger } from '../../../../utils/logger';
import { DatabaseFactory } from '../../../../database/factory';

export interface IGraphDatabaseService {
  initializeDatabase(): Promise<void>;
  createTables(): Promise<void>; // Keep original interface
  saveNode(node: KnowledgeNode): Promise<void>;
  saveTriad(triad: KnowledgeTriad): Promise<void>;
  loadNodes(): Promise<Map<string, KnowledgeNode>>;
  loadTriads(): Promise<Map<string, KnowledgeTriad>>;
  queryNodes(query: GraphQuery): Promise<KnowledgeNode[]>;
  queryTriads(query: GraphQuery): Promise<KnowledgeTriad[]>;
  mutateGraph(mutation: GraphMutation): Promise<void>;
  closeConnection(): Promise<void>;
}

export class GraphDatabaseService implements IGraphDatabaseService {
  private logger = Logger.getInstance().child('GraphDatabaseService');
  private db: any;
  private initialized = false;

  // Static flag to track database availability and suppress repeated errors
  private static databaseUnavailable = false;
  private static errorNotified = false;

  constructor(private projectPath: string) {}

  /**
   * Check if database is marked as unavailable
   */
  static isDatabaseUnavailable(): boolean {
    return GraphDatabaseService.databaseUnavailable;
  }

  /**
   * Reset the database unavailable flag (for retry attempts)
   */
  static resetAvailability(): void {
    GraphDatabaseService.databaseUnavailable = false;
    GraphDatabaseService.errorNotified = false;
  }

  async initializeDatabase(): Promise<void> {
    if (this.initialized) return;

    // Skip if database already marked as unavailable
    if (GraphDatabaseService.databaseUnavailable) {
      return;
    }

    try {
      const config = DatabaseFactory?.parseConfigFromEnv();

      if (config) {
        this.db = DatabaseFactory?.create(config, this.logger);
        await this.db?.initialize();
        // NOTE: Tables should be created during setup phase, not during runtime queries
        // The setup command handles schema creation via applyConsolidatedSchema()
        this.initialized = true;
        this.logger.debug('Graph database connection initialized');
      } else {
        this.logger.warn('No database configuration found for graph storage');
      }
    } catch (error) {
      // Mark database as unavailable to prevent repeated error spam
      GraphDatabaseService.databaseUnavailable = true;

      // Only show notification once, not for every subsequent attempt
      if (!GraphDatabaseService.errorNotified) {
        GraphDatabaseService.errorNotified = true;
        // Show a single user-friendly message
        console.log('\n⚠️  Database unavailable - CodeMind running in local-only mode.');
        console.log('   Database features (semantic search, knowledge graph) will be limited.');
        console.log('   To enable full features, ensure PostgreSQL is running.\n');
        this.logger.debug('Graph database unavailable - using fallback mode');
      }

      // Don't throw - allow graceful fallback
      return;
    }
  }

  /**
   * Create database tables - should only be called during setup phase
   */
  async createTables(): Promise<void> {
    if (!this.db) {
      this.logger.warn('Database not available for table creation');
      return;
    }

    try {
      // Create knowledge_nodes table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS knowledge_nodes (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(100) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          project_path VARCHAR(500),
          source_file VARCHAR(500),
          confidence DECIMAL(3,2) DEFAULT 1.0,
          INDEX idx_node_type (type),
          INDEX idx_node_project (project_path),
          INDEX idx_node_confidence (confidence)
        )
      `);

      // Create knowledge_triads table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS knowledge_triads (
          id VARCHAR(255) PRIMARY KEY,
          subject VARCHAR(255) NOT NULL,
          predicate VARCHAR(100) NOT NULL,
          object VARCHAR(255) NOT NULL,
          metadata JSONB,
          evidence_type VARCHAR(100),
          source VARCHAR(255),
          confidence DECIMAL(3,2) DEFAULT 1.0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          project_path VARCHAR(500),
          INDEX idx_triad_subject (subject),
          INDEX idx_triad_predicate (predicate),
          INDEX idx_triad_object (object),
          INDEX idx_triad_project (project_path),
          INDEX idx_triad_confidence (confidence),
          FOREIGN KEY (subject) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
          FOREIGN KEY (object) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
        )
      `);

      // Create additional indexes for performance
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_triads_subject_predicate
        ON knowledge_triads (subject, predicate)
      `);

      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_triads_predicate_object
        ON knowledge_triads (predicate, object)
      `);

      this.logger.debug('Knowledge graph database tables created');
    } catch (error) {
      // Don't throw - table creation may fail if DB unavailable
      this.logger.debug('Failed to create knowledge graph tables - database may be unavailable');
    }
  }

  async saveNode(node: KnowledgeNode): Promise<void> {
    if (!this.db) {
      this.logger.debug('Database not available, skipping node save');
      return;
    }

    try {
      // Derive name from node id or metadata
      const nodeName = node.metadata?.name || node.id.split('_')[0] || node.id;

      await this.db.query(`
        INSERT INTO knowledge_nodes (
          id, name, type, metadata, created_at, updated_at,
          project_path, source_file, confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at,
          confidence = EXCLUDED.confidence
      `, [
        node.id,
        nodeName,
        node.type,
        JSON.stringify(node.metadata || {}),
        node.createdAt || new Date(),
        node.updatedAt || new Date(),
        this.projectPath,
        node.metadata?.sourceFile,
        node.metadata?.confidence || 1.0
      ]);
    } catch (error) {
      // Don't throw - graceful fallback when DB unavailable
      this.logger.debug(`Failed to save node ${node.id} - database may be unavailable`);
    }
  }

  async saveTriad(triad: KnowledgeTriad): Promise<void> {
    if (!this.db) {
      this.logger.debug('Database not available, skipping triad save');
      return;
    }

    try {
      await this.db.query(`
        INSERT INTO knowledge_triads (
          id, subject, predicate, object, metadata,
          evidence_type, source, confidence, created_at, project_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          metadata = EXCLUDED.metadata,
          confidence = EXCLUDED.confidence,
          evidence_type = EXCLUDED.evidence_type
      `, [
        triad.id,
        triad.subject,
        triad.predicate,
        triad.object,
        JSON.stringify(triad.metadata || {}),
        triad.evidenceType,
        triad.source,
        triad.confidence || 1.0,
        triad.createdAt || new Date(),
        this.projectPath
      ]);
    } catch (error) {
      // Don't throw - graceful fallback when DB unavailable
      this.logger.debug(`Failed to save triad ${triad.id} - database may be unavailable`);
    }
  }

  async loadNodes(): Promise<Map<string, KnowledgeNode>> {
    const nodes = new Map<string, KnowledgeNode>();

    if (!this.db) {
      this.logger.debug('Database not available, returning empty nodes map');
      return nodes;
    }

    try {
      const results = await this.db.query(`
        SELECT * FROM knowledge_nodes
        WHERE project_path = $1
        ORDER BY created_at DESC
      `, [this.projectPath]);
      const rows = results.rows || results || [];

      for (const row of rows) {
        const metadata = typeof row.metadata === 'string'
          ? JSON.parse(row.metadata || '{}')
          : (row.metadata || {});
        // Include name in metadata if present in database
        if (row.name) {
          metadata.name = row.name;
        }
        const node: KnowledgeNode = {
          id: row.id,
          type: row.type,
          metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        nodes.set(node.id, node);
      }

      this.logger.debug(`Loaded ${nodes.size} knowledge nodes`);
    } catch (error) {
      // Don't throw - return empty map when DB unavailable
      this.logger.debug('Failed to load nodes from database - database may be unavailable');
    }

    return nodes;
  }

  async loadTriads(): Promise<Map<string, KnowledgeTriad>> {
    const triads = new Map<string, KnowledgeTriad>();

    if (!this.db) {
      this.logger.debug('Database not available, returning empty triads map');
      return triads;
    }

    try {
      const results = await this.db.query(`
        SELECT * FROM knowledge_triads
        WHERE project_path = $1
        ORDER BY created_at DESC
      `, [this.projectPath]);
      const rows = results.rows || results || [];

      for (const row of rows) {
        const triad: KnowledgeTriad = {
          id: row.id,
          subject: row.subject,
          predicate: row.predicate,
          object: row.object,
          metadata: typeof row.metadata === 'string'
            ? JSON.parse(row.metadata || '{}')
            : (row.metadata || {}),
          evidenceType: row.evidence_type,
          source: row.source,
          confidence: row.confidence,
          createdAt: row.created_at
        };
        triads.set(triad.id, triad);
      }

      this.logger.debug(`Loaded ${triads.size} knowledge triads`);
    } catch (error) {
      // Don't throw - return empty map when DB unavailable
      this.logger.debug('Failed to load triads from database - database may be unavailable');
    }

    return triads;
  }

  async queryNodes(query: GraphQuery): Promise<KnowledgeNode[]> {
    if (!this.db) {
      this.logger.debug('Database not available for node query');
      return [];
    }

    try {
      let sql = `SELECT * FROM knowledge_nodes WHERE project_path = $1`;
      const params = [this.projectPath];
      let paramIndex = 2;

      if (query.nodeType) {
        sql += ` AND type = $${paramIndex}`;
        params.push(query.nodeType);
        paramIndex++;
      }

      if (query.metadata) {
        for (const [key, value] of Object.entries(query.metadata)) {
          sql += ` AND metadata->>'${key}' = $${paramIndex}`;
          params.push(value);
          paramIndex++;
        }
      }

      if (query.confidence !== undefined) {
        sql += ` AND confidence >= $${paramIndex}`;
        params.push(query.confidence.toString());
        paramIndex++;
      }

      sql += ` ORDER BY confidence DESC`;

      if (query.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(query.limit.toString());
      }

      const results = await this.db.query(sql, params);
      const rows = results.rows || results || [];

      return rows.map((row: any) => {
        const metadata = typeof row.metadata === 'string'
          ? JSON.parse(row.metadata || '{}')
          : (row.metadata || {});
        if (row.name) {
          metadata.name = row.name;
        }
        return {
          id: row.id,
          type: row.type,
          metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });
    } catch (error) {
      // Don't throw - return empty array when DB unavailable
      this.logger.debug('Failed to query nodes - database may be unavailable');
      return [];
    }
  }

  async queryTriads(query: GraphQuery): Promise<KnowledgeTriad[]> {
    if (!this.db) {
      this.logger.debug('Database not available for triad query');
      return [];
    }

    try {
      let sql = `SELECT * FROM knowledge_triads WHERE project_path = $1`;
      const params = [this.projectPath];
      let paramIndex = 2;

      if (query.subject) {
        sql += ` AND subject = $${paramIndex}`;
        params.push(query.subject);
        paramIndex++;
      }

      if (query.predicate) {
        sql += ` AND predicate = $${paramIndex}`;
        params.push(query.predicate);
        paramIndex++;
      }

      if (query.object) {
        sql += ` AND object = $${paramIndex}`;
        params.push(query.object);
        paramIndex++;
      }

      if (query.evidenceType) {
        sql += ` AND evidence_type = $${paramIndex}`;
        params.push(query.evidenceType);
        paramIndex++;
      }

      if (query.confidence !== undefined) {
        sql += ` AND confidence >= $${paramIndex}`;
        params.push(query.confidence.toString());
        paramIndex++;
      }

      sql += ` ORDER BY confidence DESC`;

      if (query.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(query.limit.toString());
      }

      const results = await this.db.query(sql, params);
      const rows = results.rows || results || [];

      return rows.map((row: any) => ({
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        metadata: typeof row.metadata === 'string'
          ? JSON.parse(row.metadata || '{}')
          : (row.metadata || {}),
        evidenceType: row.evidence_type,
        source: row.source,
        confidence: row.confidence,
        createdAt: row.created_at
      }));
    } catch (error) {
      // Don't throw - return empty array when DB unavailable
      this.logger.debug('Failed to query triads - database may be unavailable');
      return [];
    }
  }

  async mutateGraph(mutation: GraphMutation): Promise<void> {
    if (!this.db) {
      this.logger.debug('Database not available for graph mutation');
      return;
    }

    try {
      // Begin transaction
      await this.db.beginTransaction();

      try {
        // Add nodes
        if (mutation.addNodes) {
          for (const node of mutation.addNodes) {
            await this.saveNode({
              ...node,
              id: node.id || this.generateNodeId(),
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }

        // Add triads
        if (mutation.addTriads) {
          for (const triad of mutation.addTriads) {
            await this.saveTriad({
              ...triad,
              id: triad.id || this.generateTriadId(),
              createdAt: new Date()
            });
          }
        }

        // Remove nodes
        if (mutation.removeNodes) {
          for (const nodeId of mutation.removeNodes) {
            await this.db.query(
              `DELETE FROM knowledge_nodes WHERE id = $1 AND project_path = $2`,
              [nodeId, this.projectPath]
            );
          }
        }

        // Remove triads
        if (mutation.removeTriads) {
          for (const triadId of mutation.removeTriads) {
            await this.db.query(
              `DELETE FROM knowledge_triads WHERE id = $1 AND project_path = $2`,
              [triadId, this.projectPath]
            );
          }
        }

        // Update nodes
        if (mutation.updateNodes) {
          for (const [nodeId, updates] of Object.entries(mutation.updateNodes)) {
            const updateFields = [];
            const params = [];
            let paramIndex = 1;

            if (updates.metadata) {
              updateFields.push(`metadata = $${paramIndex}`);
              params.push(JSON.stringify(updates.metadata));
              paramIndex++;
            }

            if (updates.confidence !== undefined) {
              updateFields.push(`confidence = $${paramIndex}`);
              params.push(updates.confidence);
              paramIndex++;
            }

            updateFields.push(`updated_at = $${paramIndex}`);
            params.push(new Date());
            paramIndex++;

            params.push(nodeId, this.projectPath);

            await this.db.query(`
              UPDATE knowledge_nodes
              SET ${updateFields.join(', ')}
              WHERE id = $${paramIndex} AND project_path = $${paramIndex + 1}
            `, params);
          }
        }

        // Update triads
        if (mutation.updateTriads) {
          for (const [triadId, updates] of Object.entries(mutation.updateTriads)) {
            const updateFields = [];
            const params = [];
            let paramIndex = 1;

            if (updates.metadata) {
              updateFields.push(`metadata = $${paramIndex}`);
              params.push(JSON.stringify(updates.metadata));
              paramIndex++;
            }

            if (updates.confidence !== undefined) {
              updateFields.push(`confidence = $${paramIndex}`);
              params.push(updates.confidence);
              paramIndex++;
            }

            params.push(triadId, this.projectPath);

            await this.db.query(`
              UPDATE knowledge_triads
              SET ${updateFields.join(', ')}
              WHERE id = $${paramIndex} AND project_path = $${paramIndex + 1}
            `, params);
          }
        }

        // Commit transaction
        await this.db.commitTransaction();
        this.logger.debug('Graph mutation completed');

      } catch (error) {
        try {
          await this.db.rollbackTransaction();
        } catch {
          // Ignore rollback errors
        }
        this.logger.debug('Failed to mutate graph - database may be unavailable');
      }
    } catch (error) {
      // Don't throw - graceful fallback when DB unavailable
      this.logger.debug('Failed to mutate graph - database may be unavailable');
    }
  }

  async closeConnection(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.initialized = false;
        this.logger.debug('Graph database connection closed');
      } catch (error) {
        // Silently handle close errors
        this.logger.debug('Error closing graph database connection');
      }
    }
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTriadId(): string {
    return `triad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility methods for common queries
  async getNodesByType(nodeType: string, limit?: number): Promise<KnowledgeNode[]> {
    return this.queryNodes({ nodeType, limit });
  }

  async getTriadsByPredicate(predicate: RelationType, limit?: number): Promise<KnowledgeTriad[]> {
    return this.queryTriads({ predicate, limit });
  }

  async getNodeConnections(nodeId: string): Promise<{incoming: KnowledgeTriad[], outgoing: KnowledgeTriad[]}> {
    const incoming = await this.queryTriads({ object: nodeId });
    const outgoing = await this.queryTriads({ subject: nodeId });

    return { incoming, outgoing };
  }

  async getNodeNeighbors(nodeId: string): Promise<string[]> {
    const { incoming, outgoing } = await this.getNodeConnections(nodeId);

    const neighbors = new Set<string>();
    incoming.forEach(triad => neighbors.add(triad.subject));
    outgoing.forEach(triad => neighbors.add(triad.object));
    neighbors.delete(nodeId); // Remove self

    return Array.from(neighbors);
  }

  async getSubgraph(nodeIds: string[]): Promise<{nodes: KnowledgeNode[], triads: KnowledgeTriad[]}> {
    if (!this.db || nodeIds.length === 0) {
      return { nodes: [], triads: [] };
    }

    try {
      const nodeIdPlaceholders = nodeIds.map((_, i) => `$${i + 1}`).join(',');
      const projectPathIndex = nodeIds.length + 1;

      const nodes = await this.db.query(`
        SELECT * FROM knowledge_nodes
        WHERE id IN (${nodeIdPlaceholders}) AND project_path = $${projectPathIndex}
      `, [...nodeIds, this.projectPath]);

      const triadProjectPathIndex = nodeIds.length * 2 + 1;
      const subjectPlaceholders = nodeIds.map((_, i) => `$${i + 1}`).join(',');
      const objectPlaceholders = nodeIds.map((_, i) => `$${i + nodeIds.length + 1}`).join(',');

      const triads = await this.db.query(`
        SELECT * FROM knowledge_triads
        WHERE (subject IN (${subjectPlaceholders}) OR object IN (${objectPlaceholders}))
        AND project_path = $${triadProjectPathIndex}
      `, [...nodeIds, ...nodeIds, this.projectPath]);

      return {
        nodes: nodes.map((row: any) => ({
          id: row.id,
          type: row.type,
          metadata: JSON.parse(row.metadata || '{}'),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        triads: triads.map((row: any) => ({
          id: row.id,
          subject: row.subject,
          predicate: row.predicate,
          object: row.object,
          metadata: JSON.parse(row.metadata || '{}'),
          evidenceType: row.evidence_type,
          source: row.source,
          confidence: row.confidence,
          createdAt: row.created_at
        }))
      };
    } catch (error) {
      // Don't throw - return empty result when DB unavailable
      this.logger.debug('Failed to get subgraph - database may be unavailable');
      return { nodes: [], triads: [] };
    }
  }
}