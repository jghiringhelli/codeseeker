const { Pool } = require('pg');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive metrics and logging collection system for CodeMind
 * Tracks system performance, process metrics, and accomplishments
 */
class MetricsCollector {
    constructor(config = {}) {
        this.config = {
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'codemind',
                user: process.env.DB_USER || 'codemind',
                password: process.env.DB_PASSWORD || 'codemind123',
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            },
            collection: {
                systemMetricsInterval: 30000, // 30 seconds
                processMetricsInterval: 10000, // 10 seconds  
                logBatchSize: 100,
                maxLogAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                enableSystemMetrics: true,
                enableProcessMetrics: true,
                enableCustomMetrics: true,
            },
            ...config
        };

        this.db = new Pool(this.config.database);
        this.logBuffer = [];
        this.metricsBuffer = [];
        this.isCollecting = false;
        
        this.init();
    }

    async init() {
        try {
            // Test database connection
            await this.db.query('SELECT NOW()');
            console.log('✅ MetricsCollector connected to database');

            // Start metrics collection
            if (this.config.collection.enableSystemMetrics) {
                this.startSystemMetricsCollection();
            }
            
            if (this.config.collection.enableProcessMetrics) {
                this.startProcessMetricsCollection();
            }

            // Setup log flushing
            this.startLogFlushing();
            
            // Setup cleanup tasks
            this.startCleanupTasks();
            
            this.isCollecting = true;
            console.log('📊 MetricsCollector initialized and collecting');
            
        } catch (error) {
            console.error('❌ Failed to initialize MetricsCollector:', error);
            throw error;
        }
    }

    /**
     * Start orchestration process monitoring
     */
    async startProcess(processData) {
        try {
            const result = await this.db.query(`
                INSERT INTO orchestration_processes (
                    project_id, process_name, process_type, workflow_id, 
                    execution_id, priority, estimated_duration, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id;
            `, [
                processData.project_id,
                processData.process_name,
                processData.process_type,
                processData.workflow_id,
                processData.execution_id,
                processData.priority || 5,
                processData.estimated_duration,
                JSON.stringify(processData.metadata || {})
            ]);

            const processId = result.rows[0].id;
            
            this.logInfo('Process started', {
                process_id: processId,
                process_name: processData.process_name,
                process_type: processData.process_type,
                execution_id: processData.execution_id
            });

            return processId;
        } catch (error) {
            console.error('❌ Failed to start process tracking:', error);
            throw error;
        }
    }

    /**
     * Update process progress and status
     */
    async updateProcess(processId, updates) {
        try {
            const setClauses = [];
            const values = [];
            let paramCount = 0;

            if (updates.status) {
                setClauses.push(`status = $${++paramCount}`);
                values.push(updates.status);
            }

            if (updates.progress_percent !== undefined) {
                setClauses.push(`progress_percent = $${++paramCount}`);
                values.push(updates.progress_percent);
            }

            if (updates.current_phase) {
                setClauses.push(`current_phase = $${++paramCount}`);
                values.push(updates.current_phase);
            }

            if (updates.total_phases) {
                setClauses.push(`total_phases = $${++paramCount}`);
                values.push(updates.total_phases);
            }

            if (updates.metadata) {
                setClauses.push(`metadata = $${++paramCount}`);
                values.push(JSON.stringify(updates.metadata));
            }

            if (updates.status === 'completed') {
                setClauses.push(`completed_at = NOW()`);
                setClauses.push(`actual_duration = EXTRACT(EPOCH FROM (NOW() - started_at))`);
            }

            if (setClauses.length > 0) {
                setClauses.push('updated_at = NOW()');
                values.push(processId);

                await this.db.query(`
                    UPDATE orchestration_processes 
                    SET ${setClauses.join(', ')}
                    WHERE id = $${++paramCount};
                `, values);
            }

            this.logInfo('Process updated', {
                process_id: processId,
                updates
            });

        } catch (error) {
            console.error('❌ Failed to update process:', error);
            throw error;
        }
    }

    /**
     * Track AI role activity
     */
    async trackRoleActivity(processId, activityData) {
        try {
            const result = await this.db.query(`
                INSERT INTO ai_role_activities (
                    process_id, role_name, activity_type, input_tokens,
                    output_tokens, api_calls, files_processed, lines_changed,
                    result_summary, artifacts, quality_score
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id;
            `, [
                processId,
                activityData.role_name,
                activityData.activity_type,
                activityData.input_tokens || 0,
                activityData.output_tokens || 0,
                activityData.api_calls || 0,
                activityData.files_processed || 0,
                activityData.lines_changed || 0,
                activityData.result_summary,
                JSON.stringify(activityData.artifacts || []),
                activityData.quality_score
            ]);

            const activityId = result.rows[0].id;

            this.logInfo('Role activity tracked', {
                activity_id: activityId,
                process_id: processId,
                role_name: activityData.role_name,
                activity_type: activityData.activity_type
            });

            return activityId;
        } catch (error) {
            console.error('❌ Failed to track role activity:', error);
            throw error;
        }
    }

    /**
     * Complete role activity with final metrics
     */
    async completeRoleActivity(activityId, completionData) {
        try {
            await this.db.query(`
                UPDATE ai_role_activities 
                SET status = 'completed',
                    completed_at = NOW(),
                    duration_ms = $1,
                    result_summary = COALESCE($2, result_summary),
                    artifacts = COALESCE($3, artifacts),
                    quality_score = COALESCE($4, quality_score),
                    updated_at = NOW()
                WHERE id = $5;
            `, [
                completionData.duration_ms,
                completionData.result_summary,
                JSON.stringify(completionData.artifacts || []),
                completionData.quality_score,
                activityId
            ]);

            this.logInfo('Role activity completed', {
                activity_id: activityId,
                duration_ms: completionData.duration_ms
            });

        } catch (error) {
            console.error('❌ Failed to complete role activity:', error);
            throw error;
        }
    }

    /**
     * Record accomplishment
     */
    async recordAccomplishment(accomplishmentData) {
        try {
            const result = await this.db.query(`
                INSERT INTO accomplishments (
                    project_id, process_id, category, title, description,
                    impact_level, quantitative_metrics, before_state,
                    after_state, files_affected, beneficiaries
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id;
            `, [
                accomplishmentData.project_id,
                accomplishmentData.process_id,
                accomplishmentData.category,
                accomplishmentData.title,
                accomplishmentData.description,
                accomplishmentData.impact_level,
                JSON.stringify(accomplishmentData.quantitative_metrics || {}),
                JSON.stringify(accomplishmentData.before_state || {}),
                JSON.stringify(accomplishmentData.after_state || {}),
                JSON.stringify(accomplishmentData.files_affected || []),
                JSON.stringify(accomplishmentData.beneficiaries || [])
            ]);

            const accomplishmentId = result.rows[0].id;

            this.logInfo('Accomplishment recorded', {
                accomplishment_id: accomplishmentId,
                category: accomplishmentData.category,
                title: accomplishmentData.title,
                impact_level: accomplishmentData.impact_level
            });

            return accomplishmentId;
        } catch (error) {
            console.error('❌ Failed to record accomplishment:', error);
            throw error;
        }
    }

    /**
     * Log structured messages
     */
    async logMessage(level, message, context = {}, processId = null, roleActivityId = null) {
        const logEntry = {
            process_id: processId,
            role_activity_id: roleActivityId,
            log_level: level,
            message,
            context: JSON.stringify(context),
            timestamp: new Date()
        };

        this.logBuffer.push(logEntry);

        // Flush if buffer is full
        if (this.logBuffer.length >= this.config.collection.logBatchSize) {
            await this.flushLogs();
        }
    }

    // Convenience logging methods
    logDebug(message, context, processId, roleActivityId) {
        return this.logMessage('debug', message, context, processId, roleActivityId);
    }

    logInfo(message, context, processId, roleActivityId) {
        return this.logMessage('info', message, context, processId, roleActivityId);
    }

    logWarn(message, context, processId, roleActivityId) {
        return this.logMessage('warn', message, context, processId, roleActivityId);
    }

    logError(message, context, processId, roleActivityId) {
        return this.logMessage('error', message, context, processId, roleActivityId);
    }

    /**
     * Record custom metric
     */
    async recordMetric(metricType, metricName, value, unit = null, tags = {}, projectId = null, processId = null) {
        const metric = {
            metric_type: metricType,
            metric_name: metricName,
            metric_value: value,
            metric_unit: unit,
            project_id: projectId,
            process_id: processId,
            tags: JSON.stringify(tags),
            timestamp: new Date()
        };

        this.metricsBuffer.push(metric);

        // Flush if buffer is getting full
        if (this.metricsBuffer.length >= 50) {
            await this.flushMetrics();
        }
    }

    /**
     * Start collecting system metrics
     */
    startSystemMetricsCollection() {
        setInterval(async () => {
            try {
                await this.collectSystemMetrics();
            } catch (error) {
                console.error('❌ Failed to collect system metrics:', error);
            }
        }, this.config.collection.systemMetricsInterval);
    }

    /**
     * Start collecting process metrics
     */
    startProcessMetricsCollection() {
        setInterval(async () => {
            try {
                await this.collectProcessMetrics();
            } catch (error) {
                console.error('❌ Failed to collect process metrics:', error);
            }
        }, this.config.collection.processMetricsInterval);
    }

    /**
     * Collect system performance metrics
     */
    async collectSystemMetrics() {
        const timestamp = new Date();

        // CPU metrics
        const cpus = os.cpus();
        const cpuUsage = process.cpuUsage();
        
        await this.recordMetric('performance', 'cpu_count', cpus.length);
        await this.recordMetric('performance', 'cpu_usage_user', cpuUsage.user);
        await this.recordMetric('performance', 'cpu_usage_system', cpuUsage.system);

        // Memory metrics
        const memoryUsage = process.memoryUsage();
        const systemMemory = {
            total: os.totalmem(),
            free: os.freemem()
        };

        await this.recordMetric('performance', 'memory_heap_used', memoryUsage.heapUsed, 'bytes');
        await this.recordMetric('performance', 'memory_heap_total', memoryUsage.heapTotal, 'bytes');
        await this.recordMetric('performance', 'memory_rss', memoryUsage.rss, 'bytes');
        await this.recordMetric('performance', 'memory_external', memoryUsage.external, 'bytes');
        await this.recordMetric('performance', 'system_memory_total', systemMemory.total, 'bytes');
        await this.recordMetric('performance', 'system_memory_free', systemMemory.free, 'bytes');

        // Load average (Unix systems)
        try {
            const loadavg = os.loadavg();
            await this.recordMetric('performance', 'load_avg_1m', loadavg[0]);
            await this.recordMetric('performance', 'load_avg_5m', loadavg[1]);
            await this.recordMetric('performance', 'load_avg_15m', loadavg[2]);
        } catch (error) {
            // Load average not available on all systems
        }

        // Process uptime
        await this.recordMetric('performance', 'process_uptime', process.uptime(), 'seconds');
    }

    /**
     * Collect process-specific metrics
     */
    async collectProcessMetrics() {
        try {
            // Database connection pool stats
            await this.recordMetric('resource', 'db_pool_total', this.db.totalCount);
            await this.recordMetric('resource', 'db_pool_idle', this.db.idleCount);
            await this.recordMetric('resource', 'db_pool_waiting', this.db.waitingCount);

            // Active processes count
            const processResult = await this.db.query(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM orchestration_processes 
                WHERE started_at >= NOW() - INTERVAL '1 hour'
                GROUP BY status;
            `);

            for (const row of processResult.rows) {
                await this.recordMetric('business', `processes_${row.status}`, parseInt(row.count));
            }

            // Recent accomplishments
            const accomplishmentResult = await this.db.query(`
                SELECT 
                    impact_level,
                    COUNT(*) as count
                FROM accomplishments
                WHERE achieved_at >= NOW() - INTERVAL '1 hour'
                GROUP BY impact_level;
            `);

            for (const row of accomplishmentResult.rows) {
                await this.recordMetric('business', `accomplishments_${row.impact_level}`, parseInt(row.count));
            }

            // Error rates
            const errorResult = await this.db.query(`
                SELECT 
                    log_level,
                    COUNT(*) as count
                FROM process_logs
                WHERE timestamp >= NOW() - INTERVAL '1 hour'
                GROUP BY log_level;
            `);

            for (const row of errorResult.rows) {
                await this.recordMetric('quality', `logs_${row.log_level}`, parseInt(row.count));
            }

        } catch (error) {
            console.error('❌ Failed to collect process metrics:', error);
        }
    }

    /**
     * Start log flushing timer
     */
    startLogFlushing() {
        setInterval(async () => {
            if (this.logBuffer.length > 0) {
                await this.flushLogs();
            }
            if (this.metricsBuffer.length > 0) {
                await this.flushMetrics();
            }
        }, 5000); // Flush every 5 seconds
    }

    /**
     * Flush log buffer to database
     */
    async flushLogs() {
        if (this.logBuffer.length === 0) return;

        try {
            const logs = [...this.logBuffer];
            this.logBuffer = [];

            // Batch insert logs
            const values = logs.map((log, index) => {
                const baseIndex = index * 6;
                return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
            }).join(', ');

            const params = logs.flatMap(log => [
                log.process_id,
                log.role_activity_id,
                log.log_level,
                log.message,
                log.context,
                log.timestamp
            ]);

            await this.db.query(`
                INSERT INTO process_logs (process_id, role_activity_id, log_level, message, context, timestamp)
                VALUES ${values};
            `, params);

        } catch (error) {
            console.error('❌ Failed to flush logs:', error);
            // Put logs back in buffer
            this.logBuffer = [...this.logBuffer, ...logs];
        }
    }

    /**
     * Flush metrics buffer to database
     */
    async flushMetrics() {
        if (this.metricsBuffer.length === 0) return;

        try {
            const metrics = [...this.metricsBuffer];
            this.metricsBuffer = [];

            // Batch insert metrics
            const values = metrics.map((metric, index) => {
                const baseIndex = index * 8;
                return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
            }).join(', ');

            const params = metrics.flatMap(metric => [
                metric.metric_type,
                metric.metric_name,
                metric.metric_value,
                metric.metric_unit,
                metric.project_id,
                metric.process_id,
                metric.tags,
                metric.timestamp
            ]);

            await this.db.query(`
                INSERT INTO system_metrics (metric_type, metric_name, metric_value, metric_unit, project_id, process_id, tags, timestamp)
                VALUES ${values};
            `, params);

        } catch (error) {
            console.error('❌ Failed to flush metrics:', error);
            // Put metrics back in buffer
            this.metricsBuffer = [...metrics, ...this.metricsBuffer];
        }
    }

    /**
     * Start cleanup tasks
     */
    startCleanupTasks() {
        // Clean old logs daily
        setInterval(async () => {
            try {
                const result = await this.db.query(`
                    DELETE FROM process_logs 
                    WHERE timestamp < NOW() - INTERVAL '${this.config.collection.maxLogAge / (24 * 60 * 60 * 1000)} days';
                `);
                
                if (result.rowCount > 0) {
                    console.log(`🧹 Cleaned up ${result.rowCount} old log entries`);
                }
            } catch (error) {
                console.error('❌ Failed to clean up old logs:', error);
            }
        }, 24 * 60 * 60 * 1000); // Daily

        // Clean expired resume states
        setInterval(async () => {
            try {
                const result = await this.db.query('SELECT cleanup_expired_resume_states();');
                const deletedCount = result.rows[0]?.cleanup_expired_resume_states || 0;
                
                if (deletedCount > 0) {
                    console.log(`🧹 Cleaned up ${deletedCount} expired resume states`);
                }
            } catch (error) {
                console.error('❌ Failed to clean up expired resume states:', error);
            }
        }, 60 * 60 * 1000); // Hourly
    }

    /**
     * Get metrics summary
     */
    async getMetricsSummary(timeRange = '24h') {
        try {
            const interval = timeRange === '1h' ? '1 hour' : timeRange === '7d' ? '7 days' : '24 hours';
            
            const result = await this.db.query(`
                SELECT 
                    metric_type,
                    metric_name,
                    COUNT(*) as data_points,
                    AVG(metric_value) as avg_value,
                    MIN(metric_value) as min_value,
                    MAX(metric_value) as max_value,
                    STDDEV(metric_value) as stddev_value
                FROM system_metrics
                WHERE timestamp >= NOW() - INTERVAL '${interval}'
                GROUP BY metric_type, metric_name
                ORDER BY metric_type, metric_name;
            `);

            return result.rows;
        } catch (error) {
            console.error('❌ Failed to get metrics summary:', error);
            throw error;
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 MetricsCollector shutting down...');
        
        this.isCollecting = false;
        
        // Flush remaining data
        await this.flushLogs();
        await this.flushMetrics();
        
        // Close database connection
        await this.db.end();
        
        console.log('✅ MetricsCollector shutdown complete');
    }
}

module.exports = MetricsCollector;