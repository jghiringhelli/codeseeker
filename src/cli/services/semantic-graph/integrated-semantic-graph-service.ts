/**
 * Integrated Semantic Graph Service - Facade + Strategy Pattern
 * Combines Tree-sitter (fast, accurate) with Claude Code CLI proxy (comprehensive, flexible)
 * Builds complete Neo4j knowledge graph from project files
 */

import { FileInfo } from '../file-scanner/file-scanner-interfaces';
import { TreeSitterSemanticBuilder, SemanticGraphData } from './tree-sitter-semantic-builder';
import { ClaudeCodeProxy } from './claude-code-proxy';

export interface GraphBuilderConfig {
  useTreeSitter: boolean;
  useClaudeProxy: boolean;
  preferTreeSitter: boolean;
  maxClaudeConcurrency: number;
  treeSitterLanguages: string[];
  claudeProxyCommand?: string;
  skipLargeFiles: boolean;
  maxFileSize: number;
}

export interface IntegratedSemanticResult extends SemanticGraphData {
  processingStrategy: {
    treeSitterFiles: number;
    claudeProxyFiles: number;
    fallbackFiles: number;
    totalProcessingTime: number;
  };
  qualityMetrics: {
    avgConfidence: number;
    highConfidenceEntities: number;
    crossFileRelationships: number;
    languageCoverage: Record<string, 'tree-sitter' | 'claude-proxy' | 'fallback'>;
  };
}

export class IntegratedSemanticGraphService {
  private treeSitterBuilder: TreeSitterSemanticBuilder;
  private claudeProxy: ClaudeCodeProxy;
  private config: GraphBuilderConfig;

  constructor(config?: Partial<GraphBuilderConfig>) {
    this.config = {
      useTreeSitter: true,
      useClaudeProxy: true,
      preferTreeSitter: true,
      maxClaudeConcurrency: 3,
      treeSitterLanguages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust'],
      skipLargeFiles: true,
      maxFileSize: 500000, // 500KB
      ...config
    };

    this.treeSitterBuilder = new TreeSitterSemanticBuilder();
    this.claudeProxy = new ClaudeCodeProxy(this.config.claudeProxyCommand);
  }

  /**
   * Build comprehensive semantic graph using optimal strategy for each file
   */
  async buildGraph(files: FileInfo[]): Promise<IntegratedSemanticResult> {
    console.log('🔄 Starting integrated semantic graph building...');
    const startTime = Date.now();

    // Filter and categorize files
    const processableFiles = this.filterFiles(files);
    const fileCategories = this.categorizeFiles(processableFiles);

    // Process files with optimal strategy
    const treeSitterResults = await this.processWithTreeSitter(fileCategories.treeSitter);
    const claudeProxyResults = await this.processWithClaudeProxy(fileCategories.claude);
    const fallbackResults = this.processFallback(fileCategories.fallback);

    // Merge results
    const integratedResult = await this.mergeResults(
      treeSitterResults,
      claudeProxyResults,
      fallbackResults,
      fileCategories
    );

    // Add processing metrics
    integratedResult.processingStrategy = {
      treeSitterFiles: fileCategories.treeSitter.length,
      claudeProxyFiles: fileCategories.claude.length,
      fallbackFiles: fileCategories.fallback.length,
      totalProcessingTime: Date.now() - startTime
    };

    // Calculate quality metrics
    integratedResult.qualityMetrics = this.calculateQualityMetrics(integratedResult, fileCategories);

    console.log(`✅ Integrated semantic graph complete: ${integratedResult.stats.totalEntities} entities, ${integratedResult.stats.totalRelationships} relationships`);
    console.log(`📊 Strategy: ${integratedResult.processingStrategy.treeSitterFiles} Tree-sitter, ${integratedResult.processingStrategy.claudeProxyFiles} Claude, ${integratedResult.processingStrategy.fallbackFiles} fallback`);

    return integratedResult;
  }

  private filterFiles(files: FileInfo[]): FileInfo[] {
    return files.filter(file => {
      // Skip non-source files
      if (file.type !== 'source') return false;

      // Skip empty files
      if (file.size === 0) return false;

      // Skip huge files if configured
      if (this.config.skipLargeFiles && file.size > this.config.maxFileSize) {
        console.log(`⚠ Skipping large file: ${file.relativePath} (${Math.round(file.size / 1024)}KB)`);
        return false;
      }

      return true;
    });
  }

  private categorizeFiles(files: FileInfo[]): {
    treeSitter: FileInfo[];
    claude: FileInfo[];
    fallback: FileInfo[];
  } {
    const treeSitter: FileInfo[] = [];
    const claude: FileInfo[] = [];
    const fallback: FileInfo[] = [];

    for (const file of files) {
      const language = file.language?.toLowerCase();

      if (this.config.useTreeSitter &&
          this.config.preferTreeSitter &&
          language &&
          this.config.treeSitterLanguages.includes(language)) {
        treeSitter.push(file);
      } else if (this.config.useClaudeProxy &&
                 this.shouldUseClaudeProxy(file)) {
        claude.push(file);
      } else {
        fallback.push(file);
      }
    }

    return { treeSitter, claude, fallback };
  }

  private shouldUseClaudeProxy(file: FileInfo): boolean {
    // Use Claude proxy for:
    // 1. Languages not supported by Tree-sitter
    // 2. Complex files that might benefit from LLM analysis
    // 3. Configuration files that need semantic understanding

    if (!file.language) return false;

    const language = file.language.toLowerCase();
    const complexLanguages = ['c++', 'c#', 'swift', 'kotlin', 'scala', 'haskell', 'ocaml'];

    return !this.config.treeSitterLanguages.includes(language) ||
           complexLanguages.includes(language) ||
           file.name.includes('config') ||
           file.extension === '.sql';
  }

  private async processWithTreeSitter(files: FileInfo[]): Promise<SemanticGraphData | null> {
    if (!this.config.useTreeSitter || files.length === 0) return null;

    console.log(`🌳 Processing ${files.length} files with Tree-sitter...`);

    try {
      return await this.treeSitterBuilder.buildSemanticGraph(files);
    } catch (error) {
      console.warn(`Tree-sitter processing failed: ${error.message}`);
      return null;
    }
  }

  private async processWithClaudeProxy(files: FileInfo[]): Promise<Map<string, any> | null> {
    if (!this.config.useClaudeProxy || files.length === 0) return null;

    console.log(`🤖 Processing ${files.length} files with Claude Code proxy...`);

    try {
      return await this.claudeProxy.analyzeFiles(files);
    } catch (error) {
      console.warn(`Claude proxy processing failed: ${error.message}`);
      return null;
    }
  }

  private processFallback(files: FileInfo[]): SemanticGraphData {
    if (files.length === 0) {
      return {
        entities: [],
        relationships: [],
        fileNodes: new Map(),
        stats: {
          totalFiles: 0,
          totalEntities: 0,
          totalRelationships: 0,
          byLanguage: {},
          processingTime: 0
        }
      };
    }

    console.log(`📄 Creating basic file entities for ${files.length} files...`);

    const entities = files.map((file, index) => ({
      id: `fallback_${index}`,
      name: file.name.replace(file.extension, ''),
      type: 'module' as const,
      filePath: file.path,
      startLine: 1,
      endLine: 1,
      modifiers: [],
      metadata: {
        processedBy: 'fallback',
        language: file.language,
        fileType: file.type
      }
    }));

    const fileNodes = new Map<string, string>();
    files.forEach((file, index) => {
      fileNodes.set(file.path, `fallback_${index}`);
    });

    const byLanguage: Record<string, number> = {};
    files.forEach(file => {
      if (file.language) {
        byLanguage[file.language] = (byLanguage[file.language] || 0) + 1;
      }
    });

    return {
      entities,
      relationships: [],
      fileNodes,
      stats: {
        totalFiles: files.length,
        totalEntities: entities.length,
        totalRelationships: 0,
        byLanguage,
        processingTime: 0
      }
    };
  }

  private async mergeResults(
    treeSitterResults: SemanticGraphData | null,
    claudeProxyResults: Map<string, any> | null,
    fallbackResults: SemanticGraphData,
    fileCategories: any
  ): Promise<IntegratedSemanticResult> {
    const mergedEntities = [...fallbackResults.entities];
    const mergedRelationships = [...fallbackResults.relationships];
    const mergedFileNodes = new Map(fallbackResults.fileNodes);
    const mergedStats = { ...fallbackResults.stats };

    // Merge Tree-sitter results
    if (treeSitterResults) {
      mergedEntities.push(...treeSitterResults.entities);
      mergedRelationships.push(...treeSitterResults.relationships);

      for (const [path, nodeId] of treeSitterResults.fileNodes) {
        mergedFileNodes.set(path, nodeId);
      }

      mergedStats.totalEntities += treeSitterResults.stats.totalEntities;
      mergedStats.totalRelationships += treeSitterResults.stats.totalRelationships;

      for (const [lang, count] of Object.entries(treeSitterResults.stats.byLanguage)) {
        mergedStats.byLanguage[lang] = (mergedStats.byLanguage[lang] || 0) + count;
      }
    }

    // Merge Claude proxy results
    if (claudeProxyResults) {
      for (const [filePath, analysis] of claudeProxyResults) {
        if (analysis.entities) {
          mergedEntities.push(...analysis.entities);
        }
        if (analysis.relationships) {
          mergedRelationships.push(...analysis.relationships);
        }
      }
    }

    // Update final stats
    mergedStats.totalFiles = fileCategories.treeSitter.length + fileCategories.claude.length + fileCategories.fallback.length;
    mergedStats.totalEntities = mergedEntities.length;
    mergedStats.totalRelationships = mergedRelationships.length;

    return {
      entities: mergedEntities,
      relationships: mergedRelationships,
      fileNodes: mergedFileNodes,
      stats: mergedStats,
      processingStrategy: {
        treeSitterFiles: 0,
        claudeProxyFiles: 0,
        fallbackFiles: 0,
        totalProcessingTime: 0
      },
      qualityMetrics: {
        avgConfidence: 0,
        highConfidenceEntities: 0,
        crossFileRelationships: 0,
        languageCoverage: {}
      }
    };
  }

  private calculateQualityMetrics(result: IntegratedSemanticResult, fileCategories: any): IntegratedSemanticResult['qualityMetrics'] {
    const confidences = result.entities
      .map(e => e.metadata?.confidence || 0.7)
      .filter(c => c > 0);

    const avgConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;

    const highConfidenceEntities = result.entities.filter(e =>
      (e.metadata?.confidence || 0.7) >= 0.8
    ).length;

    const crossFileRelationships = result.relationships.filter(r =>
      r.sourceFile !== r.targetFile
    ).length;

    const languageCoverage: Record<string, 'tree-sitter' | 'claude-proxy' | 'fallback'> = {};

    // Map language to processing strategy
    fileCategories.treeSitter.forEach((file: FileInfo) => {
      if (file.language) {
        languageCoverage[file.language] = 'tree-sitter';
      }
    });

    fileCategories.claude.forEach((file: FileInfo) => {
      if (file.language) {
        languageCoverage[file.language] = 'claude-proxy';
      }
    });

    fileCategories.fallback.forEach((file: FileInfo) => {
      if (file.language) {
        languageCoverage[file.language] = 'fallback';
      }
    });

    return {
      avgConfidence,
      highConfidenceEntities,
      crossFileRelationships,
      languageCoverage
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<GraphBuilderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): GraphBuilderConfig {
    return { ...this.config };
  }
}