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
  
  constructor() {
    super();
    this.initializeParser();
  }

  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    const structure = this.createBaseStructure(filePath, 'java');
    
    if (!this.parser || !this.language) {
      console.warn('Tree-sitter Java not available, falling back to regex parsing');
      return this.parseWithRegex(content, structure);
    }
    
    try {
      const tree = this.parser.parse(content);
      this.extractFromAST(tree.rootNode, structure);
    } catch (error) {
      console.warn(`Tree-sitter parsing failed for ${filePath}: ${error.message}`);
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
        console.warn('Tree-sitter dependencies not available, falling back to basic parsing');
        this.initialized = false;
        return;
      }
      
      this.parser = new TreeSitter();
      this.language = Java;
      this.parser.setLanguage(this.language);
      
      console.debug('Tree-sitter Java parser initialized');
    } catch (error) {
      console.warn('Tree-sitter Java not available, will use regex fallback');
      this.parser = null;
      this.language = null;
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
      const nameNode = importNode.childForFieldName('name');
      const isStatic = importNode.children.some(child => child.text === 'static');
      
      if (nameNode) {
        const importPath = nameNode.text;
        const importName = importPath.split('.').pop() || importPath;
        
        structure.imports.push({
          name: importName,
          from: importPath,
          isDefault: false
        });
        
        // Add to dependencies if not standard library
        if (!importPath.startsWith('java.') && !importPath.startsWith('javax.')) {
          structure.dependencies.push(importPath);
        }
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