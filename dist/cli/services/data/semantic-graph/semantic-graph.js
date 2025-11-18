"use strict";
/**
 * Consolidated Semantic Graph Service - SOLID Principles Compliant
 * Single Responsibility: Unified semantic graph management with Neo4j and file processing
 * Open/Closed: Extensible through strategy injection for different processors
 * Liskov Substitution: Processors are interchangeable through common interfaces
 * Interface Segregation: Separate interfaces for graph operations and file processing
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticGraphService = exports.FallbackProcessor = exports.ClaudeProxyProcessor = exports.TreeSitterProcessor = void 0;
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const logger_1 = require("../../../../utils/logger");
const tree_sitter_semantic_builder_1 = require("./tree-sitter-semantic-builder");
const claude_code_proxy_1 = require("./claude-code-proxy");
// ============================================
// PROCESSING STRATEGY IMPLEMENTATIONS
// ============================================
class TreeSitterProcessor {
    treeSitterBuilder;
    constructor() {
        this.treeSitterBuilder = new tree_sitter_semantic_builder_1.TreeSitterSemanticBuilder();
    }
    async processFiles(files) {
        if (files.length === 0)
            return null;
        console.log(`🌳 Processing ${files.length} files with Tree-sitter...`);
        try {
            return await this.treeSitterBuilder.buildSemanticGraph(files);
        }
        catch (error) {
            console.warn(`Tree-sitter processing failed: ${error.message}`);
            return null;
        }
    }
}
exports.TreeSitterProcessor = TreeSitterProcessor;
class ClaudeProxyProcessor {
    claudeProxy;
    constructor(claudeProxyCommand) {
        this.claudeProxy = new claude_code_proxy_1.ClaudeCodeProxy(claudeProxyCommand);
    }
    async processFiles(files) {
        if (files.length === 0)
            return null;
        console.log(`🤖 Processing ${files.length} files with Claude Code proxy...`);
        try {
            const results = await this.claudeProxy.analyzeFiles(files);
            return this.convertClaudeResults(results);
        }
        catch (error) {
            console.warn(`Claude proxy processing failed: ${error.message}`);
            return null;
        }
    }
    convertClaudeResults(results) {
        if (!results)
            return null;
        const entities = [];
        const relationships = [];
        const fileNodes = new Map();
        const byLanguage = {};
        for (const [filePath, analysis] of results) {
            if (analysis.entities)
                entities.push(...analysis.entities);
            if (analysis.relationships)
                relationships.push(...analysis.relationships);
        }
        return {
            entities,
            relationships,
            fileNodes,
            stats: {
                totalFiles: results.size,
                totalEntities: entities.length,
                totalRelationships: relationships.length,
                byLanguage,
                processingTime: 0
            }
        };
    }
}
exports.ClaudeProxyProcessor = ClaudeProxyProcessor;
class FallbackProcessor {
    async processFiles(files) {
        if (files.length === 0) {
            return {
                entities: [],
                relationships: [],
                fileNodes: new Map(),
                stats: { totalFiles: 0, totalEntities: 0, totalRelationships: 0, byLanguage: {}, processingTime: 0 }
            };
        }
        console.log(`📄 Creating basic file entities for ${files.length} files...`);
        const entities = files.map((file, index) => ({
            id: `fallback_${index}`,
            name: file.name.replace(file.extension, ''),
            type: 'module',
            filePath: file.path,
            startLine: 1,
            endLine: 1,
            modifiers: [],
            metadata: { processedBy: 'fallback', language: file.language, fileType: file.type }
        }));
        const fileNodes = new Map();
        files.forEach((file, index) => fileNodes.set(file.path, `fallback_${index}`));
        const byLanguage = {};
        files.forEach(file => {
            if (file.language)
                byLanguage[file.language] = (byLanguage[file.language] || 0) + 1;
        });
        return {
            entities, relationships: [], fileNodes,
            stats: { totalFiles: files.length, totalEntities: entities.length, totalRelationships: 0, byLanguage, processingTime: 0 }
        };
    }
}
exports.FallbackProcessor = FallbackProcessor;
class SemanticGraphService {
    driver;
    logger = logger_1.Logger.getInstance();
    // Injected dependencies (SOLID: Dependency Inversion)
    treeSitterProcessor;
    claudeProxyProcessor;
    fallbackProcessor;
    qualityAnalyzer;
    // Configuration
    config;
    constructor(uri = 'bolt://localhost:7687', username = 'neo4j', password = 'codemind123', treeSitterProcessor, claudeProxyProcessor, qualityAnalyzer, config) {
        // Neo4j connection
        this.driver = neo4j_driver_1.default.driver(uri, neo4j_driver_1.default.auth.basic(username, password), {
            disableLosslessIntegers: true
        });
        // Dependency injection with fallbacks (SOLID: Dependency Inversion)
        this.treeSitterProcessor = treeSitterProcessor || new TreeSitterProcessor();
        this.claudeProxyProcessor = claudeProxyProcessor || new ClaudeProxyProcessor();
        this.fallbackProcessor = new FallbackProcessor();
        this.qualityAnalyzer = qualityAnalyzer;
        // Configuration with defaults
        this.config = {
            useTreeSitter: true,
            useClaudeProxy: true,
            preferTreeSitter: true,
            maxClaudeConcurrency: 3,
            treeSitterLanguages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust'],
            skipLargeFiles: true,
            maxFileSize: 500000,
            ...config
        };
    }
    async initialize() {
        try {
            await this.driver.verifyConnectivity();
            this.logger.debug('🔗 Semantic graph connected successfully');
            // Ensure indexes exist
            await this.ensureIndexes();
        }
        catch (error) {
            this.logger.error('❌ Failed to connect to semantic graph:', error);
            throw error;
        }
    }
    async close() {
        await this.driver.close();
    }
    // ============================================
    // INTEGRATED FILE PROCESSING (NEW)
    // ============================================
    /**
     * Build comprehensive semantic graph using optimal strategy for each file
     * SOLID: Single Responsibility - focused on coordinating file processing
     */
    async buildGraphFromFiles(files) {
        console.log('🔄 Starting integrated semantic graph building...');
        const startTime = Date.now();
        // Filter and categorize files
        const processableFiles = this.filterFiles(files);
        const fileCategories = this.categorizeFiles(processableFiles);
        // Process files with optimal strategy (SOLID: Open/Closed - extensible through strategy injection)
        const treeSitterResults = await this.treeSitterProcessor?.processFiles(fileCategories.treeSitter) || null;
        const claudeProxyResults = await this.claudeProxyProcessor?.processFiles(fileCategories.claude) || null;
        const fallbackResults = await this.fallbackProcessor.processFiles(fileCategories.fallback);
        // Merge results
        const integratedResult = await this.mergeProcessingResults(treeSitterResults, claudeProxyResults, fallbackResults, fileCategories);
        // Add processing metrics
        integratedResult.processingStrategy = {
            treeSitterFiles: fileCategories.treeSitter.length,
            claudeProxyFiles: fileCategories.claude.length,
            fallbackFiles: fileCategories.fallback.length,
            totalProcessingTime: Date.now() - startTime
        };
        // Calculate quality metrics (SOLID: Interface Segregation)
        integratedResult.qualityMetrics = this.qualityAnalyzer
            ? this.qualityAnalyzer.calculateQualityMetrics(integratedResult, fileCategories)
            : this.calculateDefaultQualityMetrics(integratedResult, fileCategories);
        console.log(`✅ Integrated semantic graph complete: ${integratedResult.stats.totalEntities} entities, ${integratedResult.stats.totalRelationships} relationships`);
        console.log(`📊 Strategy: ${integratedResult.processingStrategy.treeSitterFiles} Tree-sitter, ${integratedResult.processingStrategy.claudeProxyFiles} Claude, ${integratedResult.processingStrategy.fallbackFiles} fallback`);
        return integratedResult;
    }
    filterFiles(files) {
        return files.filter(file => {
            if (file.type !== 'source')
                return false;
            if (file.size === 0)
                return false;
            if (this.config.skipLargeFiles && file.size > this.config.maxFileSize) {
                console.log(`⚠ Skipping large file: ${file.relativePath} (${Math.round(file.size / 1024)}KB)`);
                return false;
            }
            return true;
        });
    }
    categorizeFiles(files) {
        const treeSitter = [];
        const claude = [];
        const fallback = [];
        for (const file of files) {
            const language = file.language?.toLowerCase();
            if (this.config.useTreeSitter && this.config.preferTreeSitter && language && this.config.treeSitterLanguages.includes(language)) {
                treeSitter.push(file);
            }
            else if (this.config.useClaudeProxy && this.shouldUseClaudeProxy(file)) {
                claude.push(file);
            }
            else {
                fallback.push(file);
            }
        }
        return { treeSitter, claude, fallback };
    }
    shouldUseClaudeProxy(file) {
        if (!file.language)
            return false;
        const language = file.language.toLowerCase();
        const complexLanguages = ['c++', 'c#', 'swift', 'kotlin', 'scala', 'haskell', 'ocaml'];
        return !this.config.treeSitterLanguages.includes(language) || complexLanguages.includes(language) ||
            file.name.includes('config') || file.extension === '.sql';
    }
    async mergeProcessingResults(treeSitterResults, claudeProxyResults, fallbackResults, fileCategories) {
        const mergedEntities = [...fallbackResults.entities];
        const mergedRelationships = [...fallbackResults.relationships];
        const mergedFileNodes = new Map(fallbackResults.fileNodes);
        const mergedStats = { ...fallbackResults.stats };
        // Merge Tree-sitter results
        if (treeSitterResults) {
            mergedEntities.push(...treeSitterResults.entities);
            mergedRelationships.push(...treeSitterResults.relationships);
            for (const [path, nodeId] of treeSitterResults.fileNodes) {
                mergedFileNodes.set(path, nodeId);
            }
            mergedStats.totalEntities += treeSitterResults.stats.totalEntities;
            mergedStats.totalRelationships += treeSitterResults.stats.totalRelationships;
            for (const [lang, count] of Object.entries(treeSitterResults.stats.byLanguage)) {
                mergedStats.byLanguage[lang] = (mergedStats.byLanguage[lang] || 0) + count;
            }
        }
        // Merge Claude proxy results
        if (claudeProxyResults) {
            mergedEntities.push(...claudeProxyResults.entities);
            mergedRelationships.push(...claudeProxyResults.relationships);
        }
        // Update final stats
        mergedStats.totalFiles = fileCategories.treeSitter.length + fileCategories.claude.length + fileCategories.fallback.length;
        mergedStats.totalEntities = mergedEntities.length;
        mergedStats.totalRelationships = mergedRelationships.length;
        return {
            entities: mergedEntities, relationships: mergedRelationships, fileNodes: mergedFileNodes, stats: mergedStats,
            processingStrategy: { treeSitterFiles: 0, claudeProxyFiles: 0, fallbackFiles: 0, totalProcessingTime: 0 },
            qualityMetrics: { avgConfidence: 0, highConfidenceEntities: 0, crossFileRelationships: 0, languageCoverage: {} }
        };
    }
    calculateDefaultQualityMetrics(result, fileCategories) {
        const confidences = result.entities.map(e => e.metadata?.confidence || 0.7).filter(c => c > 0);
        const avgConfidence = confidences.length > 0 ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;
        const highConfidenceEntities = result.entities.filter(e => (e.metadata?.confidence || 0.7) >= 0.8).length;
        const crossFileRelationships = result.relationships.filter(r => r.sourceFile !== r.targetFile).length;
        const languageCoverage = {};
        fileCategories.treeSitter.forEach((file) => { if (file.language)
            languageCoverage[file.language] = 'tree-sitter'; });
        fileCategories.claude.forEach((file) => { if (file.language)
            languageCoverage[file.language] = 'claude-proxy'; });
        fileCategories.fallback.forEach((file) => { if (file.language)
            languageCoverage[file.language] = 'fallback'; });
        return { avgConfidence, highConfidenceEntities, crossFileRelationships, languageCoverage };
    }
    /**
     * Update configuration at runtime (SOLID: Open/Closed)
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    // ============================================
    // CORE GRAPH OPERATIONS (EXISTING)
    // ============================================
    async addNode(type, properties) {
        const session = this.driver.session();
        try {
            const result = await session.run(`CREATE (n:${type} $properties) RETURN id(n) as nodeId`, { properties: { ...properties, created_at: new Date().toISOString() } });
            const nodeId = result.records[0].get('nodeId').toString();
            this.logger.debug(`Created ${type} node with ID: ${nodeId}`);
            return nodeId;
        }
        finally {
            await session.close();
        }
    }
    async addRelationship(fromId, toId, type, properties = {}) {
        const session = this.driver.session();
        try {
            await session.run(`MATCH (from), (to)
         WHERE id(from) = $fromId AND id(to) = $toId
         CREATE (from)-[r:${type} $properties]->(to)
         RETURN r`, { fromId: parseInt(fromId), toId: parseInt(toId), properties });
            this.logger.debug(`Created ${type} relationship: ${fromId} -> ${toId}`);
        }
        finally {
            await session.close();
        }
    }
    async batchCreateNodes(nodes) {
        const session = this.driver.session();
        try {
            const nodeData = nodes.map(n => ({
                labels: [n.type],
                properties: { ...n.properties, created_at: new Date().toISOString() }
            }));
            const result = await session.run('CALL custom.batchCreateNodes($nodes) YIELD created_count RETURN created_count', { nodes: nodeData });
            const createdCount = result.records[0].get('created_count');
            this.logger.info(`Batch created ${createdCount} nodes`);
            // Return node IDs (would need to modify procedure to return IDs)
            return Array(createdCount).fill(0).map((_, i) => i.toString());
        }
        finally {
            await session.close();
        }
    }
    // ============================================
    // SEMANTIC SEARCH
    // ============================================
    async semanticSearch(query, context = {}) {
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
                limit: neo4j_driver_1.default.int(context.maxDepth || 20)
            });
            return result.records.map(record => {
                const node = this.convertNeo4jNode(record.get('n'));
                const relatedNodesData = record.get('related_nodes');
                const relatedNodes = relatedNodesData.map((rel) => ({
                    node: rel.node ? this.convertNeo4jNode(rel.node) : null,
                    relationship: rel.relationship || 'unknown'
                })).filter(rel => rel.node);
                return {
                    node,
                    relatedNodes,
                    relevanceScore: this.calculateRelevanceScore(node, keywords)
                };
            });
        }
        finally {
            await session.close();
        }
    }
    async findRelated(nodeId, maxDepth = 2, relationshipTypes = []) {
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
                nodeId: neo4j_driver_1.default.int(nodeId)
            });
            const nodes = result.records[0]?.get('related_nodes') || [];
            return nodes.map((node) => this.convertNeo4jNode(node));
        }
        finally {
            await session.close();
        }
    }
    // ============================================
    // IMPACT ANALYSIS
    // ============================================
    async analyzeImpact(nodeId, maxDepth = 3) {
        const session = this.driver.session();
        try {
            // Simple impact analysis using basic traversal
            const result = await session.run(`
        MATCH (start)-[r*1..${maxDepth}]-(related)
        WHERE id(start) = $nodeId
        RETURN collect(DISTINCT related) as nodes,
               collect(DISTINCT r) as relationships
      `, { nodeId: neo4j_driver_1.default.int(nodeId) });
            const record = result.records[0];
            const nodes = (record?.get('nodes') || []).map((node) => this.convertNeo4jNode(node));
            const relationships = (record?.get('relationships') || []).flat().map((rel) => this.convertNeo4jRelationship(rel));
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
        }
        finally {
            await session.close();
        }
    }
    // ============================================
    // CROSS-DOMAIN QUERIES
    // ============================================
    async findCrossReferences(conceptName) {
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
                    concept: null,
                    relatedCode: [],
                    relatedDocs: [],
                    relatedUI: [],
                    relatedTests: []
                };
            }
            return {
                concept: this.convertNeo4jNode(record.get('concept')),
                relatedCode: (record.get('related_code') || []).filter((n) => n).map((node) => this.convertNeo4jNode(node)),
                relatedDocs: (record.get('related_docs') || []).filter((n) => n).map((node) => this.convertNeo4jNode(node)),
                relatedUI: (record.get('related_ui') || []).filter((n) => n).map((node) => this.convertNeo4jNode(node)),
                relatedTests: (record.get('related_tests') || []).filter((n) => n).map((node) => this.convertNeo4jNode(node))
            };
        }
        finally {
            await session.close();
        }
    }
    // ============================================
    // GRAPH STATISTICS
    // ============================================
    async getGraphStatistics() {
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
        }
        finally {
            await session.close();
        }
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    async ensureIndexes() {
        const session = this.driver.session();
        try {
            // Create comprehensive indexes for performance
            const indexCommands = [
                // Basic node indexes
                'CREATE INDEX code_name_index IF NOT EXISTS FOR (c:Code) ON (c.name)',
                'CREATE INDEX code_node_type_index IF NOT EXISTS FOR (c:Code) ON (c.node_type)',
                'CREATE INDEX code_language_index IF NOT EXISTS FOR (c:Code) ON (c.language)',
                'CREATE INDEX code_project_index IF NOT EXISTS FOR (c:Code) ON (c.project_id)',
                'CREATE INDEX code_path_index IF NOT EXISTS FOR (c:Code) ON (c.path)',
                // Method and function specific indexes
                'CREATE INDEX code_parent_class_index IF NOT EXISTS FOR (c:Code) ON (c.parent_class)',
                'CREATE INDEX code_parent_file_index IF NOT EXISTS FOR (c:Code) ON (c.parent_file)',
                'CREATE INDEX code_visibility_index IF NOT EXISTS FOR (c:Code) ON (c.visibility)',
                'CREATE INDEX code_complexity_index IF NOT EXISTS FOR (c:Code) ON (c.complexity)',
                // Documentation and business concept indexes
                'CREATE INDEX doc_title_index IF NOT EXISTS FOR (d:Documentation) ON (d.title)',
                'CREATE INDEX concept_name_index IF NOT EXISTS FOR (bc:BusinessConcept) ON (bc.name)',
                'CREATE INDEX concept_domain_index IF NOT EXISTS FOR (bc:BusinessConcept) ON (bc.domain)',
                // Composite indexes for common queries
                'CREATE INDEX code_class_method_index IF NOT EXISTS FOR (c:Code) ON (c.parent_class, c.name) WHERE c.node_type = "method"',
                'CREATE INDEX code_file_type_index IF NOT EXISTS FOR (c:Code) ON (c.path, c.node_type)'
            ];
            for (const command of indexCommands) {
                try {
                    await session.run(command);
                }
                catch (error) {
                    // Ignore if index already exists
                    if (!error.message?.includes('already exists')) {
                        this.logger.warn(`Index creation warning: ${error.message}`);
                    }
                }
            }
        }
        finally {
            await session.close();
        }
    }
    convertNeo4jNode(node) {
        return {
            id: node.identity.toString(),
            labels: node.labels,
            properties: node.properties
        };
    }
    convertNeo4jRelationship(rel) {
        return {
            id: rel.identity.toString(),
            type: rel.type,
            startNodeId: rel.start.toString(),
            endNodeId: rel.end.toString(),
            properties: rel.properties
        };
    }
    calculateRelevanceScore(node, keywords) {
        let score = 0;
        const name = node.properties.name?.toLowerCase() || '';
        const description = node.properties.description?.toLowerCase() || '';
        keywords.forEach(keyword => {
            if (name.includes(keyword))
                score += 3;
            if (description.includes(keyword))
                score += 2;
            if (node.properties.keywords?.some((k) => k.includes(keyword)))
                score += 1;
        });
        return Math.min(score / keywords.length, 1);
    }
    calculateRiskLevel(impact) {
        const totalImpact = impact.codeFiles + impact.documentation + impact.tests + impact.uiComponents;
        if (totalImpact > 50)
            return 'critical';
        if (totalImpact > 20)
            return 'high';
        if (totalImpact > 10)
            return 'medium';
        return 'low';
    }
    // ============================================
    // PROCESSOR INJECTION METHODS (SOLID: Dependency Inversion)
    // ============================================
    /**
     * Inject custom processors for testing or extension
     */
    setTreeSitterProcessor(processor) {
        this.treeSitterProcessor = processor;
    }
    setClaudeProxyProcessor(processor) {
        this.claudeProxyProcessor = processor;
    }
    setQualityAnalyzer(analyzer) {
        this.qualityAnalyzer = analyzer;
    }
}
exports.SemanticGraphService = SemanticGraphService;
exports.default = SemanticGraphService;
//# sourceMappingURL=semantic-graph.js.map