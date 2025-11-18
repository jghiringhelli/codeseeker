#!/usr/bin/env node

/**
 * PostgreSQL Connection Diagnostic Script
 * Tests PostgreSQL connection with detailed error reporting
 */

const { Pool, Client } = require('pg');
const chalk = require('chalk');

// Connection configurations to test
const configurations = [
  {
    name: 'Default (localhost)',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'codemind',
      user: 'codemind',
      password: 'codemind123'
    }
  },
  {
    name: '127.0.0.1',
    config: {
      host: '127.0.0.1',
      port: 5432,
      database: 'codemind',
      user: 'codemind',
      password: 'codemind123'
    }
  },
  {
    name: 'Docker host.docker.internal',
    config: {
      host: 'host.docker.internal',
      port: 5432,
      database: 'codemind',
      user: 'codemind',
      password: 'codemind123'
    }
  },
  {
    name: 'Default postgres database',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'codemind',
      password: 'codemind123'
    }
  },
  {
    name: 'No password',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'codemind',
      user: 'codemind'
    }
  },
  {
    name: 'Postgres user',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres'
    }
  }
];

async function testConnection(name, config) {
  console.log(chalk.yellow(`\nTesting: ${name}`));
  console.log(chalk.gray(`  Config: ${JSON.stringify(config, null, 2)}`));

  const client = new Client(config);

  try {
    await client.connect();
    console.log(chalk.green(`  ✓ Connected successfully!`));

    // Test query
    const result = await client.query('SELECT version()');
    console.log(chalk.gray(`  PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`));

    // Check if database exists
    try {
      const dbResult = await client.query("SELECT datname FROM pg_database WHERE datname = 'codemind'");
      if (dbResult.rows.length > 0) {
        console.log(chalk.green(`  ✓ Database 'codemind' exists`));
      } else {
        console.log(chalk.yellow(`  ⚠ Database 'codemind' does not exist`));
      }
    } catch (err) {
      // Ignore if can't check databases
    }

    await client.end();
    return true;
  } catch (err) {
    console.log(chalk.red(`  ✗ Connection failed`));
    console.log(chalk.red(`  Error: ${err.message}`));

    if (err.code === 'ECONNREFUSED') {
      console.log(chalk.yellow(`  → PostgreSQL might not be running on ${config.host}:${config.port}`));
    } else if (err.code === 'ENOTFOUND') {
      console.log(chalk.yellow(`  → Host '${config.host}' not found`));
    } else if (err.code === '28P01') {
      console.log(chalk.yellow(`  → Invalid username/password`));
    } else if (err.code === '3D000') {
      console.log(chalk.yellow(`  → Database '${config.database}' does not exist`));
    } else if (err.code === '28000') {
      console.log(chalk.yellow(`  → Authentication failed for user '${config.user}'`));
    }

    return false;
  }
}

async function checkPostgreSQLService() {
  console.log(chalk.blue.bold('🔍 PostgreSQL Connection Diagnostics\n'));

  // Check if PostgreSQL is running (Windows)
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      const result = execSync('tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL', { encoding: 'utf-8' });
      if (result.includes('postgres.exe')) {
        console.log(chalk.green('✓ PostgreSQL process is running on Windows'));
      } else {
        console.log(chalk.yellow('⚠ PostgreSQL process not found - might be running as a service'));
      }
    } catch (err) {
      // Ignore
    }
  }

  // Check if Docker is running and has postgres container
  try {
    const { execSync } = require('child_process');
    const containers = execSync('docker ps --format "table {{.Names}}\t{{.Ports}}" 2>NUL', { encoding: 'utf-8' });
    console.log(chalk.cyan('\nDocker containers:'));
    console.log(chalk.gray(containers));

    if (containers.includes('5432')) {
      console.log(chalk.green('✓ Found container exposing PostgreSQL port 5432'));
    }
  } catch (err) {
    console.log(chalk.yellow('⚠ Could not check Docker containers'));
  }

  // Test connections
  let successfulConfig = null;

  for (const { name, config } of configurations) {
    const success = await testConnection(name, config);
    if (success && !successfulConfig) {
      successfulConfig = { name, config };
    }
  }

  console.log(chalk.blue.bold('\n📊 Summary:'));
  if (successfulConfig) {
    console.log(chalk.green.bold(`✅ PostgreSQL is accessible!`));
    console.log(chalk.green(`Working configuration: ${successfulConfig.name}`));
    console.log(chalk.cyan('\nTo fix CodeMind, update the connection config:'));
    console.log(chalk.gray(`
Update src/config/database-config.ts:
  postgres: {
    host: '${successfulConfig.config.host}',
    port: ${successfulConfig.config.port},
    database: '${successfulConfig.config.database}',
    user: '${successfulConfig.config.user}',
    password: '${successfulConfig.config.password || ''}'
  }
    `));

    // Create database if needed
    if (successfulConfig.config.database !== 'codemind') {
      console.log(chalk.yellow('\n⚠ Note: You may need to create the codemind database:'));
      console.log(chalk.gray(`
psql -h ${successfulConfig.config.host} -U ${successfulConfig.config.user} -c "CREATE DATABASE codemind;"
      `));
    }
  } else {
    console.log(chalk.red.bold(`❌ Could not connect to PostgreSQL`));
    console.log(chalk.yellow('\nPossible solutions:'));
    console.log(chalk.cyan('1. Start PostgreSQL service:'));
    console.log(chalk.gray('   - Windows: Check Services (services.msc) for PostgreSQL'));
    console.log(chalk.gray('   - Docker: docker-compose up -d postgres'));
    console.log(chalk.cyan('2. Install PostgreSQL if not installed'));
    console.log(chalk.cyan('3. Check firewall/antivirus blocking port 5432'));
  }
}

// Run diagnostics
checkPostgreSQLService().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});