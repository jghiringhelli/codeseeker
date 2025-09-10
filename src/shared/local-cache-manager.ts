/**
 * Local Cache Manager for CodeMind
 * Manages .codemind folder contents to minimize database queries
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger, LogLevel } from '../utils/logger';

export interface LocalCacheData {
  // Project Identity
  project: {
    id: string;
    name: string;
    path: string;
    type: string;
    languages: string[];
    frameworks: string[];
    lastUpdated: string;
  };
  
  // Project Context (cached to avoid frequent DB queries)
  context: {
    projectType: string;
    languages: string[];
    frameworks: string[];
    dependencies: Record<string, string>;
    architecture: string;
    patterns: string[];
    insights: any[];
    lastFetched: string;
    ttl: number; // Time to live in minutes
  };
  
  // Tool Configurations (cached locally)
  toolConfigs: {
    [toolName: string]: {
      config: any;
      enabled: boolean;
      lastModified: string;
    };
  };
  
  // Recent Analysis Results (last 10 for quick access)
  recentAnalyses: Array<{
    id: string;
    type: string;
    timestamp: string;
    summary: string;
    results: any;
  }>;
  
  // Session State
  session: {
    lastSessionId: string;
    lastAccessTime: string;
    totalSessions: number;
    preferences: {
      colorOutput: boolean;
      verboseMode: boolean;
      autoSuggest: boolean;
      tokenBudget: number;
    };
  };
  
  // Cache Metadata
  metadata: {
    version: string;
    createdAt: string;
    lastUpdated: string;
    cacheHits: number;
    cacheMisses: number;
  };
}

export class LocalCacheManager {
  private logger: Logger;
  private projectPath: string;
  private cachePath: string;
  private codemindDir: string;
  private cache: LocalCacheData | null = null;

  constructor(projectPath: string) {
    this.logger = new Logger(LogLevel.INFO, 'LocalCacheManager');
    this.projectPath = projectPath;
    this.codemindDir = path.join(projectPath, '.codemind');
    this.cachePath = path.join(this.codemindDir, 'local-cache.json');
  }

  /**
   * Initialize the .codemind directory and cache
   */
  async initialize(): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to initialize local cache: ${error}`);
      throw error;
    }
  }

  /**
   * Load cache from local file
   */
  private async loadCache(): Promise<void> {
    if (fs.existsSync(this.cachePath)) {
      try {
        const cacheData = fs.readFileSync(this.cachePath, 'utf-8');
        this.cache = JSON.parse(cacheData);
        this.cache!.metadata.cacheHits++;
        this.logger.debug('Local cache loaded from file');
      } catch (error) {
        this.logger.warn('Failed to load cache, creating new one');
        this.createEmptyCache();
      }
    } else {
      this.createEmptyCache();
    }
  }

  /**
   * Create empty cache structure
   */
  private createEmptyCache(): void {
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
  async saveCache(): Promise<void> {
    if (!this.cache) return;

    try {
      this.updateMetadata();
      const cacheData = JSON.stringify(this.cache, null, 2);
      fs.writeFileSync(this.cachePath, cacheData);
      this.logger.debug('Local cache saved to file');
    } catch (error) {
      this.logger.error(`Failed to save cache: ${error}`);
    }
  }

  /**
   * Update cache metadata
   */
  private updateMetadata(): void {
    if (!this.cache) return;
    
    this.cache.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Set project information
   */
  setProject(projectData: Partial<LocalCacheData['project']>): void {
    if (!this.cache) return;

    this.cache.project = {
      ...this.cache.project,
      ...projectData,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get project information
   */
  getProject(): LocalCacheData['project'] | null {
    return this.cache?.project || null;
  }

  /**
   * Set project context with TTL check
   */
  setContext(contextData: Partial<LocalCacheData['context']>, ttlMinutes: number = 60): void {
    if (!this.cache) return;

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
  getContext(): LocalCacheData['context'] | null {
    if (!this.cache || !this.cache.context.lastFetched) return null;

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
  setToolConfig(toolName: string, config: any, enabled: boolean = true): void {
    if (!this.cache) return;

    this.cache.toolConfigs[toolName] = {
      config,
      enabled,
      lastModified: new Date().toISOString()
    };
  }

  /**
   * Get tool configuration
   */
  getToolConfig(toolName: string): any | null {
    if (!this.cache) return null;

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
  getAllToolConfigs(): Record<string, any> {
    if (!this.cache) return {};

    const configs: Record<string, any> = {};
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
  addRecentAnalysis(analysis: LocalCacheData['recentAnalyses'][0]): void {
    if (!this.cache) return;

    this.cache.recentAnalyses.unshift(analysis);
    
    // Keep only last 10 analyses
    if (this.cache.recentAnalyses.length > 10) {
      this.cache.recentAnalyses = this.cache.recentAnalyses.slice(0, 10);
    }
  }

  /**
   * Get recent analyses
   */
  getRecentAnalyses(limit: number = 10): LocalCacheData['recentAnalyses'] {
    if (!this.cache) return [];

    this.cache.metadata.cacheHits++;
    return this.cache.recentAnalyses.slice(0, limit);
  }

  /**
   * Update session information
   */
  updateSession(sessionId: string, preferences?: Partial<LocalCacheData['session']['preferences']>): void {
    if (!this.cache) return;

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
  getSession(): LocalCacheData['session'] | null {
    return this.cache?.session || null;
  }

  /**
   * Generate or update codemind.md file
   */
  async generateCodeMindMd(): Promise<void> {
    if (!this.cache) return;

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

${Object.entries(this.cache.toolConfigs).map(([toolName, config]) => 
  `### ${toolName}\n- **Status**: ${config.enabled ? 'Enabled' : 'Disabled'}\n- **Last Modified**: ${config.lastModified}`
).join('\n\n')}

## Recent Analysis Summary

${this.cache.recentAnalyses.slice(0, 5).map(analysis => 
  `- **${analysis.type}** (${analysis.timestamp}): ${analysis.summary}`
).join('\n')}

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
    } catch (error) {
      this.logger.error(`Failed to generate codemind.md: ${error}`);
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    if (!this.cache) return;

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
  getCacheStats(): { hits: number; misses: number; hitRatio: number } {
    if (!this.cache) return { hits: 0, misses: 0, hitRatio: 0 };

    const hits = this.cache.metadata.cacheHits;
    const misses = this.cache.metadata.cacheMisses;
    const total = hits + misses;
    const hitRatio = total > 0 ? hits / total : 0;

    return { hits, misses, hitRatio };
  }
}