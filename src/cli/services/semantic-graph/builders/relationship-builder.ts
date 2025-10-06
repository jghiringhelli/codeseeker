/**
 * Relationship Builder - Single Responsibility: Create Neo4j relationships
 * Follows Single Responsibility and Dependency Inversion principles
 */

import { SemanticGraphService, RelationshipType } from '../../semantic-graph';
import { ParsedCodeStructure, ImportInfo } from '../parsers/ilanguage-parser';
import { NodeCreationResult } from './node-builder';
import { Logger } from '../../../../utils/logger';
import * as path from 'path';

export class RelationshipBuilder {
  private logger = Logger.getInstance();

  constructor(private semanticGraph: SemanticGraphService) {}

  /**
   * Create all relationships for a file's structure
   */
  async createRelationshipsForFile(
    structure: ParsedCodeStructure,
    nodeResult: NodeCreationResult,
    allFileNodes: Map<string, string>,
    projectPath: string
  ): Promise<void> {
    
    try {
      // Create import relationships
      await this.createImportRelationships(structure, nodeResult.fileNodeId, allFileNodes, projectPath);
      
      // Create class inheritance relationships
      await this.createClassRelationships(structure, nodeResult, allFileNodes);
      
      // Create function relationships (methods to classes)
      await this.createFunctionRelationships(structure, nodeResult);
      
      // Create file-to-code element relationships
      await this.createContainmentRelationships(nodeResult);
      
      this.logger.debug(`Created relationships for ${structure.filePath}`);
      
    } catch (error) {
      this.logger.error(`Failed to create relationships for ${structure.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Create import/dependency relationships between files
   */
  private async createImportRelationships(
    structure: ParsedCodeStructure,
    fileNodeId: string,
    allFileNodes: Map<string, string>,
    projectPath: string
  ): Promise<void> {
    
    for (const importInfo of structure.imports) {
      // Resolve import path to actual file
      const resolvedPath = this.resolveImportPath(structure.filePath, importInfo.from, projectPath);
      
      if (resolvedPath && allFileNodes.has(resolvedPath)) {
        const targetNodeId = allFileNodes.get(resolvedPath)!;
        
        await this.semanticGraph.addRelationship(
          fileNodeId,
          targetNodeId,
          'IMPORTS',
          {
            import_name: importInfo.name,
            is_default: importInfo.isDefault || false,
            alias: importInfo.alias,
            from_path: importInfo.from
          }
        );

        // Create stronger dependency relationship for relative imports
        if (importInfo.from.startsWith('./') || importInfo.from.startsWith('../')) {
          await this.semanticGraph.addRelationship(
            fileNodeId,
            targetNodeId,
            'DEPENDS_ON',
            {
              dependency_type: 'file_import',
              strength: 'high'
            }
          );
        }
      }
    }
  }

  /**
   * Create class inheritance and implementation relationships
   */
  private async createClassRelationships(
    structure: ParsedCodeStructure,
    nodeResult: NodeCreationResult,
    allFileNodes: Map<string, string>
  ): Promise<void> {
    
    for (const classInfo of structure.classes) {
      const classNodeId = nodeResult.classNodeIds.get(classInfo.name);
      if (!classNodeId) continue;

      // Create extends relationship
      if (classInfo.extends) {
        await this.createInheritanceRelationship(classInfo.extends, classNodeId, 'EXTENDS', allFileNodes);
      }

      // Create implements relationships
      if (classInfo.implements) {
        for (const interfaceName of classInfo.implements) {
          await this.createInheritanceRelationship(interfaceName, classNodeId, 'IMPLEMENTS', allFileNodes);
        }
      }

      // Create method relationships (class contains methods)
      for (const methodName of classInfo.methods) {
        const methodNodeId = nodeResult.functionNodeIds.get(methodName);
        if (methodNodeId) {
          await this.semanticGraph.addRelationship(
            classNodeId,
            methodNodeId,
            'CONTAINS',
            {
              element_type: 'method'
            }
          );
        }
      }
    }
  }

  /**
   * Create inheritance relationship (extends/implements)
   */
  private async createInheritanceRelationship(
    targetName: string,
    sourceNodeId: string,
    relationshipType: 'EXTENDS' | 'IMPLEMENTS',
    allFileNodes: Map<string, string>
  ): Promise<void> {
    
    // Find target class/interface in current file nodes
    // This is simplified - in reality, we'd need to resolve across files
    try {
      await this.semanticGraph.addRelationship(
        sourceNodeId,
        sourceNodeId, // Placeholder - should resolve to actual target
        relationshipType,
        {
          target_name: targetName,
          resolved: false // Mark as unresolved for post-processing
        }
      );
    } catch (error) {
      this.logger.debug(`Could not resolve ${relationshipType} relationship to ${targetName}`);
    }
  }

  /**
   * Create function-related relationships
   */
  private async createFunctionRelationships(
    structure: ParsedCodeStructure,
    nodeResult: NodeCreationResult
  ): Promise<void> {
    
    // This is where we'd analyze function calls within the code
    // For now, we'll create basic relationships
    
    for (const functionInfo of structure.functions) {
      const functionNodeId = nodeResult.functionNodeIds.get(functionInfo.name);
      if (!functionNodeId) continue;

      // Create relationship to file
      await this.semanticGraph.addRelationship(
        nodeResult.fileNodeId,
        functionNodeId,
        'CONTAINS',
        {
          element_type: 'function',
          is_exported: functionInfo.isExported || false
        }
      );
    }
  }

  /**
   * Create containment relationships (file contains classes, functions, etc.)
   */
  private async createContainmentRelationships(nodeResult: NodeCreationResult): Promise<void> {
    
    // File contains classes
    for (const [className, classNodeId] of nodeResult.classNodeIds) {
      await this.semanticGraph.addRelationship(
        nodeResult.fileNodeId,
        classNodeId,
        'CONTAINS',
        {
          element_type: 'class',
          element_name: className
        }
      );
    }

    // File contains interfaces
    for (const [interfaceName, interfaceNodeId] of nodeResult.interfaceNodeIds) {
      await this.semanticGraph.addRelationship(
        nodeResult.fileNodeId,
        interfaceNodeId,
        'CONTAINS',
        {
          element_type: 'interface',
          element_name: interfaceName
        }
      );
    }
  }

  /**
   * Create business concept relationships
   */
  async createBusinessConceptRelationships(
    conceptNodeId: string,
    relatedCodeNodeIds: string[],
    relatedDocNodeIds: string[] = [],
    relatedTestNodeIds: string[] = []
  ): Promise<void> {
    
    // Concept implemented by code
    for (const codeNodeId of relatedCodeNodeIds) {
      await this.semanticGraph.addRelationship(
        codeNodeId,
        conceptNodeId,
        'IMPLEMENTS',
        {
          relationship_type: 'business_concept'
        }
      );
    }

    // Concept documented by docs
    for (const docNodeId of relatedDocNodeIds) {
      await this.semanticGraph.addRelationship(
        docNodeId,
        conceptNodeId,
        'DESCRIBES',
        {
          relationship_type: 'documentation'
        }
      );
    }

    // Concept tested by tests
    for (const testNodeId of relatedTestNodeIds) {
      await this.semanticGraph.addRelationship(
        testNodeId,
        conceptNodeId,
        'TESTS',
        {
          relationship_type: 'test_coverage'
        }
      );
    }
  }

  /**
   * Create configuration relationships
   */
  async createConfigurationRelationships(
    configNodeId: string,
    affectedFileNodeIds: string[]
  ): Promise<void> {
    
    for (const fileNodeId of affectedFileNodeIds) {
      await this.semanticGraph.addRelationship(
        configNodeId,
        fileNodeId,
        'CONFIGURES',
        {
          relationship_type: 'configuration'
        }
      );
    }
  }

  /**
   * Create test relationships
   */
  async createTestRelationships(
    testNodeId: string,
    testedFileNodeIds: string[]
  ): Promise<void> {
    
    for (const fileNodeId of testedFileNodeIds) {
      await this.semanticGraph.addRelationship(
        testNodeId,
        fileNodeId,
        'TESTS',
        {
          relationship_type: 'test_coverage'
        }
      );
    }
  }

  // ============================================
  // UTILITY METHODS  
  // ============================================

  /**
   * Resolve import path to actual file path
   */
  private resolveImportPath(fromFile: string, importPath: string, projectPath: string): string | null {
    try {
      // Handle relative imports
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const fromDir = path.dirname(fromFile);
        const resolved = path.resolve(fromDir, importPath);
        
        // Try common extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.index.ts', '.index.js'];
        
        for (const ext of extensions) {
          const candidate = resolved + ext;
          if (this.fileExists(candidate)) {
            return candidate;
          }
        }
        
        // Try with index file
        const indexFile = path.join(resolved, 'index.ts');
        if (this.fileExists(indexFile)) {
          return indexFile;
        }
      }
      
      // Handle node_modules imports (external dependencies)
      // These typically don't create file relationships in our graph
      
      return null;
    } catch (error) {
      this.logger.debug(`Failed to resolve import: ${importPath} from ${fromFile}`);
      return null;
    }
  }

  private fileExists(filePath: string): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}