/**
 * TypeScript/JavaScript Parser using Babel AST
 * Single Responsibility: Parse TS/JS files only
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { BaseLanguageParser, ParsedCodeStructure, ImportInfo, ExportInfo, ClassInfo, FunctionInfo } from './ilanguage-parser';

export class TypeScriptParser extends BaseLanguageParser {
  
  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const structure = this.createBaseStructure(filePath, this.detectLanguage(filePath));
    
    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport'
        ]
      });

      this.extractStructure(ast, structure);
      
    } catch (error) {
      console.warn(`Failed to parse ${filePath}: ${error.message}`);
      // Return basic structure even if parsing fails
    }
    
    return structure;
  }

  getSupportedExtensions(): string[] {
    return ['ts', 'tsx', 'js', 'jsx'];
  }

  private detectLanguage(filePath: string): string {
    const ext = this.getFileExtension(filePath);
    return ext.startsWith('ts') ? 'typescript' : 'javascript';
  }

  private extractStructure(ast: any, structure: ParsedCodeStructure): void {
    traverse(ast, {
      // Extract imports
      ImportDeclaration: (path) => {
        this.extractImports(path.node, structure);
      },

      // Extract exports
      ExportNamedDeclaration: (path) => {
        this.extractNamedExports(path.node, structure);
      },

      ExportDefaultDeclaration: (path) => {
        this.extractDefaultExport(path.node, structure);
      },

      // Extract classes
      ClassDeclaration: (path) => {
        this.extractClass(path.node, structure);
      },

      // Extract functions
      FunctionDeclaration: (path) => {
        this.extractFunction(path.node, structure);
      },

      // Extract arrow functions assigned to variables
      VariableDeclarator: (path) => {
        if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
          this.extractFunctionFromVariable(path.node, structure);
        }
      },

      // Extract interfaces
      TSInterfaceDeclaration: (path) => {
        if (path.node.id?.name) {
          structure.interfaces.push(path.node.id.name);
        }
      }
    });
  }

  private extractImports(node: any, structure: ParsedCodeStructure): void {
    if (!node.source?.value) return;

    const from = node.source.value;
    
    node.specifiers?.forEach((spec: any) => {
      const importInfo: ImportInfo = {
        name: '',
        from,
        isDefault: false
      };

      if (t.isImportDefaultSpecifier(spec)) {
        importInfo.name = spec.local.name;
        importInfo.isDefault = true;
      } else if (t.isImportSpecifier(spec)) {
        importInfo.name = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
        importInfo.alias = spec.local.name !== (t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value) ? spec.local.name : undefined;
      } else if (t.isImportNamespaceSpecifier(spec)) {
        importInfo.name = '*';
        importInfo.alias = spec.local.name;
      }

      structure.imports.push(importInfo);
      
      // Add to dependencies if it's a relative import
      if (from.startsWith('./') || from.startsWith('../')) {
        structure.dependencies.push(from);
      }
    });
  }

  private extractNamedExports(node: any, structure: ParsedCodeStructure): void {
    if (node.declaration) {
      // export const, export function, export class, etc.
      this.extractExportFromDeclaration(node.declaration, structure, false);
    } else if (node.specifiers) {
      // export { name1, name2 }
      node.specifiers.forEach((spec: any) => {
        if (t.isExportSpecifier(spec)) {
          structure.exports.push({
            name: t.isIdentifier(spec.exported) ? spec.exported.name : spec.exported.value,
            isDefault: false,
            type: 'variable' // Default to variable, could be enhanced
          });
        }
      });
    }
  }

  private extractDefaultExport(node: any, structure: ParsedCodeStructure): void {
    if (node.declaration) {
      this.extractExportFromDeclaration(node.declaration, structure, true);
    }
  }

  private extractExportFromDeclaration(declaration: any, structure: ParsedCodeStructure, isDefault: boolean): void {
    let name = 'default';
    let type: ExportInfo['type'] = 'variable';

    if (t.isClassDeclaration(declaration) && declaration.id) {
      name = declaration.id.name;
      type = 'class';
    } else if (t.isFunctionDeclaration(declaration) && declaration.id) {
      name = declaration.id.name;
      type = 'function';
    } else if (t.isVariableDeclaration(declaration)) {
      const declarator = declaration.declarations[0];
      if (t.isIdentifier(declarator.id)) {
        name = declarator.id.name;
        type = 'variable';
      }
    } else if (t.isTSInterfaceDeclaration(declaration)) {
      name = declaration.id.name;
      type = 'interface';
    }

    structure.exports.push({
      name,
      isDefault,
      type
    });
  }

  private extractClass(node: any, structure: ParsedCodeStructure): void {
    if (!node.id?.name) return;

    const classInfo: ClassInfo = {
      name: node.id.name,
      methods: [],
      properties: []
    };

    // Extract extends
    if (node.superClass && t.isIdentifier(node.superClass)) {
      classInfo.extends = node.superClass.name;
    }

    // Extract implements
    if (node.implements) {
      classInfo.implements = node.implements
        .filter((impl: any) => t.isIdentifier(impl.id))
        .map((impl: any) => impl.id.name);
    }

    // Extract methods and properties
    node.body.body.forEach((member: any) => {
      if (t.isClassMethod(member) || (member.type === 'MethodDefinition')) {
        if (t.isIdentifier(member.key)) {
          classInfo.methods.push(member.key.name);
        }
      } else if (t.isClassProperty && t.isClassProperty(member) || (member.type === 'PropertyDefinition')) {
        if (t.isIdentifier(member.key)) {
          classInfo.properties.push(member.key.name);
        }
      }
    });

    structure.classes.push(classInfo);
  }

  private extractFunction(node: any, structure: ParsedCodeStructure): void {
    if (!node.id?.name) return;

    const functionInfo: FunctionInfo = {
      name: node.id.name,
      parameters: node.params
        .filter((param: any) => t.isIdentifier(param))
        .map((param: any) => param.name),
      isAsync: node.async || false,
      isExported: false // Will be determined by export detection
    };

    structure.functions.push(functionInfo);
  }

  private extractFunctionFromVariable(node: any, structure: ParsedCodeStructure): void {
    if (!t.isIdentifier(node.id)) return;

    const functionInfo: FunctionInfo = {
      name: node.id.name,
      parameters: node.init?.params
        ?.filter((param: any) => t.isIdentifier(param))
        ?.map((param: any) => param.name) || [],
      isAsync: node.init?.async || false,
      isExported: false
    };

    structure.functions.push(functionInfo);
  }
}