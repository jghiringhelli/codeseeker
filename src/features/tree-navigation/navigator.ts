import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { ASTAnalyzer, Dependency } from '../../shared/ast/analyzer';
import { Logger } from '../../utils/logger';
import { AnalysisTool, ToolResult } from '../../shared/tool-interface';
import * as readline from 'readline';

export interface TreeNavigationRequest {
  projectPath: string;
  filePattern?: string;
  showDependencies?: boolean;
  circularOnly?: boolean;
  maxDepth?: number;
  includeExternal?: boolean;
}

export interface DependencyTree {
  root: TreeNode;
  nodes: Map<string, TreeNode>;
  edges: DependencyEdge[];
  circularDependencies: CircularDependency[];
  clusters: ModuleCluster[];
  statistics: TreeStatistics;
}

export interface TreeNode {
  id: string;
  path: string;
  name: string;
  type: NodeType;
  language: string;
  size: number;
  complexity: number;
  children: TreeNode[];
  parents: TreeNode[];
  metadata: NodeMetadata;
  position?: {
    x: number;
    y: number;
    depth: number;
  };
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: DependencyType;
  weight: number;
  line?: number;
  isExternal: boolean;
}

export interface CircularDependency {
  path: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestions: string[];
}

export interface ModuleCluster {
  id: string;
  name: string;
  nodes: string[];
  cohesion: number;
  coupling: number;
  description: string;
}

export interface TreeStatistics {
  totalNodes: number;
  totalEdges: number;
  maxDepth: number;
  averageDependencies: number;
  circularDependencyCount: number;
  externalDependencyCount: number;
  clustersCount: number;
  semanticClusters: Record<string, string[]>;
  similarityMappings: Array<{nodeId: string, similarTo: string, similarity: number}>;
}

export interface NodeMetadata {
  exports: string[];
  imports: string[];
  lastModified: Date;
  linesOfCode: number;
  maintainabilityIndex: number;
  isEntryPoint: boolean;
  isLeaf: boolean;
  semanticKeywords: string[];
  similarNodes: string[];
  businessDomain: string;
  architecturalRole: string;
}

export enum NodeType {
  FILE = 'file',
  MODULE = 'module',
  PACKAGE = 'package',
  EXTERNAL = 'external',
  VIRTUAL = 'virtual'
}

export enum DependencyType {
  IMPORT = 'import',
  EXPORT = 'export',
  DYNAMIC_IMPORT = 'dynamic_import',
  TYPE_ONLY = 'type_only',
  INHERITANCE = 'inheritance',
  COMPOSITION = 'composition'
}

interface NavigationState {
  currentNode: TreeNode;
  history: TreeNode[];
  selectedNodes: Set<string>;
  filters: NavigationFilters;
}

interface NavigationFilters {
  showExternal: boolean;
  showTypes: NodeType[];
  maxDepth: number;
  languageFilter?: string;
}

export class TreeNavigator extends AnalysisTool {
  // Tool metadata for auto-discovery and bundling
  id = 'tree-navigator';
  name = 'Enhanced Tree Navigator';
  description = 'Tree navigation with semantic analysis for deep code understanding';
  version = '2.0.0';
  category = 'analysis';
  languages = ['javascript', 'typescript', 'python', 'go', 'rust', 'java'];
  frameworks = ['any'];
  purposes = ['dependency-analysis', 'semantic-analysis', 'code-navigation'];
  intents = ['navigate', 'explore', 'structure', 'dependencies', 'tree'];
  keywords = ['tree', 'navigate', 'structure', 'dependencies', 'explore', 'files'];
  
  // Performance characteristics
  override performanceImpact: 'low' | 'medium' | 'high' = 'low';
  override tokenUsage: 'minimal' | 'low' | 'medium' | 'high' | 'variable' = 'variable';
  
  // Capabilities
  override capabilities = {
    'semanticClustering': true,
    'similarityDetection': true,
    'interactiveMode': true,
    'dependencyTracking': true,
    'circularDependencyDetection': true
  };

  private logger = Logger?.getInstance();
  private astAnalyzer = new ASTAnalyzer();
  private rl?: readline.Interface;

  // ============================================
  // ENHANCED TOOL INTERFACE IMPLEMENTATION
  // ============================================

  /**
   * Database tool name for API calls
   */
  getDatabaseToolName(): string {
    return 'tree-navigation';
  }

  /**
   * Perform the actual tree navigation analysis
   */
  async performAnalysis(projectPath: string, projectId: string, parameters: any): Promise<any> {
    const request: TreeNavigationRequest = {
      projectPath,
      includeExternal: parameters.includeImpactAnalysis || parameters.includeExternal || false,
      showDependencies: parameters.trackChangePropagation || parameters.showDependencies || true,
      filePattern: parameters.filePattern,
      circularOnly: parameters.circularOnly || false,
      maxDepth: parameters.maxDepth || 10
    };

    // Use file context if available to focus analysis
    if (parameters.fileContext) {
      this.logger?.info(`[TreeNavigator] Using file context: ${parameters.fileContext.discoveredFiles?.length || 0} files`);
    }
    
    this.logger?.info(`[TreeNavigator] Starting analysis for project: ${projectPath}`);
    
    const tree = await this.buildDependencyTree(request, parameters.fileContext);
    const analysis = {
      nodeCount: tree.nodes?.size || 0,
      depth: this.calculateNodeDepth(tree.root || tree.nodes?.values().next().value),
      dependencies: tree.edges?.length || 0
    };
    
    // Convert tree data to database format
    const dbData = this.convertTreeToDbFormat(tree, projectPath);
    
    return {
      data: dbData,
      analysis: {
        tree,
        ...analysis,
        summary: this.generateSummary(tree, analysis),
        metrics: this.calculateMetrics(tree)
      }
    };
  }

  /**
   * Check if tool is applicable to the project
   */
  override isApplicable(projectPath: string, context: any): boolean {
    // Check if project has supported file types
    const supportedExtensions = ['.js', '.ts', '.py', '.go', '.rs', '.java'];
    return context.projectFiles?.some((file: string) => 
      supportedExtensions.some(ext => file.endsWith(ext))
    ) ?? true;
  }

  /**
   * Generate recommendations from tree analysis
   */
  override getRecommendations(analysisResult: any): string[] {
    const recommendations: string[] = [];
    const { tree, analysis } = analysisResult.analysis || {};
    
    if (tree?.circularDependencies?.length > 0) {
      recommendations.push(`Found ${tree.circularDependencies.length} circular dependencies that should be resolved`);
    }
    
    if (analysis?.deeplyNestedFiles?.length > 0) {
      recommendations.push('Consider refactoring deeply nested file structures for better maintainability');
    }
    
    if (tree?.statistics?.averageComplexity > 15) {
      recommendations.push('High average complexity detected - consider breaking down complex modules');
    }
    
    return recommendations;
  }

  // ============================================
  // UTILITY METHODS FOR DATABASE INTEGRATION
  // ============================================

  /**
   * Convert tree structure to database format
   */
  private convertTreeToDbFormat(tree: DependencyTree, projectPath: string): any[] {
    const dbData: any[] = [];
    
    // Convert nodes to database format
    tree.nodes.forEach((node, path) => {
      dbData.push({
        file_path: path,
        node_type: this.mapNodeTypeToDb(node.type),
        node_name: node.name,
        parent_path: node.parents[0]?.path || null,
        depth: node.position?.depth || 0,
        children_count: node.children.length,
        metadata: {
          language: node.language,
          size: node.size,
          type: node.type
        },
        relationships: node.children.map(child => ({
          type: 'child',
          target: child.path
        })),
        complexity_score: node.complexity,
        last_modified: new Date()
      });
    });
    
    return dbData;
  }

  /**
   * Map internal node types to database enum values
   */
  private mapNodeTypeToDb(nodeType: NodeType): string {
    const mapping: Record<NodeType, string> = {
      [NodeType.FILE]: 'file',
      [NodeType.MODULE]: 'module',
      [NodeType.PACKAGE]: 'package',
      [NodeType.EXTERNAL]: 'external',
      [NodeType.VIRTUAL]: 'virtual'
    };
    return mapping[nodeType] || 'file';
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(tree: DependencyTree, analysis: any): string {
    return `Analyzed ${tree.nodes.size} nodes with ${tree.edges.length} dependencies. ` +
           `Found ${tree.circularDependencies.length} circular dependencies and ${tree.clusters.length} clusters.`;
  }

  /**
   * Calculate tree metrics
   */
  private calculateMetrics(tree: DependencyTree): any {
    return {
      totalNodes: tree.nodes.size,
      totalEdges: tree.edges.length,
      circularDependencies: tree.circularDependencies.length,
      clusters: tree.clusters.length,
      averageDependencies: tree.statistics.averageDependencies,
      maxDepth: tree.statistics.maxDepth
    };
  }

  // ============================================
  // EXISTING FUNCTIONALITY (PRESERVED)
  // ============================================

  // Alias for backward compatibility
  override async analyze(params: any): Promise<any> {
    // Use the enhanced analyze method from parent class
    return super.analyze(params.projectPath || '.', params.projectId || 'unknown', params);
  }

  // Legacy method for existing code compatibility
  async buildDependencyTree(request: TreeNavigationRequest, fileContext?: any): Promise<DependencyTree> {
    return this.buildTree(request, fileContext);
  }


  async buildTree(request: TreeNavigationRequest, fileContext?: any): Promise<DependencyTree> {
    this.logger.info(`Building dependency tree for ${request.projectPath}`);

    const nodes = new Map<string, TreeNode>();
    const edges: DependencyEdge[] = [];

    // Get project files - use file context if available
    let files: string[];
    if (fileContext?.discoveredFiles?.length > 0) {
      // Use discovered files from semantic search and graph analysis
      files = fileContext.discoveredFiles.map((f: any) => f.filePath || f);
      this.logger.info(`Using ${files.length} files from context discovery`);
    } else {
      // Fallback to full project scan
      files = await this?.getProjectFiles(request.projectPath, request.filePattern);
      this.logger.info(`Scanning all project files: ${files.length} found`);
    }
    
    // Create nodes for each file
    for (const file of files) {
      const filePath = path?.join(request.projectPath, file);
      const node = await this?.createFileNode(filePath, request.projectPath);
      nodes?.set(node.id, node);
    }

    // Analyze dependencies and create edges
    for (const [nodeId, node] of nodes) {
      try {
        const astResult = await this.astAnalyzer?.analyzeFile(path?.join(request.projectPath, node.path));
        
        for (const dep of astResult.dependencies) {
          const edge = await this?.createDependencyEdge(dep, node, nodes, request);
          if (edge) {
            edges?.push(edge);
          }
        }

        // Update node metadata
        node.metadata.imports = astResult.dependencies?.filter(d => d?.type === 'import').map(d => d.target);
        node.metadata.exports = astResult.symbols?.filter(s => s.isExported).map(s => s.name);
      } catch (error) {
        this.logger.warn(`Failed to analyze dependencies for ${node.path}`, error);
      }
    }

    // Build tree structure
    this?.buildTreeStructure(nodes, edges);

    // Detect circular dependencies
    const circularDependencies = this?.detectCircularDependencies(nodes, edges);

    // Create clusters
    const clusters = this?.createModuleClusters(nodes, edges);

    // Calculate statistics
    const statistics = this?.calculateTreeStatistics(nodes, edges, circularDependencies);

    // Find or create root node
    const root = this?.findRootNode(nodes) || this?.createVirtualRoot(nodes);

    const tree: DependencyTree = {
      root,
      nodes,
      edges: request.circularOnly ? 
        edges?.filter(edge => this?.isPartOfCircularDependency(edge, circularDependencies)) : 
        edges,
      circularDependencies,
      clusters,
      statistics
    };

    this.logger.info(`Dependency tree built: ${statistics.totalNodes} nodes, ${statistics.totalEdges} edges, ${statistics.circularDependencyCount} circular dependencies`);

    return tree;
  }

  private async getProjectFiles(projectPath: string, pattern?: string): Promise<string[]> {
    const defaultPattern = '**/*.{ts,tsx,js,jsx,py,go,rs,java}';
    const excludes = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**'
    ];

    return await glob(pattern || defaultPattern, {
      cwd: projectPath,
      ignore: excludes,
      onlyFiles: true
    });
  }

  private async createFileNode(filePath: string, projectRoot: string): Promise<TreeNode> {
    const stats = await fs?.stat(filePath);
    const relativePath = path?.relative(projectRoot, filePath);
    const name = path?.basename(filePath);
    const language = this?.detectLanguage(filePath);

    let linesOfCode = 0;
    let complexity = 1;

    try {
      const astResult = await this.astAnalyzer?.analyzeFile(filePath);
      linesOfCode = astResult.complexity.linesOfCode;
      complexity = astResult.complexity.cyclomaticComplexity;
    } catch (error) {
      // Use file size as fallback
      linesOfCode = Math.ceil(stats?.size / 50); // Rough estimate
    }

    const node: TreeNode = {
      id: this?.generateNodeId(relativePath),
      path: relativePath,
      name,
      type: NodeType.FILE,
      language,
      size: stats.size,
      complexity,
      children: [],
      parents: [],
      metadata: {
        exports: [],
        imports: [],
        lastModified: stats.mtime,
        linesOfCode,
        maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity),
        isEntryPoint: this?.isEntryPoint(name),
        isLeaf: false, // Will be determined later
        semanticKeywords: [],
        similarNodes: [],
        businessDomain: 'unknown',
        architecturalRole: 'unknown'
      }
    };

    return node;
  }

  private detectLanguage(filePath: string): string {
    const ext = path?.extname(filePath);
    const mapping: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java'
    };
    
    return mapping[ext] || 'unknown';
  }

  private generateNodeId(relativePath: string): string {
    return relativePath?.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private isEntryPoint(fileName: string): boolean {
    const entryPointNames = ['index', 'main', 'app', 'server', 'cli'];
    const baseName = path?.parse(fileName).name?.toLowerCase();
    return entryPointNames?.includes(baseName);
  }

  private async createDependencyEdge(
    dep: Dependency,
    sourceNode: TreeNode,
    nodes: Map<string, TreeNode>,
    request: TreeNavigationRequest
  ): Promise<DependencyEdge | null> {
    let targetPath: string;
    let isExternal = dep.isExternal || false;

    if (dep.isExternal) {
      if (!request.includeExternal) return null;
      
      // Create virtual node for external dependency
      const externalNodeId = `external_${dep.target?.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (!nodes?.has(externalNodeId)) {
        const externalNode: TreeNode = {
          id: externalNodeId,
          path: dep.target,
          name: dep.target,
          type: NodeType.EXTERNAL,
          language: 'external',
          size: 0,
          complexity: 0,
          children: [],
          parents: [],
          metadata: {
            exports: [],
            imports: [],
            lastModified: new Date(),
            linesOfCode: 0,
            maintainabilityIndex: 100,
            isEntryPoint: false,
            isLeaf: true,
            semanticKeywords: [],
            similarNodes: [],
            businessDomain: 'external',
            architecturalRole: 'dependency'
          }
        };
        nodes?.set(externalNodeId, externalNode);
      }
      targetPath = externalNodeId;
    } else {
      // Resolve relative import path
      targetPath = this?.resolveImportPath(dep.target, sourceNode.path, request.projectPath);
      if (!targetPath || !nodes?.has(this?.generateNodeId(targetPath))) {
        return null;
      }
      targetPath = this?.generateNodeId(targetPath);
    }

    return {
      from: sourceNode.id,
      to: targetPath,
      type: this?.mapDependencyType(dep.type),
      weight: this?.calculateEdgeWeight(dep, sourceNode),
      line: dep.line,
      isExternal
    };
  }

  private resolveImportPath(importPath: string, sourceFile: string, projectRoot: string): string | null {
    if (importPath?.startsWith('.')) {
      // Relative import
      const sourceDir = path?.dirname(sourceFile);
      const resolved = path?.resolve(sourceDir, importPath);
      const relativePath = path?.relative(projectRoot, resolved);
      
      // Try common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py'];
      for (const ext of extensions) {
        const withExt = relativePath + ext;
        try {
          if (fs?.access(path?.join(projectRoot, withExt))) {
            return withExt;
          }
        } catch {
          // File doesn't exist, continue
        }
      }
      
      // Try index files
      for (const ext of extensions) {
        const indexFile = path?.join(relativePath, `index${ext}`);
        try {
          if (fs?.access(path?.join(projectRoot, indexFile))) {
            return indexFile;
          }
        } catch {
          // File doesn't exist, continue
        }
      }
    }
    
    return null;
  }

  private mapDependencyType(depType: string): DependencyType {
    const mapping: Record<string, DependencyType> = {
      'import': DependencyType.IMPORT,
      'export': DependencyType.EXPORT,
      'call': DependencyType.COMPOSITION,
      'inheritance': DependencyType.INHERITANCE,
      'composition': DependencyType.COMPOSITION
    };
    
    return mapping[depType] || DependencyType.IMPORT;
  }

  private calculateEdgeWeight(dep: Dependency, sourceNode: TreeNode): number {
    let weight = 1;
    
    // Higher weight for exports (they create stronger coupling)
    if (dep?.type === 'export') weight += 2;
    
    // Higher weight for internal dependencies
    if (!dep.isExternal) weight += 1;
    
    // Consider the source node complexity
    if (sourceNode.complexity > 10) weight += 1;
    
    return weight;
  }

  private buildTreeStructure(nodes: Map<string, TreeNode>, edges: DependencyEdge[]): void {
    // Clear existing relationships
    for (const node of nodes?.values()) {
      node.children = [];
      node.parents = [];
    }

    // Build relationships based on edges
    for (const edge of edges) {
      const fromNode = nodes?.get(edge.from);
      const toNode = nodes?.get(edge.to);
      
      if (fromNode && toNode) {
        fromNode.children?.push(toNode);
        toNode.parents?.push(fromNode);
      }
    }

    // Mark leaf nodes
    for (const node of nodes?.values()) {
      node.metadata.isLeaf = node.children?.length === 0;
    }
  }

  private detectCircularDependencies(
    nodes: Map<string, TreeNode>,
    edges: DependencyEdge[]
  ): CircularDependency[] {
    const circularDependencies: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack?.has(nodeId)) {
        // Found a cycle
        const cycleStart = path?.indexOf(nodeId);
        const cyclePath = path?.slice(cycleStart);
        cyclePath?.push(nodeId); // Close the cycle

        const cycle: CircularDependency = {
          path: cyclePath,
          severity: this?.calculateCycleSeverity(cyclePath, nodes),
          description: this?.generateCycleDescription(cyclePath, nodes),
          suggestions: this?.generateCycleSuggestions(cyclePath, nodes, edges)
        };

        circularDependencies?.push(cycle);
        return;
      }

      if (visited?.has(nodeId)) return;

      visited?.add(nodeId);
      recursionStack?.add(nodeId);
      path?.push(nodeId);

      // Visit all children
      const children = edges
        .filter(edge => edge?.from === nodeId)
        .map(edge => edge.to);

      for (const childId of children) {
        dfs(childId, [...path]);
      }

      recursionStack?.delete(nodeId);
      path?.pop();
    };

    // Start DFS from each node
    for (const nodeId of nodes?.keys()) {
      if (!visited?.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return this?.deduplicateCycles(circularDependencies);
  }

  private calculateCycleSeverity(
    cyclePath: string[],
    nodes: Map<string, TreeNode>
  ): 'low' | 'medium' | 'high' | 'critical' {
    let complexity = 0;
    let size = 0;

    for (const nodeId of cyclePath) {
      const node = nodes?.get(nodeId);
      if (node) {
        complexity += node.complexity;
        size += node.size;
      }
    }

    if (cyclePath?.length > 5 || complexity > 50 || size > 10000) {
      return 'critical';
    } else if (cyclePath?.length > 3 || complexity > 20 || size > 5000) {
      return 'high';
    } else if (cyclePath?.length > 2 || complexity > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private generateCycleDescription(cyclePath: string[], nodes: Map<string, TreeNode>): string {
    const fileNames = cyclePath?.map(nodeId => {
      const node = nodes?.get(nodeId);
      return node ? node.name : nodeId;
    });

    return `Circular dependency involving ${cyclePath?.length} files: ${fileNames?.join(' → ')}`;
  }

  private generateCycleSuggestions(
    cyclePath: string[],
    nodes: Map<string, TreeNode>,
    edges: DependencyEdge[]
  ): string[] {
    const suggestions: string[] = [];

    suggestions?.push('Consider extracting shared functionality into a separate module');
    suggestions?.push('Use dependency injection to break direct dependencies');
    
    if (cyclePath?.length === 2) {
      suggestions?.push('Merge the two files if they are tightly coupled');
    }
    
    suggestions?.push('Apply the Dependency Inversion Principle');
    suggestions?.push('Consider using events or observers to decouple components');

    return suggestions;
  }

  private deduplicateCycles(cycles: CircularDependency[]): CircularDependency[] {
    const unique = new Map<string, CircularDependency>();

    for (const cycle of cycles) {
      // Create a canonical representation of the cycle
      const sortedPath = [...cycle.path].sort();
      const key = sortedPath?.join('->');
      
      if (!unique?.has(key) || unique?.get(key)!.severity < cycle.severity) {
        unique?.set(key, cycle);
      }
    }

    return Array.from(unique?.values());
  }

  private createModuleClusters(
    nodes: Map<string, TreeNode>,
    edges: DependencyEdge[]
  ): ModuleCluster[] {
    const clusters: ModuleCluster[] = [];
    
    // Simple clustering based on directory structure
    const directoryClusters = new Map<string, string[]>();
    
    for (const node of nodes?.values()) {
      if (node?.type === NodeType.FILE) {
        const dir = path?.dirname(node.path);
        if (!directoryClusters?.has(dir)) {
          directoryClusters?.set(dir, []);
        }
        directoryClusters?.get(dir)!.push(node.id);
      }
    }

    for (const [dirPath, nodeIds] of directoryClusters) {
      if (nodeIds?.length > 1) {
        const cohesion = this?.calculateCohesion(nodeIds, edges);
        const coupling = this?.calculateCoupling(nodeIds, edges);

        clusters?.push({
          id: `cluster_${dirPath?.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: dirPath || 'root',
          nodes: nodeIds,
          cohesion,
          coupling,
          description: `Module cluster for ${dirPath} directory with ${nodeIds?.length} files`
        });
      }
    }

    return clusters;
  }

  private calculateCohesion(nodeIds: string[], edges: DependencyEdge[]): number {
    const internalEdges = edges?.filter(edge => 
      nodeIds?.includes(edge.from) && nodeIds?.includes(edge.to)
    );
    
    const maxPossibleEdges = nodeIds?.length * (nodeIds?.length - 1);
    return maxPossibleEdges > 0 ? internalEdges?.length / maxPossibleEdges : 0;
  }

  private calculateCoupling(nodeIds: string[], edges: DependencyEdge[]): number {
    const externalEdges = edges?.filter(edge => 
      (nodeIds?.includes(edge.from) && !nodeIds?.includes(edge.to)) ||
      (!nodeIds?.includes(edge.from) && nodeIds?.includes(edge.to))
    );
    
    return externalEdges?.length / nodeIds?.length;
  }

  private calculateTreeStatistics(
    nodes: Map<string, TreeNode>,
    edges: DependencyEdge[],
    circularDependencies: CircularDependency[]
  ): TreeStatistics {
    const depths = Array.from(nodes?.values()).map(node => this?.calculateNodeDepth(node));
    const maxDepth = Math.max(...depths, 0);
    const externalEdges = edges?.filter(edge => edge.isExternal);

    return {
      totalNodes: nodes.size,
      totalEdges: edges?.length,
      maxDepth,
      averageDependencies: nodes.size > 0 ? edges?.length / nodes.size : 0,
      circularDependencyCount: circularDependencies?.length,
      externalDependencyCount: externalEdges?.length,
      clustersCount: 0, // Will be set after clusters are created
      semanticClusters: {},
      similarityMappings: []
    };
  }

  private calculateNodeDepth(node: TreeNode): number {
    const visited = new Set<string>();
    
    const dfs = (currentNode: TreeNode): number => {
      if (visited?.has(currentNode.id)) return 0;
      visited?.add(currentNode.id);
      
      if (currentNode.parents?.length === 0) return 0;
      
      const parentDepths = currentNode.parents?.map(parent => dfs(parent));
      return Math.max(...parentDepths) + 1;
    };
    
    return dfs(node);
  }

  private findRootNode(nodes: Map<string, TreeNode>): TreeNode | null {
    // Find node with no parents and marked as entry point
    for (const node of nodes?.values()) {
      if (node.parents?.length === 0 && node.metadata.isEntryPoint) {
        return node;
      }
    }

    // Fallback: find any node with no parents
    for (const node of nodes?.values()) {
      if (node.parents?.length === 0) {
        return node;
      }
    }

    return null;
  }

  private createVirtualRoot(nodes: Map<string, TreeNode>): TreeNode {
    const rootNodes = Array.from(nodes?.values()).filter(node => node.parents?.length === 0);
    
    const virtualRoot: TreeNode = {
      id: 'virtual_root',
      path: '/',
      name: 'Project Root',
      type: NodeType.VIRTUAL,
      language: 'virtual',
      size: 0,
      complexity: 0,
      children: rootNodes,
      parents: [],
      metadata: {
        exports: [],
        imports: [],
        lastModified: new Date(),
        linesOfCode: 0,
        maintainabilityIndex: 100,
        isEntryPoint: true,
        isLeaf: false,
        semanticKeywords: [],
        similarNodes: [],
        businessDomain: 'project',
        architecturalRole: 'root'
      }
    };

    // Update root nodes to have virtual root as parent
    for (const rootNode of rootNodes) {
      rootNode.parents = [virtualRoot];
    }

    return virtualRoot;
  }

  private isPartOfCircularDependency(edge: DependencyEdge, cycles: CircularDependency[]): boolean {
    return cycles?.some(cycle => 
      cycle.path?.includes(edge.from) && cycle.path?.includes(edge.to)
    );
  }

  // Interactive navigation methods
  async startInteractiveMode(tree: DependencyTree): Promise<void> {
    this.rl = readline?.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const state: NavigationState = {
      currentNode: tree.root,
      history: [],
      selectedNodes: new Set(),
      filters: {
        showExternal: false,
        showTypes: [NodeType.FILE, NodeType.MODULE],
        maxDepth: 10
      }
    };

    console?.log('\n🌲 Interactive Tree Navigation Mode');
    console?.log('─'.repeat(50));
    this?.printCommands();

    await this?.navigationLoop(tree, state);
    
    this.rl?.close();
  }

  private async navigationLoop(tree: DependencyTree, state: NavigationState): Promise<void> {
    while (true) {
      this?.printCurrentNode(state.currentNode, state);
      
      const answer = await this?.prompt('> ');
      const [command, ...args] = answer?.trim().split(' ');

      try {
        const shouldContinue = await this?.executeCommand(command, args, tree, state);
        if (!shouldContinue) break;
      } catch (error) {
        console?.log(`Error: ${error.message}`);
      }
    }
  }

  private printCommands(): void {
    console?.log(`
Commands:
  ls                    - List children of current node
  cd <node>            - Navigate to node
  parent               - Go to parent node
  back                 - Go back in history
  info                 - Show detailed node information
  deps                 - Show dependencies
  cycles               - Show circular dependencies
  cluster              - Show cluster information
  find <name>          - Find nodes by name
  filter <type>        - Filter by node type
  select <node>        - Select/deselect node for comparison
  compare              - Compare selected nodes
  tree [depth]         - Print tree structure
  stats                - Show tree statistics
  help                 - Show this help
  exit                 - Exit interactive mode
`);
  }

  private printCurrentNode(node: TreeNode, state: NavigationState): void {
    console?.log(`\n📍 Current: ${node.name} (${node.type})`);
    console?.log(`   Path: ${node.path}`);
    console?.log(`   Language: ${node.language}`);
    console?.log(`   Complexity: ${node.complexity}`);
    console?.log(`   Children: ${node.children?.length}`);
    console?.log(`   Parents: ${node.parents?.length}`);
    
    if (state.selectedNodes.size > 0) {
      console?.log(`   Selected: ${Array.from(state.selectedNodes).join(', ')}`);
    }
  }

  private async executeCommand(
    command: string,
    args: string[],
    tree: DependencyTree,
    state: NavigationState
  ): Promise<boolean> {
    switch (command) {
      case 'ls':
        this?.listChildren(state.currentNode, state.filters);
        return true;

      case 'cd':
        if (args?.length === 0) {
          console?.log('Usage: cd <node_name_or_number>');
          return true;
        }
        this?.navigateTo(args[0], tree, state);
        return true;

      case 'parent':
        this?.navigateToParent(state);
        return true;

      case 'back':
        this?.navigateBack(state);
        return true;

      case 'info':
        this?.showDetailedInfo(state.currentNode);
        return true;

      case 'deps':
        this?.showDependencies(state.currentNode, tree);
        return true;

      case 'cycles':
        this?.showCircularDependencies(tree.circularDependencies);
        return true;

      case 'tree':
        const depth = args?.length > 0 ? parseInt(args[0]) : 3;
        this?.printTree(tree, depth);
        return true;

      case 'stats':
        this?.showStatistics(tree.statistics);
        return true;

      case 'help':
        this?.printCommands();
        return true;

      case 'exit':
        return false;

      default:
        console?.log(`Unknown command: ${command}. Type 'help' for available commands.`);
        return true;
    }
  }

  private listChildren(node: TreeNode, filters: NavigationFilters): void {
    const filteredChildren = node.children?.filter(child => 
      filters.showTypes?.includes(child.type) &&
      (filters.showExternal || child?.type !== NodeType.EXTERNAL) &&
      (!filters.languageFilter || child?.language === filters.languageFilter)
    );

    if (filteredChildren?.length === 0) {
      console?.log('No children found with current filters.');
      return;
    }

    console?.log('\nChildren:');
    filteredChildren?.forEach((child, index) => {
      const icon = this?.getNodeIcon(child.type);
      console?.log(`  ${index + 1}. ${icon} ${child.name} (${child.type}, ${child.language})`);
    });
  }

  private getNodeIcon(type: NodeType): string {
    const icons = {
      [NodeType.FILE]: '📄',
      [NodeType.MODULE]: '📦',
      [NodeType.PACKAGE]: '🗂️',
      [NodeType.EXTERNAL]: '🌐',
      [NodeType.VIRTUAL]: '⭐'
    };
    return icons[type] || '📄';
  }

  private navigateTo(target: string, tree: DependencyTree, state: NavigationState): void {
    let targetNode: TreeNode | undefined;

    // Try to parse as number (index in children list)
    const index = parseInt(target);
    if (!isNaN(index) && index > 0 && index <= state.currentNode.children?.length) {
      targetNode = state.currentNode.children[index - 1];
    } else {
      // Search by name
      targetNode = state.currentNode.children?.find(child => 
        child.name?.toLowerCase().includes(target?.toLowerCase())
      );
      
      if (!targetNode) {
        // Search in all nodes
        targetNode = Array.from(tree.nodes?.values()).find(node =>
          node.name?.toLowerCase().includes(target?.toLowerCase())
        );
      }
    }

    if (targetNode) {
      state.history?.push(state.currentNode);
      state.currentNode = targetNode;
      console?.log(`✅ Navigated to ${targetNode.name}`);
    } else {
      console?.log(`❌ Node not found: ${target}`);
    }
  }

  private navigateToParent(state: NavigationState): void {
    if (state.currentNode.parents?.length === 0) {
      console?.log('❌ Current node has no parent');
      return;
    }

    if (state.currentNode.parents?.length === 1) {
      state.history?.push(state.currentNode);
      state.currentNode = state.currentNode.parents[0];
      console?.log(`✅ Navigated to parent: ${state.currentNode.name}`);
    } else {
      console?.log('Multiple parents available:');
      state.currentNode.parents?.forEach((parent, index) => {
        console?.log(`  ${index + 1}. ${parent.name}`);
      });
      // In a full implementation, would prompt for selection
    }
  }

  private navigateBack(state: NavigationState): void {
    if (state.history?.length === 0) {
      console?.log('❌ No history available');
      return;
    }

    state.currentNode = state.history?.pop()!;
    console?.log(`✅ Went back to ${state.currentNode.name}`);
  }

  private showDetailedInfo(node: TreeNode): void {
    console?.log(`\n📊 Detailed Information for ${node.name}`);
    console?.log('─'.repeat(50));
    console?.log(`Type: ${node.type}`);
    console?.log(`Language: ${node.language}`);
    console?.log(`Path: ${node.path}`);
    console?.log(`Size: ${node.size} bytes`);
    console?.log(`Lines of Code: ${node.metadata.linesOfCode}`);
    console?.log(`Complexity: ${node.complexity}`);
    console?.log(`Maintainability Index: ${node.metadata.maintainabilityIndex?.toFixed(2)}`);
    console?.log(`Last Modified: ${node.metadata.lastModified?.toISOString()}`);
    console?.log(`Is Entry Point: ${node.metadata.isEntryPoint}`);
    console?.log(`Is Leaf: ${node.metadata.isLeaf}`);
    console?.log(`Children: ${node.children?.length}`);
    console?.log(`Parents: ${node.parents?.length}`);
    
    if (node.metadata.exports?.length > 0) {
      console?.log(`Exports: ${node.metadata.exports?.join(', ')}`);
    }
    
    if (node.metadata.imports?.length > 0) {
      console?.log(`Imports: ${node.metadata.imports?.slice(0, 5).join(', ')}${node.metadata.imports?.length > 5 ? '...' : ''}`);
    }
  }

  private showDependencies(node: TreeNode, tree: DependencyTree): void {
    const incomingEdges = tree.edges?.filter(edge => edge?.to === node.id);
    const outgoingEdges = tree.edges?.filter(edge => edge?.from === node.id);

    console?.log(`\n🔗 Dependencies for ${node.name}`);
    console?.log('─'.repeat(50));
    
    console?.log(`\nIncoming (${incomingEdges?.length}):`);
    incomingEdges?.forEach(edge => {
      const fromNode = tree.nodes?.get(edge.from);
      console?.log(`  ← ${fromNode?.name || edge.from} (${edge.type})`);
    });

    console?.log(`\nOutgoing (${outgoingEdges?.length}):`);
    outgoingEdges?.forEach(edge => {
      const toNode = tree.nodes?.get(edge.to);
      console?.log(`  → ${toNode?.name || edge.to} (${edge.type})`);
    });
  }

  private showCircularDependencies(cycles: CircularDependency[]): void {
    console?.log('\n⚠️  Circular Dependencies');
    console?.log('─'.repeat(50));
    
    if (cycles?.length === 0) {
      console?.log('✅ No circular dependencies found!');
      return;
    }

    cycles?.forEach((cycle, index) => {
      console?.log(`\n${index + 1}. ${cycle.severity?.toUpperCase()} - ${cycle.description}`);
      console?.log(`   Path: ${cycle.path?.join(' → ')}`);
      
      if (cycle.suggestions?.length > 0) {
        console?.log(`   💡 Suggestions:`);
        cycle.suggestions?.forEach(suggestion => {
          console?.log(`     - ${suggestion}`);
        });
      }
    });
  }

  private showStatistics(stats: TreeStatistics): void {
    console?.log('\n📈 Tree Statistics');
    console?.log('─'.repeat(50));
    console?.log(`Total Nodes: ${stats.totalNodes}`);
    console?.log(`Total Edges: ${stats.totalEdges}`);
    console?.log(`Max Depth: ${stats.maxDepth}`);
    console?.log(`Average Dependencies per Node: ${stats.averageDependencies?.toFixed(2)}`);
    console?.log(`Circular Dependencies: ${stats.circularDependencyCount}`);
    console?.log(`External Dependencies: ${stats.externalDependencyCount}`);
    console?.log(`Module Clusters: ${stats.clustersCount}`);
  }

  // Public method for non-interactive tree printing
  printTree(tree: DependencyTree, maxDepth: number = 5): void {
    console?.log('\n🌲 Project Dependency Tree');
    console?.log('─'.repeat(50));
    this?.printNodeRecursive(tree.root, '', new Set(), 0, maxDepth);
  }

  private printNodeRecursive(
    node: TreeNode,
    prefix: string,
    visited: Set<string>,
    depth: number,
    maxDepth: number
  ): void {
    if (depth > maxDepth || visited?.has(node.id)) {
      if (visited?.has(node.id)) {
        console?.log(`${prefix}↻ ${node.name} (circular reference)`);
      }
      return;
    }

    visited?.add(node.id);
    
    const icon = this?.getNodeIcon(node.type);
    console?.log(`${prefix}${icon} ${node.name} (${node.language})`);

    const childPrefix = prefix + '  ';
    node.children?.forEach(child => {
      this?.printNodeRecursive(child, childPrefix, new Set(visited), depth + 1, maxDepth);
    });
  }

  private prompt(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl!.question(question, resolve);
    });
  }

  // ========== SEMANTIC ANALYSIS EXTENSION ==========
  // Enhanced semantic capabilities for better Claude Code understanding

  /**
   * Enhance tree with semantic analysis - replaces vector search functionality
   */
  async enhanceWithSemanticAnalysis(tree: DependencyTree): Promise<DependencyTree> {
    this.logger.info('🧠 Starting semantic analysis enhancement...');
    
    // Add semantic metadata to nodes
    await this.addSemanticMetadata(tree.nodes);
    
    // Find semantically similar nodes
    const similarityMappings = this.findSemanticSimilarities(tree.nodes);
    
    // Create semantic clusters
    const semanticClusters = this.createSemanticClusters(tree.nodes, similarityMappings);
    
    // Update statistics
    tree.statistics.semanticClusters = this.convertClustersToRecord(semanticClusters);
    tree.statistics.similarityMappings = similarityMappings.map(s => ({
      nodeId: s.from,
      similarTo: s.to,
      similarity: s.similarity
    }));
    
    // Add semantic clusters to existing clusters
    tree.clusters.push(...semanticClusters);
    
    this.logger.info(`✅ Semantic analysis completed: ${semanticClusters.length} semantic clusters, ${similarityMappings.length} similarity mappings`);
    
    return tree;
  }

  /**
   * Add semantic metadata to nodes for business logic understanding
   */
  private async addSemanticMetadata(nodes: Map<string, TreeNode>): Promise<void> {
    for (const node of nodes.values()) {
      if (node.type === NodeType.FILE) {
        try {
          const filePath = node.path;
          const content = await fs.readFile(filePath, 'utf-8');
          
          node.metadata.semanticKeywords = this.extractSemanticKeywords(content, node.name);
          node.metadata.businessDomain = this.identifyBusinessDomain(content, node.path);
          node.metadata.architecturalRole = this.identifyArchitecturalRole(content, node.path);
        } catch (error) {
          this.logger.warn(`Could not enhance node ${node.path} with semantic data:`, error);
        }
      }
    }
  }

  /**
   * Extract semantic keywords from file content
   */
  private extractSemanticKeywords(content: string, filename: string): string[] {
    const keywords = new Set<string>();
    
    // Extract from filename
    const filenameWords = filename.replace(/[^a-zA-Z0-9]/g, ' ').toLowerCase().split(/\s+/);
    filenameWords.forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
    
    // Business logic patterns
    const businessPatterns = [
      /class\s+([A-Z][a-zA-Z0-9]*(?:Service|Manager|Controller|Handler|Repository|Model|Entity))/g,
      /function\s+([a-zA-Z0-9]*(?:create|update|delete|get|find|process|handle|manage|calculate|validate)[A-Za-z0-9]*)/g,
      /(?:export|const)\s+([a-zA-Z0-9]*(?:Schema|Model|Interface|Type)[A-Za-z0-9]*)/g
    ];
    
    businessPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          keywords.add(match[1].toLowerCase());
        }
      }
    });
    
    // Domain-specific keywords
    const domainKeywords = [
      'user', 'customer', 'product', 'order', 'payment', 'invoice', 'report',
      'auth', 'security', 'admin', 'dashboard', 'api', 'database', 'cache',
      'notification', 'email', 'analytics', 'logging', 'monitoring'
    ];
    
    const contentLower = content.toLowerCase();
    domainKeywords.forEach(keyword => {
      if (contentLower.includes(keyword)) {
        keywords.add(keyword);
      }
    });
    
    return Array.from(keywords).slice(0, 10); // Limit to most relevant
  }

  /**
   * Identify business domain from content and path
   */
  private identifyBusinessDomain(content: string, filePath: string): string {
    const pathLower = filePath.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Check path patterns
    if (pathLower.includes('auth') || contentLower.includes('authentication')) return 'authentication';
    if (pathLower.includes('user') || contentLower.includes('user')) return 'user-management';
    if (pathLower.includes('product') || contentLower.includes('product')) return 'product-catalog';
    if (pathLower.includes('order') || contentLower.includes('order')) return 'order-processing';
    if (pathLower.includes('payment') || contentLower.includes('payment')) return 'payment-processing';
    if (pathLower.includes('admin') || contentLower.includes('admin')) return 'administration';
    if (pathLower.includes('api') || pathLower.includes('route')) return 'api-layer';
    if (pathLower.includes('database') || pathLower.includes('model')) return 'data-layer';
    if (pathLower.includes('ui') || pathLower.includes('component')) return 'presentation-layer';
    if (pathLower.includes('service') || contentLower.includes('business logic')) return 'business-logic';
    
    return 'general';
  }

  /**
   * Identify architectural role from content and path
   */
  private identifyArchitecturalRole(content: string, filePath: string): string {
    const pathLower = filePath.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Check for architectural patterns
    if (pathLower.includes('controller') || contentLower.includes('express') || contentLower.includes('router')) return 'controller';
    if (pathLower.includes('service') || contentLower.includes('business')) return 'service';
    if (pathLower.includes('repository') || contentLower.includes('database') || contentLower.includes('query')) return 'repository';
    if (pathLower.includes('model') || contentLower.includes('schema') || contentLower.includes('entity')) return 'model';
    if (pathLower.includes('middleware') || contentLower.includes('middleware')) return 'middleware';
    if (pathLower.includes('util') || pathLower.includes('helper')) return 'utility';
    if (pathLower.includes('config') || contentLower.includes('configuration')) return 'configuration';
    if (pathLower.includes('test') || pathLower.includes('spec')) return 'test';
    if (pathLower.includes('component') && contentLower.includes('react')) return 'ui-component';
    
    return 'unknown';
  }

  /**
   * Find semantic similarities between nodes (replaces vector search)
   */
  private findSemanticSimilarities(nodes: Map<string, TreeNode>): Array<{from: string, to: string, similarity: number}> {
    const similarities: Array<{from: string, to: string, similarity: number}> = [];
    const nodeArray = Array.from(nodes.values());
    
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const nodeA = nodeArray[i];
        const nodeB = nodeArray[j];
        
        const similarity = this.calculateSemanticSimilarity(nodeA, nodeB);
        
        if (similarity > 0.3) { // Threshold for similarity
          similarities.push({
            from: nodeA.id,
            to: nodeB.id,
            similarity
          });
          
          // Add to each node's similar nodes
          nodeA.metadata.similarNodes = nodeA.metadata.similarNodes || [];
          nodeB.metadata.similarNodes = nodeB.metadata.similarNodes || [];
          
          if (!nodeA.metadata.similarNodes.includes(nodeB.id)) {
            nodeA.metadata.similarNodes.push(nodeB.id);
          }
          if (!nodeB.metadata.similarNodes.includes(nodeA.id)) {
            nodeB.metadata.similarNodes.push(nodeA.id);
          }
        }
      }
    }
    
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate semantic similarity between two nodes
   */
  private calculateSemanticSimilarity(nodeA: TreeNode, nodeB: TreeNode): number {
    let similarity = 0;
    
    // Business domain similarity
    if (nodeA.metadata.businessDomain === nodeB.metadata.businessDomain && nodeA.metadata.businessDomain !== 'general') {
      similarity += 0.3;
    }
    
    // Architectural role similarity
    if (nodeA.metadata.architecturalRole === nodeB.metadata.architecturalRole && nodeA.metadata.architecturalRole !== 'unknown') {
      similarity += 0.2;
    }
    
    // Keyword overlap
    const keywordsA = new Set(nodeA.metadata.semanticKeywords);
    const keywordsB = new Set(nodeB.metadata.semanticKeywords);
    const intersection = new Set([...keywordsA].filter(x => keywordsB.has(x)));
    const union = new Set([...keywordsA, ...keywordsB]);
    
    if (union.size > 0) {
      const jaccardIndex = intersection.size / union.size;
      similarity += jaccardIndex * 0.4;
    }
    
    // Path similarity (same directory or similar naming)
    const pathA = nodeA.path.toLowerCase();
    const pathB = nodeB.path.toLowerCase();
    const dirA = path.dirname(pathA);
    const dirB = path.dirname(pathB);
    
    if (dirA === dirB) {
      similarity += 0.1;
    }
    
    return Math.min(similarity, 1.0);
  }

  /**
   * Create semantic clusters based on business domains and architectural roles
   */
  private createSemanticClusters(nodes: Map<string, TreeNode>, similarities: Array<{from: string, to: string, similarity: number}>): ModuleCluster[] {
    const clusters: ModuleCluster[] = [];
    
    // Group by business domain
    const domainGroups = new Map<string, TreeNode[]>();
    for (const node of nodes.values()) {
      if (node.type === NodeType.FILE && node.metadata.businessDomain !== 'general') {
        if (!domainGroups.has(node.metadata.businessDomain)) {
          domainGroups.set(node.metadata.businessDomain, []);
        }
        domainGroups.get(node.metadata.businessDomain)!.push(node);
      }
    }
    
    // Create clusters from domain groups
    for (const [domain, domainNodes] of domainGroups.entries()) {
      if (domainNodes.length >= 2) {
        clusters.push({
          id: `semantic_domain_${domain}`,
          name: `${domain.charAt(0).toUpperCase() + domain.slice(1).replace(/-/g, ' ')} Domain`,
          nodes: domainNodes.map(n => n.id),
          cohesion: this.calculateClusterCohesion(domainNodes, similarities),
          coupling: this.calculateClusterCoupling(domainNodes, nodes, similarities),
          description: `Semantic cluster for ${domain} business domain`
        });
      }
    }
    
    // Group by architectural role
    const roleGroups = new Map<string, TreeNode[]>();
    for (const node of nodes.values()) {
      if (node.type === NodeType.FILE && node.metadata.architecturalRole !== 'unknown') {
        if (!roleGroups.has(node.metadata.architecturalRole)) {
          roleGroups.set(node.metadata.architecturalRole, []);
        }
        roleGroups.get(node.metadata.architecturalRole)!.push(node);
      }
    }
    
    // Create clusters from role groups
    for (const [role, roleNodes] of roleGroups.entries()) {
      if (roleNodes.length >= 3) { // Higher threshold for architectural roles
        clusters.push({
          id: `semantic_role_${role}`,
          name: `${role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, ' ')} Layer`,
          nodes: roleNodes.map(n => n.id),
          cohesion: this.calculateClusterCohesion(roleNodes, similarities),
          coupling: this.calculateClusterCoupling(roleNodes, nodes, similarities),
          description: `Semantic cluster for ${role} architectural role`
        });
      }
    }
    
    return clusters;
  }

  /**
   * Calculate cluster cohesion based on internal similarities
   */
  private calculateClusterCohesion(clusterNodes: TreeNode[], similarities: Array<{from: string, to: string, similarity: number}>): number {
    if (clusterNodes.length < 2) return 0;
    
    const nodeIds = new Set(clusterNodes.map(n => n.id));
    const internalSimilarities = similarities.filter(s => 
      nodeIds.has(s.from) && nodeIds.has(s.to)
    );
    
    if (internalSimilarities.length === 0) return 0;
    
    const avgSimilarity = internalSimilarities.reduce((sum, s) => sum + s.similarity, 0) / internalSimilarities.length;
    return Math.min(avgSimilarity, 1.0);
  }

  /**
   * Calculate cluster coupling based on external similarities
   */
  private calculateClusterCoupling(clusterNodes: TreeNode[], allNodes: Map<string, TreeNode>, similarities: Array<{from: string, to: string, similarity: number}>): number {
    if (clusterNodes.length === 0) return 0;
    
    const nodeIds = new Set(clusterNodes.map(n => n.id));
    const externalSimilarities = similarities.filter(s => 
      (nodeIds.has(s.from) && !nodeIds.has(s.to)) ||
      (!nodeIds.has(s.from) && nodeIds.has(s.to))
    );
    
    if (externalSimilarities.length === 0) return 0;
    
    const avgCoupling = externalSimilarities.reduce((sum, s) => sum + s.similarity, 0) / externalSimilarities.length;
    return Math.min(avgCoupling, 1.0);
  }

  private convertClustersToRecord(clusters: ModuleCluster[]): Record<string, string[]> {
    const record: Record<string, string[]> = {};
    clusters.forEach((cluster, index) => {
      record[`cluster_${index}`] = cluster.nodes;
    });
    return record;
  }
}

export default TreeNavigator;