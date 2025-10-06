#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function loadToolTables() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'codemind',
    password: 'codemind123',
    database: 'codemind',
  });

  try {
    console.log('🔗 Connecting to PostgreSQL...');
    await client.connect();
    
    console.log('📄 Reading tool-specific-tables.sql...');
    const sqlPath = path.join(__dirname, '..', 'src', 'database', 'tool-specific-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Executing SQL commands...');
    await client.query(sql);
    
    console.log('✅ Tool-specific tables created successfully!');
    
    // Verify the tree_navigation_data table was created
    console.log('🔍 Verifying tree_navigation_data table...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tree_navigation_data'
      ORDER BY ordinal_position;
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ tree_navigation_data table confirmed with columns:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('❌ tree_navigation_data table not found!');
    }
    
  } catch (error) {
    console.error('❌ Error loading tool tables:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

loadToolTables();