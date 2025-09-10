"use strict";
/**
 * Enhanced Tool Interface - Maintains all existing functionality while adding database operations
 * Tools remain auto-discoverable, bundleable, intention-based, and fully functional
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = exports.InternalTool = exports.AnalysisTool = void 0;
const tool_database_api_1 = require("../orchestration/tool-database-api");
const analytics_database_1 = require("./analytics-database");
const tool_config_repository_1 = require("./tool-config-repository");
const analysis_repository_1 = require("./analysis-repository");
const project_intelligence_1 = require("./project-intelligence");
// Enhanced abstract base class that all tools extend
class AnalysisTool {
    // Default values
    bundleCompatible = true;
    dependencies = [];
    performanceImpact = 'medium';
    tokenUsage = 'medium';
    capabilities = {};
    // ============================================
    // CORE ANALYSIS METHODS (Existing functionality)
    // ============================================
    /**
     * Main analysis method - combines database query + live analysis
     */
    async analyze(projectPath, projectId, parameters = {}, fileContext) {
        try {
            // Get tool configuration from MongoDB
            const config = await tool_config_repository_1.toolConfigRepo.getToolConfig(projectId, this.name);
            if (config) {
                parameters = { ...config, ...parameters }; // Parameters override config
            }
            // First, check if we have recent cached data
            const useCache = parameters.useCache !== false;
            let cachedData = null;
            if (useCache) {
                cachedData = await this.queryData(projectId, parameters);
                // If we have recent data and don't need fresh analysis, return it
                if (cachedData && cachedData.length > 0 && !parameters.forceRefresh) {
                    const isRecent = this.isCachedDataRecent(cachedData, parameters.maxAge || 3600000); // 1 hour default
                    if (isRecent) {
                        return {
                            source: 'cached',
                            data: cachedData,
                            analysis: this.processCachedData(cachedData),
                            timestamp: new Date(),
                            fromCache: true
                        };
                    }
                }
            }
            // Record start time for analytics
            const startTime = Date.now();
            // Perform live analysis with file context
            const freshAnalysis = await this.performAnalysis(projectPath, projectId, { ...parameters, fileContext });
            // Calculate execution time
            const executionTime = Date.now() - startTime;
            // Save results to both databases
            if (freshAnalysis && freshAnalysis.data) {
                await this.saveData(projectId, freshAnalysis.data);
                // Store in MongoDB for complex queries
                await analysis_repository_1.analysisRepo.storeAnalysis(projectId, this.name, {
                    ...freshAnalysis,
                    executionTime,
                    parameters
                });
            }
            // Record performance metrics
            await this.recordPerformanceMetric(projectId, executionTime, cachedData ? 0.5 : 0, // Cache hit rate
            process.memoryUsage().heapUsed, { toolVersion: this.version });
            // Learn from execution
            await project_intelligence_1.projectIntelligence.learnFromToolExecution(projectId, this.name, true, executionTime);
            return {
                source: 'live',
                data: freshAnalysis.data,
                analysis: freshAnalysis.analysis,
                recommendations: this.getRecommendations ? this.getRecommendations(freshAnalysis) : [],
                timestamp: new Date(),
                fromCache: false,
                cachedDataAvailable: cachedData && cachedData.length > 0
            };
        }
        catch (error) {
            console.error(`Analysis failed for ${this.name}:`, error);
            // Learn from failure
            await project_intelligence_1.projectIntelligence.learnFromToolExecution(projectId, this.name, false, 0);
            // Fallback to cached data if live analysis fails
            try {
                const fallbackData = await this.queryData(projectId, { limit: 100 });
                if (fallbackData && fallbackData.length > 0) {
                    return {
                        source: 'fallback',
                        data: fallbackData,
                        analysis: this.processCachedData(fallbackData),
                        error: error instanceof Error ? error.message : 'Analysis failed',
                        timestamp: new Date(),
                        fromCache: true
                    };
                }
            }
            catch (fallbackError) {
                console.error(`Fallback query also failed for ${this.name}:`, fallbackError);
            }
            throw error;
        }
    }
    // ============================================
    // DATABASE INTERFACE METHODS (New functionality)
    // ============================================
    /**
     * Query data from database - acts as interface to database API
     */
    async queryData(projectId, filters = {}) {
        try {
            return await tool_database_api_1.toolDB.getToolData(projectId, this.getDatabaseToolName(), filters);
        }
        catch (error) {
            console.error(`Database query failed for ${this.name}:`, error);
            return null;
        }
    }
    /**
     * Save data to database - acts as interface to database API
     */
    async saveData(projectId, data) {
        try {
            return await tool_database_api_1.toolDB.saveToolData(projectId, this.getDatabaseToolName(), data);
        }
        catch (error) {
            console.error(`Database save failed for ${this.name}:`, error);
            throw error;
        }
    }
    /**
     * Update knowledge (existing method, now also updates database)
     */
    async updateKnowledge(projectId, data) {
        try {
            // Perform any tool-specific knowledge update logic
            await this.performKnowledgeUpdate(projectId, data);
            // Update database if we have new insights
            if (data.insights || data.newData) {
                await this.saveData(projectId, data.insights || data.newData);
            }
        }
        catch (error) {
            console.error(`Knowledge update failed for ${this.name}:`, error);
        }
    }
    // ============================================
    // UTILITY METHODS (Default implementations, can be overridden)
    // ============================================
    /**
     * Check if tool is applicable to the project
     */
    isApplicable(projectPath, context) {
        // Default implementation - override for specific logic
        return true;
    }
    /**
     * Generate recommendations from analysis
     */
    getRecommendations(analysisResult) {
        // Default implementation - override for specific recommendations
        return [];
    }
    /**
     * Process cached data into analysis format
     */
    processCachedData(cachedData) {
        return {
            summary: `Found ${cachedData.length} cached entries`,
            items: cachedData,
            processed: true
        };
    }
    /**
     * Check if cached data is recent enough
     */
    isCachedDataRecent(cachedData, maxAge) {
        if (!cachedData || cachedData.length === 0)
            return false;
        const mostRecent = cachedData.reduce((latest, item) => {
            const itemDate = new Date(item.updated_at || item.created_at);
            return itemDate > latest ? itemDate : latest;
        }, new Date(0));
        return (Date.now() - mostRecent.getTime()) <= maxAge;
    }
    // ============================================
    // ANALYTICS INTEGRATION (New functionality)
    // ============================================
    /**
     * Record performance metrics for analytics
     */
    async recordPerformanceMetric(projectId, executionTime, cacheHitRate, memoryUsage, metadata) {
        try {
            const analyticsDb = new analytics_database_1.AnalyticsDatabase(''); // Path will be resolved by analytics system
            await analyticsDb.initialize();
            const metric = {
                project_id: projectId,
                tool_name: this.name,
                execution_time: executionTime,
                cache_hit_rate: cacheHitRate,
                memory_usage: memoryUsage,
                timestamp: new Date(),
                metadata: { ...metadata, tool_version: this.version }
            };
            await analyticsDb.insertPerformanceMetric(metric);
        }
        catch (error) {
            console.warn(`Failed to record performance metric for ${this.name}:`, error);
        }
    }
    /**
     * Record code quality metrics for analytics
     */
    async recordQualityMetric(projectId, filePath, metricType, metricValue, metadata) {
        try {
            const analyticsDb = new analytics_database_1.AnalyticsDatabase('');
            await analyticsDb.initialize();
            const metric = {
                project_id: projectId,
                file_path: filePath,
                metric_type: metricType,
                metric_value: metricValue,
                tool_name: this.name,
                timestamp: new Date(),
                metadata: { ...metadata, tool_version: this.version }
            };
            await analyticsDb.insertCodeQualityMetric(metric);
        }
        catch (error) {
            console.warn(`Failed to record quality metric for ${this.name}:`, error);
        }
    }
    /**
     * Record file change events for analytics
     */
    async recordFileEvent(projectId, filePath, eventType, contentHash, fileSize, metadata) {
        try {
            const analyticsDb = new analytics_database_1.AnalyticsDatabase('');
            await analyticsDb.initialize();
            const event = {
                project_id: projectId,
                file_path: filePath,
                event_type: eventType,
                content_hash: contentHash,
                file_size: fileSize,
                timestamp: new Date(),
                metadata: { ...metadata, tool_name: this.name }
            };
            await analyticsDb.insertFileChangeEvent(event);
        }
        catch (error) {
            console.warn(`Failed to record file event for ${this.name}:`, error);
        }
    }
    /**
     * Perform tool-specific knowledge updates
     */
    async performKnowledgeUpdate(projectId, data) {
        // Default implementation - override for specific logic
    }
    // ============================================
    // EXISTING TOOL REGISTRY COMPATIBILITY
    // ============================================
    /**
     * Get tool metadata for registry
     */
    getMetadata() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            version: this.version,
            category: this.category,
            languages: this.languages,
            frameworks: this.frameworks,
            purposes: this.purposes,
            capabilities: this.capabilities,
            intents: this.intents,
            keywords: this.keywords,
            bundleCompatible: this.bundleCompatible,
            dependencies: this.dependencies,
            performanceImpact: this.performanceImpact,
            tokenUsage: this.tokenUsage
        };
    }
    /**
     * Check if tool matches given intent
     */
    matchesIntent(intent) {
        return this.intents.includes(intent) ||
            this.keywords.some(keyword => intent.toLowerCase().includes(keyword.toLowerCase()));
    }
    /**
     * Check if tool is compatible with project
     */
    isCompatibleWith(projectLanguages, projectFrameworks) {
        const langMatch = this.languages.includes('any') ||
            this.languages.some(lang => projectLanguages.includes(lang));
        const frameworkMatch = this.frameworks.includes('any') ||
            this.frameworks.length === 0 ||
            this.frameworks.some(fw => projectFrameworks.includes(fw));
        return langMatch && frameworkMatch;
    }
}
exports.AnalysisTool = AnalysisTool;
// Base class for internal tools (backwards compatibility)
class InternalTool {
}
exports.InternalTool = InternalTool;
// Tool registry for managing registered tools
class ToolRegistry {
    static tools = new Map();
    static registerTool(name, tool) {
        this.tools.set(name, tool);
    }
    static getTool(name) {
        return this.tools.get(name);
    }
    static getAllTools() {
        return Array.from(this.tools.values());
    }
    static getToolNames() {
        return Array.from(this.tools.keys());
    }
    static removeTool(name) {
        return this.tools.delete(name);
    }
    static clear() {
        this.tools.clear();
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=tool-interface.js.map