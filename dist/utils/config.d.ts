/**
 * Configuration Manager for the Intelligent Code Auxiliary System
 */
import { ConfigManager } from '../core/interfaces';
import { Logger } from './logger';
export interface SystemConfig {
    database: {
        path: string;
        maxConnections: number;
        timeout: number;
    };
    analysis: {
        maxBatchSize: number;
        maxFileSize: number;
        supportedExtensions: string[];
        excludedDirectories: string[];
        enableCaching: boolean;
        cacheTTL: number;
    };
    initialization: {
        defaultResumeTimeout: number;
        maxRetries: number;
        batchSize: number;
    };
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        enableFileLogging: boolean;
        logDirectory: string;
    };
    mcp: {
        port: number;
        host: string;
        enableCORS: boolean;
        timeout: number;
    };
    performance: {
        maxConcurrentOperations: number;
        memoryLimit: number;
        gcThreshold: number;
    };
}
export declare class SystemConfigManager implements ConfigManager {
    private config;
    private logger;
    private configPath?;
    constructor(logger?: Logger);
    get<T>(key: string, defaultValue?: T): T;
    set(key: string, value: any): void;
    load(configPath?: string): Promise<void>;
    save(configPath?: string): Promise<void>;
    getFullConfig(): Partial<SystemConfig>;
    updateFromEnvironment(): void;
    validate(): {
        valid: boolean;
        errors: string[];
    };
    private loadDefaults;
    private mergeConfig;
}
export declare const systemConfig: SystemConfigManager;
//# sourceMappingURL=config.d.ts.map