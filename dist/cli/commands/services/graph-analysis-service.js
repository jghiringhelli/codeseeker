"use strict";
/**
 * Graph Analysis Service - Queries Persisted Neo4j Graph
 * Single Responsibility: Query existing Neo4j graph to find relationships between semantic search results
 *
 * Strategy: "Seed + Expand"
 * 1. Take top N files from semantic search (seeds)
 * 2. Look up corresponding ENTITY nodes in Neo4j by filePath
 * 3. Get direct relationships between seed nodes
 * 4. Optionally expand 1-hop to include important dependencies
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphAnalysisService = void 0;
const path = __importStar(require("path"));
const database_config_1 = require("../../../config/database-config");
const logger_1 = require("../../../utils/logger");
class GraphAnalysisService {
    dbConnections;
    logger;
    projectPath;
    projectId;
    constructor(projectPath, projectId) {
        this.projectPath = projectPath;
        this.projectId = projectId;
        this.dbConnections = new database_config_1.DatabaseConnections();
        this.logger = logger_1.Logger.getInstance().child('GraphAnalysis');
    }
    /**
     * Set project ID for scoped queries
     */
    setProjectId(projectId) {
        this.projectId = projectId;
    }
    /**
     * Main entry point: Perform graph analysis using persisted Neo4j graph
     * Uses "Seed + Expand" strategy
     */
    async performGraphAnalysis(_query, semanticResults) {
        try {
            // Resolve project ID if not set
            if (!this.projectId) {
                this.projectId = await this.resolveProjectId();
            }
            if (!this.projectId) {
                this.logger.debug('No project ID available, using basic analysis');
                return this.createBasicAnalysis(semanticResults);
            }
            // Step 1: Look up seed nodes from semantic search results
            const seedNodes = await this.lookupNodesFromFiles(semanticResults);
            if (seedNodes.length === 0) {
                this.logger.debug('No nodes found in graph for search results, using basic analysis');
                return this.createBasicAnalysis(semanticResults);
            }
            // Step 2: Get relationships BETWEEN seed nodes (most relevant)
            const directRelationships = await this.getRelationshipsBetweenNodes(seedNodes);
            // Step 3: One-hop expansion - get important neighbors
            const { expandedNodes, expandedRelationships } = await this.expandOneHop(seedNodes, {
                maxPerNode: 3,
                relationshipTypes: ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'USES']
            });
            // Combine results
            const allClasses = this.convertToClasses(seedNodes, semanticResults, expandedNodes);
            const allRelationships = [...directRelationships, ...expandedRelationships];
            // Extract packages
            const packages = this.extractPackages([...seedNodes, ...expandedNodes]);
            // Calculate insights
            const graphInsights = this.calculateInsights(allClasses, allRelationships);
            return {
                classes: allClasses,
                relationships: allRelationships,
                relationshipDetails: allRelationships,
                packageStructure: packages,
                graphInsights
            };
        }
        catch (error) {
            this.logger.debug(`Graph analysis failed: ${error instanceof Error ? error.message : error}`);
            return this.createBasicAnalysis(semanticResults);
        }
    }
    /**
     * Resolve project ID from database by project path
     * Queries both :Project and :PROJECT labels for compatibility
     */
    async resolveProjectId() {
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            try {
                // Try :Project label first (current schema)
                let result = await session.run(`
          MATCH (p:Project)
          WHERE p.path CONTAINS $pathPart
          RETURN p.id as id
          LIMIT 1
        `, { pathPart: path.basename(this.projectPath) });
                if (result.records.length > 0) {
                    return result.records[0].get('id');
                }
                // Fallback to :PROJECT label (legacy schema)
                result = await session.run(`
          MATCH (p:PROJECT)
          WHERE p.path CONTAINS $pathPart
          RETURN p.id as id
          LIMIT 1
        `, { pathPart: path.basename(this.projectPath) });
                if (result.records.length > 0) {
                    return result.records[0].get('id');
                }
            }
            finally {
                await session.close();
            }
        }
        catch (error) {
            this.logger.debug(`Could not resolve project ID from Neo4j: ${error instanceof Error ? error.message : error}`);
        }
        return undefined;
    }
    /**
     * Step 1: Look up nodes by file path from Neo4j graph
     * Current schema: Project-[:CONTAINS]->File-[:DEFINES]->Class/Function
     * File nodes have `path` property, entities have `name`, `startLine`, `endLine`
     */
    async lookupNodesFromFiles(semanticResults) {
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            try {
                // Normalize paths: convert backslashes to forward slashes for matching
                const filePaths = semanticResults.map(r => {
                    return r.file.replace(/\\/g, '/');
                });
                // Query File nodes and their DEFINES relationships to Class/Function entities
                // Schema: (Project {id})-[:CONTAINS]->(File {path})-[:DEFINES]->(Class|Function {name})
                const result = await session.run(`
          MATCH (p:Project {id: $projectId})-[:CONTAINS]->(f:File)
          WITH f, replace(f.path, '\\\\', '/') as normalizedPath
          WHERE any(fp IN $filePaths WHERE
            normalizedPath ENDS WITH fp OR
            normalizedPath ENDS WITH ('/' + fp) OR
            normalizedPath CONTAINS ('/' + fp)
          )
          OPTIONAL MATCH (f)-[:DEFINES]->(entity)
          WITH f, entity
          RETURN
            CASE WHEN entity IS NOT NULL THEN toString(id(entity)) ELSE toString(id(f)) END as id,
            CASE WHEN entity IS NOT NULL THEN entity.name ELSE f.name END as name,
            CASE WHEN entity IS NOT NULL THEN labels(entity)[0] ELSE 'File' END as type,
            f.path as filePath,
            CASE WHEN entity IS NOT NULL THEN entity.startLine ELSE 1 END as startLine,
            CASE WHEN entity IS NOT NULL THEN entity.endLine ELSE 1 END as endLine,
            null as signature
          LIMIT 50
        `, { projectId: this.projectId, filePaths });
                return result.records.map(record => ({
                    id: record.get('id'),
                    name: record.get('name'),
                    type: record.get('type'),
                    filePath: record.get('filePath'),
                    startLine: record.get('startLine')?.toNumber?.() || record.get('startLine') || 1,
                    endLine: record.get('endLine')?.toNumber?.() || record.get('endLine') || 1,
                    signature: record.get('signature')
                }));
            }
            finally {
                await session.close();
            }
        }
        catch (error) {
            this.logger.debug(`Failed to lookup nodes: ${error instanceof Error ? error.message : error}`);
            return [];
        }
    }
    /**
     * Step 2: Get relationships between seed nodes
     * Current schema: File-[:DEFINES]->Class/Function
     * Returns DEFINES relationships between files and their entities
     */
    async getRelationshipsBetweenNodes(nodes) {
        if (nodes.length < 2)
            return [];
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            try {
                const nodeIds = nodes.map(n => n.id);
                const filePaths = nodes.map(n => n.filePath).filter(Boolean);
                // Query relationships: File-[:DEFINES]->Class/Function
                // Also check for any relationships between entities in the matched files
                const result = await session.run(`
          MATCH (f:File)-[:DEFINES]->(entity)
          WHERE f.path IN $filePaths
          WITH f, entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WHERE other IS NOT NULL
          RETURN
            f.name as sourceName,
            f.path as sourceFilePath,
            entity.name as targetName,
            f.path as targetFilePath,
            'DEFINES' as relType,
            null as metadata
          UNION
          MATCH (f1:File)-[:DEFINES]->(e1)-[r]->(e2)<-[:DEFINES]-(f2:File)
          WHERE f1.path IN $filePaths AND f2.path IN $filePaths AND f1 <> f2
          RETURN
            e1.name as sourceName,
            f1.path as sourceFilePath,
            e2.name as targetName,
            f2.path as targetFilePath,
            type(r) as relType,
            null as metadata
          LIMIT 50
        `, { nodeIds, filePaths, projectId: this.projectId });
                return result.records.map(record => {
                    const metadata = this.parseMetadata(record.get('metadata'));
                    return {
                        from: record.get('sourceName'),
                        to: record.get('targetName'),
                        type: record.get('relType'),
                        strength: 0.9, // Direct relationships are high strength
                        fromPath: record.get('sourceFilePath'),
                        toPath: record.get('targetFilePath'),
                        fromMethod: metadata?.fromMethod,
                        toMethod: metadata?.toMethod,
                        line: metadata?.line
                    };
                });
            }
            finally {
                await session.close();
            }
        }
        catch (error) {
            this.logger.debug(`Failed to get relationships: ${error instanceof Error ? error.message : error}`);
            return [];
        }
    }
    /**
     * Step 3: One-hop expansion - find important neighbors not in seed set
     * Current schema: File-[:DEFINES]->Class/Function
     * Expands to find other files that define related entities
     */
    async expandOneHop(seedNodes, options) {
        const expandedNodes = [];
        const expandedRelationships = [];
        const seenNeighborIds = new Set();
        try {
            const driver = await this.dbConnections.getNeo4jConnection();
            const session = driver.session();
            try {
                const filePaths = seedNodes.map(n => n.filePath).filter(Boolean);
                // Find other files in the same project that are connected via DEFINES
                // This expands to find related files that define entities
                const result = await session.run(`
          MATCH (p:Project {id: $projectId})-[:CONTAINS]->(seedFile:File)-[:DEFINES]->(entity)
          WHERE seedFile.path IN $filePaths
          WITH p, seedFile, entity
          MATCH (p)-[:CONTAINS]->(neighborFile:File)-[:DEFINES]->(neighborEntity)
          WHERE NOT neighborFile.path IN $filePaths
          WITH seedFile, entity, neighborFile, neighborEntity
          RETURN
            toString(id(seedFile)) as seedId,
            seedFile.name as seedName,
            seedFile.path as seedFilePath,
            toString(id(neighborEntity)) as neighborId,
            neighborEntity.name as neighborName,
            labels(neighborEntity)[0] as neighborType,
            neighborFile.path as neighborFilePath,
            neighborEntity.startLine as neighborStartLine,
            neighborEntity.endLine as neighborEndLine,
            'RELATED' as relType,
            null as metadata
          LIMIT 30
        `, {
                    filePaths,
                    projectId: this.projectId
                });
                // Track how many neighbors we've added per seed
                const neighborsPerSeed = new Map();
                for (const record of result.records) {
                    const seedId = record.get('seedId');
                    const neighborId = record.get('neighborId');
                    // Limit neighbors per seed node
                    const currentCount = neighborsPerSeed.get(seedId) || 0;
                    if (currentCount >= options.maxPerNode)
                        continue;
                    // Skip if we've already seen this neighbor
                    if (seenNeighborIds.has(neighborId))
                        continue;
                    seenNeighborIds.add(neighborId);
                    neighborsPerSeed.set(seedId, currentCount + 1);
                    // Add the neighbor node
                    expandedNodes.push({
                        id: neighborId,
                        name: record.get('neighborName'),
                        type: record.get('neighborType'),
                        filePath: record.get('neighborFilePath'),
                        startLine: record.get('neighborStartLine')?.toNumber?.() || 1,
                        endLine: record.get('neighborEndLine')?.toNumber?.() || 1
                    });
                    // Add the relationship
                    const metadata = this.parseMetadata(record.get('metadata'));
                    expandedRelationships.push({
                        from: record.get('seedName'),
                        to: record.get('neighborName'),
                        type: record.get('relType'),
                        strength: 0.7, // Expanded relationships are slightly lower strength
                        fromPath: record.get('seedFilePath'),
                        toPath: record.get('neighborFilePath'),
                        fromMethod: metadata?.fromMethod,
                        toMethod: metadata?.toMethod,
                        line: metadata?.line
                    });
                }
            }
            finally {
                await session.close();
            }
        }
        catch (error) {
            this.logger.debug(`Failed to expand one-hop: ${error instanceof Error ? error.message : error}`);
        }
        return { expandedNodes, expandedRelationships };
    }
    /**
     * Convert Neo4j entities to GraphContext classes format
     */
    convertToClasses(seedNodes, semanticResults, expandedNodes) {
        const classes = [];
        // Add seed nodes (from search results) with their similarity scores
        for (const node of seedNodes) {
            const semanticResult = semanticResults.find(r => r.file.includes(path.basename(node.filePath)) ||
                node.filePath.includes(r.file));
            classes.push({
                name: node.name,
                filePath: node.filePath,
                type: node.type?.toLowerCase() || 'class',
                description: this.generateDescription(node),
                confidence: semanticResult?.similarity || 0.8,
                startLine: node.startLine,
                endLine: node.endLine,
                relationships: []
            });
        }
        // Add expanded nodes (from 1-hop expansion) with lower confidence
        for (const node of expandedNodes) {
            classes.push({
                name: node.name,
                filePath: node.filePath,
                type: node.type?.toLowerCase() || 'class',
                description: this.generateDescription(node) + ' (related dependency)',
                confidence: 0.6, // Lower confidence for expanded nodes
                startLine: node.startLine,
                endLine: node.endLine,
                relationships: []
            });
        }
        return classes;
    }
    /**
     * Generate description for a node
     */
    generateDescription(node) {
        const type = node.type?.toLowerCase() || 'class';
        const typeDescriptions = {
            'class': 'Class implementation',
            'interface': 'Interface definition',
            'function': 'Function implementation',
            'method': 'Method implementation',
            'service': 'Service class handling business logic',
            'controller': 'Controller handling requests',
            'repository': 'Repository for data access',
            'component': 'Component module'
        };
        return typeDescriptions[type] || `${type} component`;
    }
    /**
     * Extract package names from nodes
     */
    extractPackages(nodes) {
        const packages = new Set();
        for (const node of nodes) {
            if (node.filePath) {
                const parts = path.dirname(node.filePath).split(path.sep);
                const srcIndex = parts.findIndex(p => p === 'src');
                if (srcIndex !== -1 && srcIndex < parts.length - 1) {
                    packages.add(parts[srcIndex + 1]);
                }
                else if (parts.length > 0) {
                    packages.add(parts[parts.length - 1]);
                }
            }
        }
        return Array.from(packages);
    }
    /**
     * Calculate graph insights
     */
    calculateInsights(classes, relationships) {
        const nodeCount = classes.length;
        const relCount = relationships.length;
        // Calculate basic coupling (avg relationships per node)
        const coupling = nodeCount > 0 ? Math.min(relCount / nodeCount / 5, 1) : 0;
        // Detect architectural patterns
        const patterns = [];
        const relTypes = new Set(relationships.map(r => r.type));
        if (relTypes.has('IMPLEMENTS'))
            patterns.push('interface-based');
        if (relTypes.has('EXTENDS'))
            patterns.push('inheritance');
        if (relTypes.has('CALLS'))
            patterns.push('service-layer');
        return {
            totalNodes: nodeCount,
            totalRelationships: relCount,
            architecturalPatterns: patterns,
            qualityMetrics: {
                coupling,
                cohesion: nodeCount > 0 ? 0.7 : 0, // Placeholder
                complexity: Math.min(relCount / 10, 1) // Simple complexity metric
            }
        };
    }
    /**
     * Parse metadata JSON safely
     */
    parseMetadata(metadataJson) {
        if (!metadataJson)
            return {};
        try {
            return JSON.parse(metadataJson);
        }
        catch {
            return {};
        }
    }
    /**
     * Fallback: Create basic analysis from semantic results when graph unavailable
     */
    createBasicAnalysis(semanticResults) {
        const classes = semanticResults.map(result => ({
            name: this.extractClassNameFromFile(result.file),
            filePath: result.file,
            type: result.type || 'module',
            description: `${result.type || 'Module'} from semantic search`,
            confidence: result.similarity || 0.5,
            startLine: result.lineStart,
            endLine: result.lineEnd,
            relationships: []
        }));
        const packages = new Set();
        for (const result of semanticResults) {
            const parts = path.dirname(result.file).split(path.sep);
            const srcIndex = parts.findIndex(p => p === 'src');
            if (srcIndex !== -1 && srcIndex < parts.length - 1) {
                packages.add(parts[srcIndex + 1]);
            }
        }
        return {
            classes,
            relationships: [],
            relationshipDetails: [],
            packageStructure: Array.from(packages),
            graphInsights: {
                totalNodes: classes.length,
                totalRelationships: 0,
                architecturalPatterns: ['basic-analysis'],
                qualityMetrics: { coupling: 0.5, cohesion: 0.5, complexity: 0.5 }
            }
        };
    }
    /**
     * Extract class name from file path
     */
    extractClassNameFromFile(filePath) {
        const basename = path.basename(filePath, path.extname(filePath));
        // Convert kebab-case to PascalCase
        return basename
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }
}
exports.GraphAnalysisService = GraphAnalysisService;
//# sourceMappingURL=graph-analysis-service.js.map