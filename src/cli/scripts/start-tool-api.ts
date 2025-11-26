#!/usr/bin/env node
/**
 * Simple server to start the Tool Database API for testing
 */

import express from 'express';
import cors from 'cors';
import { toolDatabaseRouter } from '../../orchestrator/tool-database-api';

const app = express();
const PORT = process.env.TOOL_API_PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'tool-database-api',
    timestamp: new Date().toISOString() 
  });
});

// Mount tool database API routes
app.use('/api/tools', toolDatabaseRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export default app;