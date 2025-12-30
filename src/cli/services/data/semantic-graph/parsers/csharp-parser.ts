/**
 * C# Parser using Regex-based parsing
 * Single Responsibility: Parse C# files only
 * Optimized for Unity projects with MonoBehaviour, ScriptableObject patterns
 */

import { BaseLanguageParser, ParsedCodeStructure, ClassInfo, FunctionInfo } from './ilanguage-parser';

export class CSharpParser extends BaseLanguageParser {

  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const structure = this.createBaseStructure(filePath, 'csharp');

    try {
      await this.parseWithRegex(content, structure);
    } catch (error) {
      console.warn(`Failed to parse C# file ${filePath}: ${error.message}`);
    }

    return structure;
  }

  getSupportedExtensions(): string[] {
    return ['cs'];
  }

  private async parseWithRegex(content: string, structure: ParsedCodeStructure): Promise<void> {
    // Remove comments to avoid false matches
    const cleanContent = this.removeComments(content);

    // Parse namespace declaration
    this.parseNamespace(cleanContent, structure);

    // Parse using statements (imports)
    this.parseUsings(cleanContent, structure);

    // Parse classes, structs, and interfaces
    this.parseTypes(cleanContent, structure);

    // Parse methods
    this.parseMethods(cleanContent, structure);
  }

  private removeComments(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove XML documentation comments
    content = content.replace(/\/\/\/.*$/gm, '');

    return content;
  }

  private parseNamespace(content: string, structure: ParsedCodeStructure): void {
    // Support both traditional and file-scoped namespaces
    const namespaceMatch = content.match(/namespace\s+([\w.]+)\s*[{;]/);
    if (namespaceMatch) {
      structure.variables.push(`namespace:${namespaceMatch[1]}`);
    }
  }

  private parseUsings(content: string, structure: ParsedCodeStructure): void {
    const usingRegex = /using\s+(?:static\s+)?([\w.]+)(?:\s*=\s*[\w.]+)?;/g;
    let match;

    while ((match = usingRegex.exec(content)) !== null) {
      const importPath = match[1];
      const importName = importPath.split('.').pop() || importPath;

      structure.imports.push({
        name: importName,
        from: importPath,
        isDefault: false
      });

      // Track Unity-specific dependencies
      if (importPath.startsWith('UnityEngine') || importPath.startsWith('UnityEditor')) {
        structure.dependencies.push(importPath);
      }
      // Track non-System dependencies
      else if (!importPath.startsWith('System')) {
        structure.dependencies.push(importPath);
      }
    }
  }

  private parseTypes(content: string, structure: ParsedCodeStructure): void {
    // Parse classes (including Unity MonoBehaviour, ScriptableObject, etc.)
    const classRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:abstract\s+|sealed\s+|static\s+|partial\s+)*class\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*([\w\s,<>]+))?\s*(?:where\s+[^{]+)?\{/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const inheritanceString = match[2];

      let extendsClass: string | undefined;
      let implementsList: string[] = [];

      if (inheritanceString) {
        const parts = inheritanceString.split(',').map(p => p.trim());
        // First item could be base class or interface
        if (parts.length > 0) {
          const first = parts[0];
          // If it starts with 'I' and uppercase, likely an interface
          if (first.match(/^I[A-Z]/)) {
            implementsList = parts;
          } else {
            extendsClass = first;
            implementsList = parts.slice(1);
          }
        }
      }

      const classInfo: ClassInfo = {
        name: className,
        methods: [],
        properties: [],
        extends: extendsClass,
        implements: implementsList.length > 0 ? implementsList : undefined
      };

      // Find methods and properties in this class
      this.parseClassMembers(content, className, classInfo);

      structure.classes.push(classInfo);
    }

    // Parse structs
    const structRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:readonly\s+)?struct\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*([\w\s,<>]+))?\s*\{/g;

    while ((match = structRegex.exec(content)) !== null) {
      const structName = match[1];
      const implementsString = match[2];

      const classInfo: ClassInfo = {
        name: structName,
        methods: [],
        properties: [],
        implements: implementsString ? implementsString.split(',').map(i => i.trim()) : undefined
      };

      this.parseClassMembers(content, structName, classInfo);
      structure.classes.push(classInfo);
    }

    // Parse interfaces
    const interfaceRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*([\w\s,<>]+))?\s*\{/g;

    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      structure.interfaces.push(interfaceName);
    }

    // Parse enums
    const enumRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?enum\s+(\w+)\s*(?::\s*\w+)?\s*\{/g;

    while ((match = enumRegex.exec(content)) !== null) {
      const enumName = match[1];
      structure.variables.push(`enum:${enumName}`);
    }
  }

  private parseClassMembers(content: string, className: string, classInfo: ClassInfo): void {
    // Find the class block
    const classPattern = new RegExp(
      `(?:class|struct)\\s+${className}(?:<[^>]+>)?(?:\\s*:[^{]+)?\\s*\\{`,
      'g'
    );
    const classMatch = classPattern.exec(content);

    if (!classMatch) return;

    const classStart = classMatch.index + classMatch[0].length;
    const classEnd = this.findMatchingBrace(content, classStart - 1);
    const classBody = content.substring(classStart, classEnd);

    // Parse methods (including Unity lifecycle methods)
    const methodRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:virtual\s+|override\s+|abstract\s+|static\s+|async\s+|sealed\s+)*(?:[\w<>\[\],\s]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:where\s+[^{]+)?[{;]/g;
    let methodMatch;

    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      // Skip constructor (same name as class) and property accessors
      if (methodName !== className && !['get', 'set', 'add', 'remove'].includes(methodName)) {
        classInfo.methods.push(methodName);
      }
    }

    // Parse properties
    const propertyRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:virtual\s+|override\s+|abstract\s+|static\s+|readonly\s+)*[\w<>\[\],\s]+\s+(\w+)\s*\{\s*(?:get|set)/g;
    let propertyMatch;

    while ((propertyMatch = propertyRegex.exec(classBody)) !== null) {
      const propertyName = propertyMatch[1];
      classInfo.properties.push(propertyName);
    }

    // Parse fields (including Unity serialized fields)
    const fieldRegex = /(?:\[[\w\s,()="']+\]\s*)*(?:public\s+|private\s+|protected\s+|internal\s+)?(?:static\s+|readonly\s+|const\s+)*[\w<>\[\],\s]+\s+(\w+)\s*[=;]/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
      const fieldName = fieldMatch[1];
      // Avoid duplicates and skip method-like matches
      if (!classInfo.properties.includes(fieldName) &&
          !classInfo.methods.includes(fieldName) &&
          !['get', 'set', 'return', 'if', 'else', 'while', 'for', 'foreach', 'switch', 'case', 'break', 'continue', 'throw', 'try', 'catch', 'finally'].includes(fieldName)) {
        classInfo.properties.push(fieldName);
      }
    }
  }

  private parseMethods(content: string, structure: ParsedCodeStructure): void {
    // Parse methods for function-level analysis
    const methodRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:virtual\s+|override\s+|abstract\s+|static\s+|async\s+)*(?:[\w<>\[\],\s]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:where\s+[^{]+)?[{;]/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const paramString = match[2];

      // Skip common keywords that might match
      if (['if', 'while', 'for', 'foreach', 'switch', 'catch', 'using', 'lock'].includes(methodName)) {
        continue;
      }

      const parameters: string[] = [];
      if (paramString.trim()) {
        const params = paramString.split(',');
        for (const param of params) {
          const paramParts = param.trim().split(/\s+/);
          if (paramParts.length >= 2) {
            parameters.push(paramParts[paramParts.length - 1]); // Last part is parameter name
          }
        }
      }

      const functionInfo: FunctionInfo = {
        name: methodName,
        parameters,
        isAsync: content.includes(`async`) && content.includes(methodName),
        isExported: content.includes(`public`) && content.includes(methodName)
      };

      structure.functions.push(functionInfo);
    }
  }

  private findMatchingBrace(content: string, startIndex: number): number {
    let braceCount = 1;
    let index = startIndex + 1;

    while (index < content.length && braceCount > 0) {
      if (content[index] === '{') {
        braceCount++;
      } else if (content[index] === '}') {
        braceCount--;
      }
      index++;
    }

    return index - 1;
  }
}