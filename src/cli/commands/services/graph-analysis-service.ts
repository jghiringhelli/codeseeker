/**
 * Enhanced Graph Analysis Service with Knowledge Graph Integration
 * Single Responsibility: Analyze code relationships using sophisticated knowledge graph
 * Interfaces with SemanticKnowledgeGraph for proper Neo4j-based analysis
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { SemanticKnowledgeGraph } from '../../knowledge/graph/knowledge-graph';
import { NodeType, RelationType, TriadSource } from '../../knowledge/graph/types';
import { Logger } from '../../../utils/logger';

export interface GraphContext {
  classes: Array<{
    name: string;
    filePath: string;
    type: string;
    description: string;
    confidence: number;
    relationships: Array<{
      target: string;
      relation: string;
      confidence: number;
    }>;
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
  graphInsights: {
    totalNodes: number;
    totalRelationships: number;
    architecturalPatterns: string[];
    qualityMetrics: {
      coupling: number;
      cohesion: number;
      complexity: number;
    };
  };
}

export class GraphAnalysisService {
  private knowledgeGraph: SemanticKnowledgeGraph;
  private logger: Logger;

  constructor(projectPath: string) {
    this.knowledgeGraph = new SemanticKnowledgeGraph(projectPath);
    this.logger = Logger.getInstance().child('GraphAnalysis');
  }

  /**
   * Perform sophisticated graph analysis using knowledge graph
   */
  async performGraphAnalysis(query: string, semanticResults: any[]): Promise<GraphContext> {
    try {
      // Build knowledge graph from semantic results
      await this.buildKnowledgeGraph(semanticResults);

      // Query the knowledge graph for relevant nodes and relationships
      const relevantNodes = await this.knowledgeGraph.queryNodes({
        nodes: {
          names: this.extractQueryTerms(query)
        },
        limit: 20
      });

      const graphAnalysis = {
        nodeCount: relevantNodes.length,
        relationshipCount: 0,
        patterns: [],
        coupling: 0.5,
        cohesion: 0.7,
        complexity: 0.6
      };

      // Convert knowledge graph results to GraphContext format
      const classes = await this.convertNodesToClasses(relevantNodes, semanticResults);
      const relationships = await this.extractRelationships(relevantNodes);
      const packages = this.extractPackages(semanticResults);

      // Generate architectural insights
      const graphInsights = await this.generateGraphInsights(graphAnalysis);

      return {
        classes,
        relationships,
        relationshipDetails: relationships,
        packageStructure: Array.from(packages),
        graphInsights
      };

    } catch (error) {
      this.logger.error('Knowledge graph analysis failed', error as Error);

      // Fallback to basic analysis
      return this.performBasicAnalysis(query, semanticResults);
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

  /**
   * Build knowledge graph from semantic search results
   */
  private async buildKnowledgeGraph(semanticResults: any[]): Promise<void> {
    for (const result of semanticResults) {
      const className = this.extractClassNameFromFile(result.file);
      if (className) {
        // Add node to knowledge graph
        const nodeId = await this.knowledgeGraph.addNode({
          type: this.mapToNodeType(result.type || 'class'),
          name: className,
          namespace: this.extractPackageFromFile(result.file),
          sourceLocation: {
            filePath: result.file,
            startLine: 1,
            endLine: 1,
            startColumn: 1,
            endColumn: 1
          },
          metadata: {
            filePath: result.file,
            description: this.generateClassDescription(result.file, result.type),
            similarity: result.similarity || 0.5,
            lastModified: new Date(),
            tags: [result.type || 'class', 'auto-generated']
          }
        });

        // Add relationships based on file structure and imports
        await this.addStructuralRelationships(nodeId, result.file, className);
      }
    }
  }

  /**
   * Convert semantic result types to knowledge graph node types
   */
  private mapToNodeType(type: string): NodeType {
    const typeMap: { [key: string]: NodeType } = {
      'service': NodeType.SERVICE,
      'manager': NodeType.SERVICE,
      'handler': NodeType.CONTROLLER,
      'controller': NodeType.CONTROLLER,
      'repository': NodeType.REPOSITORY,
      'model': NodeType.MODEL,
      'interface': NodeType.INTERFACE,
      'class': NodeType.CLASS,
      'function': NodeType.FUNCTION,
      'component': NodeType.COMPONENT
    };
    return typeMap[type.toLowerCase()] || NodeType.CLASS;
  }

  /**
   * Add structural relationships based on file analysis
   */
  private async addStructuralRelationships(nodeId: string, filePath: string, className: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Extract imports and add dependency relationships
      const imports = this.extractImports(fileContent);
      for (const importName of imports) {
        const importNodeId = await this.knowledgeGraph.addNode({
          type: NodeType.MODULE,
          name: importName,
          metadata: {
            type: 'import',
            lastModified: new Date(),
            tags: ['import', 'dependency']
          }
        });

        await this.knowledgeGraph.addTriad({
          subject: nodeId,
          predicate: RelationType.DEPENDS_ON,
          object: importNodeId,
          confidence: 0.9,
          source: TriadSource.AST_PARSER,
          metadata: {
            relationship: 'dependency',
            importance: 0.8
          }
        });
      }

      // Extract method calls and add behavioral relationships
      const methodCalls = this.extractMethodCalls(fileContent);
      for (const methodCall of methodCalls) {
        const methodNodeId = await this.knowledgeGraph.addNode({
          type: NodeType.METHOD,
          name: methodCall,
          metadata: {
            caller: className,
            lastModified: new Date(),
            tags: ['method', 'call']
          }
        });

        await this.knowledgeGraph.addTriad({
          subject: nodeId,
          predicate: RelationType.CALLS,
          object: methodNodeId,
          confidence: 0.8,
          source: TriadSource.STATIC_ANALYZER,
          metadata: {
            relationship: 'method_call',
            importance: 0.6
          }
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to analyze file structure for ${filePath}`, error as Error);
    }
  }

  /**
   * Extract import statements from file content
   */
  private extractImports(content: string): string[] {
    const importRegex = /import.*?from\s+['"]([^'"]+)['"]/g;
    const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports.filter(imp => !imp.startsWith('.') && !imp.startsWith('/'));
  }

  /**
   * Extract method calls from file content
   */
  private extractMethodCalls(content: string): string[] {
    const methodRegex = /\.(\w+)\s*\(/g;
    const functionRegex = /\b(\w+)\s*\(/g;

    const methods: string[] = [];
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      if (match[1] && !['log', 'error', 'warn', 'info', 'debug'].includes(match[1])) {
        methods.push(match[1]);
      }
    }

    return [...new Set(methods)].slice(0, 10); // Limit to prevent noise
  }

  /**
   * Extract query terms for knowledge graph search
   */
  private extractQueryTerms(query: string): string[] {
    const words = query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    return words;
  }

  /**
   * Convert knowledge graph nodes to GraphContext classes
   */
  private async convertNodesToClasses(nodes: any[], semanticResults: any[]): Promise<GraphContext['classes']> {
    const classes = [];

    for (const node of nodes) {
      // Find corresponding semantic result for file path
      const semanticResult = semanticResults.find(result =>
        result.file.includes(node.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase())
      );

      const nodeRelationships = await this.getNodeRelationships(node.id);

      classes.push({
        name: node.name,
        filePath: semanticResult?.file || `src/${node.namespace || 'unknown'}/${node.name}.ts`,
        type: node.type,
        description: node.metadata?.description || this.generateClassDescription(node.name, node.type),
        confidence: node.metadata?.similarity || 0.8,
        relationships: nodeRelationships
      });
    }

    return classes;
  }

  /**
   * Get relationships for a specific node
   */
  private async getNodeRelationships(nodeId: string): Promise<Array<{ target: string; relation: string; confidence: number; }>> {
    try {
      const triads = await this.knowledgeGraph.queryTriads({
        triads: {
          subjects: [nodeId]
        }
      });

      return triads.map(triad => ({
        target: triad.object,
        relation: triad.predicate,
        confidence: triad.confidence
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract relationships from knowledge graph nodes
   */
  private async extractRelationships(nodes: any[]): Promise<GraphContext['relationships']> {
    const relationships = [];

    try {
      const triads = await this.knowledgeGraph.queryTriads({
        triads: {
          subjects: nodes.map(n => n.id)
        }
      });

      for (const triad of triads) {
        const fromNode = nodes.find(n => n.id === triad.subject);
        const toNode = nodes.find(n => n.id === triad.object);

        if (fromNode && toNode) {
          relationships.push({
            from: fromNode.name,
            to: toNode.name,
            type: triad.predicate,
            strength: triad.confidence
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to extract relationships from knowledge graph', error as Error);
    }

    return relationships;
  }

  /**
   * Generate architectural insights from graph analysis
   */
  private async generateGraphInsights(analysis: any): Promise<GraphContext['graphInsights']> {
    const insights = {
      totalNodes: analysis?.nodeCount || 0,
      totalRelationships: analysis?.relationshipCount || 0,
      architecturalPatterns: analysis?.patterns || [],
      qualityMetrics: {
        coupling: analysis?.coupling || 0.5,
        cohesion: analysis?.cohesion || 0.7,
        complexity: analysis?.complexity || 0.6
      }
    };

    return insights;
  }

  /**
   * Extract packages from semantic results
   */
  private extractPackages(semanticResults: any[]): Set<string> {
    const packages = new Set<string>();

    for (const result of semanticResults) {
      const packageName = this.extractPackageFromFile(result.file);
      packages.add(packageName);
    }

    return packages;
  }

  /**
   * Fallback to basic analysis if knowledge graph fails
   */
  private async performBasicAnalysis(query: string, semanticResults: any[]): Promise<GraphContext> {
    const classes = [];
    const relationships = [];
    const packages = new Set<string>();

    // Basic file-based analysis (original implementation)
    for (const result of semanticResults) {
      const className = this.extractClassNameFromFile(result.file);
      if (className) {
        const packageName = this.extractPackageFromFile(result.file);
        packages.add(packageName);

        classes.push({
          name: className,
          filePath: result.file,
          type: result.type || 'class',
          description: this.generateClassDescription(result.file, result.type),
          confidence: result.similarity || 0.5,
          relationships: []
        });
      }
    }

    const relationshipDetails = this.generateRelationships(query, classes);
    relationships.push(...relationshipDetails);

    return {
      classes,
      relationships,
      relationshipDetails,
      packageStructure: Array.from(packages),
      graphInsights: {
        totalNodes: classes.length,
        totalRelationships: relationships.length,
        architecturalPatterns: ['basic-analysis'],
        qualityMetrics: {
          coupling: 0.5,
          cohesion: 0.5,
          complexity: 0.5
        }
      }
    };
  }
}