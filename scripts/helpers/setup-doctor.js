#!/usr/bin/env node

/**
 * CodeMind Setup Doctor
 *
 * Diagnoses setup issues and provides specific solutions
 */

const { execSync } = require('child_process');
const chalk = require('chalk');
const { DockerDetector } = require('./docker-detector');

class SetupDoctor {
  constructor() {
    this.issues = [];
    this.recommendations = [];
  }

  async diagnose() {
    console.log(chalk.blue.bold('🏥 CodeMind Setup Doctor'));
    console.log(chalk.gray('Diagnosing your setup...\n'));

    await this.checkNode();
    await this.checkCodeMindInstallation();
    await this.checkDocker();
    await this.checkDatabases();
    await this.provideDiagnosis();
  }

  async checkNode() {
    console.log(chalk.yellow('🟢 Node.js Environment'));

    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion >= 16) {
      console.log(chalk.green(`  ✓ Node.js ${nodeVersion} (compatible)`));
    } else {
      console.log(chalk.red(`  ❌ Node.js ${nodeVersion} (outdated)`));
      this.issues.push('Node.js version too old');
      this.recommendations.push('Upgrade to Node.js 16+ for best compatibility');
    }

    try {
      const npmVersion = execSync('npm --version', { stdio: 'pipe', encoding: 'utf-8' }).trim();
      console.log(chalk.green(`  ✓ npm ${npmVersion}`));
    } catch (error) {
      console.log(chalk.red('  ❌ npm not available'));
      this.issues.push('npm not found');
    }
  }

  async checkCodeMindInstallation() {
    console.log(chalk.yellow('\n🧠 CodeMind Installation'));

    // Check if we're in the right directory
    try {
      const packageJson = require('../../package.json');
      if (packageJson.name === 'codemind-enhanced-cli') {
        console.log(chalk.green(`  ✓ CodeMind v${packageJson.version} found`));
      } else {
        console.log(chalk.red('  ❌ Not in CodeMind directory'));
        this.issues.push('Wrong directory');
        this.recommendations.push('Navigate to CodeMind project directory');
      }
    } catch (error) {
      console.log(chalk.red('  ❌ CodeMind package.json not found'));
      this.issues.push('CodeMind not installed');
    }

    // Check if TypeScript is compiled
    try {
      const fs = require('fs');
      if (fs.existsSync('./dist/cli/codemind-cli.js')) {
        console.log(chalk.green('  ✓ CLI compiled and ready'));
      } else {
        console.log(chalk.yellow('  ⚠ CLI not compiled'));
        this.recommendations.push('Run: npm run build');
      }
    } catch (error) {
      console.log(chalk.red('  ❌ Cannot check compiled CLI'));
    }

    // Check global linking
    try {
      const result = execSync('codemind --version', { stdio: 'pipe', encoding: 'utf-8' });
      console.log(chalk.green('  ✓ Globally linked'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Not globally linked'));
      this.recommendations.push('Run: npm link (for global access)');
    }
  }

  async checkDocker() {
    console.log(chalk.yellow('\n🐳 Docker Environment'));

    const detector = new DockerDetector();
    const dockerConfig = await detector.detect();

    if (dockerConfig.success) {
      console.log(chalk.green(`  ✓ ${dockerConfig.environment} detected`));
      console.log(chalk.green(`  ✓ Docker command: ${dockerConfig.dockerCommand}`));
      console.log(chalk.green(`  ✓ Compose command: ${dockerConfig.composeCommand}`));

      // Test Docker connection
      const connectionTest = await detector.testDockerConnection();
      if (connectionTest) {
        console.log(chalk.green('  ✓ Docker connection working'));
      } else {
        console.log(chalk.red('  ❌ Docker connection failed'));
        this.issues.push('Docker connection issue');
        this.recommendations.push('Ensure Docker/Rancher Desktop is running');
        this.recommendations.push('Try running as administrator');
      }
    } else {
      console.log(chalk.red('  ❌ Docker not available'));
      this.issues.push('Docker not installed');
      this.recommendations.push('Install Docker Desktop or Rancher Desktop');
      this.recommendations.push('Or continue with: npm run setup:local');
    }
  }

  async checkDatabases() {
    console.log(chalk.yellow('\n🗄️ Database Connections'));

    try {
      const { testConnections } = require('./database-init');
      const connections = await testConnections();

      if (connections.postgres) {
        console.log(chalk.green('  ✓ PostgreSQL connected'));
      } else {
        console.log(chalk.gray('  ○ PostgreSQL not available'));
      }

      if (connections.redis) {
        console.log(chalk.green('  ✓ Redis connected'));
      } else {
        console.log(chalk.gray('  ○ Redis not available'));
      }

      if (connections.neo4j) {
        console.log(chalk.green('  ✓ Neo4j connected'));
      } else {
        console.log(chalk.gray('  ○ Neo4j not available'));
      }

      if (!connections.postgres && !connections.redis && !connections.neo4j) {
        this.recommendations.push('Run: npm run setup (to start containers)');
      }
    } catch (error) {
      console.log(chalk.gray('  ○ Database test unavailable'));
      this.recommendations.push('Databases not initialized - run setup first');
    }
  }

  async provideDiagnosis() {
    console.log(chalk.blue('\n📋 Diagnosis Summary'));

    if (this.issues.length === 0) {
      console.log(chalk.green('✅ All checks passed! Your setup looks great.'));
      console.log(chalk.cyan('\n🚀 Ready to use CodeMind:'));
      console.log(chalk.cyan('  codemind (start the CLI)'));
      console.log(chalk.cyan('  codemind /init (in a project directory)'));
    } else {
      console.log(chalk.red(`❌ Found ${this.issues.length} issue(s):`));
      this.issues.forEach(issue => {
        console.log(chalk.red(`  • ${issue}`));
      });
    }

    if (this.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      this.recommendations.forEach(rec => {
        console.log(chalk.cyan(`  • ${rec}`));
      });
    }

    console.log(chalk.blue('\n🔧 Quick Setup Commands:'));
    console.log(chalk.gray('  npm run docker:detect    # Check Docker setup'));
    console.log(chalk.gray('  npm run setup           # Full setup with Docker'));
    console.log(chalk.gray('  npm run setup:local     # Local-only setup'));
    console.log(chalk.gray('  npm run build           # Compile TypeScript'));
    console.log(chalk.gray('  npm link                # Global CLI access'));
  }
}

// CLI usage
if (require.main === module) {
  const doctor = new SetupDoctor();
  doctor.diagnose();
}

module.exports = { SetupDoctor };