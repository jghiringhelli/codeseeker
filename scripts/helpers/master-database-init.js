#!/usr/bin/env node

/**
 * CodeMind Master Database Initialization Script
 * 
 * Consolidated script that combines all database initialization functionality:
 * - Tests all database connections
 * - Initializes PostgreSQL, MongoDB, Neo4j, Redis, and DuckDB
 * - Avoids duplicate indexes and collections
 * - Populates databases with foundation data
 * - Runs semantic graph analysis
 * - Provides comprehensive status reporting
 * - Includes tool autodiscovery and project analysis
 */

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

// Import semantic graph and autodiscovery services
let SemanticGraphService, ToolAutodiscoveryService, EnhancedDocumentMapAnalyzer, Logger;
try {
  ({ SemanticGraphService } = require('../dist/services/semantic-graph'));
  ({ ToolAutodiscoveryService } = require('../dist/shared/tool-autodiscovery'));
  ({ EnhancedDocumentMapAnalyzer } = require('../dist/features/documentation/enhanced-map-analyzer'));
  ({ Logger } = require('../dist/shared/logger'));
} catch (error) {
  console.log(chalk.yellow('⚠️  Some advanced features unavailable (build first with: npm run build)'));
}

// Configuration
const config = {
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'codemind',
    user: process.env.DB_USER || 'codemind',
    password: process.env.DB_PASSWORD || 'codemind123'
  },
  mongodb: {
    uri: process.env.MONGO_URI || 
      `mongodb://${process.env.MONGO_USER || 'codemind'}:${process.env.MONGO_PASSWORD || 'codemind123'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/${process.env.MONGO_DB || 'codemind'}?authSource=admin`
  },
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'codemind123'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
};

// Global status tracker
const initStatus = {
  connections: {},
  initialized: {},
  populated: {},
  analyzed: {},
  errors: [],
  stats: {},
  startTime: Date.now(),
  endTime: null
};

// Helper function for safe execution with error tracking
async function safeExecute(name, operation, required = false) {
  try {
    console.log(chalk.blue(`🔄 ${name}...`));
    const result = await operation();
    console.log(chalk.green(`✅ ${name} completed`));
    return result;
  } catch (error) {
    const errorMsg = `${name} failed: ${error.message}`;
    initStatus.errors.push(errorMsg);
    if (required) {
      console.error(chalk.red(`❌ ${errorMsg}`));
      throw error;
    } else {
      console.warn(chalk.yellow(`⚠️  ${errorMsg}`));
      return null;
    }
  }
}

// Test all database connections
async function testConnections() {
  console.log(chalk.blue('\\n🔍 Testing database connections...'));
  
  const results = {
    postgres: false,
    mongodb: false,
    neo4j: false,
    redis: false
  };
  
  // Test PostgreSQL
  try {
    const pgClient = new Pool(config.postgres);
    await pgClient.query('SELECT 1');
    await pgClient.end();
    results.postgres = true;
    console.log(chalk.green('✅ PostgreSQL connection successful'));
  } catch (err) {
    console.log(chalk.yellow(`⚠️  PostgreSQL connection failed: ${err.message}`));
  }
  
  // Test MongoDB
  try {
    const client = new MongoClient(config.mongodb.uri);
    await client.connect();
    await client.db().admin().ping();
    await client.close();
    results.mongodb = true;
    console.log(chalk.green('✅ MongoDB connection successful'));
  } catch (err) {
    console.log(chalk.yellow(`⚠️  MongoDB connection failed: ${err.message}`));
  }
  
  // Test Neo4j
  try {
    const driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
    );
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    await driver.close();
    results.neo4j = true;
    console.log(chalk.green('✅ Neo4j connection successful'));
  } catch (err) {
    console.log(chalk.yellow(`⚠️  Neo4j connection failed: ${err.message}`));
  }
  
  // Test Redis
  try {
    const redis = new Redis(config.redis);
    await redis.ping();
    redis.disconnect();
    results.redis = true;
    console.log(chalk.green('✅ Redis connection successful'));
  } catch (err) {
    console.log(chalk.yellow(`⚠️  Redis connection failed: ${err.message}`));
  }
  
  initStatus.connections = results;
  return results;
}

// Initialize PostgreSQL
async function initializePostgreSQL() {
  const pgClient = new Pool(config.postgres);
  
  try {
    // Read and execute schema file
    const schemaPath = path.join(__dirname, '..', 'src', 'database', 'schema.postgres.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Split by statements and execute, handling duplicates gracefully
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pgClient.query(statement);
        } catch (err) {
          if (!err.message.includes('already exists')) {
            throw err;
          }
        }
      }
    }
    
    // Insert foundation data (ignore duplicates)
    await pgClient.query(`
      INSERT INTO projects (id, project_name, project_path, status, languages, frameworks, project_type, created_at)
      VALUES 
        ('00000000-0000-0000-0000-000000000000', 'Default', '/default', 'active', '{}', '{}', 'template', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
    
    // Get table count for stats
    const result = await pgClient.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
    initStatus.stats.postgresqlTables = parseInt(result.rows[0].count);
    
    initStatus.initialized.postgresql = true;
    initStatus.populated.postgresql = true;
    
  } finally {
    await pgClient.end();
  }
}

// Initialize MongoDB with duplicate handling
async function initializeMongoDB() {
  const client = new MongoClient(config.mongodb.uri);
  
  try {
    await client.connect();
    const db = client.db('codemind');
    
    // Create collections (ignore if exists)
    const collections = [
      'tool_configs',
      'analysis_results', 
      'project_intelligence',
      'knowledge_repository',
      'workflow_states',
      'templates'
    ];
    
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName);
      } catch (err) {
        if (err.code !== 48) { // Collection already exists
          throw err;
        }
      }
    }
    
    // Create indexes with duplicate handling
    const indexOperations = [
      () => db.collection('tool_configs').createIndex({ projectId: 1, toolName: 1 }, { unique: true }),
      () => db.collection('analysis_results').createIndex({ projectId: 1, toolName: 1, timestamp: -1 }),
      () => db.collection('analysis_results').createIndex({ summary: 'text' }),
      () => db.collection('project_intelligence').createIndex({ projectId: 1 }, { unique: true }),
      () => db.collection('knowledge_repository').createIndex({ 
        title: 'text', 
        content: 'text', 
        searchableText: 'text' 
      }, { 
        weights: { 
          title: 10, 
          searchableText: 5, 
          content: 1 
        } 
      })
    ];
    
    for (const operation of indexOperations) {
      try {
        await operation();
      } catch (err) {
        if (err.code !== 85) { // Index already exists
          throw err;
        }
      }
    }
    
    // Insert foundation data (ignore duplicates)
    const toolConfigs = db.collection('tool_configs');
    try {
      await toolConfigs.insertMany([
        {
          projectId: 'default',
          toolName: 'semantic-search',
          config: {
            embeddingModel: 'text-embedding-ada-002',
            chunkSize: 4000,
            overlapSize: 200,
            similarity: 'cosine',
            cacheEnabled: true
          },
          version: '1.0.0',
          updatedAt: new Date()
        },
        {
          projectId: 'default',
          toolName: 'solid-principles',
          config: {
            checkSRP: true,
            checkOCP: true,
            checkLSP: true,
            checkISP: true,
            checkDIP: true,
            severityThreshold: 'medium'
          },
          version: '1.0.0',
          updatedAt: new Date()
        }
      ]);
    } catch (err) {
      if (err.code !== 11000) throw err; // Ignore duplicate key errors
    }
    
    // Get collection stats
    const collections_list = await db.listCollections().toArray();
    initStatus.stats.mongodbCollections = collections_list.length;
    
    initStatus.initialized.mongodb = true;
    initStatus.populated.mongodb = true;
    
  } finally {
    await client.close();
  }
}

// Initialize Neo4j
async function initializeNeo4j() {
  const driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
  );
  
  try {
    const session = driver.session();
    
    // Create constraints and indexes (ignore duplicates)
    const queries = [
      'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT file_path IF NOT EXISTS FOR (f:File) REQUIRE (f.projectId, f.path) IS UNIQUE',
      'CREATE CONSTRAINT class_name IF NOT EXISTS FOR (c:Class) REQUIRE (c.projectId, c.name) IS UNIQUE',
      'CREATE INDEX project_name IF NOT EXISTS FOR (p:Project) ON (p.name)',
      'CREATE INDEX file_type IF NOT EXISTS FOR (f:File) ON (f.type)'
    ];
    
    for (const query of queries) {
      try {
        await session.run(query);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }
    
    // Create foundation nodes
    await session.run(`
      MERGE (p:Project {id: 'default'})
      SET p.name = 'Default Project',
          p.createdAt = datetime(),
          p.status = 'template'
    `);
    
    // Get node stats
    const result = await session.run('MATCH (n) RETURN count(n) as total');
    initStatus.stats.neo4jNodes = result.records[0].get('total').toNumber();
    
    initStatus.initialized.neo4j = true;
    initStatus.populated.neo4j = true;
    
    await session.close();
  } finally {
    await driver.close();
  }
}

// Initialize Redis
async function initializeRedis() {
  const redis = new Redis(config.redis);
  
  try {
    // Set up key patterns and initial values
    await redis.set('codemind:initialized', new Date().toISOString());
    await redis.hset('codemind:config', {
      version: '2.0.0',
      initialized_at: new Date().toISOString()
    });
    
    // Create initial queues
    await redis.lpush('codemind:queue:analysis', JSON.stringify({
      type: 'init',
      timestamp: new Date().toISOString()
    }));
    await redis.ltrim('codemind:queue:analysis', 0, 0); // Keep only the init message
    
    // Set up pub/sub channels
    await redis.publish('codemind:events', JSON.stringify({
      event: 'system_initialized',
      timestamp: new Date().toISOString()
    }));
    
    // Get Redis info for stats
    const info = await redis.info('keyspace');
    initStatus.stats.redisKeys = info.match(/keys=(\d+)/)?.[1] || 0;
    
    initStatus.initialized.redis = true;
    initStatus.populated.redis = true;
    
  } finally {
    redis.disconnect();
  }
}

// Initialize DuckDB directories
async function initializeDuckDB() {
  const dirs = [
    path.join(process.cwd(), '.codemind'),
    path.join(process.cwd(), '.codemind', 'analytics'),
    path.join(process.cwd(), '.codemind', 'cache')
  ];
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  
  initStatus.initialized.duckdb = true;
  initStatus.stats.duckdbDirectories = dirs.length;
}

// Run semantic graph analysis
async function runSemanticAnalysis(projectPath, projectId) {
  if (!SemanticGraphService || !EnhancedDocumentMapAnalyzer) {
    console.log(chalk.yellow('⚠️  Semantic analysis skipped (services not available)'));
    return null;
  }
  
  const semanticGraph = new SemanticGraphService();
  await semanticGraph.initialize();
  
  // Enhanced document analysis
  const analyzer = new EnhancedDocumentMapAnalyzer();
  const analysisParams = {
    projectPath: projectPath,
    includeCodeAnalysis: true,
    maxDepth: 3,
    fileTypes: ['.ts', '.js', '.md', '.json']
  };
  
  const result = await analyzer.analyzeDocumentationWithSemantics(analysisParams);
  
  // Get final statistics
  const stats = await semanticGraph.getGraphStatistics();
  
  initStatus.analyzed.semanticGraph = true;
  initStatus.stats.semanticGraphNodes = stats.total_nodes;
  initStatus.stats.semanticGraphRelationships = stats.total_relationships;
  
  return { result, stats };
}

// Run tool autodiscovery and project analysis
async function runToolAutodiscovery(projectPath, projectId) {
  if (!ToolAutodiscoveryService) {
    console.log(chalk.yellow('⚠️  Tool autodiscovery skipped (service not available)'));
    return null;
  }
  
  const toolService = new ToolAutodiscoveryService();
  await toolService.initializeTools();
  
  // Initialize all tools for the project
  const initResult = await toolService.initializeProjectForAllTools(projectPath, projectId);
  
  // Run comprehensive analysis
  const analysisResult = await toolService.analyzeProjectWithAllTools(projectPath, projectId);
  
  // Get tool status summary
  const toolStatuses = await toolService.getToolsStatus(projectId);
  
  initStatus.analyzed.toolAutodiscovery = true;
  initStatus.stats.toolsInitialized = initResult.results?.size || 0;
  initStatus.stats.recordsCreated = initResult.totalRecordsInserted || 0;
  
  return { initResult, analysisResult, toolStatuses };
}

// Generate comprehensive status report
function generateStatusReport() {
  initStatus.endTime = Date.now();
  const duration = initStatus.endTime - initStatus.startTime;
  
  console.log(chalk.bold.cyan('\\n📊 CODEMIND DATABASE INITIALIZATION REPORT'));
  console.log(chalk.cyan('═'.repeat(60)));
  
  // Connection status
  console.log(chalk.bold.yellow('\\n🔗 DATABASE CONNECTIONS:'));
  Object.entries(initStatus.connections).forEach(([db, connected]) => {
    const status = connected ? chalk.green('✅ Connected') : chalk.red('❌ Failed');
    console.log(`   ${db.padEnd(12)}: ${status}`);
  });
  
  // Initialization status
  console.log(chalk.bold.yellow('\\n🏗️  INITIALIZATION STATUS:'));
  Object.entries(initStatus.initialized).forEach(([db, initialized]) => {
    const status = initialized ? chalk.green('✅ Initialized') : chalk.red('❌ Failed');
    console.log(`   ${db.padEnd(12)}: ${status}`);
  });
  
  // Population status
  console.log(chalk.bold.yellow('\\n📦 DATA POPULATION:'));
  Object.entries(initStatus.populated).forEach(([db, populated]) => {
    const status = populated ? chalk.green('✅ Populated') : chalk.red('❌ Failed');
    console.log(`   ${db.padEnd(12)}: ${status}`);
  });
  
  // Analysis status
  if (Object.keys(initStatus.analyzed).length > 0) {
    console.log(chalk.bold.yellow('\\n🧠 ANALYSIS STATUS:'));
    Object.entries(initStatus.analyzed).forEach(([analysis, completed]) => {
      const status = completed ? chalk.green('✅ Completed') : chalk.red('❌ Failed');
      console.log(`   ${analysis.padEnd(18)}: ${status}`);
    });
  }
  
  // Statistics
  console.log(chalk.bold.yellow('\\n📈 STATISTICS:'));
  Object.entries(initStatus.stats).forEach(([key, value]) => {
    console.log(`   ${key.padEnd(25)}: ${chalk.white(value)}`);
  });
  
  // Errors
  if (initStatus.errors.length > 0) {
    console.log(chalk.bold.red('\\n⚠️  ERRORS:'));
    initStatus.errors.forEach(error => {
      console.log(`   • ${error}`);
    });
  }
  
  // Summary
  console.log(chalk.cyan('\\n═'.repeat(60)));
  console.log(chalk.bold.white(`⏱️  Total Time: ${Math.round(duration / 1000)}s`));
  
  const successCount = Object.values(initStatus.initialized).filter(Boolean).length;
  const totalDbs = Object.keys(initStatus.connections).length + 1; // +1 for DuckDB
  
  if (successCount === totalDbs && initStatus.errors.length === 0) {
    console.log(chalk.bold.green('🎉 ALL SYSTEMS INITIALIZED SUCCESSFULLY!'));
  } else if (successCount > totalDbs / 2) {
    console.log(chalk.bold.yellow('⚠️  PARTIAL SUCCESS - Some components failed'));
  } else {
    console.log(chalk.bold.red('❌ INITIALIZATION INCOMPLETE'));
  }
  
  console.log(chalk.gray('\\nNext steps: npm run dashboard or docker-compose up'));
  console.log(chalk.cyan('═'.repeat(60)));
}

// Main execution
async function main() {
  console.log(chalk.bold.cyan('\\n🚀 CODEMIND MASTER DATABASE INITIALIZATION\\n'));
  
  // Test connections first
  const connections = await testConnections();
  
  console.log(chalk.blue('\\n📦 Starting comprehensive initialization...\\n'));
  
  // Initialize databases that are available
  const tasks = [];
  
  if (connections.postgres) {
    tasks.push(safeExecute('PostgreSQL initialization', () => initializePostgreSQL()));
  }
  
  if (connections.mongodb) {
    tasks.push(safeExecute('MongoDB initialization', () => initializeMongoDB()));
  }
  
  if (connections.neo4j) {
    tasks.push(safeExecute('Neo4j initialization', () => initializeNeo4j()));
  }
  
  if (connections.redis) {
    tasks.push(safeExecute('Redis initialization', () => initializeRedis()));
  }
  
  // Always initialize DuckDB directories
  tasks.push(safeExecute('DuckDB initialization', () => initializeDuckDB()));
  
  // Execute database initialization tasks
  await Promise.all(tasks);
  
  // Run analysis tasks for current project
  const projectPath = process.env.PROJECT_PATH || process.cwd();
  const projectId = process.env.PROJECT_ID || `proj_${Date.now()}`;
  
  console.log(chalk.blue('\\n🧠 Running advanced analysis...\\n'));
  
  // Run semantic analysis
  await safeExecute('Semantic graph analysis', () => runSemanticAnalysis(projectPath, projectId));
  
  // Run tool autodiscovery
  await safeExecute('Tool autodiscovery and analysis', () => runToolAutodiscovery(projectPath, projectId));
  
  // Generate comprehensive report
  generateStatusReport();
}

// Export for use as module
module.exports = { main, testConnections, initStatus };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('\\n💥 Fatal error during initialization:'));
    console.error(error);
    initStatus.errors.push(`Fatal: ${error.message}`);
    generateStatusReport();
    process.exit(1);
  });
}