import * as ts from 'typescript';
import { parse as babelParse, ParserOptions } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger';

export interface ASTNode {
  type: string;
  name?: string;
  kind?: string;
  start?: number;
  end?: number;
  line?: number;
  column?: number;
  children?: ASTNode[];
  metadata?: Record<string, any>;
}

export interface ASTAnalysisResult {
  language: string;
  symbols: Symbol[];
  dependencies: Dependency[];
  complexity: ComplexityMetrics;
  patterns: Pattern[];
  errors: AnalysisError[];
}

export interface Symbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type' | 'enum' | 'method' | 'property';
  location: SourceLocation;
  signature?: string;
  visibility?: 'public' | 'private' | 'protected';
  isExported?: boolean;
  isAsync?: boolean;
  parameters?: Parameter[];
  returnType?: string;
}

export interface Dependency {
  type: 'import' | 'export' | 'call' | 'inheritance' | 'composition';
  source: string;
  target: string;
  line: number;
  isExternal?: boolean;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
  nestingDepth: number;
}

export interface Pattern {
  name: string;
  type: 'architectural' | 'design' | 'anti-pattern';
  confidence: number;
  description: string;
  locations: SourceLocation[];
}

export interface AnalysisError {
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface Parameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export class ASTAnalyzer {
  private logger = Logger?.getInstance();

  async analyzeFile(filePath: string): Promise<ASTAnalysisResult> {
    try {
      const content = await fs?.readFile(filePath, 'utf-8');
      const language = this?.detectLanguage(filePath);
      
      switch (language) {
        case 'typescript':
        case 'javascript':
          return this?.analyzeTypeScript(content, filePath, language);
        case 'python':
          return this?.analyzePython(content, filePath);
        default:
          throw new Error(`Unsupported language: ${language}`);
      }
    } catch (error) {
      this.logger.error(`Failed to analyze file ${filePath}`, error as Error);
      throw error as Error;
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path?.extname(filePath);
    const mapping: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python'
    };
    
    return mapping[ext] || 'unknown';
  }

  private async analyzeTypeScript(content: string, filePath: string, language: string): Promise<ASTAnalysisResult> {
    const result: ASTAnalysisResult = {
      language,
      symbols: [],
      dependencies: [],
      complexity: this?.initializeComplexityMetrics(),
      patterns: [],
      errors: []
    };

    try {
      // Use TypeScript compiler API for better analysis
      const sourceFile = ts?.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // Extract symbols
      result.symbols = this?.extractTypeScriptSymbols(sourceFile);
      
      // Extract dependencies
      result.dependencies = this?.extractTypeScriptDependencies(sourceFile);
      
      // Calculate complexity
      result.complexity = this?.calculateTypeScriptComplexity(sourceFile);
      
      // Detect patterns
      result.patterns = this?.detectTypeScriptPatterns(sourceFile, result.symbols);
      
    } catch (error) {
      // Fallback to Babel parser
      try {
        const ast = babelParse(content, {
          sourceType: 'module',
          allowImportExportEverywhere: true,
          allowAwaitOutsideFunction: true,
          allowReturnOutsideFunction: true,
          allowUndeclaredExports: true,
          plugins: [
            'typescript',
            'jsx',
            'decorators-legacy',
            'asyncGenerators',
            'bigInt',
            'classProperties',
            'dynamicImport',
            'exportDefaultFrom',
            'exportNamespaceFrom',
            'functionBind',
            'nullishCoalescingOperator',
            'objectRestSpread',
            'optionalCatchBinding',
            'optionalChaining'
          ]
        });

        result.symbols = this?.extractBabelSymbols(ast, filePath);
        result.dependencies = this?.extractBabelDependencies(ast, filePath);
        result.complexity = this?.calculateBabelComplexity(ast);
        
      } catch (babelError) {
        result.errors?.push({
          message: `Failed to parse with both TypeScript and Babel: ${error.message}`,
          severity: 'error'
        });
      }
    }

    return result;
  }

  private async analyzePython(content: string, filePath: string): Promise<ASTAnalysisResult> {
    // Python AST analysis would require additional libraries
    // For now, return a basic analysis
    return {
      language: 'python',
      symbols: [],
      dependencies: [],
      complexity: this?.initializeComplexityMetrics(),
      patterns: [],
      errors: [{
        message: 'Python AST analysis not fully implemented',
        severity: 'info'
      }]
    };
  }

  private extractTypeScriptSymbols(sourceFile: ts.SourceFile): Symbol[] {
    const symbols: Symbol[] = [];

    const visit = (node: ts.Node) => {
      // Function declarations
      if (ts?.isFunctionDeclaration(node) && node.name) {
        symbols?.push({
          name: node.name.text,
          type: 'function',
          location: this?.getSourceLocation(node, sourceFile.fileName),
          signature: this?.getFunctionSignature(node),
          isExported: this?.hasExportModifier(node),
          isAsync: this?.hasAsyncModifier(node),
          parameters: this?.getFunctionParameters(node)
        });
      }

      // Class declarations
      if (ts?.isClassDeclaration(node) && node.name) {
        symbols?.push({
          name: node.name.text,
          type: 'class',
          location: this?.getSourceLocation(node, sourceFile.fileName),
          isExported: this?.hasExportModifier(node)
        });

        // Class methods
        node.members?.forEach(member => {
          if (ts?.isMethodDeclaration(member) && member.name && ts?.isIdentifier(member.name)) {
            symbols?.push({
              name: `${node.name!.text}.${member.name.text}`,
              type: 'method',
              location: this?.getSourceLocation(member, sourceFile.fileName),
              visibility: this?.getVisibility(member),
              isAsync: this?.hasAsyncModifier(member)
            });
          }
        });
      }

      // Interface declarations
      if (ts?.isInterfaceDeclaration(node)) {
        symbols?.push({
          name: node.name.text,
          type: 'interface',
          location: this?.getSourceLocation(node, sourceFile.fileName),
          isExported: this?.hasExportModifier(node)
        });
      }

      // Type aliases
      if (ts?.isTypeAliasDeclaration(node)) {
        symbols?.push({
          name: node.name.text,
          type: 'type',
          location: this?.getSourceLocation(node, sourceFile.fileName),
          isExported: this?.hasExportModifier(node)
        });
      }

      // Variable declarations
      if (ts?.isVariableDeclaration(node) && node.name && ts?.isIdentifier(node.name)) {
        symbols?.push({
          name: node.name.text,
          type: 'variable',
          location: this?.getSourceLocation(node, sourceFile.fileName)
        });
      }

      ts?.forEachChild(node, visit);
    };

    visit(sourceFile);
    return symbols;
  }

  private extractBabelSymbols(ast: t.Node, filePath: string): Symbol[] {
    const symbols: Symbol[] = [];

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id) {
          symbols?.push({
            name: path.node.id.name,
            type: 'function',
            location: (this as any).getBabelLocation?.(path.node, filePath) || { filePath, line: 0, column: 0 },
            isAsync: path.node.async
          });
        }
      },

      ClassDeclaration(path) {
        if (path.node.id) {
          symbols?.push({
            name: path.node.id.name,
            type: 'class',
            location: (this as any).getBabelLocation?.(path.node, filePath) || { filePath, line: 0, column: 0 }
          });
        }
      },

      VariableDeclarator(path) {
        if (t?.isIdentifier(path.node.id)) {
          symbols?.push({
            name: path.node.id.name,
            type: 'variable',
            location: (this as any).getBabelLocation?.(path.node, filePath) || { filePath, line: 0, column: 0 }
          });
        }
      }
    });

    return symbols;
  }

  private extractTypeScriptDependencies(sourceFile: ts.SourceFile): Dependency[] {
    const dependencies: Dependency[] = [];

    const visit = (node: ts.Node) => {
      // Import declarations
      if (ts?.isImportDeclaration(node) && node.moduleSpecifier && ts?.isStringLiteral(node.moduleSpecifier)) {
        const location = sourceFile?.getLineAndCharacterOfPosition(node?.getStart());
        dependencies?.push({
          type: 'import',
          source: sourceFile.fileName,
          target: node.moduleSpecifier.text,
          line: location?.line + 1,
          isExternal: !node.moduleSpecifier.text?.startsWith('.')
        });
      }

      // Export declarations
      if (ts?.isExportDeclaration(node) && node.moduleSpecifier && ts?.isStringLiteral(node.moduleSpecifier)) {
        const location = sourceFile?.getLineAndCharacterOfPosition(node?.getStart());
        dependencies?.push({
          type: 'export',
          source: sourceFile.fileName,
          target: node.moduleSpecifier.text,
          line: location?.line + 1,
          isExternal: !node.moduleSpecifier.text?.startsWith('.')
        });
      }

      ts?.forEachChild(node, visit);
    };

    visit(sourceFile);
    return dependencies;
  }

  private extractBabelDependencies(ast: t.Node, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];

    traverse(ast, {
      ImportDeclaration(path) {
        dependencies?.push({
          type: 'import',
          source: filePath,
          target: path.node.source.value,
          line: path.node.loc?.start.line || 0,
          isExternal: !path.node.source.value?.startsWith('.')
        });
      },

      ExportNamedDeclaration(path) {
        if (path.node.source) {
          dependencies?.push({
            type: 'export',
            source: filePath,
            target: path.node.source.value,
            line: path.node.loc?.start.line || 0,
            isExternal: !path.node.source.value?.startsWith('.')
          });
        }
      }
    });

    return dependencies;
  }

  private calculateTypeScriptComplexity(sourceFile: ts.SourceFile): ComplexityMetrics {
    let cyclomaticComplexity = 1; // Base complexity
    let nestingDepth = 0;
    let maxNesting = 0;
    let linesOfCode = sourceFile?.getLineStarts().length;

    const visit = (node: ts.Node, depth: number = 0) => {
      maxNesting = Math.max(maxNesting, depth);

      // Increment complexity for branching statements
      if (ts?.isIfStatement(node) || 
          ts?.isWhileStatement(node) || 
          ts?.isForStatement(node) || 
          ts?.isDoStatement(node) || 
          ts?.isSwitchStatement(node) ||
          ts?.isConditionalExpression(node)) {
        cyclomaticComplexity++;
      }

      // Case labels add complexity
      if (ts?.isCaseClause(node)) {
        cyclomaticComplexity++;
      }

      ts?.forEachChild(node, child => visit(child, depth + 1));
    };

    visit(sourceFile);

    return {
      cyclomaticComplexity,
      cognitiveComplexity: cyclomaticComplexity * 1.2, // Simplified calculation
      linesOfCode,
      maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)),
      nestingDepth: maxNesting
    };
  }

  private calculateBabelComplexity(ast: t.Node): ComplexityMetrics {
    let cyclomaticComplexity = 1;
    let nestingDepth = 0;
    let linesOfCode = 100; // Estimate since we don't have direct access

    traverse(ast, {
      enter(path) {
        if (path?.isIfStatement() || 
            path?.isWhileStatement() || 
            path?.isForStatement() || 
            path?.isDoWhileStatement() || 
            path?.isSwitchStatement() ||
            path?.isConditionalExpression()) {
          cyclomaticComplexity++;
        }

        if (path?.isSwitchCase()) {
          cyclomaticComplexity++;
        }
      }
    });

    return {
      cyclomaticComplexity,
      cognitiveComplexity: cyclomaticComplexity * 1.2,
      linesOfCode,
      maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)),
      nestingDepth
    };
  }

  private detectTypeScriptPatterns(sourceFile: ts.SourceFile, symbols: Symbol[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Singleton pattern detection
    const classes = symbols?.filter(s => s?.type === 'class');
    const singletonPattern = this?.detectSingletonPattern(sourceFile, classes);
    if (singletonPattern) {
      patterns?.push(singletonPattern);
    }

    // Factory pattern detection
    const factoryPattern = this?.detectFactoryPattern(sourceFile, symbols);
    if (factoryPattern) {
      patterns?.push(factoryPattern);
    }

    return patterns;
  }

  private detectSingletonPattern(sourceFile: ts.SourceFile, classes: Symbol[]): Pattern | null {
    // Simple singleton detection - look for private constructor and getInstance method
    // This is a simplified implementation
    return null; // Placeholder
  }

  private detectFactoryPattern(sourceFile: ts.SourceFile, symbols: Symbol[]): Pattern | null {
    // Simple factory detection - look for create* methods
    // This is a simplified implementation
    return null; // Placeholder
  }

  private initializeComplexityMetrics(): ComplexityMetrics {
    return {
      cyclomaticComplexity: 1,
      cognitiveComplexity: 1,
      linesOfCode: 0,
      maintainabilityIndex: 100,
      nestingDepth: 0
    };
  }

  private getSourceLocation(node: ts.Node, fileName: string): SourceLocation {
    const sourceFile = node?.getSourceFile();
    const start = sourceFile?.getLineAndCharacterOfPosition(node?.getStart());
    const end = sourceFile?.getLineAndCharacterOfPosition(node?.getEnd());

    return {
      file: fileName,
      line: start?.line + 1,
      column: start?.character + 1,
      endLine: end?.line + 1,
      endColumn: end?.character + 1
    };
  }

  private getBabelLocation(node: t.Node, fileName: string): SourceLocation {
    return {
      file: fileName,
      line: node.loc?.start.line || 0,
      column: node.loc?.start.column || 0,
      endLine: node.loc?.end.line || 0,
      endColumn: node.loc?.end.column || 0
    };
  }

  private getFunctionSignature(node: ts.FunctionDeclaration): string {
    // Simplified signature extraction
    return node.name?.text || 'anonymous';
  }

  private hasExportModifier(node: ts.Node): boolean {
    return (node as any).modifiers?.some(mod => mod?.kind === ts.SyntaxKind.ExportKeyword) || false;
  }

  private hasAsyncModifier(node: ts.Node): boolean {
    return (node as any).modifiers?.some(mod => mod?.kind === ts.SyntaxKind.AsyncKeyword) || false;
  }

  private getFunctionParameters(node: ts.FunctionDeclaration): Parameter[] {
    return node.parameters?.map(param => ({
      name: param.name?.getText(),
      optional: !!param.questionToken,
      type: param.type?.getText()
    }));
  }

  private getVisibility(node: ts.ClassElement): 'public' | 'private' | 'protected' {
    if ((node as any).modifiers?.some(mod => mod?.kind === ts.SyntaxKind.PrivateKeyword)) {
      return 'private';
    }
    if ((node as any).modifiers?.some(mod => mod?.kind === ts.SyntaxKind.ProtectedKeyword)) {
      return 'protected';
    }
    return 'public';
  }
}

export default ASTAnalyzer;