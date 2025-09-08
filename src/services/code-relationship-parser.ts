/**
 * Code Relationship Parser
 * Parses project files to extract relationships for the semantic graph
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { SemanticGraphService, NodeType, RelationshipType } from './semantic-graph';
import { Logger } from '../utils/logger';

interface ParsedFile {
  filePath: string;
  language: string;
  exports: string[];
  imports: Array<{ name: string; from: string; }>;
  classes: string[];
  functions: string[];
  interfaces: string[];
  dependencies: string[];
}

interface ProjectStructure {
  files: ParsedFile[];
  relationships: Array<{
    fromFile: string;
    toFile: string;
    type: RelationshipType;
    metadata: any;
  }>;
}

export class CodeRelationshipParser {
  private logger = Logger.getInstance();
  private semanticGraph: SemanticGraphService;

  constructor() {
    this.semanticGraph = new SemanticGraphService();
  }

  async initialize(): Promise<void> {
    await this.semanticGraph.initialize();
    this.logger.info('🔍 Code relationship parser initialized');
  }

  /**
   * Parse entire project and populate semantic graph
   */
  async parseAndPopulateProject(projectPath: string, projectId: string): Promise<void> {
    this.logger.info(`🔄 Parsing project structure: ${projectPath}`);
    
    try {
      // Step 1: Parse all code files
      const structure = await this.parseProjectStructure(projectPath);
      
      // Step 2: Create nodes in Neo4j
      const nodeMap = await this.createGraphNodes(structure, projectId);
      
      // Step 3: Create relationships
      await this.createGraphRelationships(structure, nodeMap);
      
      // Step 4: Add business concept nodes
      await this.extractBusinessConcepts(structure, projectId);
      
      this.logger.info(`✅ Project parsed: ${structure.files.length} files, ${structure.relationships.length} relationships`);
      
    } catch (error) {
      this.logger.error(`❌ Project parsing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Parse all files in the project to extract structure
   */
  private async parseProjectStructure(projectPath: string): Promise<ProjectStructure> {
    const files: ParsedFile[] = [];
    const relationships: ProjectStructure['relationships'] = [];

    // Discover code files
    const codeFiles = await glob([
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
      '**/*.py', '**/*.java', '**/*.cpp', '**/*.c',
      '**/*.cs', '**/*.go', '**/*.rs'
    ], {
      cwd: projectPath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
    });

    // Parse each file
    for (const filePath of codeFiles) {
      try {
        const relativePath = path.relative(projectPath, filePath);
        const parsedFile = await this.parseCodeFile(filePath, relativePath);
        files.push(parsedFile);
      } catch (error) {
        this.logger.warn(`Failed to parse ${filePath}: ${error}`);
      }
    }

    // Extract relationships between files
    for (const file of files) {
      for (const importInfo of file.imports) {
        const targetFile = this.resolveImportPath(file.filePath, importInfo.from, projectPath);
        if (targetFile && files.some(f => f.filePath === targetFile)) {
          relationships.push({
            fromFile: file.filePath,
            toFile: targetFile,
            type: 'IMPORTS',
            metadata: { importName: importInfo.name }
          });
        }
      }
    }

    return { files, relationships };
  }

  /**
   * Parse individual code file
   */
  private async parseCodeFile(filePath: string, relativePath: string): Promise<ParsedFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);

    switch (language) {
      case 'typescript':
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

  /**
   * Parse JavaScript/TypeScript files
   */
  private parseJavaScriptFile(content: string, filePath: string, language: string): ParsedFile {
    const exports: string[] = [];
    const imports: Array<{ name: string; from: string; }> = [];
    const classes: string[] = [];
    const functions: string[] = [];
    const interfaces: string[] = [];

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
        // import * as name
        imports.push({ name: match[1], from });
      } else if (match[2]) {
        // import { names }
        const names = match[2].split(',').map(n => n.trim().split(' as ')[0]);
        names.forEach(name => imports.push({ name, from }));
      } else {
        // default import
        imports.push({ name: 'default', from });
      }
    }

    // Extract classes
    const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)/g);
    for (const match of classMatches) {
      classes.push(match[1]);
    }

    // Extract functions
    const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g);
    for (const match of functionMatches) {
      functions.push(match[1]);
    }

    // Extract arrow functions and const functions
    const arrowFunctionMatches = content.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g);
    for (const match of arrowFunctionMatches) {
      functions.push(match[1]);
    }

    // Extract interfaces (TypeScript)
    if (language === 'typescript') {
      const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)/g);
      for (const match of interfaceMatches) {
        interfaces.push(match[1]);
      }
    }

    return {
      filePath,
      language,
      exports,
      imports,
      classes,
      functions,
      interfaces,
      dependencies: imports.map(i => i.from)
    };
  }

  /**
   * Parse Python files
   */
  private parsePythonFile(content: string, filePath: string): ParsedFile {
    const exports: string[] = [];
    const imports: Array<{ name: string; from: string; }> = [];
    const classes: string[] = [];
    const functions: string[] = [];

    // Extract imports
    const importMatches = content.matchAll(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm);
    for (const match of importMatches) {
      const from = match[1] || '';
      const names = match[2].split(',').map(n => n.trim().split(' as ')[0]);
      names.forEach(name => imports.push({ name, from }));
    }

    // Extract classes
    const classMatches = content.matchAll(/^class\s+(\w+)/gm);
    for (const match of classMatches) {
      classes.push(match[1]);
      exports.push(match[1]); // Classes are typically exported
    }

    // Extract functions
    const functionMatches = content.matchAll(/^def\s+(\w+)/gm);
    for (const match of functionMatches) {
      functions.push(match[1]);
      if (!match[1].startsWith('_')) { // Public functions
        exports.push(match[1]);
      }
    }

    return {
      filePath,
      language: 'python',
      exports,
      imports,
      classes,
      functions,
      interfaces: [],
      dependencies: imports.map(i => i.from).filter(Boolean)
    };
  }

  /**
   * Parse Java files
   */
  private parseJavaFile(content: string, filePath: string): ParsedFile {
    const exports: string[] = [];
    const imports: Array<{ name: string; from: string; }> = [];
    const classes: string[] = [];
    const functions: string[] = [];

    // Extract imports
    const importMatches = content.matchAll(/import\s+(?:static\s+)?([^;]+);/g);
    for (const match of importMatches) {
      const fullImport = match[1];
      const name = fullImport.split('.').pop() || fullImport;
      imports.push({ name, from: fullImport });
    }

    // Extract classes
    const classMatches = content.matchAll(/(?:public\s+)?class\s+(\w+)/g);
    for (const match of classMatches) {
      classes.push(match[1]);
      exports.push(match[1]);
    }

    // Extract methods (simplified)
    const methodMatches = content.matchAll(/(?:public|private|protected)\s+(?:static\s+)?[\w<>[\]]+\s+(\w+)\s*\(/g);
    for (const match of methodMatches) {
      functions.push(match[1]);
    }

    return {
      filePath,
      language: 'java',
      exports,
      imports,
      classes,
      functions,
      interfaces: [],
      dependencies: imports.map(i => i.from)
    };
  }

  /**
   * Parse generic files (fallback)
   */
  private parseGenericFile(content: string, filePath: string, language: string): ParsedFile {
    return {
      filePath,
      language,
      exports: [],
      imports: [],
      classes: [],
      functions: [],
      interfaces: [],
      dependencies: []
    };
  }

  /**
   * Create nodes in Neo4j graph
   */
  private async createGraphNodes(structure: ProjectStructure, projectId: string): Promise<Map<string, string>> {
    const nodeMap = new Map<string, string>();

    for (const file of structure.files) {
      try {
        // Create file node
        const fileNodeId = await this.semanticGraph.addNode('Code', {
          name: path.basename(file.filePath),
          path: file.filePath,
          language: file.language,
          project_id: projectId,
          file_type: 'file',
          exports: file.exports,
          imports: file.dependencies
        });
        nodeMap.set(file.filePath, fileNodeId);

        // Create class nodes
        for (const className of file.classes) {
          const classNodeId = await this.semanticGraph.addNode('Code', {
            name: className,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            file_type: 'class',
            parent_file: file.filePath
          });
          nodeMap.set(`${file.filePath}:class:${className}`, classNodeId);
          
          // Link class to file
          await this.semanticGraph.addRelationship(fileNodeId, classNodeId, 'DEFINES');
        }

        // Create function nodes
        for (const functionName of file.functions) {
          const functionNodeId = await this.semanticGraph.addNode('Code', {
            name: functionName,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            file_type: 'function',
            parent_file: file.filePath
          });
          nodeMap.set(`${file.filePath}:function:${functionName}`, functionNodeId);
          
          // Link function to file
          await this.semanticGraph.addRelationship(fileNodeId, functionNodeId, 'DEFINES');
        }

        // Create interface nodes (TypeScript)
        for (const interfaceName of file.interfaces) {
          const interfaceNodeId = await this.semanticGraph.addNode('Code', {
            name: interfaceName,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            file_type: 'interface',
            parent_file: file.filePath
          });
          nodeMap.set(`${file.filePath}:interface:${interfaceName}`, interfaceNodeId);
          
          // Link interface to file
          await this.semanticGraph.addRelationship(fileNodeId, interfaceNodeId, 'DEFINES');
        }

      } catch (error) {
        this.logger.warn(`Failed to create nodes for ${file.filePath}: ${error}`);
      }
    }

    return nodeMap;
  }

  /**
   * Create relationships in Neo4j graph
   */
  private async createGraphRelationships(
    structure: ProjectStructure, 
    nodeMap: Map<string, string>
  ): Promise<void> {
    for (const rel of structure.relationships) {
      try {
        const fromNodeId = nodeMap.get(rel.fromFile);
        const toNodeId = nodeMap.get(rel.toFile);
        
        if (fromNodeId && toNodeId) {
          await this.semanticGraph.addRelationship(fromNodeId, toNodeId, rel.type, rel.metadata);
        }
      } catch (error) {
        this.logger.warn(`Failed to create relationship ${rel.fromFile} -> ${rel.toFile}: ${error}`);
      }
    }
  }

  /**
   * Extract business concepts from code
   */
  private async extractBusinessConcepts(structure: ProjectStructure, projectId: string): Promise<void> {
    const concepts = new Set<string>();

    // Extract concepts from file names and class names
    for (const file of structure.files) {
      // Extract from file path
      const pathParts = file.filePath.split(/[/\\]/).map(part => 
        part.replace(/\.(ts|js|tsx|jsx|py|java|cpp|c|cs|go|rs)$/i, '')
      );
      pathParts.forEach(part => {
        if (part.length > 2 && !['src', 'lib', 'dist', 'build', 'test', 'spec'].includes(part.toLowerCase())) {
          concepts.add(part);
        }
      });

      // Extract from class names
      file.classes.forEach(className => {
        concepts.add(className);
      });
    }

    // Create business concept nodes
    for (const concept of concepts) {
      try {
        await this.semanticGraph.addNode('BusinessConcept', {
          name: concept,
          project_id: projectId,
          extracted_from: 'code_analysis'
        });
      } catch (error) {
        this.logger.warn(`Failed to create business concept ${concept}: ${error}`);
      }
    }
  }

  /**
   * Resolve import path to actual file path
   */
  private resolveImportPath(fromFile: string, importPath: string, projectPath: string): string | null {
    // Skip external modules
    if (!importPath.startsWith('.') && !path.isAbsolute(importPath)) {
      return null;
    }

    try {
      const fromDir = path.dirname(fromFile);
      let resolvedPath = path.resolve(fromDir, importPath);

      // Try different extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java'];
      for (const ext of extensions) {
        const withExt = resolvedPath + ext;
        if (fs.access(withExt).then(() => true).catch(() => false)) {
          return path.relative(projectPath, withExt);
        }
      }

      // Try index files
      const indexFiles = extensions.map(ext => path.join(resolvedPath, 'index' + ext));
      for (const indexFile of indexFiles) {
        if (fs.access(indexFile).then(() => true).catch(() => false)) {
          return path.relative(projectPath, indexFile);
        }
      }
    } catch (error) {
      // Resolution failed
    }

    return null;
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust'
    };
    return languageMap[ext] || 'text';
  }

  async close(): Promise<void> {
    await this.semanticGraph.close();
  }
}