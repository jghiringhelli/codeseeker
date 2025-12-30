/**
 * Content Chunker Service - Single Responsibility
 * Handles breaking down files into searchable semantic chunks
 */

import * as crypto from 'crypto';
import { IContentChunker, SemanticChunk } from '../../../core/interfaces/search-interfaces';

export class ContentChunker implements IContentChunker {
  private readonly chunkSize = 1000; // characters
  private readonly chunkOverlap = 200; // characters

  async createSemanticChunks(filePath: string, content: string, fileHash: string): Promise<SemanticChunk[]> {
    const lines = content.split('\n');
    const chunks: SemanticChunk[] = [];

    // For small files, create single chunk
    if (content.length <= this.chunkSize) {
      chunks.push(this.createSingleChunk(filePath, content, fileHash, lines, 0, lines.length - 1, 0, true));
      return chunks;
    }

    // Create overlapping chunks for larger files
    let chunkIndex = 0;
    let startChar = 0;

    while (startChar < content.length) {
      const endChar = Math.min(startChar + this.chunkSize, content.length);
      const chunkContent = content.substring(startChar, endChar);

      const startLine = this.getLineNumber(content, startChar);
      const endLine = this.getLineNumber(content, endChar);

      const chunk = this.createSingleChunk(
        filePath,
        chunkContent,
        fileHash,
        lines.slice(startLine, endLine + 1),
        startLine,
        endLine,
        chunkIndex,
        false
      );

      chunks.push(chunk);
      chunkIndex++;

      // Move start position with overlap
      startChar = endChar - this.chunkOverlap;
      if (startChar >= content.length - this.chunkOverlap) break;
    }

    return chunks;
  }

  async createStructuralChunks(filePath: string, content: string, fileHash: string, lines: string[]): Promise<SemanticChunk[]> {
    const chunks: SemanticChunk[] = [];
    const language = this.detectLanguage(filePath);

    // Extract structural elements based on language
    const functions = this.extractFunctions(content, language);
    const classes = this.extractClasses(content, language);

    // Create chunks for each function
    functions.forEach((func, index) => {
      const chunk = this.createStructuralChunk(
        filePath,
        func.content,
        fileHash,
        func.startLine,
        func.endLine,
        `func_${index}`,
        {
          language,
          size: func.content.length,
          functions: [func.name],
          classes: [],
          imports: [],
          exports: [],
          significance: this.calculateSignificance(func.content)
        }
      );
      chunks.push(chunk);
    });

    // Create chunks for each class
    classes.forEach((cls, index) => {
      const chunk = this.createStructuralChunk(
        filePath,
        cls.content,
        fileHash,
        cls.startLine,
        cls.endLine,
        `class_${index}`,
        {
          language,
          size: cls.content.length,
          functions: [],
          classes: [cls.name],
          imports: [],
          exports: [],
          significance: this.calculateSignificance(cls.content)
        }
      );
      chunks.push(chunk);
    });

    return chunks;
  }

  private createSingleChunk(
    filePath: string,
    content: string,
    fileHash: string,
    lines: string[],
    startLine: number,
    endLine: number,
    chunkIndex: number,
    isFullFile: boolean
  ): SemanticChunk {
    const language = this.detectLanguage(filePath);

    return {
      id: crypto.createHash('sha256').update(`${filePath}_${chunkIndex}_${fileHash}`).digest('hex'),
      filePath,
      content,
      startLine,
      endLine,
      chunkIndex,
      isFullFile,
      hash: crypto.createHash('sha256').update(content).digest('hex'),
      metadata: {
        language,
        size: content.length,
        functions: this.extractFunctionNames(content, language),
        classes: this.extractClassNames(content, language),
        imports: this.extractImports(content, language),
        exports: this.extractExports(content, language),
        significance: this.calculateSignificance(content)
      }
    };
  }

  private createStructuralChunk(
    filePath: string,
    content: string,
    fileHash: string,
    startLine: number,
    endLine: number,
    structureId: string,
    metadata: SemanticChunk['metadata']
  ): SemanticChunk {
    return {
      id: crypto.createHash('sha256').update(`${filePath}_${structureId}_${fileHash}`).digest('hex'),
      filePath,
      content,
      startLine,
      endLine,
      chunkIndex: 0,
      isFullFile: false,
      hash: crypto.createHash('sha256').update(content).digest('hex'),
      metadata
    };
  }

  private getLineNumber(content: string, charPosition: number): number {
    return content.substring(0, charPosition).split('\n').length - 1;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'rs': 'rust',
      'go': 'go',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp'
    };
    return languageMap[ext || ''] || 'text';
  }

  private extractFunctions(content: string, language: string): Array<{name: string, content: string, startLine: number, endLine: number}> {
    // Simplified function extraction - would use proper AST parsing in production
    const functions: Array<{name: string, content: string, startLine: number, endLine: number}> = [];
    const lines = content.split('\n');

    const functionPatterns: Record<string, RegExp> = {
      typescript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      javascript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      python: /def\s+(\w+)/,
      java: /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/
    };

    const pattern = functionPatterns[language];
    if (!pattern) return functions;

    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        functions.push({
          name: match[1],
          content: line,
          startLine: index,
          endLine: index
        });
      }
    });

    return functions;
  }

  private extractClasses(content: string, language: string): Array<{name: string, content: string, startLine: number, endLine: number}> {
    const classes: Array<{name: string, content: string, startLine: number, endLine: number}> = [];
    const lines = content.split('\n');

    const classPatterns: Record<string, RegExp> = {
      typescript: /(?:export\s+)?class\s+(\w+)/,
      javascript: /class\s+(\w+)/,
      python: /class\s+(\w+)/,
      java: /(?:public\s+)?class\s+(\w+)/
    };

    const pattern = classPatterns[language];
    if (!pattern) return classes;

    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        classes.push({
          name: match[1],
          content: line,
          startLine: index,
          endLine: index
        });
      }
    });

    return classes;
  }

  private extractFunctionNames(content: string, language: string): string[] {
    return this.extractFunctions(content, language).map(f => f.name);
  }

  private extractClassNames(content: string, language: string): string[] {
    return this.extractClasses(content, language).map(c => c.name);
  }

  private extractImports(content: string, language: string): string[] {
    const lines = content.split('\n');
    const imports: string[] = [];

    const importPatterns: Record<string, RegExp> = {
      typescript: /import.*from\s+['"]([^'"]+)['"]/,
      javascript: /import.*from\s+['"]([^'"]+)['"]/,
      python: /import\s+(\w+)|from\s+(\w+)\s+import/,
      java: /import\s+([\w.]+)/
    };

    const pattern = importPatterns[language];
    if (!pattern) return imports;

    lines.forEach(line => {
      const match = line.match(pattern);
      if (match) {
        imports.push(match[1] || match[2]);
      }
    });

    return imports;
  }

  private extractExports(content: string, language: string): string[] {
    const lines = content.split('\n');
    const exports: string[] = [];

    const exportPatterns: Record<string, RegExp> = {
      typescript: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/,
      javascript: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/
    };

    const pattern = exportPatterns[language];
    if (!pattern) return exports;

    lines.forEach(line => {
      const match = line.match(pattern);
      if (match) {
        exports.push(match[1]);
      }
    });

    return exports;
  }

  private calculateSignificance(content: string): 'high' | 'medium' | 'low' {
    const keywordCount = (content.match(/\b(class|function|interface|type|enum|export|import)\b/g) || []).length;

    if (keywordCount >= 5) return 'high';
    if (keywordCount >= 2) return 'medium';
    return 'low';
  }
}