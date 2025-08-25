const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

class DashboardServer {
    constructor() {
        this.app = express();
        this.port = process.env.DASHBOARD_PORT || 3005;
        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupDatabase() {
        // Database connection setup
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test database connection
        this.db.connect((err, client, release) => {
            if (err) {
                console.error('❌ Failed to connect to database:', err.message);
                return;
            }
            console.log('✅ Dashboard connected to PostgreSQL database');
            release();
        });
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname)));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`);
            next();
        });
    }

    setupRoutes() {
        // Serve dashboard HTML
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // API Routes
        this.app.get('/api/dashboard/health', this.getSystemHealth.bind(this));
        this.app.get('/api/dashboard/processes/active', this.getActiveProcesses.bind(this));
        this.app.get('/api/dashboard/roles/activity', this.getRoleActivity.bind(this));
        this.app.get('/api/dashboard/accomplishments/recent', this.getRecentAccomplishments.bind(this));
        this.app.get('/api/dashboard/logs/recent', this.getRecentLogs.bind(this));
        this.app.get('/api/dashboard/workflows/nodes', this.getWorkflowNodes.bind(this));
        this.app.get('/api/dashboard/metrics', this.getSystemMetrics.bind(this));
        
        // Project-specific endpoints
        this.app.get('/api/dashboard/projects', this.getProjects.bind(this));
        this.app.get('/api/dashboard/projects/:id/details', this.getProjectDetails.bind(this));
        
        // Real-time monitoring endpoints
        this.app.get('/api/dashboard/status', this.getOverallStatus.bind(this));
        this.app.post('/api/dashboard/process/:id/action', this.processAction.bind(this));
    }

    async getSystemHealth(req, res) {
        try {
            const result = await this.db.query(`
                SELECT * FROM dashboard_system_health;
            `);
            
            const health = result.rows[0] || {
                active_processes: 0,
                failed_processes_today: 0,
                completed_today: 0,
                avg_process_duration: 0,
                total_input_tokens_today: 0,
                total_output_tokens_today: 0,
                active_roles_today: 0,
                avg_quality_score_today: 0,
                accomplishments_today: 0,
                error_count_today: 0
            };

            // Add system status
            health.system_status = this.determineSystemStatus(health);
            health.uptime_seconds = Math.floor(process.uptime());
            health.memory_usage = process.memoryUsage();
            health.timestamp = new Date().toISOString();

            res.json(health);
        } catch (error) {
            console.error('❌ Error fetching system health:', error);
            res.status(500).json({ error: 'Failed to fetch system health', details: error.message });
        }
    }

    async getActiveProcesses(req, res) {
        try {
            const result = await this.db.query(`
                SELECT * FROM dashboard_active_processes
                ORDER BY priority DESC, started_at DESC;
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching active processes:', error);
            res.status(500).json({ error: 'Failed to fetch active processes', details: error.message });
        }
    }

    async getRoleActivity(req, res) {
        try {
            const result = await this.db.query(`
                SELECT 
                    ara.role_name,
                    ara.activity_type,
                    ara.status,
                    COUNT(*) as activity_count,
                    AVG(ara.duration_ms) as avg_duration_ms,
                    SUM(ara.input_tokens) as total_input_tokens,
                    SUM(ara.output_tokens) as total_output_tokens,
                    AVG(ara.quality_score) as avg_quality_score,
                    MAX(ara.started_at) as last_activity
                FROM ai_role_activities ara
                WHERE ara.started_at >= NOW() - INTERVAL '24 hours'
                GROUP BY ara.role_name, ara.activity_type, ara.status
                ORDER BY last_activity DESC;
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching role activity:', error);
            res.status(500).json({ error: 'Failed to fetch role activity', details: error.message });
        }
    }

    async getRecentAccomplishments(req, res) {
        try {
            const limit = req.query.limit || 20;
            const result = await this.db.query(`
                SELECT * FROM dashboard_recent_accomplishments
                LIMIT $1;
            `, [limit]);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching accomplishments:', error);
            res.status(500).json({ error: 'Failed to fetch accomplishments', details: error.message });
        }
    }

    async getRecentLogs(req, res) {
        try {
            const limit = req.query.limit || 100;
            const level = req.query.level; // filter by log level
            
            let query = `
                SELECT 
                    pl.log_level,
                    pl.message,
                    pl.context,
                    pl.timestamp,
                    op.process_name,
                    p.project_name
                FROM process_logs pl
                LEFT JOIN orchestration_processes op ON pl.process_id = op.id
                LEFT JOIN projects p ON op.project_id = p.id
                WHERE pl.timestamp >= NOW() - INTERVAL '24 hours'
            `;
            
            const params = [];
            if (level) {
                query += ` AND pl.log_level = $${params.length + 1}`;
                params.push(level);
            }
            
            query += ` ORDER BY pl.timestamp DESC LIMIT $${params.length + 1}`;
            params.push(limit);
            
            const result = await this.db.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching logs:', error);
            res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
        }
    }

    async getWorkflowNodes(req, res) {
        try {
            const result = await this.db.query(`
                SELECT 
                    op.id as process_id,
                    op.process_name,
                    op.execution_id,
                    op.status as process_status,
                    json_agg(
                        json_build_object(
                            'node_id', wn.node_id,
                            'node_type', wn.node_type,
                            'node_name', wn.node_name,
                            'status', wn.status,
                            'assigned_role', wn.assigned_role,
                            'position_x', wn.position_x,
                            'position_y', wn.position_y,
                            'dependencies', wn.dependencies,
                            'started_at', wn.started_at,
                            'completed_at', wn.completed_at,
                            'duration_ms', wn.duration_ms
                        )
                        ORDER BY wn.position_x, wn.position_y
                    ) as nodes
                FROM orchestration_processes op
                LEFT JOIN workflow_nodes wn ON op.id = wn.process_id
                WHERE op.status IN ('running', 'paused')
                GROUP BY op.id, op.process_name, op.execution_id, op.status
                ORDER BY op.started_at DESC;
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching workflow nodes:', error);
            res.status(500).json({ error: 'Failed to fetch workflow nodes', details: error.message });
        }
    }

    async getSystemMetrics(req, res) {
        try {
            const timeRange = req.query.range || '24h'; // 1h, 24h, 7d, 30d
            const interval = this.getTimeInterval(timeRange);
            
            const result = await this.db.query(`
                SELECT 
                    metric_type,
                    metric_name,
                    AVG(metric_value) as avg_value,
                    MIN(metric_value) as min_value,
                    MAX(metric_value) as max_value,
                    COUNT(*) as data_points,
                    date_trunc('${interval}', timestamp) as time_bucket
                FROM system_metrics
                WHERE timestamp >= NOW() - INTERVAL '${timeRange.replace(/[^0-9hdm]/g, '')}'
                GROUP BY metric_type, metric_name, time_bucket
                ORDER BY time_bucket DESC, metric_type, metric_name;
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching system metrics:', error);
            res.status(500).json({ error: 'Failed to fetch system metrics', details: error.message });
        }
    }

    async getProjects(req, res) {
        try {
            const result = await this.db.query(`
                SELECT * FROM active_projects_status
                ORDER BY last_progress_update DESC NULLS LAST;
            `);
            
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error fetching projects:', error);
            res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
        }
    }

    async getProjectDetails(req, res) {
        try {
            const projectId = req.params.id;
            
            const [projectResult, patternsResult, metricsResult] = await Promise.all([
                this.db.query(`
                    SELECT p.*, ip.phase, ip.progress_data, ip.tech_stack_data
                    FROM projects p
                    LEFT JOIN initialization_progress ip ON p.id = ip.project_id
                    WHERE p.id = $1;
                `, [projectId]),
                
                this.db.query(`
                    SELECT * FROM project_pattern_summary WHERE project_id = $1;
                `, [projectId]),
                
                this.db.query(`
                    SELECT * FROM system_metrics 
                    WHERE project_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
                    ORDER BY timestamp DESC LIMIT 100;
                `, [projectId])
            ]);
            
            const project = projectResult.rows[0];
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            project.pattern_summary = patternsResult.rows[0];
            project.recent_metrics = metricsResult.rows;
            
            res.json(project);
        } catch (error) {
            console.error('❌ Error fetching project details:', error);
            res.status(500).json({ error: 'Failed to fetch project details', details: error.message });
        }
    }

    async getOverallStatus(req, res) {
        try {
            const [healthResult, processesResult, systemResult] = await Promise.all([
                this.db.query('SELECT * FROM dashboard_system_health;'),
                this.db.query('SELECT COUNT(*) as total, status FROM orchestration_processes GROUP BY status;'),
                this.db.query('SELECT COUNT(*) as active_projects FROM projects WHERE status = \'active\';')
            ]);
            
            const status = {
                system_health: healthResult.rows[0],
                process_counts: processesResult.rows,
                active_projects: systemResult.rows[0]?.active_projects || 0,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.SYSTEM_VERSION || '0.1.0'
            };
            
            res.json(status);
        } catch (error) {
            console.error('❌ Error fetching overall status:', error);
            res.status(500).json({ error: 'Failed to fetch overall status', details: error.message });
        }
    }

    async processAction(req, res) {
        try {
            const processId = req.params.id;
            const { action } = req.body; // pause, resume, cancel, restart
            
            // Validate action
            if (!['pause', 'resume', 'cancel', 'restart'].includes(action)) {
                return res.status(400).json({ error: 'Invalid action' });
            }
            
            // Update process status
            const newStatus = {
                'pause': 'paused',
                'resume': 'running',
                'cancel': 'cancelled',
                'restart': 'pending'
            }[action];
            
            await this.db.query(`
                UPDATE orchestration_processes 
                SET status = $1, updated_at = NOW()
                WHERE id = $2;
            `, [newStatus, processId]);
            
            // Log the action
            await this.db.query(`
                INSERT INTO process_logs (process_id, log_level, message, context)
                VALUES ($1, 'info', $2, $3);
            `, [
                processId,
                `Process ${action} requested via dashboard`,
                JSON.stringify({ action, timestamp: new Date().toISOString(), source: 'dashboard' })
            ]);
            
            res.json({ success: true, action, new_status: newStatus });
        } catch (error) {
            console.error('❌ Error executing process action:', error);
            res.status(500).json({ error: 'Failed to execute process action', details: error.message });
        }
    }

    determineSystemStatus(health) {
        const errorRate = health.error_count_today / Math.max(health.completed_today + health.error_count_today, 1);
        const failureRate = health.failed_processes_today / Math.max(health.completed_today + health.failed_processes_today, 1);
        
        if (errorRate > 0.1 || failureRate > 0.2) return 'critical';
        if (errorRate > 0.05 || failureRate > 0.1) return 'warning';
        if (health.active_processes === 0 && health.completed_today === 0) return 'idle';
        return 'healthy';
    }

    getTimeInterval(range) {
        const intervals = {
            '1h': 'minute',
            '24h': 'hour',
            '7d': 'hour',
            '30d': 'day'
        };
        return intervals[range] || 'hour';
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🚀 CodeMind Dashboard Server running on http://localhost:${this.port}`);
            console.log(`📊 Dashboard available at http://localhost:${this.port}/`);
            console.log(`🔌 API endpoints available at http://localhost:${this.port}/api/dashboard/`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('🛑 Dashboard server shutting down gracefully...');
            this.db.end(() => {
                console.log('✅ Database connections closed');
                process.exit(0);
            });
        });
    }
}

module.exports = DashboardServer;

// Start server if run directly
if (require.main === module) {
    const server = new DashboardServer();
    server.start();
}