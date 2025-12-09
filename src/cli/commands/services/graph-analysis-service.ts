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
    fromPath?: string;
    toPath?: string;
    fromMethod?: string;  // Method that makes the call
    toMethod?: string;    // Method being called
    line?: number;        // Line number of the call
  }>;
  relationshipDetails: Array<{
    from: string;
    to: string;
    type: string;
    fromPath?: string;
    toPath?: string;
    fromMethod?: string;
    toMethod?: string;
    line?: number;
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
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.knowledgeGraph = new SemanticKnowledgeGraph(projectPath);
    this.logger = Logger.getInstance().child('GraphAnalysis');
  }

  /**
   * Perform sophisticated graph analysis using knowledge graph
   * Falls back to basic analysis if knowledge graph doesn't produce results
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

      // If knowledge graph returns no nodes, fallback to basic analysis
      // This ensures we always have classes to display
      if (relevantNodes.length === 0) {
        this.logger.debug('Knowledge graph returned no nodes, using basic analysis');
        return this.performBasicAnalysis(query, semanticResults);
      }

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

      // If conversion produced no classes, fallback to basic analysis
      if (classes.length === 0) {
        this.logger.debug('Knowledge graph conversion produced no classes, using basic analysis');
        return this.performBasicAnalysis(query, semanticResults);
      }

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
   * Generate relationships based on actual class structure
   * Note: This no longer uses hardcoded keyword detection.
   * Relationships are derived from actual class types detected in the codebase.
   */
  private generateRelationships(query: string, classes: any[]): Array<{ from: string; to: string; type: string }> {
    const relationships: Array<{ from: string; to: string; type: string }> = [];

    // Generate relationships based on actual detected class types
    // Group classes by type
    const services = classes.filter(c => c.type === 'service');
    const controllers = classes.filter(c => c.type === 'controller' || c.type === 'handler');
    const repositories = classes.filter(c => c.type === 'repository');
    const models = classes.filter(c => c.type === 'model');

    // Create relationships based on common architectural patterns
    // Controller -> Service relationships
    for (const controller of controllers) {
      for (const service of services) {
        // Check if they might be related by name similarity
        const controllerBase = controller.name.replace(/Controller|Handler/gi, '');
        const serviceBase = service.name.replace(/Service/gi, '');
        if (controllerBase.toLowerCase().includes(serviceBase.toLowerCase()) ||
            serviceBase.toLowerCase().includes(controllerBase.toLowerCase())) {
          relationships.push({
            from: controller.name,
            to: service.name,
            type: 'uses'
          });
        }
      }
    }

    // Service -> Repository relationships
    for (const service of services) {
      for (const repository of repositories) {
        const serviceBase = service.name.replace(/Service/gi, '');
        const repoBase = repository.name.replace(/Repository/gi, '');
        if (serviceBase.toLowerCase().includes(repoBase.toLowerCase()) ||
            repoBase.toLowerCase().includes(serviceBase.toLowerCase())) {
          relationships.push({
            from: service.name,
            to: repository.name,
            type: 'uses'
          });
        }
      }
    }

    // Repository -> Model relationships
    for (const repository of repositories) {
      for (const model of models) {
        const repoBase = repository.name.replace(/Repository/gi, '');
        if (repoBase.toLowerCase().includes(model.name.toLowerCase()) ||
            model.name.toLowerCase().includes(repoBase.toLowerCase())) {
          relationships.push({
            from: repository.name,
            to: model.name,
            type: 'manages'
          });
        }
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
        // Extract actual line numbers from file content
        const sourceLocation = await this.extractSourceLocation(result.file, className);

        // Add node to knowledge graph
        const nodeId = await this.knowledgeGraph.addNode({
          type: this.mapToNodeType(result.type || 'class'),
          name: className,
          namespace: this.extractPackageFromFile(result.file),
          sourceLocation,
          metadata: {
            filePath: result.file,
            startLine: sourceLocation.startLine,
            endLine: sourceLocation.endLine,
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
      // Resolve full path - filePath may be relative
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.projectPath, filePath);
      const fileContent = await fs.readFile(fullPath, 'utf-8');

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
            importance: 0.8,
            fromName: className,
            toName: importName
          }
        });
      }

      // Extract method calls with caller context and add behavioral relationships
      const methodCallsWithContext = this.extractMethodCallsWithContext(fileContent, className);
      for (const callInfo of methodCallsWithContext) {
        const methodNodeId = await this.knowledgeGraph.addNode({
          type: NodeType.METHOD,
          name: callInfo.calledMethod,
          metadata: {
            caller: className,
            callerMethod: callInfo.callerMethod,
            targetClass: callInfo.targetClass,
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
            importance: 0.6,
            fromName: className,
            fromMethod: callInfo.callerMethod,
            toName: callInfo.targetClass || callInfo.calledMethod,
            toMethod: callInfo.calledMethod,
            line: callInfo.line
          }
        });
      }
    } catch (error) {
      // Use debug level - file not found is expected for non-code files
      this.logger.debug(`Failed to analyze file structure for ${filePath}`);
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
   * Extract source location (file path and line numbers) for a class/function
   */
  private async extractSourceLocation(filePath: string, entityName: string): Promise<{
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  }> {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.projectPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Patterns to find class/function/interface definitions
      const patterns = [
        new RegExp(`^\\s*(export\\s+)?(class|interface|type|enum)\\s+${entityName}\\b`, 'i'),
        new RegExp(`^\\s*(export\\s+)?(async\\s+)?function\\s+${entityName}\\b`, 'i'),
        new RegExp(`^\\s*(export\\s+)?(const|let|var)\\s+${entityName}\\s*=`, 'i'),
        // Also try kebab-to-pascal matching
        new RegExp(`^\\s*(export\\s+)?(class|interface)\\s+\\w*${entityName.replace(/([A-Z])/g, '.*$1')}\\w*\\b`, 'i')
      ];

      let startLine = 1;
      let endLine = 1;

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of patterns) {
          if (pattern.test(lines[i])) {
            startLine = i + 1; // 1-indexed

            // Find the end of the class/function (look for closing brace at same indent level)
            const indent = lines[i].match(/^(\s*)/)?.[1]?.length || 0;
            endLine = startLine;

            // Count braces to find the end
            let braceCount = 0;
            let foundFirstBrace = false;
            for (let j = i; j < lines.length; j++) {
              const line = lines[j];
              for (const char of line) {
                if (char === '{') {
                  braceCount++;
                  foundFirstBrace = true;
                } else if (char === '}') {
                  braceCount--;
                }
              }
              if (foundFirstBrace && braceCount === 0) {
                endLine = j + 1;
                break;
              }
            }
            if (endLine === startLine) {
              endLine = Math.min(startLine + 50, lines.length); // Default span
            }

            return { filePath, startLine, endLine };
          }
        }
      }

      // If no match found, return file start
      return { filePath, startLine: 1, endLine: Math.min(50, lines.length) };
    } catch (error) {
      return { filePath, startLine: 1, endLine: 1 };
    }
  }

  /**
   * Extract method calls from file content (simple version for backward compatibility)
   */
  private extractMethodCalls(content: string): string[] {
    const methodRegex = /\.(\w+)\s*\(/g;

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
   * Extract method calls with full context (caller method, target class, line number)
   */
  private extractMethodCallsWithContext(content: string, className: string): Array<{
    callerMethod: string;
    calledMethod: string;
    targetClass?: string;
    line: number;
  }> {
    const lines = content.split('\n');
    const calls: Array<{
      callerMethod: string;
      calledMethod: string;
      targetClass?: string;
      line: number;
    }> = [];

    let currentMethod = 'constructor';
    const methodDefRegex = /^\s*(?:async\s+)?(?:private\s+|public\s+|protected\s+)?(\w+)\s*\([^)]*\)\s*[:{]/;
    const methodCallRegex = /(?:this\.(\w+)|(\w+))\.(\w+)\s*\(/g;
    const ignoreMethods = ['log', 'error', 'warn', 'info', 'debug', 'toString', 'valueOf', 'hasOwnProperty'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track which method we're inside
      const methodMatch = line.match(methodDefRegex);
      if (methodMatch && methodMatch[1]) {
        currentMethod = methodMatch[1];
      }

      // Find method calls in this line
      let callMatch;
      while ((callMatch = methodCallRegex.exec(line)) !== null) {
        const targetClass = callMatch[1] ? className : callMatch[2]; // this.x or SomeClass.x
        const calledMethod = callMatch[3];

        if (calledMethod && !ignoreMethods.includes(calledMethod)) {
          calls.push({
            callerMethod: currentMethod,
            calledMethod,
            targetClass: targetClass !== 'this' ? targetClass : className,
            line: i + 1
          });
        }
      }
    }

    // Deduplicate and limit
    const seen = new Set<string>();
    return calls.filter(c => {
      const key = `${c.callerMethod}->${c.targetClass}.${c.calledMethod}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 15);
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
      // Skip nodes without names
      if (!node.name) continue;

      // Find corresponding semantic result for file path
      const semanticResult = semanticResults.find(result =>
        result.file && node.name &&
        result.file.toLowerCase().includes(node.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase())
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
    const relationships: GraphContext['relationships'] = [];

    try {
      const triads = await this.knowledgeGraph.queryTriads({
        triads: {
          subjects: nodes.map(n => n.id)
        }
      });

      for (const triad of triads) {
        const fromNode = nodes.find(n => n.id === triad.subject);
        const toNode = nodes.find(n => n.id === triad.object);

        // Get actual names from nodes, or from triad metadata
        const fromName = fromNode?.name ||
          triad.metadata?.fromName ||
          this.extractNameFromMetadata(triad.subject);
        const toName = toNode?.name ||
          triad.metadata?.toName ||
          this.extractNameFromMetadata(triad.object);

        // Get file paths from nodes or metadata
        const fromPath = fromNode?.metadata?.filePath ||
          triad.metadata?.fromPath ||
          fromNode?.sourceLocation?.filePath;
        const toPath = toNode?.metadata?.filePath ||
          triad.metadata?.toPath ||
          toNode?.sourceLocation?.filePath;

        // Get method names from triad metadata (for method-level relationships)
        const fromMethod = triad.metadata?.fromMethod;
        const toMethod = triad.metadata?.toMethod;
        const line = triad.metadata?.line;

        // Only include relationships with valid names
        if (fromName && toName) {
          relationships.push({
            from: fromName,
            to: toName,
            type: triad.predicate,
            strength: triad.confidence,
            fromPath,
            toPath,
            fromMethod,
            toMethod,
            line
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to extract relationships from knowledge graph', error as Error);
    }

    // Also add relationships detected from semantic results (class-based)
    const classBasedRels = this.extractClassBasedRelationships(nodes);
    relationships.push(...classBasedRels);

    return relationships;
  }

  /**
   * Extract class-based relationships from nodes (using actual class names)
   */
  private extractClassBasedRelationships(nodes: any[]): GraphContext['relationships'] {
    const relationships: GraphContext['relationships'] = [];

    for (const node of nodes) {
      if (!node.name) continue;

      const nodePath = node.metadata?.filePath || node.sourceLocation?.filePath;

      // Get relationships stored in node metadata
      const nodeRels = node.metadata?.relationships || node.relationships || [];
      for (const rel of nodeRels) {
        if (rel.target && rel.relation) {
          relationships.push({
            from: node.name,
            to: rel.target,
            type: rel.relation,
            strength: rel.confidence || 0.8,
            fromPath: nodePath,
            toPath: rel.targetPath
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Extract a human-readable name from node ID or metadata
   */
  private extractNameFromMetadata(nodeIdOrName: string): string | undefined {
    if (!nodeIdOrName) return undefined;

    // If it looks like an actual name (has uppercase or is a known pattern), use it
    if (/[A-Z]/.test(nodeIdOrName) && !nodeIdOrName.includes('_')) {
      return nodeIdOrName;
    }

    // Node IDs are typically like "class_xyz123" - extract more context if possible
    const parts = nodeIdOrName.split('_');
    if (parts.length >= 2) {
      // Try to create a meaningful name from the parts
      const type = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      return type;
    }

    return nodeIdOrName;
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