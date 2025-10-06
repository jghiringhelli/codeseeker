#!/usr/bin/env node

const { Pool } = require('pg');

async function testPostgreSQL() {
  console.log('Testing PostgreSQL connection...');
  
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'codemind',
    user: 'codemind',
    password: 'codemind123'
  });

  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    
    console.log('Connected! Testing query...');
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('Database info:', result.rows[0]);
    
    // Test if tree_navigation_data table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tree_navigation_data'
      )
    `);
    console.log('tree_navigation_data table exists:', tableCheck.rows[0].exists);
    
    client.release();
    console.log('✅ PostgreSQL test successful');
    
  } catch (error) {
    console.error('❌ PostgreSQL test failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testPostgreSQL();