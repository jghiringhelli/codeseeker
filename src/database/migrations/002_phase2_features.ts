import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Logger } from '../../utils/logger';

/**
 * Migration 002: Phase 2 Feature Tables
 * 
 * This migration adds all database tables required for Phase 2 features:
 * - CLI interaction tracking
 * - Advanced duplication detection
 * - Tree navigation cache
 * - Vector embeddings for semantic search
 * - Centralization analysis
 * - Performance metrics
 * - Self-improvement tracking
 */
export class Phase2Migration {
  private logger = Logger?.getInstance();
  private db: Database.Database;

  constructor(databasePath: string) {
    this.db = new Database(databasePath);
    this.db?.pragma('journal_mode = WAL');
    this.db?.pragma('foreign_keys = ON');
  }

  async up(): Promise<void> {
    this.logger.info('Running Phase 2 migration...');
    
    try {
      // Read the schema file
      const schemaPath = path?.join(__dirname, '..', 'schema-phase2.sql');
      const schemaSql = await fs?.readFile(schemaPath, 'utf-8');
      
      // Split by statements (simple approach - may need refinement for complex SQL)
      const statements = schemaSql
        .split(';')
        .map(s => s?.trim())
        .filter(s => s?.length > 0 && !s?.startsWith('--'));
      
      // Execute each statement in a transaction
      const transaction = this.db?.transaction((statements: string[]) => {
        for (const statement of statements) {
          try {
            this.db?.prepare(statement + ';').run();
            this.logger.debug(`Executed: ${statement?.substring(0, 50)}...`);
          } catch (error) {
            // Check if it's a "already exists" error and continue
            if (error instanceof Error && error.message?.includes('already exists')) {
              this.logger.debug(`Table/index already exists, skipping: ${statement?.substring(0, 50)}...`);
            } else {
              throw error as Error;
            }
          }
        }
      });
      
      transaction(statements);
      
      // Verify migration
      const tables = this?.verifyTables();
      this.logger.info(`Phase 2 migration completed. Created/verified ${tables?.length} tables.`);
      
      // Record migration
      this?.recordMigration();
      
    } catch (error) {
      this.logger.error('Phase 2 migration failed', error as Error);
      throw error as Error;
    }
  }

  async down(): Promise<void> {
    this.logger.info('Rolling back Phase 2 migration...');
    
    const tables = [
      'cli_interactions',
      'advanced_duplications',
      'dependency_cache',
      'code_embeddings',
      'centralization_analysis',
      'feature_performance',
      'self_improvement'
    ];
    
    const views = [
      'cli_usage_stats',
      'duplication_impact',
      'centralization_potential',
      'feature_performance_summary',
      'self_improvement_progress'
    ];
    
    const transaction = this.db?.transaction(() => {
      // Drop views first
      for (const view of views) {
        try {
          this.db?.prepare(`DROP VIEW IF EXISTS ${view}`).run();
          this.logger.debug(`Dropped view: ${view}`);
        } catch (error) {
          this.logger.warn(`Failed to drop view ${view}:`, error as Error);
        }
      }
      
      // Drop tables
      for (const table of tables) {
        try {
          this.db?.prepare(`DROP TABLE IF EXISTS ${table}`).run();
          this.logger.debug(`Dropped table: ${table}`);
        } catch (error) {
          this.logger.warn(`Failed to drop table ${table}:`, error as Error);
        }
      }
    });
    
    transaction();
    this.logger.info('Phase 2 migration rolled back');
  }

  private verifyTables(): string[] {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    
    const phase2Tables = [
      'cli_interactions',
      'advanced_duplications',
      'dependency_cache',
      'code_embeddings',
      'centralization_analysis',
      'feature_performance',
      'self_improvement'
    ];
    
    const existingTables = tables?.map(t => t.name);
    const missingTables = phase2Tables?.filter(t => !existingTables?.includes(t));
    
    if (missingTables?.length > 0) {
      throw new Error(`Missing tables after migration: ${missingTables?.join(', ')}`);
    }
    
    return phase2Tables;
  }

  private recordMigration(): void {
    // Create migrations table if it doesn't exist
    this.db?.prepare(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Record this migration
    try {
      this.db?.prepare(`
        INSERT INTO migrations (name) VALUES (?)
      `).run('002_phase2_features');
    } catch (error) {
      // Migration already recorded
      this.logger.debug('Migration already recorded');
    }
  }

  close(): void {
    this.db?.close();
  }
}

// CLI interface for running migration
if (require?.main === module) {
  const args = process.argv?.slice(2);
  const command = args[0];
  const dbPath = args[1] || path?.join(process?.cwd(), 'codeseeker.db');
  
  const migration = new Phase2Migration(dbPath);
  
  (async () => {
    try {
      if (command === 'up') {
        await migration?.up();
        console?.log('✅ Phase 2 migration applied successfully');
      } else if (command === 'down') {
        await migration?.down();
        console?.log('✅ Phase 2 migration rolled back successfully');
      } else {
        console?.log('Usage: ts-node 002_phase2_features.ts [up|down] [database_path]');
        process?.exit(1);
      }
    } catch (error) {
      console?.error('❌ Migration failed:', error);
      process?.exit(1);
    } finally {
      migration?.close();
    }
  })();
}

export default Phase2Migration;