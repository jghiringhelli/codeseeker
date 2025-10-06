"use strict";
/**
 * Semantic Knowledge Graph Implementation
 *
 * Core knowledge graph engine that manages triads (subject-predicate-object)
 * representing semantic relationships between code entities.
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
exports.KnowledgeGraph = exports.SemanticKnowledgeGraph = void 0;
const types_1 = require("./types");
const logger_1 = require("../../../utils/logger");
const factory_1 = require("../../../database/factory");
const crypto = __importStar(require("crypto"));
class SemanticKnowledgeGraph {
    projectPath;
    logger;
    db;
    nodes = new Map();
    triads = new Map();
    nodeIndex = new Map();
    relationIndex = new Map();
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.logger = logger_1.Logger?.getInstance().child('KnowledgeGraph');
        this?.initializeDatabase();
        this?.initializeIndexes();
    }
    async initializeDatabase() {
        try {
            const config = factory_1.DatabaseFactory?.parseConfigFromEnv();
            if (config) {
                this.db = factory_1.DatabaseFactory?.create(config, this.logger);
                await this.db?.initialize();
                await this?.createKnowledgeGraphTables();
            }
            else {
                this.logger.warn('No database configuration found, using in-memory storage');
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize knowledge graph database', error);
        }
    }
    initializeIndexes() {
        // Initialize type and relation indexes for fast queries
        Object.values(types_1.NodeType)?.forEach(type => {
            this.nodeIndex?.set(type, new Set());
        });
        Object.values(types_1.RelationType)?.forEach(relation => {
            this.relationIndex?.set(relation, new Set());
        });
    }
    async createKnowledgeGraphTables() {
        if (!this.db)
            return;
        const tables = [
            `CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        namespace TEXT,
        source_location JSONB,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
            `CREATE TABLE IF NOT EXISTS knowledge_triads (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        source TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject) REFERENCES knowledge_nodes(id),
        FOREIGN KEY (object) REFERENCES knowledge_nodes(id)
      )`,
            `CREATE TABLE IF NOT EXISTS graph_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        node_count INTEGER NOT NULL,
        triad_count INTEGER NOT NULL,
        hash TEXT NOT NULL,
        metadata JSONB
      )`,
            `CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_nodes(type)`,
            `CREATE INDEX IF NOT EXISTS idx_nodes_name ON knowledge_nodes(name)`,
            `CREATE INDEX IF NOT EXISTS idx_nodes_namespace ON knowledge_nodes(namespace)`,
            `CREATE INDEX IF NOT EXISTS idx_triads_subject ON knowledge_triads(subject)`,
            `CREATE INDEX IF NOT EXISTS idx_triads_predicate ON knowledge_triads(predicate)`,
            `CREATE INDEX IF NOT EXISTS idx_triads_object ON knowledge_triads(object)`,
            `CREATE INDEX IF NOT EXISTS idx_triads_confidence ON knowledge_triads(confidence)`
        ];
        for (const table of tables) {
            try {
                await this.db?.query(table);
            }
            catch (error) {
                this.logger.error(`Failed to create knowledge graph table: ${table}`, error);
            }
        }
    }
    // Node Management
    async addNode(node) {
        const id = this?.generateNodeId(node.type, node.name, node.namespace);
        const now = new Date();
        const knowledgeNode = {
            ...node,
            id,
            createdAt: now,
            updatedAt: now
        };
        this.nodes?.set(id, knowledgeNode);
        this.nodeIndex?.get(node.type)?.add(id);
        if (this.db) {
            try {
                await this.db?.query(`INSERT INTO knowledge_nodes (id, type, name, namespace, source_location, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           namespace = EXCLUDED.namespace,
           source_location = EXCLUDED.source_location,
           metadata = EXCLUDED.metadata,
           updated_at = EXCLUDED.updated_at`, [
                    id,
                    node.type,
                    node.name,
                    node.namespace,
                    JSON.stringify(node.sourceLocation),
                    JSON.stringify(node.metadata),
                    now,
                    now
                ]);
            }
            catch (error) {
                this.logger.error('Failed to persist node to database', error);
            }
        }
        return id;
    }
    async addTriad(triad) {
        const id = this?.generateTriadId(triad.subject, triad.predicate, triad.object);
        const now = new Date();
        const knowledgeTriad = {
            ...triad,
            id,
            createdAt: now
        };
        this.triads?.set(id, knowledgeTriad);
        this.relationIndex?.get(triad.predicate)?.add(id);
        if (this.db) {
            try {
                await this.db?.query(`INSERT INTO knowledge_triads (id, subject, predicate, object, confidence, source, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
           confidence = EXCLUDED.confidence,
           metadata = EXCLUDED.metadata`, [
                    id,
                    triad.subject,
                    triad.predicate,
                    triad.object,
                    triad.confidence,
                    triad.source,
                    JSON.stringify(triad.metadata),
                    now
                ]);
            }
            catch (error) {
                this.logger.error('Failed to persist triad to database', error);
            }
        }
        return id;
    }
    // Query and Search
    async queryNodes(query) {
        let candidateNodes = Array.from(this.nodes?.values());
        if (query.nodes) {
            const { types, names, namespaces, metadata } = query.nodes;
            if (types) {
                const typeNodes = new Set();
                types?.forEach(type => {
                    this.nodeIndex?.get(type)?.forEach(id => typeNodes?.add(id));
                });
                candidateNodes = candidateNodes?.filter(node => typeNodes?.has(node.id));
            }
            if (names) {
                candidateNodes = candidateNodes?.filter(node => names?.some(name => node.name?.includes(name)));
            }
            if (namespaces) {
                candidateNodes = candidateNodes?.filter(node => node.namespace && namespaces?.includes(node.namespace));
            }
            if (metadata) {
                candidateNodes = candidateNodes?.filter(node => this?.matchesMetadata(node.metadata, metadata));
            }
        }
        // Apply limit and offset
        if (query.offset) {
            candidateNodes = candidateNodes?.slice(query.offset);
        }
        if (query.limit) {
            candidateNodes = candidateNodes?.slice(0, query.limit);
        }
        return candidateNodes;
    }
    async queryTriads(query) {
        let candidateTriads = Array.from(this.triads?.values());
        if (query.triads) {
            const { subjects, predicates, objects, confidence, sources } = query.triads;
            if (subjects) {
                candidateTriads = candidateTriads?.filter(triad => subjects?.includes(triad.subject));
            }
            if (predicates) {
                const predicateTriads = new Set();
                predicates?.forEach(predicate => {
                    this.relationIndex?.get(predicate)?.forEach(id => predicateTriads?.add(id));
                });
                candidateTriads = candidateTriads?.filter(triad => predicateTriads?.has(triad.id));
            }
            if (objects) {
                candidateTriads = candidateTriads?.filter(triad => objects?.includes(triad.object));
            }
            if (confidence) {
                candidateTriads = candidateTriads?.filter(triad => {
                    const conf = triad.confidence;
                    return (!confidence.min || conf >= confidence.min) &&
                        (!confidence.max || conf <= confidence.max);
                });
            }
            if (sources) {
                candidateTriads = candidateTriads?.filter(triad => sources?.includes(triad.source));
            }
        }
        return candidateTriads;
    }
    async traverse(query) {
        const visited = new Set();
        const result = [];
        const paths = [];
        for (const startNodeId of query.startNodes) {
            await this?.traverseFromNode(startNodeId, query, visited, result, paths, [], 0);
        }
        return { nodes: result, paths };
    }
    async traverseFromNode(nodeId, query, visited, result, paths, currentPath, depth) {
        if (visited?.has(nodeId) || (query.maxDepth && depth > query.maxDepth)) {
            return;
        }
        visited?.add(nodeId);
        const node = this.nodes?.get(nodeId);
        if (node) {
            result?.push(node);
        }
        // Find related triads
        const relatedTriads = Array.from(this.triads?.values()).filter(triad => {
            const isRelated = query?.direction === 'incoming' ? triad?.object === nodeId :
                query?.direction === 'outgoing' ? triad?.subject === nodeId :
                    triad?.subject === nodeId || triad?.object === nodeId;
            return isRelated && query.relations?.includes(triad.predicate);
        });
        for (const triad of relatedTriads) {
            const nextNodeId = triad?.subject === nodeId ? triad.object : triad.subject;
            const nextNode = this.nodes?.get(nextNodeId);
            if (nextNode && this?.matchesNodeFilter(nextNode, query.filters)) {
                const newPath = [...currentPath, triad];
                if (depth > 0) {
                    paths?.push({
                        startNode: query.startNodes[0], // Simplified for now
                        endNode: nextNodeId,
                        path: newPath,
                        depth: depth + 1
                    });
                }
                await this?.traverseFromNode(nextNodeId, query, visited, result, paths, newPath, depth + 1);
            }
        }
    }
    // Analysis and Insights
    async analyzeGraph() {
        const nodeCount = this.nodes.size;
        const triadCount = this.triads.size;
        const relationshipDistribution = {};
        const nodeTypeDistribution = {};
        // Count relationships and node types
        for (const triad of this.triads?.values()) {
            relationshipDistribution[triad.predicate] =
                (relationshipDistribution[triad.predicate] || 0) + 1;
        }
        for (const node of this.nodes?.values()) {
            nodeTypeDistribution[node.type] =
                (nodeTypeDistribution[node.type] || 0) + 1;
        }
        // Calculate centrality scores (simplified PageRank-like algorithm)
        const centralityScores = await this?.calculateCentralityScores();
        // Find strongly connected components
        const stronglyConnectedComponents = await this?.findStronglyConnectedComponents();
        // Calculate clustering coefficient
        const clusteringCoefficient = this?.calculateClusteringCoefficient();
        return {
            nodeCount,
            triadCount,
            relationshipDistribution,
            nodeTypeDistribution,
            centralityScores,
            clusteringCoefficient,
            stronglyConnectedComponents
        };
    }
    async findSemanticClusters(minClusterSize = 3) {
        const clusters = [];
        const visited = new Set();
        for (const node of this.nodes?.values()) {
            if (visited?.has(node.id))
                continue;
            const cluster = await this?.expandSemanticCluster(node.id, visited);
            if (cluster.nodes?.length >= minClusterSize) {
                clusters?.push(cluster);
            }
        }
        return clusters;
    }
    async detectArchitecturalInsights() {
        const insights = [];
        // Detect design patterns
        insights?.push(...await this?.detectDesignPatterns());
        // Detect anti-patterns
        insights?.push(...await this?.detectAntiPatterns());
        // Detect coupling issues
        insights?.push(...await this?.detectCouplingIssues());
        // Detect refactoring opportunities
        insights?.push(...await this?.detectRefactoringOpportunities());
        return insights;
    }
    // Graph Operations
    async mutateGraph(mutation) {
        if (mutation.addNodes) {
            for (const node of mutation.addNodes) {
                await this?.addNode(node);
            }
        }
        if (mutation.addTriads) {
            for (const triad of mutation.addTriads) {
                await this?.addTriad(triad);
            }
        }
        if (mutation.removeNodes) {
            for (const nodeId of mutation.removeNodes) {
                await this?.removeNode(nodeId);
            }
        }
        if (mutation.removeTriads) {
            for (const triadId of mutation.removeTriads) {
                await this?.removeTriad(triadId);
            }
        }
        // Handle updates
        if (mutation.updateNodes) {
            for (const update of mutation.updateNodes) {
                if (update.id) {
                    await this?.updateNode(update.id, update);
                }
            }
        }
        if (mutation.updateTriads) {
            for (const update of mutation.updateTriads) {
                if (update.id) {
                    await this?.updateTriad(update.id, update);
                }
            }
        }
    }
    // Private Helper Methods
    generateNodeId(type, name, namespace) {
        const key = `${type}:${namespace || ''}:${name}`;
        return crypto?.createHash('sha256').update(key).digest('hex').substring(0, 16);
    }
    generateTriadId(subject, predicate, object) {
        const key = `${subject}:${predicate}:${object}`;
        return crypto?.createHash('sha256').update(key).digest('hex').substring(0, 16);
    }
    matchesMetadata(nodeMetadata, queryMetadata) {
        return Object.entries(queryMetadata).every(([key, value]) => {
            return nodeMetadata[key] === value;
        });
    }
    matchesNodeFilter(node, filters) {
        if (!filters)
            return true;
        if (filters.types && !filters.types?.includes(node.type))
            return false;
        if (filters.names && !filters.names?.some((name) => node.name?.includes(name)))
            return false;
        if (filters.namespaces && node.namespace && !filters.namespaces?.includes(node.namespace))
            return false;
        return true;
    }
    async calculateCentralityScores() {
        const scores = {};
        const damping = 0.85;
        const iterations = 100;
        // Initialize scores
        for (const nodeId of this.nodes?.keys()) {
            scores[nodeId] = 1.0;
        }
        // PageRank-like algorithm
        for (let i = 0; i < iterations; i++) {
            const newScores = {};
            for (const nodeId of this.nodes?.keys()) {
                let score = (1 - damping);
                // Find incoming edges
                const incomingTriads = Array.from(this.triads?.values())
                    .filter(triad => triad?.object === nodeId);
                for (const triad of incomingTriads) {
                    const sourceNode = triad.subject;
                    const outDegree = Array.from(this.triads?.values())
                        .filter(t => t?.subject === sourceNode).length;
                    if (outDegree > 0) {
                        score += damping * (scores[sourceNode] / outDegree);
                    }
                }
                newScores[nodeId] = score;
            }
            Object.assign(scores, newScores);
        }
        return scores;
    }
    async findStronglyConnectedComponents() {
        // Simplified SCC detection using DFS
        const visited = new Set();
        const components = [];
        for (const nodeId of this.nodes?.keys()) {
            if (!visited?.has(nodeId)) {
                const component = await this?.dfsComponent(nodeId, visited);
                if (component?.length > 1) {
                    components?.push(component);
                }
            }
        }
        return components;
    }
    async dfsComponent(startNode, visited) {
        const component = [];
        const stack = [startNode];
        while (stack?.length > 0) {
            const nodeId = stack?.pop();
            if (visited?.has(nodeId))
                continue;
            visited?.add(nodeId);
            component?.push(nodeId);
            // Find connected nodes
            const connectedTriads = Array.from(this.triads?.values())
                .filter(triad => triad?.subject === nodeId || triad?.object === nodeId);
            for (const triad of connectedTriads) {
                const connectedNode = triad?.subject === nodeId ? triad.object : triad.subject;
                if (!visited?.has(connectedNode)) {
                    stack?.push(connectedNode);
                }
            }
        }
        return component;
    }
    calculateClusteringCoefficient() {
        let totalCoefficient = 0;
        let nodeCount = 0;
        for (const nodeId of this.nodes?.keys()) {
            const neighbors = this?.getNeighbors(nodeId);
            if (neighbors?.length < 2)
                continue;
            let edgeCount = 0;
            const maxEdges = neighbors?.length * (neighbors?.length - 1) / 2;
            for (let i = 0; i < neighbors?.length; i++) {
                for (let j = i + 1; j < neighbors?.length; j++) {
                    if (this?.hasConnection(neighbors[i], neighbors[j])) {
                        edgeCount++;
                    }
                }
            }
            totalCoefficient += edgeCount / maxEdges;
            nodeCount++;
        }
        return nodeCount > 0 ? totalCoefficient / nodeCount : 0;
    }
    getNeighbors(nodeId) {
        const neighbors = new Set();
        for (const triad of this.triads?.values()) {
            if (triad?.subject === nodeId) {
                neighbors?.add(triad.object);
            }
            else if (triad?.object === nodeId) {
                neighbors?.add(triad.subject);
            }
        }
        return Array.from(neighbors);
    }
    hasConnection(node1, node2) {
        return Array.from(this.triads?.values()).some(triad => (triad?.subject === node1 && triad?.object === node2) ||
            (triad?.subject === node2 && triad?.object === node1));
    }
    async expandSemanticCluster(startNodeId, visited) {
        const clusterNodes = new Set();
        const representativeTriads = [];
        const queue = [startNodeId];
        while (queue?.length > 0) {
            const nodeId = queue?.shift();
            if (visited?.has(nodeId))
                continue;
            visited?.add(nodeId);
            clusterNodes?.add(nodeId);
            // Find semantically similar nodes
            const similarTriads = Array.from(this.triads?.values()).filter(triad => (triad?.subject === nodeId && triad?.predicate === types_1.RelationType.IS_SIMILAR_TO) ||
                (triad?.object === nodeId && triad?.predicate === types_1.RelationType.IS_SIMILAR_TO) ||
                (triad?.subject === nodeId && triad?.predicate === types_1.RelationType.IS_TYPE_OF) ||
                (triad?.object === nodeId && triad?.predicate === types_1.RelationType.IS_TYPE_OF));
            for (const triad of similarTriads) {
                representativeTriads?.push(triad);
                const relatedNode = triad?.subject === nodeId ? triad.object : triad.subject;
                if (!visited?.has(relatedNode)) {
                    queue?.push(relatedNode);
                }
            }
        }
        const coherenceScore = this?.calculateClusterCoherence(Array.from(clusterNodes));
        return {
            id: this?.generateNodeId(types_1.NodeType.CONCEPT, `cluster_${startNodeId}`, 'semantic'),
            name: `Semantic Cluster ${startNodeId}`,
            nodes: Array.from(clusterNodes),
            coherenceScore,
            representativeTriads
        };
    }
    calculateClusterCoherence(nodes) {
        if (nodes?.length < 2)
            return 1.0;
        let totalConnections = 0;
        let possibleConnections = nodes?.length * (nodes?.length - 1) / 2;
        for (let i = 0; i < nodes?.length; i++) {
            for (let j = i + 1; j < nodes?.length; j++) {
                if (this?.hasConnection(nodes[i], nodes[j])) {
                    totalConnections++;
                }
            }
        }
        return possibleConnections > 0 ? totalConnections / possibleConnections : 0;
    }
    async detectDesignPatterns() {
        // Simplified pattern detection - would be more sophisticated in practice
        const insights = [];
        // Look for Singleton pattern
        const singletons = Array.from(this.nodes?.values()).filter(node => node?.type === types_1.NodeType.CLASS &&
            node.metadata.tags?.includes('singleton'));
        if (singletons?.length > 0) {
            insights?.push({
                type: 'design_pattern_detected',
                confidence: 0.8,
                description: 'Singleton pattern detected',
                affectedNodes: singletons?.map(s => s.id),
                recommendations: ['Ensure thread safety', 'Consider dependency injection'],
                evidence: [{
                        type: types_1.EvidenceType.STATIC_ANALYSIS,
                        source: 'pattern_detector',
                        confidence: 0.8,
                        description: 'Static analysis detected singleton pattern characteristics'
                    }]
            });
        }
        return insights;
    }
    async detectAntiPatterns() {
        const insights = [];
        // Detect God Class anti-pattern
        const godClasses = Array.from(this.nodes?.values()).filter(node => node?.type === types_1.NodeType.CLASS &&
            (node.metadata.complexity || 0) > 50);
        for (const godClass of godClasses) {
            insights?.push({
                type: 'anti_pattern_detected',
                confidence: 0.7,
                description: `God Class detected: ${godClass.name}`,
                affectedNodes: [godClass.id],
                recommendations: ['Break into smaller, focused classes', 'Apply Single Responsibility Principle'],
                evidence: [{
                        type: types_1.EvidenceType.STATIC_ANALYSIS,
                        source: 'complexity_analyzer',
                        confidence: 0.7,
                        description: `High complexity score: ${godClass.metadata.complexity}`
                    }]
            });
        }
        return insights;
    }
    async detectCouplingIssues() {
        const insights = [];
        // Find nodes with high coupling (many dependencies)
        for (const nodeId of this.nodes?.keys()) {
            const dependencyTriads = Array.from(this.triads?.values())
                .filter(triad => triad?.subject === nodeId && triad?.predicate === types_1.RelationType.DEPENDS_ON);
            if (dependencyTriads?.length > 10) {
                insights?.push({
                    type: 'coupling_issue',
                    confidence: 0.6,
                    description: `High coupling detected in ${this.nodes?.get(nodeId)?.name}`,
                    affectedNodes: [nodeId],
                    recommendations: ['Reduce dependencies', 'Apply dependency inversion', 'Use interfaces'],
                    evidence: [{
                            type: types_1.EvidenceType.STATIC_ANALYSIS,
                            source: 'dependency_analyzer',
                            confidence: 0.6,
                            description: `${dependencyTriads?.length} dependencies detected`
                        }]
                });
            }
        }
        return insights;
    }
    async detectRefactoringOpportunities() {
        const insights = [];
        // Find duplicate code patterns
        const duplicateTriads = Array.from(this.triads?.values())
            .filter(triad => triad?.predicate === types_1.RelationType.DUPLICATES);
        if (duplicateTriads?.length > 0) {
            const duplicateGroups = this?.groupDuplicates(duplicateTriads);
            for (const group of duplicateGroups) {
                insights?.push({
                    type: 'refactoring_opportunity',
                    confidence: 0.8,
                    description: 'Duplicate code detected - consider extracting common functionality',
                    affectedNodes: group,
                    recommendations: ['Extract method', 'Create shared utility', 'Apply DRY principle'],
                    evidence: [{
                            type: types_1.EvidenceType.PATTERN_MATCHING,
                            source: 'duplication_detector',
                            confidence: 0.8,
                            description: `${group?.length} nodes contain duplicate logic`
                        }]
                });
            }
        }
        return insights;
    }
    groupDuplicates(duplicateTriads) {
        const groups = [];
        const processed = new Set();
        for (const triad of duplicateTriads) {
            if (processed?.has(triad.id))
                continue;
            const group = [triad.subject, triad.object];
            processed?.add(triad.id);
            // Find transitively connected duplicates
            const relatedTriads = duplicateTriads?.filter(t => !processed?.has(t.id) &&
                (group?.includes(t.subject) || group?.includes(t.object)));
            for (const related of relatedTriads) {
                if (!group?.includes(related.subject))
                    group?.push(related.subject);
                if (!group?.includes(related.object))
                    group?.push(related.object);
                processed?.add(related.id);
            }
            groups?.push(group);
        }
        return groups;
    }
    async removeNode(nodeId) {
        this.nodes?.delete(nodeId);
        // Remove from indexes
        for (const nodeSet of this.nodeIndex?.values()) {
            nodeSet?.delete(nodeId);
        }
        // Remove related triads
        const relatedTriads = Array.from(this.triads?.values())
            .filter(triad => triad?.subject === nodeId || triad?.object === nodeId);
        for (const triad of relatedTriads) {
            await this?.removeTriad(triad.id);
        }
        if (this.db) {
            try {
                await this.db?.query('DELETE FROM knowledge_nodes WHERE id = $1', [nodeId]);
            }
            catch (error) {
                this.logger.error('Failed to remove node from database', error);
            }
        }
    }
    async removeTriad(triadId) {
        const triad = this.triads?.get(triadId);
        if (triad) {
            this.triads?.delete(triadId);
            this.relationIndex?.get(triad.predicate)?.delete(triadId);
            if (this.db) {
                try {
                    await this.db?.query('DELETE FROM knowledge_triads WHERE id = $1', [triadId]);
                }
                catch (error) {
                    this.logger.error('Failed to remove triad from database', error);
                }
            }
        }
    }
    async updateNode(nodeId, updates) {
        const node = this.nodes?.get(nodeId);
        if (node) {
            const updatedNode = { ...node, ...updates, updatedAt: new Date() };
            this.nodes?.set(nodeId, updatedNode);
            if (this.db) {
                try {
                    const setClause = Object.keys(updates)
                        .filter(key => key !== 'id' && key !== 'createdAt')
                        .map((key, index) => `${key} = $${index + 2}`)
                        .join(', ');
                    const values = [nodeId, ...Object.values(updates).filter((_, index) => Object.keys(updates)[index] !== 'id' && Object.keys(updates)[index] !== 'createdAt')];
                    await this.db?.query(`UPDATE knowledge_nodes SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, values);
                }
                catch (error) {
                    this.logger.error('Failed to update node in database', error);
                }
            }
        }
    }
    async updateTriad(triadId, updates) {
        const triad = this.triads?.get(triadId);
        if (triad) {
            const updatedTriad = { ...triad, ...updates };
            this.triads?.set(triadId, updatedTriad);
            if (this.db) {
                try {
                    const setClause = Object.keys(updates)
                        .filter(key => key !== 'id' && key !== 'createdAt')
                        .map((key, index) => `${key} = $${index + 2}`)
                        .join(', ');
                    const values = [triadId, ...Object.values(updates).filter((_, index) => Object.keys(updates)[index] !== 'id' && Object.keys(updates)[index] !== 'createdAt')];
                    await this.db?.query(`UPDATE knowledge_triads SET ${setClause} WHERE id = $1`, values);
                }
                catch (error) {
                    this.logger.error('Failed to update triad in database', error);
                }
            }
        }
    }
    // Public utility methods
    async getNodeCount() {
        return this.nodes.size;
    }
    async getTriadCount() {
        return this.triads.size;
    }
    async exportGraph() {
        return {
            nodes: Array.from(this.nodes?.values()),
            triads: Array.from(this.triads?.values())
        };
    }
    async importGraph(data) {
        for (const node of data.nodes) {
            this.nodes?.set(node.id, node);
            this.nodeIndex?.get(node.type)?.add(node.id);
        }
        for (const triad of data.triads) {
            this.triads?.set(triad.id, triad);
            this.relationIndex?.get(triad.predicate)?.add(triad.id);
        }
    }
    // Stub methods for missing functionality - to be implemented
    async findRelationships(nodeType, relationTypes) {
        this.logger.info(`Finding relationships for ${nodeType} with relations: ${relationTypes}`);
        return [];
    }
    async findPatterns(patterns) {
        this.logger.info(`Finding patterns: ${patterns?.join(', ')}`);
        return [];
    }
    async getNodeDependencies(nodeId) {
        this.logger.info(`Getting dependencies for node: ${nodeId}`);
        return [];
    }
    async findSimilarNodes(description, threshold) {
        this.logger.info(`Finding similar nodes for: ${description} with threshold: ${threshold}`);
        return [];
    }
    async getTestDependencies(nodeId) {
        this.logger.info(`Getting test dependencies for node: ${nodeId}`);
        return [];
    }
    async findSimilarTestPatterns(requirements) {
        this.logger.info(`Finding similar test patterns for: ${requirements}`);
        return [];
    }
    async detectArchitecturalPatterns(codebasePath) {
        this.logger.info(`Detecting architectural patterns in: ${codebasePath}`);
        return [];
    }
    async analyzeDependencyGraph(modules) {
        this.logger.info(`Analyzing dependency graph for modules: ${modules?.join(', ')}`);
        return [];
    }
    async findSimilarImplementations(specification) {
        this.logger.info(`Finding similar implementations for: ${specification}`);
        return [];
    }
    async findSecurityRelationships(codeFiles) {
        this.logger.info(`Finding security relationships in files: ${codeFiles?.join(', ')}`);
        return [];
    }
    async getSecurityDependencies(dependencies) {
        this.logger.info(`Getting security dependencies: ${dependencies?.join(', ')}`);
        return [];
    }
    async findSimilarSecurityIssues(vulnerabilityReports) {
        this.logger.info(`Finding similar security issues from reports: ${vulnerabilityReports?.join(', ')}`);
        return [];
    }
    async findPerformanceRelationships(codeFiles) {
        this.logger.info(`Finding performance relationships in files: ${codeFiles?.join(', ')}`);
        return [];
    }
    async getPerformanceDependencies(architecture) {
        this.logger.info(`Getting performance dependencies for architecture: ${architecture}`);
        return [];
    }
    async findSimilarPerformanceIssues(metrics) {
        this.logger.info(`Finding similar performance issues for metrics: ${metrics?.join(', ')}`);
        return [];
    }
    async findQualityRelationships(codeFiles) {
        this.logger.info(`Finding quality relationships in files: ${codeFiles?.join(', ')}`);
        return [];
    }
    async getQualityDependencies(modules) {
        this.logger.info(`Getting quality dependencies for modules: ${modules?.join(', ')}`);
        return [];
    }
    async findSimilarQualityIssues(metrics) {
        this.logger.info(`Finding similar quality issues for metrics: ${metrics?.join(', ')}`);
        return [];
    }
    async query(params) {
        // General query method for backward compatibility
        if (params.type === 'nodes') {
            return this.queryNodes(params);
        }
        else if (params.type === 'triads') {
            return this.queryTriads(params);
        }
        else if (params.type === 'traverse') {
            return this.traverse(params);
        }
        return [];
    }
}
exports.SemanticKnowledgeGraph = SemanticKnowledgeGraph;
exports.KnowledgeGraph = SemanticKnowledgeGraph;
exports.default = SemanticKnowledgeGraph;
//# sourceMappingURL=knowledge-graph.js.map