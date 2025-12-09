const { Pool } = require('pg');

async function verifySchema() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'codemind',
    user: 'codemind',
    password: 'codemind123'
  });

  try {
    // Check indexes on semantic_search_embeddings
    const indexResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'semantic_search_embeddings'
      ORDER BY indexname
    `);

    console.log('Indexes on semantic_search_embeddings:');
    indexResult.rows.forEach(row => {
      console.log('  -', row.indexname);
    });

    // Check if tsvector trigger exists
    const triggerResult = await pool.query(`
      SELECT trigger_name, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_table = 'semantic_search_embeddings'
    `);

    console.log('\nTriggers on semantic_search_embeddings:');
    triggerResult.rows.forEach(row => {
      console.log('  -', row.trigger_name, '(' + row.event_manipulation + ')');
    });

    // Check schema version
    const versionResult = await pool.query(`
      SELECT config_value FROM system_config WHERE config_key = 'postgres_version'
    `);

    console.log('\nSchema version:', versionResult.rows[0]?.config_value || 'not set');

    // Check row count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM semantic_search_embeddings
    `);

    console.log('Total embeddings:', countResult.rows[0].count);

    console.log('\n✅ Schema verification complete!');

  } catch (error) {
    console.error('Verification failed:', error.message);
  } finally {
    await pool.end();
  }
}

verifySchema();
