/**
 * Container System Detector Service
 * Single Responsibility: Detect and configure container systems (Docker, Rancher, Podman)
 */

import { execSync } from 'child_process';
import * as os from 'os';
import { IContainerDetector, ContainerConfig } from './interfaces/setup-interfaces';

export class ContainerDetector implements IContainerDetector {
  private platform = os.platform();

  async detect(): Promise<ContainerConfig> {
    try {
      // Check basic Docker availability
      const dockerInfo = await this.getDockerInfo();
      if (!dockerInfo.available) {
        return this.createUnavailableConfig('Docker not available');
      }

      // Detect specific environment
      const environment = await this.detectSpecificEnvironment();
      const config = this.configureForEnvironment(environment);

      return {
        success: true,
        environment: environment.name,
        dockerCommand: config.dockerCommand,
        composeCommand: config.composeCommand,
        context: config.context
      };

    } catch (error) {
      return this.createUnavailableConfig(
        error instanceof Error ? error.message : 'Container detection failed'
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      execSync('docker info', { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private async getDockerInfo(): Promise<{ available: boolean; info?: any }> {
    try {
      const result = execSync('docker --version', {
        stdio: 'pipe',
        timeout: 5000,
        encoding: 'utf8'
      });

      return {
        available: true,
        info: result.trim()
      };
    } catch {
      return { available: false };
    }
  }

  private async detectSpecificEnvironment(): Promise<{ name: string; type: string }> {
    try {
      // Try to get Docker context
      const context = execSync('docker context ls --format json', {
        stdio: 'pipe',
        timeout: 5000,
        encoding: 'utf8'
      });

      const contexts = context.trim().split('\n').map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      const currentContext = contexts.find(ctx => ctx.Current);

      // Detect Rancher Desktop
      if (currentContext?.Name?.includes('rancher-desktop') ||
          currentContext?.DockerEndpoint?.includes('rancher-desktop')) {
        return { name: 'Rancher Desktop', type: 'rancher' };
      }

      // Detect Docker Desktop
      if (currentContext?.Name?.includes('desktop') ||
          this.platform === 'win32' || this.platform === 'darwin') {
        return { name: 'Docker Desktop', type: 'docker-desktop' };
      }

      // Check for Podman
      try {
        execSync('podman --version', { stdio: 'pipe', timeout: 5000 });
        return { name: 'Podman', type: 'podman' };
      } catch {
        // Not Podman
      }

      // Default to Docker
      return { name: 'Docker Engine', type: 'docker' };

    } catch {
      return { name: 'Docker (Generic)', type: 'docker' };
    }
  }

  private configureForEnvironment(environment: { name: string; type: string }) {
    let dockerCommand = 'docker';
    let composeCommand = 'docker-compose';
    let context: string | undefined;

    switch (environment.type) {
      case 'rancher':
        // Rancher Desktop specific optimizations
        composeCommand = 'docker compose'; // Prefer built-in compose
        context = 'rancher-desktop';
        break;

      case 'docker-desktop':
        // Docker Desktop optimizations
        composeCommand = 'docker compose'; // Use built-in compose V2
        break;

      case 'podman':
        dockerCommand = 'podman';
        composeCommand = 'podman-compose';
        break;

      default:
        // Try to detect compose version
        try {
          execSync('docker compose version', { stdio: 'pipe', timeout: 3000 });
          composeCommand = 'docker compose';
        } catch {
          composeCommand = 'docker-compose';
        }
        break;
    }

    return { dockerCommand, composeCommand, context };
  }

  private createUnavailableConfig(message: string): ContainerConfig {
    return {
      success: false,
      environment: 'None',
      dockerCommand: 'docker',
      composeCommand: 'docker-compose'
    };
  }
}