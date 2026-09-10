/**
 * Tree-sitter Python Parser - Excellent Quality AST Parsing
 * Single Responsibility: Parse Python files using proper AST
 */

import { BaseLanguageParser, ParsedCodeStructure, ImportInfo, ExportInfo, ClassInfo, FunctionInfo } from './ilanguage-parser';

// Tree-sitter interfaces (will be installed separately)
interface TreeSitterParser {
  setLanguage(language: any): void;
  parse(input: string): TreeSitterTree;
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
}

interface TreeSitterNode {
  type: string;
  text: string;
  children: TreeSitterNode[];
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildren: TreeSitterNode[];
  childForFieldName(fieldName: string): TreeSitterNode | null;
  /** Every child under a field. `name` is multi-valued on both import statement kinds. */
  childrenForFieldName(fieldName: string): TreeSitterNode[];
  descendantsOfType(type: string): TreeSitterNode[];
}

export class TreeSitterPythonParser extends BaseLanguageParser {
  private parser: TreeSitterParser | null = null;
  private language: any = null;
  private initialized: boolean = false;

  /**
   * Initialisation is deferred, not eager. The constructor used to fire
   * `initializeParser()` and drop the promise, so any `parse()` that arrived before the
   * dynamic import settled fell through to the regex path without saying so. The whole
   * point of this class is the AST, and a race decided whether you got one.
   */
  private initializing: Promise<void> | null = null;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (!this.initializing) this.initializing = this.initializeParser();
    await this.initializing;
  }

  /** Why the AST path is unavailable, or null while it is available. */
  private loadFailure: string | null = null;

  /** The most recent AST parse that threw and fell back to regex, if any. */
  private lastParseFailure: string | null = null;

  /** The most recent AST parse failure, for diagnostics. Null when there has been none. */
  lastAstParseFailure(): string | null {
    return this.lastParseFailure;
  }

  /**
   * Is this instance actually parsing an AST, or has it quietly degraded to regex?
   *
   * A caller cannot otherwise tell: both paths return the same shape, and the regex one
   * returns fewer and occasionally malformed symbols. Tests assert on this so they fail
   * loudly instead of passing against the fallback and reporting a green AST suite.
   */
  async usingAst(): Promise<boolean> {
    await this.ensureInitialized();
    return this.parser !== null && this.language !== null;
  }

  /** Reason the AST path is unavailable, for diagnostics. Null when it is available. */
  async astUnavailableReason(): Promise<string | null> {
    await this.ensureInitialized();
    return this.loadFailure;
  }

  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const structure = this.createBaseStructure(filePath, 'python');

    await this.ensureInitialized();

    if (!this.parser || !this.language) {
      // Fallback to regex parsing if tree-sitter not available
      console.warn('Tree-sitter not available, falling back to regex parsing');
      return this.parseWithRegex(content, structure);
    }

    try {
      const tree = this.parser.parse(content);
      this.extractFromAST(tree.rootNode, structure);
    } catch (error) {
      // A loaded parser that throws is NOT the same as an absent one. Both used to end
      // here and return regex output indistinguishable from a successful AST parse, so a
      // real breakage looked like a slightly thinner result. Record it.
      this.lastParseFailure = `${filePath}: ${(error as Error).message}`;
      console.warn(`Tree-sitter parsing failed for ${this.lastParseFailure} — falling back to regex`);
      return this.parseWithRegex(content, structure);
    }

    return structure;
  }

  getSupportedExtensions(): string[] {
    return ['py', 'pyx', 'pyi'];
  }

  private async initializeParser(): Promise<void> {
    try {
      // Try to import tree-sitter dependencies (optional)
      let TreeSitter: any, Python: any;
      try {
        const treeSitterModule = await import('tree-sitter' as any);
        const pythonModule = await import('tree-sitter-python' as any);
        TreeSitter = treeSitterModule.default || treeSitterModule;
        Python = pythonModule.default || pythonModule;
      } catch (importError) {
        this.loadFailure = `cannot load tree-sitter or tree-sitter-python: ${(importError as Error).message}`;
        console.warn(`Tree-sitter unavailable, falling back to regex parsing — ${this.loadFailure}`);
        this.initialized = true;
        return;
      }

      this.parser = new TreeSitter();
      this.language = Python;
      this.parser.setLanguage(this.language);

      // A native binding can load, accept setLanguage, and still return a tree with no
      // rootNode — seen when the addon and its grammar come from different module
      // registries. Every parse then throws inside extractFromAST and silently degrades to
      // regex, one file at a time, with output that looks merely thin rather than broken.
      // Decide once, here, so the parser is either trustworthy or honestly unavailable.
      const probe = this.parser.parse('x = 1\n');
      if (!probe?.rootNode?.descendantsOfType) {
        throw new Error('loaded but produced no usable syntax tree');
      }

      this.initialized = true;
      console.debug('Tree-sitter Python parser initialized');
    } catch (error) {
      this.loadFailure = `tree-sitter Python failed to initialise: ${(error as Error).message}`;
      console.warn(`${this.loadFailure} — falling back to regex parsing`);
      this.parser = null;
      this.language = null;
      this.initialized = true;
    }
  }

  private extractFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    // Extract imports
    this.extractImportsFromAST(rootNode, structure);

    // Extract classes
    this.extractClassesFromAST(rootNode, structure);

    // Extract functions
    this.extractFunctionsFromAST(rootNode, structure);

    // Extract decorators and other Python-specific constructs
    this.extractDecoratorsFromAST(rootNode, structure);
  }

  /**
   * Record where a symbol was declared. A tree-sitter node carries `startPosition.row`
   * as a 0-based row; a node without one records nothing rather than claiming line 1.
   */
  private noteLine(structure: ParsedCodeStructure, name: string, node: TreeSitterNode): void {
    const row = node?.startPosition?.row;
    if (!name || typeof row !== 'number') return;
    if (!structure.symbolLines) structure.symbolLines = {};
    // First declaration wins: a redefinition should not move the original.
    if (structure.symbolLines[name] === undefined) structure.symbolLines[name] = row + 1;
  }

  private extractImportsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    // Find import statements
    const importNodes = rootNode.descendantsOfType('import_statement');
    const fromImportNodes = rootNode.descendantsOfType('import_from_statement');

    // `name` is a multi-valued field on both statement kinds: `import os, sys` and
    // `from x import a, b, c` each carry one `name` child per imported symbol.
    // `childForFieldName` returns only the first, so every import past the first was
    // dropped — 8 of 16 on a single Django view module. Take them all.

    // Process regular imports: import module
    for (const importNode of importNodes) {
      for (const nameNode of this.fieldChildren(importNode, 'name')) {
        const moduleName = nameNode.text;
        structure.imports.push({
          name: moduleName,
          from: moduleName,
          isDefault: false
        });

        if (moduleName.startsWith('.')) {
          structure.dependencies.push(moduleName);
        }
      }
    }

    // Process from imports: from module import name
    for (const fromImportNode of fromImportNodes) {
      const moduleNode = fromImportNode.childForFieldName('module_name');
      const nameNodes = this.fieldChildren(fromImportNode, 'name');
      if (!moduleNode || nameNodes.length === 0) continue;

      const moduleName = moduleNode.text;
      for (const nameNode of nameNodes) {
        for (const importedName of this.extractImportedNames(nameNode)) {
          structure.imports.push({
            name: importedName.name,
            from: moduleName,
            alias: importedName.alias,
            isDefault: false
          });
        }
      }

      if (moduleName.startsWith('.')) {
        structure.dependencies.push(moduleName);
      }
    }
  }

  /**
   * All children under a field, tolerating a binding that predates
   * `childrenForFieldName` by falling back to the single-valued accessor.
   */
  private fieldChildren(node: TreeSitterNode, field: string): TreeSitterNode[] {
    if (typeof node.childrenForFieldName === 'function') {
      return node.childrenForFieldName(field) || [];
    }
    const only = node.childForFieldName(field);
    return only ? [only] : [];
  }

  private extractClassesFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const classNodes = rootNode.descendantsOfType('class_definition');

    for (const classNode of classNodes) {
      const nameNode = classNode.childForFieldName('name');
      const superclassesNode = classNode.childForFieldName('superclasses');

      if (nameNode) {
        const classInfo: ClassInfo = {
          name: nameNode.text,
          methods: [],
          properties: []
        };

        // Extract inheritance
        if (superclassesNode) {
          const superclasses = this.extractSuperclasses(superclassesNode);
          if (superclasses.length > 0) {
            classInfo.extends = superclasses[0];
            if (superclasses.length > 1) {
              classInfo.implements = superclasses.slice(1);
            }
          }
        }

        // Extract methods and properties from class body
        const bodyNode = classNode.childForFieldName('body');
        if (bodyNode) {
          this.extractClassMembers(bodyNode, classInfo, structure);
        }

        structure.classes.push(classInfo);
        this.noteLine(structure, classInfo.name, classNode);
      }
    }
  }

  private extractFunctionsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const functionNodes = rootNode.descendantsOfType('function_definition');

    // `descendantsOfType` reaches into class bodies, so every method was also reported as
    // a standalone function and the indexer built two graph nodes for it — `Profile.follow`
    // and `follow`, same file, same line. On the Django corpus that was 51 of 117 function
    // nodes. A method belongs to its class; collect their positions and skip them here.
    const methodStarts = new Set<string>();
    for (const classNode of rootNode.descendantsOfType('class_definition')) {
      const body = classNode.childForFieldName('body');
      if (!body) continue;
      for (const method of body.descendantsOfType('function_definition')) {
        methodStarts.add(`${method.startPosition.row}:${method.startPosition.column}`);
      }
    }

    for (const functionNode of functionNodes) {
      if (methodStarts.has(`${functionNode.startPosition.row}:${functionNode.startPosition.column}`)) {
        continue;
      }
      const nameNode = functionNode.childForFieldName('name');
      const parametersNode = functionNode.childForFieldName('parameters');

      if (nameNode) {
        const functionInfo: FunctionInfo = {
          name: nameNode.text,
          parameters: [],
          isAsync: this.isAsyncFunction(functionNode),
          isExported: !nameNode.text.startsWith('_') // Python convention
        };

        // Extract parameters
        if (parametersNode) {
          functionInfo.parameters = this.extractParameters(parametersNode);
        }

        // Extract return type annotation if present
        const returnTypeNode = functionNode.childForFieldName('return_type');
        if (returnTypeNode) {
          functionInfo.returnType = returnTypeNode.text;
        }

        structure.functions.push(functionInfo);
        this.noteLine(structure, functionInfo.name, functionNode);
      }
    }
  }

  private extractDecoratorsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const decoratorNodes = rootNode.descendantsOfType('decorator');

    for (const decoratorNode of decoratorNodes) {
      const decoratorName = decoratorNode.text;
      // Store decorators as special variables for semantic analysis
      structure.variables.push(`@${decoratorName}`);
    }
  }

  private extractImportedNames(nameNode: TreeSitterNode): Array<{name: string, alias?: string}> {
    const names: Array<{name: string, alias?: string}> = [];

    if (nameNode.type === 'dotted_as_names' || nameNode.type === 'aliased_import') {
      for (const child of nameNode.namedChildren) {
        if (child.type === 'aliased_import') {
          const nameChild = child.childForFieldName('name');
          const aliasChild = child.childForFieldName('alias');

          if (nameChild) {
            names.push({
              name: nameChild.text,
              alias: aliasChild ? aliasChild.text : undefined
            });
          }
        } else {
          names.push({ name: child.text });
        }
      }
    } else {
      names.push({ name: nameNode.text });
    }

    return names;
  }

  private extractSuperclasses(superclassesNode: TreeSitterNode): string[] {
    const superclasses: string[] = [];

    for (const child of superclassesNode.namedChildren) {
      if (child.type === 'identifier' || child.type === 'attribute') {
        superclasses.push(child.text);
      }
    }

    return superclasses;
  }

  private extractClassMembers(
    bodyNode: TreeSitterNode,
    classInfo: ClassInfo,
    structure?: ParsedCodeStructure
  ): void {
    const methodNodes = bodyNode.descendantsOfType('function_definition');
    const assignmentNodes = bodyNode.descendantsOfType('assignment');

    // Extract methods
    for (const methodNode of methodNodes) {
      const nameNode = methodNode.childForFieldName('name');
      if (nameNode) {
        classInfo.methods.push(nameNode.text);
        if (structure) this.noteLine(structure, `${classInfo.name}.${nameNode.text}`, methodNode);
      }
    }

    // Extract properties (simplified - looks for assignments)
    for (const assignmentNode of assignmentNodes) {
      const leftNode = assignmentNode.childForFieldName('left');
      if (leftNode?.type === 'identifier') {
        classInfo.properties.push(leftNode.text);
      }
    }
  }

  private extractParameters(parametersNode: TreeSitterNode): string[] {
    const parameters: string[] = [];

    for (const child of parametersNode.namedChildren) {
      if (child.type === 'identifier') {
        // Skip 'self' and 'cls' parameters
        if (child.text !== 'self' && child.text !== 'cls') {
          parameters.push(child.text);
        }
      } else if (child.type === 'typed_parameter') {
        const nameNode = child.childForFieldName('pattern');
        if (nameNode && nameNode.text !== 'self' && nameNode.text !== 'cls') {
          parameters.push(nameNode.text);
        }
      }
    }

    return parameters;
  }

  private isAsyncFunction(functionNode: TreeSitterNode): boolean {
    // Check if function has async modifier
    for (const child of functionNode.children) {
      if (child.type === 'async' || child.text === 'async') {
        return true;
      }
    }
    return false;
  }

  // Fallback regex parsing (same as before)
  private async parseWithRegex(content: string, structure: ParsedCodeStructure): Promise<ParsedCodeStructure> {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse imports (simplified version)
      this.parseImportsRegex(line, structure);

      // Parse classes (simplified version)
      this.parseClassesRegex(line, lines, i, structure);

      // Parse functions (simplified version)
      this.parseFunctionsRegex(line, structure);
    }

    return structure;
  }

  // ... (include simplified regex methods as fallback)
  private parseImportsRegex(line: string, structure: ParsedCodeStructure): void {
    // Simplified regex-based import parsing
    const importMatch = line.match(/^import\s+(.+)$/);
    if (importMatch) {
      structure.imports.push({
        name: importMatch[1],
        from: importMatch[1],
        isDefault: false
      });
    }

    const fromImportMatch = line.match(/^from\s+(.+?)\s+import\s+(.+)$/);
    if (fromImportMatch) {
      structure.imports.push({
        name: fromImportMatch[2],
        from: fromImportMatch[1],
        isDefault: false
      });
    }
  }

  private parseClassesRegex(line: string, lines: string[], currentIndex: number, structure: ParsedCodeStructure): void {
    const classMatch = line.match(/^class\s+(\w+)(?:\((.+)\))?:/);
    if (classMatch) {
      structure.classes.push({
        name: classMatch[1],
        methods: [],
        properties: [],
        extends: classMatch[2]
      });
    }
  }

  private parseFunctionsRegex(line: string, structure: ParsedCodeStructure): void {
    const functionMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
    if (functionMatch) {
      structure.functions.push({
        name: functionMatch[1],
        parameters: [],
        isAsync: line.includes('async def'),
        isExported: !functionMatch[1].startsWith('_')
      });
    }
  }
}