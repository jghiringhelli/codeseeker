#!/usr/bin/env node

/**
 * Simple database initialization for CodeMind project
 */

const { Pool } = require('pg');
const neo4j = require('neo4j-driver');
const Redis = require('ioredis');

async function initializeBasicData() {
  console.log('🚀 Initializing CodeMind project data...\n');
  
  const projectData = {
    id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID for PostgreSQL
    name: 'CodeMind',
    path: 'C:\\workspace\\claude\\CodeMind',
    type: 'cli_tool',
    status: 'active',
    languages: ['TypeScript', 'JavaScript'],
    frameworks: ['Express', 'Node.js', 'Docker']
  };
  
  // Initialize PostgreSQL
  try {
    console.log('📦 Initializing PostgreSQL...');
    const pgClient = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'codemind',
      user: 'codemind',
      password: 'codemind123'
    });
    
    // Insert project data
    await pgClient.query(`
      INSERT INTO projects (id, project_name, project_path, status, languages, frameworks, project_type, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, NOW(), NOW())
      ON CONFLICT (project_path) DO UPDATE SET
        updated_at = NOW(),
        status = $4,
        languages = $5::jsonb,
        frameworks = $6::jsonb;
    `, [
      projectData.id,
      projectData.name,
      projectData.path,
      projectData.status,
      JSON.stringify(projectData.languages),
      JSON.stringify(projectData.frameworks),
      projectData.type
    ]);
    
    console.log('✅ PostgreSQL project data initialized');
    await pgClient.end();
  } catch (err) {
    console.log('⚠️  PostgreSQL error:', err.message);
  }
  
  // Initialize Neo4j
  try {
    console.log('🕸️  Initializing Neo4j...');
    const driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'codemind123')
    );
    const session = driver.session();
    
    // Create project node with proper escaping
    const query = `
      MERGE (p:Project {id: $id})
      SET p.name = $name,
          p.path = $path,
          p.type = $type,
          p.languages = $languages,
          p.frameworks = $frameworks,
          p.createdAt = datetime(),
          p.updatedAt = datetime(),
          p.status = $status
      RETURN p
    `;
    
    const result = await session.run(query, {
      id: projectData.id,
      name: projectData.name,
      path: projectData.path,
      type: projectData.type,
      languages: projectData.languages,
      frameworks: projectData.frameworks,
      status: projectData.status
    });
    
    console.log('✅ Neo4j project node created');
    await session.close();
    await driver.close();
  } catch (err) {
    console.log('⚠️  Neo4j error:', err.message);
  }
  
  // Initialize Redis
  try {
    console.log('🔴 Initializing Redis...');
    const redis = new Redis({
      host: 'localhost',
      port: 6379
    });
    
    await redis.hset('codemind:project:codemind-project', {
      name: projectData.name,
      path: projectData.path,
      type: projectData.type,
      status: projectData.status,
      languages: JSON.stringify(projectData.languages),
      frameworks: JSON.stringify(projectData.frameworks),
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Redis project data cached');
    redis.disconnect();
  } catch (err) {
    console.log('⚠️  Redis error:', err.message);
  }
  
  console.log('\n🎉 Basic CodeMind project data initialization completed!');
}

// Run initialization
initializeBasicData().catch(error => {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
});