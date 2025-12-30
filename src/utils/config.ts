/**
 * Configuration Manager for the Intelligent Code Auxiliary System
 */

import { ConfigManager } from '../core/interfaces';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { Logger } from './logger';

export interface SystemConfig {
  // Database configuration
  database: {
    path: string;
    maxConnections: number;
    timeout: number;
  };

  // Analysis configuration
  analysis: {
    maxBatchSize: number;
    maxFileSize: number; // in MB
    supportedExtensions: string[];
    excludedDirectories: string[];
    enableCaching: boolean;
    cacheTTL: number; // in hours
  };

  // Initialization configuration
  initialization: {
    defaultResumeTimeout: number; // in hours
    maxRetries: number;
    batchSize: number;
  };

  // Logging configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableFileLogging: boolean;
    logDirectory: string;
  };

  // MCP configuration
  mcp: {
    port: number;
    host: string;
    enableCORS: boolean;
    timeout: number;
  };

  // Performance configuration
  performance: {
    maxConcurrentOperations: number;
    memoryLimit: number; // in MB
    gcThreshold: number;
  };
}

export class SystemConfigManager implements ConfigManager {
  private config: Partial<SystemConfig> = {};
  private logger: Logger;
  private configPath?: string;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this?.loadDefaults();
  }

  get<T>(key: string, defaultValue?: T): T {
    const keys = key?.split('.');
    let current: any = this.config;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return defaultValue as T;
      }
    }

    return current as T;
  }

  set(key: string, value: any): void {
    const keys = key?.split('.');
    let current: any = this.config;

    for (let i = 0; i < keys?.length - 1; i++) {
      const k = keys[i];
      if (!k) continue;
      
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    const lastKey = keys[keys?.length - 1];
    if (lastKey) {
      current[lastKey] = value;
      this.logger.debug(`Config updated: ${key} = ${JSON.stringify(value)}`);
    }
  }

  async load(configPath?: string): Promise<void> {
    if (configPath) {
      this.configPath = resolve(configPath);
    }

    if (!this.configPath) {
      this.logger.warn('No config path specified, using defaults');
      return;
    }

    try {
      const configContent = await fs?.readFile(this.configPath, 'utf8');
      const loadedConfig = JSON.parse(configContent);
      
      // Merge with existing config (loaded config takes precedence)
      this.config = this?.mergeConfig(this.config, loadedConfig);
      
      this.logger.info(`Configuration loaded from: ${this.configPath}`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        this.logger.info(`Config file not found at ${this.configPath}, creating with defaults`);
        await this?.save();
      } else {
        this.logger.error(`Failed to load config from ${this.configPath}`, error as Error);
        throw error as Error;
      }
    }
  }

  async save(configPath?: string): Promise<void> {
    const targetPath = configPath ? resolve(configPath) : this.configPath;
    
    if (!targetPath) {
      throw new Error('No config path specified for saving');
    }

    try {
      const configJson = JSON.stringify(this.config, null, 2);
      await fs?.writeFile(targetPath, configJson, 'utf8');
      this.configPath = targetPath;
      this.logger.info(`Configuration saved to: ${targetPath}`);
    } catch (error) {
      this.logger.error(`Failed to save config to ${targetPath}`, error as Error);
      throw error as Error;
    }
  }

  getFullConfig(): Partial<SystemConfig> {
    return { ...this.config };
  }

  updateFromEnvironment(): void {
    const envMappings = {
      'DB_PATH': 'database.path',
      'DB_TIMEOUT': 'database.timeout',
      'MAX_BATCH_SIZE': 'analysis.maxBatchSize',
      'MAX_FILE_SIZE': 'analysis.maxFileSize',
      'ENABLE_CACHING': 'analysis.enableCaching',
      'CACHE_TTL': 'analysis.cacheTTL',
      'LOG_LEVEL': 'logging.level',
      'LOG_DIR': 'logging.logDirectory',
      'MCP_PORT': 'mcp.port',
      'MCP_HOST': 'mcp.host',
      'MAX_MEMORY': 'performance.memoryLimit'
    };

    for (const [envVar, configKey] of Object.entries(envMappings)) {
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        // Parse value based on type
        let parsedValue: any = envValue;
        
        if (envValue?.toLowerCase() === 'true') {
          parsedValue = true;
        } else if (envValue?.toLowerCase() === 'false') {
          parsedValue = false;
        } else if (!isNaN(Number(envValue))) {
          parsedValue = Number(envValue);
        }

        this?.set(configKey, parsedValue);
        this.logger.debug(`Config updated from env: ${configKey} = ${parsedValue}`);
      }
    }
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required configuration
    const requiredPaths = [
      'database.path',
      'analysis.maxBatchSize',
      'analysis.maxFileSize',
      'mcp.port',
      'logging.level'
    ];

    for (const path of requiredPaths) {
      const value = this?.get(path);
      if (value === undefined || value === null) {
        errors?.push(`Missing required configuration: ${path}`);
      }
    }

    // Validate specific values
    const logLevel = this.get<string>('logging.level');
    if (logLevel && !['debug', 'info', 'warn', 'error'].includes(logLevel)) {
      errors?.push(`Invalid logging level: ${logLevel}`);
    }

    const maxBatchSize = this.get<number>('analysis.maxBatchSize');
    if (maxBatchSize && (maxBatchSize <= 0 || maxBatchSize > 1000)) {
      errors?.push(`Invalid maxBatchSize: ${maxBatchSize}. Must be between 1 and 1000`);
    }

    const mcpPort = this.get<number>('mcp.port');
    if (mcpPort && (mcpPort < 1 || mcpPort > 65535)) {
      errors?.push(`Invalid MCP port: ${mcpPort}. Must be between 1 and 65535`);
    }

    return {
      valid: errors?.length === 0,
      errors
    };
  }

  private loadDefaults(): void {
    const defaults: SystemConfig = {
      database: {
        path: './data/auxiliary-system.db',
        maxConnections: 10,
        timeout: 30000
      },
      analysis: {
        maxBatchSize: 100,
        maxFileSize: 10, // 10MB
        supportedExtensions: [
          '.ts', '.js', '.tsx', '.jsx',
          '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs',
          '.php', '.rb', '.swift', '.kt'
        ],
        excludedDirectories: [
          'node_modules', '.git', 'dist', 'build', '.next',
          '__pycache__', '.pytest_cache', 'vendor', 'target'
        ],
        enableCaching: true,
        cacheTTL: 168 // 1 week in hours
      },
      initialization: {
        defaultResumeTimeout: 24, // 24 hours
        maxRetries: 3,
        batchSize: 50
      },
      logging: {
        level: process.env?.NODE_ENV === 'development' ? 'debug' : 'info',
        enableFileLogging: false,
        logDirectory: './logs'
      },
      mcp: {
        port: 3000,
        host: 'localhost',
        enableCORS: true,
        timeout: 30000
      },
      performance: {
        maxConcurrentOperations: 5,
        memoryLimit: 512, // 512MB
        gcThreshold: 0.8
      }
    };

    this.config = defaults;
  }

  private mergeConfig(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source?.hasOwnProperty(key)) {
        if (
          source[key] && 
          typeof source[key] === 'object' && 
          !Array.isArray(source[key]) &&
          target[key] && 
          typeof target[key] === 'object' && 
          !Array.isArray(target[key])
        ) {
          result[key] = this?.mergeConfig(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }
}

// Global config instance
export const systemConfig = new SystemConfigManager();