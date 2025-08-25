#!/usr/bin/env tsx
/**
 * Database teardown script for CodeMind
 * Safely removes database and all data
 */

import { Client } from 'pg';
import { existsSync, unlinkSync } from 'fs';
import { DatabaseFactory } from '../src/database/factory';
import { Logger, LogLevel } from '../src/utils/logger';

async function teardownDatabase() {
  const logger = new Logger(LogLevel.INFO, 'DB-Teardown');
  
  try {
    logger.info('🧹 Starting database teardown...');

    const config = DatabaseFactory.parseConfigFromEnv();
    await teardownPostgreSQL(config, logger);

    logger.info('🎉 Database teardown completed!');

  } catch (error) {
    logger.error('❌ Database teardown failed:', error);
    process.exit(1);
  }
}

async function teardownPostgreSQL(config: any, logger: Logger) {
  logger.info('🗑️  Tearing down PostgreSQL database...');
  
  const dbName = config.database || 'codemind';
  
  // Connect to postgres database to drop the target database
  const adminClient = new Client({
    connectionString: config.connectionString?.replace(`/${dbName}`, '/postgres') || undefined,
    host: config.host,
    port: config.port,
    database: 'postgres', // Connect to postgres database
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });

  try {
    await adminClient.connect();
    
    // Terminate existing connections to the target database
    logger.info(`🔌 Terminating connections to database: ${dbName}`);
    await adminClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);

    // Drop the database
    logger.info(`🗑️  Dropping database: ${dbName}`);
    await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    
    logger.info('✅ PostgreSQL database dropped successfully');
    
  } catch (error) {
    // If database doesn't exist, that's okay
    if (error instanceof Error && error.message.includes('does not exist')) {
      logger.info('ℹ️  Database does not exist, nothing to drop');
    } else {
      throw error;
    }
  } finally {
    await adminClient.end();
  }

  // Optionally recreate empty database
  if (process.argv.includes('--recreate')) {
    logger.info(`🏗️  Recreating database: ${dbName}`);
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${dbName}" OWNER "${config.username || 'codemind'}"`);
    await adminClient.end();
    logger.info('✅ Database recreated');
  }
}


async function cleanupData() {
  const logger = new Logger(LogLevel.INFO, 'DB-Cleanup');
  
  try {
    logger.info('🧹 Cleaning up data (keeping schema)...');
    
    const config = DatabaseFactory.parseConfigFromEnv();
    const db = DatabaseFactory.create(config, logger);
    
    await db.initialize();
    
    // Clean all data but keep schema
    const pgDb = db as any; // PostgreSQL adapter
    const client = await (pgDb as any).pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Delete in order to respect foreign keys
        const tables = [
          'operation_metrics',
          'resume_state',
          'analysis_results',
          'questionnaire_responses',
          'detected_patterns',
          'initialization_progress',
          'project_paths',
          'system_config',
          'projects'
        ];
        
        for (const table of tables) {
          await client.query(`DELETE FROM ${table}`);
          logger.info(`  Cleared table: ${table}`);
        }
        
        // Reset sequences
        await client.query(`
          SELECT setval(pg_get_serial_sequence(schemaname||'.'||tablename, columnname), 1, false)
          FROM pg_tables t
          JOIN pg_attribute a ON a.attrelid = (t.schemaname||'.'||t.tablename)::regclass
          WHERE t.schemaname = 'public'
          AND a.atthasdef
          AND pg_get_expr(a.atthasdef, a.attrelid) LIKE 'nextval%'
        `);
        
        await client.query('COMMIT');
        logger.info('✅ Data cleanup completed');
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    
    await db.close();
    
  } catch (error) {
    logger.error('❌ Data cleanup failed:', error);
    process.exit(1);
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'full':
    case 'teardown':
    case undefined:
      await teardownDatabase();
      break;
    
    case 'clean':
      await cleanupData();
      break;
      
    case 'reset':
      await teardownDatabase();
      // Import and run setup
      const { setupDatabase } = await import('./db-setup');
      await setupDatabase();
      break;
      
    default:
      console.log(`
CodeMind Database Teardown

Usage: tsx scripts/db-teardown.ts [command]

Commands:
  full      - Complete database teardown (default)
  teardown  - Same as full
  clean     - Clear all data but keep schema
  reset     - Teardown + setup (full reset)

Options:
  --recreate  - Recreate empty database after teardown (PostgreSQL only)

Environment Variables:
  DATABASE_URL      - PostgreSQL connection string
  DB_HOST           - PostgreSQL host
  DB_PORT           - PostgreSQL port
  DB_NAME           - Database name
  DB_USER           - Database user
  DB_PASSWORD       - Database password

Examples:
  tsx scripts/db-teardown.ts full
  tsx scripts/db-teardown.ts clean
  tsx scripts/db-teardown.ts teardown --recreate
      `);
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}