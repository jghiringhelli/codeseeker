/**
 * File Parser Service
 * Single responsibility: Parse individual files for code structures
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../../../utils/logger';
import { ParsedFile, ParsedClass, ParsedFunction, ParsedMethod } from './interfaces';

export class FileParser {
  private logger = Logger.getInstance();

  async parseFile(filePath: string): Promise<ParsedFile> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const language = this.detectLanguage(filePath);

      return {
        filePath,
        language,
        exports: this.extractExports(content, language),
        imports: this.extractImports(content, language),
        classes: this.extractClasses(content, language),
        functions: this.extractFunctions(content, language),
        interfaces: this.extractInterfaces(content, language),
        dependencies: this.extractDependencies(content, language),
        constants: this.extractConstants(content, language),
        enums: this.extractEnums(content, language)
      };
    } catch (error) {
      this.logger.warn(`Failed to parse file ${filePath}`, error as Error);
      return this.createEmptyParsedFile(filePath);
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust'
    };
    return languageMap[ext] || 'unknown';
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];

    // TypeScript/JavaScript exports
    if (language === 'typescript' || language === 'javascript') {
      const exportRegex = /export\s+(?:class|function|interface|const|let|var|default)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      let match;
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }

    return [...new Set(exports)];
  }

  private extractImports(content: string, language: string): Array<{ name: string; from: string }> {
    const imports: Array<{ name: string; from: string }> = [];

    if (language === 'typescript' || language === 'javascript') {
      const importRegex = /import\s+(?:\{([^}]+)\}|\*\s+as\s+([^,\s]+)|([^,\s]+))\s+from\s+['"`]([^'"`]+)['"`]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const fromPath = match[4];

        if (match[1]) { // Named imports
          const namedImports = match[1].split(',').map(name => name.trim());
          namedImports.forEach(name => {
            imports.push({ name, from: fromPath });
          });
        } else if (match[2]) { // Namespace import
          imports.push({ name: match[2], from: fromPath });
        } else if (match[3]) { // Default import
          imports.push({ name: match[3], from: fromPath });
        }
      }
    }

    return imports;
  }

  private extractClasses(content: string, language: string): ParsedClass[] {
    const classes: ParsedClass[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:extends\s+([a-zA-Z_$][a-zA-Z0-9_$]*))?\s*(?:implements\s+([^{]+))?\s*\{/g;
      let match;
      while ((match = classRegex.exec(content)) !== null) {
        const className = match[1];
        const extendsClass = match[2];
        const implementsStr = match[3];

        const implementsInterfaces = implementsStr
          ? implementsStr.split(',').map(impl => impl.trim())
          : [];

        const classContent = this.extractBlockContent(content, match.index);
        const methods = this.extractClassMethods(classContent);
        const properties = this.extractClassProperties(classContent);

        classes.push({
          name: className,
          extends: extendsClass,
          implements: implementsInterfaces,
          methods,
          properties,
          startLine: this.getLineNumber(content, match.index),
          endLine: this.getLineNumber(content, match.index + classContent.length)
        });
      }
    }

    return classes;
  }

  private extractFunctions(content: string, language: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const functionRegex = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
      let match;
      while ((match = functionRegex.exec(content)) !== null) {
        const functionName = match[1];
        const paramsStr = match[2];
        const returnType = match[3]?.trim();
        const isAsync = content.substring(match.index - 10, match.index).includes('async');

        const parameters = this.parseParameters(paramsStr);
        const functionContent = this.extractBlockContent(content, match.index);

        functions.push({
          name: functionName,
          isAsync,
          parameters,
          returnType,
          startLine: this.getLineNumber(content, match.index),
          endLine: this.getLineNumber(content, match.index + functionContent.length),
          complexity: this.calculateComplexity(functionContent),
          callsTo: this.extractFunctionCalls(functionContent)
        });
      }
    }

    return functions;
  }

  private extractInterfaces(content: string, language: string): string[] {
    const interfaces: string[] = [];

    if (language === 'typescript') {
      const interfaceRegex = /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      let match;
      while ((match = interfaceRegex.exec(content)) !== null) {
        interfaces.push(match[1]);
      }
    }

    return interfaces;
  }

  private extractDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const importRegex = /import.*?from\s+['"`]([^'"`]+)['"`]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const dep = match[1];
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          dependencies.push(dep);
        }
      }
    }

    return [...new Set(dependencies)];
  }

  private extractConstants(content: string, language: string): Array<{ name: string; type?: string }> {
    const constants: Array<{ name: string; type?: string }> = [];

    if (language === 'typescript' || language === 'javascript') {
      const constRegex = /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?::\s*([^=]+))?\s*=/g;
      let match;
      while ((match = constRegex.exec(content)) !== null) {
        constants.push({
          name: match[1],
          type: match[2]?.trim()
        });
      }
    }

    return constants;
  }

  private extractEnums(content: string, language: string): Array<{ name: string; values: string[] }> {
    const enums: Array<{ name: string; values: string[] }> = [];

    if (language === 'typescript') {
      const enumRegex = /enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\{([^}]+)\}/g;
      let match;
      while ((match = enumRegex.exec(content)) !== null) {
        const enumName = match[1];
        const enumBody = match[2];
        const values = enumBody.split(',').map(v => v.trim().split('=')[0].trim()).filter(v => v);

        enums.push({ name: enumName, values });
      }
    }

    return enums;
  }

  // Helper methods
  private extractBlockContent(content: string, startIndex: number): string {
    let braceCount = 0;
    let i = content.indexOf('{', startIndex);
    if (i === -1) return '';

    const start = i;
    while (i < content.length) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0) break;
      i++;
    }

    return content.substring(start, i + 1);
  }

  private extractClassMethods(classContent: string): ParsedMethod[] {
    const methods: ParsedMethod[] = [];
    const methodRegex = /(public|private|protected)?\s*(static)?\s*(async)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;

    let match;
    while ((match = methodRegex.exec(classContent)) !== null) {
      const visibility = (match[1] || 'public') as 'public' | 'private' | 'protected';
      const isStatic = !!match[2];
      const isAsync = !!match[3];
      const methodName = match[4];
      const paramsStr = match[5];
      const returnType = match[6]?.trim();

      const parameters = this.parseParameters(paramsStr);
      const methodContent = this.extractBlockContent(classContent, match.index);

      methods.push({
        name: methodName,
        visibility,
        isStatic,
        isAsync,
        parameters,
        returnType,
        startLine: this.getLineNumber(classContent, match.index),
        endLine: this.getLineNumber(classContent, match.index + methodContent.length),
        complexity: this.calculateComplexity(methodContent),
        callsTo: this.extractFunctionCalls(methodContent)
      });
    }

    return methods;
  }

  private extractClassProperties(classContent: string): Array<{ name: string; type?: string; visibility: string }> {
    const properties: Array<{ name: string; type?: string; visibility: string }> = [];
    const propertyRegex = /(public|private|protected)?\s*(static)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?::\s*([^=;]+))?\s*[=;]/g;

    let match;
    while ((match = propertyRegex.exec(classContent)) !== null) {
      const visibility = match[1] || 'public';
      const propName = match[3];
      const propType = match[4]?.trim();

      properties.push({
        name: propName,
        type: propType,
        visibility
      });
    }

    return properties;
  }

  private parseParameters(paramsStr: string): Array<{ name: string; type?: string }> {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const [name, type] = param.trim().split(':');
      return {
        name: name.trim(),
        type: type?.trim()
      };
    });
  }

  private calculateComplexity(code: string): number {
    const complexityKeywords = ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch', 'try'];
    let complexity = 1;

    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      complexity += matches ? matches.length : 0;
    });

    return complexity;
  }

  private extractFunctionCalls(code: string): string[] {
    const calls: string[] = [];
    const callRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

    let match;
    while ((match = callRegex.exec(code)) !== null) {
      calls.push(match[1]);
    }

    return [...new Set(calls)];
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private createEmptyParsedFile(filePath: string): ParsedFile {
    return {
      filePath,
      language: 'unknown',
      exports: [],
      imports: [],
      classes: [],
      functions: [],
      interfaces: [],
      dependencies: [],
      constants: [],
      enums: []
    };
  }
}