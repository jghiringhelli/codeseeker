/**
 * Enhanced Tool Interface - Maintains all existing functionality while adding database operations
 * Tools remain auto-discoverable, bundleable, intention-based, and fully functional
 */

import { toolDB } from '../orchestrator/tool-database-api';
import { PostgreSQLAnalyticsDatabase, AnalyticsMetric, CodeQualityMetric, FileChangeEvent } from './postgresql-analytics-database';
import { toolConfigRepo } from './tool-config-repository';
import { analysisRepo } from './analysis-repository';
import { projectIntelligence } from './project-intelligence';

// Base tool interface with all existing capabilities
export interface BaseToolInterface {
  // Core identification
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Auto-discovery metadata
  category: string;
  languages: string[];
  frameworks: string[];
  purposes: string[];
  capabilities: Record<string, any>;
  
  // Intention matching
  intents: string[];
  keywords: string[];
  
  // Bundling support
  bundleCompatible: boolean;
  dependencies: string[];
  
  // Performance characteristics
  performanceImpact: 'minimal' | 'low' | 'medium' | 'high';
  tokenUsage: 'minimal' | 'low' | 'medium' | 'high' | 'variable';
  
  // Execution methods
  analyze(projectPath: string, projectId: string, parameters?: any, fileContext?: any): Promise<any>;
  updateKnowledge?(projectId: string, data: any): Promise<void>;
  
  // New: Database interface methods
  queryData(projectId: string, filters?: any): Promise<any>;
  saveData(projectId: string, data: any): Promise<any>;
  
  // Tool-specific analysis (preserved from original)
  isApplicable?(projectPath: string, context: any): boolean;
  getRecommendations?(analysisResult: any): string[];
}

// Enhanced abstract base class that all tools extend
export abstract class AnalysisTool implements BaseToolInterface {
  // Required properties
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract version: string;
  abstract category: string;
  abstract languages: string[];
  abstract frameworks: string[];
  abstract purposes: string[];
  abstract intents: string[];
  abstract keywords: string[];
  
  // Default values
  bundleCompatible = true;
  dependencies: string[] = [];
  performanceImpact: 'minimal' | 'low' | 'medium' | 'high' = 'medium';
  tokenUsage: 'minimal' | 'low' | 'medium' | 'high' | 'variable' = 'medium';
  capabilities: Record<string, any> = {};

  // ============================================
  // CORE ANALYSIS METHODS (Existing functionality)
  // ============================================
  
  /**
   * Main analysis method - combines database query + live analysis
   */
  async analyze(projectPath: string, projectId: string, parameters: any = {}, fileContext?: any): Promise<any> {
    try {
      const config = await toolConfigRepo.getToolConfig(projectId, this.name);
      if (config) {
        parameters = { ...config, ...parameters }; // Parameters override config
      }
      
      // First, check if we have recent cached data
      const useCache = parameters.useCache !== false;
      let cachedData = null;
      
      if (useCache) {
        cachedData = await this.queryData(projectId, parameters);
        
        // If we have recent data and don't need fresh analysis, return it
        if (cachedData && cachedData.length > 0 && !parameters.forceRefresh) {
          const isRecent = this.isCachedDataRecent(cachedData, parameters.maxAge || 3600000); // 1 hour default
          if (isRecent) {
            return {
              source: 'cached',
              data: cachedData,
              analysis: this.processCachedData(cachedData),
              timestamp: new Date(),
              fromCache: true
            };
          }
        }
      }
      
      // Record start time for analytics
      const startTime = Date.now();
      
      // Perform live analysis with file context
      const freshAnalysis = await this.performAnalysis(projectPath, projectId, { ...parameters, fileContext });
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Save results to both databases
      if (freshAnalysis?.data) {
        await this.saveData(projectId, freshAnalysis.data);
        
        await analysisRepo.storeAnalysis(projectId, this.name, {
          ...freshAnalysis,
          executionTime,
          parameters
        });
      }
      
      // Record performance metrics
      await this.recordPerformanceMetric(
        projectId,
        executionTime,
        cachedData ? 0.5 : 0, // Cache hit rate
        process.memoryUsage().heapUsed,
        { toolVersion: this.version }
      );
      
      // Learn from execution
      await projectIntelligence.learnFromToolExecution(
        projectId,
        this.name,
        { success: true, executionTime }
      );
      
      return {
        source: 'live',
        data: freshAnalysis.data,
        analysis: freshAnalysis.analysis,
        recommendations: this.getRecommendations ? this.getRecommendations(freshAnalysis) : [],
        timestamp: new Date(),
        fromCache: false,
        cachedDataAvailable: cachedData && cachedData.length > 0
      };
      
    } catch (error) {
      console.error(`Analysis failed for ${this.name}:`, error);
      
      // Learn from failure
      await projectIntelligence.learnFromToolExecution(
        projectId,
        this.name,
        { success: false, executionTime: 0 }
      );
      
      // Fallback to cached data if live analysis fails
      try {
        const fallbackData = await this.queryData(projectId, { limit: 100 });
        if (fallbackData && fallbackData.length > 0) {
          return {
            source: 'fallback',
            data: fallbackData,
            analysis: this.processCachedData(fallbackData),
            error: error instanceof Error ? error.message : 'Analysis failed',
            timestamp: new Date(),
            fromCache: true
          };
        }
      } catch (fallbackError) {
        console.error(`Fallback query also failed for ${this.name}:`, fallbackError);
      }
      
      throw error;
    }
  }

  // ============================================
  // DATABASE INTERFACE METHODS (New functionality)
  // ============================================
  
  /**
   * Query data from database - acts as interface to database API
   */
  async queryData(projectId: string, filters: any = {}): Promise<any> {
    try {
      return await toolDB.getToolData(projectId, this.getDatabaseToolName(), filters);
    } catch (error) {
      console.error(`Database query failed for ${this.name}:`, error);
      return null;
    }
  }

  /**
   * Save data to database - acts as interface to database API
   */
  async saveData(projectId: string, data: any): Promise<any> {
    try {
      return await toolDB.saveToolData(projectId, this.getDatabaseToolName(), data);
    } catch (error) {
      console.error(`Database save failed for ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Update knowledge (existing method, now also updates database)
   */
  async updateKnowledge(projectId: string, data: any): Promise<void> {
    try {
      // Perform any tool-specific knowledge update logic
      await this.performKnowledgeUpdate(projectId, data);
      
      // Update database if we have new insights
      if (data.insights || data.newData) {
        await this.saveData(projectId, data.insights || data.newData);
      }
    } catch (error) {
      console.error(`Knowledge update failed for ${this.name}:`, error);
    }
  }

  // ============================================
  // ABSTRACT METHODS (Must be implemented by each tool)
  // ============================================
  
  /**
   * Perform the actual analysis - tool-specific implementation
   */
  abstract performAnalysis(projectPath: string, projectId: string, parameters: any): Promise<any>;
  
  /**
   * Get database tool name for API calls
   */
  abstract getDatabaseToolName(): string;

  // ============================================
  // UTILITY METHODS (Default implementations, can be overridden)
  // ============================================
  
  /**
   * Check if tool is applicable to the project
   */
  isApplicable(projectPath: string, context: any): boolean {
    // Default implementation - override for specific logic
    return true;
  }

  /**
   * Generate recommendations from analysis
   */
  getRecommendations(analysisResult: any): string[] {
    // Default implementation - override for specific recommendations
    return [];
  }

  /**
   * Process cached data into analysis format
   */
  protected processCachedData(cachedData: any[]): any {
    return {
      summary: `Found ${cachedData.length} cached entries`,
      items: cachedData,
      processed: true
    };
  }

  /**
   * Check if cached data is recent enough
   */
  protected isCachedDataRecent(cachedData: any[], maxAge: number): boolean {
    if (!cachedData || cachedData.length === 0) return false;
    
    const mostRecent = cachedData.reduce((latest, item) => {
      const itemDate = new Date(item.updated_at || item.created_at);
      return itemDate > latest ? itemDate : latest;
    }, new Date(0));
    
    return (Date.now() - mostRecent.getTime()) <= maxAge;
  }

  // ============================================
  // ANALYTICS INTEGRATION (New functionality)
  // ============================================
  
  /**
   * Record performance metrics for analytics
   */
  protected async recordPerformanceMetric(projectId: string, executionTime: number, cacheHitRate: number, memoryUsage?: number, metadata?: any): Promise<void> {
    try {
      const analyticsDb = new PostgreSQLAnalyticsDatabase(projectId);
      await analyticsDb.initialize();
      
      const metric: AnalyticsMetric = {
        project_id: projectId,
        tool_name: this.name,
        execution_time: executionTime,
        cache_hit_rate: cacheHitRate,
        memory_usage: memoryUsage,
        timestamp: new Date(),
        metadata: { ...metadata, tool_version: this.version }
      };
      
      await analyticsDb.insertPerformanceMetric(metric);
    } catch (error) {
      console.warn(`Failed to record performance metric for ${this.name}:`, error);
    }
  }
  
  /**
   * Record code quality metrics for analytics
   */
  protected async recordQualityMetric(projectId: string, filePath: string, metricType: string, metricValue: number, metadata?: any): Promise<void> {
    try {
      const analyticsDb = new PostgreSQLAnalyticsDatabase(projectId);
      await analyticsDb.initialize();
      
      const metric: CodeQualityMetric = {
        project_id: projectId,
        file_path: filePath,
        metric_type: metricType,
        metric_value: metricValue,
        tool_name: this.name,
        timestamp: new Date(),
        metadata: { ...metadata, tool_version: this.version }
      };
      
      await analyticsDb.insertCodeQualityMetric(metric);
    } catch (error) {
      console.warn(`Failed to record quality metric for ${this.name}:`, error);
    }
  }
  
  /**
   * Record file change events for analytics
   */
  protected async recordFileEvent(projectId: string, filePath: string, eventType: string, contentHash?: string, fileSize?: number, metadata?: any): Promise<void> {
    try {
      const analyticsDb = new PostgreSQLAnalyticsDatabase(projectId);
      await analyticsDb.initialize();
      
      const event: FileChangeEvent = {
        project_id: projectId,
        file_path: filePath,
        event_type: eventType,
        content_hash: contentHash,
        file_size: fileSize,
        timestamp: new Date(),
        metadata: { ...metadata, tool_name: this.name }
      };
      
      await analyticsDb.insertFileChangeEvent(event);
    } catch (error) {
      console.warn(`Failed to record file event for ${this.name}:`, error);
    }
  }

  /**
   * Perform tool-specific knowledge updates
   */
  protected async performKnowledgeUpdate(projectId: string, data: any): Promise<void> {
    // Default implementation - override for specific logic
  }

  // ============================================
  // EXISTING TOOL REGISTRY COMPATIBILITY
  // ============================================
  
  /**
   * Get tool metadata for registry
   */
  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      category: this.category,
      languages: this.languages,
      frameworks: this.frameworks,
      purposes: this.purposes,
      capabilities: this.capabilities,
      intents: this.intents,
      keywords: this.keywords,
      bundleCompatible: this.bundleCompatible,
      dependencies: this.dependencies,
      performanceImpact: this.performanceImpact,
      tokenUsage: this.tokenUsage
    };
  }

  /**
   * Check if tool matches given intent
   */
  matchesIntent(intent: string): boolean {
    return this.intents.includes(intent) || 
           this.keywords.some(keyword => intent.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Check if tool is compatible with project
   */
  isCompatibleWith(projectLanguages: string[], projectFrameworks: string[]): boolean {
    const langMatch = this.languages.includes('any') || 
                     this.languages.some(lang => projectLanguages.includes(lang));
    
    const frameworkMatch = this.frameworks.includes('any') || 
                          this.frameworks.length === 0 ||
                          this.frameworks.some(fw => projectFrameworks.includes(fw));
    
    return langMatch && frameworkMatch;
  }
}

/**
 * Tool bundle interface - for grouping related tools
 */
export interface ToolBundle {
  id: string;
  name: string;
  description: string;
  tools: string[]; // Tool IDs
  workflow: {
    sequential?: string[];
    parallel?: string[];
    conditional?: Array<{
      condition: string;
      tools: string[];
    }>;
  };
  intents: string[];
  useCase: string;
}

/**
 * Enhanced tool result with database integration
 */
export interface ToolResult {
  toolId: string;
  toolName: string;
  source: 'cached' | 'live' | 'fallback';
  data: any;
  analysis: any;
  recommendations?: string[];
  error?: string;
  timestamp: Date;
  fromCache: boolean;
  cachedDataAvailable?: boolean;
  executionTime?: number;
  tokensUsed?: number;
}

// Additional interfaces needed for compatibility
export interface ToolMetadata {
  name: string;
  version: string;
  description: string;
  category: string;
  author?: string;
  dependencies?: string[];
  trustLevel?: number;
  capabilities?: Record<string, any>;
}

export interface AnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: Date;
  metadata: ToolMetadata;
  toolName?: string;
  projectId?: string;
  metrics?: any;
  recommendations?: string[];
}

export interface ToolInitResult {
  success: boolean;
  error?: string;
  metadata: ToolMetadata;
  tablesCreated?: number;
}

export interface ToolUpdateResult {
  success: boolean;
  updated: boolean | number;
  error?: string;
  changes?: string[];
  tablesUpdated?: number;
}

// Base class for internal tools (backwards compatibility)
export abstract class InternalTool {
  abstract getMetadata(): ToolMetadata;
  abstract analyze(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
  abstract initialize(projectId: string): Promise<ToolInitResult>;
  abstract update(projectId: string, data: any): Promise<void>;

  // Flexible initialization method that tools can override with more parameters
  initializeForProject?(projectPath: string, projectId: string): Promise<ToolInitResult> {
    return this.initialize(projectId);
  }

  // Additional methods that some tools expect
  analyzeProject?(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult> {
    return this.analyze(projectPath, projectId, parameters);
  }

  updateAfterCliRequest?(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<ToolUpdateResult> {
    // Default implementation - tools can override
    this.update(projectId, { command: cliCommand, result: cliResult });
    return Promise.resolve({ success: true, updated: 0 });
  }

  getStatus?(projectId?: string): any {
    return { status: 'active', name: this.getMetadata().name };
  }

  canAnalyzeProject?(projectPath: string): Promise<boolean> {
    return Promise.resolve(true); // Default: all tools can analyze
  }
}

// Tool registry for managing registered tools
export class ToolRegistry {
  private static tools: Map<string, InternalTool> = new Map();

  static registerTool(name: string, tool: InternalTool): void {
    this.tools.set(name, tool);
  }

  static getTool(name: string): InternalTool | undefined {
    return this.tools.get(name);
  }

  static getToolById(id: string): InternalTool | undefined {
    return this.tools.get(id);
  }

  static getAllTools(): InternalTool[] {
    return Array.from(this.tools.values());
  }

  static getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  static removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  static clear(): void {
    this.tools.clear();
  }
}