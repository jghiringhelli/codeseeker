#!/usr/bin/env node

/**
 * CodeMind Project Synchronization Script
 *
 * Synchronizes project changes with databases
 * Updates embeddings, Neo4j graph, and analysis data
 *
 * Usage: node scripts/sync.js [options]
 * Options:
 *   --full           Full resync (default: incremental)
 *   --skip-embeddings Skip embedding updates
 *   --skip-graph     Skip Neo4j graph updates
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Pool } = require('pg');
const neo4j = require('neo4j-driver');
const crypto = require('crypto');

class ProjectSync {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.fullSync = options.full || false;
    this.skipEmbeddings = options.skipEmbeddings || false;
    this.skipGraph = options.skipGraph || false;

    // Database configurations
    this.pgConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'codemind',
      user: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123'
    };

    this.neo4jConfig = {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'codemind123'
    };

    this.pgPool = null;
    this.neo4jDriver = null;
    this.changes = { added: [], modified: [], deleted: [] };
  }

  async run() {
    console.log(chalk.blue.bold('🔄 CodeMind Project Synchronization'));
    console.log(chalk.gray(`Project: ${this.projectPath}`));
    console.log(chalk.gray(`Mode: ${this.fullSync ? 'Full sync' : 'Incremental sync'}\n`));

    try {
      // Connect to databases
      await this.connectDatabases();

      // Get project info
      const project = await this.getProject();
      if (!project) {
        console.log(chalk.red('❌ Project not initialized. Run "npm run init" first.'));
        process.exit(1);
      }

      // Detect changes
      if (!this.fullSync) {
        await this.detectChanges(project.id);
      } else {
        await this.scanAllFiles();
      }

      // Sync changes
      if (this.changes.added.length + this.changes.modified.length + this.changes.deleted.length === 0) {
        console.log(chalk.green('✅ No changes to sync'));
        return;
      }

      console.log(chalk.yellow(`\n📝 Changes detected:`));
      console.log(chalk.gray(`  Added: ${this.changes.added.length} files`));
      console.log(chalk.gray(`  Modified: ${this.changes.modified.length} files`));
      console.log(chalk.gray(`  Deleted: ${this.changes.deleted.length} files`));

      // Update databases
      if (!this.skipEmbeddings) {
        await this.syncEmbeddings(project.id);
      }

      if (!this.skipGraph) {
        await this.syncNeo4jGraph(project.id);
      }

      // Update metadata
      await this.updateProjectMetadata(project.id);

      console.log(chalk.green.bold('\n✅ Synchronization completed successfully!'));

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Sync failed:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async connectDatabases() {
    console.log(chalk.yellow('📡 Connecting to databases...'));

    // PostgreSQL
    this.pgPool = new Pool(this.pgConfig);
    try {
      await this.pgPool.query('SELECT 1');
      console.log(chalk.green('  ✅ PostgreSQL connected'));
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }

    // Neo4j
    if (!this.skipGraph) {
      this.neo4jDriver = neo4j.driver(
        this.neo4jConfig.uri,
        neo4j.auth.basic(this.neo4jConfig.username, this.neo4jConfig.password)
      );
      try {
        await this.neo4jDriver.verifyConnectivity();
        console.log(chalk.green('  ✅ Neo4j connected'));
      } catch (error) {
        console.log(chalk.yellow('  ⚠ Neo4j not available - skipping graph sync'));
        this.skipGraph = true;
      }
    }
  }

  async getProject() {
    const result = await this.pgPool.query(
      'SELECT id, project_name FROM projects WHERE project_path = $1',
      [this.projectPath]
    );
    return result.rows[0];
  }

  async detectChanges(projectId) {
    console.log(chalk.yellow('\n🔍 Detecting changes...'));

    // Get stored file hashes
    const storedFiles = await this.getStoredFileHashes(projectId);

    // Scan current files
    const currentFiles = new Map();
    const files = await this.scanProjectFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const hash = crypto.createHash('md5').update(content).digest('hex');
        currentFiles.set(file.path, hash);

        if (!storedFiles.has(file.path)) {
          this.changes.added.push(file);
        } else if (storedFiles.get(file.path) !== hash) {
          this.changes.modified.push(file);
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Check for deleted files
    for (const [path, hash] of storedFiles) {
      if (!currentFiles.has(path)) {
        this.changes.deleted.push({ path });
      }
    }
  }

  async scanAllFiles() {
    console.log(chalk.yellow('\n🔍 Scanning all files (full sync)...'));
    const files = await this.scanProjectFiles();
    this.changes.added = files;
  }

  async getStoredFileHashes(projectId) {
    const result = await this.pgPool.query(
      'SELECT file_path, content_hash FROM semantic_search_embeddings WHERE project_id = $1',
      [projectId]
    );

    const hashes = new Map();
    result.rows.forEach(row => {
      hashes.set(row.file_path, row.content_hash);
    });
    return hashes;
  }

  async scanProjectFiles() {
    const files = [];
    const includeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.json', '.md'];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];

    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectPath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            await scan.call(this, fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (includeExtensions.includes(ext)) {
            files.push({
              path: relativePath,
              fullPath: fullPath,
              name: entry.name,
              extension: ext
            });
          }
        }
      }
    }

    await scan.call(this, this.projectPath);
    return files;
  }

  async syncEmbeddings(projectId) {
    console.log(chalk.yellow('\n🔍 Syncing embeddings...'));

    // Delete removed files
    for (const file of this.changes.deleted) {
      await this.pgPool.query(
        'DELETE FROM semantic_search_embeddings WHERE project_id = $1 AND file_path = $2',
        [projectId, file.path]
      );
    }

    // Update added and modified files
    const filesToUpdate = [...this.changes.added, ...this.changes.modified];
    let processed = 0;

    for (const file of filesToUpdate) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const hash = crypto.createHash('md5').update(content).digest('hex');

        // Upsert file embedding (simplified for MVP)
        await this.pgPool.query(`
          INSERT INTO semantic_search_embeddings
          (project_id, file_path, content_hash, chunk_index, chunk_text, created_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (project_id, file_path, chunk_index)
          DO UPDATE SET
            content_hash = $3,
            chunk_text = $5,
            updated_at = CURRENT_TIMESTAMP
        `, [projectId, file.path, hash, 0, content.substring(0, 1000)]);

        processed++;
        if (processed % 10 === 0) {
          console.log(chalk.gray(`  Processed ${processed}/${filesToUpdate.length} files...`));
        }
      } catch (error) {
        console.log(chalk.yellow(`  ⚠ Skipped ${file.path}: ${error.message}`));
      }
    }

    console.log(chalk.green(`  ✅ Synced ${processed} embeddings`));
  }

  async syncNeo4jGraph(projectId) {
    if (!this.neo4jDriver) return;

    console.log(chalk.yellow('\n🕸️  Syncing Neo4j graph...'));
    const session = this.neo4jDriver.session();

    try {
      // Delete removed files
      for (const file of this.changes.deleted) {
        await session.run(
          'MATCH (f:File {path: $path, projectId: $projectId}) DETACH DELETE f',
          { path: file.path, projectId }
        );
      }

      // Update added and modified files
      const filesToUpdate = [...this.changes.added, ...this.changes.modified];

      for (const file of filesToUpdate) {
        // Create or update file node
        await session.run(`
          MERGE (f:File {path: $path, projectId: $projectId})
          SET f.name = $name,
              f.extension = $extension,
              f.updatedAt = datetime()
        `, {
          path: file.path,
          name: file.name,
          extension: file.extension,
          projectId
        });

        // Link to project
        await session.run(`
          MATCH (p:Project {projectId: $projectId})
          MATCH (f:File {path: $path, projectId: $projectId})
          MERGE (p)-[:CONTAINS]->(f)
        `, { projectId, path: file.path });
      }

      console.log(chalk.green(`  ✅ Synced ${filesToUpdate.length} files in Neo4j`));

    } finally {
      await session.close();
    }
  }

  async updateProjectMetadata(projectId) {
    console.log(chalk.yellow('\n📊 Updating project metadata...'));

    const metadata = {
      lastSync: new Date().toISOString(),
      filesAdded: this.changes.added.length,
      filesModified: this.changes.modified.length,
      filesDeleted: this.changes.deleted.length
    };

    await this.pgPool.query(`
      INSERT INTO project_metadata (project_id, metadata_key, metadata_value)
      VALUES ($1, 'last_sync', $2)
      ON CONFLICT (project_id, metadata_key)
      DO UPDATE SET metadata_value = $2
    `, [projectId, JSON.stringify(metadata)]);

    console.log(chalk.green('  ✅ Metadata updated'));
  }

  async cleanup() {
    if (this.pgPool) await this.pgPool.end();
    if (this.neo4jDriver) await this.neo4jDriver.close();
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    full: false,
    skipEmbeddings: false,
    skipGraph: false,
    projectPath: process.cwd()
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--full':
        options.full = true;
        break;
      case '--skip-embeddings':
        options.skipEmbeddings = true;
        break;
      case '--skip-graph':
        options.skipGraph = true;
        break;
      case '--project-path':
        if (args[i + 1]) {
          options.projectPath = path.resolve(args[i + 1]);
          i++;
        }
        break;
      case '--help':
        console.log(chalk.cyan('CodeMind Project Sync'));
        console.log(chalk.gray('\nUsage: node scripts/sync.js [options]'));
        console.log(chalk.gray('\nOptions:'));
        console.log(chalk.gray('  --full            Full resync'));
        console.log(chalk.gray('  --skip-embeddings Skip embedding updates'));
        console.log(chalk.gray('  --skip-graph      Skip Neo4j updates'));
        console.log(chalk.gray('  --help            Show this help'));
        process.exit(0);
    }
  }

  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  const sync = new ProjectSync(options);
  sync.run().catch(error => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { ProjectSync };