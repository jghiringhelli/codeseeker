/**
 * Graph Processors
 * SOLID Principles: Strategy Pattern - Different processing strategies
 */

import { Logger } from '../../../../../utils/logger';
import { FileInfo } from '../../../monitoring/file-scanning/file-scanner-interfaces';
import { IGraphProcessor, SemanticGraphData } from '../interfaces/index';

// Import existing processors
import { TreeSitterSemanticBuilder } from '../tree-sitter-semantic-builder';
import { ClaudeCodeProxy } from '../claude-code-proxy';

export class TreeSitterProcessor implements IGraphProcessor {
  private treeSitterBuilder: TreeSitterSemanticBuilder;
  private logger = Logger.getInstance();

  constructor() {
    this.treeSitterBuilder = new TreeSitterSemanticBuilder();
  }

  async processFiles(files: FileInfo[]): Promise<SemanticGraphData | null> {
    if (files.length === 0) return null;
    this.logger.info(`🌳 Processing ${files.length} files with Tree-sitter`);
    try {
      const result = await this.treeSitterBuilder.buildSemanticGraph(files);
      // Convert CodeEntity[] to GraphNode[]
      if (result) {
        return {
          ...result,
          entities: result.entities.map(entity => ({
            id: entity.id,
            type: entity.type as any, // Convert to NodeType
            properties: {
              ...entity.metadata,
              signature: entity.signature,
              docstring: entity.docstring,
              modifiers: entity.modifiers
            },
            name: entity.name,
            filePath: entity.filePath,
            startLine: entity.startLine,
            endLine: entity.endLine
          })),
          relationships: result.relationships.map(rel => ({
            fromId: rel.sourceEntity,
            toId: rel.targetEntity,
            type: rel.relationshipType as any,
            properties: {
              confidence: rel.confidence,
              sourceFile: rel.sourceFile,
              targetFile: rel.targetFile
            }
          }))
        };
      }
      return null;
    } catch (error: any) {
      this.logger.warn(`Tree-sitter processing failed: ${error.message}`);
      return null;
    }
  }
}

export class ClaudeProxyProcessor implements IGraphProcessor {
  private claudeProxy: ClaudeCodeProxy;
  private logger = Logger.getInstance();

  constructor(claudeProxyCommand?: string) {
    this.claudeProxy = new ClaudeCodeProxy(claudeProxyCommand);
  }

  async processFiles(files: FileInfo[]): Promise<SemanticGraphData | null> {
    if (files.length === 0) return null;
    this.logger.info(`🤖 Processing ${files.length} files with Claude Code proxy`);
    try {
      const results = await this.claudeProxy.analyzeFiles(files);
      return this.convertClaudeResults(results);
    } catch (error: any) {
      this.logger.warn(`Claude proxy processing failed: ${error.message}`);
      return null;
    }
  }

  private convertClaudeResults(results: Map<string, any> | null): SemanticGraphData | null {
    if (!results) return null;

    const entities: any[] = [];
    const relationships: any[] = [];
    const fileNodes = new Map<string, string>();
    const byLanguage: Record<string, number> = {};

    for (const [filePath, analysis] of results) {
      if (analysis.entities) entities.push(...analysis.entities);
      if (analysis.relationships) relationships.push(...analysis.relationships);
    }

    return {
      entities,
      relationships,
      fileNodes,
      stats: {
        totalFiles: results.size,
        totalEntities: entities.length,
        totalRelationships: relationships.length,
        byLanguage
      }
    };
  }
}

export class FallbackProcessor implements IGraphProcessor {
  private logger = Logger.getInstance();

  async processFiles(files: FileInfo[]): Promise<SemanticGraphData> {
    this.logger.info(`📄 Processing ${files.length} files with fallback processor`);

    const entities: any[] = [];
    const relationships: any[] = [];
    const fileNodes = new Map<string, string>();
    const byLanguage: Record<string, number> = {};

    // Simple file-based processing
    for (const file of files) {
      const entity = {
        id: `file_${file.relativePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        type: 'Code',
        properties: {
          name: file.name,
          path: file.relativePath,
          language: file.language,
          size: file.size,
          extension: file.extension
        },
        name: file.name,
        filePath: file.relativePath
      };

      entities.push(entity);
      fileNodes.set(file.relativePath, entity.id);

      // Count by language
      if (file.language) {
        byLanguage[file.language] = (byLanguage[file.language] || 0) + 1;
      }
    }

    return {
      entities,
      relationships,
      fileNodes,
      stats: {
        totalFiles: files.length,
        totalEntities: entities.length,
        totalRelationships: relationships.length,
        byLanguage
      }
    };
  }
}