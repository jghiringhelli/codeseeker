/**
 * Python Parser using Tree-sitter
 * Single Responsibility: Parse Python files only
 */

import { BaseLanguageParser, ParsedCodeStructure, ImportInfo, ExportInfo, ClassInfo, FunctionInfo } from './ilanguage-parser';

export class PythonParser extends BaseLanguageParser {
  
  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const structure = this.createBaseStructure(filePath, 'python');
    
    try {
      // For now, use regex-based parsing as a fallback
      // TODO: Implement tree-sitter when tree-sitter-python is available
      await this.parseWithRegex(content, structure);
      
    } catch (error) {
      console.warn(`Failed to parse Python file ${filePath}: ${error.message}`);
      // Return basic structure even if parsing fails
    }
    
    return structure;
  }

  getSupportedExtensions(): string[] {
    return ['py', 'pyx', 'pyi'];
  }

  private async parseWithRegex(content: string, structure: ParsedCodeStructure): Promise<void> {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse imports
      this.parseImports(line, structure);
      
      // Parse classes
      this.parseClasses(line, lines, i, structure);
      
      // Parse functions
      this.parseFunctions(line, structure);
    }
  }

  private parseImports(line: string, structure: ParsedCodeStructure): void {
    // import module
    const importMatch = line.match(/^import\s+(.+)$/);
    if (importMatch) {
      const modules = importMatch[1].split(',').map(m => m.trim());
      for (const module of modules) {
        structure.imports.push({
          name: module,
          from: module,
          isDefault: false
        });
        
        // Add to dependencies if it's a relative import
        if (module.startsWith('.')) {
          structure.dependencies.push(module);
        }
      }
      return;
    }

    // from module import name
    const fromImportMatch = line.match(/^from\s+(.+?)\s+import\s+(.+)$/);
    if (fromImportMatch) {
      const module = fromImportMatch[1];
      const imports = fromImportMatch[2].split(',').map(i => i.trim());
      
      for (const importName of imports) {
        // Handle 'as' aliases
        const aliasMatch = importName.match(/(.+?)\s+as\s+(.+)/);
        if (aliasMatch) {
          structure.imports.push({
            name: aliasMatch[1].trim(),
            from: module,
            alias: aliasMatch[2].trim(),
            isDefault: false
          });
        } else {
          structure.imports.push({
            name: importName,
            from: module,
            isDefault: false
          });
        }
      }

      // Add to dependencies if it's a relative import
      if (module.startsWith('.')) {
        structure.dependencies.push(module);
      }
    }
  }

  private parseClasses(line: string, lines: string[], currentIndex: number, structure: ParsedCodeStructure): void {
    const classMatch = line.match(/^class\s+(\w+)(?:\((.+)\))?:/);
    if (classMatch) {
      const className = classMatch[1];
      const inheritance = classMatch[2];
      
      const classInfo: ClassInfo = {
        name: className,
        methods: [],
        properties: []
      };

      // Parse inheritance
      if (inheritance) {
        const parents = inheritance.split(',').map(p => p.trim());
        if (parents.length > 0) {
          classInfo.extends = parents[0]; // Python supports multiple inheritance, but we'll take the first
          if (parents.length > 1) {
            classInfo.implements = parents.slice(1);
          }
        }
      }

      // Look ahead to find methods and properties in this class
      const indentLevel = this.getIndentLevel(lines[currentIndex + 1] || '');
      for (let j = currentIndex + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine) continue;
        
        const nextIndent = this.getIndentLevel(lines[j]);
        if (nextIndent <= this.getIndentLevel(lines[currentIndex]) && nextLine) {
          break; // End of class
        }

        if (nextIndent === indentLevel) {
          // Method definition
          const methodMatch = nextLine.match(/^def\s+(\w+)\s*\(/);
          if (methodMatch) {
            classInfo.methods.push(methodMatch[1]);
          }
          
          // Property assignment (simplified)
          const propertyMatch = nextLine.match(/^(\w+)\s*=/);
          if (propertyMatch && !methodMatch) {
            classInfo.properties.push(propertyMatch[1]);
          }
        }
      }

      structure.classes.push(classInfo);
    }
  }

  private parseFunctions(line: string, structure: ParsedCodeStructure): void {
    const functionMatch = line.match(/^def\s+(\w+)\s*\(([^)]*)\)/);
    if (functionMatch) {
      const functionName = functionMatch[1];
      const paramString = functionMatch[2];
      
      // Parse parameters
      const parameters: string[] = [];
      if (paramString.trim()) {
        const params = paramString.split(',').map(p => p.trim());
        for (const param of params) {
          // Extract parameter name (ignore type hints and default values)
          const paramName = param.split(':')[0].split('=')[0].trim();
          if (paramName && paramName !== 'self') {
            parameters.push(paramName);
          }
        }
      }

      const functionInfo: FunctionInfo = {
        name: functionName,
        parameters,
        isAsync: line.includes('async def'),
        isExported: !functionName.startsWith('_') // Python convention: _ prefix for private
      };

      structure.functions.push(functionInfo);
    }
  }

  private getIndentLevel(line: string): number {
    let indent = 0;
    for (const char of line) {
      if (char === ' ') indent++;
      else if (char === '\t') indent += 4;
      else break;
    }
    return indent;
  }
}