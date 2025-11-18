/**
 * Minimal AST Analyzer - MVP Implementation
 * Provides basic AST analysis functionality for features that depend on it
 */

export interface Symbol {
  name: string;
  type: string;
  location: {
    file: string;
    line: number;
    endLine: number;
    column: number;
    endColumn: number;
  };
}

export interface Dependency {
  from: string;
  to: string;
  target?: string;
  type: 'import' | 'call' | 'extends' | 'implements';
  location?: {
    line: number;
    column: number;
  };
}

export interface ASTAnalysisResult {
  symbols: Symbol[];
  dependencies: Dependency[];
  exports: Symbol[];
  imports: Symbol[];
  complexity: number;
}

export class ASTAnalyzer {
  /**
   * Basic file analysis using regex patterns instead of full AST parsing
   */
  async analyzeFile(filePath: string): Promise<ASTAnalysisResult> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        symbols: this.extractSymbols(content, filePath),
        dependencies: this.extractDependencies(content, filePath),
        exports: this.extractExports(content, filePath),
        imports: this.extractImports(content, filePath),
        complexity: this.calculateComplexity(content)
      };
    } catch (error) {
      return {
        symbols: [],
        dependencies: [],
        exports: [],
        imports: [],
        complexity: 0
      };
    }
  }

  /**
   * Extract symbols (functions, classes, variables) using regex
   */
  private extractSymbols(content: string, filePath: string): Symbol[] {
    const symbols: Symbol[] = [];
    const lines = content.split('\n');

    // Extract classes
    lines.forEach((line, index) => {
      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          location: { file: filePath, line: index + 1, endLine: index + 1, column: classMatch.index || 0, endColumn: (classMatch.index || 0) + classMatch[0].length }
        });
      }

      // Extract functions
      const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (functionMatch) {
        symbols.push({
          name: functionMatch[1],
          type: 'function',
          location: { file: filePath, line: index + 1, endLine: index + 1, column: functionMatch.index || 0, endColumn: (functionMatch.index || 0) + functionMatch[0].length }
        });
      }

      // Extract arrow functions
      const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
      if (arrowMatch) {
        symbols.push({
          name: arrowMatch[1],
          type: 'function',
          location: { file: filePath, line: index + 1, endLine: index + 1, column: arrowMatch.index || 0, endColumn: (arrowMatch.index || 0) + arrowMatch[0].length }
        });
      }
    });

    return symbols;
  }

  /**
   * Extract dependencies using regex
   */
  private extractDependencies(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Import dependencies
      const importMatch = line.match(/import.*?from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        dependencies.push({
          from: filePath,
          to: importMatch[1],
          target: importMatch[1],
          type: 'import',
          location: { line: index + 1, column: importMatch.index || 0 }
        });
      }

      // Require dependencies
      const requireMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
      if (requireMatch) {
        dependencies.push({
          from: filePath,
          to: requireMatch[1],
          target: requireMatch[1],
          type: 'import',
          location: { line: index + 1, column: requireMatch.index || 0 }
        });
      }
    });

    return dependencies;
  }

  /**
   * Extract exports using regex
   */
  private extractExports(content: string, filePath: string): Symbol[] {
    const exports: Symbol[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Named exports
      const exportMatch = line.match(/export\s+(?:class|function|const|let|var)\s+(\w+)/);
      if (exportMatch) {
        exports.push({
          name: exportMatch[1],
          type: 'export',
          location: { file: filePath, line: index + 1, endLine: index + 1, column: exportMatch.index || 0, endColumn: (exportMatch.index || 0) + exportMatch[0].length }
        });
      }
    });

    return exports;
  }

  /**
   * Extract imports using regex
   */
  private extractImports(content: string, filePath: string): Symbol[] {
    const imports: Symbol[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const importMatch = line.match(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from/);
      if (importMatch) {
        if (importMatch[1]) {
          // Named imports
          const namedImports = importMatch[1].split(',').map(imp => imp.trim());
          namedImports.forEach(imp => {
            imports.push({
              name: imp,
              type: 'import',
              location: { file: filePath, line: index + 1, endLine: index + 1, column: importMatch.index || 0, endColumn: (importMatch.index || 0) + importMatch[0].length }
            });
          });
        } else if (importMatch[2] || importMatch[3]) {
          // Default or namespace import
          imports.push({
            name: importMatch[2] || importMatch[3],
            type: 'import',
            location: { file: filePath, line: index + 1, endLine: index + 1, column: importMatch.index || 0, endColumn: (importMatch.index || 0) + importMatch[0].length }
          });
        }
      }
    });

    return imports;
  }

  /**
   * Calculate basic complexity based on control flow keywords
   */
  private calculateComplexity(content: string): number {
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try'];
    let complexity = 1; // Base complexity

    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      complexity += matches ? matches.length : 0;
    });

    return complexity;
  }
}