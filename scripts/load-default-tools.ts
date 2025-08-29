#!/usr/bin/env npx tsx

/**
 * Script to load default tools into the database
 * Used to initialize the external tools system
 */

import { PostgreSQLAdapter } from '../src/database/adapters/postgresql';
import { ExternalToolManager } from '../src/orchestration/external-tool-manager';
import { Logger } from '../src/utils/logger';

async function loadDefaultTools() {
  const logger = Logger.getInstance();
  
  try {
    logger.info('🔧 Loading default tools into CodeMind database...');
    
    // Initialize database with PostgreSQL adapter
    const db = new PostgreSQLAdapter({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'codemind',
      username: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123',
      ssl: false
    }, logger);
    
    await db.initialize();
    
    // Initialize tool manager with PostgreSQL adapter
    const toolManager = new ExternalToolManager(db as any);
    await toolManager.initialize();
    
    // Check what tools were loaded
    const availableTools = await toolManager.getAvailableTools();
    
    logger.info(`✅ Successfully loaded ${availableTools.length} default tools`);
    
    // Show tools by category
    const categories = [...new Set(availableTools.map(t => t.category))];
    for (const category of categories) {
      const toolsInCategory = availableTools.filter(t => t.category === category);
      logger.info(`📁 ${category}: ${toolsInCategory.map(t => t.name).join(', ')}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Failed to load default tools:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  loadDefaultTools();
}

export { loadDefaultTools };