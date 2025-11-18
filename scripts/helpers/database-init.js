#!/usr/bin/env node

/**
 * Database Initialization Helper
 * Handles initialization of all CodeMind databases
 */

const { Pool } = require('pg');
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

// Test all database connections
async function testConnections() {
  const results = {
    postgres: false,
    neo4j: false,
    redis: false
  };
  
  // Test PostgreSQL
  try {
    const pgConfig = {
      ...config.postgres,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
      statement_timeout: 5000,
      idle_in_transaction_session_timeout: 5000
    };
    const pgClient = new Pool(pgConfig);
    await pgClient.query('SELECT 1');
    await pgClient.end();
    results.postgres = true;
  } catch (err) {
    console.log(chalk.yellow(`    PostgreSQL: ${err.message}`));
    if (err.code === 'ECONNREFUSED') {
      console.log(chalk.gray(`      → Check if PostgreSQL is running on port ${config.postgres.port}`));
    } else if (err.code === '28P01' || err.code === '28000') {
      console.log(chalk.gray(`      → Check username/password: ${config.postgres.user}/${config.postgres.password}`));
    }
  }

  // Test Neo4j
  try {
    const driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
      {
        connectionTimeout: 5000,
        maxConnectionLifetime: 5000
      }
    );
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    await driver.close();
    results.neo4j = true;
  } catch (err) {
    console.log(chalk.yellow(`    Neo4j: ${err.message}`));
  }

  // Test Redis
  try {
    const redis = new Redis({
      ...config.redis,
      connectTimeout: 5000,
      commandTimeout: 5000
    });
    await redis.ping();
    redis.disconnect();
    results.redis = true;
  } catch (err) {
    console.log(chalk.yellow(`    Redis: ${err.message}`));
  }
  
  return results;
}

// Initialize PostgreSQL
async function initializePostgreSQL() {
  const pgClient = new Pool(config.postgres);
  
  try {
    // Read and execute schema file
    const schemaPath = path.join(__dirname, '..', '..', 'src', 'database', 'schema.postgres.sql');
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
    
    return { success: true };
    
  } finally {
    await pgClient.end();
  }
}

// MongoDB initialization removed - no longer used

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
    
    await session.close();
    return { success: true };
    
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
    await redis.ltrim('codemind:queue:analysis', 0, 0);
    
    return { success: true };
    
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
  
  return { success: true };
}

// Main function to initialize all databases
async function main() {
  console.log(chalk.blue('🗄️  Initializing databases...'));
  
  // Test connections first
  const connections = await testConnections();
  
  // Initialize databases that are available
  const results = {};
  
  if (connections.postgres) {
    try {
      await initializePostgreSQL();
      results.postgres = { success: true };
      console.log(chalk.green('✅ PostgreSQL initialized'));
    } catch (error) {
      results.postgres = { success: false, error: error.message };
      console.log(chalk.red('❌ PostgreSQL failed'));
    }
  }
  
  // MongoDB removed from project
  
  if (connections.neo4j) {
    try {
      await initializeNeo4j();
      results.neo4j = { success: true };
      console.log(chalk.green('✅ Neo4j initialized'));
    } catch (error) {
      results.neo4j = { success: false, error: error.message };
      console.log(chalk.red('❌ Neo4j failed'));
    }
  }
  
  if (connections.redis) {
    try {
      await initializeRedis();
      results.redis = { success: true };
      console.log(chalk.green('✅ Redis initialized'));
    } catch (error) {
      results.redis = { success: false, error: error.message };
      console.log(chalk.red('❌ Redis failed'));
    }
  }
  
  // Always initialize DuckDB directories
  try {
    await initializeDuckDB();
    results.duckdb = { success: true };
    console.log(chalk.green('✅ DuckDB directories created'));
  } catch (error) {
    results.duckdb = { success: false, error: error.message };
    console.log(chalk.red('❌ DuckDB failed'));
  }
  
  return results;
}

module.exports = {
  main,
  testConnections,
  initializePostgreSQL,
  initializeNeo4j,
  initializeRedis,
  initializeDuckDB
};