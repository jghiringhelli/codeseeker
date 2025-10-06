/**
 * Simplified CodeMind Dashboard Server
 * Focused on project status and database queries
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const { SimpleDashboardAPI } = require('./simple-api');

class SimpleDashboardServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || process.env.DASHBOARD_PORT || 3005;
        
        // Initialize simple API
        this.simpleAPI = new SimpleDashboardAPI();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS configuration
        this.app.use(cors({
            origin: process.env.DASHBOARD_ORIGIN || "*",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }));

        // Body parsing
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Static files
        this.app.use(express.static(path.join(__dirname)));
    }

    setupRoutes() {
        // Serve main dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // Setup API routes through SimpleDashboardAPI
        this.simpleAPI.setupRoutes(this.app);

        // Health check
        this.app.get('/api/status', (req, res) => {
            res.json({
                status: 'ok',
                service: 'CodeMind Simple Dashboard',
                version: '1.0.0',
                timestamp: new Date().toISOString()
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    async start() {
        try {
            this.server = this.app.listen(this.port, '0.0.0.0', () => {
                console.log('\n🚀 CodeMind Simple Dashboard Server Started');
                console.log(`📊 Dashboard: http://localhost:${this.port}`);
                console.log(`🔗 API Status: http://localhost:${this.port}/api/status`);
                console.log('---');
            });

            // Graceful shutdown
            process.on('SIGTERM', this.gracefulShutdown.bind(this));
            process.on('SIGINT', this.gracefulShutdown.bind(this));

        } catch (error) {
            console.error('❌ Failed to start dashboard server:', error);
            process.exit(1);
        }
    }

    async gracefulShutdown() {
        console.log('\n🔄 Shutting down dashboard server...');
        
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Dashboard server closed');
                process.exit(0);
            });
        }
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new SimpleDashboardServer();
    server.start();
}

module.exports = { SimpleDashboardServer };