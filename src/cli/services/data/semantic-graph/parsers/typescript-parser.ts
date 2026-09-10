/**
 * TypeScript/JavaScript Parser using Babel AST
 * Single Responsibility: Parse TS/JS files only
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { BaseLanguageParser, ParsedCodeStructure, ImportInfo, ExportInfo, ClassInfo, FunctionInfo } from './ilanguage-parser';

/** A route path or a test description; past this a name stops being a name. */
const MAX_LABEL_LENGTH = 60;

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
        this.extractAnonymousDefault(path.node, structure);
      },

      // A function passed as an argument after a string literal: `router.get('/articles',
      // handler)`, `describe('the article service', () => {})`. The literal is the only
      // name the callback has, and it is the name a reader would search for.
      CallExpression: (path) => {
        this.extractLabelledCallback(path.node, structure);
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
          this.noteLine(structure, path.node.id.name, path.node);
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
          this.noteLine(structure, `${classInfo.name}.${member.key.name}`, member);
        }
      } else if (t.isClassProperty && t.isClassProperty(member) || (member.type === 'PropertyDefinition')) {
        if (t.isIdentifier(member.key)) {
          classInfo.properties.push(member.key.name);
        }
      }
    });

    structure.classes.push(classInfo);
    this.noteLine(structure, classInfo.name, node);
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
    this.noteLine(structure, functionInfo.name, node);
  }

  /**
   * `export default (state, action) => {…}` — the Redux reducer and Express middleware
   * idiom. The function is anonymous, but the module is not, and the module name is what
   * every importer already calls it. Without this the whole `reducers/` directory of a
   * RealWorld app contributes zero symbols.
   */
  private extractAnonymousDefault(node: any, structure: ParsedCodeStructure): void {
    const declaration: any = node.declaration;
    const isCallable = t.isArrowFunctionExpression(declaration)
      || t.isFunctionExpression(declaration)
      || t.isFunctionDeclaration(declaration);
    const alreadyNamed = Boolean((node.declaration as any).id);
    if (!isCallable || alreadyNamed) return;

    const name = this.moduleName(structure.filePath);
    structure.functions.push({
      name,
      parameters: this.parameterNames(declaration),
      isAsync: declaration.async || false,
      isExported: true
    });
    this.noteLine(structure, name, declaration);
  }

  /**
   * Names an anonymous callback after the string literal that labels its call. Deliberately
   * requires the literal to be the *first* argument, which is the shape of every routing
   * and test-block API and almost nothing else.
   */
  private extractLabelledCallback(node: any, structure: ParsedCodeStructure): void {
    const label = node.arguments?.[0];
    if (!t.isStringLiteral(label) || !label.value) return;

    const callback = node.arguments.find((arg: any) =>
      t.isArrowFunctionExpression(arg) || (t.isFunctionExpression(arg) && !arg.id));
    if (!callback) return;

    const callee = this.calleeName(node.callee);
    if (!callee) return;

    const name = `${callee}(${label.value.slice(0, MAX_LABEL_LENGTH)})`;
    structure.functions.push({
      name,
      parameters: this.parameterNames(callback),
      isAsync: callback.async || false,
      isExported: false
    });
    this.noteLine(structure, name, callback);
  }

  private calleeName(callee: any): string | null {
    if (t.isIdentifier(callee)) return callee.name;
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) return callee.property.name;
    return null;
  }

  /**
   * Record where a symbol was declared. Babel gives every node a `loc`; a node without one
   * (synthesised, or a parser without position tracking) records nothing rather than
   * claiming line 1.
   */
  private noteLine(structure: ParsedCodeStructure, name: string, node: any): void {
    const line = node?.loc?.start?.line;
    if (!name || typeof line !== 'number') return;
    if (!structure.symbolLines) structure.symbolLines = {};
    // First declaration wins: an overload or a re-export should not move the definition.
    if (structure.symbolLines[name] === undefined) structure.symbolLines[name] = line;
  }

  /** `article-list.js` -> `articleList`. */
  private moduleName(filePath: string): string {
    const base = (filePath.split(/[\/]/).pop() || '').replace(/\.[^.]+$/, '');
    return base.replace(/[-_.]+(\w)/g, (_m, c: string) => c.toUpperCase()) || 'default';
  }

  private parameterNames(fn: any): string[] {
    return (fn.params || [])
      .filter((param: any) => t.isIdentifier(param))
      .map((param: any) => param.name);
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
    this.noteLine(structure, functionInfo.name, node);
  }
}