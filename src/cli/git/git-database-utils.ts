/**
 * Git Database Utilities
 * Extracted database creation and management functions to reduce git-integration.ts size
 */

import { Logger } from '../../utils/logger';

export class GitDatabaseUtils {
  static async createGitTables(db: any, logger: Logger): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS git_commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        short_hash TEXT NOT NULL,
        message TEXT NOT NULL,
        author TEXT NOT NULL,
        commit_date TIMESTAMP NOT NULL,
        analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_files INTEGER DEFAULT 0,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        significance_score REAL DEFAULT 0,
        auto_committed BOOLEAN DEFAULT FALSE
      )`,

      `CREATE TABLE IF NOT EXISTS git_file_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commit_hash TEXT NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT NOT NULL,
        additions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        significance_factors TEXT,
        FOREIGN KEY (commit_hash) REFERENCES git_commits(hash)
      )`,

      `CREATE TABLE IF NOT EXISTS commit_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commit_hash TEXT NOT NULL,
        duplications_changed INTEGER DEFAULT 0,
        dependencies_changed INTEGER DEFAULT 0,
        complexity_delta REAL DEFAULT 0,
        new_patterns TEXT,
        analysis_metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (commit_hash) REFERENCES git_commits(hash)
      )`,

      `CREATE TABLE IF NOT EXISTS auto_commit_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        conditions TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    try {
      for (const table of tables) {
        await db.execute(table);
      }
      logger.info('Git database tables created successfully');
    } catch (error) {
      logger.error('Failed to create Git database tables:', error);
      throw error;
    }
  }

  static async insertDefaultAutoCommitRules(db: any, logger: Logger): Promise<void> {
    try {
      // Check if there are existing rules
      const existingRules = await db.query(
        'SELECT COUNT(*) as count FROM auto_commit_rules WHERE rule_name = ?',
        ['default_rules']
      );

      if (existingRules[0]?.count === 0) {
        const defaultRules = [
          {
            name: 'default_rules',
            type: 'file_change',
            conditions: JSON.stringify({
              significanceThreshold: 2.0,
              requiresCompilation: true,
              maxFilesChanged: 10
            })
          },
          {
            name: 'critical_fix',
            type: 'significance',
            conditions: JSON.stringify({
              significanceThreshold: 4.0,
              autoStage: true
            })
          }
        ];

        for (const rule of defaultRules) {
          await db.execute(`
            INSERT INTO auto_commit_rules (rule_name, rule_type, conditions)
            VALUES (?, ?, ?)
          `, [rule.name, rule.type, rule.conditions]);
        }

        logger.info('Default auto-commit rules created');
      }
    } catch (error) {
      logger.debug('Failed to create default auto-commit rules (this is normal if using in-memory store)');
    }
  }
}