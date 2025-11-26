/**
 * Relationship Analyzer Service
 * Single responsibility: Analyze relationships between parsed files
 */

import { Logger } from '../../../../utils/logger';
import { ParsedFile, ProjectStructure } from './interfaces';
import { RelationshipType } from '../semantic-graph/semantic-graph';

export class RelationshipAnalyzer {
  private logger = Logger.getInstance();

  analyzeRelationships(files: ParsedFile[]): ProjectStructure['relationships'] {
    const relationships: ProjectStructure['relationships'] = [];

    for (const file of files) {
      // Analyze import relationships
      for (const importItem of file.imports) {
        const targetFile = this.resolveImportPath(importItem.from, file.filePath, files);
        if (targetFile) {
          relationships.push({
            fromFile: file.filePath,
            toFile: targetFile.filePath,
            type: 'IMPORTS' as RelationshipType,
            metadata: { importedName: importItem.name }
          });
        }
      }

      // Analyze class inheritance relationships
      for (const cls of file.classes) {
        if (cls.extends) {
          const parentFile = this.findFileContaining(cls.extends, files);
          if (parentFile) {
            relationships.push({
              fromFile: file.filePath,
              toFile: parentFile.filePath,
              type: 'EXTENDS' as RelationshipType,
              metadata: { childClass: cls.name, parentClass: cls.extends }
            });
          }
        }

        // Interface implementations
        for (const interfaceName of cls.implementsInterfaces) {
          const interfaceFile = this.findFileContaining(interfaceName, files);
          if (interfaceFile) {
            relationships.push({
              fromFile: file.filePath,
              toFile: interfaceFile.filePath,
              type: 'IMPLEMENTS' as RelationshipType,
              metadata: { class: cls.name, interface: interfaceName }
            });
          }
        }
      }

      // Analyze function call relationships
      for (const func of file.functions) {
        for (const calledFunction of func.callsTo) {
          const targetFile = this.findFileContaining(calledFunction, files);
          if (targetFile && targetFile.filePath !== file.filePath) {
            relationships.push({
              fromFile: file.filePath,
              toFile: targetFile.filePath,
              type: 'CALLS' as RelationshipType,
              metadata: { caller: func.name, callee: calledFunction }
            });
          }
        }
      }

      // Analyze dependency relationships
      for (const dependency of file.dependencies) {
        relationships.push({
          fromFile: file.filePath,
          toFile: dependency,
          type: 'DEPENDS_ON' as RelationshipType,
          metadata: { dependency }
        });
      }
    }

    return relationships;
  }

  private resolveImportPath(importPath: string, currentFile: string, files: ParsedFile[]): ParsedFile | null {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
      const resolvedPath = this.resolvePath(currentDir, importPath);

      return files.find(f =>
        f.filePath === resolvedPath ||
        f.filePath === resolvedPath + '.ts' ||
        f.filePath === resolvedPath + '.js' ||
        f.filePath === resolvedPath + '/index.ts' ||
        f.filePath === resolvedPath + '/index.js'
      ) || null;
    }

    // Handle absolute imports (node_modules, etc.)
    return files.find(f => f.filePath.includes(importPath)) || null;
  }

  private findFileContaining(symbolName: string, files: ParsedFile[]): ParsedFile | null {
    return files.find(file =>
      file.exports.includes(symbolName) ||
      file.classes.some(cls => cls.name === symbolName) ||
      file.functions.some(func => func.name === symbolName) ||
      file.interfaces.includes(symbolName) ||
      file.constants.some(constant => constant.name === symbolName) ||
      file.enums.some(enumItem => enumItem.name === symbolName)
    ) || null;
  }

  private resolvePath(currentDir: string, relativePath: string): string {
    const parts = currentDir.split('/');
    const relativeParts = relativePath.split('/');

    for (const part of relativeParts) {
      if (part === '.') {
        continue;
      } else if (part === '..') {
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    return parts.join('/');
  }
}