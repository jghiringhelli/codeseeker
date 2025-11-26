/**
 * Project Structure Service
 * SOLID Principles: Single Responsibility - Handle project-level analysis only
 */

import * as path from 'path';
import { glob } from 'fast-glob';
import { Logger } from '../../../../../utils/logger';
import { RelationshipType } from '../../semantic-graph/semantic-graph';
import {
  IProjectStructureService,
  IFileParsingService,
  ProjectStructure,
  ParsedFile
} from '../interfaces/index';

export class ProjectStructureService implements IProjectStructureService {
  private logger = Logger.getInstance();

  constructor(private fileParsingService: IFileParsingService) {}

  async parseProjectStructure(projectPath: string): Promise<ProjectStructure> {
    const files: ParsedFile[] = [];

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

    this.logger.info(`📁 Discovered ${codeFiles.length} code files in project`);

    // Parse each file
    for (const filePath of codeFiles) {
      try {
        const relativePath = path.relative(projectPath, filePath);
        const parsedFile = await this.fileParsingService.parseCodeFile(filePath, relativePath);
        files.push(parsedFile);
      } catch (error) {
        this.logger.warn(`Failed to parse ${filePath}: ${error}`);
      }
    }

    // Analyze relationships between files
    const relationships = this.analyzeRelationships(files);

    this.logger.info(`🔗 Extracted ${relationships.length} relationships between files`);

    return { files, relationships };
  }

  analyzeRelationships(files: ParsedFile[]): Array<{
    fromFile: string;
    toFile: string;
    type: RelationshipType;
    metadata: any;
  }> {
    const relationships: Array<{
      fromFile: string;
      toFile: string;
      type: RelationshipType;
      metadata: any;
    }> = [];

    // Extract import relationships
    for (const file of files) {
      for (const importInfo of file.imports) {
        const targetFile = this.resolveImportPath(file.filePath, importInfo.from, files);
        if (targetFile) {
          relationships.push({
            fromFile: file.filePath,
            toFile: targetFile.filePath,
            type: 'IMPORTS' as RelationshipType,
            metadata: {
              importName: importInfo.name,
              importType: 'module'
            }
          });
        }
      }
    }

    // Extract inheritance relationships
    for (const file of files) {
      for (const cls of file.classes) {
        if (cls.extends) {
          const parentFile = this.findClassDefinition(cls.extends, files);
          if (parentFile) {
            relationships.push({
              fromFile: file.filePath,
              toFile: parentFile.filePath,
              type: 'EXTENDS' as RelationshipType,
              metadata: {
                childClass: cls.name,
                parentClass: cls.extends
              }
            });
          }
        }

        // Interface implementations
        for (const interfaceName of cls.implements) {
          const interfaceFile = this.findInterfaceDefinition(interfaceName, files);
          if (interfaceFile) {
            relationships.push({
              fromFile: file.filePath,
              toFile: interfaceFile.filePath,
              type: 'IMPLEMENTS' as RelationshipType,
              metadata: {
                implementingClass: cls.name,
                interface: interfaceName
              }
            });
          }
        }
      }
    }

    // Extract function call relationships
    for (const file of files) {
      // Check function calls in standalone functions
      for (const func of file.functions) {
        for (const calledFunction of func.callsTo) {
          const targetFile = this.findFunctionDefinition(calledFunction, files);
          if (targetFile && targetFile.filePath !== file.filePath) {
            relationships.push({
              fromFile: file.filePath,
              toFile: targetFile.filePath,
              type: 'CALLS' as RelationshipType,
              metadata: {
                caller: func.name,
                callee: calledFunction,
                callType: 'function'
              }
            });
          }
        }
      }

      // Check function calls in class methods
      for (const cls of file.classes) {
        for (const method of cls.methods) {
          for (const calledFunction of method.callsTo) {
            const targetFile = this.findFunctionDefinition(calledFunction, files);
            if (targetFile && targetFile.filePath !== file.filePath) {
              relationships.push({
                fromFile: file.filePath,
                toFile: targetFile.filePath,
                type: 'CALLS' as RelationshipType,
                metadata: {
                  caller: `${cls.name}.${method.name}`,
                  callee: calledFunction,
                  callType: 'method'
                }
              });
            }
          }
        }
      }
    }

    // Extract composition relationships (when a class uses another class as a property)
    for (const file of files) {
      for (const cls of file.classes) {
        for (const property of cls.properties) {
          if (property.type) {
            const typeFile = this.findClassDefinition(property.type, files);
            if (typeFile && typeFile.filePath !== file.filePath) {
              relationships.push({
                fromFile: file.filePath,
                toFile: typeFile.filePath,
                type: 'USES' as RelationshipType,
                metadata: {
                  usingClass: cls.name,
                  usedClass: property.type,
                  property: property.name,
                  relationshipType: 'composition'
                }
              });
            }
          }
        }
      }
    }

    return this.deduplicateRelationships(relationships);
  }

  private resolveImportPath(fromFile: string, importPath: string, files: ParsedFile[]): ParsedFile | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const resolvedPath = path.resolve(fromDir, importPath);

      // Try different extensions
      const possiblePaths = [
        resolvedPath,
        resolvedPath + '.ts',
        resolvedPath + '.js',
        resolvedPath + '/index.ts',
        resolvedPath + '/index.js'
      ];

      for (const possiblePath of possiblePaths) {
        const normalizedPath = path.normalize(possiblePath);
        const targetFile = files.find(f =>
          path.normalize(f.filePath) === normalizedPath ||
          path.normalize(path.resolve(process.cwd(), f.filePath)) === normalizedPath
        );
        if (targetFile) return targetFile;
      }
    }

    // Handle absolute imports from node_modules (skip for now)
    return null;
  }

  private findClassDefinition(className: string, files: ParsedFile[]): ParsedFile | null {
    for (const file of files) {
      if (file.classes.some(cls => cls.name === className)) {
        return file;
      }
    }
    return null;
  }

  private findInterfaceDefinition(interfaceName: string, files: ParsedFile[]): ParsedFile | null {
    for (const file of files) {
      if (file.interfaces.includes(interfaceName)) {
        return file;
      }
    }
    return null;
  }

  private findFunctionDefinition(functionName: string, files: ParsedFile[]): ParsedFile | null {
    for (const file of files) {
      // Check standalone functions
      if (file.functions.some(func => func.name === functionName)) {
        return file;
      }

      // Check exported functions
      if (file.exports.includes(functionName)) {
        return file;
      }

      // Check class methods
      for (const cls of file.classes) {
        if (cls.methods.some(method => method.name === functionName)) {
          return file;
        }
      }
    }
    return null;
  }

  private deduplicateRelationships(relationships: Array<{
    fromFile: string;
    toFile: string;
    type: RelationshipType;
    metadata: any;
  }>): Array<{
    fromFile: string;
    toFile: string;
    type: RelationshipType;
    metadata: any;
  }> {
    const seen = new Set<string>();
    const deduplicated = [];

    for (const rel of relationships) {
      const key = `${rel.fromFile}:${rel.toFile}:${rel.type}:${JSON.stringify(rel.metadata)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(rel);
      }
    }

    return deduplicated;
  }

  /**
   * Analyze architectural patterns in the project structure
   */
  analyzeArchitecturalPatterns(structure: ProjectStructure): {
    patterns: string[];
    layered: boolean;
    modular: boolean;
    suggestions: string[];
  } {
    const patterns: string[] = [];
    const suggestions: string[] = [];

    // Check for layered architecture
    const hasControllers = structure.files.some(f =>
      f.filePath.includes('controller') || f.classes.some(c => c.name.toLowerCase().includes('controller'))
    );
    const hasServices = structure.files.some(f =>
      f.filePath.includes('service') || f.classes.some(c => c.name.toLowerCase().includes('service'))
    );
    const hasRepositories = structure.files.some(f =>
      f.filePath.includes('repository') || f.classes.some(c => c.name.toLowerCase().includes('repository'))
    );

    const layered = hasControllers && hasServices;
    if (layered) {
      patterns.push('Layered Architecture');
    } else {
      suggestions.push('Consider organizing code into layers (controllers, services, repositories)');
    }

    // Check for modular structure
    const directories = [...new Set(structure.files.map(f => path.dirname(f.filePath)))];
    const modular = directories.length > 3 && directories.some(dir => dir.includes('/'));
    if (modular) {
      patterns.push('Modular Architecture');
    } else {
      suggestions.push('Consider organizing related files into modules/directories');
    }

    // Check for dependency injection patterns
    const hasDI = structure.files.some(f =>
      f.functions.some(fn => fn.name.includes('inject')) ||
      f.classes.some(c => c.methods.some(m => m.parameters.length > 2))
    );
    if (hasDI) {
      patterns.push('Dependency Injection');
    }

    return {
      patterns,
      layered,
      modular,
      suggestions
    };
  }
}