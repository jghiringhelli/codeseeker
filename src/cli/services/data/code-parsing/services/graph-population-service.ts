/**
 * Graph Population Service
 * SOLID Principles: Single Responsibility - Handle Neo4j graph population only
 */

import * as path from 'path';
import { Logger } from '../../../../../utils/logger';
import { SemanticGraphService } from '../../semantic-graph/semantic-graph';
import {
  IGraphPopulationService,
  ProjectStructure
} from '../interfaces/index';

export class GraphPopulationService implements IGraphPopulationService {
  private logger = Logger.getInstance();

  constructor(private semanticGraph: SemanticGraphService) {}

  async createGraphNodes(structure: ProjectStructure, projectId: string): Promise<Map<string, string>> {
    const nodeMap = new Map<string, string>();

    this.logger.info(`📊 Creating graph nodes for ${structure.files.length} files`);

    for (const file of structure.files) {
      try {
        // Create file node
        const fileNodeId = await this.semanticGraph.addNode('Code', {
          name: path.basename(file.filePath),
          path: file.filePath,
          language: file.language,
          project_id: projectId,
          node_type: 'file',
          exports: file.exports,
          imports: file.dependencies,
          constants_count: file.constants?.length || 0,
          enums_count: file.enums?.length || 0
        });
        nodeMap.set(file.filePath, fileNodeId);

        // Create detailed class nodes
        for (const classInfo of file.classes) {
          const classNodeId = await this.semanticGraph.addNode('Code', {
            name: classInfo.name,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            node_type: 'class',
            parent_file: file.filePath,
            extends: classInfo.extends,
            implements: classInfo.implements,
            methods_count: classInfo.methods.length,
            properties_count: classInfo.properties.length,
            start_line: classInfo.startLine,
            end_line: classInfo.endLine
          });
          nodeMap.set(`${file.filePath}:class:${classInfo.name}`, classNodeId);

          // Link class to file
          await this.semanticGraph.addRelationship(fileNodeId, classNodeId, 'DEFINES');

          // Create method nodes
          for (const method of classInfo.methods) {
            const methodNodeId = await this.semanticGraph.addNode('Code', {
              name: method.name,
              path: file.filePath,
              language: file.language,
              project_id: projectId,
              node_type: 'method',
              parent_class: classInfo.name,
              parent_file: file.filePath,
              visibility: method.visibility,
              is_static: method.isStatic,
              is_async: method.isAsync,
              parameters: method.parameters.map(p => p.name),
              parameter_types: method.parameters.map(p => p.type || 'unknown'),
              return_type: method.returnType,
              complexity: method.complexity,
              start_line: method.startLine,
              end_line: method.endLine,
              calls_to: method.callsTo
            });
            nodeMap.set(`${file.filePath}:method:${classInfo.name}:${method.name}`, methodNodeId);

            // Link method to class
            await this.semanticGraph.addRelationship(classNodeId, methodNodeId, 'CONTAINS');
          }

          // Create property nodes
          for (const property of classInfo.properties) {
            const propertyNodeId = await this.semanticGraph.addNode('Code', {
              name: property.name,
              path: file.filePath,
              language: file.language,
              project_id: projectId,
              node_type: 'property',
              parent_class: classInfo.name,
              parent_file: file.filePath,
              visibility: property.visibility,
              type: property.type || 'unknown'
            });
            nodeMap.set(`${file.filePath}:property:${classInfo.name}:${property.name}`, propertyNodeId);

            // Link property to class
            await this.semanticGraph.addRelationship(classNodeId, propertyNodeId, 'CONTAINS');
          }
        }

        // Create detailed function nodes
        for (const functionInfo of file.functions) {
          const functionNodeId = await this.semanticGraph.addNode('Code', {
            name: functionInfo.name,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            node_type: 'function',
            parent_file: file.filePath,
            is_async: functionInfo.isAsync,
            parameters: functionInfo.parameters.map(p => p.name),
            parameter_types: functionInfo.parameters.map(p => p.type || 'unknown'),
            return_type: functionInfo.returnType,
            complexity: functionInfo.complexity,
            start_line: functionInfo.startLine,
            end_line: functionInfo.endLine,
            calls_to: functionInfo.callsTo
          });
          nodeMap.set(`${file.filePath}:function:${functionInfo.name}`, functionNodeId);

          // Link function to file
          await this.semanticGraph.addRelationship(fileNodeId, functionNodeId, 'DEFINES');
        }

        // Create interface nodes
        for (const interfaceName of file.interfaces) {
          const interfaceNodeId = await this.semanticGraph.addNode('Code', {
            name: interfaceName,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            node_type: 'interface',
            parent_file: file.filePath
          });
          nodeMap.set(`${file.filePath}:interface:${interfaceName}`, interfaceNodeId);

          // Link interface to file
          await this.semanticGraph.addRelationship(fileNodeId, interfaceNodeId, 'DEFINES');
        }

        // Create constant nodes
        for (const constant of file.constants) {
          const constantNodeId = await this.semanticGraph.addNode('Code', {
            name: constant.name,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            node_type: 'constant',
            parent_file: file.filePath,
            type: constant.type || 'unknown'
          });
          nodeMap.set(`${file.filePath}:constant:${constant.name}`, constantNodeId);

          // Link constant to file
          await this.semanticGraph.addRelationship(fileNodeId, constantNodeId, 'DEFINES');
        }

        // Create enum nodes
        for (const enumInfo of file.enums) {
          const enumNodeId = await this.semanticGraph.addNode('Code', {
            name: enumInfo.name,
            path: file.filePath,
            language: file.language,
            project_id: projectId,
            node_type: 'enum',
            parent_file: file.filePath,
            values: enumInfo.values
          });
          nodeMap.set(`${file.filePath}:enum:${enumInfo.name}`, enumNodeId);

          // Link enum to file
          await this.semanticGraph.addRelationship(fileNodeId, enumNodeId, 'DEFINES');
        }

      } catch (error) {
        this.logger.error(`Failed to create nodes for ${file.filePath}:`, error);
      }
    }

    this.logger.info(`✅ Created ${nodeMap.size} graph nodes`);
    return nodeMap;
  }

  async createGraphRelationships(
    structure: ProjectStructure,
    nodeIdMap: Map<string, string>,
    projectId: string
  ): Promise<void> {
    this.logger.info(`🔗 Creating ${structure.relationships.length} graph relationships`);

    for (const relationship of structure.relationships) {
      try {
        const fromNodeId = nodeIdMap.get(relationship.fromFile);
        const toNodeId = nodeIdMap.get(relationship.toFile);

        if (fromNodeId && toNodeId) {
          await this.semanticGraph.addRelationship(
            fromNodeId,
            toNodeId,
            relationship.type,
            {
              ...relationship.metadata,
              project_id: projectId,
              relationship_source: 'code_analysis'
            }
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to create relationship ${relationship.fromFile} -> ${relationship.toFile}:`, error);
      }
    }

    // Create inheritance relationships
    await this.createInheritanceRelationships(structure, nodeIdMap);

    // Create method call relationships
    await this.createMethodCallRelationships(structure, nodeIdMap);

    // Create property type relationships
    await this.createPropertyTypeRelationships(structure, nodeIdMap);

    this.logger.info('✅ Created all graph relationships');
  }

  async extractBusinessConcepts(structure: ProjectStructure, projectId: string): Promise<void> {
    this.logger.info('🧠 Extracting business concepts from code structure');

    const businessConcepts = new Set<string>();
    const domainTerms = new Map<string, number>();

    // Extract business terms from class names, method names, etc.
    for (const file of structure.files) {
      // Analyze class names
      for (const cls of file.classes) {
        const businessTerms = this.extractBusinessTermsFromName(cls.name);
        businessTerms.forEach(term => {
          businessConcepts.add(term);
          domainTerms.set(term, (domainTerms.get(term) || 0) + 1);
        });
      }

      // Analyze method names
      for (const cls of file.classes) {
        for (const method of cls.methods) {
          const businessTerms = this.extractBusinessTermsFromName(method.name);
          businessTerms.forEach(term => {
            businessConcepts.add(term);
            domainTerms.set(term, (domainTerms.get(term) || 0) + 1);
          });
        }
      }

      // Analyze function names
      for (const func of file.functions) {
        const businessTerms = this.extractBusinessTermsFromName(func.name);
        businessTerms.forEach(term => {
          businessConcepts.add(term);
          domainTerms.set(term, (domainTerms.get(term) || 0) + 1);
        });
      }
    }

    // Create business concept nodes for frequently mentioned terms
    const significantTerms = Array.from(domainTerms.entries())
      .filter(([term, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    for (const [term, count] of significantTerms) {
      try {
        await this.semanticGraph.addNode('BusinessConcept', {
          name: term,
          project_id: projectId,
          frequency: count,
          source: 'code_analysis'
        });
      } catch (error) {
        this.logger.warn(`Failed to create business concept for '${term}':`, error);
      }
    }

    this.logger.info(`🎯 Extracted ${significantTerms.length} business concepts`);
  }

  private async createInheritanceRelationships(
    structure: ProjectStructure,
    nodeIdMap: Map<string, string>
  ): Promise<void> {
    for (const file of structure.files) {
      for (const cls of file.classes) {
        if (cls.extends) {
          const childNodeKey = `${file.filePath}:class:${cls.name}`;
          const childNodeId = nodeIdMap.get(childNodeKey);

          // Find parent class across all files
          for (const parentFile of structure.files) {
            const parentClass = parentFile.classes.find(c => c.name === cls.extends);
            if (parentClass) {
              const parentNodeKey = `${parentFile.filePath}:class:${parentClass.name}`;
              const parentNodeId = nodeIdMap.get(parentNodeKey);

              if (childNodeId && parentNodeId) {
                await this.semanticGraph.addRelationship(childNodeId, parentNodeId, 'EXTENDS');
              }
              break;
            }
          }
        }

        // Interface implementations
        for (const interfaceName of cls.implements) {
          const classNodeKey = `${file.filePath}:class:${cls.name}`;
          const classNodeId = nodeIdMap.get(classNodeKey);

          // Find interface across all files
          for (const interfaceFile of structure.files) {
            if (interfaceFile.interfaces.includes(interfaceName)) {
              const interfaceNodeKey = `${interfaceFile.filePath}:interface:${interfaceName}`;
              const interfaceNodeId = nodeIdMap.get(interfaceNodeKey);

              if (classNodeId && interfaceNodeId) {
                await this.semanticGraph.addRelationship(classNodeId, interfaceNodeId, 'IMPLEMENTS');
              }
              break;
            }
          }
        }
      }
    }
  }

  private async createMethodCallRelationships(
    structure: ProjectStructure,
    nodeIdMap: Map<string, string>
  ): Promise<void> {
    for (const file of structure.files) {
      // Handle class method calls
      for (const cls of file.classes) {
        for (const method of cls.methods) {
          const methodNodeKey = `${file.filePath}:method:${cls.name}:${method.name}`;
          const methodNodeId = nodeIdMap.get(methodNodeKey);

          for (const calledFunction of method.callsTo) {
            // Find called function/method across all files
            const targetNodeId = this.findFunctionNodeId(calledFunction, structure, nodeIdMap);
            if (methodNodeId && targetNodeId && methodNodeId !== targetNodeId) {
              await this.semanticGraph.addRelationship(methodNodeId, targetNodeId, 'CALLS');
            }
          }
        }
      }

      // Handle standalone function calls
      for (const func of file.functions) {
        const functionNodeKey = `${file.filePath}:function:${func.name}`;
        const functionNodeId = nodeIdMap.get(functionNodeKey);

        for (const calledFunction of func.callsTo) {
          const targetNodeId = this.findFunctionNodeId(calledFunction, structure, nodeIdMap);
          if (functionNodeId && targetNodeId && functionNodeId !== targetNodeId) {
            await this.semanticGraph.addRelationship(functionNodeId, targetNodeId, 'CALLS');
          }
        }
      }
    }
  }

  private async createPropertyTypeRelationships(
    structure: ProjectStructure,
    nodeIdMap: Map<string, string>
  ): Promise<void> {
    for (const file of structure.files) {
      for (const cls of file.classes) {
        for (const property of cls.properties) {
          if (property.type) {
            const propertyNodeKey = `${file.filePath}:property:${cls.name}:${property.name}`;
            const propertyNodeId = nodeIdMap.get(propertyNodeKey);

            // Find type definition across all files
            const typeNodeId = this.findTypeNodeId(property.type, structure, nodeIdMap);
            if (propertyNodeId && typeNodeId) {
              await this.semanticGraph.addRelationship(propertyNodeId, typeNodeId, 'USES');
            }
          }
        }
      }
    }
  }

  private findFunctionNodeId(
    functionName: string,
    structure: ProjectStructure,
    nodeIdMap: Map<string, string>
  ): string | null {
    for (const file of structure.files) {
      // Check standalone functions
      const func = file.functions.find(f => f.name === functionName);
      if (func) {
        const nodeKey = `${file.filePath}:function:${functionName}`;
        return nodeIdMap.get(nodeKey) || null;
      }

      // Check class methods
      for (const cls of file.classes) {
        const method = cls.methods.find(m => m.name === functionName);
        if (method) {
          const nodeKey = `${file.filePath}:method:${cls.name}:${functionName}`;
          return nodeIdMap.get(nodeKey) || null;
        }
      }
    }

    return null;
  }

  private findTypeNodeId(
    typeName: string,
    structure: ProjectStructure,
    nodeIdMap: Map<string, string>
  ): string | null {
    for (const file of structure.files) {
      // Check classes
      const cls = file.classes.find(c => c.name === typeName);
      if (cls) {
        const nodeKey = `${file.filePath}:class:${typeName}`;
        return nodeIdMap.get(nodeKey) || null;
      }

      // Check interfaces
      if (file.interfaces.includes(typeName)) {
        const nodeKey = `${file.filePath}:interface:${typeName}`;
        return nodeIdMap.get(nodeKey) || null;
      }

      // Check enums
      const enumInfo = file.enums.find(e => e.name === typeName);
      if (enumInfo) {
        const nodeKey = `${file.filePath}:enum:${typeName}`;
        return nodeIdMap.get(nodeKey) || null;
      }
    }

    return null;
  }

  private extractBusinessTermsFromName(name: string): string[] {
    // Convert camelCase/PascalCase to individual words
    const words = name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/[^a-zA-Z]+/)
      .filter(word => word.length > 2)
      .map(word => word.toLowerCase());

    // Filter out common programming terms
    const programmingTerms = new Set([
      'class', 'interface', 'function', 'method', 'property', 'variable',
      'get', 'set', 'create', 'update', 'delete', 'find', 'list',
      'handler', 'service', 'controller', 'manager', 'helper', 'util',
      'config', 'setting', 'option', 'param', 'result', 'response',
      'request', 'data', 'info', 'item', 'object', 'entity', 'model'
    ]);

    return words.filter(word => !programmingTerms.has(word));
  }
}