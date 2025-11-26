/**
 * Code Extraction Service
 * SOLID Principles: Single Responsibility - Handle code extraction only
 */

import { Logger } from '../../logger';
import { ICodeExtractionService } from '../interfaces';
import * as fs from 'fs';
import * as path from 'path';

export class CodeExtractionService implements ICodeExtractionService {
  private logger = Logger.getInstance();

  async extractCodeSnippet(
    filePath: string,
    functionName?: string,
    className?: string,
    lineRange?: { start: number; end: number }
  ): Promise<string> {
    try {
      // Read the file content
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`File not found: ${filePath}`);
        return `// File not found: ${filePath}`;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');

      // If line range is specified, extract that range
      if (lineRange) {
        const start = Math.max(0, lineRange.start - 1);
        const end = Math.min(lines.length, lineRange.end);
        return lines.slice(start, end).join('\n');
      }

      // If function name is specified, try to extract function
      if (functionName) {
        const functionSnippet = this.extractFunction(lines, functionName);
        if (functionSnippet) {
          return functionSnippet;
        }
      }

      // If class name is specified, try to extract class
      if (className) {
        const classSnippet = this.extractClass(lines, className);
        if (classSnippet) {
          return classSnippet;
        }
      }

      // If no specific extraction, return first 50 lines
      const maxLines = Math.min(50, lines.length);
      return lines.slice(0, maxLines).join('\n') +
        (lines.length > 50 ? '\n... (file truncated)' : '');

    } catch (error) {
      this.logger.error(`Failed to extract code from ${filePath}:`, error);
      return `// Error extracting code from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private extractFunction(lines: string[], functionName: string): string | null {
    try {
      // Look for function declaration patterns
      const functionPatterns = [
        new RegExp(`function\\s+${functionName}\\s*\\(`, 'i'),
        new RegExp(`${functionName}\\s*[=:]\\s*function`, 'i'),
        new RegExp(`${functionName}\\s*[=:]\\s*\\(`, 'i'),
        new RegExp(`${functionName}\\s*[=:]\\s*async`, 'i'),
        new RegExp(`async\\s+${functionName}\\s*\\(`, 'i'),
        new RegExp(`\\s+${functionName}\\s*\\(.*\\)\\s*{`, 'i') // Method in class
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line contains the function declaration
        const matchesPattern = functionPatterns.some(pattern => pattern.test(line));

        if (matchesPattern) {
          // Extract the function including its body
          const functionLines = this.extractBlock(lines, i);
          return functionLines.join('\n');
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error extracting function ${functionName}:`, error);
      return null;
    }
  }

  private extractClass(lines: string[], className: string): string | null {
    try {
      // Look for class declaration patterns
      const classPatterns = [
        new RegExp(`class\\s+${className}\\s*{`, 'i'),
        new RegExp(`class\\s+${className}\\s+extends`, 'i'),
        new RegExp(`class\\s+${className}\\s+implements`, 'i'),
        new RegExp(`export\\s+class\\s+${className}`, 'i')
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line contains the class declaration
        const matchesPattern = classPatterns.some(pattern => pattern.test(line));

        if (matchesPattern) {
          // Extract the class including its body
          const classLines = this.extractBlock(lines, i);
          return classLines.join('\n');
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error extracting class ${className}:`, error);
      return null;
    }
  }

  private extractBlock(lines: string[], startIndex: number): string[] {
    const result: string[] = [];
    let braceCount = 0;
    let inBlock = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      result.push(line);

      // Count braces to determine block boundaries
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inBlock = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      // If we've closed all braces, we're done with the block
      if (inBlock && braceCount === 0) {
        break;
      }

      // Safety check to prevent extracting too much
      if (result.length > 200) {
        result.push('... (block truncated)');
        break;
      }
    }

    return result;
  }

  async extractMultipleSnippets(
    extractions: Array<{
      filePath: string;
      functionName?: string;
      className?: string;
      lineRange?: { start: number; end: number };
    }>
  ): Promise<Array<{ filePath: string; content: string; success: boolean }>> {
    const results = [];

    for (const extraction of extractions) {
      try {
        const content = await this.extractCodeSnippet(
          extraction.filePath,
          extraction.functionName,
          extraction.className,
          extraction.lineRange
        );
        results.push({
          filePath: extraction.filePath,
          content,
          success: true
        });
      } catch (error) {
        this.logger.error(`Failed to extract from ${extraction.filePath}:`, error);
        results.push({
          filePath: extraction.filePath,
          content: `// Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          success: false
        });
      }
    }

    return results;
  }
}