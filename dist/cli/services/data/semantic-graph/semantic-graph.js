"use strict";
/**
 * Semantic Graph Service (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on service abstractions
 * Coordinates all semantic graph operations using focused services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQueryService = exports.GraphStorageService = exports.FileProcessingService = exports.SemanticGraphService = void 0;
const logger_1 = require("../../../../utils/logger");
const file_processing_service_1 = require("./services/file-processing-service");
const graph_storage_service_1 = require("./services/graph-storage-service");
const graph_query_service_1 = require("./services/graph-query-service");
class SemanticGraphService {
    uri;
    username;
    password;
    fileProcessingService;
    storageService;
    queryService;
    qualityAnalyzer;
    config;
    logger = logger_1.Logger.getInstance();
    initialized = false;
    constructor(uri = 'bolt://localhost:7687', username = 'neo4j', password = 'codemind123', fileProcessingService, storageService, queryService, qualityAnalyzer, config) {
        this.uri = uri;
        this.username = username;
        this.password = password;
        this.fileProcessingService = fileProcessingService;
        this.storageService = storageService;
        this.queryService = queryService;
        this.qualityAnalyzer = qualityAnalyzer;
        this.config = config;
        // Initialize services with dependency injection
        this.storageService = this.storageService || new graph_storage_service_1.GraphStorageService(uri, username, password);
        this.queryService = this.queryService || new graph_query_service_1.GraphQueryService(this.storageService, qualityAnalyzer);
        const fullConfig = {
            useTreeSitter: true,
            useClaudeProxy: true,
            preferTreeSitter: true,
            maxClaudeConcurrency: 3,
            treeSitterLanguages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust'],
            skipLargeFiles: true,
            maxFileSize: 500000,
            ...config
        };
        this.fileProcessingService = this.fileProcessingService || new file_processing_service_1.FileProcessingService(fullConfig, undefined, // TreeSitterProcessor
        undefined, // ClaudeProxyProcessor
        undefined, // FallbackProcessor
        qualityAnalyzer);
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.storageService.initialize();
            await this.ensureIndexes();
            this.initialized = true;
            this.logger.debug('🔗 Semantic graph service initialized');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize semantic graph service:', error);
            throw error;
        }
    }
    async close() {
        if (!this.initialized)
            return;
        try {
            await this.storageService.close();
            this.initialized = false;
            this.logger.debug('🔗 Semantic graph service closed');
        }
        catch (error) {
            this.logger.error('Failed to close semantic graph service:', error);
        }
    }
    // File Processing Operations (delegated to FileProcessingService)
    async buildGraphFromFiles(files) {
        await this.ensureInitialized();
        return this.fileProcessingService.buildGraphFromFiles(files);
    }
    // Storage Operations (delegated to GraphStorageService)
    async addNode(type, properties) {
        await this.ensureInitialized();
        return this.storageService.addNode(type, properties);
    }
    async addRelationship(fromId, toId, type, properties) {
        await this.ensureInitialized();
        return this.storageService.addRelationship(fromId, toId, type, properties);
    }
    async batchCreateNodes(nodes) {
        await this.ensureInitialized();
        return this.storageService.batchCreateNodes(nodes);
    }
    // Query Operations (delegated to GraphQueryService)
    async searchNodes(query, context) {
        await this.ensureInitialized();
        return this.queryService.searchNodes(query, context);
    }
    async findRelatedNodes(nodeId, maxDepth) {
        await this.ensureInitialized();
        return this.queryService.findRelatedNodes(nodeId, maxDepth);
    }
    async findPathBetweenNodes(fromId, toId) {
        await this.ensureInitialized();
        return this.queryService.findPathBetweenNodes(fromId, toId);
    }
    async getNodesByType(type) {
        await this.ensureInitialized();
        return this.queryService.getNodesByType(type);
    }
    async analyzeImpact(nodeId) {
        await this.ensureInitialized();
        return this.queryService.analyzeImpact(nodeId);
    }
    async performCrossReference(concept) {
        await this.ensureInitialized();
        return this.queryService.performCrossReference(concept);
    }
    // Advanced Operations
    async findBusinessConcepts() {
        await this.ensureInitialized();
        return this.queryService.findBusinessConcepts();
    }
    async getGraphStatistics() {
        await this.ensureInitialized();
        return this.queryService.getGraphStatistics();
    }
    // Utility Operations
    async clearGraph() {
        await this.ensureInitialized();
        return this.storageService.clearGraph();
    }
    // Index Management
    async ensureIndexes() {
        // This would ensure proper Neo4j indexes exist
        // Placeholder for index creation logic
        this.logger.debug('📊 Ensuring graph indexes...');
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    // Factory Methods for Testing and Dependency Injection
    static createWithServices(fileProcessingService, storageService, queryService, qualityAnalyzer) {
        return new SemanticGraphService('bolt://localhost:7687', 'neo4j', 'codemind123', fileProcessingService, storageService, queryService, qualityAnalyzer);
    }
    static createDefault(uri, username, password, config) {
        return new SemanticGraphService(uri, username, password, undefined, undefined, undefined, undefined, config);
    }
    // Backward Compatibility Methods (Legacy API support)
    async filterFiles(files) {
        return this.fileProcessingService.filterFiles(files);
    }
    async categorizeFiles(files) {
        return this.fileProcessingService.categorizeFiles(files);
    }
    calculateRelevanceScore(node, keywords) {
        return this.queryService.calculateRelevanceScore(node, keywords);
    }
    // Missing methods needed for MVP build compatibility
    async semanticSearch(query, context) {
        if (!this.queryService) {
            this.logger.warn('Query service not initialized for semantic search');
            return [];
        }
        return this.queryService.performSemanticSearch(query, context);
    }
    async findCrossReferences(nodeId) {
        if (!this.queryService) {
            this.logger.warn('Query service not initialized for cross-reference search');
            return [];
        }
        return this.queryService.findCrossReferences(nodeId);
    }
}
exports.SemanticGraphService = SemanticGraphService;
exports.default = SemanticGraphService;
// Re-export service classes for advanced usage
var file_processing_service_2 = require("./services/file-processing-service");
Object.defineProperty(exports, "FileProcessingService", { enumerable: true, get: function () { return file_processing_service_2.FileProcessingService; } });
var graph_storage_service_2 = require("./services/graph-storage-service");
Object.defineProperty(exports, "GraphStorageService", { enumerable: true, get: function () { return graph_storage_service_2.GraphStorageService; } });
var graph_query_service_2 = require("./services/graph-query-service");
Object.defineProperty(exports, "GraphQueryService", { enumerable: true, get: function () { return graph_query_service_2.GraphQueryService; } });
//# sourceMappingURL=semantic-graph.js.map