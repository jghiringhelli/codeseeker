/**
 * Generic Parser - Fallback for unsupported languages
 * Single Responsibility: Basic parsing for any file type
 */

import { BaseLanguageParser, ParsedCodeStructure } from './ilanguage-parser';

export class GenericParser extends BaseLanguageParser {
  
  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const language = this.detectLanguage(filePath);
    const structure = this.createBaseStructure(filePath, language);
    
    try {
      // Basic text analysis for any file type
      await this.performBasicAnalysis(content, structure);
    } catch (error) {
      console.warn(`Failed to parse file ${filePath}: ${error.message}`);
    }
    
    return structure;
  }

  getSupportedExtensions(): string[] {
    return ['*']; // Supports any extension as fallback
  }

  override canParse(filePath: string): boolean {
    // Generic parser can handle any file, but should be last resort
    return true;
  }

  private detectLanguage(filePath: string): string {
    const ext = this.getFileExtension(filePath);
    
    const languageMap: Record<string, string> = {
      'cpp': 'cpp',
      'cc': 'cpp', 
      'cxx': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'kt': 'kotlin',
      'swift': 'swift',
      'scala': 'scala',
      'clj': 'clojure',
      'hs': 'haskell',
      'ml': 'ocaml',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'psm1': 'powershell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'md': 'markdown',
      'txt': 'text',
      'sql': 'sql'
    };

    return languageMap[ext] || 'unknown';
  }

  private async performBasicAnalysis(content: string, structure: ParsedCodeStructure): Promise<void> {
    const lines = content.split('\n');
    
    // Basic patterns that work across many languages
    this.extractBasicImports(lines, structure);
    this.extractBasicFunctions(lines, structure);
    this.extractBasicClasses(lines, structure);
    this.extractKeywords(content, structure);
  }

  private extractBasicImports(lines: string[], structure: ParsedCodeStructure): void {
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Common import patterns across languages
      const importPatterns = [
        /^import\s+(.+)$/,           // Python, Java, JS, etc.
        /^from\s+(.+?)\s+import/,   // Python
        /^#include\s*[<"](.+)[>"]/, // C/C++
        /^using\s+(.+);$/,          // C#
        /^require\s*\(?['"](.+)['"]\)?/, // Node.js
        /^@import\s+['"](.+)['"]/, // CSS/SCSS
        /^use\s+(.+);$/             // Rust, PHP
      ];

      for (const pattern of importPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          const importPath = match[1].replace(/['"]/g, '');
          structure.imports.push({
            name: this.extractNameFromPath(importPath),
            from: importPath,
            isDefault: false
          });
          
          // Add to dependencies if it looks like a relative path
          if (importPath.includes('./') || importPath.includes('../')) {
            structure.dependencies.push(importPath);
          }
          break;
        }
      }
    }
  }

  private extractBasicFunctions(lines: string[], structure: ParsedCodeStructure): void {
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Common function patterns
      const functionPatterns = [
        /^def\s+(\w+)\s*\(/,           // Python
        /^function\s+(\w+)\s*\(/,     // JavaScript
        /^(\w+)\s*\([^)]*\)\s*\{/,    // C-style languages
        /^pub\s+fn\s+(\w+)\s*\(/,     // Rust
        /^func\s+(\w+)\s*\(/,         // Go
        /^(\w+)\s*:\s*\([^)]*\)\s*=>/, // Scala/Kotlin
        /^sub\s+(\w+)\s*\(/           // Perl
      ];

      for (const pattern of functionPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          const functionName = match[1];
          structure.functions.push({
            name: functionName,
            parameters: [], // Could be enhanced to extract parameters
            isAsync: trimmed.includes('async'),
            isExported: trimmed.includes('export') || trimmed.includes('pub')
          });
          break;
        }
      }
    }
  }

  private extractBasicClasses(lines: string[], structure: ParsedCodeStructure): void {
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Common class patterns
      const classPatterns = [
        /^class\s+(\w+)/,           // Python, Java, C#, etc.
        /^struct\s+(\w+)/,          // C, C++, Rust, Go
        /^interface\s+(\w+)/,       // Java, C#, TypeScript
        /^trait\s+(\w+)/,           // Rust, Scala
        /^type\s+(\w+)\s+struct/,   // Go
        /^enum\s+(\w+)/             // Many languages
      ];

      for (const pattern of classPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          const className = match[1];
          
          if (trimmed.includes('interface') || trimmed.includes('trait')) {
            structure.interfaces.push(className);
          } else {
            structure.classes.push({
              name: className,
              methods: [],
              properties: [],
              extends: this.extractExtends(trimmed),
              implements: this.extractImplements(trimmed)
            });
          }
          break;
        }
      }
    }
  }

  private extractKeywords(content: string, structure: ParsedCodeStructure): void {
    // Extract meaningful words that could be useful for search
    const words = content.match(/\b[A-Z][a-zA-Z0-9_]*\b/g) || [];
    const uniqueWords = [...new Set(words)]
      .filter(word => word.length > 2 && word.length < 50)
      .slice(0, 20); // Limit to prevent noise
    
    structure.variables = uniqueWords;
  }

  private extractNameFromPath(path: string): string {
    return path.split('/').pop()?.split('.')[0] || path;
  }

  private extractExtends(line: string): string | undefined {
    const extendsMatch = line.match(/(?:extends|inherits|:\s*public)\s+(\w+)/);
    return extendsMatch ? extendsMatch[1] : undefined;
  }

  private extractImplements(line: string): string[] | undefined {
    const implementsMatch = line.match(/(?:implements|:\s*)([\w,\s]+)/);
    if (implementsMatch) {
      return implementsMatch[1].split(',').map(i => i.trim()).filter(i => i);
    }
    return undefined;
  }
}