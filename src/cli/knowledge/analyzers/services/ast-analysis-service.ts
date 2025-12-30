/**
 * AST Analysis Service
 * SOLID Principles: Single Responsibility - Handle AST parsing and analysis
 */

import { KnowledgeNode } from '../../graph/types';
import { ASTAnalyzer } from '../../../../shared/ast/analyzer';
import { Logger } from '../../../../utils/logger';
import { IASTAnalysisService, SemanticAnalysisConfig } from '../interfaces';

export class ASTAnalysisService implements IASTAnalysisService {
  private logger = Logger.getInstance();
  private astAnalyzer: ASTAnalyzer;

  constructor(private config: SemanticAnalysisConfig) {
    this.astAnalyzer = new ASTAnalyzer();
  }

  async analyzeFile(filePath: string, content: string): Promise<{ nodes: KnowledgeNode[]; metadata: any }> {
    try {
      const language = this.getLanguageFromPath(filePath);

      if (language === 'unknown') {
        this.logger.debug(`Skipping unknown file type: ${filePath}`);
        return { nodes: [], metadata: {} };
      }

      // Parse the AST based on language
      const ast = await this.parseAST(content, language);
      if (!ast) {
        return { nodes: [], metadata: {} };
      }

      // Extract entities from AST
      const entities = await this.extractEntities(ast, language);

      return {
        nodes: [], // Will be created by NodeCreationService
        metadata: {
          language,
          entities,
          filePath,
          linesOfCode: content.split('\n').length
        }
      };
    } catch (error) {
      this.logger.error(`Failed to analyze file ${filePath}:`, error as Error);
      return { nodes: [], metadata: {} };
    }
  }

  getLanguageFromPath(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop() || '';

    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'py': return 'python';
      case 'java': return 'java';
      case 'cpp': case 'cc': case 'cxx': return 'cpp';
      case 'c': return 'c';
      case 'cs': return 'csharp';
      case 'go': return 'go';
      case 'rs': return 'rust';
      case 'php': return 'php';
      case 'rb': return 'ruby';
      default: return 'unknown';
    }
  }

  private async parseAST(content: string, language: string): Promise<any> {
    try {
      // Simplified AST parsing - use basic analysis for now
      // TODO: Implement proper AST parsing when ASTAnalyzer methods are available
      return {
        classes: [],
        functions: [],
        imports: [],
        exports: [],
        variables: []
      };
    } catch (error) {
      this.logger.warn(`Failed to parse AST for ${language}:`, error);
      return null;
    }
  }

  private async extractEntities(ast: any, language: string): Promise<any> {
    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          return this.extractTypeScriptEntities(ast);
        case 'python':
          return this.extractPythonEntities(ast);
        case 'java':
          return this.extractJavaEntities(ast);
        default:
          return {};
      }
    } catch (error) {
      this.logger.warn(`Failed to extract entities for ${language}:`, error);
      return {};
    }
  }

  private extractTypeScriptEntities(ast: any): any {
    // Extract classes, functions, interfaces, etc. from TypeScript AST
    return {
      classes: ast.classes || [],
      functions: ast.functions || [],
      interfaces: ast.interfaces || [],
      imports: ast.imports || [],
      exports: ast.exports || [],
      variables: ast.variables || [],
      methods: ast.methods || []
    };
  }

  private extractPythonEntities(ast: any): any {
    // Extract Python-specific entities
    return {
      classes: ast.classes || [],
      functions: ast.functions || [],
      imports: ast.imports || [],
      variables: ast.variables || []
    };
  }

  private extractJavaEntities(ast: any): any {
    // Extract Java-specific entities
    return {
      classes: ast.classes || [],
      methods: ast.methods || [],
      interfaces: ast.interfaces || [],
      packages: ast.packages || [],
      imports: ast.imports || []
    };
  }
}