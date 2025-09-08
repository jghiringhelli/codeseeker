"use strict";
/**
 * Tool Configuration Repository
 * Manages flexible tool configurations in MongoDB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolConfigRepo = exports.ToolConfigRepository = void 0;
const mongodb_client_1 = require("./mongodb-client");
const logger_1 = require("../utils/logger");
class ToolConfigRepository {
    collection;
    logger;
    cache = new Map();
    constructor() {
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'ToolConfigRepository');
    }
    async ensureConnection() {
        if (!this.collection) {
            if (!mongodb_client_1.mongoClient.isReady()) {
                await mongodb_client_1.mongoClient.connect();
            }
            this.collection = mongodb_client_1.mongoClient.getCollection('tool_configs');
        }
        return this.collection;
    }
    /**
     * Save or update tool configuration
     */
    async saveToolConfig(projectId, toolName, config) {
        try {
            const collection = await this.ensureConnection();
            const configDoc = {
                projectId,
                toolName,
                config,
                version: config.version || '1.0.0',
                updatedAt: new Date()
            };
            await collection.replaceOne({ projectId, toolName }, configDoc, { upsert: true });
            // Update cache
            const cacheKey = `${projectId}:${toolName}`;
            this.cache.set(cacheKey, configDoc);
            this.logger.info(`Saved config for ${toolName} in project ${projectId}`);
        }
        catch (error) {
            this.logger.error(`Failed to save tool config: ${error}`);
            throw error;
        }
    }
    /**
     * Get tool configuration with inheritance support
     */
    async getToolConfig(projectId, toolName) {
        try {
            const cacheKey = `${projectId}:${toolName}`;
            // Check cache first
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey)?.config;
            }
            // Try project-specific config
            let config = await this.collection.findOne({ projectId, toolName });
            // If not found, try default config
            if (!config) {
                config = await this.collection.findOne({
                    projectId: 'default',
                    toolName
                });
            }
            // If still not found, return null
            if (!config) {
                return null;
            }
            // Handle inheritance
            if (config.inheritFrom) {
                const parentConfig = await this.getToolConfig(config.inheritFrom, toolName);
                if (parentConfig) {
                    config.config = this.mergeConfigs(parentConfig, config.config);
                }
            }
            // Apply overrides if present
            if (config.overrides) {
                config.config = this.mergeConfigs(config.config, config.overrides);
            }
            // Cache the result
            this.cache.set(cacheKey, config);
            return config.config;
        }
        catch (error) {
            this.logger.error(`Failed to get tool config: ${error}`);
            return null;
        }
    }
    /**
     * Get configurations by framework
     */
    async getConfigsByFramework(framework) {
        try {
            return await this.collection.find({
                'config.frameworks': framework
            }).toArray();
        }
        catch (error) {
            this.logger.error(`Failed to get configs by framework: ${error}`);
            return [];
        }
    }
    /**
     * Get all configurations for a project
     */
    async getProjectConfigs(projectId) {
        try {
            return await this.collection.find({ projectId }).toArray();
        }
        catch (error) {
            this.logger.error(`Failed to get project configs: ${error}`);
            return [];
        }
    }
    /**
     * Copy default configurations to a new project
     */
    async initializeProjectConfigs(projectId) {
        try {
            const defaultConfigs = await this.collection.find({
                projectId: 'default'
            }).toArray();
            for (const defaultConfig of defaultConfigs) {
                const existingConfig = await this.collection.findOne({
                    projectId,
                    toolName: defaultConfig.toolName
                });
                if (!existingConfig) {
                    await this.saveToolConfig(projectId, defaultConfig.toolName, defaultConfig.config);
                }
            }
            this.logger.info(`Initialized configs for project ${projectId}`);
        }
        catch (error) {
            this.logger.error(`Failed to initialize project configs: ${error}`);
            throw error;
        }
    }
    /**
     * Update specific configuration field
     */
    async updateConfigField(projectId, toolName, field, value) {
        try {
            await this.collection.updateOne({ projectId, toolName }, {
                $set: {
                    [`config.${field}`]: value,
                    updatedAt: new Date()
                }
            });
            // Invalidate cache
            const cacheKey = `${projectId}:${toolName}`;
            this.cache.delete(cacheKey);
            this.logger.info(`Updated ${field} for ${toolName} in project ${projectId}`);
        }
        catch (error) {
            this.logger.error(`Failed to update config field: ${error}`);
            throw error;
        }
    }
    /**
     * Find optimal configuration based on similar projects
     */
    async findOptimalConfig(projectContext, toolName) {
        try {
            // Find projects with similar characteristics
            const similarProjects = await mongodb_client_1.mongoClient.getCollection('project_intelligence')
                .find({
                'context.languages': { $in: projectContext.languages },
                'context.frameworks': { $in: projectContext.frameworks },
                'context.projectType': projectContext.projectType
            })
                .limit(5)
                .toArray();
            if (similarProjects.length === 0) {
                return null;
            }
            // Get configs from similar projects
            const configs = await this.collection.find({
                projectId: { $in: similarProjects.map(p => p.projectId) },
                toolName
            }).toArray();
            if (configs.length === 0) {
                return null;
            }
            // Return the most recent successful config
            // In production, this could use ML to find the best config
            return configs[0].config;
        }
        catch (error) {
            this.logger.error(`Failed to find optimal config: ${error}`);
            return null;
        }
    }
    /**
     * Delete tool configuration
     */
    async deleteToolConfig(projectId, toolName) {
        try {
            const result = await this.collection.deleteOne({ projectId, toolName });
            // Invalidate cache
            const cacheKey = `${projectId}:${toolName}`;
            this.cache.delete(cacheKey);
            return result.deletedCount > 0;
        }
        catch (error) {
            this.logger.error(`Failed to delete tool config: ${error}`);
            return false;
        }
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.info('Configuration cache cleared');
    }
    /**
     * Merge two configuration objects
     */
    mergeConfigs(base, override) {
        const result = { ...base };
        for (const key in override) {
            if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
                result[key] = this.mergeConfigs(result[key] || {}, override[key]);
            }
            else {
                result[key] = override[key];
            }
        }
        return result;
    }
    /**
     * Validate configuration against schema
     */
    async validateConfig(toolName, config) {
        // TODO: Implement schema validation based on tool requirements
        // For now, just check that config is an object
        return typeof config === 'object' && config !== null;
    }
    /**
     * Get configuration history
     */
    async getConfigHistory(projectId, toolName, limit = 10) {
        try {
            // In a production system, we'd maintain a separate history collection
            // For now, return the current config
            const config = await this.collection.findOne({ projectId, toolName });
            return config ? [config] : [];
        }
        catch (error) {
            this.logger.error(`Failed to get config history: ${error}`);
            return [];
        }
    }
}
exports.ToolConfigRepository = ToolConfigRepository;
// Export singleton instance
exports.toolConfigRepo = new ToolConfigRepository();
//# sourceMappingURL=tool-config-repository.js.map