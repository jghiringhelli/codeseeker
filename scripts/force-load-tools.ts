#!/usr/bin/env npx tsx

/**
 * Script to force load all default tools into the database
 * Even if some tools already exist
 */

import { PostgreSQLAdapter } from '../src/database/adapters/postgresql';
import { ExternalToolManager } from '../src/orchestration/external-tool-manager';
import { Logger } from '../src/utils/logger';

async function forceLoadTools() {
  const logger = Logger.getInstance();
  
  try {
    logger.info('🔧 Force loading ALL default tools into CodeMind database...');
    
    // Initialize database
    const db = new PostgreSQLAdapter({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'codemind',
      username: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123',
      ssl: false
    }, logger);
    
    await db.initialize();
    
    // Delete existing tools to force reload
    logger.info('🗑️ Clearing existing tools...');
    await db.query('DELETE FROM external_tools');
    
    // Initialize tool manager
    const toolManager = new ExternalToolManager(db as any);
    await toolManager.initialize();
    
    // Check tools loaded
    const availableTools = await toolManager.getAvailableTools();
    
    logger.info(`✅ Successfully loaded ${availableTools.length} default tools`);
    
    // Show detailed tool information
    const categories = [...new Set(availableTools.map(t => t.category))];
    for (const category of categories) {
      const toolsInCategory = availableTools.filter(t => t.category === category);
      logger.info(`📁 ${category}:`);
      for (const tool of toolsInCategory) {
        logger.info(`  - ${tool.name} (${tool.id}) - ${tool.trustLevel} - ${tool.languages.join(', ')}`);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Failed to force load tools:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  forceLoadTools();
}

export { forceLoadTools };