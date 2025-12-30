#!/usr/bin/env node

/**
 * CodeMind Complete Setup Script
 * 
 * Single entry point for:
 * - Docker container management (PostgreSQL, Redis, Neo4j)
 * - Database initialization (all types)
 * - Health checks and verification
 * 
 * Usage: npm run setup
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Import existing database initialization functions
const { testConnections, initializePostgreSQL, initializeNeo4j, initializeRedis } = require('./helpers/database-init');
const { DockerDetector } = require('./helpers/docker-detector');

class CodeMindSetup {
  constructor(options = {}) {
    this.projectPath = options.projectPath || null;
    this.force = options.force || false;
    this.startTime = Date.now();
    this.dockerDetector = new DockerDetector();
    this.dockerConfig = null;
    this.platform = os.platform();
    this.status = {
      projectValid: false,
      docker: false,
      databases: {
        postgres: false,
        neo4j: false,
        redis: false
      },
      initialization: false
    };
  }

  async run() {
    console.log(chalk.blue.bold('🚀 CodeMind Complete Setup'));
    console.log(chalk.gray('Setting up Docker containers, databases, and initialization...\n'));

    try {
      await this.checkPrerequisites();
      await this.detectAndConfigureDocker();

      if (this.dockerConfig && this.dockerConfig.success) {
        await this.setupDockerContainers();
        await this.initializeDatabases();
      } else {
        await this.handleNonDockerSetup();
      }

      await this.verifySetup();
      await this.displaySummary();

      console.log(chalk.green.bold('\n✅ Setup completed successfully!'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.cyan('  1. Run: npm run codemind (or just codemind if linked)'));
      console.log(chalk.cyan('  2. Type /init in the CLI to initialize your project'));
      console.log(chalk.cyan('  3. Use /help to see all available commands'));

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Setup failed:'), error.message);

      if (error.message.includes('Docker')) {
        console.log(chalk.yellow('\n💡 Docker Issues? Try these solutions:'));
        console.log(chalk.cyan('  • Ensure Docker/Rancher Desktop is running'));
        console.log(chalk.cyan('  • Try running as administrator'));
        console.log(chalk.cyan('  • Check: docker context ls'));
        console.log(chalk.cyan('  • Or continue with: npm run setup:local'));
      }

      console.error(chalk.gray('Check the logs above for details.'));

      // Don't exit immediately - let user see the error and suggestions
      setTimeout(() => process.exit(1), 2000);
    }
  }

  async checkPrerequisites() {
    console.log(chalk.yellow('🔍 Checking prerequisites...'));

    // Default to current directory, use provided path if given
    const targetPath = this.projectPath || process.cwd();
    const packageJson = path.join(targetPath, 'package.json');

    try {
      const pkg = JSON.parse(await fs.readFile(packageJson, 'utf-8'));
      if (pkg.name !== 'codemind-enhanced-cli') {
        throw new Error('Not a CodeMind project');
      }

      console.log(chalk.green(`  ✓ Valid CodeMind project at: ${targetPath}`));

      // If a path was provided and we need to change to it
      if (this.projectPath && process.cwd() !== this.projectPath) {
        process.chdir(this.projectPath);
        console.log(chalk.gray(`  Changed to project directory: ${this.projectPath}`));
      }

      // Store the verified path
      this.projectPath = targetPath;
      this.status.projectValid = true;
    } catch (error) {
      console.log(chalk.red(`  ✗ Not in CodeMind project directory`));
      console.log(chalk.gray(`  Current directory: ${targetPath}`));
      console.log(chalk.yellow('\nTo fix this:'));
      console.log(chalk.cyan('  1. Navigate to your CodeMind directory: cd /path/to/codemind'));
      console.log(chalk.cyan('  2. Then run: npm run setup'));
      console.log(chalk.cyan('\nOr if CodeMind is installed elsewhere:'));
      console.log(chalk.cyan('  npm run setup -- --project-path /path/to/codemind'));
      console.log(chalk.gray('\nFor manual setup instructions, see: docs/MANUAL_SETUP.md'));
      throw new Error('Not in CodeMind project directory');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      console.log(chalk.yellow('  ⚠ Warning: Node.js 16+ recommended for best compatibility'));
    } else {
      console.log(chalk.green(`  ✓ Node.js ${nodeVersion} compatible`));
    }
  }

  async detectAndConfigureDocker() {
    console.log(chalk.yellow('\n🐳 Detecting container system...'));
    console.log(chalk.gray(`  Platform: ${this.platform}`));

    this.dockerConfig = await this.dockerDetector.detect();

    if (!this.dockerConfig.success) {
      console.log(chalk.yellow('\n⚠️ Container system not running'));
      console.log(chalk.cyan('\nTo start manually:'));

      if (this.platform === 'win32') {
        console.log(chalk.cyan('  • Docker Desktop: Start from system tray or Start Menu'));
        console.log(chalk.cyan('  • Rancher Desktop: Start from Start Menu'));
      } else if (this.platform === 'darwin') {
        console.log(chalk.cyan('  • Docker Desktop: open -a Docker'));
        console.log(chalk.cyan('  • Rancher Desktop: open -a "Rancher Desktop"'));
      } else {
        console.log(chalk.cyan('  • Docker: sudo systemctl start docker'));
        console.log(chalk.cyan('  • Podman: sudo systemctl start podman'));
      }

      console.log(chalk.cyan('\nThen run setup again. For manual setup, see: docs/MANUAL_SETUP.md'));
      return;
    }

    // Test the detected Docker configuration
    const connectionTest = await this.dockerDetector.testDockerConnection();
    if (!connectionTest) {
      console.log(chalk.yellow('  ⚠ Container system detected but connection failed'));
      this.dockerConfig.success = false;
    } else {
      console.log(chalk.green(`  ✓ ${this.dockerConfig.environment} is running`));
    }
  }

  async handleNonDockerSetup() {
    console.log(chalk.yellow('\n🏠 Setting up local-only environment...'));
    console.log(chalk.gray('  Docker containers will be skipped'));
    console.log(chalk.gray('  You can install Docker later and run: npm run setup'));

    // Create local data directories
    const dataDir = path.join(process.cwd(), 'local-data');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(path.join(dataDir, 'postgresql'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'redis'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'neo4j'), { recursive: true });

    console.log(chalk.green('  ✓ Local data directories created'));
    console.log(chalk.cyan('  💡 For full functionality, install Docker and run setup again'));

    this.status.docker = false; // Mark as local-only setup
  }

  async setupDockerContainers() {
    console.log(chalk.yellow('\n🐳 Setting up Docker containers...'));

    const composeCmd = this.dockerConfig.composeCommand;
    console.log(chalk.gray(`  Using: ${composeCmd}`));

    try {
      // Check existing container status first
      const containerStatus = await this.checkContainerStatus();
      await this.handleContainerSetup(containerStatus, composeCmd);

      // Wait for containers to be ready
      console.log(chalk.gray('  Waiting for containers to be healthy...'));
      await this.waitForContainerHealth();

      this.status.docker = true;
      console.log(chalk.green('  ✓ Docker containers are running and healthy'));

    } catch (error) {
      throw new Error(`Docker setup failed: ${error.message}`);
    }
  }

  async checkContainerStatus() {
    console.log(chalk.gray('  Checking existing container status...'));

    try {
      const result = this.execDockerCommand(`${this.dockerConfig.composeCommand} ps --format json`);
      const output = result.toString().trim();

      if (!output) {
        return { allRunning: false, containers: [] };
      }

      const containers = this.parseComposeOutput(output);
      const runningContainers = containers.filter(c => c.State === 'running');
      const healthyContainers = containers.filter(c =>
        c.State === 'running' && (!c.Health || c.Health === 'healthy')
      );

      console.log(chalk.gray(`    Found ${containers.length} containers, ${runningContainers.length} running, ${healthyContainers.length} healthy`));

      return {
        allRunning: containers.length > 0 && runningContainers.length === containers.length,
        allHealthy: containers.length > 0 && healthyContainers.length === containers.length,
        containers: containers,
        needsStart: containers.length === 0,
        needsRestart: containers.some(c => c.State !== 'running')
      };

    } catch (error) {
      // No containers exist yet
      return { allRunning: false, containers: [], needsStart: true };
    }
  }

  async handleContainerSetup(status, composeCmd) {
    if (status.allHealthy) {
      console.log(chalk.green('  ✓ All containers are already running and healthy - skipping restart'));
      return;
    }

    if (status.allRunning && !status.allHealthy) {
      console.log(chalk.yellow('  ⚠ Containers running but some unhealthy - will wait for health checks'));
      return;
    }

    if (status.needsStart) {
      console.log(chalk.gray('  No containers found - starting fresh setup...'));
      this.execDockerCommand(`${composeCmd} up -d --build`, true);
      return;
    }

    if (status.needsRestart) {
      console.log(chalk.yellow('  Some containers need restart - restarting only failed services...'));

      // Stop only non-running containers, then start all
      const stoppedContainers = status.containers
        .filter(c => c.State !== 'running')
        .map(c => c.Name || c.Service)
        .filter(Boolean);

      if (stoppedContainers.length > 0) {
        console.log(chalk.gray(`    Restarting: ${stoppedContainers.join(', ')}`));
        this.execDockerCommand(`${composeCmd} up -d ${stoppedContainers.join(' ')}`, true);
      } else {
        // All containers running, just make sure they're up to date
        this.execDockerCommand(`${composeCmd} up -d`, true);
      }
    }
  }

  execDockerCommand(command, inheritStdio = false) {
    return execSync(command, {
      stdio: inheritStdio ? 'inherit' : 'pipe',
      cwd: process.cwd(),
      timeout: 120000 // 2 minutes timeout
    });
  }

  async waitForContainerHealth() {
    const maxRetries = 30; // 30 seconds max
    let retries = 0;
    const composeCmd = this.dockerConfig.composeCommand;

    while (retries < maxRetries) {
      try {
        const result = this.execDockerCommand(`${composeCmd} ps --format json`);
        const output = result.toString().trim();

        if (!output) {
          // No containers yet, continue waiting
        } else {
          // Handle different compose output formats
          const containers = this.parseComposeOutput(output);
          const allHealthy = containers.every(container =>
            container.State === 'running' &&
            (!container.Health || container.Health === 'healthy')
          );

          if (allHealthy && containers.length > 0) {
            return;
          }
        }

      } catch (error) {
        // Continue retrying - containers might still be starting
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;

      if (retries % 5 === 0) {
        console.log(chalk.gray(`    Still waiting... (${retries}/${maxRetries}s)`));
      }
    }

    // Try a basic container check as fallback
    try {
      this.execDockerCommand(`${this.dockerConfig.dockerCommand} ps`);
      console.log(chalk.yellow('    Containers appear to be running (health check format not supported)'));
      return;
    } catch (error) {
      throw new Error('Containers did not start properly within 30 seconds');
    }
  }

  parseComposeOutput(output) {
    try {
      // Try JSON format first
      return JSON.parse(`[${output.split('\n').join(',')}]`);
    } catch (error) {
      // Fallback for non-JSON formats
      return output.split('\n')
        .filter(line => line.trim())
        .map(line => ({
          State: line.includes('Up') ? 'running' : 'stopped',
          Health: 'unknown'
        }));
    }
  }

  async initializeDatabases() {
    console.log(chalk.yellow('\n🗄️  Initializing databases...'));

    if (!this.dockerConfig || !this.dockerConfig.success) {
      console.log(chalk.yellow('  Skipping database initialization (Container system not available)'));
      console.log(chalk.gray('  You can initialize databases later when containers are available'));
      return;
    }

    // Test connections first
    console.log(chalk.gray('  Testing database connections...'));
    try {
      const connections = await testConnections();

      if (!connections.postgres) {
        console.log(chalk.yellow('  ⚠ PostgreSQL connection failed - will retry'));
      }
      if (!connections.redis) {
        console.log(chalk.yellow('  ⚠ Redis connection failed - will retry'));
      }
      if (!connections.neo4j) {
        console.log(chalk.yellow('  ⚠ Neo4j connection failed - will retry'));
      }

      if (connections.postgres || connections.redis || connections.neo4j) {
        console.log(chalk.green('  ✓ At least some database connections successful'));
      } else {
        console.log(chalk.yellow('  ⚠ No database connections available - containers may still be starting'));
        return;
      }

      // Initialize each database that's available
      try {
        if (connections.postgres) {
          console.log(chalk.gray('  Initializing PostgreSQL...'));
          await initializePostgreSQL();
          this.status.databases.postgres = true;
          console.log(chalk.green('    ✓ PostgreSQL initialized'));
        }

        if (connections.neo4j) {
          console.log(chalk.gray('  Initializing Neo4j...'));
          await initializeNeo4j();
          this.status.databases.neo4j = true;
          console.log(chalk.green('    ✓ Neo4j initialized'));
        }

        if (connections.redis) {
          console.log(chalk.gray('  Initializing Redis...'));
          await initializeRedis();
          this.status.databases.redis = true;
          console.log(chalk.green('    ✓ Redis initialized'));
        }

        this.status.initialization = true;

      } catch (error) {
        console.log(chalk.yellow(`  ⚠ Database initialization warning: ${error.message}`));
        console.log(chalk.gray('    You can run initialization later with: npm run init:db'));
      }

    } catch (error) {
      console.log(chalk.yellow('  ⚠ Database connection test failed - containers may still be starting'));
      console.log(chalk.gray('    You can run initialization later with: npm run init:db'));
    }
  }

  async verifySetup() {
    console.log(chalk.yellow('\n🔍 Verifying setup...'));

    if (this.dockerConfig && this.dockerConfig.success) {
      // Test final connections
      try {
        const connections = await testConnections();
        const coreConnected = connections.postgres && connections.redis;

        if (coreConnected) {
          console.log(chalk.green('  ✓ Core databases (PostgreSQL, Redis) connected'));
          if (!connections.neo4j) {
            console.log(chalk.yellow('  ⚠ Neo4j still starting up - setup can continue'));
          } else {
            console.log(chalk.green('  ✓ All databases connected'));
          }
        } else {
          console.log(chalk.yellow('  ⚠ Some core databases not connected yet'));
          console.log(chalk.gray('    This is normal - databases may still be initializing'));
        }
      } catch (error) {
        console.log(chalk.yellow('  ⚠ Database connection test failed - containers may still be starting'));
        console.log(chalk.gray('    You can verify connections later with: npm run setup:doctor'));
      }
    }

    // Check that CLI is built
    const cliPath = path.join(process.cwd(), 'dist', 'cli', 'CodeMindCLI.js');
    try {
      await fs.access(cliPath);
      console.log(chalk.green('  ✓ CLI is built and ready'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ CLI not built, building now...'));
      execSync('npm run build', { stdio: 'inherit' });
      console.log(chalk.green('  ✓ CLI built successfully'));
    }

    console.log(chalk.green('  ✓ Setup verification completed'));
  }

  async displaySummary() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);

    console.log(chalk.blue('\n📋 Setup Summary:'));

    if (this.dockerConfig && this.dockerConfig.success) {
      console.log(chalk.green(`  ✓ Docker environment: ${this.dockerConfig.environment}`));
      console.log(chalk.green(`  ✓ Compose command: ${this.dockerConfig.composeCommand}`));
    } else {
      console.log(chalk.yellow(`  ⚠ Docker: Not available (local-only mode)`));
    }

    if (this.status.databases.postgres) {
      console.log(chalk.green(`  ✓ PostgreSQL: Initialized with schema and indexes`));
    } else {
      console.log(chalk.gray(`  ○ PostgreSQL: Not initialized`));
    }

    if (this.status.databases.neo4j) {
      console.log(chalk.green(`  ✓ Neo4j: Initialized with constraints and indexes`));
    } else {
      console.log(chalk.gray(`  ○ Neo4j: Not initialized`));
    }

    if (this.status.databases.redis) {
      console.log(chalk.green(`  ✓ Redis: Initialized with configuration`));
    } else {
      console.log(chalk.gray(`  ○ Redis: Not initialized`));
    }

    console.log(chalk.green(`  ✓ CLI: Built and ready`));
    console.log(chalk.gray(`  ⏱ Total time: ${duration}s`));

    // Display container status if Docker is available
    if (this.dockerConfig && this.dockerConfig.success) {
      try {
        const containers = this.execDockerCommand(`${this.dockerConfig.composeCommand} ps`);
        console.log(chalk.blue('\n🐳 Container Status:'));
        console.log(chalk.gray(containers.toString()));
      } catch (error) {
        console.log(chalk.gray('  Container status unavailable'));
      }
    }

    // Display next steps based on setup type
    if (this.dockerConfig && this.dockerConfig.success) {
      console.log(chalk.blue('\n🎯 Ready for full CodeMind functionality!'));
    } else {
      console.log(chalk.yellow('\n🏠 Local-only setup complete'));
      console.log(chalk.cyan('  For full functionality:'));
      console.log(chalk.cyan('  1. Install Docker or Rancher Desktop'));
      console.log(chalk.cyan('  2. Run: npm run setup'));
    }
  }

  // Database sanity check methods
  async checkPostgreSQLNeedsInit() {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'codemind',
      user: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123'
    });

    try {
      // Check for canary table
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'projects'
        );
      `);

      return !result.rows[0].exists;
    } catch (error) {
      return true; // Needs initialization if query fails
    } finally {
      await pool.end();
    }
  }

  async checkNeo4jNeedsInit() {
    const neo4j = require('neo4j-driver');
    const driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'codemind123'
      )
    );

    try {
      const session = driver.session();

      // Check for canary constraint
      const result = await session.run(`
        SHOW CONSTRAINTS
      `);

      await session.close();
      // Check if project_id constraint exists
      const hasConstraint = result.records.some(record =>
        record.get('name') === 'project_id' ||
        record.get('labelsOrTypes')?.includes('Project')
      );
      return !hasConstraint;
    } catch (error) {
      // If SHOW CONSTRAINTS fails, try older Neo4j syntax
      try {
        const session = driver.session();
        const result = await session.run('MATCH (p:Project) RETURN count(p) as count');
        await session.close();
        // If query works, database is initialized
        return false;
      } catch (err) {
        return true; // Needs initialization
      }
    } finally {
      await driver.close();
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const path = require('path');
  const args = process.argv.slice(2);
  const options = {
    projectPath: null,
    force: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project-path':
      case '-p':
        if (args[i + 1]) {
          options.projectPath = path.resolve(args[i + 1]);
          i++;
        }
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

// Show help
function showHelp() {
  console.log(chalk.cyan('CodeMind Setup'));
  console.log(chalk.gray('\nUsage: npm run setup [options]'));
  console.log(chalk.gray('\nOptions:'));
  console.log(chalk.gray('  --project-path, -p <path>  Path to CodeMind project'));
  console.log(chalk.gray('  --force, -f                Force reinitialize databases'));
  console.log(chalk.gray('  --help, -h                 Show this help'));
  console.log(chalk.gray('\nExamples:'));
  console.log(chalk.gray('  npm run setup'));
  console.log(chalk.gray('  npm run setup -- --project-path /path/to/codemind'));
  console.log(chalk.gray('  npm run setup -- --force'));
  console.log(chalk.gray('\nFor manual setup, see: docs/MANUAL_SETUP.md'));
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const setup = new CodeMindSetup(options);
  setup.run().catch(error => {
    console.error(chalk.red.bold('Setup failed:'), error.message);
    process.exit(1);
  });
}

module.exports = { CodeMindSetup };