/**
 * Tree-sitter Semantic Graph Builder - SOLID Principles
 * Uses Tree-sitter for CPU-optimized AST parsing and semantic relationship extraction
 * Builds Neo4j knowledge graph from discovered code files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';

// Tree-sitter interfaces (will be installed as dependency)
interface Parser {
  setLanguage(language: any): void;
  parse(input: string): Tree;
}

interface Tree {
  rootNode: Node;
}

interface Node {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: Node[];
  namedChildren: Node[];
  parent: Node | null;
  childForFieldName(fieldName: string): Node | null;
}

export interface SemanticRelationship {
  id: string;
  sourceFile: string;
  targetFile?: string;
  sourceEntity: string;
  targetEntity: string;
  relationshipType: 'IMPORTS' | 'EXTENDS' | 'IMPLEMENTS' | 'CALLS' | 'DEFINES' | 'USES' | 'CONTAINS';
  confidence: number;
  lineNumber: number;
  metadata: Record<string, any>;
}

export interface CodeEntity {
  id: string;
  name: string;
  type: 'module' | 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type';
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
  docstring?: string;
  modifiers: string[];
  metadata: Record<string, any>;
}

export interface SemanticGraphData {
  entities: CodeEntity[];
  relationships: SemanticRelationship[];
  fileNodes: Map<string, string>; // filePath -> nodeId
  stats: {
    totalFiles: number;
    totalEntities: number;
    totalRelationships: number;
    byLanguage: Record<string, number>;
    processingTime: number;
  };
}

export class TreeSitterSemanticBuilder {
  private parsers = new Map<string, any>();
  private entityIdCounter = 0;
  private relationshipIdCounter = 0;

  constructor() {
    this.initializeParsers();
  }

  /**
   * Initialize Tree-sitter parsers for supported languages
   */
  private async initializeParsers(): Promise<void> {
    try {
      // Dynamic imports to avoid build-time dependencies
      const Parser = require('tree-sitter');

      const languages = {
        typescript: 'tree-sitter-typescript',
        javascript: 'tree-sitter-javascript',
        python: 'tree-sitter-python',
        java: 'tree-sitter-java',
        go: 'tree-sitter-go',
        rust: 'tree-sitter-rust'
      };

      for (const [lang, packageName] of Object.entries(languages)) {
        try {
          const parser = new Parser();
          const Language = require(packageName);

          // Handle TypeScript which has multiple grammars
          if (lang === 'typescript') {
            parser.setLanguage(Language.typescript);
          } else {
            parser.setLanguage(Language);
          }

          this.parsers.set(lang, parser);
          // Parser loaded - reduced verbosity during init
        } catch (error) {
          console.warn(`⚠ Tree-sitter parser not available: ${lang} (${error.message})`);
          // Continue without this parser - we'll fall back gracefully
        }
      }
    } catch (error) {
      console.warn('⚠ Tree-sitter not available, falling back to regex parsing');
    }
  }

  /**
   * Build semantic graph from discovered files
   */
  async buildSemanticGraph(files: FileInfo[]): Promise<SemanticGraphData> {
    const startTime = Date.now();
    const entities: CodeEntity[] = [];
    const relationships: SemanticRelationship[] = [];
    const fileNodes = new Map<string, string>();
    const stats = {
      totalFiles: files.length,
      totalEntities: 0,
      totalRelationships: 0,
      byLanguage: {} as Record<string, number>,
      processingTime: 0
    };

    console.log('🌳 Building semantic graph with Tree-sitter...');

    // Process each file
    for (const file of files) {
      try {
        // Only process source files (skip configs, docs, etc.)
        if (!this.shouldProcessFile(file)) continue;

        const language = this.getTreeSitterLanguage(file.language);
        if (!language || !this.parsers.has(language)) {
          // Fall back to Claude Code CLI for unsupported languages
          await this.processWithClaudeProxy(file, entities, relationships);
          continue;
        }

        // Process with Tree-sitter
        await this.processWithTreeSitter(file, language, entities, relationships);

        // Track file node
        fileNodes.set(file.path, this.generateEntityId());

        // Update stats
        stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;

      } catch (error) {
        console.warn(`Failed to process ${file.path}: ${error.message}`);
      }
    }

    // Build cross-file relationships (imports, inheritance, etc.)
    await this.buildCrossFileRelationships(entities, relationships);

    stats.totalEntities = entities.length;
    stats.totalRelationships = relationships.length;
    stats.processingTime = Date.now() - startTime;

    console.log(`✓ Semantic graph built: ${stats.totalEntities} entities, ${stats.totalRelationships} relationships`);

    return {
      entities,
      relationships,
      fileNodes,
      stats
    };
  }

  private shouldProcessFile(file: FileInfo): boolean {
    return file.type === 'source' && file.size > 0 && file.size < 1000000; // Skip huge files
  }

  private getTreeSitterLanguage(language?: string): string | null {
    if (!language) return null;

    const mapping: Record<string, string> = {
      'TypeScript': 'typescript',
      'JavaScript': 'javascript',
      'Python': 'python',
      'Java': 'java',
      'Go': 'go',
      'Rust': 'rust'
    };

    return mapping[language] || null;
  }

  /**
   * Process file using Tree-sitter AST parsing
   */
  private async processWithTreeSitter(
    file: FileInfo,
    language: string,
    entities: CodeEntity[],
    relationships: SemanticRelationship[]
  ): Promise<void> {
    try {
      const content = await fs.readFile(file.path, 'utf8');
      const parser = this.parsers.get(language);
      const tree = parser.parse(content);

      // Extract entities and relationships from AST
      await this.extractFromAST(tree.rootNode, file, content, entities, relationships);

    } catch (error) {
      console.warn(`Tree-sitter parsing failed for ${file.path}, falling back to Claude proxy`);
      await this.processWithClaudeProxy(file, entities, relationships);
    }
  }

  /**
   * Extract semantic information from Tree-sitter AST
   */
  private async extractFromAST(
    node: Node,
    file: FileInfo,
    content: string,
    entities: CodeEntity[],
    relationships: SemanticRelationship[]
  ): Promise<void> {
    // Process different node types based on language
    switch (node.type) {
      case 'import_statement':
      case 'import_from_statement':
        this.extractImportRelationship(node, file, relationships);
        break;

      case 'class_declaration':
      case 'class_definition':
        this.extractClassEntity(node, file, content, entities, relationships);
        break;

      case 'function_declaration':
      case 'function_definition':
      case 'method_definition':
        this.extractFunctionEntity(node, file, content, entities, relationships);
        break;

      case 'call_expression':
        this.extractCallRelationship(node, file, relationships);
        break;
    }

    // Recursively process children
    for (const child of node.namedChildren) {
      await this.extractFromAST(child, file, content, entities, relationships);
    }
  }

  private extractImportRelationship(node: Node, file: FileInfo, relationships: SemanticRelationship[]): void {
    // Implementation specific to import patterns in Tree-sitter AST
    const importPath = this.findImportPath(node);
    if (importPath) {
      relationships.push({
        id: this.generateRelationshipId(),
        sourceFile: file.path,
        sourceEntity: path.basename(file.path, path.extname(file.path)),
        targetEntity: importPath,
        relationshipType: 'IMPORTS',
        confidence: 0.95,
        lineNumber: node.startPosition.row + 1,
        metadata: {
          importType: 'module',
          astNodeType: node.type
        }
      });
    }
  }

  private extractClassEntity(
    node: Node,
    file: FileInfo,
    content: string,
    entities: CodeEntity[],
    relationships: SemanticRelationship[]
  ): void {
    const className = this.getClassName(node);
    if (className) {
      entities.push({
        id: this.generateEntityId(),
        name: className,
        type: 'class',
        filePath: file.path,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        signature: node.text.split('\n')[0], // First line as signature
        modifiers: this.extractModifiers(node),
        metadata: {
          astNodeType: node.type,
          language: file.language
        }
      });

      // Create DEFINES relationship
      relationships.push({
        id: this.generateRelationshipId(),
        sourceFile: file.path,
        sourceEntity: path.basename(file.path, path.extname(file.path)),
        targetEntity: className,
        relationshipType: 'DEFINES',
        confidence: 0.95,
        lineNumber: node.startPosition.row + 1,
        metadata: { entityType: 'class' }
      });

      // Check for inheritance
      const superClass = this.getSuperClass(node);
      if (superClass) {
        relationships.push({
          id: this.generateRelationshipId(),
          sourceFile: file.path,
          sourceEntity: className,
          targetEntity: superClass,
          relationshipType: 'EXTENDS',
          confidence: 0.9,
          lineNumber: node.startPosition.row + 1,
          metadata: { inheritanceType: 'class' }
        });
      }
    }
  }

  private extractFunctionEntity(
    node: Node,
    file: FileInfo,
    content: string,
    entities: CodeEntity[],
    relationships: SemanticRelationship[]
  ): void {
    const functionName = this.getFunctionName(node);
    if (functionName) {
      entities.push({
        id: this.generateEntityId(),
        name: functionName,
        type: node.type.includes('method') ? 'method' : 'function',
        filePath: file.path,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        signature: this.extractFunctionSignature(node),
        modifiers: this.extractModifiers(node),
        metadata: {
          astNodeType: node.type,
          language: file.language
        }
      });

      // Create DEFINES relationship
      relationships.push({
        id: this.generateRelationshipId(),
        sourceFile: file.path,
        sourceEntity: path.basename(file.path, path.extname(file.path)),
        targetEntity: functionName,
        relationshipType: 'DEFINES',
        confidence: 0.9,
        lineNumber: node.startPosition.row + 1,
        metadata: { entityType: 'function' }
      });
    }
  }

  private extractCallRelationship(node: Node, file: FileInfo, relationships: SemanticRelationship[]): void {
    const functionName = this.getCallTarget(node);
    if (functionName && !this.isKeyword(functionName)) {
      relationships.push({
        id: this.generateRelationshipId(),
        sourceFile: file.path,
        sourceEntity: path.basename(file.path, path.extname(file.path)),
        targetEntity: functionName,
        relationshipType: 'CALLS',
        confidence: 0.7,
        lineNumber: node.startPosition.row + 1,
        metadata: { callType: 'function' }
      });
    }
  }

  /**
   * Fallback to Claude Code CLI for unsupported languages or failed parsing
   */
  private async processWithClaudeProxy(
    file: FileInfo,
    entities: CodeEntity[],
    relationships: SemanticRelationship[]
  ): Promise<void> {
    // TODO: Implement Claude Code CLI integration
    // This would make a request to Claude Code CLI to analyze the file
    console.log(`📎 Using Claude Code CLI proxy for: ${file.path}`);

    // For now, create basic file entity
    entities.push({
      id: this.generateEntityId(),
      name: path.basename(file.path, path.extname(file.path)),
      type: 'module',
      filePath: file.path,
      startLine: 1,
      endLine: 1,
      modifiers: [],
      metadata: {
        processedBy: 'claude-proxy',
        language: file.language,
        fileType: file.type
      }
    });
  }

  private async buildCrossFileRelationships(
    entities: CodeEntity[],
    relationships: SemanticRelationship[]
  ): Promise<void> {
    // Build relationships between entities across files
    // This would analyze imports, inheritance hierarchies, etc.
    console.log('🔗 Building cross-file relationships...');
  }

  // Helper methods for AST traversal
  private findImportPath(node: Node): string | null {
    // Implementation depends on language-specific AST structure
    return null;
  }

  private getClassName(node: Node): string | null {
    return node.childForFieldName('name')?.text || null;
  }

  private getFunctionName(node: Node): string | null {
    return node.childForFieldName('name')?.text || null;
  }

  private getSuperClass(node: Node): string | null {
    return node.childForFieldName('superclass')?.text || null;
  }

  private getCallTarget(node: Node): string | null {
    return node.childForFieldName('function')?.text || null;
  }

  private extractModifiers(node: Node): string[] {
    return []; // Extract public, private, static, etc.
  }

  private extractFunctionSignature(node: Node): string {
    return node.text.split('\n')[0].trim();
  }

  private isKeyword(word: string): boolean {
    const keywords = new Set([
      'if', 'else', 'for', 'while', 'return', 'class', 'function', 'const', 'let', 'var'
    ]);
    return keywords.has(word.toLowerCase());
  }

  private generateEntityId(): string {
    return `entity_${++this.entityIdCounter}`;
  }

  private generateRelationshipId(): string {
    return `rel_${++this.relationshipIdCounter}`;
  }
}