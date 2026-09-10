/**
 * Tree-sitter Java Parser - Excellent Quality AST Parsing
 * Single Responsibility: Parse Java files using proper AST
 */

import { BaseLanguageParser, ParsedCodeStructure, ImportInfo, ExportInfo, ClassInfo, FunctionInfo } from './ilanguage-parser';

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
  descendantsOfType(type: string): TreeSitterNode[];
}

export class TreeSitterJavaParser extends BaseLanguageParser {
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
    const structure = this.createBaseStructure(filePath, 'java');

    await this.ensureInitialized();

    if (!this.parser || !this.language) {
      console.warn('Tree-sitter Java not available, falling back to regex parsing');
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
    return ['java'];
  }

  private async initializeParser(): Promise<void> {
    try {
      // Try to import tree-sitter dependencies (optional)
      let TreeSitter: any, Java: any;
      try {
        const treeSitterModule = await import('tree-sitter' as any);
        const javaModule = await import('tree-sitter-java' as any);
        TreeSitter = treeSitterModule.default || treeSitterModule;
        Java = javaModule.default || javaModule;
      } catch (importError) {
        this.loadFailure = `cannot load tree-sitter or tree-sitter-java: ${(importError as Error).message}`;
        console.warn(`Tree-sitter unavailable, falling back to regex parsing — ${this.loadFailure}`);
        this.initialized = true;
        return;
      }

      this.parser = new TreeSitter();
      this.language = Java;
      this.parser.setLanguage(this.language);

      // A native binding can load, accept setLanguage, and still return a tree with no
      // rootNode — seen when the addon and its grammar come from different module
      // registries. Every parse then throws inside extractFromAST and silently degrades to
      // regex, one file at a time, with output that looks merely thin rather than broken.
      // Decide once, here, so the parser is either trustworthy or honestly unavailable.
      const probe = this.parser.parse('class A {}\n');
      if (!probe?.rootNode?.descendantsOfType) {
        throw new Error('loaded but produced no usable syntax tree');
      }

      this.initialized = true;
      console.debug('Tree-sitter Java parser initialized');
    } catch (error) {
      this.loadFailure = `tree-sitter Java failed to initialise: ${(error as Error).message}`;
      console.warn(`${this.loadFailure} — falling back to regex parsing`);
      this.parser = null;
      this.language = null;
      this.initialized = true;
    }
  }

  private extractFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    // Extract package declaration
    this.extractPackageFromAST(rootNode, structure);

    // Extract imports
    this.extractImportsFromAST(rootNode, structure);

    // Extract classes and interfaces
    this.extractClassesFromAST(rootNode, structure);

    // Extract enums
    this.extractEnumsFromAST(rootNode, structure);

    // Extract annotations
    this.extractAnnotationsFromAST(rootNode, structure);
  }

  private extractPackageFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const packageNodes = rootNode.descendantsOfType('package_declaration');

    for (const packageNode of packageNodes) {
      const nameNode = packageNode.childForFieldName('name');
      if (nameNode) {
        structure.variables.push(`package:${nameNode.text}`);
      }
    }
  }

  private extractImportsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const importNodes = rootNode.descendantsOfType('import_declaration');

    for (const importNode of importNodes) {
      // The Java grammar gives `import_declaration` no `name` field: the path is an
      // unnamed `scoped_identifier` child (or a bare `identifier` for a single segment,
      // followed by `asterisk` for a wildcard). `childForFieldName('name')` therefore
      // returned null for every import ever written, and Java imports — the only source of
      // cross-file edges in a Java graph — were silently never extracted.
      const pathNode = importNode.namedChildren.find(
        child => child.type === 'scoped_identifier' || child.type === 'identifier');
      const isWildcard = importNode.namedChildren.some(child => child.type === 'asterisk');
      const isStatic = importNode.children.some(child => child.type === 'static' || child.text === 'static');

      if (pathNode) {
        const importPath = isWildcard ? `${pathNode.text}.*` : pathNode.text;
        // `import static java.lang.Math.max` binds `max`; a wildcard binds the package.
        const segments = pathNode.text.split('.');
        const importName = isWildcard ? (segments[segments.length - 1] || importPath)
          : (segments.pop() || importPath);

        structure.imports.push({
          name: importName,
          from: importPath,
          isDefault: false
        });

        // Add to dependencies if not standard library
        if (!importPath.startsWith('java.') && !importPath.startsWith('javax.')) {
          structure.dependencies.push(importPath);
        }
        void isStatic;
      }
    }
  }

  private extractClassesFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    // Extract regular classes
    const classNodes = rootNode.descendantsOfType('class_declaration');

    for (const classNode of classNodes) {
      const nameNode = classNode.childForFieldName('name');
      const superclassNode = classNode.childForFieldName('superclass');
      const interfacesNode = classNode.childForFieldName('interfaces');

      if (nameNode) {
        const classInfo: ClassInfo = {
          name: nameNode.text,
          methods: [],
          properties: [],
          isAbstract: this.hasModifier(classNode, 'abstract')
        };

        // Extract inheritance
        if (superclassNode) {
          const typeNode = superclassNode.childForFieldName('type');
          if (typeNode) {
            classInfo.extends = typeNode.text;
          }
        }

        // Extract implemented interfaces
        if (interfacesNode) {
          classInfo.implements = this.extractInterfaceList(interfacesNode);
        }

        // Extract class members
        const bodyNode = classNode.childForFieldName('body');
        if (bodyNode) {
          this.extractClassMembers(bodyNode, classInfo);
        }

        structure.classes.push(classInfo);
      }
    }

    // Extract interfaces
    const interfaceNodes = rootNode.descendantsOfType('interface_declaration');

    for (const interfaceNode of interfaceNodes) {
      const nameNode = interfaceNode.childForFieldName('name');
      if (nameNode) {
        structure.interfaces.push(nameNode.text);

        // Also create a class-like structure for interfaces
        const interfaceInfo: ClassInfo = {
          name: nameNode.text,
          methods: [],
          properties: []
        };

        const bodyNode = interfaceNode.childForFieldName('body');
        if (bodyNode) {
          this.extractInterfaceMembers(bodyNode, interfaceInfo);
        }

        structure.classes.push(interfaceInfo);
      }
    }
  }

  private extractEnumsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const enumNodes = rootNode.descendantsOfType('enum_declaration');

    for (const enumNode of enumNodes) {
      const nameNode = enumNode.childForFieldName('name');
      if (nameNode) {
        structure.classes.push({
          name: nameNode.text,
          methods: [],
          properties: []
        });
      }
    }
  }

  private extractAnnotationsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const annotationNodes = rootNode.descendantsOfType('annotation');

    for (const annotationNode of annotationNodes) {
      const nameNode = annotationNode.childForFieldName('name');
      if (nameNode) {
        structure.variables.push(`@${nameNode.text}`);
      }
    }
  }

  private extractClassMembers(bodyNode: TreeSitterNode, classInfo: ClassInfo): void {
    // Extract methods
    const methodNodes = bodyNode.descendantsOfType('method_declaration');
    for (const methodNode of methodNodes) {
      const nameNode = methodNode.childForFieldName('name');
      if (nameNode) {
        classInfo.methods.push(nameNode.text);
      }
    }

    // Extract constructors
    const constructorNodes = bodyNode.descendantsOfType('constructor_declaration');
    for (const constructorNode of constructorNodes) {
      const nameNode = constructorNode.childForFieldName('name');
      if (nameNode) {
        classInfo.methods.push(nameNode.text); // Constructor as method
      }
    }

    // Extract fields
    const fieldNodes = bodyNode.descendantsOfType('field_declaration');
    for (const fieldNode of fieldNodes) {
      const declaratorNodes = fieldNode.descendantsOfType('variable_declarator');
      for (const declaratorNode of declaratorNodes) {
        const nameNode = declaratorNode.childForFieldName('name');
        if (nameNode) {
          classInfo.properties.push(nameNode.text);
        }
      }
    }
  }

  private extractInterfaceMembers(bodyNode: TreeSitterNode, interfaceInfo: ClassInfo): void {
    // Extract method signatures
    const methodNodes = bodyNode.descendantsOfType('method_declaration');
    for (const methodNode of methodNodes) {
      const nameNode = methodNode.childForFieldName('name');
      if (nameNode) {
        interfaceInfo.methods.push(nameNode.text);
      }
    }

    // Extract constant fields
    const fieldNodes = bodyNode.descendantsOfType('constant_declaration');
    for (const fieldNode of fieldNodes) {
      const declaratorNodes = fieldNode.descendantsOfType('variable_declarator');
      for (const declaratorNode of declaratorNodes) {
        const nameNode = declaratorNode.childForFieldName('name');
        if (nameNode) {
          interfaceInfo.properties.push(nameNode.text);
        }
      }
    }
  }

  private extractInterfaceList(interfacesNode: TreeSitterNode): string[] {
    const interfaces: string[] = [];

    for (const child of interfacesNode.namedChildren) {
      if (child.type === 'type_identifier' || child.type === 'generic_type') {
        interfaces.push(child.text);
      }
    }

    return interfaces;
  }

  private hasModifier(node: TreeSitterNode, modifier: string): boolean {
    const modifiersNode = node.childForFieldName('modifiers');
    if (modifiersNode) {
      return modifiersNode.children.some(child => child.text === modifier);
    }
    return false;
  }

  // Fallback regex parsing (simplified version of the original)
  private async parseWithRegex(content: string, structure: ParsedCodeStructure): Promise<ParsedCodeStructure> {
    // Remove comments
    const cleanContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Parse imports
    const importRegex = /import\s+(?:static\s+)?([\w.*]+);/g;
    let match;
    while ((match = importRegex.exec(cleanContent)) !== null) {
      const importPath = match[1];
      structure.imports.push({
        name: importPath.split('.').pop() || importPath,
        from: importPath,
        isDefault: false
      });
    }

    // Parse classes
    const classRegex = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/g;
    while ((match = classRegex.exec(cleanContent)) !== null) {
      structure.classes.push({
        name: match[1],
        methods: [],
        properties: [],
        extends: match[2],
        implements: match[3] ? match[3].split(',').map(i => i.trim()) : undefined
      });
    }

    // Parse interfaces
    const interfaceRegex = /(?:public\s+)?interface\s+(\w+)/g;
    while ((match = interfaceRegex.exec(cleanContent)) !== null) {
      structure.interfaces.push(match[1]);
    }

    return structure;
  }
}