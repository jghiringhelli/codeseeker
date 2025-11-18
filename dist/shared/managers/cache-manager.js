"use strict";
/**
 * Local Cache Manager for CodeMind
 * Manages .codemind folder contents to minimize database queries
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCacheManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../../utils/logger");
class LocalCacheManager {
    logger;
    projectPath;
    cachePath;
    codemindDir;
    cache = null;
    constructor(projectPath) {
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'LocalCacheManager');
        this.projectPath = projectPath;
        this.codemindDir = path.join(projectPath, '.codemind');
        this.cachePath = path.join(this.codemindDir, 'local-cache.json');
    }
    /**
     * Initialize the .codemind directory and cache
     */
    async initialize() {
        try {
            // Ensure .codemind directory exists
            if (!fs.existsSync(this.codemindDir)) {
                fs.mkdirSync(this.codemindDir, { recursive: true });
                this.logger.info('Created .codemind directory');
            }
            // Load or create cache
            await this.loadCache();
            // Update cache metadata
            this.updateMetadata();
            this.logger.info('Local cache initialized');
        }
        catch (error) {
            this.logger.error(`Failed to initialize local cache: ${error}`);
            throw error;
        }
    }
    /**
     * Load cache from local file
     */
    async loadCache() {
        if (fs.existsSync(this.cachePath)) {
            try {
                const cacheData = fs.readFileSync(this.cachePath, 'utf-8');
                this.cache = JSON.parse(cacheData);
                this.cache.metadata.cacheHits++;
                this.logger.debug('Local cache loaded from file');
            }
            catch (error) {
                this.logger.warn('Failed to load cache, creating new one');
                this.createEmptyCache();
            }
        }
        else {
            this.createEmptyCache();
        }
    }
    /**
     * Create empty cache structure
     */
    createEmptyCache() {
        const now = new Date().toISOString();
        this.cache = {
            project: {
                id: '',
                name: '',
                path: this.projectPath,
                type: '',
                languages: [],
                frameworks: [],
                lastUpdated: now
            },
            context: {
                projectType: '',
                languages: [],
                frameworks: [],
                dependencies: {},
                architecture: '',
                patterns: [],
                insights: [],
                lastFetched: '',
                ttl: 60 // 1 hour default TTL
            },
            toolConfigs: {},
            recentAnalyses: [],
            session: {
                lastSessionId: '',
                lastAccessTime: now,
                totalSessions: 0,
                preferences: {
                    colorOutput: true,
                    verboseMode: false,
                    autoSuggest: true,
                    tokenBudget: 4000
                }
            },
            metadata: {
                version: '1.0.0',
                createdAt: now,
                lastUpdated: now,
                cacheHits: 0,
                cacheMisses: 0
            }
        };
        this.cache.metadata.cacheMisses++;
    }
    /**
     * Save cache to local file
     */
    async saveCache() {
        if (!this.cache)
            return;
        try {
            this.updateMetadata();
            const cacheData = JSON.stringify(this.cache, null, 2);
            fs.writeFileSync(this.cachePath, cacheData);
            this.logger.debug('Local cache saved to file');
        }
        catch (error) {
            this.logger.error(`Failed to save cache: ${error}`);
        }
    }
    /**
     * Update cache metadata
     */
    updateMetadata() {
        if (!this.cache)
            return;
        this.cache.metadata.lastUpdated = new Date().toISOString();
    }
    /**
     * Set project information
     */
    setProject(projectData) {
        if (!this.cache)
            return;
        this.cache.project = {
            ...this.cache.project,
            ...projectData,
            lastUpdated: new Date().toISOString()
        };
    }
    /**
     * Get project information
     */
    getProject() {
        return this.cache?.project || null;
    }
    /**
     * Set project context with TTL check
     */
    setContext(contextData, ttlMinutes = 60) {
        if (!this.cache)
            return;
        this.cache.context = {
            ...this.cache.context,
            ...contextData,
            lastFetched: new Date().toISOString(),
            ttl: ttlMinutes
        };
    }
    /**
     * Get project context if not expired
     */
    getContext() {
        if (!this.cache || !this.cache.context.lastFetched)
            return null;
        const lastFetched = new Date(this.cache.context.lastFetched);
        const now = new Date();
        const minutesElapsed = (now.getTime() - lastFetched.getTime()) / (1000 * 60);
        if (minutesElapsed > this.cache.context.ttl) {
            this.logger.debug('Context cache expired');
            return null;
        }
        this.cache.metadata.cacheHits++;
        return this.cache.context;
    }
    /**
     * Set tool configuration
     */
    setToolConfig(toolName, config, enabled = true) {
        if (!this.cache)
            return;
        this.cache.toolConfigs[toolName] = {
            config,
            enabled,
            lastModified: new Date().toISOString()
        };
    }
    /**
     * Get tool configuration
     */
    getToolConfig(toolName) {
        if (!this.cache)
            return null;
        const toolConfig = this.cache.toolConfigs[toolName];
        if (toolConfig) {
            this.cache.metadata.cacheHits++;
            return toolConfig.config;
        }
        this.cache.metadata.cacheMisses++;
        return null;
    }
    /**
     * Get all tool configurations
     */
    getAllToolConfigs() {
        if (!this.cache)
            return {};
        const configs = {};
        Object.entries(this.cache.toolConfigs).forEach(([toolName, data]) => {
            if (data.enabled) {
                configs[toolName] = data.config;
            }
        });
        this.cache.metadata.cacheHits++;
        return configs;
    }
    /**
     * Add recent analysis result
     */
    addRecentAnalysis(analysis) {
        if (!this.cache)
            return;
        this.cache.recentAnalyses.unshift(analysis);
        // Keep only last 10 analyses
        if (this.cache.recentAnalyses.length > 10) {
            this.cache.recentAnalyses = this.cache.recentAnalyses.slice(0, 10);
        }
    }
    /**
     * Get recent analyses
     */
    getRecentAnalyses(limit = 10) {
        if (!this.cache)
            return [];
        this.cache.metadata.cacheHits++;
        return this.cache.recentAnalyses.slice(0, limit);
    }
    /**
     * Update session information
     */
    updateSession(sessionId, preferences) {
        if (!this.cache)
            return;
        this.cache.session.lastSessionId = sessionId;
        this.cache.session.lastAccessTime = new Date().toISOString();
        this.cache.session.totalSessions++;
        if (preferences) {
            this.cache.session.preferences = {
                ...this.cache.session.preferences,
                ...preferences
            };
        }
    }
    /**
     * Get session information
     */
    getSession() {
        return this.cache?.session || null;
    }
    /**
     * Generate or update codemind.md file
     */
    async generateCodeMindMd() {
        if (!this.cache)
            return;
        const codemindMdPath = path.join(this.codemindDir, 'codemind.md');
        const project = this.cache.project;
        const context = this.cache.context;
        const session = this.cache.session;
        const content = `# CodeMind Project Configuration

This file is automatically generated and maintained by CodeMind.

## Project Information

**Project ID**: \`${project.id}\`
**Project Name**: ${project.name}
**Project Path**: ${project.path}
**Project Type**: ${project.type}
**Languages**: ${project.languages.join(', ')}
**Frameworks**: ${project.frameworks.join(', ')}

## Architecture & Patterns

**Architecture**: ${context.architecture}
**Detected Patterns**: ${context.patterns.join(', ')}

## Dependencies

${Object.entries(context.dependencies).map(([name, version]) => `- **${name}**: ${version}`).join('\n')}

## Session Preferences

- **Color Output**: ${session.preferences.colorOutput ? 'Enabled' : 'Disabled'}
- **Verbose Mode**: ${session.preferences.verboseMode ? 'Enabled' : 'Disabled'}
- **Auto Suggest**: ${session.preferences.autoSuggest ? 'Enabled' : 'Disabled'}
- **Token Budget**: ${session.preferences.tokenBudget}

## Tool Configurations

${Object.entries(this.cache.toolConfigs).map(([toolName, config]) => `### ${toolName}\n- **Status**: ${config.enabled ? 'Enabled' : 'Disabled'}\n- **Last Modified**: ${config.lastModified}`).join('\n\n')}

## Recent Analysis Summary

${this.cache.recentAnalyses.slice(0, 5).map(analysis => `- **${analysis.type}** (${analysis.timestamp}): ${analysis.summary}`).join('\n')}

## Cache Statistics

- **Total Sessions**: ${session.totalSessions}
- **Cache Hits**: ${this.cache.metadata.cacheHits}
- **Cache Misses**: ${this.cache.metadata.cacheMisses}
- **Last Updated**: ${this.cache.metadata.lastUpdated}

---

*This file is automatically updated by CodeMind. Manual changes may be overwritten.*
`;
        try {
            fs.writeFileSync(codemindMdPath, content);
            this.logger.info('Generated codemind.md');
        }
        catch (error) {
            this.logger.error(`Failed to generate codemind.md: ${error}`);
        }
    }
    /**
     * Clear expired cache entries
     */
    clearExpiredCache() {
        if (!this.cache)
            return;
        // Clear expired context
        if (this.cache.context.lastFetched) {
            const lastFetched = new Date(this.cache.context.lastFetched);
            const now = new Date();
            const minutesElapsed = (now.getTime() - lastFetched.getTime()) / (1000 * 60);
            if (minutesElapsed > this.cache.context.ttl) {
                this.cache.context = {
                    projectType: '',
                    languages: [],
                    frameworks: [],
                    dependencies: {},
                    architecture: '',
                    patterns: [],
                    insights: [],
                    lastFetched: '',
                    ttl: 60
                };
                this.logger.debug('Cleared expired context cache');
            }
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        if (!this.cache)
            return { hits: 0, misses: 0, hitRatio: 0 };
        const hits = this.cache.metadata.cacheHits;
        const misses = this.cache.metadata.cacheMisses;
        const total = hits + misses;
        const hitRatio = total > 0 ? hits / total : 0;
        return { hits, misses, hitRatio };
    }
}
exports.LocalCacheManager = LocalCacheManager;
//# sourceMappingURL=cache-manager.js.map