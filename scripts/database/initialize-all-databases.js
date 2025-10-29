#!/usr/bin/env node

/**
 * Complete Database Initialization Script for CodeMind
 * Initializes: PostgreSQL, MongoDB, Neo4j, Redis, DuckDB
 * Creates all necessary tables, collections, indexes, and foundation data
 */

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

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

// Initialize PostgreSQL
async function initializePostgreSQL() {
  console.log(chalk.blue('📘 Initializing PostgreSQL...'));
  const pgClient = new Pool(config.postgres);
  
  try {
    // Read and execute schema file
    const schemaPath = path.join(__dirname, '..', 'src', 'database', 'schema.postgres.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Split by statements and execute
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await pgClient.query(statement);
      }
    }
    
    console.log(chalk.green('✅ PostgreSQL initialized successfully'));
    
    // Insert foundation data
    await pgClient.query(`
      INSERT INTO projects (id, project_name, project_path, status, languages, frameworks, project_type, created_at)
      VALUES 
        ('00000000-0000-0000-0000-000000000000', 'Default', '/default', 'active', '{}', '{}', 'template', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log(chalk.green('✅ PostgreSQL foundation data inserted'));
    
  } catch (error) {
    console.error(chalk.red('❌ PostgreSQL initialization failed:'), error.message);
    throw error;
  } finally {
    await pgClient.end();
  }
}

// Initialize MongoDB
async function initializeMongoDB() {
  console.log(chalk.blue('📄 Initializing MongoDB...'));
  const client = new MongoClient(config.mongodb.uri);
  
  try {
    await client.connect();
    const db = client.db('codemind');
    
    // Create collections
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
        console.log(chalk.gray(`  Created collection: ${collectionName}`));
      } catch (err) {
        if (err.code !== 48) { // Collection already exists
          throw err;
        }
      }
    }
    
    // Create indexes
    await db.collection('tool_configs').createIndex({ projectId: 1, toolName: 1 }, { unique: true });
    await db.collection('analysis_results').createIndex({ projectId: 1, toolName: 1, timestamp: -1 });
    await db.collection('analysis_results').createIndex({ summary: 'text' });
    await db.collection('project_intelligence').createIndex({ projectId: 1 }, { unique: true });
    await db.collection('knowledge_repository').createIndex({ 
      title: 'text', 
      content: 'text', 
      searchableText: 'text' 
    });
    
    console.log(chalk.green('✅ MongoDB collections and indexes created'));
    
    // Insert foundation data
    const toolConfigs = db.collection('tool_configs');
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
    ]).catch(err => {
      if (err.code !== 11000) throw err; // Ignore duplicate key errors
    });
    
    console.log(chalk.green('✅ MongoDB foundation data inserted'));
    
  } catch (error) {
    console.error(chalk.red('❌ MongoDB initialization failed:'), error.message);
    throw error;
  } finally {
    await client.close();
  }
}

// Initialize Neo4j
async function initializeNeo4j() {
  console.log(chalk.blue('🔗 Initializing Neo4j...'));
  const driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
  );
  
  try {
    const session = driver.session();
    
    // Create constraints and indexes
    const queries = [
      'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT file_path IF NOT EXISTS FOR (f:File) REQUIRE (f.projectId, f.path) IS UNIQUE',
      'CREATE CONSTRAINT class_name IF NOT EXISTS FOR (c:Class) REQUIRE (c.projectId, c.name) IS UNIQUE',
      'CREATE CONSTRAINT function_name IF NOT EXISTS FOR (fn:Function) REQUIRE (fn.projectId, fn.name, fn.file) IS UNIQUE',
      'CREATE INDEX project_name IF NOT EXISTS FOR (p:Project) ON (p.name)',
      'CREATE INDEX file_type IF NOT EXISTS FOR (f:File) ON (f.type)',
      'CREATE INDEX class_type IF NOT EXISTS FOR (c:Class) ON (c.type)',
      'CREATE INDEX function_exported IF NOT EXISTS FOR (fn:Function) ON (fn.exported)'
    ];
    
    for (const query of queries) {
      try {
        await session.run(query);
        console.log(chalk.gray(`  Executed: ${query.substring(0, 50)}...`));
      } catch (err) {
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }
    
    console.log(chalk.green('✅ Neo4j constraints and indexes created'));
    
    // Create foundation nodes
    await session.run(`
      MERGE (p:Project {id: 'default'})
      SET p.name = 'Default Project',
          p.createdAt = datetime(),
          p.status = 'template'
    `);
    
    console.log(chalk.green('✅ Neo4j foundation data inserted'));
    
    await session.close();
  } catch (error) {
    console.error(chalk.red('❌ Neo4j initialization failed:'), error.message);
    throw error;
  } finally {
    await driver.close();
  }
}

// Initialize Redis
async function initializeRedis() {
  console.log(chalk.blue('⚡ Initializing Redis...'));
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
    
    console.log(chalk.green('✅ Redis initialized with queues and channels'));
    
  } catch (error) {
    console.error(chalk.red('❌ Redis initialization failed:'), error.message);
    throw error;
  } finally {
    redis.disconnect();
  }
}

// Initialize DuckDB (create directory structure)
async function initializeDuckDB() {
  console.log(chalk.blue('📊 Initializing DuckDB directories...'));
  
  try {
    // Create .codemind directory for analytics databases
    const dirs = [
      path.join(process.cwd(), '.codemind'),
      path.join(process.cwd(), '.codemind', 'analytics'),
      path.join(process.cwd(), '.codemind', 'cache')
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
      console.log(chalk.gray(`  Created directory: ${dir}`));
    }
    
    console.log(chalk.green('✅ DuckDB directories created'));
    
  } catch (error) {
    console.error(chalk.red('❌ DuckDB initialization failed:'), error.message);
    throw error;
  }
}

// Test connections
async function testConnections() {
  console.log(chalk.blue('\n🔍 Testing database connections...'));
  
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
    console.log(chalk.yellow('⚠️  PostgreSQL connection failed'));
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
    console.log(chalk.yellow('⚠️  MongoDB connection failed'));
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
    console.log(chalk.yellow('⚠️  Neo4j connection failed'));
  }
  
  // Test Redis
  try {
    const redis = new Redis(config.redis);
    await redis.ping();
    redis.disconnect();
    results.redis = true;
    console.log(chalk.green('✅ Redis connection successful'));
  } catch (err) {
    console.log(chalk.yellow('⚠️  Redis connection failed'));
  }
  
  return results;
}

// Main execution
async function main() {
  console.log(chalk.bold.cyan('\n🚀 CodeMind Database Initialization\n'));
  
  // Test connections first
  const connections = await testConnections();
  
  console.log(chalk.blue('\n📦 Starting initialization...\n'));
  
  // Initialize databases that are available
  const tasks = [];
  
  if (connections.postgres) {
    tasks.push(initializePostgreSQL());
  } else {
    console.log(chalk.yellow('⏭️  Skipping PostgreSQL (not connected)'));
  }
  
  if (connections.mongodb) {
    tasks.push(initializeMongoDB());
  } else {
    console.log(chalk.yellow('⏭️  Skipping MongoDB (not connected)'));
  }
  
  if (connections.neo4j) {
    tasks.push(initializeNeo4j());
  } else {
    console.log(chalk.yellow('⏭️  Skipping Neo4j (not connected)'));
  }
  
  if (connections.redis) {
    tasks.push(initializeRedis());
  } else {
    console.log(chalk.yellow('⏭️  Skipping Redis (not connected)'));
  }
  
  // Always initialize DuckDB directories
  tasks.push(initializeDuckDB());
  
  // Execute all initialization tasks
  try {
    await Promise.all(tasks);
    
    console.log(chalk.bold.green('\n✨ All databases initialized successfully!\n'));
    console.log(chalk.gray('You can now run: npm run dashboard or docker-compose up'));
    
  } catch (error) {
    console.error(chalk.bold.red('\n❌ Initialization failed!\n'));
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { main, testConnections };