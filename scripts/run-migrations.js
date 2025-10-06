#!/usr/bin/env node
/**
 * Standalone Database Migration Runner
 * Runs independently from the main application code
 * Usage: node scripts/run-migrations.js
 */

const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('🔄 CodeMind Database Migration Runner');
  console.log('=====================================\n');

  try {
    // Import database connections
    const { DatabaseConnections } = require('../dist/config/database-config');
    const dbConnections = new DatabaseConnections();
    const pgClient = await dbConnections.getPostgresConnection();

    console.log('✅ Connected to PostgreSQL\n');

    // Check current migration state
    console.log('📋 Checking migration status...');

    const migrationCheck = await pgClient.query(`
      SELECT config_key, config_value
      FROM system_config
      WHERE config_key LIKE 'migration_%_applied'
      ORDER BY config_key
    `);

    const appliedMigrations = new Set(
      migrationCheck.rows
        .filter(row => row.config_value === 'true' || row.config_value === true)
        .map(row => row.config_key.replace('migration_', '').replace('_applied', ''))
    );

    console.log(`Current applied migrations: ${appliedMigrations.size > 0 ? Array.from(appliedMigrations).join(', ') : 'None'}\n`);

    // Check for migration 002
    const migration002Path = path.join(__dirname, '..', 'database-migrations', '002-fix-enhanced-init-schema.sql');

    if (!appliedMigrations.has('002') && fs.existsSync(migration002Path)) {
      console.log('🚀 Applying Migration 002: Enhanced Init Schema Fix');
      console.log('   - Fix analysis_results table (add updated_at, unique constraints)');
      console.log('   - Fix semantic_search_embeddings table (add missing columns)');
      console.log('   - Add new analysis types and configuration');

      const migrationSQL = fs.readFileSync(migration002Path, 'utf8');

      // Execute migration in transaction
      await pgClient.query('BEGIN');

      try {
        // Execute the migration SQL
        await pgClient.query(migrationSQL);
        await pgClient.query('COMMIT');

        console.log('✅ Migration 002 applied successfully!\n');

      } catch (migrationError) {
        await pgClient.query('ROLLBACK');
        throw new Error(`Migration 002 failed: ${migrationError.message}`);
      }
    } else if (appliedMigrations.has('002')) {
      console.log('✅ Migration 002 already applied\n');
    } else {
      console.log('⚠ Migration 002 file not found, skipping\n');
    }

    // Close connection
    await dbConnections.closeAll();

    console.log('🎉 Migration run completed successfully!');
    console.log('\nYou can now run /init and it should work without schema errors.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Self-executing
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };