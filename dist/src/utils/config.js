"use strict";
/**
 * Configuration Manager for the Intelligent Code Auxiliary System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemConfig = exports.SystemConfigManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("./logger");
class SystemConfigManager {
    config = {};
    logger;
    configPath;
    constructor(logger) {
        this.logger = logger || new logger_1.Logger();
        this.loadDefaults();
    }
    get(key, defaultValue) {
        const keys = key.split('.');
        let current = this.config;
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            }
            else {
                return defaultValue;
            }
        }
        return current;
    }
    set(key, value) {
        const keys = key.split('.');
        let current = this.config;
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!k)
                continue;
            if (!(k in current) || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
            current[lastKey] = value;
            this.logger.debug(`Config updated: ${key} = ${JSON.stringify(value)}`);
        }
    }
    async load(configPath) {
        if (configPath) {
            this.configPath = (0, path_1.resolve)(configPath);
        }
        if (!this.configPath) {
            this.logger.warn('No config path specified, using defaults');
            return;
        }
        try {
            const configContent = await fs_1.promises.readFile(this.configPath, 'utf8');
            const loadedConfig = JSON.parse(configContent);
            // Merge with existing config (loaded config takes precedence)
            this.config = this.mergeConfig(this.config, loadedConfig);
            this.logger.info(`Configuration loaded from: ${this.configPath}`);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.info(`Config file not found at ${this.configPath}, creating with defaults`);
                await this.save();
            }
            else {
                this.logger.error(`Failed to load config from ${this.configPath}`, error);
                throw error;
            }
        }
    }
    async save(configPath) {
        const targetPath = configPath ? (0, path_1.resolve)(configPath) : this.configPath;
        if (!targetPath) {
            throw new Error('No config path specified for saving');
        }
        try {
            const configJson = JSON.stringify(this.config, null, 2);
            await fs_1.promises.writeFile(targetPath, configJson, 'utf8');
            this.configPath = targetPath;
            this.logger.info(`Configuration saved to: ${targetPath}`);
        }
        catch (error) {
            this.logger.error(`Failed to save config to ${targetPath}`, error);
            throw error;
        }
    }
    getFullConfig() {
        return { ...this.config };
    }
    updateFromEnvironment() {
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
                let parsedValue = envValue;
                if (envValue.toLowerCase() === 'true') {
                    parsedValue = true;
                }
                else if (envValue.toLowerCase() === 'false') {
                    parsedValue = false;
                }
                else if (!isNaN(Number(envValue))) {
                    parsedValue = Number(envValue);
                }
                this.set(configKey, parsedValue);
                this.logger.debug(`Config updated from env: ${configKey} = ${parsedValue}`);
            }
        }
    }
    validate() {
        const errors = [];
        // Validate required configuration
        const requiredPaths = [
            'database.path',
            'analysis.maxBatchSize',
            'analysis.maxFileSize',
            'mcp.port',
            'logging.level'
        ];
        for (const path of requiredPaths) {
            const value = this.get(path);
            if (value === undefined || value === null) {
                errors.push(`Missing required configuration: ${path}`);
            }
        }
        // Validate specific values
        const logLevel = this.get('logging.level');
        if (logLevel && !['debug', 'info', 'warn', 'error'].includes(logLevel)) {
            errors.push(`Invalid logging level: ${logLevel}`);
        }
        const maxBatchSize = this.get('analysis.maxBatchSize');
        if (maxBatchSize && (maxBatchSize <= 0 || maxBatchSize > 1000)) {
            errors.push(`Invalid maxBatchSize: ${maxBatchSize}. Must be between 1 and 1000`);
        }
        const mcpPort = this.get('mcp.port');
        if (mcpPort && (mcpPort < 1 || mcpPort > 65535)) {
            errors.push(`Invalid MCP port: ${mcpPort}. Must be between 1 and 65535`);
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    loadDefaults() {
        const defaults = {
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
                level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
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
    mergeConfig(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] &&
                    typeof source[key] === 'object' &&
                    !Array.isArray(source[key]) &&
                    target[key] &&
                    typeof target[key] === 'object' &&
                    !Array.isArray(target[key])) {
                    result[key] = this.mergeConfig(target[key], source[key]);
                }
                else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }
}
exports.SystemConfigManager = SystemConfigManager;
// Global config instance
exports.systemConfig = new SystemConfigManager();
//# sourceMappingURL=config.js.map