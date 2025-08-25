#!/usr/bin/env ts-node

import * as path from 'path';
import * as fs from 'fs/promises';
import { Phase2Migration } from '../src/database/migrations/002_phase2_features';
import { Logger } from '../src/utils/logger';

/**
 * Script to set up Phase 2 database schema
 * 
 * Usage: 
 *   npm run setup:phase2-db
 *   or
 *   ts-node scripts/setup-phase2-db.ts [database-path]
 */

const logger = Logger.getInstance();

async function setupPhase2Database(dbPath?: string): Promise<void> {
  const databasePath = dbPath || path.join(process.cwd(), 'codemind.db');
  
  logger.info(`Setting up Phase 2 database at: ${databasePath}`);
  
  try {
    // Ensure directory exists
    const dbDir = path.dirname(databasePath);
    await fs.mkdir(dbDir, { recursive: true });
    
    // Run Phase 2 migration
    const migration = new Phase2Migration(databasePath);
    await migration.up();
    migration.close();
    
    console.log('✅ Phase 2 database setup complete!');
    console.log(`   Database: ${databasePath}`);
    console.log('   Tables created:');
    console.log('   - cli_interactions');
    console.log('   - advanced_duplications');
    console.log('   - dependency_cache');
    console.log('   - code_embeddings');
    console.log('   - centralization_analysis');
    console.log('   - feature_performance');
    console.log('   - self_improvement');
    console.log('');
    console.log('   Views created:');
    console.log('   - cli_usage_stats');
    console.log('   - duplication_impact');
    console.log('   - centralization_potential');
    console.log('   - feature_performance_summary');
    console.log('   - self_improvement_progress');
    console.log('');
    console.log('🚀 Ready for Phase 2 feature usage!');
    
  } catch (error) {
    logger.error('Failed to setup Phase 2 database', error as Error);
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dbPath = args[0];
  
  setupPhase2Database(dbPath);
}

export { setupPhase2Database };