#!/usr/bin/env node

/**
 * Docker Environment Detection and Adaptation
 *
 * Automatically detects and configures for:
 * - Rancher Desktop
 * - Docker Desktop
 * - Podman
 * - Other Docker-compatible environments
 */

const { execSync } = require('child_process');
const chalk = require('chalk');

class DockerDetector {
  constructor() {
    this.detectedEnvironment = null;
    this.dockerCommand = 'docker';
    this.composeCommand = 'docker-compose';
    this.context = null;
  }

  async detect() {
    console.log(chalk.yellow('🔍 Detecting Docker environment...'));

    try {
      // Step 1: Check if Docker is available at all
      const dockerInfo = await this.getDockerInfo();
      if (!dockerInfo.available) {
        return this.handleNoDocker();
      }

      // Step 2: Detect specific Docker environment
      const environment = await this.detectEnvironment();

      // Step 3: Configure optimal settings for detected environment
      await this.configureForEnvironment(environment);

      console.log(chalk.green(`  ✓ Detected: ${environment.name}`));
      console.log(chalk.gray(`    Docker: ${this.dockerCommand}`));
      console.log(chalk.gray(`    Compose: ${this.composeCommand}`));
      if (this.context) {
        console.log(chalk.gray(`    Context: ${this.context}`));
      }

      return {
        success: true,
        environment: environment.name,
        dockerCommand: this.dockerCommand,
        composeCommand: this.composeCommand,
        context: this.context
      };

    } catch (error) {
      console.log(chalk.red(`  ❌ Docker detection failed: ${error.message}`));
      return this.provideFallbackOptions();
    }
  }

  async getDockerInfo() {
    try {
      // Try basic docker command
      const version = execSync('docker --version', {
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 5000
      });

      return {
        available: true,
        version: version.trim()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  async detectEnvironment() {
    // Check Docker contexts first
    const contexts = await this.getDockerContexts();

    // Check for Rancher Desktop
    if (await this.isRancherDesktop(contexts)) {
      return {
        name: 'Rancher Desktop',
        type: 'rancher',
        contexts: contexts
      };
    }

    // Check for Docker Desktop
    if (await this.isDockerDesktop(contexts)) {
      return {
        name: 'Docker Desktop',
        type: 'docker-desktop',
        contexts: contexts
      };
    }

    // Check for Podman
    if (await this.isPodman()) {
      return {
        name: 'Podman',
        type: 'podman',
        contexts: contexts
      };
    }

    // Check for other Docker environments
    const dockerInfo = await this.getDockerSystemInfo();
    return {
      name: `Docker (${dockerInfo.serverVersion || 'Unknown'})`,
      type: 'docker-generic',
      contexts: contexts,
      info: dockerInfo
    };
  }

  async getDockerContexts() {
    try {
      const output = execSync('docker context ls --format "{{.Name}}\t{{.Description}}\t{{.DockerEndpoint}}\t{{.Current}}"', {
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 5000
      });

      return output.trim().split('\n').map(line => {
        const [name, description, endpoint, current] = line.split('\t');
        return {
          name,
          description,
          endpoint,
          current: current === 'true' || current === '*'
        };
      });
    } catch (error) {
      return [];
    }
  }

  async isRancherDesktop(contexts) {
    // Check for Rancher Desktop indicators
    const indicators = [
      'rancher-desktop',
      'rd',
      contexts.some(ctx => ctx.description?.toLowerCase().includes('rancher')),
      contexts.some(ctx => ctx.endpoint?.includes('rancher'))
    ];

    return indicators.some(Boolean);
  }

  async isDockerDesktop(contexts) {
    // Check for Docker Desktop indicators
    const indicators = [
      'desktop-linux',
      contexts.some(ctx => ctx.description?.toLowerCase().includes('docker desktop')),
      contexts.some(ctx => ctx.endpoint?.includes('dockerDesktop'))
    ];

    return indicators.some(Boolean);
  }

  async isPodman() {
    try {
      const version = execSync('podman --version', {
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 3000
      });
      return version.includes('podman');
    } catch (error) {
      return false;
    }
  }

  async getDockerSystemInfo() {
    try {
      const info = execSync('docker system info --format "{{.ServerVersion}}\t{{.OperatingSystem}}\t{{.Architecture}}"', {
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 5000
      });

      const [serverVersion, os, arch] = info.trim().split('\t');
      return { serverVersion, os, arch };
    } catch (error) {
      return {};
    }
  }

  async configureForEnvironment(environment) {
    switch (environment.type) {
      case 'rancher':
        await this.configureRancherDesktop(environment);
        break;
      case 'docker-desktop':
        await this.configureDockerDesktop(environment);
        break;
      case 'podman':
        await this.configurePodman(environment);
        break;
      default:
        await this.configureGenericDocker(environment);
    }
  }

  async configureRancherDesktop(environment) {
    // Rancher Desktop typically uses the 'default' context
    const defaultContext = environment.contexts.find(ctx => ctx.name === 'default');
    const currentContext = environment.contexts.find(ctx => ctx.current);

    // If current context is desktop-linux but default exists, switch to default
    if (currentContext && currentContext.name === 'desktop-linux' && defaultContext) {
      console.log(chalk.gray(`    Switching from ${currentContext.name} to default context`));
      try {
        execSync('docker context use default', {
          stdio: 'pipe',
          timeout: 5000
        });
        this.context = 'default';
      } catch (error) {
        console.log(chalk.yellow(`    Warning: Could not switch to default context`));
      }
    } else {
      // Find the best working context for Rancher Desktop
      const workingContext = await this.findWorkingContext(environment.contexts);

      if (workingContext) {
        this.context = workingContext.name;
        console.log(chalk.gray(`    Using context: ${workingContext.name}`));

        if (!workingContext.current) {
          try {
            execSync(`docker context use ${workingContext.name}`, {
              stdio: 'pipe',
              timeout: 5000
            });
          } catch (error) {
            console.log(chalk.yellow(`    Warning: Could not switch context, will try current`));
          }
        }
      }
    }

    // Check for docker-compose vs docker compose
    this.composeCommand = await this.detectComposeCommand();
  }

  async configureDockerDesktop(environment) {
    // Use desktop-linux context if available
    const desktopContext = environment.contexts.find(ctx =>
      ctx.name === 'desktop-linux' || ctx.description?.includes('Docker Desktop')
    );

    if (desktopContext) {
      this.context = desktopContext.name;
      try {
        execSync(`docker context use ${desktopContext.name}`, {
          stdio: 'pipe',
          timeout: 5000
        });
      } catch (error) {
        console.log(chalk.yellow(`    Warning: Could not switch to Docker Desktop context`));
      }
    }

    this.composeCommand = await this.detectComposeCommand();
  }

  async configurePodman(environment) {
    this.dockerCommand = 'podman';

    // Check if podman-compose is available
    try {
      execSync('podman-compose --version', {
        stdio: 'pipe',
        timeout: 3000
      });
      this.composeCommand = 'podman-compose';
    } catch (error) {
      // Fall back to docker-compose (might work with podman socket)
      this.composeCommand = 'docker-compose';
    }
  }

  async configureGenericDocker(environment) {
    this.composeCommand = await this.detectComposeCommand();
  }

  async findWorkingContext(contexts) {
    for (const context of contexts) {
      try {
        execSync(`docker context use ${context.name}`, { stdio: 'pipe', timeout: 3000 });
        execSync('docker ps', { stdio: 'pipe', timeout: 3000 });
        return context;
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  async detectComposeCommand() {
    // Try docker compose (newer syntax) first
    try {
      execSync('docker compose version', {
        stdio: 'pipe',
        timeout: 3000
      });
      return 'docker compose';
    } catch (error) {
      // Fall back to docker-compose
      try {
        execSync('docker-compose --version', {
          stdio: 'pipe',
          timeout: 3000
        });
        return 'docker-compose';
      } catch (error) {
        return 'docker-compose'; // Default fallback
      }
    }
  }

  handleNoDocker() {
    console.log(chalk.red('  ❌ Docker not available'));
    return this.provideFallbackOptions();
  }

  provideFallbackOptions() {
    console.log(chalk.yellow('\n💡 Docker Setup Options:'));
    console.log(chalk.cyan('  1. Install Rancher Desktop: https://rancherdesktop.io/'));
    console.log(chalk.cyan('  2. Install Docker Desktop: https://www.docker.com/products/docker-desktop/'));
    console.log(chalk.cyan('  3. Use WSL2 with Docker Engine'));
    console.log(chalk.cyan('  4. Continue with local-only setup (limited functionality)'));

    console.log(chalk.yellow('\n🔧 If you have Docker installed but it\'s not working:'));
    console.log(chalk.gray('  - Ensure Docker service is running'));
    console.log(chalk.gray('  - Try: docker context ls'));
    console.log(chalk.gray('  - Try: docker context use <context-name>'));
    console.log(chalk.gray('  - Check if running as administrator is required'));

    return {
      success: false,
      needsDocker: true,
      fallbackAvailable: true
    };
  }

  async testDockerConnection() {
    try {
      console.log(chalk.gray('  Testing Docker connection...'));
      execSync(`${this.dockerCommand} ps`, {
        stdio: 'pipe',
        timeout: 10000
      });
      console.log(chalk.green('  ✓ Docker connection working'));
      return true;
    } catch (error) {
      console.log(chalk.red(`  ❌ Docker connection failed: ${error.message}`));
      return false;
    }
  }
}

module.exports = { DockerDetector };

// CLI usage
if (require.main === module) {
  const detector = new DockerDetector();
  detector.detect().then(result => {
    if (result.success) {
      console.log(chalk.green('\n✅ Docker environment configured successfully'));
    } else {
      console.log(chalk.yellow('\n⚠️ Docker setup requires attention'));
    }
  });
}