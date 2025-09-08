#!/usr/bin/env node
"use strict";
/**
 * Simple server to start the Tool Database API for testing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const tool_database_api_1 = __importDefault(require("../orchestration/tool-database-api"));
const app = (0, express_1.default)();
const PORT = process.env.TOOL_API_PORT || 3003;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'tool-database-api',
        timestamp: new Date().toISOString()
    });
});
// Mount tool database API routes
app.use('/api/tools', tool_database_api_1.default);
// Error handling
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 Tool Database API Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🛠️  API endpoints: http://localhost:${PORT}/api/tools`);
});
exports.default = app;
//# sourceMappingURL=start-tool-api.js.map