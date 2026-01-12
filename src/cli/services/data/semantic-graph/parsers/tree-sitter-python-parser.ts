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
  descendantsOfType(type: string): TreeSitterNode[];
}

export class TreeSitterPythonParser extends BaseLanguageParser {
  private parser: TreeSitterParser | null = null;
  private language: any = null;
  private initialized: boolean = false;
  
  constructor() {
    super();
    this.initializeParser();
  }

  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const structure = this.createBaseStructure(filePath, 'python');
    
    if (!this.parser || !this.language) {
      // Fallback to regex parsing if tree-sitter not available
      console.warn('Tree-sitter not available, falling back to regex parsing');
      return this.parseWithRegex(content, structure);
    }
    
    try {
      const tree = this.parser.parse(content);
      this.extractFromAST(tree.rootNode, structure);
    } catch (error) {
      console.warn(`Tree-sitter parsing failed for ${filePath}: ${error.message}`);
      // Fallback to regex parsing
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
        console.warn('Tree-sitter dependencies not available, falling back to basic parsing');
        this.initialized = false;
        return;
      }
      
      this.parser = new TreeSitter();
      this.language = Python;
      this.parser.setLanguage(this.language);
      
      console.debug('Tree-sitter Python parser initialized');
    } catch (error) {
      console.warn('Tree-sitter Python not available, will use regex fallback');
      this.parser = null;
      this.language = null;
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

  private extractImportsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    // Find import statements
    const importNodes = rootNode.descendantsOfType('import_statement');
    const fromImportNodes = rootNode.descendantsOfType('import_from_statement');
    
    // Process regular imports: import module
    for (const importNode of importNodes) {
      const nameNode = importNode.childForFieldName('name');
      if (nameNode) {
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
      const nameNode = fromImportNode.childForFieldName('name');
      
      if (moduleNode && nameNode) {
        const moduleName = moduleNode.text;
        const importedNames = this.extractImportedNames(nameNode);
        
        for (const importedName of importedNames) {
          structure.imports.push({
            name: importedName.name,
            from: moduleName,
            alias: importedName.alias,
            isDefault: false
          });
        }
        
        if (moduleName.startsWith('.')) {
          structure.dependencies.push(moduleName);
        }
      }
    }
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
          this.extractClassMembers(bodyNode, classInfo);
        }
        
        structure.classes.push(classInfo);
      }
    }
  }

  private extractFunctionsFromAST(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    const functionNodes = rootNode.descendantsOfType('function_definition');
    
    for (const functionNode of functionNodes) {
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

  private extractClassMembers(bodyNode: TreeSitterNode, classInfo: ClassInfo): void {
    const methodNodes = bodyNode.descendantsOfType('function_definition');
    const assignmentNodes = bodyNode.descendantsOfType('assignment');
    
    // Extract methods
    for (const methodNode of methodNodes) {
      const nameNode = methodNode.childForFieldName('name');
      if (nameNode) {
        classInfo.methods.push(nameNode.text);
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