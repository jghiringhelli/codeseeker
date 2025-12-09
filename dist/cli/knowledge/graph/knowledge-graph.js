"use strict";
/**
 * Semantic Knowledge Graph Implementation - SOLID Principles Compliant
 *
 * Core knowledge graph engine that manages triads (subject-predicate-object)
 * representing semantic relationships between code entities.
 *
 * Follows SOLID principles:
 * - Single Responsibility: Core coordination and facade only
 * - Dependency Inversion: Depends on abstractions through injected services and managers
 * - Open/Closed: Extensible through service and manager interfaces
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeGraph = exports.SemanticKnowledgeGraph = void 0;
const logger_1 = require("../../../utils/logger");
// Service imports
const graph_database_service_1 = require("./services/graph-database-service");
const graph_analyzer_1 = require("./services/graph-analyzer");
const architectural_insight_detector_1 = require("./services/architectural-insight-detector");
const graph_utility_service_1 = require("./services/graph-utility-service");
// Manager imports
const graph_state_manager_1 = require("./managers/graph-state-manager");
const graph_query_manager_1 = require("./managers/graph-query-manager");
const graph_traversal_manager_1 = require("./managers/graph-traversal-manager");
const graph_mutation_manager_1 = require("./managers/graph-mutation-manager");
/**
 * Main Knowledge Graph class - now acts as a coordinator/facade
 * Most functionality is delegated to specialized managers and services
 */
class SemanticKnowledgeGraph {
    projectPath;
    databaseService;
    analyzer;
    insightDetector;
    utilityService;
    stateManager;
    queryManager;
    traversalManager;
    mutationManager;
    logger;
    constructor(projectPath, databaseService, analyzer, insightDetector, utilityService, stateManager, queryManager, traversalManager, mutationManager) {
        this.projectPath = projectPath;
        this.databaseService = databaseService;
        this.analyzer = analyzer;
        this.insightDetector = insightDetector;
        this.utilityService = utilityService;
        this.stateManager = stateManager;
        this.queryManager = queryManager;
        this.traversalManager = traversalManager;
        this.mutationManager = mutationManager;
        this.logger = logger_1.Logger.getInstance().child('KnowledgeGraph');
        // Initialize services with defaults if not provided
        this.databaseService = databaseService || new graph_database_service_1.GraphDatabaseService(projectPath);
        this.analyzer = analyzer || new graph_analyzer_1.GraphAnalyzer();
        this.insightDetector = insightDetector || new architectural_insight_detector_1.ArchitecturalInsightDetector();
        this.utilityService = utilityService || new graph_utility_service_1.GraphUtilityService();
        // Initialize managers with defaults if not provided
        this.stateManager = stateManager || new graph_state_manager_1.GraphStateManager();
        this.queryManager = queryManager || new graph_query_manager_1.GraphQueryManager();
        this.traversalManager = traversalManager || new graph_traversal_manager_1.GraphTraversalManager();
        this.mutationManager = mutationManager || new graph_mutation_manager_1.GraphMutationManager();
        this.initializeGraph();
    }
    async initializeGraph() {
        try {
            // Initialize database
            await this.databaseService.initializeDatabase();
            // Initialize state manager
            this.stateManager.initializeIndexes();
            // Load existing data
            await this.stateManager.loadState(this.databaseService);
            this.logger.debug(`Knowledge graph initialized with ${this.stateManager.getNodeCount()} nodes and ${this.stateManager.getTriadCount()} triads`);
        }
        catch (error) {
            // Don't log error - database service handles its own notification
            this.logger.debug('Knowledge graph running in fallback mode (database unavailable)');
        }
    }
    // Node Management - Delegate to StateManager
    async addNode(node) {
        return this.stateManager.addNode(node, this.utilityService, this.databaseService);
    }
    // Triad Management - Delegate to StateManager
    async addTriad(triad) {
        return this.stateManager.addTriad(triad, this.utilityService, this.databaseService);
    }
    // Query Operations - Delegate to QueryManager
    async queryNodes(query) {
        return this.queryManager.queryNodes(query, this.databaseService, this.stateManager);
    }
    async queryTriads(query) {
        return this.queryManager.queryTriads(query, this.databaseService, this.stateManager);
    }
    // Traversal Operations - Delegate to TraversalManager
    async traverse(query) {
        return this.traversalManager.traverse(query, this.stateManager);
    }
    // Analysis Operations - Delegate to Analyzer Service
    async analyzeGraph() {
        return this.analyzer.analyzeGraph(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    async findSemanticClusters(minClusterSize = 3) {
        return this.analyzer.findSemanticClusters(this.stateManager.getNodes(), this.stateManager.getTriads(), minClusterSize);
    }
    async detectArchitecturalInsights() {
        return this.insightDetector.detectArchitecturalInsights(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    // Mutation Operations - Delegate to MutationManager
    async mutateGraph(mutation) {
        return this.mutationManager.mutateGraph(mutation, this.stateManager, this.databaseService);
    }
    // Convenience methods for common operations
    async findNodeById(id) {
        return this.queryManager.findNodeById(id, this.stateManager);
    }
    async findTriadById(id) {
        return this.queryManager.findTriadById(id, this.stateManager);
    }
    async findNodesByType(type) {
        return this.queryManager.findNodesByType(type, this.stateManager);
    }
    async findTriadsByRelation(relation) {
        return this.queryManager.findTriadsByRelation(relation, this.stateManager);
    }
    async findConnectedNodes(nodeId) {
        return this.queryManager.findConnectedNodes(nodeId, this.stateManager);
    }
    async findShortestPath(startId, endId) {
        return this.queryManager.findShortestPath(startId, endId, this.stateManager);
    }
    // Advanced operations
    async optimizeGraph() {
        return this.mutationManager.optimizeGraph(this.stateManager);
    }
    async validateGraph() {
        return this.stateManager.validateState();
    }
    async getGraphStatistics() {
        return this.queryManager.getQueryStats(this.stateManager);
    }
    // Memory management
    getMemoryUsage() {
        return this.stateManager.getMemoryUsage();
    }
    // Lifecycle management
    async close() {
        if (this.databaseService) {
            await this.databaseService.closeConnection();
            this.logger.info('Knowledge graph services closed');
        }
    }
    // Backward compatibility method for general queries
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
    // Legacy method implementations for backward compatibility
    async removeNode(nodeId) {
        // Find and remove all related triads first
        const relatedTriads = Array.from(this.stateManager.getTriads().values())
            .filter(triad => triad.subject === nodeId || triad.object === nodeId);
        for (const triad of relatedTriads) {
            await this.stateManager.removeTriad(triad.id);
        }
        await this.stateManager.removeNode(nodeId);
        this.logger.debug(`Removed node ${nodeId} and ${relatedTriads.length} related triads`);
    }
    async removeTriad(triadId) {
        await this.stateManager.removeTriad(triadId);
    }
    async updateNode(nodeId, updates) {
        await this.stateManager.updateNode(nodeId, updates);
    }
    async updateTriad(triadId, updates) {
        await this.stateManager.updateTriad(triadId, updates);
    }
    generateNodeId(type, name, namespace) {
        return this.utilityService.generateNodeId(type, name, namespace);
    }
    generateTriadId(subject, predicate, object) {
        return this.utilityService.generateTriadId(subject, predicate, object);
    }
    matchesMetadata(nodeMetadata, queryMetadata) {
        return Object.entries(queryMetadata).every(([key, value]) => {
            return nodeMetadata[key] === value;
        });
    }
    matchesNodeFilter(node, filters) {
        if (!filters)
            return true;
        if (filters.types && !filters.types.includes(node.type))
            return false;
        if (filters.names && !filters.names.some((name) => node.name?.includes(name)))
            return false;
        if (filters.namespaces && node.metadata?.namespace && !filters.namespaces.includes(node.metadata.namespace))
            return false;
        return true;
    }
    async calculateCentralityScores() {
        return this.analyzer.calculateCentralityScores(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    async findStronglyConnectedComponents() {
        return this.analyzer.findStronglyConnectedComponents(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    calculateClusteringCoefficient() {
        return this.utilityService.calculateClusteringCoefficient(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    hasConnection(node1, node2) {
        return this.utilityService.hasConnection(node1, node2, this.stateManager.getTriads());
    }
    async expandSemanticCluster(startNodeId, visited) {
        return this.traversalManager.expandSemanticCluster(startNodeId, visited, this.stateManager, this.utilityService);
    }
    async detectDesignPatterns() {
        return this.insightDetector.detectDesignPatterns(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    async detectAntiPatterns() {
        return this.insightDetector.detectAntiPatterns(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    async detectCouplingIssues() {
        return this.insightDetector.detectCouplingIssues(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    async detectRefactoringOpportunities() {
        return this.insightDetector.detectRefactoringOpportunities(this.stateManager.getNodes(), this.stateManager.getTriads());
    }
    // Additional convenience methods that were in the original
    async findArchitectureComplexity(filePaths) {
        this.logger.info(`Finding architecture complexity for files: ${filePaths.join(', ')}`);
        // This could be implemented using the graph analysis
        const analysis = await this.analyzeGraph();
        return [{
                complexity: analysis.centralityScores,
                distribution: analysis.nodeTypeDistribution
            }];
    }
    async findSemanticRelationships(codeFiles) {
        this.logger.info(`Finding semantic relationships in files: ${codeFiles.join(', ')}`);
        const clusters = await this.findSemanticClusters();
        return clusters.map(cluster => ({
            files: codeFiles,
            relationships: cluster.nodes
        }));
    }
    async findPerformanceRelationships(codeFiles) {
        this.logger.info(`Finding performance relationships in files: ${codeFiles.join(', ')}`);
        return [];
    }
    async getPerformanceDependencies(architecture) {
        this.logger.info(`Getting performance dependencies for architecture: ${architecture}`);
        return [];
    }
    async findSimilarPerformanceIssues(metrics) {
        this.logger.info(`Finding similar performance issues for metrics: ${metrics.join(', ')}`);
        return [];
    }
    async findQualityRelationships(codeFiles) {
        this.logger.info(`Finding quality relationships in files: ${codeFiles.join(', ')}`);
        return [];
    }
    async getQualityDependencies(modules) {
        this.logger.info(`Getting quality dependencies for modules: ${modules.join(', ')}`);
        return [];
    }
    async findSimilarQualityIssues(metrics) {
        this.logger.info(`Finding similar quality issues for metrics: ${metrics.join(', ')}`);
        return [];
    }
}
exports.SemanticKnowledgeGraph = SemanticKnowledgeGraph;
exports.KnowledgeGraph = SemanticKnowledgeGraph;
exports.default = SemanticKnowledgeGraph;
//# sourceMappingURL=knowledge-graph.js.map