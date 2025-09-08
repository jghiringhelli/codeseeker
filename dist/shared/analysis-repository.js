"use strict";
/**
 * Analysis Results Repository
 * Stores and retrieves complex analysis results in MongoDB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisRepo = exports.AnalysisRepository = void 0;
const mongodb_client_1 = require("./mongodb-client");
const logger_1 = require("../utils/logger");
class AnalysisRepository {
    collection;
    logger;
    MAX_RESULTS_PER_TOOL = 50;
    constructor() {
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'AnalysisRepository');
    }
    async ensureConnection() {
        if (!this.collection) {
            if (!mongodb_client_1.mongoClient.isReady()) {
                await mongodb_client_1.mongoClient.connect();
            }
            this.collection = mongodb_client_1.mongoClient.getCollection('analysis_results');
        }
        return this.collection;
    }
    /**
     * Store analysis result with automatic cleanup
     */
    async storeAnalysis(projectId, toolName, analysis) {
        try {
            const collection = await this.ensureConnection();
            const document = {
                projectId,
                toolName,
                timestamp: new Date(),
                analysis,
                summary: this.extractSummary(analysis),
                fileCount: analysis.data?.length || 0,
                hasIssues: this.checkForIssues(analysis),
                tags: this.extractTags(analysis),
                metrics: this.extractMetrics(analysis)
            };
            const result = await collection.insertOne(document);
            // Cleanup old results
            await this.cleanupOldResults(projectId, toolName);
            this.logger.info(`Stored analysis for ${toolName} in project ${projectId}`);
            return result.insertedId.toString();
        }
        catch (error) {
            this.logger.error(`Failed to store analysis: ${error}`);
            throw error;
        }
    }
    /**
     * Get analysis history with filtering
     */
    async getAnalysisHistory(projectId, toolName, options) {
        try {
            const query = { projectId };
            if (toolName) {
                query.toolName = toolName;
            }
            if (options?.hasIssues !== undefined) {
                query.hasIssues = options.hasIssues;
            }
            if (options?.tags && options.tags.length > 0) {
                query.tags = { $in: options.tags };
            }
            if (options?.startDate || options?.endDate) {
                query.timestamp = {};
                if (options.startDate) {
                    query.timestamp.$gte = options.startDate;
                }
                if (options.endDate) {
                    query.timestamp.$lte = options.endDate;
                }
            }
            return await this.collection
                .find(query)
                .sort({ timestamp: -1 })
                .limit(options?.limit || 20)
                .skip(options?.skip || 0)
                .toArray();
        }
        catch (error) {
            this.logger.error(`Failed to get analysis history: ${error}`);
            return [];
        }
    }
    /**
     * Search analysis results using full-text search
     */
    async searchAnalysis(projectId, searchTerm) {
        try {
            return await this.collection
                .find({
                projectId,
                $text: { $search: searchTerm }
            })
                .sort({ score: { $meta: 'textScore' } })
                .limit(50)
                .toArray();
        }
        catch (error) {
            this.logger.error(`Failed to search analysis: ${error}`);
            return [];
        }
    }
    /**
     * Get latest analysis for each tool
     */
    async getLatestAnalyses(projectId) {
        try {
            const pipeline = [
                { $match: { projectId } },
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: '$toolName',
                        latestResult: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: '$latestResult' } }
            ];
            return await this.collection.aggregate(pipeline).toArray();
        }
        catch (error) {
            this.logger.error(`Failed to get latest analyses: ${error}`);
            return [];
        }
    }
    /**
     * Get analysis trends over time
     */
    async getAnalysisTrends(projectId, toolName, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const pipeline = [
                {
                    $match: {
                        projectId,
                        toolName,
                        timestamp: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                        },
                        count: { $sum: 1 },
                        avgIssues: { $avg: '$metrics.issuesFound' },
                        avgComplexity: { $avg: '$metrics.complexity' },
                        avgExecutionTime: { $avg: '$metrics.executionTime' }
                    }
                },
                { $sort: { '_id.date': 1 } }
            ];
            const results = await this.collection.aggregate(pipeline).toArray();
            return {
                dates: results.map(r => r._id.date),
                counts: results.map(r => r.count),
                avgIssues: results.map(r => r.avgIssues || 0),
                avgComplexity: results.map(r => r.avgComplexity || 0),
                avgExecutionTime: results.map(r => r.avgExecutionTime || 0)
            };
        }
        catch (error) {
            this.logger.error(`Failed to get analysis trends: ${error}`);
            return { dates: [], counts: [], avgIssues: [], avgComplexity: [], avgExecutionTime: [] };
        }
    }
    /**
     * Compare analysis results between two timestamps
     */
    async compareAnalyses(projectId, toolName, timestamp1, timestamp2) {
        try {
            const [result1, result2] = await Promise.all([
                this.collection.findOne({ projectId, toolName, timestamp: { $lte: timestamp1 } }, { sort: { timestamp: -1 } }),
                this.collection.findOne({ projectId, toolName, timestamp: { $lte: timestamp2 } }, { sort: { timestamp: -1 } })
            ]);
            if (!result1 || !result2) {
                return null;
            }
            return {
                before: {
                    timestamp: result1.timestamp,
                    metrics: result1.metrics,
                    issueCount: result1.metrics?.issuesFound || 0
                },
                after: {
                    timestamp: result2.timestamp,
                    metrics: result2.metrics,
                    issueCount: result2.metrics?.issuesFound || 0
                },
                changes: {
                    issuesDelta: (result2.metrics?.issuesFound || 0) - (result1.metrics?.issuesFound || 0),
                    complexityDelta: (result2.metrics?.complexity || 0) - (result1.metrics?.complexity || 0),
                    executionTimeDelta: (result2.metrics?.executionTime || 0) - (result1.metrics?.executionTime || 0)
                }
            };
        }
        catch (error) {
            this.logger.error(`Failed to compare analyses: ${error}`);
            return null;
        }
    }
    /**
     * Get aggregated statistics for a project
     */
    async getProjectStatistics(projectId) {
        try {
            const pipeline = [
                { $match: { projectId } },
                {
                    $group: {
                        _id: '$toolName',
                        totalRuns: { $sum: 1 },
                        avgExecutionTime: { $avg: '$metrics.executionTime' },
                        avgFilesProcessed: { $avg: '$metrics.filesProcessed' },
                        totalIssuesFound: { $sum: '$metrics.issuesFound' },
                        lastRun: { $max: '$timestamp' }
                    }
                }
            ];
            const toolStats = await this.collection.aggregate(pipeline).toArray();
            const overallStats = await this.collection.aggregate([
                { $match: { projectId } },
                {
                    $group: {
                        _id: null,
                        totalAnalyses: { $sum: 1 },
                        uniqueTools: { $addToSet: '$toolName' },
                        avgExecutionTime: { $avg: '$metrics.executionTime' },
                        totalIssuesFound: { $sum: '$metrics.issuesFound' }
                    }
                }
            ]).toArray();
            return {
                byTool: toolStats,
                overall: overallStats[0] || {
                    totalAnalyses: 0,
                    uniqueTools: [],
                    avgExecutionTime: 0,
                    totalIssuesFound: 0
                }
            };
        }
        catch (error) {
            this.logger.error(`Failed to get project statistics: ${error}`);
            return { byTool: [], overall: {} };
        }
    }
    /**
     * Delete analysis results
     */
    async deleteAnalysis(analysisId) {
        try {
            const result = await this.collection.deleteOne({ _id: analysisId });
            return result.deletedCount > 0;
        }
        catch (error) {
            this.logger.error(`Failed to delete analysis: ${error}`);
            return false;
        }
    }
    /**
     * Clean up old results to maintain storage limits
     */
    async cleanupOldResults(projectId, toolName) {
        try {
            const count = await this.collection.countDocuments({ projectId, toolName });
            if (count > this.MAX_RESULTS_PER_TOOL) {
                // Find the cutoff timestamp
                const cutoffResult = await this.collection
                    .find({ projectId, toolName })
                    .sort({ timestamp: -1 })
                    .skip(this.MAX_RESULTS_PER_TOOL)
                    .limit(1)
                    .toArray();
                if (cutoffResult.length > 0) {
                    const cutoffTimestamp = cutoffResult[0].timestamp;
                    // Delete older results
                    const deleteResult = await this.collection.deleteMany({
                        projectId,
                        toolName,
                        timestamp: { $lt: cutoffTimestamp }
                    });
                    if (deleteResult.deletedCount > 0) {
                        this.logger.info(`Cleaned up ${deleteResult.deletedCount} old results for ${toolName}`);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to cleanup old results: ${error}`);
        }
    }
    /**
     * Extract summary from analysis
     */
    extractSummary(analysis) {
        if (analysis.summary)
            return analysis.summary;
        if (analysis.analysis?.summary)
            return analysis.analysis.summary;
        // Generate summary based on content
        const parts = [];
        if (analysis.data?.length) {
            parts.push(`Analyzed ${analysis.data.length} files`);
        }
        if (analysis.issues?.length) {
            parts.push(`Found ${analysis.issues.length} issues`);
        }
        if (analysis.recommendations?.length) {
            parts.push(`${analysis.recommendations.length} recommendations`);
        }
        return parts.join(', ') || 'Analysis completed';
    }
    /**
     * Check if analysis contains issues
     */
    checkForIssues(analysis) {
        return !!(analysis.issues?.length ||
            analysis.errors?.length ||
            analysis.violations?.length ||
            analysis.analysis?.issues?.length ||
            analysis.analysis?.violations?.length);
    }
    /**
     * Extract searchable tags from analysis
     */
    extractTags(analysis) {
        const tags = new Set();
        // Add tool-specific tags
        if (analysis.toolName)
            tags.add(analysis.toolName);
        // Add language tags
        if (analysis.languages) {
            analysis.languages.forEach((lang) => tags.add(lang));
        }
        // Add framework tags
        if (analysis.frameworks) {
            analysis.frameworks.forEach((fw) => tags.add(fw));
        }
        // Add issue severity tags
        if (analysis.issues) {
            analysis.issues.forEach((issue) => {
                if (issue.severity)
                    tags.add(`severity:${issue.severity}`);
                if (issue.type)
                    tags.add(`issue:${issue.type}`);
            });
        }
        // Add custom tags
        if (analysis.tags) {
            analysis.tags.forEach((tag) => tags.add(tag));
        }
        return Array.from(tags);
    }
    /**
     * Extract metrics from analysis
     */
    extractMetrics(analysis) {
        return {
            executionTime: analysis.executionTime || analysis.metrics?.executionTime,
            filesProcessed: analysis.filesProcessed || analysis.data?.length || 0,
            issuesFound: analysis.issues?.length || analysis.violations?.length || 0,
            complexity: analysis.complexity || analysis.metrics?.complexity
        };
    }
}
exports.AnalysisRepository = AnalysisRepository;
// Export singleton instance
exports.analysisRepo = new AnalysisRepository();
//# sourceMappingURL=analysis-repository.js.map