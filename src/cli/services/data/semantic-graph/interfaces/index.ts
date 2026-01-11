/**
 * Semantic Graph Interfaces
 * SOLID Principles: Interface Segregation - Separate interfaces for different responsibilities
 */

import { FileInfo } from '../../../monitoring/file-scanning/file-scanner-interfaces';

// Core graph types
export type NodeType = 'Code' | 'Documentation' | 'BusinessConcept' | 'UIComponent' | 'TestCase' | 'Interaction' | 'Session' | 'Project' | 'Request';
export type RelationshipType =
  | 'IMPORTS' | 'USES' | 'IMPLEMENTS' | 'DESCRIBES' | 'TESTS' | 'DEFINES'
  | 'RELATES_TO' | 'DEPENDS_ON' | 'CONTAINS' | 'EXTENDS' | 'CONFIGURES'
  | 'CALLS' | 'OVERRIDES' | 'INHERITS_FROM' | 'AGGREGATES' | 'COMPOSES'
  | 'ACCESSES' | 'MODIFIES' | 'INSTANTIATES' | 'TYPE_OF' | 'RETURNS';

export interface GraphNode {
  id: string;
  type: NodeType;
  properties: Record<string, any>;
  name: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
}

export interface GraphRelationship {
  fromId: string;
  toId: string;
  type: RelationshipType;
  properties?: Record<string, any>;
}

export interface SemanticGraphData {
  entities: GraphNode[];
  relationships: GraphRelationship[];
  fileNodes: Map<string, string>;
  stats: {
    totalFiles: number;
    totalEntities: number;
    totalRelationships: number;
    byLanguage: Record<string, number>;
  };
}

export interface IntegratedSemanticResult extends SemanticGraphData {
  processingStrategy: {
    treeSitterFiles: number;
    claudeProxyFiles: number;
    fallbackFiles: number;
    totalProcessingTime: number;
  };
  qualityMetrics: {
    completeness: number;
    accuracy: number;
    consistency: number;
    coverage: number;
  };
}

export interface GraphBuilderConfig {
  useTreeSitter: boolean;
  useClaudeProxy: boolean;
  preferTreeSitter: boolean;
  maxClaudeConcurrency: number;
  treeSitterLanguages: string[];
  skipLargeFiles: boolean;
  maxFileSize: number;
}

export interface SearchResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  stats: {
    totalResults: number;
    relevantNodes: number;
    searchTime: number;
  };
}

export interface ImpactAnalysisResult {
  affectedNodes: GraphNode[];
  relationships: GraphRelationship[];
  impact: {
    codeFiles: number;
    documentation: number;
    tests: number;
    uiComponents: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CrossReferenceResult {
  concept: GraphNode;
  relatedCode: GraphNode[];
  relatedDocs: GraphNode[];
  relatedUI: GraphNode[];
  relatedTests: GraphNode[];
}

export interface SearchContext {
  includeTypes?: NodeType[];
  maxDepth?: number;
  domain?: string;
  language?: string;
}

// Service interfaces following SOLID principles
export interface IFileProcessingService {
  buildGraphFromFiles(files: FileInfo[]): Promise<IntegratedSemanticResult>;
  filterFiles(files: FileInfo[]): FileInfo[];
  categorizeFiles(files: FileInfo[]): {
    treeSitter: FileInfo[];
    claude: FileInfo[];
    fallback: FileInfo[];
  };
}

export interface IGraphStorageService {
  initialize(): Promise<void>;
  addNode(type: NodeType, properties: Record<string, any>): Promise<string>;
  addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void>;
  batchCreateNodes(nodes: Array<{ type: NodeType; properties: Record<string, any> }>): Promise<string[]>;
  searchNodes(query: string, context?: SearchContext): Promise<SearchResult>;
  findRelatedNodes(nodeId: string, maxDepth?: number): Promise<GraphNode[]>;
  updateNodeProperty(nodeId: string, propertyName: string, propertyValue: string): Promise<void>;
  close(): Promise<void>;
}

export interface IGraphQueryService {
  searchNodes(query: string, context?: SearchContext): Promise<SearchResult>;
  findRelatedNodes(nodeId: string, maxDepth?: number): Promise<GraphNode[]>;
  findPathBetweenNodes(fromId: string, toId: string): Promise<GraphNode[]>;
  getNodesByType(type: NodeType): Promise<GraphNode[]>;
  analyzeImpact(nodeId: string): Promise<ImpactAnalysisResult>;
  performCrossReference(concept: string): Promise<CrossReferenceResult>;
  performSemanticSearch(query: string, context?: SearchContext): Promise<SearchResult[]>;
  findCrossReferences(nodeId: string): Promise<CrossReferenceResult[]>;
}

export interface IGraphProcessor {
  processFiles(files: FileInfo[]): Promise<SemanticGraphData | null>;
}

export interface IQualityAnalyzer {
  calculateQualityMetrics(result: any, categories: any): any;
  calculateRelevanceScore(node: GraphNode, keywords: string[]): number;
}

export interface IIndexManagementService {
  ensureIndexes(): Promise<void>;
  optimizeIndexes(): Promise<void>;
  getIndexStatus(): Promise<any>;
}