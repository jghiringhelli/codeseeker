"use strict";
/**
 * Intelligent Task Orchestrator
 * Manages three-phase discovery and splits work into context-window-optimized tasks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentTaskOrchestrator = void 0;
const hybrid_file_discovery_1 = require("../shared/hybrid-file-discovery");
const semantic_graph_1 = require("../cli/services/data/semantic-graph/semantic-graph");
const navigator_1 = require("../cli/features/tree-navigation/navigator");
const logger_1 = require("../utils/logger");
class IntelligentTaskOrchestrator {
    fileDiscovery;
    semanticGraph;
    treeNavigator;
    logger = logger_1.Logger.getInstance();
    initialized = false;
    retryAttempts = 3;
    retryDelay = 1000; // 1 second
    constructor() {
        this.fileDiscovery = new hybrid_file_discovery_1.HybridFileDiscovery();
        this.semanticGraph = new semantic_graph_1.SemanticGraphService();
        this.treeNavigator = new navigator_1.TreeNavigator();
    }
    async initialize() {
        if (this.initialized)
            return;
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                this.logger.info(`🔄 Initializing orchestrator (attempt ${attempt}/${this.retryAttempts})`);
                // Initialize with timeout and individual error handling
                const initPromises = [
                    this.safeInitialize('FileDiscovery', () => this.fileDiscovery.initialize()),
                    this.safeInitialize('SemanticGraph', () => this.semanticGraph.initialize())
                ];
                const results = await Promise.allSettled(initPromises);
                // Check if any critical services failed
                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length > 0) {
                    throw new Error(`Failed to initialize: ${failed.map((r) => r.reason).join(', ')}`);
                }
                this.initialized = true;
                this.logger.info('🎯 Intelligent Task Orchestrator initialized successfully');
                return;
            }
            catch (error) {
                lastError = error;
                this.logger.warn(`⚠️ Initialization attempt ${attempt} failed: ${error}`);
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt); // Exponential backoff
                }
            }
        }
        throw new Error(`Failed to initialize after ${this.retryAttempts} attempts: ${lastError?.message}`);
    }
    async safeInitialize(serviceName, initFn) {
        try {
            await Promise.race([
                initFn(),
                this.timeout(10000, `${serviceName} initialization timeout`)
            ]);
            this.logger.info(`✅ ${serviceName} initialized`);
        }
        catch (error) {
            this.logger.error(`❌ ${serviceName} initialization failed: ${error}`);
            throw error;
        }
    }
    timeout(ms, message) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Safe execution wrapper with fallback and retry logic
     */
    async safeExecute(operationName, operation, fallback, maxRetries = 2) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.info(`🔄 Executing ${operationName} (attempt ${attempt}/${maxRetries})`);
                const result = await Promise.race([
                    operation(),
                    this.timeout(30000, `${operationName} timeout after 30 seconds`)
                ]);
                this.logger.info(`✅ ${operationName} completed successfully`);
                return result;
            }
            catch (error) {
                lastError = error;
                this.logger.warn(`⚠️ ${operationName} attempt ${attempt} failed: ${error}`);
                if (attempt < maxRetries) {
                    await this.delay(1000 * attempt); // Progressive delay
                }
            }
        }
        this.logger.error(`❌ ${operationName} failed after ${maxRetries} attempts, using fallback`);
        return fallback;
    }
    /**
     * Fallback for semantic discovery when service is unavailable
     */
    getFallbackSemanticDiscovery(request) {
        this.logger.warn('🔄 Using fallback semantic discovery (file system scan)');
        return {
            primaryFiles: [],
            relatedFiles: [],
            discoveryMethod: 'fallback-filesystem',
            confidence: 0.1
        };
    }
    /**
     * Fallback for graph impact analysis
     */
    getFallbackGraphImpact(semanticDiscovery, request) {
        this.logger.warn('🔄 Using fallback graph impact analysis');
        return {
            relationships: [],
            allFiles: semanticDiscovery?.primaryFiles || [],
            confidence: 0.1
        };
    }
    /**
     * Fallback for tree structure analysis
     */
    getFallbackTreeStructure(files, request) {
        this.logger.warn('🔄 Using fallback tree structure analysis');
        return files.map((file) => ({
            filePath: file.filePath || file,
            codeElements: []
        }));
    }
    /**
     * Main orchestration flow: Three-phase discovery + task splitting
     */
    async orchestrateRequest(request) {
        const startTime = Date.now();
        this.logger.info(`🎯 Orchestrating: "${request.userQuery}"`);
        try {
            // Phase 1: Semantic Search - Find relevant files by content similarity
            this.logger.info('🔍 Phase 1: Semantic file discovery');
            const semanticDiscovery = await this.performSemanticDiscovery(request);
            // Phase 2: Semantic Graph - Map relationships and impact analysis
            this.logger.info('🔗 Phase 2: Semantic graph relationship mapping');
            const graphImpact = await this.performGraphImpactAnalysis(semanticDiscovery, request);
            // Phase 3: Tree Traversal - Analyze code structure within discovered files
            this.logger.info('🌳 Phase 3: Tree structure analysis');
            const treeStructure = await this.performTreeAnalysis(graphImpact.allFiles, request);
            // Combine discovery results
            const discoveredImpact = {
                semanticFiles: semanticDiscovery.primaryFiles.concat(semanticDiscovery.relatedFiles).map(f => ({
                    filePath: f.filePath,
                    relevanceScore: f.relevanceScore
                })),
                graphRelationships: graphImpact.relationships,
                treeStructure: treeStructure,
                impactAreas: await this.categorizeImpactAreas(graphImpact.allFiles)
            };
            // Phase 4: Task Orchestration - Split into manageable tasks
            this.logger.info('📋 Phase 4: Task orchestration and splitting');
            const orchestratedTasks = await this.createOrchestrationTasks(discoveredImpact, request);
            // Phase 5: Execution Planning
            const executionPlan = await this.createExecutionPlan(orchestratedTasks);
            const result = {
                request,
                discoveredImpact,
                orchestratedTasks,
                executionPlan
            };
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Orchestration completed in ${duration}ms: ${orchestratedTasks.length} tasks across ${Object.keys(discoveredImpact.impactAreas).length} areas`);
            return result;
        }
        catch (error) {
            this.logger.error(`❌ Orchestration failed: ${error}`);
            throw error;
        }
    }
    /**
     * Phase 1: Semantic file discovery using vector search
     */
    async performSemanticDiscovery(request) {
        return await this.fileDiscovery.discoverFiles({
            query: request.userQuery,
            projectPath: request.projectPath,
            projectId: request.projectId,
            intent: this.mapUserIntentToDiscoveryIntent(request.userIntent),
            maxFiles: 30, // Allow more files for comprehensive analysis
            includeRelated: true
        });
    }
    /**
     * Phase 2: Semantic graph impact analysis
     */
    async performGraphImpactAnalysis(semanticFiles, request) {
        const allFiles = new Set();
        const relationships = [];
        // Add semantic discovery files
        semanticFiles.primaryFiles.concat(semanticFiles.relatedFiles).forEach(f => {
            allFiles.add(f.filePath);
        });
        // For each discovered file, get its graph relationships
        for (const file of allFiles) {
            try {
                // Find graph nodes for this file
                const graphNodes = await this.findGraphNodesForFile(file);
                for (const node of graphNodes) {
                    // Get related nodes based on relationship types
                    const relatedNodes = await this.semanticGraph.findRelatedNodes(node.id, 3);
                    for (const relatedNode of relatedNodes) {
                        const relatedFile = relatedNode.properties.path || relatedNode.properties.file_path;
                        if (relatedFile) {
                            allFiles.add(relatedFile);
                            relationships.push({
                                filePath: relatedFile,
                                relationshipType: 'RELATED_TO', // Could be more specific based on graph data
                                impactLevel: this.determineImpactLevel(file, relatedFile)
                            });
                        }
                    }
                }
            }
            catch (error) {
                this.logger.warn(`Graph analysis failed for ${file}: ${error}`);
            }
        }
        return {
            relationships,
            allFiles: Array.from(allFiles)
        };
    }
    /**
     * Phase 3: Tree structure analysis
     */
    async performTreeAnalysis(discoveredFiles, request) {
        const treeResults = [];
        for (const filePath of discoveredFiles) {
            try {
                // Use tree navigator to analyze code structure
                const analysis = await this.treeNavigator.performAnalysis({
                    projectPath: request.projectPath,
                    maxDepth: 2
                });
                if (analysis.relevantFiles.length > 0) {
                    treeResults.push({
                        filePath,
                        codeElements: this.extractCodeElements(analysis)
                    });
                }
            }
            catch (error) {
                this.logger.warn(`Tree analysis failed for ${filePath}: ${error}`);
            }
        }
        return treeResults;
    }
    /**
     * Categorize files by impact area (core, data, api, ui, test, etc.)
     */
    async categorizeImpactAreas(files) {
        const areas = {
            coreLogic: [],
            dataLayer: [],
            apiLayer: [],
            uiLayer: [],
            testLayer: [],
            configLayer: [],
            deploymentLayer: [],
            documentationLayer: []
        };
        files.forEach(file => {
            const lowerFile = file.toLowerCase();
            // Pattern-based categorization
            if (lowerFile.includes('test') || lowerFile.includes('spec')) {
                areas.testLayer.push(file);
            }
            else if (lowerFile.includes('schema') || lowerFile.includes('migration') || lowerFile.endsWith('.sql')) {
                areas.dataLayer.push(file);
            }
            else if (lowerFile.includes('api') || lowerFile.includes('route') || lowerFile.includes('controller')) {
                areas.apiLayer.push(file);
            }
            else if (lowerFile.includes('component') || lowerFile.includes('view') || lowerFile.includes('.tsx') || lowerFile.includes('.jsx')) {
                areas.uiLayer.push(file);
            }
            else if (lowerFile.includes('config') || lowerFile.includes('.json') || lowerFile.includes('.yml') || lowerFile.includes('.env')) {
                areas.configLayer.push(file);
            }
            else if (lowerFile.includes('docker') || lowerFile.includes('deploy') || lowerFile.includes('ci') || lowerFile.includes('.yml')) {
                areas.deploymentLayer.push(file);
            }
            else if (lowerFile.includes('doc') || lowerFile.endsWith('.md') || lowerFile.includes('readme')) {
                areas.documentationLayer.push(file);
            }
            else {
                areas.coreLogic.push(file);
            }
        });
        return areas;
    }
    /**
     * Create orchestrated tasks split by context window and dependencies
     */
    async createOrchestrationTasks(impact, request) {
        const tasks = [];
        const maxTokens = request.maxContextTokens || 8000;
        // Task 1: Core Logic Updates
        if (impact.impactAreas.coreLogic.length > 0) {
            tasks.push(await this.createTask({
                id: 'core-logic-updates',
                title: 'Update Core Business Logic',
                description: `Implement core changes for: ${request.userQuery}`,
                category: 'core-logic',
                priority: 10,
                files: impact.impactAreas.coreLogic,
                maxTokens,
                request
            }));
        }
        // Task 2: Data Layer Updates (depends on core logic)
        if (impact.impactAreas.dataLayer.length > 0) {
            tasks.push(await this.createTask({
                id: 'data-layer-updates',
                title: 'Update Database Schema and Migrations',
                description: 'Update database structures to support the new functionality',
                category: 'data-layer',
                priority: 9,
                files: impact.impactAreas.dataLayer,
                dependencies: ['core-logic-updates'],
                maxTokens,
                request
            }));
        }
        // Task 3: API Layer Updates (depends on core logic and data layer)
        if (impact.impactAreas.apiLayer.length > 0) {
            tasks.push(await this.createTask({
                id: 'api-layer-updates',
                title: 'Update API Endpoints and Controllers',
                description: 'Modify API layer to expose new functionality',
                category: 'api-layer',
                priority: 8,
                files: impact.impactAreas.apiLayer,
                dependencies: ['core-logic-updates', 'data-layer-updates'],
                maxTokens,
                request
            }));
        }
        // Task 4: UI Layer Updates (depends on API layer)
        if (impact.impactAreas.uiLayer.length > 0) {
            tasks.push(await this.createTask({
                id: 'ui-layer-updates',
                title: 'Update User Interface Components',
                description: 'Update frontend to support new functionality',
                category: 'ui-layer',
                priority: 7,
                files: impact.impactAreas.uiLayer,
                dependencies: ['api-layer-updates'],
                maxTokens,
                request
            }));
        }
        // Task 5: Test Layer Updates (depends on all code changes)
        if (impact.impactAreas.testLayer.length > 0) {
            tasks.push(await this.createTask({
                id: 'test-layer-updates',
                title: 'Update and Create Tests',
                description: 'Ensure comprehensive test coverage for new functionality',
                category: 'test-layer',
                priority: 6,
                files: impact.impactAreas.testLayer,
                dependencies: ['core-logic-updates', 'data-layer-updates', 'api-layer-updates', 'ui-layer-updates'],
                maxTokens,
                request
            }));
        }
        // Task 6: Configuration Updates
        if (impact.impactAreas.configLayer.length > 0) {
            tasks.push(await this.createTask({
                id: 'config-updates',
                title: 'Update Configuration Files',
                description: 'Update configuration for new functionality',
                category: 'config-layer',
                priority: 5,
                files: impact.impactAreas.configLayer,
                maxTokens,
                request
            }));
        }
        // Task 7: Deployment Updates
        if (impact.impactAreas.deploymentLayer.length > 0) {
            tasks.push(await this.createTask({
                id: 'deployment-updates',
                title: 'Update Deployment and Infrastructure',
                description: 'Update deployment scripts and infrastructure',
                category: 'deployment-layer',
                priority: 4,
                files: impact.impactAreas.deploymentLayer,
                dependencies: ['core-logic-updates', 'data-layer-updates', 'config-updates'],
                maxTokens,
                request
            }));
        }
        // Task 8: Documentation Updates (lowest priority, can run anytime)
        if (impact.impactAreas.documentationLayer.length > 0) {
            tasks.push(await this.createTask({
                id: 'documentation-updates',
                title: 'Update Documentation',
                description: 'Update documentation to reflect changes',
                category: 'documentation-layer',
                priority: 3,
                files: impact.impactAreas.documentationLayer,
                maxTokens,
                request
            }));
        }
        return tasks.filter(task => task !== null);
    }
    // Helper methods...
    mapUserIntentToDiscoveryIntent(intent) {
        const intentMap = {
            'add feature': 'search',
            'refactor': 'refactor',
            'fix bug': 'debug',
            'optimize': 'optimize',
            'security': 'security',
            'test': 'test'
        };
        return intentMap[intent?.toLowerCase()] || 'search';
    }
    async findGraphNodesForFile(filePath) {
        try {
            const results = await this.semanticGraph.semanticSearch(filePath);
            return results.flatMap(r => r.nodes);
        }
        catch (error) {
            return [];
        }
    }
    determineImpactLevel(sourceFile, targetFile) {
        // Simple heuristic - could be enhanced with graph analysis
        return 'indirect';
    }
    extractCodeElements(treeData) {
        // Extract meaningful code elements from tree analysis
        return [];
    }
    async createTask(params) {
        return {
            id: params.id,
            title: params.title,
            description: params.description,
            category: params.category,
            priority: params.priority,
            estimatedTokens: Math.min(params.files.length * 200, params.maxTokens), // Rough estimate
            dependencies: params.dependencies || [],
            targetFiles: params.files.map(filePath => ({
                filePath,
                action: 'modify',
                requiredContext: []
            })),
            toolData: [] // Will be populated with relevant tool analysis
        };
    }
    async createExecutionPlan(tasks) {
        // Simple dependency-based planning
        const parallelizable = [];
        const sequential = [];
        // Group tasks that can run in parallel (no dependencies on each other)
        const independentTasks = tasks.filter(task => task.dependencies.length === 0);
        if (independentTasks.length > 1) {
            parallelizable.push(independentTasks.map(task => task.id));
        }
        // Sequential order based on dependencies
        tasks.sort((a, b) => b.priority - a.priority);
        sequential.push(...tasks.map(task => task.id));
        return {
            totalTasks: tasks.length,
            estimatedDuration: `${Math.ceil(tasks.length * 2)} minutes`,
            parallelizable,
            sequential
        };
    }
    async close() {
        await Promise.all([
            this.fileDiscovery.close(),
            this.semanticGraph.close()
        ]);
    }
}
exports.IntelligentTaskOrchestrator = IntelligentTaskOrchestrator;
//# sourceMappingURL=intelligent-task-orchestrator.js.map