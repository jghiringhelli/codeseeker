/**
 * File Processing Service
 * SOLID Principles: Single Responsibility - Handle file processing coordination only
 */

import { Logger } from '../../../../../utils/logger';
import { FileInfo } from '../../../monitoring/file-scanning/file-scanner-interfaces';
import {
  IFileProcessingService,
  IGraphProcessor,
  IQualityAnalyzer,
  SemanticGraphData,
  IntegratedSemanticResult,
  GraphBuilderConfig
} from '../interfaces/index';
import { TreeSitterProcessor, ClaudeProxyProcessor, FallbackProcessor } from '../processors/index';

export class FileProcessingService implements IFileProcessingService {
  private logger = Logger.getInstance();

  constructor(
    private config: GraphBuilderConfig,
    private treeSitterProcessor?: TreeSitterProcessor,
    private claudeProxyProcessor?: ClaudeProxyProcessor,
    private fallbackProcessor?: FallbackProcessor,
    private qualityAnalyzer?: IQualityAnalyzer
  ) {
    // Initialize processors with dependency injection
    this.treeSitterProcessor = this.treeSitterProcessor || new TreeSitterProcessor();
    this.claudeProxyProcessor = this.claudeProxyProcessor || new ClaudeProxyProcessor();
    this.fallbackProcessor = this.fallbackProcessor || new FallbackProcessor();
  }

  async buildGraphFromFiles(files: FileInfo[]): Promise<IntegratedSemanticResult> {
    this.logger.info('🔄 Starting integrated semantic graph building');
    const startTime = Date.now();

    // Filter and categorize files
    const processableFiles = this.filterFiles(files);
    const fileCategories = this.categorizeFiles(processableFiles);

    // Process files with optimal strategy
    const treeSitterResults = await this.treeSitterProcessor?.processFiles(fileCategories.treeSitter) || null;
    const claudeProxyResults = await this.claudeProxyProcessor?.processFiles(fileCategories.claude) || null;
    const fallbackResults = await this.fallbackProcessor?.processFiles(fileCategories.fallback) || this.createEmptyResult();

    // Merge results
    const integratedResult = await this.mergeProcessingResults(
      treeSitterResults, claudeProxyResults, fallbackResults, fileCategories
    );

    // Add processing metrics
    integratedResult.processingStrategy = {
      treeSitterFiles: fileCategories.treeSitter.length,
      claudeProxyFiles: fileCategories.claude.length,
      fallbackFiles: fileCategories.fallback.length,
      totalProcessingTime: Date.now() - startTime
    };

    // Calculate quality metrics
    integratedResult.qualityMetrics = this.qualityAnalyzer
      ? this.qualityAnalyzer.calculateQualityMetrics(integratedResult, fileCategories)
      : this.calculateDefaultQualityMetrics(integratedResult, fileCategories);

    this.logger.info(`✅ Integrated semantic graph complete: ${integratedResult.stats.totalEntities} entities, ${integratedResult.stats.totalRelationships} relationships`);
    this.logger.info(`📊 Strategy: ${integratedResult.processingStrategy.treeSitterFiles} Tree-sitter, ${integratedResult.processingStrategy.claudeProxyFiles} Claude, ${integratedResult.processingStrategy.fallbackFiles} fallback`);

    return integratedResult;
  }

  filterFiles(files: FileInfo[]): FileInfo[] {
    return files.filter(file => {
      if (file.type !== 'source') return false;
      if (file.size === 0) return false;
      if (this.config.skipLargeFiles && file.size > this.config.maxFileSize) {
        this.logger.debug(`⚠ Skipping large file: ${file.relativePath} (${Math.round(file.size / 1024)}KB)`);
        return false;
      }
      return true;
    });
  }

  categorizeFiles(files: FileInfo[]): {
    treeSitter: FileInfo[];
    claude: FileInfo[];
    fallback: FileInfo[];
  } {
    const treeSitter: FileInfo[] = [];
    const claude: FileInfo[] = [];
    const fallback: FileInfo[] = [];

    for (const file of files) {
      const language = file.language?.toLowerCase();
      if (this.config.useTreeSitter && this.config.preferTreeSitter && language && this.config.treeSitterLanguages.includes(language)) {
        treeSitter.push(file);
      } else if (this.config.useClaudeProxy && this.shouldUseClaudeProxy(file)) {
        claude.push(file);
      } else {
        fallback.push(file);
      }
    }
    return { treeSitter, claude, fallback };
  }

  private shouldUseClaudeProxy(file: FileInfo): boolean {
    if (!file.language) return false;
    const language = file.language.toLowerCase();
    const complexLanguages = ['c++', 'c#', 'swift', 'kotlin', 'scala', 'haskell', 'ocaml'];
    return !this.config.treeSitterLanguages.includes(language) || complexLanguages.includes(language) ||
           file.name.includes('config') || file.extension === '.sql';
  }

  private async mergeProcessingResults(
    treeSitterResults: SemanticGraphData | null,
    claudeProxyResults: SemanticGraphData | null,
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
      this.mergeStats(mergedStats, treeSitterResults.stats);
    }

    // Merge Claude proxy results
    if (claudeProxyResults) {
      mergedEntities.push(...claudeProxyResults.entities);
      mergedRelationships.push(...claudeProxyResults.relationships);
      for (const [path, nodeId] of claudeProxyResults.fileNodes) {
        mergedFileNodes.set(path, nodeId);
      }
      this.mergeStats(mergedStats, claudeProxyResults.stats);
    }

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
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        coverage: 0
      }
    };
  }

  private mergeStats(target: any, source: any): void {
    target.totalFiles += source.totalFiles;
    target.totalEntities += source.totalEntities;
    target.totalRelationships += source.totalRelationships;

    // Merge by language counts
    for (const [language, count] of Object.entries(source.byLanguage)) {
      target.byLanguage[language] = (target.byLanguage[language] || 0) + (count as number);
    }
  }

  private calculateDefaultQualityMetrics(result: IntegratedSemanticResult, fileCategories: any): {
    completeness: number;
    accuracy: number;
    consistency: number;
    coverage: number;
  } {
    const totalFiles = fileCategories.treeSitter.length + fileCategories.claude.length + fileCategories.fallback.length;
    const processedFiles = result.stats.totalFiles;

    // Simple quality metrics calculation
    const coverage = totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;
    const completeness = result.stats.totalEntities > 0 ? Math.min(100, result.stats.totalEntities / totalFiles * 2) : 0;
    const accuracy = result.processingStrategy.treeSitterFiles / Math.max(1, processedFiles) * 100;
    const consistency = result.stats.totalRelationships > 0 ? Math.min(100, result.stats.totalRelationships / result.stats.totalEntities * 50) : 0;

    return {
      completeness: Math.round(completeness),
      accuracy: Math.round(accuracy),
      consistency: Math.round(consistency),
      coverage: Math.round(coverage)
    };
  }

  private createEmptyResult(): SemanticGraphData {
    return {
      entities: [],
      relationships: [],
      fileNodes: new Map(),
      stats: {
        totalFiles: 0,
        totalEntities: 0,
        totalRelationships: 0,
        byLanguage: {}
      }
    };
  }
}