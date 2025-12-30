/**
 * Go Parser using Regex-based parsing
 * Single Responsibility: Parse Go files only
 */

import { BaseLanguageParser, ParsedCodeStructure, ClassInfo, FunctionInfo } from './ilanguage-parser';

export class GoParser extends BaseLanguageParser {

  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const structure = this.createBaseStructure(filePath, 'go');

    try {
      await this.parseWithRegex(content, structure);
    } catch (error) {
      console.warn(`Failed to parse Go file ${filePath}: ${error.message}`);
    }

    return structure;
  }

  getSupportedExtensions(): string[] {
    return ['go'];
  }

  private async parseWithRegex(content: string, structure: ParsedCodeStructure): Promise<void> {
    // Remove comments to avoid false matches
    const cleanContent = this.removeComments(content);

    // Parse package declaration
    this.parsePackage(cleanContent, structure);

    // Parse imports
    this.parseImports(cleanContent, structure);

    // Parse structs (Go's equivalent of classes)
    this.parseStructs(cleanContent, structure);

    // Parse interfaces
    this.parseInterfaces(cleanContent, structure);

    // Parse functions and methods
    this.parseFunctions(cleanContent, structure);

    // Parse type definitions
    this.parseTypes(cleanContent, structure);
  }

  private removeComments(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');

    return content;
  }

  private parsePackage(content: string, structure: ParsedCodeStructure): void {
    const packageMatch = content.match(/^package\s+(\w+)/m);
    if (packageMatch) {
      structure.variables.push(`package:${packageMatch[1]}`);
    }
  }

  private parseImports(content: string, structure: ParsedCodeStructure): void {
    // Single import
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let match;

    while ((match = singleImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      const importName = importPath.split('/').pop() || importPath;

      structure.imports.push({
        name: importName,
        from: importPath,
        isDefault: false
      });

      // Track non-standard library imports
      if (!importPath.startsWith('fmt') && !importPath.startsWith('os') &&
          !importPath.startsWith('io') && !importPath.startsWith('net') &&
          !importPath.startsWith('sync') && !importPath.startsWith('time')) {
        structure.dependencies.push(importPath);
      }
    }

    // Import block
    const importBlockMatch = content.match(/import\s*\(([\s\S]*?)\)/);
    if (importBlockMatch) {
      const importBlock = importBlockMatch[1];
      const importLines = importBlock.match(/"([^"]+)"/g);

      if (importLines) {
        for (const importLine of importLines) {
          const importPath = importLine.replace(/"/g, '');
          const importName = importPath.split('/').pop() || importPath;

          structure.imports.push({
            name: importName,
            from: importPath,
            isDefault: false
          });

          if (!this.isStdLib(importPath)) {
            structure.dependencies.push(importPath);
          }
        }
      }
    }
  }

  private isStdLib(importPath: string): boolean {
    const stdLibPrefixes = [
      'fmt', 'os', 'io', 'net', 'sync', 'time', 'strings', 'strconv',
      'bytes', 'bufio', 'context', 'errors', 'flag', 'log', 'math',
      'path', 'regexp', 'sort', 'testing', 'encoding', 'crypto', 'database'
    ];
    return stdLibPrefixes.some(prefix => importPath.startsWith(prefix) || importPath === prefix);
  }

  private parseStructs(content: string, structure: ParsedCodeStructure): void {
    // Match: type Name struct { ... }
    const structRegex = /type\s+(\w+)\s+struct\s*\{([^}]*)\}/g;
    let match;

    while ((match = structRegex.exec(content)) !== null) {
      const structName = match[1];
      const structBody = match[2];

      const classInfo: ClassInfo = {
        name: structName,
        methods: [],
        properties: []
      };

      // Extract fields from struct body
      const fieldRegex = /(\w+)\s+[\w.*\[\]]+/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(structBody)) !== null) {
        const fieldName = fieldMatch[1];
        // Skip embedded types (start with uppercase, no type after)
        if (fieldName && !fieldName.match(/^[A-Z]\w*$/)) {
          classInfo.properties.push(fieldName);
        }
      }

      // Find methods for this struct
      this.findStructMethods(content, structName, classInfo);

      structure.classes.push(classInfo);
    }
  }

  private findStructMethods(content: string, structName: string, classInfo: ClassInfo): void {
    // Match: func (r *StructName) MethodName(...) ...
    // or:    func (r StructName) MethodName(...) ...
    const methodRegex = new RegExp(
      `func\\s*\\(\\s*\\w+\\s+\\*?${structName}\\s*\\)\\s*(\\w+)\\s*\\(`,
      'g'
    );
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      classInfo.methods.push(match[1]);
    }
  }

  private parseInterfaces(content: string, structure: ParsedCodeStructure): void {
    // Match: type Name interface { ... }
    const interfaceRegex = /type\s+(\w+)\s+interface\s*\{/g;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      structure.interfaces.push(match[1]);
    }
  }

  private parseFunctions(content: string, structure: ParsedCodeStructure): void {
    // Match standalone functions: func FunctionName(params) returnType { ... }
    const funcRegex = /func\s+(\w+)\s*\(([^)]*)\)(?:\s*(?:\([^)]*\)|[\w\[\]*]+))?\s*\{/g;
    let match;

    while ((match = funcRegex.exec(content)) !== null) {
      const funcName = match[1];
      const paramString = match[2];

      // Skip method receivers (already captured in struct methods)
      // Methods have: func (receiver) name(params)
      // Functions have: func name(params)
      const beforeFunc = content.substring(Math.max(0, match.index - 10), match.index);
      if (beforeFunc.includes(')')) continue;

      const parameters: string[] = [];
      if (paramString.trim()) {
        // Go parameters: name type, name type
        const params = paramString.split(',');
        for (const param of params) {
          const parts = param.trim().split(/\s+/);
          if (parts.length >= 1) {
            // First part is usually the parameter name
            const paramName = parts[0];
            if (paramName && !paramName.includes('.')) {
              parameters.push(paramName);
            }
          }
        }
      }

      const functionInfo: FunctionInfo = {
        name: funcName,
        parameters,
        isAsync: false, // Go uses goroutines, not async/await
        isExported: /^[A-Z]/.test(funcName) // Go exports start with uppercase
      };

      structure.functions.push(functionInfo);
    }
  }

  private parseTypes(content: string, structure: ParsedCodeStructure): void {
    // Match type aliases and custom types
    const typeRegex = /type\s+(\w+)\s+(?!struct|interface)(\w+)/g;
    let match;

    while ((match = typeRegex.exec(content)) !== null) {
      const typeName = match[1];
      structure.variables.push(`type:${typeName}`);
    }
  }
}
