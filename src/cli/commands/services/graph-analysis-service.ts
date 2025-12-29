/**
 * Graph Analysis Service - Queries Persisted Knowledge Graph
 * Single Responsibility: Query existing knowledge graph to find relationships between semantic search results
 *
 * Strategy: "Seed + Expand"
 * 1. Take top N files from semantic search (seeds)
 * 2. Look up corresponding ENTITY nodes in graph by filePath
 * 3. Get direct relationships between seed nodes
 * 4. Optionally expand 1-hop to include important dependencies
 *
 * Storage Mode Support:
 * - Embedded mode: Uses Graphology graph store (no Docker required)
 * - Server mode: Uses Neo4j (for production)
 */

import * as path from 'path';
import { DatabaseConnections } from '../../../config/database-config';
import { Logger } from '../../../utils/logger';
import { getStorageManager, isUsingEmbeddedStorage } from '../../../storage';
import type { IGraphStore, GraphNode, GraphEdge } from '../../../storage/interfaces';

export interface GraphContext {
  classes: Array<{
    name: string;
    filePath: string;
    type: string;
    description: string;
    confidence: number;
    startLine?: number;
    endLine?: number;
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
    fromMethod?: string;
    toMethod?: string;
    line?: number;
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

interface Neo4jEntity {
  id: string;
  name: string;
  type: string;
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
}


export class GraphAnalysisService {
  private dbConnections: DatabaseConnections;
  private logger: Logger;
  private projectPath: string;
  private projectId?: string;
  private graphStore?: IGraphStore;
  private useEmbedded: boolean = false;

  constructor(projectPath: string, projectId?: string) {
    this.projectPath = projectPath;
    this.projectId = projectId;
    this.dbConnections = new DatabaseConnections();
    this.logger = Logger.getInstance().child('GraphAnalysis');
    this.useEmbedded = isUsingEmbeddedStorage();
  }

  /**
   * Initialize the graph store (for embedded mode)
   */
  private async initializeGraphStore(): Promise<IGraphStore | undefined> {
    if (!this.useEmbedded) return undefined;

    if (!this.graphStore) {
      const storageManager = await getStorageManager();
      this.graphStore = storageManager.getGraphStore();
    }
    return this.graphStore;
  }

  /**
   * Set project ID for scoped queries
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Main entry point: Perform graph analysis using persisted Neo4j graph
   * Uses "Seed + Expand" strategy
   */
  async performGraphAnalysis(_query: string, semanticResults: any[]): Promise<GraphContext> {
    try {
      // Resolve project ID if not set
      if (!this.projectId) {
        this.projectId = await this.resolveProjectId();
      }

      if (!this.projectId) {
        this.logger.debug('No project ID available, using basic analysis');
        return this.createBasicAnalysis(semanticResults);
      }

      // Step 1: Look up seed nodes from semantic search results
      const seedNodes = await this.lookupNodesFromFiles(semanticResults);

      if (seedNodes.length === 0) {
        this.logger.debug('No nodes found in graph for search results, using basic analysis');
        return this.createBasicAnalysis(semanticResults);
      }

      // Step 2: Get relationships BETWEEN seed nodes (most relevant)
      const directRelationships = await this.getRelationshipsBetweenNodes(seedNodes);

      // Step 3: One-hop expansion - get important neighbors
      const { expandedNodes, expandedRelationships } = await this.expandOneHop(seedNodes, {
        maxPerNode: 3,
        relationshipTypes: ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'USES']
      });

      // Combine results
      const allClasses = this.convertToClasses(seedNodes, semanticResults, expandedNodes);
      const allRelationships = [...directRelationships, ...expandedRelationships];

      // Extract packages
      const packages = this.extractPackages([...seedNodes, ...expandedNodes]);

      // Calculate insights
      const graphInsights = this.calculateInsights(allClasses, allRelationships);

      return {
        classes: allClasses,
        relationships: allRelationships,
        relationshipDetails: allRelationships,
        packageStructure: packages,
        graphInsights
      };

    } catch (error) {
      this.logger.debug(`Graph analysis failed: ${error instanceof Error ? error.message : error}`);
      return this.createBasicAnalysis(semanticResults);
    }
  }

  /**
   * Resolve project ID from database by project path
   * Uses storage abstraction - embedded mode uses SQLite project store, server mode uses Neo4j
   */
  private async resolveProjectId(): Promise<string | undefined> {
    try {
      // Embedded mode: Use project store
      if (this.useEmbedded) {
        const storageManager = await getStorageManager();
        const projectStore = storageManager.getProjectStore();
        const project = await projectStore.findByPath(this.projectPath);
        if (project) {
          return project.id;
        }
        return undefined;
      }

      // Server mode: Use Neo4j
      const driver = await this.dbConnections.getNeo4jConnection();
      const session = driver.session();

      try {
        // Try :Project label first (current schema)
        let result = await session.run(`
          MATCH (p:Project)
          WHERE p.path CONTAINS $pathPart
          RETURN p.id as id
          LIMIT 1
        `, { pathPart: path.basename(this.projectPath) });

        if (result.records.length > 0) {
          return result.records[0].get('id');
        }

        // Fallback to :PROJECT label (legacy schema)
        result = await session.run(`
          MATCH (p:PROJECT)
          WHERE p.path CONTAINS $pathPart
          RETURN p.id as id
          LIMIT 1
        `, { pathPart: path.basename(this.projectPath) });

        if (result.records.length > 0) {
          return result.records[0].get('id');
        }
      } finally {
        await session.close();
      }
    } catch (error) {
      this.logger.debug(`Could not resolve project ID: ${error instanceof Error ? error.message : error}`);
    }
    return undefined;
  }

  /**
   * Step 1: Look up nodes by file path from knowledge graph
   * Uses storage abstraction - embedded mode uses Graphology, server mode uses Neo4j
   */
  private async lookupNodesFromFiles(semanticResults: any[]): Promise<Neo4jEntity[]> {
    try {
      // Embedded mode: Use Graphology graph store
      if (this.useEmbedded) {
        return await this.lookupNodesEmbedded(semanticResults);
      }

      // Server mode: Use Neo4j
      return await this.lookupNodesNeo4j(semanticResults);
    } catch (error) {
      this.logger.debug(`Failed to lookup nodes: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Embedded mode: Look up nodes using Graphology graph store
   */
  private async lookupNodesEmbedded(semanticResults: any[]): Promise<Neo4jEntity[]> {
    const graphStore = await this.initializeGraphStore();
    if (!graphStore || !this.projectId) return [];

    const entities: Neo4jEntity[] = [];
    const filePaths = semanticResults.map(r => r.file.replace(/\\/g, '/'));

    // Find all file nodes for this project
    const fileNodes = await graphStore.findNodes(this.projectId, 'file');

    for (const fileNode of fileNodes) {
      const normalizedPath = fileNode.filePath.replace(/\\/g, '/');

      // Check if this file matches any of our semantic search results
      const isMatch = filePaths.some(fp =>
        normalizedPath.endsWith(fp) ||
        normalizedPath.endsWith('/' + fp) ||
        normalizedPath.includes('/' + fp)
      );

      if (isMatch) {
        // Add the file node itself
        entities.push({
          id: fileNode.id,
          name: fileNode.name,
          type: 'File',
          filePath: fileNode.filePath,
          startLine: 1,
          endLine: 1
        });

        // Get entities defined in this file (via 'contains' edges)
        const edges = await graphStore.getEdges(fileNode.id, 'out');
        for (const edge of edges) {
          if (edge.type === 'contains') {
            const entityNode = await graphStore.getNode(edge.target);
            if (entityNode) {
              entities.push({
                id: entityNode.id,
                name: entityNode.name,
                type: entityNode.type || 'class',
                filePath: fileNode.filePath,
                startLine: (entityNode.properties?.startLine as number) || 1,
                endLine: (entityNode.properties?.endLine as number) || 1
              });
            }
          }
        }
      }
    }

    return entities.slice(0, 50); // Limit to 50 results
  }

  /**
   * Server mode: Look up nodes using Neo4j
   */
  private async lookupNodesNeo4j(semanticResults: any[]): Promise<Neo4jEntity[]> {
    const driver = await this.dbConnections.getNeo4jConnection();
    const session = driver.session();

    try {
      // Normalize paths: convert backslashes to forward slashes for matching
      const filePaths = semanticResults.map(r => {
        return r.file.replace(/\\/g, '/');
      });

      // Query File nodes and their DEFINES relationships to Class/Function entities
      // Schema: (Project {id})-[:CONTAINS]->(File {path})-[:DEFINES]->(Class|Function {name})
      const result = await session.run(`
        MATCH (p:Project {id: $projectId})-[:CONTAINS]->(f:File)
        WITH f, replace(f.path, '\\\\', '/') as normalizedPath
        WHERE any(fp IN $filePaths WHERE
          normalizedPath ENDS WITH fp OR
          normalizedPath ENDS WITH ('/' + fp) OR
          normalizedPath CONTAINS ('/' + fp)
        )
        OPTIONAL MATCH (f)-[:DEFINES]->(entity)
        WITH f, entity
        RETURN
          CASE WHEN entity IS NOT NULL THEN toString(id(entity)) ELSE toString(id(f)) END as id,
          CASE WHEN entity IS NOT NULL THEN entity.name ELSE f.name END as name,
          CASE WHEN entity IS NOT NULL THEN labels(entity)[0] ELSE 'File' END as type,
          f.path as filePath,
          CASE WHEN entity IS NOT NULL THEN entity.startLine ELSE 1 END as startLine,
          CASE WHEN entity IS NOT NULL THEN entity.endLine ELSE 1 END as endLine,
          null as signature
        LIMIT 50
      `, { projectId: this.projectId, filePaths });

      return result.records.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        type: record.get('type'),
        filePath: record.get('filePath'),
        startLine: record.get('startLine')?.toNumber?.() || record.get('startLine') || 1,
        endLine: record.get('endLine')?.toNumber?.() || record.get('endLine') || 1,
        signature: record.get('signature')
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Step 2: Get relationships between seed nodes
   * Uses storage abstraction - embedded mode uses Graphology, server mode uses Neo4j
   */
  private async getRelationshipsBetweenNodes(nodes: Neo4jEntity[]): Promise<GraphContext['relationships']> {
    if (nodes.length < 2) return [];

    try {
      // Embedded mode: Use Graphology graph store
      if (this.useEmbedded) {
        return await this.getRelationshipsEmbedded(nodes);
      }

      // Server mode: Use Neo4j
      return await this.getRelationshipsNeo4j(nodes);
    } catch (error) {
      this.logger.debug(`Failed to get relationships: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Embedded mode: Get relationships using Graphology graph store
   */
  private async getRelationshipsEmbedded(nodes: Neo4jEntity[]): Promise<GraphContext['relationships']> {
    const graphStore = await this.initializeGraphStore();
    if (!graphStore) return [];

    const relationships: GraphContext['relationships'] = [];
    const nodeIdSet = new Set(nodes.map(n => n.id));
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    for (const node of nodes) {
      // Get all outgoing edges from this node
      const edges = await graphStore.getEdges(node.id, 'out');

      for (const edge of edges) {
        // Only include relationships to other seed nodes
        if (nodeIdSet.has(edge.target)) {
          const targetNode = nodeById.get(edge.target);
          relationships.push({
            from: node.name,
            to: targetNode?.name || edge.target,
            type: edge.type.toUpperCase(),
            strength: 0.9, // Direct relationships are high strength
            fromPath: node.filePath,
            toPath: targetNode?.filePath,
            fromMethod: edge.properties?.fromMethod as string | undefined,
            toMethod: edge.properties?.toMethod as string | undefined,
            line: edge.properties?.line as number | undefined
          });
        }
      }
    }

    return relationships.slice(0, 50);
  }

  /**
   * Server mode: Get relationships using Neo4j
   */
  private async getRelationshipsNeo4j(nodes: Neo4jEntity[]): Promise<GraphContext['relationships']> {
    const driver = await this.dbConnections.getNeo4jConnection();
    const session = driver.session();

    try {
      const nodeIds = nodes.map(n => n.id);
      const filePaths = nodes.map(n => n.filePath).filter(Boolean);

      // Query relationships: File-[:DEFINES]->Class/Function
      // Also check for any relationships between entities in the matched files
      const result = await session.run(`
        MATCH (f:File)-[:DEFINES]->(entity)
        WHERE f.path IN $filePaths
        WITH f, entity
        OPTIONAL MATCH (entity)-[r]->(other)
        WHERE other IS NOT NULL
        RETURN
          f.name as sourceName,
          f.path as sourceFilePath,
          entity.name as targetName,
          f.path as targetFilePath,
          'DEFINES' as relType,
          null as metadata
        UNION
        MATCH (f1:File)-[:DEFINES]->(e1)-[r]->(e2)<-[:DEFINES]-(f2:File)
        WHERE f1.path IN $filePaths AND f2.path IN $filePaths AND f1 <> f2
        RETURN
          e1.name as sourceName,
          f1.path as sourceFilePath,
          e2.name as targetName,
          f2.path as targetFilePath,
          type(r) as relType,
          null as metadata
        LIMIT 50
      `, { nodeIds, filePaths, projectId: this.projectId });

      return result.records.map(record => {
        const metadata = this.parseMetadata(record.get('metadata'));
        return {
          from: record.get('sourceName'),
          to: record.get('targetName'),
          type: record.get('relType'),
          strength: 0.9, // Direct relationships are high strength
          fromPath: record.get('sourceFilePath'),
          toPath: record.get('targetFilePath'),
          fromMethod: metadata?.fromMethod,
          toMethod: metadata?.toMethod,
          line: metadata?.line
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Step 3: One-hop expansion - find important neighbors not in seed set
   * Uses storage abstraction - embedded mode uses Graphology, server mode uses Neo4j
   */
  private async expandOneHop(
    seedNodes: Neo4jEntity[],
    options: { maxPerNode: number; relationshipTypes: string[] }
  ): Promise<{ expandedNodes: Neo4jEntity[]; expandedRelationships: GraphContext['relationships'] }> {
    try {
      // Embedded mode: Use Graphology graph store
      if (this.useEmbedded) {
        return await this.expandOneHopEmbedded(seedNodes, options);
      }

      // Server mode: Use Neo4j
      return await this.expandOneHopNeo4j(seedNodes, options);
    } catch (error) {
      this.logger.debug(`Failed to expand one-hop: ${error instanceof Error ? error.message : error}`);
      return { expandedNodes: [], expandedRelationships: [] };
    }
  }

  /**
   * Embedded mode: One-hop expansion using Graphology graph store
   */
  private async expandOneHopEmbedded(
    seedNodes: Neo4jEntity[],
    options: { maxPerNode: number; relationshipTypes: string[] }
  ): Promise<{ expandedNodes: Neo4jEntity[]; expandedRelationships: GraphContext['relationships'] }> {
    const graphStore = await this.initializeGraphStore();
    if (!graphStore) return { expandedNodes: [], expandedRelationships: [] };

    const expandedNodes: Neo4jEntity[] = [];
    const expandedRelationships: GraphContext['relationships'] = [];
    const seenNeighborIds = new Set<string>();
    const seedIdSet = new Set(seedNodes.map(n => n.id));
    const neighborsPerSeed = new Map<string, number>();

    for (const seedNode of seedNodes) {
      // Get neighbors via supported edge types
      const edges = await graphStore.getEdges(seedNode.id, 'out');

      for (const edge of edges) {
        // Check if edge type matches our allowed types
        const edgeTypeUpper = edge.type.toUpperCase();
        if (!options.relationshipTypes.includes(edgeTypeUpper)) continue;

        // Skip if this is a seed node
        if (seedIdSet.has(edge.target)) continue;

        // Skip if we've already seen this neighbor
        if (seenNeighborIds.has(edge.target)) continue;

        // Limit neighbors per seed
        const currentCount = neighborsPerSeed.get(seedNode.id) || 0;
        if (currentCount >= options.maxPerNode) continue;

        seenNeighborIds.add(edge.target);
        neighborsPerSeed.set(seedNode.id, currentCount + 1);

        // Get the neighbor node
        const neighborNode = await graphStore.getNode(edge.target);
        if (!neighborNode) continue;

        expandedNodes.push({
          id: neighborNode.id,
          name: neighborNode.name,
          type: neighborNode.type || 'class',
          filePath: neighborNode.filePath,
          startLine: (neighborNode.properties?.startLine as number) || 1,
          endLine: (neighborNode.properties?.endLine as number) || 1
        });

        expandedRelationships.push({
          from: seedNode.name,
          to: neighborNode.name,
          type: edgeTypeUpper,
          strength: 0.7, // Expanded relationships are slightly lower strength
          fromPath: seedNode.filePath,
          toPath: neighborNode.filePath,
          fromMethod: edge.properties?.fromMethod as string | undefined,
          toMethod: edge.properties?.toMethod as string | undefined,
          line: edge.properties?.line as number | undefined
        });
      }
    }

    return { expandedNodes, expandedRelationships };
  }

  /**
   * Server mode: One-hop expansion using Neo4j
   */
  private async expandOneHopNeo4j(
    seedNodes: Neo4jEntity[],
    options: { maxPerNode: number; relationshipTypes: string[] }
  ): Promise<{ expandedNodes: Neo4jEntity[]; expandedRelationships: GraphContext['relationships'] }> {
    const expandedNodes: Neo4jEntity[] = [];
    const expandedRelationships: GraphContext['relationships'] = [];
    const seenNeighborIds = new Set<string>();

    const driver = await this.dbConnections.getNeo4jConnection();
    const session = driver.session();

    try {
      const filePaths = seedNodes.map(n => n.filePath).filter(Boolean);

      // Find other files in the same project that are connected via DEFINES
      // This expands to find related files that define entities
      const result = await session.run(`
        MATCH (p:Project {id: $projectId})-[:CONTAINS]->(seedFile:File)-[:DEFINES]->(entity)
        WHERE seedFile.path IN $filePaths
        WITH p, seedFile, entity
        MATCH (p)-[:CONTAINS]->(neighborFile:File)-[:DEFINES]->(neighborEntity)
        WHERE NOT neighborFile.path IN $filePaths
        WITH seedFile, entity, neighborFile, neighborEntity
        RETURN
          toString(id(seedFile)) as seedId,
          seedFile.name as seedName,
          seedFile.path as seedFilePath,
          toString(id(neighborEntity)) as neighborId,
          neighborEntity.name as neighborName,
          labels(neighborEntity)[0] as neighborType,
          neighborFile.path as neighborFilePath,
          neighborEntity.startLine as neighborStartLine,
          neighborEntity.endLine as neighborEndLine,
          'RELATED' as relType,
          null as metadata
        LIMIT 30
      `, {
        filePaths,
        projectId: this.projectId
      });

      // Track how many neighbors we've added per seed
      const neighborsPerSeed = new Map<string, number>();

      for (const record of result.records) {
        const seedId = record.get('seedId');
        const neighborId = record.get('neighborId');

        // Limit neighbors per seed node
        const currentCount = neighborsPerSeed.get(seedId) || 0;
        if (currentCount >= options.maxPerNode) continue;

        // Skip if we've already seen this neighbor
        if (seenNeighborIds.has(neighborId)) continue;
        seenNeighborIds.add(neighborId);

        neighborsPerSeed.set(seedId, currentCount + 1);

        // Add the neighbor node
        expandedNodes.push({
          id: neighborId,
          name: record.get('neighborName'),
          type: record.get('neighborType'),
          filePath: record.get('neighborFilePath'),
          startLine: record.get('neighborStartLine')?.toNumber?.() || 1,
          endLine: record.get('neighborEndLine')?.toNumber?.() || 1
        });

        // Add the relationship
        const metadata = this.parseMetadata(record.get('metadata'));
        expandedRelationships.push({
          from: record.get('seedName'),
          to: record.get('neighborName'),
          type: record.get('relType'),
          strength: 0.7, // Expanded relationships are slightly lower strength
          fromPath: record.get('seedFilePath'),
          toPath: record.get('neighborFilePath'),
          fromMethod: metadata?.fromMethod,
          toMethod: metadata?.toMethod,
          line: metadata?.line
        });
      }
    } finally {
      await session.close();
    }

    return { expandedNodes, expandedRelationships };
  }

  /**
   * Convert Neo4j entities to GraphContext classes format
   */
  private convertToClasses(
    seedNodes: Neo4jEntity[],
    semanticResults: any[],
    expandedNodes: Neo4jEntity[]
  ): GraphContext['classes'] {
    const classes: GraphContext['classes'] = [];

    // Add seed nodes (from search results) with their similarity scores
    for (const node of seedNodes) {
      const semanticResult = semanticResults.find(r =>
        r.file.includes(path.basename(node.filePath)) ||
        node.filePath.includes(r.file)
      );

      classes.push({
        name: node.name,
        filePath: node.filePath,
        type: node.type?.toLowerCase() || 'class',
        description: this.generateDescription(node),
        confidence: semanticResult?.similarity || 0.8,
        startLine: node.startLine,
        endLine: node.endLine,
        relationships: []
      });
    }

    // Add expanded nodes (from 1-hop expansion) with lower confidence
    for (const node of expandedNodes) {
      classes.push({
        name: node.name,
        filePath: node.filePath,
        type: node.type?.toLowerCase() || 'class',
        description: this.generateDescription(node) + ' (related dependency)',
        confidence: 0.6, // Lower confidence for expanded nodes
        startLine: node.startLine,
        endLine: node.endLine,
        relationships: []
      });
    }

    return classes;
  }

  /**
   * Generate description for a node
   */
  private generateDescription(node: Neo4jEntity): string {
    const type = node.type?.toLowerCase() || 'class';
    const typeDescriptions: Record<string, string> = {
      'class': 'Class implementation',
      'interface': 'Interface definition',
      'function': 'Function implementation',
      'method': 'Method implementation',
      'service': 'Service class handling business logic',
      'controller': 'Controller handling requests',
      'repository': 'Repository for data access',
      'component': 'Component module'
    };
    return typeDescriptions[type] || `${type} component`;
  }

  /**
   * Extract package names from nodes
   */
  private extractPackages(nodes: Neo4jEntity[]): string[] {
    const packages = new Set<string>();
    for (const node of nodes) {
      if (node.filePath) {
        const parts = path.dirname(node.filePath).split(path.sep);
        const srcIndex = parts.findIndex(p => p === 'src');
        if (srcIndex !== -1 && srcIndex < parts.length - 1) {
          packages.add(parts[srcIndex + 1]);
        } else if (parts.length > 0) {
          packages.add(parts[parts.length - 1]);
        }
      }
    }
    return Array.from(packages);
  }

  /**
   * Calculate graph insights
   */
  private calculateInsights(
    classes: GraphContext['classes'],
    relationships: GraphContext['relationships']
  ): GraphContext['graphInsights'] {
    const nodeCount = classes.length;
    const relCount = relationships.length;

    // Calculate basic coupling (avg relationships per node)
    const coupling = nodeCount > 0 ? Math.min(relCount / nodeCount / 5, 1) : 0;

    // Detect architectural patterns
    const patterns: string[] = [];
    const relTypes = new Set(relationships.map(r => r.type));
    if (relTypes.has('IMPLEMENTS')) patterns.push('interface-based');
    if (relTypes.has('EXTENDS')) patterns.push('inheritance');
    if (relTypes.has('CALLS')) patterns.push('service-layer');

    return {
      totalNodes: nodeCount,
      totalRelationships: relCount,
      architecturalPatterns: patterns,
      qualityMetrics: {
        coupling,
        cohesion: nodeCount > 0 ? 0.7 : 0, // Placeholder
        complexity: Math.min(relCount / 10, 1) // Simple complexity metric
      }
    };
  }

  /**
   * Parse metadata JSON safely
   */
  private parseMetadata(metadataJson: string | null): any {
    if (!metadataJson) return {};
    try {
      return JSON.parse(metadataJson);
    } catch {
      return {};
    }
  }

  /**
   * Fallback: Create basic analysis from semantic results when graph unavailable
   */
  private createBasicAnalysis(semanticResults: any[]): GraphContext {
    const classes: GraphContext['classes'] = semanticResults.map(result => ({
      name: this.extractClassNameFromFile(result.file),
      filePath: result.file,
      type: result.type || 'module',
      description: `${result.type || 'Module'} from semantic search`,
      confidence: result.similarity || 0.5,
      startLine: result.lineStart,
      endLine: result.lineEnd,
      relationships: []
    }));

    const packages = new Set<string>();
    for (const result of semanticResults) {
      const parts = path.dirname(result.file).split(path.sep);
      const srcIndex = parts.findIndex(p => p === 'src');
      if (srcIndex !== -1 && srcIndex < parts.length - 1) {
        packages.add(parts[srcIndex + 1]);
      }
    }

    return {
      classes,
      relationships: [],
      relationshipDetails: [],
      packageStructure: Array.from(packages),
      graphInsights: {
        totalNodes: classes.length,
        totalRelationships: 0,
        architecturalPatterns: ['basic-analysis'],
        qualityMetrics: { coupling: 0.5, cohesion: 0.5, complexity: 0.5 }
      }
    };
  }

  /**
   * Extract class name from file path
   */
  private extractClassNameFromFile(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    // Convert kebab-case to PascalCase
    return basename
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
