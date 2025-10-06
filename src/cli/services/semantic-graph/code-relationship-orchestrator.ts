/**
 * Code Relationship Orchestrator - Main coordinator following SOLID principles
 * Single Responsibility: Orchestrate semantic graph population
 * Open/Closed: Easy to extend with new parsers
 * Dependency Inversion: Depends on abstractions (interfaces)
 */

import { SemanticGraphService } from '../semantic-graph';
import { ILanguageParser, ParsedCodeStructure } from './parsers/ilanguage-parser';
import { TypeScriptParser } from './parsers/typescript-parser';
import { PythonParser } from './parsers/python-parser';
import { JavaParser } from './parsers/java-parser';
import { GenericParser } from './parsers/generic-parser';
import { TreeSitterPythonParser } from './parsers/tree-sitter-python-parser';
import { TreeSitterJavaParser } from './parsers/tree-sitter-java-parser';
import { NodeBuilder, NodeCreationResult } from './builders/node-builder';
import { RelationshipBuilder } from './builders/relationship-builder';
import { Logger } from '../../../utils/logger';
import glob from 'fast-glob';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectParsingResult {
  totalFiles: number;
  successfullyParsed: number;
  errors: string[];
  nodeStats: {
    files: number;
    classes: number;
    functions: number;
    interfaces: number;
  };
  relationshipStats: {
    imports: number;
    inheritance: number;
    containment: number;
  };
}

/**
 * Main orchestrator for semantic graph population
 * Follows Dependency Inversion Principle - depends on interfaces
 */
export class CodeRelationshipOrchestrator {
  private logger = Logger.getInstance();
  private parsers: Map<string, ILanguageParser> = new Map();
  private genericParser: GenericParser;
  private nodeBuilder: NodeBuilder;
  private relationshipBuilder: RelationshipBuilder;

  constructor(private semanticGraph: SemanticGraphService) {
    this.nodeBuilder = new NodeBuilder(semanticGraph);
    this.relationshipBuilder = new RelationshipBuilder(semanticGraph);
    this.initializeParsers();
  }

  /**
   * Initialize and register language parsers
   * Follows Open/Closed Principle - easy to add new parsers
   */
  private initializeParsers(): void {
    // Try to initialize Tree-sitter parsers first (excellent quality)
    const treeSitterParsers = this.initializeTreeSitterParsers();
    
    // Fallback to regex parsers for languages without Tree-sitter
    const regexParsers = [
      new TypeScriptParser(), // Always available (Babel)
      new PythonParser(),     // Regex fallback
      new JavaParser()        // Regex fallback
    ];

    // Register Tree-sitter parsers first (they take priority)
    for (const parser of treeSitterParsers) {
      for (const ext of parser.getSupportedExtensions()) {
        this.parsers.set(ext, parser);
        this.logger.debug(`Registered Tree-sitter parser for .${ext} files`);
      }
    }

    // Register regex parsers for extensions not covered by Tree-sitter
    for (const parser of regexParsers) {
      for (const ext of parser.getSupportedExtensions()) {
        if (!this.parsers.has(ext)) {
          this.parsers.set(ext, parser);
          this.logger.debug(`Registered regex parser for .${ext} files`);
        }
      }
    }

    // Register generic parser as fallback
    this.genericParser = new GenericParser();
    
    this.logger.info(`🔧 Initialized ${this.parsers.size} language parsers (Tree-sitter + regex + generic fallback)`);
  }

  /**
   * Initialize Tree-sitter parsers if packages are available
   */
  private initializeTreeSitterParsers(): ILanguageParser[] {
    const parsers: ILanguageParser[] = [];
    
    try {
      // Try Python Tree-sitter parser
      const pythonParser = new TreeSitterPythonParser();
      parsers.push(pythonParser);
      this.logger.debug('✅ Tree-sitter Python parser available');
    } catch (error) {
      this.logger.debug('⚠️ Tree-sitter Python not available, using regex fallback');
    }

    try {
      // Try Java Tree-sitter parser
      const javaParser = new TreeSitterJavaParser();
      parsers.push(javaParser);
      this.logger.debug('✅ Tree-sitter Java parser available');
    } catch (error) {
      this.logger.debug('⚠️ Tree-sitter Java not available, using regex fallback');
    }

    // TODO: Add more Tree-sitter parsers as they become available
    // try {
    //   const cppParser = new TreeSitterCppParser();
    //   parsers.push(cppParser);
    // } catch (error) { ... }

    return parsers;
  }

  /**
   * Main entry point - populate semantic graph for entire project
   */
  async populateSemanticGraph(projectPath: string, projectId: string): Promise<ProjectParsingResult> {
    this.logger.info(`🔄 Starting semantic graph population for project: ${projectPath}`);
    
    const result: ProjectParsingResult = {
      totalFiles: 0,
      successfullyParsed: 0,
      errors: [],
      nodeStats: { files: 0, classes: 0, functions: 0, interfaces: 0 },
      relationshipStats: { imports: 0, inheritance: 0, containment: 0 }
    };

    try {
      // Step 1: Initialize semantic graph connection
      await this.semanticGraph.initialize();
      
      // Step 2: Discover and parse all code files
      const codeFiles = await this.discoverCodeFiles(projectPath);
      result.totalFiles = codeFiles.length;
      
      this.logger.info(`📁 Found ${codeFiles.length} code files to parse`);

      // Step 3: Parse files and extract structure
      const parsedStructures = await this.parseAllFiles(codeFiles, projectPath, result);
      
      // Step 4: Create nodes in Neo4j
      const nodeResults = await this.createAllNodes(parsedStructures, projectId, result);
      
      // Step 5: Create relationships
      await this.createAllRelationships(parsedStructures, nodeResults, projectPath, result);
      
      // Step 6: Post-processing and optimization
      await this.postProcessGraph(projectId);
      
      this.logger.info(`✅ Semantic graph population complete: ${result.successfullyParsed}/${result.totalFiles} files processed`);
      
    } catch (error) {
      this.logger.error(`❌ Semantic graph population failed: ${error.message}`);
      result.errors.push(error.message);
      throw error;
    }

    return result;
  }

  /**
   * Update semantic graph for specific files (incremental updates)
   */
  async updateFilesInGraph(filePaths: string[], projectPath: string, projectId: string): Promise<void> {
    this.logger.info(`🔄 Updating ${filePaths.length} files in semantic graph`);
    
    try {
      // Parse only the changed files
      const parsedStructures: ParsedCodeStructure[] = [];
      
      for (const filePath of filePaths) {
        try {
          const structure = await this.parseFile(filePath, projectPath);
          if (structure) {
            parsedStructures.push(structure);
          }
        } catch (error) {
          this.logger.warn(`Failed to parse updated file ${filePath}: ${error.message}`);
        }
      }

      // TODO: Remove old nodes for these files first
      // await this.removeExistingNodes(filePaths, projectId);

      // Create new nodes and relationships
      const result = this.createEmptyResult();
      const nodeResults = await this.createAllNodes(parsedStructures, projectId, result);
      await this.createAllRelationships(parsedStructures, nodeResults, projectPath, result);
      
      this.logger.info(`✅ Updated ${parsedStructures.length} files in semantic graph`);
      
    } catch (error) {
      this.logger.error(`❌ Failed to update files in semantic graph: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // PRIVATE IMPLEMENTATION METHODS
  // ============================================

  private async discoverCodeFiles(projectPath: string): Promise<string[]> {
    const patterns = [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
      '**/*.py', '**/*.java', '**/*.cpp', '**/*.c',
      '**/*.cs', '**/*.go', '**/*.rs'
    ];

    const codeFiles = await glob(patterns, {
      cwd: projectPath,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**', 
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.test.*',
        '**/*.spec.*'
      ]
    });

    return codeFiles;
  }

  private async parseAllFiles(
    codeFiles: string[], 
    projectPath: string, 
    result: ProjectParsingResult
  ): Promise<ParsedCodeStructure[]> {
    
    const parsedStructures: ParsedCodeStructure[] = [];
    
    for (const filePath of codeFiles) {
      try {
        const structure = await this.parseFile(filePath, projectPath);
        if (structure) {
          parsedStructures.push(structure);
          result.successfullyParsed++;
        }
      } catch (error) {
        result.errors.push(`${filePath}: ${error.message}`);
        this.logger.debug(`Failed to parse ${filePath}: ${error.message}`);
      }
    }

    return parsedStructures;
  }

  private async parseFile(filePath: string, projectPath: string): Promise<ParsedCodeStructure | null> {
    const ext = this.getFileExtension(filePath);
    let parser = this.parsers.get(ext);
    
    // Use generic parser as fallback if no specific parser found
    if (!parser) {
      parser = this.genericParser;
      this.logger.debug(`Using generic parser for ${ext} files: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(projectPath, filePath);
    
    return await parser.parse(content, relativePath);
  }

  private async createAllNodes(
    parsedStructures: ParsedCodeStructure[], 
    projectId: string,
    result: ProjectParsingResult
  ): Promise<Map<string, NodeCreationResult>> {
    
    const nodeResults = new Map<string, NodeCreationResult>();
    
    for (const structure of parsedStructures) {
      try {
        const nodeResult = await this.nodeBuilder.createNodesForFile(structure, projectId);
        nodeResults.set(structure.filePath, nodeResult);
        
        // Update stats
        result.nodeStats.files++;
        result.nodeStats.classes += structure.classes.length;
        result.nodeStats.functions += structure.functions.length;
        result.nodeStats.interfaces += structure.interfaces.length;
        
      } catch (error) {
        this.logger.error(`Failed to create nodes for ${structure.filePath}: ${error.message}`);
        result.errors.push(`Node creation failed for ${structure.filePath}: ${error.message}`);
      }
    }

    return nodeResults;
  }

  private async createAllRelationships(
    parsedStructures: ParsedCodeStructure[],
    nodeResults: Map<string, NodeCreationResult>,
    projectPath: string,
    result: ProjectParsingResult
  ): Promise<void> {
    
    // Build file node lookup map
    const allFileNodes = new Map<string, string>();
    for (const [filePath, nodeResult] of nodeResults) {
      allFileNodes.set(filePath, nodeResult.fileNodeId);
    }

    // Create relationships for each file
    for (const structure of parsedStructures) {
      const nodeResult = nodeResults.get(structure.filePath);
      if (!nodeResult) continue;

      try {
        await this.relationshipBuilder.createRelationshipsForFile(
          structure,
          nodeResult,
          allFileNodes,
          projectPath
        );
        
        // Update relationship stats (simplified)
        result.relationshipStats.imports += structure.imports.length;
        result.relationshipStats.containment += structure.classes.length + structure.functions.length;
        
      } catch (error) {
        this.logger.error(`Failed to create relationships for ${structure.filePath}: ${error.message}`);
        result.errors.push(`Relationship creation failed for ${structure.filePath}: ${error.message}`);
      }
    }
  }

  private async postProcessGraph(projectId: string): Promise<void> {
    try {
      // TODO: Resolve unresolved inheritance relationships
      // TODO: Detect circular dependencies
      // TODO: Calculate complexity metrics
      // TODO: Identify architectural patterns
      
      this.logger.debug('Post-processing completed');
    } catch (error) {
      this.logger.warn(`Post-processing failed: ${error.message}`);
    }
  }

  private getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() || '';
  }

  private createEmptyResult(): ProjectParsingResult {
    return {
      totalFiles: 0,
      successfullyParsed: 0,
      errors: [],
      nodeStats: { files: 0, classes: 0, functions: 0, interfaces: 0 },
      relationshipStats: { imports: 0, inheritance: 0, containment: 0 }
    };
  }
}

export default CodeRelationshipOrchestrator;