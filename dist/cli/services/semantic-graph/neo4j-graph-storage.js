"use strict";
/**
 * Neo4j Semantic Graph Storage Service
 *
 * Stores semantic graphs in Neo4j with project-disjoint structure:
 * - Each project has a root PROJECT node
 * - All entities and relationships are connected through the project
 * - Ensures complete separation between different projects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jGraphStorage = void 0;
const database_config_1 = require("../../../config/database-config");
const logger_1 = require("../../../utils/logger");
class Neo4jGraphStorage {
    dbConnections;
    logger = logger_1.Logger.getInstance();
    constructor(dbConnections) {
        this.dbConnections = dbConnections || new database_config_1.DatabaseConnections();
    }
    /**
     * Initialize semantic graph for a project with root PROJECT node
     */
    async initializeProjectGraph(projectId, projectName, projectPath) {
        this.logger.info(`🌐 Initializing Neo4j graph for project: ${projectName}`);
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            // Create or update the root PROJECT node
            await session.run(`
        MERGE (p:PROJECT {id: $projectId})
        SET p.name = $projectName,
            p.path = $projectPath,
            p.lastUpdated = datetime(),
            p.initialized = true
        RETURN p
      `, { projectId, projectName, projectPath });
            console.log(`  ✅ Project graph initialized for ${projectName}`);
            await session.close();
        }
        catch (error) {
            this.logger.error(`Failed to initialize project graph: ${error.message}`);
            throw error;
        }
    }
    /**
     * Store semantic entities for a project
     */
    async storeSemanticEntities(projectId, entities) {
        if (entities.length === 0)
            return;
        this.logger.info(`🔗 Storing ${entities.length} semantic entities in Neo4j`);
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            // Batch process entities for performance
            const batchSize = 100;
            for (let i = 0; i < entities.length; i += batchSize) {
                const batch = entities.slice(i, i + batchSize);
                await session.run(`
          MATCH (p:PROJECT {id: $projectId})
          UNWIND $entities as entity
          MERGE (e:ENTITY {id: entity.id, projectId: $projectId})
          SET e.name = entity.name,
              e.type = entity.type,
              e.filePath = entity.filePath,
              e.startLine = entity.startLine,
              e.endLine = entity.endLine,
              e.signature = entity.signature,
              e.modifiers = entity.modifiers,
              e.metadataJson = entity.metadataJson,
              e.lastUpdated = datetime()
          MERGE (p)-[:CONTAINS]->(e)
          RETURN count(e) as entitiesCreated
        `, {
                    projectId,
                    entities: batch.map(entity => ({
                        id: entity.id,
                        name: entity.name,
                        type: entity.type,
                        filePath: entity.filePath,
                        startLine: entity.startLine,
                        endLine: entity.endLine,
                        signature: entity.signature || '',
                        modifiers: Array.isArray(entity.modifiers) ? entity.modifiers : [],
                        metadataJson: JSON.stringify(entity.metadata || {})
                    }))
                });
                console.log(`  📦 Stored batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(entities.length / batchSize)}`);
            }
            console.log(`  ✅ Stored ${entities.length} semantic entities`);
            await session.close();
        }
        catch (error) {
            this.logger.error(`Failed to store semantic entities: ${error.message}`);
            throw error;
        }
    }
    /**
     * Store semantic relationships between entities
     */
    async storeSemanticRelationships(projectId, relationships) {
        if (relationships.length === 0)
            return;
        this.logger.info(`🔗 Storing ${relationships.length} semantic relationships in Neo4j`);
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            // Batch process relationships for performance
            const batchSize = 100;
            for (let i = 0; i < relationships.length; i += batchSize) {
                const batch = relationships.slice(i, i + batchSize);
                await session.run(`
          UNWIND $relationships as rel
          MATCH (source:ENTITY {id: rel.sourceEntityId, projectId: $projectId})
          MATCH (target:ENTITY {id: rel.targetEntityId, projectId: $projectId})
          CALL apoc.create.relationship(source, rel.type, {
            id: rel.id,
            metadataJson: rel.metadataJson,
            createdAt: datetime()
          }, target) YIELD rel as relationship
          RETURN count(relationship) as relationshipsCreated
        `, {
                    projectId,
                    relationships: batch
                        .filter(rel => rel.type && typeof rel.type === 'string') // Filter out invalid relationships
                        .map(rel => ({
                        id: rel.id,
                        sourceEntityId: rel.sourceEntityId,
                        targetEntityId: rel.targetEntityId,
                        type: rel.type.toUpperCase(), // Neo4j relationship types should be uppercase
                        metadataJson: JSON.stringify(rel.metadata || {})
                    }))
                });
                console.log(`  🔗 Stored batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(relationships.length / batchSize)}`);
            }
            console.log(`  ✅ Stored ${relationships.length} semantic relationships`);
            await session.close();
        }
        catch (error) {
            this.logger.error(`Failed to store semantic relationships: ${error.message}`);
            // Fallback: Store relationships without APOC if it's not available
            try {
                await this.storeRelationshipsFallback(projectId, relationships);
            }
            catch (fallbackError) {
                this.logger.error(`Fallback relationship storage also failed: ${fallbackError.message}`);
                throw fallbackError;
            }
        }
    }
    /**
     * Fallback method to store relationships without APOC
     */
    async storeRelationshipsFallback(projectId, relationships) {
        this.logger.info('🔄 Using fallback relationship storage (without APOC)');
        const driver = await this.dbConnections.getNeo4jConnection();
        const session = driver.session();
        for (const rel of relationships) {
            try {
                // Validate relationship data
                if (!rel.type || typeof rel.type !== 'string') {
                    this.logger.warn(`Skipping relationship ${rel.id}: invalid or missing type`);
                    continue;
                }
                // Create relationships based on common types
                let query = '';
                const relType = rel.type.toUpperCase();
                if (['IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'CALLS', 'DEFINES', 'USES', 'CONTAINS'].includes(relType)) {
                    query = `
            MATCH (source:ENTITY {id: $sourceId, projectId: $projectId})
            MATCH (target:ENTITY {id: $targetId, projectId: $projectId})
            MERGE (source)-[r:${relType}]->(target)
            SET r.id = $relId,
                r.metadataJson = $metadataJson,
                r.createdAt = datetime()
            RETURN r
          `;
                }
                else {
                    // Generic relationship for unknown types
                    query = `
            MATCH (source:ENTITY {id: $sourceId, projectId: $projectId})
            MATCH (target:ENTITY {id: $targetId, projectId: $projectId})
            MERGE (source)-[r:RELATED]->(target)
            SET r.id = $relId,
                r.type = $relType,
                r.metadataJson = $metadataJson,
                r.createdAt = datetime()
            RETURN r
          `;
                }
                await session.run(query, {
                    projectId,
                    sourceId: rel.sourceEntityId,
                    targetId: rel.targetEntityId,
                    relId: rel.id,
                    relType: rel.type,
                    metadataJson: JSON.stringify(rel.metadata || {})
                });
            }
            catch (error) {
                this.logger.warn(`Failed to store relationship ${rel.id}: ${error.message}`);
            }
        }
        await session.close();
    }
    /**
     * Get project graph statistics
     */
    async getProjectGraphStats(projectId) {
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            const result = await session.run(`
        MATCH (p:PROJECT {id: $projectId})
        OPTIONAL MATCH (p)-[:CONTAINS]->(e:ENTITY)
        OPTIONAL MATCH (e)-[r]-()
        WITH p,
             count(DISTINCT e) as entityCount,
             count(DISTINCT r) as relationshipCount,
             count(DISTINCT e.filePath) as fileCount
        RETURN 1 as projectNodes,
               entityCount,
               relationshipCount,
               fileCount
      `, { projectId });
            const record = result.records[0];
            await session.close();
            return {
                projectNodes: record?.get('projectNodes')?.toNumber() || 0,
                entityNodes: record?.get('entityCount')?.toNumber() || 0,
                relationships: record?.get('relationshipCount')?.toNumber() || 0,
                files: record?.get('fileCount')?.toNumber() || 0
            };
        }
        catch (error) {
            this.logger.error(`Failed to get project graph stats: ${error.message}`);
            return {
                projectNodes: 0,
                entityNodes: 0,
                relationships: 0,
                files: 0
            };
        }
    }
    /**
     * Clear project graph (remove all nodes and relationships for a project)
     */
    async clearProjectGraph(projectId) {
        this.logger.info(`🧹 Clearing Neo4j graph for project: ${projectId}`);
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            // Delete all entities and their relationships for this project
            await session.run(`
        MATCH (p:PROJECT {id: $projectId})
        OPTIONAL MATCH (p)-[:CONTAINS]->(e:ENTITY)
        DETACH DELETE e, p
      `, { projectId });
            console.log(`  ✅ Project graph cleared for ${projectId}`);
            await session.close();
        }
        catch (error) {
            this.logger.error(`Failed to clear project graph: ${error.message}`);
            throw error;
        }
    }
    /**
     * Query semantic relationships for graph traversal
     */
    async querySemanticPath(projectId, fromEntity, toEntity, maxDepth = 3) {
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            const result = await session.run(`
        MATCH (start:ENTITY {name: $fromEntity, projectId: $projectId}),
              (end:ENTITY {name: $toEntity, projectId: $projectId})
        MATCH path = shortestPath((start)-[*1..${maxDepth}]-(end))
        RETURN path, length(path) as pathLength
        ORDER BY pathLength
        LIMIT 10
      `, { projectId, fromEntity, toEntity });
            const paths = result.records.map(record => ({
                path: record.get('path'),
                length: record.get('pathLength').toNumber()
            }));
            await session.close();
            return paths;
        }
        catch (error) {
            this.logger.error(`Failed to query semantic path: ${error.message}`);
            return [];
        }
    }
}
exports.Neo4jGraphStorage = Neo4jGraphStorage;
exports.default = Neo4jGraphStorage;
//# sourceMappingURL=neo4j-graph-storage.js.map