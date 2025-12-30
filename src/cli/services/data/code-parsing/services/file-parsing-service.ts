/**
 * File Parsing Service
 * SOLID Principles: Single Responsibility - Handle individual file parsing only
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../../../../utils/logger';
import {
  IFileParsingService,
  ParsedFile,
  ParsedClass,
  ParsedFunction,
  ParsedMethod
} from '../interfaces/index';

export class FileParsingService implements IFileParsingService {
  private logger = Logger.getInstance();

  async parseCodeFile(filePath: string, relativePath: string): Promise<ParsedFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);

    switch (language) {
      case 'typescript':
        return this.parseTypeScriptFile(content, relativePath);
      case 'javascript':
        return this.parseJavaScriptFile(content, relativePath, language);
      case 'python':
        return this.parsePythonFile(content, relativePath);
      case 'java':
        return this.parseJavaFile(content, relativePath);
      default:
        return this.parseGenericFile(content, relativePath, language);
    }
  }

  parseJavaScriptFile(content: string, filePath: string, language: string): ParsedFile {
    const exports: string[] = [];
    const imports: Array<{ name: string; from: string; }> = [];
    const classes: ParsedClass[] = [];
    const functions: ParsedFunction[] = [];
    const interfaces: string[] = [];
    const constants: Array<{ name: string; type?: string; }> = [];
    const enums: Array<{ name: string; values: string[]; }> = [];

    // Extract exports
    const exportMatches = content.matchAll(/export\s+(?:(default)\s+)?(?:class|function|interface|const|let|var)\s+(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[2] || 'default');
    }

    // Extract named exports
    const namedExportMatches = content.matchAll(/export\s*\{\s*([^}]+)\s*\}/g);
    for (const match of namedExportMatches) {
      const names = match[1].split(',').map(n => n.trim().split(' as ')[0]);
      exports.push(...names);
    }

    // Extract imports
    const importMatches = content.matchAll(/import\s+(?:\*\s+as\s+(\w+)|(?:\{([^}]+)\}|\w+))\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const from = match[3];
      if (match[1]) {
        imports.push({ name: match[1], from });
      } else if (match[2]) {
        const names = match[2].split(',').map(n => n.trim().split(' as ')[0]);
        names.forEach(name => imports.push({ name, from }));
      } else {
        imports.push({ name: 'default', from });
      }
    }

    // Extract detailed classes with methods
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
    let classMatch;
    while ((classMatch = classRegex.exec(content)) !== null) {
      const className = classMatch[1];
      const extendsClass = classMatch[2];
      const implementsStr = classMatch[3];
      const classBody = classMatch[4];

      const startLine = content.substring(0, classMatch.index).split('\n').length;
      const endLine = startLine + classMatch[0].split('\n').length - 1;

      const implementsInterfaces = implementsStr ?
        implementsStr.split(',').map(i => i.trim()) : [];

      const methods = this.extractMethods(classBody, startLine);
      const properties = this.extractProperties(classBody);

      classes.push({
        name: className,
        extends: extendsClass,
        implements: implementsInterfaces,
        methods,
        properties,
        startLine,
        endLine
      });
    }

    // Extract standalone functions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
    let funcMatch;
    while ((funcMatch = functionRegex.exec(content)) !== null) {
      const funcName = funcMatch[1];
      const paramsStr = funcMatch[2];
      const returnType = funcMatch[3]?.trim();
      const funcBody = funcMatch[4];

      const startLine = content.substring(0, funcMatch.index).split('\n').length;
      const endLine = startLine + funcMatch[0].split('\n').length - 1;

      const parameters = this.parseParameters(paramsStr);
      const complexity = this.calculateComplexity(funcBody);
      const callsTo = this.extractFunctionCalls(funcBody);

      functions.push({
        name: funcName,
        isAsync: funcMatch[0].includes('async'),
        parameters,
        returnType,
        startLine,
        endLine,
        complexity,
        callsTo
      });
    }

    // Extract arrow functions
    const arrowFunctionRegex = /(?:export\s+)?const\s+(\w+)\s*:\s*([^=]+)?\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([^=>\s]+))?\s*=>\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
    let arrowMatch;
    while ((arrowMatch = arrowFunctionRegex.exec(content)) !== null) {
      const funcName = arrowMatch[1];
      const paramsStr = arrowMatch[4];
      const returnType = arrowMatch[5]?.trim();
      const funcBody = arrowMatch[6];

      const startLine = content.substring(0, arrowMatch.index).split('\n').length;
      const endLine = startLine + arrowMatch[0].split('\n').length - 1;

      const parameters = this.parseParameters(paramsStr);
      const complexity = this.calculateComplexity(funcBody);
      const callsTo = this.extractFunctionCalls(funcBody);

      functions.push({
        name: funcName,
        isAsync: Boolean(arrowMatch[3]),
        parameters,
        returnType,
        startLine,
        endLine,
        complexity,
        callsTo
      });
    }

    // Extract interfaces
    const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)/g);
    for (const match of interfaceMatches) {
      interfaces.push(match[1]);
    }

    // Extract constants
    const constantMatches = content.matchAll(/(?:export\s+)?const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/g);
    for (const match of constantMatches) {
      constants.push({
        name: match[1],
        type: match[2]?.trim()
      });
    }

    // Extract enums
    const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(content)) !== null) {
      const enumName = enumMatch[1];
      const enumBody = enumMatch[2];
      const values = enumBody.split(',').map(v => v.trim().split('=')[0].trim()).filter(Boolean);

      enums.push({
        name: enumName,
        values
      });
    }

    const dependencies = [...new Set(imports.map(imp => imp.from).filter(from => !from.startsWith('.')))];

    return {
      filePath,
      language,
      exports,
      imports,
      classes,
      functions,
      interfaces,
      dependencies,
      constants,
      enums
    };
  }

  parseTypeScriptFile(content: string, filePath: string): ParsedFile {
    // TypeScript parsing is similar to JavaScript but with type information
    return this.parseJavaScriptFile(content, filePath, 'typescript');
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.cs':
        return 'csharp';
      case '.cpp':
      case '.cc':
      case '.cxx':
        return 'cpp';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      default:
        return 'unknown';
    }
  }

  private extractMethods(classBody: string, classStartLine: number): ParsedMethod[] {
    const methods: ParsedMethod[] = [];
    const methodRegex = /(public|private|protected)?\s*(static)?\s*(async)?\s*(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;

    let methodMatch;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const visibility = (methodMatch[1] as 'public' | 'private' | 'protected') || 'public';
      const isStatic = Boolean(methodMatch[2]);
      const isAsync = Boolean(methodMatch[3]);
      const name = methodMatch[4];
      const paramsStr = methodMatch[5];
      const returnType = methodMatch[6]?.trim();
      const methodBody = methodMatch[7];

      const methodStartLine = classStartLine + classBody.substring(0, methodMatch.index).split('\n').length;
      const methodEndLine = methodStartLine + methodMatch[0].split('\n').length - 1;

      const parameters = this.parseParameters(paramsStr);
      const complexity = this.calculateComplexity(methodBody);
      const callsTo = this.extractFunctionCalls(methodBody);

      methods.push({
        name,
        visibility,
        isStatic,
        isAsync,
        parameters,
        returnType,
        startLine: methodStartLine,
        endLine: methodEndLine,
        complexity,
        callsTo
      });
    }

    return methods;
  }

  private extractProperties(classBody: string): Array<{ name: string; type?: string; visibility: string; }> {
    const properties: Array<{ name: string; type?: string; visibility: string; }> = [];
    const propertyRegex = /(public|private|protected)?\s*(static)?\s*(\w+)(?:\s*:\s*([^=;]+))?(?:\s*=\s*[^;]+)?\s*;/g;

    let propMatch;
    while ((propMatch = propertyRegex.exec(classBody)) !== null) {
      const visibility = propMatch[1] || 'public';
      const name = propMatch[3];
      const type = propMatch[4]?.trim();

      properties.push({
        name,
        type,
        visibility
      });
    }

    return properties;
  }

  private parseParameters(paramsStr: string): Array<{ name: string; type?: string; }> {
    if (!paramsStr.trim()) return [];

    return paramsStr.split(',').map(param => {
      const parts = param.trim().split(':');
      const name = parts[0]?.trim() || '';
      const type = parts[1]?.trim();
      return { name, type };
    }).filter(p => p.name);
  }

  private calculateComplexity(code: string): number {
    // Simple cyclomatic complexity calculation
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'catch', '&&', '||', '?'];
    let complexity = 1; // Base complexity

    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private extractFunctionCalls(code: string): string[] {
    const calls: string[] = [];
    const callRegex = /(\w+)\s*\(/g;
    let match;

    while ((match = callRegex.exec(code)) !== null) {
      const funcName = match[1];
      if (funcName && !['if', 'for', 'while', 'switch'].includes(funcName)) {
        calls.push(funcName);
      }
    }

    return [...new Set(calls)];
  }

  private parsePythonFile(content: string, filePath: string): ParsedFile {
    // Basic Python parsing - simplified implementation
    const exports: string[] = [];
    const imports: Array<{ name: string; from: string; }> = [];
    const classes: ParsedClass[] = [];
    const functions: ParsedFunction[] = [];

    // Extract imports
    const importMatches = content.matchAll(/(?:from\s+(\S+)\s+)?import\s+(.+)/g);
    for (const match of importMatches) {
      const from = match[1] || '';
      const imported = match[2].split(',').map(i => i.trim());
      imported.forEach(name => imports.push({ name, from }));
    }

    // Extract functions
    const funcMatches = content.matchAll(/def\s+(\w+)\s*\(([^)]*)\):/g);
    for (const match of funcMatches) {
      const name = match[1];
      const paramsStr = match[2];
      const parameters = paramsStr ? paramsStr.split(',').map(p => ({ name: p.trim() })) : [];

      functions.push({
        name,
        isAsync: false,
        parameters,
        startLine: 0,
        endLine: 0,
        complexity: 1,
        callsTo: []
      });
    }

    return {
      filePath,
      language: 'python',
      exports,
      imports,
      classes,
      functions,
      interfaces: [],
      dependencies: [...new Set(imports.map(imp => imp.from).filter(Boolean))],
      constants: [],
      enums: []
    };
  }

  private parseJavaFile(content: string, filePath: string): ParsedFile {
    // Basic Java parsing - simplified implementation
    return {
      filePath,
      language: 'java',
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

  private parseGenericFile(content: string, filePath: string, language: string): ParsedFile {
    return {
      filePath,
      language,
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