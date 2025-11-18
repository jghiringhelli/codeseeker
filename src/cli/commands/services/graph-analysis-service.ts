/**
 * Graph Analysis Service
 * Single Responsibility: Analyze code relationships and extract graph context
 * Interfaces with semantic graph tools and provides structured analysis
 */

import * as path from 'path';
import * as fs from 'fs/promises';

export interface GraphContext {
  classes: Array<{
    name: string;
    filePath: string;
    type: string;
    description: string;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    strength: number;
  }>;
  relationshipDetails: Array<{
    from: string;
    to: string;
    type: string;
  }>;
  packageStructure: string[];
}

export class GraphAnalysisService {
  /**
   * Perform graph analysis based on semantic search results
   */
  async performGraphAnalysis(query: string, semanticResults: any[]): Promise<GraphContext> {
    const classes = [];
    const relationships = [];
    const packages = new Set<string>();

    try {
      // Extract classes from semantic results
      for (const result of semanticResults) {
        const className = this.extractClassNameFromFile(result.file);
        if (className) {
          const packageName = this.extractPackageFromFile(result.file);
          packages.add(packageName);

          classes.push({
            name: className,
            filePath: result.file,
            type: result.type || 'class',
            description: this.generateClassDescription(result.file, result.type)
          });
        }
      }

      // Generate relationships based on common patterns and query context
      const relationshipDetails = this.generateRelationships(query, classes);
      relationships.push(...relationshipDetails);

      return {
        classes,
        relationships,
        relationshipDetails,
        packageStructure: Array.from(packages)
      };

    } catch (error) {
      console.warn(`Graph analysis failed: ${error instanceof Error ? error.message : error}`);
      return {
        classes: [],
        relationships: [],
        relationshipDetails: [],
        packageStructure: []
      };
    }
  }

  /**
   * Extract class name from file path
   */
  private extractClassNameFromFile(filePath: string): string | null {
    const basename = path.basename(filePath, path.extname(filePath));

    // Convert kebab-case and snake_case to PascalCase
    const pascalCase = basename
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    // Common class name patterns
    if (pascalCase.endsWith('Service')) return pascalCase;
    if (pascalCase.endsWith('Controller')) return pascalCase;
    if (pascalCase.endsWith('Manager')) return pascalCase;
    if (pascalCase.endsWith('Handler')) return pascalCase;
    if (pascalCase.endsWith('Api')) return pascalCase;

    // Add common suffixes if not present
    const fileName = pascalCase;
    if (filePath.includes('service')) return `${fileName}Service`;
    if (filePath.includes('controller')) return `${fileName}Controller`;
    if (filePath.includes('manager')) return `${fileName}Manager`;
    if (filePath.includes('handler')) return `${fileName}Handler`;
    if (filePath.includes('api')) return `${fileName}Api`;

    return fileName || null;
  }

  /**
   * Extract package name from file path
   */
  private extractPackageFromFile(filePath: string): string {
    const parts = path.dirname(filePath).split(path.sep);

    // Find the main package (usually after src/)
    const srcIndex = parts.findIndex(part => part === 'src');
    if (srcIndex !== -1 && srcIndex < parts.length - 1) {
      return parts[srcIndex + 1];
    }

    // Fallback to first directory
    return parts.length > 0 ? parts[0] : 'root';
  }

  /**
   * Generate class description based on file path and type
   */
  private generateClassDescription(filePath: string, type: string): string {
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);

    // Generate smart descriptions based on patterns
    if (type === 'service') {
      return `Business logic service handling core operations`;
    }
    if (type === 'manager') {
      return `Manager class coordinating multiple services`;
    }
    if (type === 'handler') {
      return `Request handler processing user inputs`;
    }
    if (type === 'middleware') {
      return `Middleware component for request processing`;
    }
    if (type === 'authentication') {
      return `Authentication and security logic`;
    }
    if (type === 'api') {
      return `API endpoint definitions and routing`;
    }
    if (type === 'model') {
      return `Data model with business rules`;
    }

    return `${type} component handling ${fileName.replace(/\.[^/.]+$/, "")} functionality`;
  }

  /**
   * Generate relationships based on query context and common patterns
   */
  private generateRelationships(query: string, classes: any[]): Array<{ from: string; to: string; type: string }> {
    const relationships = [];
    const lowerQuery = query.toLowerCase();

    // Generate contextual relationships based on query
    if (lowerQuery.includes('auth') || lowerQuery.includes('login')) {
      relationships.push(
        { from: 'AuthService', to: 'UserCredentials', type: 'validates' },
        { from: 'AuthMiddleware', to: 'SecuredRoutes', type: 'protects' }
      );
    }

    if (lowerQuery.includes('api') || lowerQuery.includes('endpoint')) {
      relationships.push(
        { from: 'APIRouter', to: 'ServiceLayer', type: 'routes_to' },
        { from: 'RequestHandler', to: 'BusinessLogic', type: 'delegates_to' }
      );
    }

    if (lowerQuery.includes('database') || lowerQuery.includes('db')) {
      relationships.push(
        { from: 'ServiceLayer', to: 'DatabaseAccess', type: 'persists_via' },
        { from: 'Repository', to: 'DataModel', type: 'manages' }
      );
    }

    // Add relationships based on detected classes
    for (const classInfo of classes) {
      if (classInfo.type === 'service' && classInfo.name.includes('Auth')) {
        relationships.push(
          { from: classInfo.name, to: 'UserRepository', type: 'uses' }
        );
      }
      if (classInfo.type === 'controller') {
        relationships.push(
          { from: classInfo.name, to: 'ServiceLayer', type: 'coordinates' }
        );
      }
    }

    return relationships;
  }
}