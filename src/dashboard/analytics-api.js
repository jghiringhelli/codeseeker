/**
 * Analytics API for DuckDB Integration
 * Provides analytics endpoints using columnar database queries
 */

const { createAnalyticsExportPipeline } = require('../../dist/shared/analytics-export-pipeline');
const { AnalyticsDatabase } = require('../../dist/shared/analytics-database');

class AnalyticsAPI {
    constructor(pgPool) {
        this.pgPool = pgPool;
        this.pipelines = new Map(); // projectId -> pipeline
        this.analyticsDbs = new Map(); // projectId -> analyticsDb
    }

    /**
     * Initialize analytics for a project
     */
    async initializeProjectAnalytics(projectId, projectPath) {
        try {
            // Create analytics database instance
            const analyticsDb = new AnalyticsDatabase(projectPath);
            await analyticsDb.initialize();
            this.analyticsDbs.set(projectId, analyticsDb);

            // Create export pipeline
            const pipeline = createAnalyticsExportPipeline(
                projectPath,
                projectId,
                this.pgPool,
                {
                    batchSize: 500,
                    exportInterval: 10 // 10 minutes
                }
            );

            await pipeline.startPipeline();
            this.pipelines.set(projectId, pipeline);

            console.log(`📊 Analytics initialized for project ${projectId}`);
            return true;
        } catch (error) {
            console.error(`Failed to initialize analytics for project ${projectId}:`, error);
            return false;
        }
    }

    /**
     * Get analytics database for project
     */
    getAnalyticsDb(projectId) {
        return this.analyticsDbs.get(projectId);
    }

    /**
     * Get export pipeline for project
     */
    getPipeline(projectId) {
        return this.pipelines.get(projectId);
    }

    /**
     * Get performance trends
     */
    async getPerformanceTrends(projectId, hours = 24) {
        const analyticsDb = this.getAnalyticsDb(projectId);
        if (!analyticsDb) {
            throw new Error(`Analytics not initialized for project ${projectId}`);
        }

        return await analyticsDb.getPerformanceTrends(projectId, hours);
    }

    /**
     * Get code quality trends
     */
    async getCodeQualityTrends(projectId, metricType = null) {
        const analyticsDb = this.getAnalyticsDb(projectId);
        if (!analyticsDb) {
            throw new Error(`Analytics not initialized for project ${projectId}`);
        }

        return await analyticsDb.getCodeQualityTrends(projectId, metricType);
    }

    /**
     * Get file activity summary
     */
    async getFileActivity(projectId, hours = 168) {
        const analyticsDb = this.getAnalyticsDb(projectId);
        if (!analyticsDb) {
            throw new Error(`Analytics not initialized for project ${projectId}`);
        }

        return await analyticsDb.getFileActivitySummary(projectId, hours);
    }

    /**
     * Get tool efficiency report
     */
    async getToolEfficiency(projectId) {
        const analyticsDb = this.getAnalyticsDb(projectId);
        if (!analyticsDb) {
            throw new Error(`Analytics not initialized for project ${projectId}`);
        }

        return await analyticsDb.getToolEfficiencyReport(projectId);
    }

    /**
     * Get comprehensive analytics dashboard data
     */
    async getAnalyticsDashboard(projectId, timeRange = '24h') {
        try {
            const hours = this.parseTimeRange(timeRange);
            
            // Get all analytics data in parallel
            const [
                performanceTrends,
                qualityTrends, 
                fileActivity,
                toolEfficiency,
                analyticsStats
            ] = await Promise.all([
                this.getPerformanceTrends(projectId, hours),
                this.getCodeQualityTrends(projectId),
                this.getFileActivity(projectId, hours),
                this.getToolEfficiency(projectId),
                this.getAnalyticsStats(projectId)
            ]);

            return {
                timeRange,
                performance: {
                    trends: performanceTrends,
                    summary: this.summarizePerformance(performanceTrends)
                },
                quality: {
                    trends: qualityTrends,
                    summary: this.summarizeQuality(qualityTrends)
                },
                activity: {
                    files: fileActivity,
                    summary: this.summarizeActivity(fileActivity)
                },
                tools: {
                    efficiency: toolEfficiency,
                    summary: this.summarizeTools(toolEfficiency)
                },
                statistics: analyticsStats
            };
        } catch (error) {
            console.error(`Failed to get analytics dashboard for ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Get analytics statistics
     */
    async getAnalyticsStats(projectId) {
        const analyticsDb = this.getAnalyticsDb(projectId);
        const pipeline = this.getPipeline(projectId);

        if (!analyticsDb) {
            return { initialized: false };
        }

        const [dbStats, pipelineStats] = await Promise.all([
            analyticsDb.getStats(),
            pipeline ? pipeline.getExportStats() : null
        ]);

        return {
            initialized: true,
            database: dbStats,
            pipeline: pipelineStats
        };
    }

    /**
     * Trigger manual export
     */
    async triggerExport(projectId, type = 'incremental') {
        const pipeline = this.getPipeline(projectId);
        if (!pipeline) {
            throw new Error(`Pipeline not found for project ${projectId}`);
        }

        await pipeline.triggerExport(type);
        return { success: true, type, timestamp: new Date().toISOString() };
    }

    /**
     * Export analytics data to Parquet
     */
    async exportToParquet(projectId, tableName, outputPath) {
        const analyticsDb = this.getAnalyticsDb(projectId);
        if (!analyticsDb) {
            throw new Error(`Analytics not initialized for project ${projectId}`);
        }

        await analyticsDb.exportToParquet(tableName, outputPath, projectId);
        return { success: true, outputPath, timestamp: new Date().toISOString() };
    }

    /**
     * Search analytics data  
     */
    async searchAnalytics(projectId, query) {
        const analyticsDb = this.getAnalyticsDb(projectId);
        if (!analyticsDb) {
            throw new Error(`Analytics not initialized for project ${projectId}`);
        }

        // Simple search across performance and quality metrics
        const searchResults = {
            performance: [],
            quality: [],
            files: []
        };

        try {
            // Search in performance data
            if (query.tool || query.execution_time) {
                const perfTrends = await analyticsDb.getPerformanceTrends(projectId, 168);
                searchResults.performance = perfTrends.filter(item => 
                    (!query.tool || item.tool_name.includes(query.tool)) &&
                    (!query.execution_time || item.avg_execution_time <= query.execution_time)
                );
            }

            // Search in quality data
            if (query.metric_type || query.file_path) {
                const qualityTrends = await analyticsDb.getCodeQualityTrends(projectId, query.metric_type);
                searchResults.quality = qualityTrends.filter(item =>
                    !query.file_path || item.file_path?.includes(query.file_path)
                );
            }

            // Search in file activity
            if (query.file_path || query.event_type) {
                const fileActivity = await analyticsDb.getFileActivitySummary(projectId, 168);
                searchResults.files = fileActivity.filter(item =>
                    (!query.file_path || item.file_path.includes(query.file_path)) &&
                    (!query.event_type || item.modifications > 0) // Simple event type filter
                );
            }
        } catch (error) {
            console.error('Analytics search error:', error);
        }

        return searchResults;
    }

    // Helper methods
    parseTimeRange(timeRange) {
        const rangeMap = {
            '1h': 1,
            '6h': 6, 
            '24h': 24,
            '7d': 168,
            '30d': 720
        };
        return rangeMap[timeRange] || 24;
    }

    summarizePerformance(trends) {
        if (!trends.length) return { avgExecutionTime: 0, totalExecutions: 0 };
        
        return {
            avgExecutionTime: trends.reduce((sum, t) => sum + t.avg_execution_time, 0) / trends.length,
            totalExecutions: trends.reduce((sum, t) => sum + t.executions, 0),
            tools: [...new Set(trends.map(t => t.tool_name))].length
        };
    }

    summarizeQuality(trends) {
        if (!trends.length) return { avgValue: 0, measurements: 0 };
        
        return {
            avgValue: trends.reduce((sum, t) => sum + t.avg_value, 0) / trends.length,
            measurements: trends.reduce((sum, t) => sum + t.measurements, 0),
            metricTypes: [...new Set(trends.map(t => t.metric_type))].length
        };
    }

    summarizeActivity(activity) {
        if (!activity.length) return { totalFiles: 0, totalEvents: 0 };
        
        return {
            totalFiles: activity.length,
            totalEvents: activity.reduce((sum, a) => sum + a.total_events, 0),
            totalModifications: activity.reduce((sum, a) => sum + a.modifications, 0)
        };
    }

    summarizeTools(efficiency) {
        if (!efficiency.length) return { toolCount: 0, avgExecutionTime: 0 };
        
        return {
            toolCount: efficiency.length,
            avgExecutionTime: efficiency.reduce((sum, e) => sum + e.avg_execution_time, 0) / efficiency.length,
            totalExecutions: efficiency.reduce((sum, e) => sum + e.total_executions, 0)
        };
    }

    /**
     * Close all connections
     */
    async close() {
        // Close all pipelines
        for (const pipeline of this.pipelines.values()) {
            await pipeline.close();
        }
        
        // Close all analytics databases
        for (const analyticsDb of this.analyticsDbs.values()) {
            await analyticsDb.close();
        }

        this.pipelines.clear();
        this.analyticsDbs.clear();
    }
}

module.exports = { AnalyticsAPI };