/**
 * File Analysis Service
 * SOLID Principles: Single Responsibility - Handle file discovery and code block extraction only
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { createHash } from 'crypto';
import { ASTAnalyzer } from '../../../../shared/ast/analyzer';
import { Logger } from '../../../../utils/logger';
import {
  IFileAnalysisService,
  CodeBlock,
  CodeLocation,
  StructuralFingerprint
} from '../interfaces/index';

export class FileAnalysisService implements IFileAnalysisService {
  private logger = Logger.getInstance();
  private astAnalyzer = new ASTAnalyzer();

  async getProjectFiles(
    projectPath: string,
    filePatterns?: string[],
    excludePatterns?: string[]
  ): Promise<string[]> {
    try {
      const defaultPatterns = [
        '**/*.ts',
        '**/*.js',
        '**/*.tsx',
        '**/*.jsx',
        '**/*.py',
        '**/*.java',
        '**/*.cs',
        '**/*.cpp',
        '**/*.c',
        '**/*.h'
      ];

      const patterns = filePatterns && filePatterns.length > 0 ? filePatterns : defaultPatterns;

      const defaultExcludes = [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.*',
        '**/*.spec.*',
        'coverage/**',
        '.git/**',
        '**/*.d.ts'
      ];

      const excludes = excludePatterns ? [...defaultExcludes, ...excludePatterns] : defaultExcludes;

      const files = await glob(patterns, {
        cwd: projectPath,
        ignore: excludes,
        absolute: false,
        dot: false
      });

      this.logger.debug(`Found ${files.length} files for duplication analysis`);
      return files;

    } catch (error) {
      this.logger.error('Failed to get project files:', error);
      throw error;
    }
  }

  async extractCodeBlocks(filePath: string): Promise<CodeBlock[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const blocks: CodeBlock[] = [];

      // Split content into logical blocks (functions, classes, methods)
      const lines = content.split('\n');
      const relativePath = path.relative(process.cwd(), filePath);

      // Extract blocks using different strategies based on file type
      const fileExt = path.extname(filePath).toLowerCase();

      if (['.ts', '.js', '.tsx', '.jsx'].includes(fileExt)) {
        blocks.push(...await this.extractJavaScriptBlocks(content, lines, relativePath));
      } else if (fileExt === '.py') {
        blocks.push(...await this.extractPythonBlocks(content, lines, relativePath));
      } else if (['.java', '.cs'].includes(fileExt)) {
        blocks.push(...await this.extractObjectOrientedBlocks(content, lines, relativePath));
      } else {
        // Generic extraction for other file types
        blocks.push(...await this.extractGenericBlocks(content, lines, relativePath));
      }

      return blocks;

    } catch (error) {
      this.logger.error(`Failed to extract code blocks from ${filePath}:`, error);
      return [];
    }
  }

  async analyzeFileStructure(filePath: string): Promise<StructuralFingerprint> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Count structural elements
      const functionCount = this.countMatches(content, /(?:function|def|public|private|protected)\s+\w+\s*\(/g);
      const classCount = this.countMatches(content, /(?:class|interface)\s+\w+/g);
      const variableCount = this.countMatches(content, /(?:var|let|const|final|static)\s+\w+/g);

      // Generate control flow hash (simplified)
      const controlFlowElements = content.match(/(?:if|for|while|switch|try|catch|return)/g) || [];
      const controlFlowHash = createHash('md5').update(controlFlowElements.join('')).digest('hex');

      // Generate dependency hash
      const dependencies = content.match(/(?:import|require|include|using)\s+[^;]+/g) || [];
      const dependencyHash = createHash('md5').update(dependencies.join('')).digest('hex');

      return {
        functionCount,
        classCount,
        variableCount,
        controlFlowHash,
        dependencyHash
      };

    } catch (error) {
      this.logger.error(`Failed to analyze file structure for ${filePath}:`, error);
      return {
        functionCount: 0,
        classCount: 0,
        variableCount: 0,
        controlFlowHash: '',
        dependencyHash: ''
      };
    }
  }

  private async extractJavaScriptBlocks(
    content: string,
    lines: string[],
    filePath: string
  ): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    // Extract function blocks
    const functionRegex = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(|class\s+\w+|interface\s+\w+)/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const startPos = match.index;
      const startLine = content.substring(0, startPos).split('\n').length;

      // Find the end of the block (simplified - would need proper AST parsing for accuracy)
      const blockEnd = this.findBlockEnd(content, startPos);
      const endLine = content.substring(0, blockEnd).split('\n').length;

      if (endLine > startLine) {
        const blockContent = lines.slice(startLine - 1, endLine).join('\n');
        const block = await this.createCodeBlock(blockContent, filePath, startLine, endLine);
        if (block) blocks.push(block);
      }
    }

    return blocks;
  }

  private async extractPythonBlocks(
    content: string,
    lines: string[],
    filePath: string
  ): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    // Python uses indentation for blocks
    const functionRegex = /^(?:def|class)\s+\w+/gm;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const startPos = match.index;
      const startLine = content.substring(0, startPos).split('\n').length;

      // Find the end based on indentation
      const endLine = this.findPythonBlockEnd(lines, startLine - 1);

      if (endLine > startLine) {
        const blockContent = lines.slice(startLine - 1, endLine).join('\n');
        const block = await this.createCodeBlock(blockContent, filePath, startLine, endLine);
        if (block) blocks.push(block);
      }
    }

    return blocks;
  }

  private async extractObjectOrientedBlocks(
    content: string,
    lines: string[],
    filePath: string
  ): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    // Extract methods and classes
    const blockRegex = /(?:public|private|protected|static)?\s*(?:class|interface|\w+\s+\w+\s*\()/g;
    let match;

    while ((match = blockRegex.exec(content)) !== null) {
      const startPos = match.index;
      const startLine = content.substring(0, startPos).split('\n').length;

      const blockEnd = this.findBlockEnd(content, startPos);
      const endLine = content.substring(0, blockEnd).split('\n').length;

      if (endLine > startLine) {
        const blockContent = lines.slice(startLine - 1, endLine).join('\n');
        const block = await this.createCodeBlock(blockContent, filePath, startLine, endLine);
        if (block) blocks.push(block);
      }
    }

    return blocks;
  }

  private async extractGenericBlocks(
    content: string,
    lines: string[],
    filePath: string
  ): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    // Split into logical chunks (every 10-50 lines)
    const chunkSize = 20;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const endIndex = Math.min(i + chunkSize, lines.length);
      const blockContent = lines.slice(i, endIndex).join('\n');

      if (blockContent.trim().length > 50) { // Skip very small blocks
        const block = await this.createCodeBlock(blockContent, filePath, i + 1, endIndex);
        if (block) blocks.push(block);
      }
    }

    return blocks;
  }

  private async createCodeBlock(
    content: string,
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<CodeBlock | null> {
    try {
      const trimmedContent = content.trim();

      if (trimmedContent.length < 30) {
        return null; // Skip very small blocks
      }

      const hash = createHash('md5').update(trimmedContent).digest('hex');
      const tokens = this.tokenize(trimmedContent);

      const location: CodeLocation = {
        file: filePath,
        startLine,
        endLine,
        codeSnippet: trimmedContent.substring(0, 200) + (trimmedContent.length > 200 ? '...' : ''),
        hash
      };

      // Try to get AST info
      let astInfo;
      try {
        astInfo = await this.astAnalyzer.analyzeFile(filePath);
      } catch {
        // AST analysis failed, continue without it
      }

      const structure = await this.analyzeBlockStructure(trimmedContent);

      return {
        content: trimmedContent,
        hash,
        location,
        astInfo,
        tokens,
        structure
      };

    } catch (error) {
      this.logger.debug(`Failed to create code block:`, error);
      return null;
    }
  }

  private async analyzeBlockStructure(content: string): Promise<StructuralFingerprint> {
    const functionCount = this.countMatches(content, /(?:function|def|=>\s*{)/g);
    const classCount = this.countMatches(content, /(?:class|interface)/g);
    const variableCount = this.countMatches(content, /(?:var|let|const|=)/g);

    const controlFlowElements = content.match(/(?:if|for|while|switch|try|return)/g) || [];
    const controlFlowHash = createHash('md5').update(controlFlowElements.join('')).digest('hex');

    const dependencies = content.match(/(?:import|require|from)/g) || [];
    const dependencyHash = createHash('md5').update(dependencies.join('')).digest('hex');

    return {
      functionCount,
      classCount,
      variableCount,
      controlFlowHash,
      dependencyHash
    };
  }

  private tokenize(content: string): string[] {
    // Simple tokenization - split by whitespace and common delimiters
    return content
      .split(/[\s\n\r\t\(\)\{\}\[\];,\.]+/)
      .filter(token => token.length > 1 && /\w/.test(token))
      .map(token => token.toLowerCase());
  }

  private countMatches(text: string, regex: RegExp): number {
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  private findBlockEnd(content: string, startPos: number): number {
    // Simplified block end detection - count braces
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = startPos; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      // Handle strings
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;

        if (braceCount === 0 && i > startPos) {
          return i + 1;
        }
      }
    }

    return content.length;
  }

  private findPythonBlockEnd(lines: string[], startIndex: number): number {
    const baseIndent = this.getIndentLevel(lines[startIndex]);

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (line === '' || line.startsWith('#')) continue;

      // If we find a line with same or less indentation, the block ended
      const currentIndent = this.getIndentLevel(lines[i]);
      if (currentIndent <= baseIndent) {
        return i;
      }
    }

    return lines.length;
  }

  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}