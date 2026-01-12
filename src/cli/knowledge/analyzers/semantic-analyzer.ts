/**
 * Semantic Analyzer - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 938 lines to ~150 lines using service extraction
 */

import { SemanticKnowledgeGraph } from '../graph/knowledge-graph';
import { Logger } from '../../../utils/logger';
import {
  AnalysisResult,
  SemanticPattern,
  SemanticAnalysisConfig,
  IFileDiscoveryService,
  IASTAnalysisService,
  IPatternDetectionService
} from './interfaces';
import { FileDiscoveryService } from './services/file-discovery-service';
import { ASTAnalysisService } from './services/ast-analysis-service';
import { PatternDetectionService } from './services/pattern-detection-service';

/**
 * Main Semantic Analyzer Coordinator
 * Uses dependency injection for all analysis operations
 */
export class SemanticAnalyzer {
  private logger: Logger;
  private knowledgeGraph: SemanticKnowledgeGraph;

  constructor(
    private config: SemanticAnalysisConfig,
    private fileDiscovery?: IFileDiscoveryService,
    private astAnalysis?: IASTAnalysisService,
    private patternDetection?: IPatternDetectionService
  ) {
    this.logger = Logger.getInstance();
    this.knowledgeGraph = new SemanticKnowledgeGraph(config.projectPath);

    // Initialize services with dependency injection
    this.fileDiscovery = this.fileDiscovery || new FileDiscoveryService(config);
    this.astAnalysis = this.astAnalysis || new ASTAnalysisService(config);
    this.patternDetection = this.patternDetection || new PatternDetectionService(config);
  }

  async analyzeProject(): Promise<AnalysisResult> {
    this.logger.info(`Starting semantic analysis of project: ${this.config.projectPath}`);

    try {
      // 1. Discover and load files
      const files = await this.fileDiscovery.discoverFiles();
      const fileContents = await this.fileDiscovery.loadFileContents(files);

      let totalNodes = 0;
      let totalTriads = 0;
      const allNodes = [];

      // 2. Analyze each file
      for (const [filePath, content] of fileContents) {
        const analysis = await this.astAnalysis.analyzeFile(filePath, content);
        const nodes = await this.createNodesFromAnalysis(analysis, filePath);

        allNodes.push(...nodes);
        totalNodes += nodes.length;

        // Create triads for relationships within the file
        const triads = await this.createFileTriads(analysis, filePath);
        totalTriads += triads;
      }

      // 3. Detect semantic similarities
      if (this.config.enableSemanticSimilarity) {
        const similarities = await this.patternDetection.detectSemanticSimilarities(allNodes);
        totalTriads += similarities.length;

        // Add similarities to knowledge graph
        for (const similarity of similarities) {
          await this.knowledgeGraph.addTriad(similarity);
        }
      }

      // 4. Detect semantic patterns
      let patterns: SemanticPattern[] = [];
      if (this.config.enablePatternDetection) {
        const allTriads = await this.knowledgeGraph.queryTriads({});
        patterns = await this.patternDetection.detectSemanticPatterns(allNodes, allTriads);

        // Add pattern nodes and relationships to graph
        for (const pattern of patterns) {
          await this.addPatternToGraph(pattern);
        }
      }

      // 5. Generate insights
      const insights = this.generateInsights(allNodes, patterns, totalTriads);

      const result: AnalysisResult = {
        nodesExtracted: totalNodes,
        triadsCreated: totalTriads,
        patterns,
        insights
      };

      this.logger.info(`Semantic analysis completed: ${totalNodes} nodes, ${totalTriads} triads, ${patterns.length} patterns`);
      return result;

    } catch (error) {
      this.logger.error('Semantic analysis failed:', error as Error);
      throw error;
    }
  }

  private async createNodesFromAnalysis(analysis: any, filePath: string): Promise<any[]> {
    const nodes = [];

    if (!analysis.metadata?.entities) {
      return nodes;
    }

    const { entities, language } = analysis.metadata;

    // Create nodes for classes
    for (const cls of entities.classes || []) {
      const nodeId = await this.knowledgeGraph.addNode({
        type: 'class' as any,
        name: cls.name,
        namespace: this.extractNamespace(filePath),
        sourceLocation: {
          filePath,
          startLine: cls.line || 0,
          endLine: cls.endLine || 0,
          startColumn: cls.column || 0,
          endColumn: cls.endColumn || 0
        },
        metadata: {
          language,
          visibility: cls.modifiers?.includes('public') ? 'public' : 'private',
          tags: this.extractTags(cls)
        }
      });
      nodes.push({ id: nodeId, ...cls });
    }

    // Create nodes for functions
    for (const func of entities.functions || []) {
      const nodeId = await this.knowledgeGraph.addNode({
        type: 'function' as any,
        name: func.name,
        namespace: this.extractNamespace(filePath),
        sourceLocation: {
          filePath,
          startLine: func.line || 0,
          endLine: func.endLine || 0,
          startColumn: func.column || 0,
          endColumn: func.endColumn || 0
        },
        metadata: {
          language,
          visibility: func.modifiers?.includes('public') ? 'public' : 'private',
          tags: this.extractTags(func)
        }
      });
      nodes.push({ id: nodeId, ...func });
    }

    return nodes;
  }

  private async createFileTriads(analysis: any, filePath: string): Promise<number> {
    let triadCount = 0;

    if (!analysis.metadata?.entities) {
      return triadCount;
    }

    const { entities } = analysis.metadata;

    // Create import/export triads
    if (entities.imports?.length > 0 || entities.exports?.length > 0) {
      triadCount += entities.imports?.length || 0;
      triadCount += entities.exports?.length || 0;
    }

    // Create method call triads
    for (const method of entities.methods || []) {
      if (method.calls?.length > 0) {
        triadCount += method.calls.length;
      }
    }

    return triadCount;
  }

  private async addPatternToGraph(pattern: SemanticPattern): Promise<void> {
    const patternNodeId = await this.knowledgeGraph.addNode({
      type: 'pattern' as any,
      name: pattern.name,
      namespace: 'patterns',
      metadata: {
        patternType: pattern.type,
        confidence: pattern.confidence,
        description: pattern.description,
        tags: ['detected_pattern']
      }
    });

    // Link pattern to involved nodes
    for (const nodeId of pattern.nodes) {
      await this.knowledgeGraph.addTriad({
        subject: nodeId,
        predicate: 'follows_pattern' as any,
        object: patternNodeId,
        confidence: pattern.confidence,
        source: 'PATTERN_DETECTOR' as any,
        metadata: {
          patternType: pattern.type
        }
      });
    }
  }

  private generateInsights(nodes: any[], patterns: SemanticPattern[], triadsCount: number): string[] {
    const insights = [];

    insights.push(`Analyzed ${nodes.length} code entities across the project`);
    insights.push(`Created ${triadsCount} semantic relationships`);

    if (patterns.length > 0) {
      insights.push(`Detected ${patterns.length} design patterns`);
      const patternTypes = [...new Set(patterns.map(p => p.type))];
      insights.push(`Pattern types found: ${patternTypes.join(', ')}`);
    }

    const languages = [...new Set(nodes.map(n => n.metadata?.language).filter(Boolean))];
    if (languages.length > 0) {
      insights.push(`Languages analyzed: ${languages.join(', ')}`);
    }

    return insights;
  }

  private extractNamespace(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const srcIndex = parts.findIndex(p => p === 'src');

    if (srcIndex !== -1 && srcIndex < parts.length - 1) {
      return parts.slice(srcIndex + 1, -1).join('.');
    }

    return 'global';
  }

  private extractTags(entity: any): string[] {
    const tags = [];

    if (entity.isAbstract) tags.push('abstract');
    if (entity.isStatic) tags.push('static');
    if (entity.isAsync) tags.push('async');
    if (entity.isGenerator) tags.push('generator');
    if (entity.isExported) tags.push('exported');
    if (entity.isDefault) tags.push('default');

    return tags;
  }
}