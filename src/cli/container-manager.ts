import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface ContainerConfig {
  name: string;
  image: string;
  ports?: { [key: string]: string };
  volumes?: { [key: string]: string };
  environment?: { [key: string]: string };
  networks?: string[];
  dependsOn?: string[];
  healthCheck?: {
    command: string;
    interval: string;
    timeout: string;
    retries: number;
  };
}

export interface DockerComposeConfig {
  version: string;
  services: { [key: string]: any };
  volumes?: { [key: string]: any };
  networks?: { [key: string]: any };
}

/**
 * Container Manager for CodeMind CLI
 * Integrates Docker and containerization tools with intelligent configuration
 */
export class ContainerManager {
  private logger = Logger.getInstance();
  private projectPath: string;
  private configPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, '.codemind', 'container-config.json');
  }

  /**
   * Initialize containerization for project
   */
  async initializeContainerization(options: {
    includeDatabase?: boolean;
    includeRedis?: boolean;
    includeMonitoring?: boolean;
    customServices?: ContainerConfig[];
  }): Promise<DockerComposeConfig> {
    this.logger.info('Initializing containerization for project', { 
      projectPath: this.projectPath,
      options 
    });

    const config: DockerComposeConfig = {
      version: '3.8',
      services: {},
      volumes: {},
      networks: {
        'codemind-network': {
          driver: 'bridge'
        }
      }
    };

    // Add core application service
    config.services['app'] = await this.createApplicationService();

    // Add database if requested
    if (options.includeDatabase) {
      config.services['database'] = this.createDatabaseService();
      config.volumes!['app_db_data'] = { driver: 'local' };
    }

    // Add Redis if requested
    if (options.includeRedis) {
      config.services['redis'] = this.createRedisService();
      config.volumes!['app_redis_data'] = { driver: 'local' };
    }

    // Add monitoring if requested
    if (options.includeMonitoring) {
      const monitoring = this.createMonitoringServices();
      Object.assign(config.services, monitoring.services);
      Object.assign(config.volumes!, monitoring.volumes);
    }

    // Add custom services
    if (options.customServices) {
      for (const service of options.customServices) {
        config.services[service.name] = this.containerConfigToDockerService(service);
      }
    }

    // Save configuration
    await this.saveContainerConfig(config);

    this.logger.info('Container configuration initialized', { 
      services: Object.keys(config.services),
      volumes: Object.keys(config.volumes || {}),
      networks: Object.keys(config.networks || {})
    });

    return config;
  }

  /**
   * Create application service configuration
   */
  private async createApplicationService(): Promise<any> {
    const packageJson = await this.readPackageJson();
    const projectName = packageJson?.name || 'app';

    return {
      build: {
        context: '.',
        dockerfile: 'Dockerfile'
      },
      container_name: `${projectName}-app`,
      restart: 'unless-stopped',
      environment: {
        NODE_ENV: 'production',
        PORT: '3000'
      },
      ports: ['3000:3000'],
      volumes: [
        './logs:/app/logs',
        './.codemind:/app/.codemind:ro'
      ],
      networks: ['codemind-network'],
      healthcheck: {
        test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
        start_period: '30s'
      }
    };
  }

  /**
   * Create database service configuration
   */
  private createDatabaseService(): any {
    return {
      image: 'postgres:15-alpine',
      container_name: 'app-database',
      restart: 'unless-stopped',
      environment: {
        POSTGRES_DB: '${DB_NAME:-appdb}',
        POSTGRES_USER: '${DB_USER:-appuser}',
        POSTGRES_PASSWORD: '${DB_PASSWORD:-apppass123}',
        POSTGRES_INITDB_ARGS: '--encoding=UTF8 --lc-collate=C --lc-ctype=C'
      },
      volumes: [
        'app_db_data:/var/lib/postgresql/data',
        './database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro'
      ],
      ports: ['${DB_PORT:-5432}:5432'],
      networks: ['codemind-network'],
      healthcheck: {
        test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-appuser} -d ${DB_NAME:-appdb}'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
        start_period: '10s'
      }
    };
  }

  /**
   * Create Redis service configuration
   */
  private createRedisService(): any {
    return {
      image: 'redis:7-alpine',
      container_name: 'app-redis',
      restart: 'unless-stopped',
      command: 'redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru',
      volumes: ['app_redis_data:/data'],
      ports: ['${REDIS_PORT:-6379}:6379'],
      networks: ['codemind-network'],
      healthcheck: {
        test: ['CMD', 'redis-cli', 'ping'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
        start_period: '5s'
      }
    };
  }

  /**
   * Create monitoring services (optional)
   */
  private createMonitoringServices(): { services: any; volumes: any } {
    return {
      services: {
        prometheus: {
          image: 'prom/prometheus:latest',
          container_name: 'app-prometheus',
          restart: 'unless-stopped',
          volumes: [
            './monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro',
            'app_prometheus_data:/prometheus'
          ],
          ports: ['9090:9090'],
          networks: ['codemind-network']
        },
        grafana: {
          image: 'grafana/grafana:latest',
          container_name: 'app-grafana',
          restart: 'unless-stopped',
          environment: {
            GF_SECURITY_ADMIN_PASSWORD: '${GRAFANA_PASSWORD:-admin123}'
          },
          volumes: ['app_grafana_data:/var/lib/grafana'],
          ports: ['3000:3000'],
          networks: ['codemind-network'],
          depends_on: ['prometheus']
        }
      },
      volumes: {
        app_prometheus_data: { driver: 'local' },
        app_grafana_data: { driver: 'local' }
      }
    };
  }

  /**
   * Convert ContainerConfig to Docker Compose service
   */
  private containerConfigToDockerService(config: ContainerConfig): any {
    const service: any = {
      image: config.image,
      container_name: config.name,
      restart: 'unless-stopped'
    };

    if (config.ports) {
      service.ports = Object.entries(config.ports).map(([host, container]) => `${host}:${container}`);
    }

    if (config.volumes) {
      service.volumes = Object.entries(config.volumes).map(([host, container]) => `${host}:${container}`);
    }

    if (config.environment) {
      service.environment = config.environment;
    }

    if (config.networks) {
      service.networks = config.networks;
    }

    if (config.dependsOn) {
      service.depends_on = config.dependsOn;
    }

    if (config.healthCheck) {
      service.healthcheck = {
        test: config.healthCheck.command.split(' '),
        interval: config.healthCheck.interval,
        timeout: config.healthCheck.timeout,
        retries: config.healthCheck.retries
      };
    }

    return service;
  }

  /**
   * Generate Docker Compose file
   */
  async generateDockerCompose(config: DockerComposeConfig): Promise<string> {
    const yamlContent = this.convertToYaml(config);
    const dockerComposePath = path.join(this.projectPath, 'docker-compose.codemind.yml');
    
    await fs.writeFile(dockerComposePath, yamlContent, 'utf8');
    
    this.logger.info('Docker Compose file generated', { path: dockerComposePath });
    return dockerComposePath;
  }

  /**
   * Generate environment file
   */
  async generateEnvironmentFile(config: DockerComposeConfig): Promise<string> {
    const envPath = path.join(this.projectPath, '.env.codemind');
    const envContent = this.generateEnvironmentContent();
    
    await fs.writeFile(envPath, envContent, 'utf8');
    
    this.logger.info('Environment file generated', { path: envPath });
    return envPath;
  }

  /**
   * Start containers
   */
  async startContainers(options: { detached?: boolean; build?: boolean } = {}): Promise<void> {
    this.logger.info('Starting containers...', options);

    const composeFile = path.join(this.projectPath, 'docker-compose.codemind.yml');
    const envFile = path.join(this.projectPath, '.env.codemind');
    
    const args = ['--env-file', envFile, '-f', composeFile, 'up'];
    
    if (options.detached) args.push('-d');
    if (options.build) args.push('--build');

    try {
      const result = await execAsync(`docker-compose ${args.join(' ')}`, {
        cwd: this.projectPath
      });
      
      this.logger.info('Containers started successfully', { output: result.stdout });
    } catch (error) {
      this.logger.error('Failed to start containers', error as Error);
      throw error;
    }
  }

  /**
   * Stop containers
   */
  async stopContainers(): Promise<void> {
    this.logger.info('Stopping containers...');

    const composeFile = path.join(this.projectPath, 'docker-compose.codemind.yml');
    const envFile = path.join(this.projectPath, '.env.codemind');
    
    try {
      const result = await execAsync(`docker-compose --env-file ${envFile} -f ${composeFile} down`, {
        cwd: this.projectPath
      });
      
      this.logger.info('Containers stopped successfully', { output: result.stdout });
    } catch (error) {
      this.logger.error('Failed to stop containers', error as Error);
      throw error;
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus(): Promise<any[]> {
    const composeFile = path.join(this.projectPath, 'docker-compose.codemind.yml');
    const envFile = path.join(this.projectPath, '.env.codemind');
    
    try {
      const result = await execAsync(`docker-compose --env-file ${envFile} -f ${composeFile} ps --format json`, {
        cwd: this.projectPath
      });
      
      return JSON.parse(`[${result.stdout.split('\n').filter(l => l.trim()).join(',')}]`);
    } catch (error) {
      this.logger.error('Failed to get container status', error as Error);
      return [];
    }
  }

  /**
   * Save container configuration
   */
  private async saveContainerConfig(config: DockerComposeConfig): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    const configData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      projectPath: this.projectPath,
      dockerCompose: config,
      metadata: {
        generatedBy: 'CodeMind CLI',
        services: Object.keys(config.services),
        volumes: Object.keys(config.volumes || {}),
        networks: Object.keys(config.networks || {})
      }
    };
    
    await fs.writeFile(this.configPath, JSON.stringify(configData, null, 2), 'utf8');
  }

  /**
   * Load saved container configuration
   */
  async loadContainerConfig(): Promise<DockerComposeConfig | null> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const configData = JSON.parse(configContent);
      return configData.dockerCompose;
    } catch (error) {
      this.logger.debug('No existing container configuration found');
      return null;
    }
  }

  /**
   * Read package.json for project metadata
   */
  private async readPackageJson(): Promise<any> {
    try {
      const packagePath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.debug('No package.json found');
      return null;
    }
  }

  /**
   * Convert configuration object to YAML
   */
  private convertToYaml(config: DockerComposeConfig): string {
    // Simple YAML conversion - in production, use a proper YAML library
    const yaml = [`version: '${config.version}'`];
    
    // Services section
    yaml.push('services:');
    for (const [name, service] of Object.entries(config.services)) {
      yaml.push(`  ${name}:`);
      for (const [key, value] of Object.entries(service)) {
        if (Array.isArray(value)) {
          yaml.push(`    ${key}:`);
          value.forEach(item => yaml.push(`      - ${item}`));
        } else if (typeof value === 'object' && value !== null) {
          yaml.push(`    ${key}:`);
          for (const [subKey, subValue] of Object.entries(value)) {
            if (Array.isArray(subValue)) {
              yaml.push(`      ${subKey}:`);
              subValue.forEach(item => yaml.push(`        - ${item}`));
            } else {
              yaml.push(`      ${subKey}: ${subValue}`);
            }
          }
        } else {
          yaml.push(`    ${key}: ${value}`);
        }
      }
    }
    
    // Volumes section
    if (config.volumes && Object.keys(config.volumes).length > 0) {
      yaml.push('volumes:');
      for (const [name, volume] of Object.entries(config.volumes)) {
        yaml.push(`  ${name}:`);
        if (typeof volume === 'object' && volume !== null) {
          for (const [key, value] of Object.entries(volume)) {
            yaml.push(`    ${key}: ${value}`);
          }
        }
      }
    }
    
    // Networks section
    if (config.networks && Object.keys(config.networks).length > 0) {
      yaml.push('networks:');
      for (const [name, network] of Object.entries(config.networks)) {
        yaml.push(`  ${name}:`);
        if (typeof network === 'object' && network !== null) {
          for (const [key, value] of Object.entries(network)) {
            yaml.push(`    ${key}: ${value}`);
          }
        }
      }
    }
    
    return yaml.join('\n');
  }

  /**
   * Generate environment file content
   */
  private generateEnvironmentContent(): string {
    return `# CodeMind Generated Environment Configuration
# Generated on: ${new Date().toISOString()}

# Application Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DB_NAME=appdb
DB_USER=appuser
DB_PASSWORD=apppass123
DB_HOST=app-database
DB_PORT=5432

# Redis Configuration
REDIS_HOST=app-redis
REDIS_PORT=6379

# Monitoring Configuration
GRAFANA_PASSWORD=admin123

# CodeMind Integration
CODEMIND_API_URL=http://localhost:3004
CODEMIND_ENABLED=true
CODEMIND_AUTO_TOOL_INSTALL=false
CODEMIND_LOG_LEVEL=info
`;
  }
}

/**
 * CLI integration for container management
 */
export class CLIContainerIntegration {
  private containerManager: ContainerManager;
  private logger = Logger.getInstance();

  constructor(projectPath: string) {
    this.containerManager = new ContainerManager(projectPath);
  }

  /**
   * Initialize containerization for a project via CLI
   */
  async initializeProject(options: {
    projectPath: string;
    includeDatabase?: boolean;
    includeRedis?: boolean;
    includeMonitoring?: boolean;
    autoStart?: boolean;
  }): Promise<void> {
    this.logger.info('Initializing containerization via CLI', options);

    try {
      // Initialize container configuration
      const config = await this.containerManager.initializeContainerization({
        includeDatabase: options.includeDatabase,
        includeRedis: options.includeRedis,
        includeMonitoring: options.includeMonitoring
      });

      // Generate Docker Compose and environment files
      const composeFile = await this.containerManager.generateDockerCompose(config);
      const envFile = await this.containerManager.generateEnvironmentFile(config);

      this.logger.info('Containerization initialized successfully', {
        composeFile,
        envFile,
        services: Object.keys(config.services)
      });

      // Auto-start if requested
      if (options.autoStart) {
        await this.containerManager.startContainers({ detached: true, build: true });
        this.logger.info('Containers started automatically');
      }

    } catch (error) {
      this.logger.error('Failed to initialize containerization', error as Error);
      throw error;
    }
  }

  /**
   * Send saved configurations when CLI requests containerization
   */
  async getContainerConfiguration(): Promise<{
    config: DockerComposeConfig | null;
    recommendations: string[];
    quickStart: string[];
  }> {
    const config = await this.containerManager.loadContainerConfig();
    
    const recommendations = [
      'Add database service for persistent storage',
      'Include Redis for caching and message queuing',
      'Set up monitoring with Prometheus and Grafana',
      'Configure health checks for all services',
      'Use persistent volumes for data retention'
    ];

    const quickStart = [
      'docker-compose -f docker-compose.codemind.yml --env-file .env.codemind up -d',
      'docker-compose -f docker-compose.codemind.yml --env-file .env.codemind ps',
      'docker-compose -f docker-compose.codemind.yml --env-file .env.codemind logs -f',
      'docker-compose -f docker-compose.codemind.yml --env-file .env.codemind down'
    ];

    return { config, recommendations, quickStart };
  }
}