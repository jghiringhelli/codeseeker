/**
 * Class Traversal Engine for Knowledge Integration
 * Provides advanced tree traversal capabilities for class understanding,
 * quick finding, and concept mapping within the knowledge integration system.
 */

import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import { TreeNavigator, DependencyTree, TreeNode, NodeType } from '../../features/tree-navigation/navigator';
import { 
  KnowledgeNode, 
  KnowledgeTriad, 
  RelationType, 
  NodeType as KnowledgeNodeType 
} from '../graph/types';

export interface ClassTraversalQuery {
  className?: string;
  namespace?: string;
  searchTerm?: string;
  traversalType: TraversalType;
  maxDepth?: number;
  includeRelated?: boolean;
  focusArea?: ClassFocusArea;
}

export enum TraversalType {
  INHERITANCE_CHAIN = 'INHERITANCE_CHAIN',
  COMPOSITION_TREE = 'COMPOSITION_TREE',
  DEPENDENCY_GRAPH = 'DEPENDENCY_GRAPH',
  CONCEPT_MAP = 'CONCEPT_MAP',
  USAGE_PATTERNS = 'USAGE_PATTERNS',
  QUICK_FIND = 'QUICK_FIND'
}

export enum ClassFocusArea {
  ARCHITECTURE = 'ARCHITECTURE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  DATA_FLOW = 'DATA_FLOW',
  TESTING = 'TESTING',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE'
}

export interface ClassTraversalResult {
  queryInfo: ClassTraversalQuery;
  rootNodes: ClassNode[];
  traversalPaths: TraversalPath[];
  conceptMappings: ConceptMapping[];
  insights: ClassInsight[];
  quickFinds: QuickFindResult[];
  statistics: TraversalStatistics;
}

export interface ClassNode {
  id: string;
  name: string;
  qualifiedName: string;
  type: ClassNodeType;
  namespace: string;
  filePath: string;
  sourceLocation: {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  };
  relationships: ClassRelationship[];
  methods: ClassMethod[];
  properties: ClassProperty[];
  annotations: Annotation[];
  complexity: ClassComplexity;
  usage: UsageInfo;
  conceptTags: string[];
  businessRelevance: number; // 0-1 scale
}

export enum ClassNodeType {
  CLASS = 'CLASS',
  INTERFACE = 'INTERFACE',
  ABSTRACT_CLASS = 'ABSTRACT_CLASS',
  ENUM = 'ENUM',
  TRAIT = 'TRAIT',
  MIXIN = 'MIXIN',
  SERVICE = 'SERVICE',
  CONTROLLER = 'CONTROLLER',
  REPOSITORY = 'REPOSITORY',
  ENTITY = 'ENTITY',
  VALUE_OBJECT = 'VALUE_OBJECT',
  FACTORY = 'FACTORY',
  BUILDER = 'BUILDER',
  OBSERVER = 'OBSERVER',
  STRATEGY = 'STRATEGY'
}

export interface ClassRelationship {
  type: RelationshipType;
  target: string; // Target class qualified name
  strength: number; // 0-1, relationship strength
  context: string;
  isKey: boolean; // Key architectural relationship
}

export enum RelationshipType {
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS',
  COMPOSES = 'COMPOSES',
  AGGREGATES = 'AGGREGATES',
  USES = 'USES',
  DEPENDS_ON = 'DEPENDS_ON',
  CREATES = 'CREATES',
  OBSERVES = 'OBSERVES',
  DECORATES = 'DECORATES',
  ADAPTS = 'ADAPTS'
}

export interface ClassMethod {
  name: string;
  visibility: 'public' | 'private' | 'protected' | 'package';
  isStatic: boolean;
  isAbstract: boolean;
  returnType?: string;
  parameters: MethodParameter[];
  complexity: number;
  isKey: boolean; // Key business method
  annotations: Annotation[];
  usageFrequency: number;
}

export interface ClassProperty {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected' | 'package';
  isStatic: boolean;
  isFinal: boolean;
  annotations: Annotation[];
  isKey: boolean; // Key business property
}

export interface MethodParameter {
  name: string;
  type: string;
  isOptional?: boolean;
  defaultValue?: string;
}

export interface Annotation {
  name: string;
  parameters?: Record<string, any>;
}

export interface ClassComplexity {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  methodCount: number;
  propertyCount: number;
  inheritanceDepth: number;
  couplingCount: number;
  cohesionScore: number;
}

export interface UsageInfo {
  instantiationCount: number;
  methodCallCount: number;
  inheritanceCount: number; // How many classes extend/implement this
  referencedByCount: number;
  testCoveragePercent: number;
  isHotspot: boolean; // Frequently modified
  lastModified: Date;
}

export interface TraversalPath {
  pathId: string;
  type: TraversalType;
  nodes: string[]; // Class IDs in order
  relationships: string[]; // Relationship types between nodes
  depth: number;
  significance: number; // 0-1, how important this path is
  businessContext: string;
  conceptualMeaning: string;
}

export interface ConceptMapping {
  concept: string;
  relatedClasses: string[];
  strength: number; // 0-1, how strongly related
  category: ConceptCategory;
  description: string;
  keywords: string[];
}

export enum ConceptCategory {
  ARCHITECTURAL_PATTERN = 'ARCHITECTURAL_PATTERN',
  BUSINESS_CONCEPT = 'BUSINESS_CONCEPT',
  DATA_STRUCTURE = 'DATA_STRUCTURE',
  BEHAVIORAL_PATTERN = 'BEHAVIORAL_PATTERN',
  INTEGRATION_PATTERN = 'INTEGRATION_PATTERN',
  SECURITY_PATTERN = 'SECURITY_PATTERN'
}

export interface ClassInsight {
  type: InsightType;
  title: string;
  description: string;
  affectedClasses: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: ClassFocusArea;
  actionable: boolean;
  recommendations: string[];
  evidence: InsightEvidence[];
}

export enum InsightType {
  DESIGN_PATTERN_DETECTED = 'DESIGN_PATTERN_DETECTED',
  ANTI_PATTERN_DETECTED = 'ANTI_PATTERN_DETECTED',
  HIGH_COUPLING = 'HIGH_COUPLING',
  LOW_COHESION = 'LOW_COHESION',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  UNUSED_CLASS = 'UNUSED_CLASS',
  HOTSPOT_CLASS = 'HOTSPOT_CLASS',
  MISSING_ABSTRACTION = 'MISSING_ABSTRACTION',
  OVERENGINEERED = 'OVERENGINEERED',
  BUSINESS_LOGIC_LEAK = 'BUSINESS_LOGIC_LEAK'
}

export interface InsightEvidence {
  type: 'metric' | 'pattern' | 'relationship' | 'usage';
  description: string;
  value?: number;
  threshold?: number;
  context: string;
}

export interface QuickFindResult {
  query: string;
  matches: QuickMatch[];
  totalMatches: number;
  searchTime: number;
  suggestions: string[];
}

export interface QuickMatch {
  classNode: ClassNode;
  matchType: MatchType;
  matchScore: number; // 0-1, relevance score
  matchedText: string;
  context: string;
  highlights: TextHighlight[];
}

export enum MatchType {
  EXACT_NAME = 'EXACT_NAME',
  PARTIAL_NAME = 'PARTIAL_NAME',
  METHOD_NAME = 'METHOD_NAME',
  PROPERTY_NAME = 'PROPERTY_NAME',
  CONCEPT_TAG = 'CONCEPT_TAG',
  ANNOTATION = 'ANNOTATION',
  COMMENT = 'COMMENT',
  USAGE_CONTEXT = 'USAGE_CONTEXT'
}

export interface TextHighlight {
  start: number;
  end: number;
  type: 'match' | 'context' | 'keyword';
}

export interface TraversalStatistics {
  totalNodesAnalyzed: number;
  totalRelationshipsFound: number;
  averageComplexity: number;
  deepestInheritanceChain: number;
  mostCoupledClass: string;
  leastCohesiveClass: string;
  businessCriticalClasses: string[];
  architecturalHotspots: string[];
  performanceBottlenecks: string[];
  securityRisks: string[];
  traversalTime: number;
}

export class ClassTraversalEngine extends EventEmitter {
  private logger: Logger;
  private treeNavigator: TreeNavigator;
  private classCache: Map<string, ClassNode> = new Map();
  private relationshipIndex: Map<string, ClassRelationship[]> = new Map();
  private conceptIndex: Map<string, ConceptMapping> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map(); // term -> class IDs

  constructor(logger?: Logger) {
    super();
    this.logger = logger || Logger.getInstance();
    this.treeNavigator = new TreeNavigator();
  }

  async performTraversal(
    projectPath: string,
    query: ClassTraversalQuery
  ): Promise<ClassTraversalResult> {
    const startTime = Date.now();
    this.logger.info(`Starting class traversal for query: ${JSON.stringify(query)}`);

    // Build dependency tree if needed
    const dependencyTree = await this.treeNavigator.buildTree({
      projectPath,
      filePattern: '**/*.{ts,tsx,js,jsx,java,py,cs,cpp,hpp}',
      showDependencies: true,
      includeExternal: false,
      maxDepth: query.maxDepth || 10
    });

    // Convert to class nodes
    await this.buildClassNodes(dependencyTree);
    
    // Build relationship index
    await this.buildRelationshipIndex();
    
    // Build concept mappings
    await this.buildConceptMappings(query.focusArea);
    
    // Build search index for quick finds
    await this.buildSearchIndex();

    // Perform the specific traversal
    let result: ClassTraversalResult;

    switch (query.traversalType) {
      case TraversalType.INHERITANCE_CHAIN:
        result = await this.performInheritanceTraversal(query);
        break;
      case TraversalType.COMPOSITION_TREE:
        result = await this.performCompositionTraversal(query);
        break;
      case TraversalType.DEPENDENCY_GRAPH:
        result = await this.performDependencyTraversal(query);
        break;
      case TraversalType.CONCEPT_MAP:
        result = await this.performConceptTraversal(query);
        break;
      case TraversalType.USAGE_PATTERNS:
        result = await this.performUsageTraversal(query);
        break;
      case TraversalType.QUICK_FIND:
        result = await this.performQuickFind(query);
        break;
      default:
        throw new Error(`Unsupported traversal type: ${query.traversalType}`);
    }

    // Generate insights
    result.insights = await this.generateInsights(result, query.focusArea);
    
    // Calculate statistics
    const traversalTime = Date.now() - startTime;
    result.statistics = await this.calculateTraversalStatistics(result, traversalTime);

    this.logger.info(`Class traversal completed in ${traversalTime}ms. Found ${result.rootNodes.length} root nodes, ${result.traversalPaths.length} paths`);

    this.emit('traversal-completed', { query, result, time: traversalTime });

    return result;
  }

  private async buildClassNodes(dependencyTree: DependencyTree): Promise<void> {
    this.logger.info('Building class nodes from dependency tree');

    for (const [nodeId, treeNode] of dependencyTree.nodes) {
      if (treeNode.type === NodeType.FILE && this.isClassFile(treeNode.path)) {
        const classNode = await this.createClassNode(treeNode);
        if (classNode) {
          this.classCache.set(classNode.id, classNode);
        }
      }
    }

    this.logger.info(`Built ${this.classCache.size} class nodes`);
  }

  private isClassFile(filePath: string): boolean {
    const classFileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.java', '.py', '.cs', '.cpp', '.hpp'];
    return classFileExtensions.some(ext => filePath.endsWith(ext));
  }

  private async createClassNode(treeNode: TreeNode): Promise<ClassNode | null> {
    try {
      // This is a simplified implementation - in reality, would use AST parsing
      const classNode: ClassNode = {
        id: treeNode.id,
        name: this.extractClassName(treeNode.name),
        qualifiedName: this.extractQualifiedName(treeNode.path),
        type: this.inferClassType(treeNode.name, treeNode.path),
        namespace: this.extractNamespace(treeNode.path),
        filePath: treeNode.path,
        sourceLocation: {
          startLine: 1,
          endLine: treeNode.metadata.linesOfCode || 100
        },
        relationships: [],
        methods: [], // Would be populated by AST analysis
        properties: [], // Would be populated by AST analysis
        annotations: [], // Would be populated by AST analysis
        complexity: {
          cyclomaticComplexity: treeNode.complexity,
          cognitiveComplexity: Math.ceil(treeNode.complexity * 1.2),
          linesOfCode: treeNode.metadata.linesOfCode,
          methodCount: 0, // Would be from AST
          propertyCount: 0, // Would be from AST
          inheritanceDepth: this.calculateInheritanceDepth(treeNode),
          couplingCount: treeNode.children.length + treeNode.parents.length,
          cohesionScore: this.calculateCohesionScore(treeNode)
        },
        usage: {
          instantiationCount: 0, // Would be from usage analysis
          methodCallCount: 0, // Would be from usage analysis
          inheritanceCount: treeNode.parents.length,
          referencedByCount: treeNode.children.length,
          testCoveragePercent: 0, // Would be from coverage analysis
          isHotspot: treeNode.metadata.lastModified > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lastModified: treeNode.metadata.lastModified
        },
        conceptTags: this.generateConceptTags(treeNode),
        businessRelevance: this.calculateBusinessRelevance(treeNode)
      };

      return classNode;
    } catch (error) {
      this.logger.warn(`Failed to create class node for ${treeNode.path}`, error);
      return null;
    }
  }

  private extractClassName(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, ""); // Remove extension
  }

  private extractQualifiedName(filePath: string): string {
    return filePath.replace(/[\/\\]/g, '.').replace(/\.[^/.]+$/, "");
  }

  private inferClassType(fileName: string, filePath: string): ClassNodeType {
    const name = fileName.toLowerCase();
    const path = filePath.toLowerCase();

    if (name.includes('service') || path.includes('service')) return ClassNodeType.SERVICE;
    if (name.includes('controller') || path.includes('controller')) return ClassNodeType.CONTROLLER;
    if (name.includes('repository') || path.includes('repository')) return ClassNodeType.REPOSITORY;
    if (name.includes('entity') || path.includes('entity')) return ClassNodeType.ENTITY;
    if (name.includes('factory') || path.includes('factory')) return ClassNodeType.FACTORY;
    if (name.includes('builder') || path.includes('builder')) return ClassNodeType.BUILDER;
    if (name.includes('interface') || name.startsWith('i') && name[1]?.toUpperCase() === name[1]) {
      return ClassNodeType.INTERFACE;
    }
    if (name.includes('enum')) return ClassNodeType.ENUM;

    return ClassNodeType.CLASS;
  }

  private extractNamespace(filePath: string): string {
    const parts = filePath.split(/[\/\\]/);
    return parts.slice(0, -1).join('.');
  }

  private calculateInheritanceDepth(treeNode: TreeNode): number {
    // Simplified calculation - would need AST analysis for accurate results
    let depth = 0;
    let current = treeNode;
    const visited = new Set<string>();

    while (current.parents.length > 0 && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = current.parents.find(p => p.type === NodeType.FILE);
      if (parent) {
        current = parent;
        depth++;
      } else {
        break;
      }
      
      if (depth > 20) break; // Safety limit
    }

    return depth;
  }

  private calculateCohesionScore(treeNode: TreeNode): number {
    // Simplified calculation - would need detailed method/property analysis
    const complexity = treeNode.complexity;
    const size = treeNode.metadata.linesOfCode;
    
    if (size === 0) return 1;
    
    // High cohesion means methods work together closely
    // Simplified heuristic: lower complexity per line suggests better cohesion
    return Math.max(0, Math.min(1, 1 - (complexity / size)));
  }

  private generateConceptTags(treeNode: TreeNode): string[] {
    const tags: string[] = [];
    const name = treeNode.name.toLowerCase();
    const path = treeNode.path.toLowerCase();

    // Business concepts
    if (name.includes('user') || name.includes('customer')) tags.push('user-management');
    if (name.includes('order') || name.includes('purchase')) tags.push('e-commerce');
    if (name.includes('payment') || name.includes('billing')) tags.push('financial');
    if (name.includes('auth') || name.includes('login')) tags.push('authentication');
    if (name.includes('admin') || name.includes('management')) tags.push('administration');

    // Technical patterns
    if (name.includes('service')) tags.push('service-layer');
    if (name.includes('repository') || name.includes('dao')) tags.push('data-access');
    if (name.includes('controller') || name.includes('handler')) tags.push('presentation-layer');
    if (name.includes('factory') || name.includes('builder')) tags.push('creational-pattern');
    if (name.includes('observer') || name.includes('listener')) tags.push('behavioral-pattern');

    // Infrastructure
    if (path.includes('config')) tags.push('configuration');
    if (path.includes('util')) tags.push('utility');
    if (path.includes('test')) tags.push('testing');
    if (path.includes('api')) tags.push('api');
    if (path.includes('db') || path.includes('database')) tags.push('database');

    return Array.from(new Set(tags));
  }

  private calculateBusinessRelevance(treeNode: TreeNode): number {
    let relevance = 0.5; // Base relevance

    const name = treeNode.name.toLowerCase();
    const path = treeNode.path.toLowerCase();

    // High business relevance
    if (name.includes('user') || name.includes('customer')) relevance += 0.3;
    if (name.includes('order') || name.includes('product')) relevance += 0.3;
    if (name.includes('payment') || name.includes('invoice')) relevance += 0.3;
    if (name.includes('service') && !path.includes('util')) relevance += 0.2;
    if (name.includes('controller')) relevance += 0.2;

    // Lower business relevance
    if (path.includes('util') || path.includes('helper')) relevance -= 0.2;
    if (path.includes('test')) relevance -= 0.3;
    if (name.includes('config') || name.includes('constant')) relevance -= 0.2;

    // Complexity factor
    if (treeNode.complexity > 15) relevance += 0.1;
    if (treeNode.metadata.linesOfCode > 500) relevance += 0.1;

    return Math.max(0, Math.min(1, relevance));
  }

  private async buildRelationshipIndex(): Promise<void> {
    this.logger.info('Building relationship index');

    for (const classNode of this.classCache.values()) {
      const relationships: ClassRelationship[] = [];
      
      // This is simplified - would need AST analysis for accurate relationships
      // For now, use file dependencies as proxy for class relationships
      
      relationships.push(...this.inferRelationshipsFromName(classNode));
      relationships.push(...this.inferRelationshipsFromPath(classNode));

      this.relationshipIndex.set(classNode.id, relationships);
      classNode.relationships = relationships;
    }

    this.logger.info(`Built relationship index with ${this.relationshipIndex.size} entries`);
  }

  private inferRelationshipsFromName(classNode: ClassNode): ClassRelationship[] {
    const relationships: ClassRelationship[] = [];
    
    // Simple heuristics for relationship inference
    if (classNode.name.includes('Service')) {
      // Services typically use repositories
      for (const otherNode of this.classCache.values()) {
        if (otherNode.name.includes('Repository') && 
            otherNode.namespace === classNode.namespace) {
          relationships.push({
            type: RelationshipType.USES,
            target: otherNode.qualifiedName,
            strength: 0.8,
            context: 'Service-Repository pattern',
            isKey: true
          });
        }
      }
    }

    if (classNode.name.includes('Controller')) {
      // Controllers typically use services
      for (const otherNode of this.classCache.values()) {
        if (otherNode.name.includes('Service') && 
            otherNode.namespace === classNode.namespace) {
          relationships.push({
            type: RelationshipType.USES,
            target: otherNode.qualifiedName,
            strength: 0.9,
            context: 'Controller-Service pattern',
            isKey: true
          });
        }
      }
    }

    return relationships;
  }

  private inferRelationshipsFromPath(classNode: ClassNode): ClassRelationship[] {
    const relationships: ClassRelationship[] = [];
    
    // Infer relationships based on directory structure
    const pathParts = classNode.filePath.split('/');
    
    for (const otherNode of this.classCache.values()) {
      if (otherNode.id === classNode.id) continue;
      
      const otherPathParts = otherNode.filePath.split('/');
      const commonPath = this.getCommonPath(pathParts, otherPathParts);
      
      if (commonPath.length > 1) {
        const strength = commonPath.length / Math.max(pathParts.length, otherPathParts.length);
        
        relationships.push({
          type: RelationshipType.DEPENDS_ON,
          target: otherNode.qualifiedName,
          strength,
          context: 'Same module/package',
          isKey: strength > 0.7
        });
      }
    }

    return relationships;
  }

  private getCommonPath(path1: string[], path2: string[]): string[] {
    const common: string[] = [];
    const minLength = Math.min(path1.length, path2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (path1[i] === path2[i]) {
        common.push(path1[i]);
      } else {
        break;
      }
    }
    
    return common;
  }

  private async buildConceptMappings(focusArea?: ClassFocusArea): Promise<void> {
    this.logger.info('Building concept mappings');

    const conceptGroups = new Map<string, string[]>();

    // Group classes by concept tags
    for (const classNode of this.classCache.values()) {
      for (const tag of classNode.conceptTags) {
        if (!conceptGroups.has(tag)) {
          conceptGroups.set(tag, []);
        }
        conceptGroups.get(tag)!.push(classNode.id);
      }
    }

    // Create concept mappings
    for (const [concept, classIds] of conceptGroups) {
      if (classIds.length < 2) continue; // Skip single-class concepts

      const mapping: ConceptMapping = {
        concept,
        relatedClasses: classIds,
        strength: this.calculateConceptStrength(classIds),
        category: this.categoryConcept(concept),
        description: this.generateConceptDescription(concept, classIds),
        keywords: this.generateConceptKeywords(concept)
      };

      this.conceptIndex.set(concept, mapping);
    }

    this.logger.info(`Built ${this.conceptIndex.size} concept mappings`);
  }

  private calculateConceptStrength(classIds: string[]): number {
    // Strength based on number of related classes and their business relevance
    const relevanceSum = classIds.reduce((sum, id) => {
      const classNode = this.classCache.get(id);
      return sum + (classNode?.businessRelevance || 0);
    }, 0);

    const avgRelevance = relevanceSum / classIds.length;
    const sizeBonus = Math.min(0.3, classIds.length * 0.05);
    
    return Math.min(1, avgRelevance + sizeBonus);
  }

  private categoryConcept(concept: string): ConceptCategory {
    const conceptLower = concept.toLowerCase();

    if (conceptLower.includes('pattern') || conceptLower.includes('factory') || conceptLower.includes('builder')) {
      return ConceptCategory.ARCHITECTURAL_PATTERN;
    }
    if (conceptLower.includes('user') || conceptLower.includes('order') || conceptLower.includes('payment')) {
      return ConceptCategory.BUSINESS_CONCEPT;
    }
    if (conceptLower.includes('data') || conceptLower.includes('repository') || conceptLower.includes('entity')) {
      return ConceptCategory.DATA_STRUCTURE;
    }
    if (conceptLower.includes('observer') || conceptLower.includes('strategy') || conceptLower.includes('command')) {
      return ConceptCategory.BEHAVIORAL_PATTERN;
    }
    if (conceptLower.includes('api') || conceptLower.includes('service') || conceptLower.includes('integration')) {
      return ConceptCategory.INTEGRATION_PATTERN;
    }
    if (conceptLower.includes('auth') || conceptLower.includes('security') || conceptLower.includes('permission')) {
      return ConceptCategory.SECURITY_PATTERN;
    }

    return ConceptCategory.ARCHITECTURAL_PATTERN;
  }

  private generateConceptDescription(concept: string, classIds: string[]): string {
    const classNames = classIds.map(id => this.classCache.get(id)?.name).filter(Boolean);
    return `Concept '${concept}' encompasses ${classIds.length} classes: ${classNames.slice(0, 3).join(', ')}${classIds.length > 3 ? '...' : ''}`;
  }

  private generateConceptKeywords(concept: string): string[] {
    const keywords = concept.split('-');
    
    // Add related terms
    const relatedTerms: Record<string, string[]> = {
      'user': ['customer', 'account', 'profile', 'identity'],
      'order': ['purchase', 'transaction', 'sale', 'booking'],
      'payment': ['billing', 'invoice', 'financial', 'money'],
      'service': ['business', 'logic', 'operation', 'process'],
      'data': ['entity', 'model', 'storage', 'persistence']
    };

    for (const keyword of keywords) {
      if (relatedTerms[keyword]) {
        keywords.push(...relatedTerms[keyword]);
      }
    }

    return Array.from(new Set(keywords));
  }

  private async buildSearchIndex(): Promise<void> {
    this.logger.info('Building search index for quick finds');

    for (const classNode of this.classCache.values()) {
      const searchTerms = new Set<string>();

      // Add class name variations
      searchTerms.add(classNode.name.toLowerCase());
      searchTerms.add(classNode.qualifiedName.toLowerCase());
      
      // Add name parts (camelCase splitting)
      const nameParts = classNode.name.match(/[A-Z][a-z]+/g) || [];
      nameParts.forEach(part => searchTerms.add(part.toLowerCase()));

      // Add concept tags
      classNode.conceptTags.forEach(tag => searchTerms.add(tag.toLowerCase()));

      // Add namespace parts
      const namespaceParts = classNode.namespace.split('.');
      namespaceParts.forEach(part => searchTerms.add(part.toLowerCase()));

      // Add method names (when available)
      classNode.methods.forEach(method => {
        searchTerms.add(method.name.toLowerCase());
      });

      // Add property names (when available)
      classNode.properties.forEach(prop => {
        searchTerms.add(prop.name.toLowerCase());
      });

      // Index all terms
      for (const term of searchTerms) {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, new Set());
        }
        this.searchIndex.get(term)!.add(classNode.id);
      }
    }

    this.logger.info(`Built search index with ${this.searchIndex.size} terms`);
  }

  // Traversal method implementations
  private async performInheritanceTraversal(query: ClassTraversalQuery): Promise<ClassTraversalResult> {
    const rootNodes: ClassNode[] = [];
    const traversalPaths: TraversalPath[] = [];
    const conceptMappings: ConceptMapping[] = [];

    // Find inheritance chains
    for (const classNode of this.classCache.values()) {
      if (this.matchesQuery(classNode, query)) {
        rootNodes.push(classNode);
        
        const paths = this.findInheritancePaths(classNode, query.maxDepth || 10);
        traversalPaths.push(...paths);
      }
    }

    // Add relevant concept mappings
    const inheritanceMapping = this.conceptIndex.get('inheritance');
    if (inheritanceMapping) {
      conceptMappings.push(inheritanceMapping);
    }

    return {
      queryInfo: query,
      rootNodes,
      traversalPaths,
      conceptMappings,
      insights: [],
      quickFinds: [],
      statistics: {} as TraversalStatistics
    };
  }

  private async performCompositionTraversal(query: ClassTraversalQuery): Promise<ClassTraversalResult> {
    const rootNodes: ClassNode[] = [];
    const traversalPaths: TraversalPath[] = [];

    for (const classNode of this.classCache.values()) {
      if (this.matchesQuery(classNode, query)) {
        rootNodes.push(classNode);
        
        const paths = this.findCompositionPaths(classNode, query.maxDepth || 5);
        traversalPaths.push(...paths);
      }
    }

    return {
      queryInfo: query,
      rootNodes,
      traversalPaths,
      conceptMappings: Array.from(this.conceptIndex.values()),
      insights: [],
      quickFinds: [],
      statistics: {} as TraversalStatistics
    };
  }

  private async performDependencyTraversal(query: ClassTraversalQuery): Promise<ClassTraversalResult> {
    const rootNodes: ClassNode[] = [];
    const traversalPaths: TraversalPath[] = [];

    for (const classNode of this.classCache.values()) {
      if (this.matchesQuery(classNode, query)) {
        rootNodes.push(classNode);
        
        const paths = this.findDependencyPaths(classNode, query.maxDepth || 8);
        traversalPaths.push(...paths);
      }
    }

    return {
      queryInfo: query,
      rootNodes,
      traversalPaths,
      conceptMappings: Array.from(this.conceptIndex.values()),
      insights: [],
      quickFinds: [],
      statistics: {} as TraversalStatistics
    };
  }

  private async performConceptTraversal(query: ClassTraversalQuery): Promise<ClassTraversalResult> {
    const conceptMappings = Array.from(this.conceptIndex.values());
    const rootNodes: ClassNode[] = [];
    const traversalPaths: TraversalPath[] = [];

    // Find classes related to search term concepts
    if (query.searchTerm) {
      const relatedConcepts = conceptMappings.filter(mapping => 
        mapping.keywords.some(keyword => 
          keyword.includes(query.searchTerm!.toLowerCase())
        )
      );

      for (const concept of relatedConcepts) {
        const classNodes = concept.relatedClasses
          .map(id => this.classCache.get(id))
          .filter(Boolean) as ClassNode[];
        
        rootNodes.push(...classNodes);
        
        // Create concept-based traversal paths
        const path: TraversalPath = {
          pathId: `concept-${concept.concept}`,
          type: TraversalType.CONCEPT_MAP,
          nodes: concept.relatedClasses,
          relationships: ['CONCEPT_RELATED'],
          depth: 1,
          significance: concept.strength,
          businessContext: concept.description,
          conceptualMeaning: `Classes related to concept: ${concept.concept}`
        };
        
        traversalPaths.push(path);
      }
    }

    return {
      queryInfo: query,
      rootNodes,
      traversalPaths,
      conceptMappings,
      insights: [],
      quickFinds: [],
      statistics: {} as TraversalStatistics
    };
  }

  private async performUsageTraversal(query: ClassTraversalQuery): Promise<ClassTraversalResult> {
    const rootNodes: ClassNode[] = [];
    const traversalPaths: TraversalPath[] = [];

    // Find high-usage classes
    const highUsageClasses = Array.from(this.classCache.values())
      .filter(classNode => classNode.usage.referencedByCount > 3 || classNode.usage.isHotspot)
      .sort((a, b) => b.usage.referencedByCount - a.usage.referencedByCount);

    if (query.searchTerm) {
      rootNodes.push(...highUsageClasses.filter(node => this.matchesQuery(node, query)));
    } else {
      rootNodes.push(...highUsageClasses.slice(0, 10)); // Top 10 most used
    }

    // Create usage-based paths
    for (const classNode of rootNodes) {
      const path: TraversalPath = {
        pathId: `usage-${classNode.id}`,
        type: TraversalType.USAGE_PATTERNS,
        nodes: [classNode.id],
        relationships: [],
        depth: 1,
        significance: classNode.usage.referencedByCount / 10,
        businessContext: `High-usage class with ${classNode.usage.referencedByCount} references`,
        conceptualMeaning: `Usage hotspot in ${classNode.conceptTags.join(', ')} domain`
      };
      
      traversalPaths.push(path);
    }

    return {
      queryInfo: query,
      rootNodes,
      traversalPaths,
      conceptMappings: Array.from(this.conceptIndex.values()),
      insights: [],
      quickFinds: [],
      statistics: {} as TraversalStatistics
    };
  }

  private async performQuickFind(query: ClassTraversalQuery): Promise<ClassTraversalResult> {
    const startTime = Date.now();
    const searchTerm = query.searchTerm || '';
    const matches: QuickMatch[] = [];

    if (!searchTerm) {
      return {
        queryInfo: query,
        rootNodes: [],
        traversalPaths: [],
        conceptMappings: [],
        insights: [],
        quickFinds: [{
          query: searchTerm,
          matches: [],
          totalMatches: 0,
          searchTime: Date.now() - startTime,
          suggestions: ['Try searching for a class name, method, or concept']
        }],
        statistics: {} as TraversalStatistics
      };
    }

    const searchTermLower = searchTerm.toLowerCase();
    const matchedIds = new Set<string>();

    // Exact matches
    if (this.searchIndex.has(searchTermLower)) {
      for (const classId of this.searchIndex.get(searchTermLower)!) {
        matchedIds.add(classId);
      }
    }

    // Partial matches
    for (const [term, classIds] of this.searchIndex.entries()) {
      if (term.includes(searchTermLower) && !this.searchIndex.has(searchTermLower)) {
        for (const classId of classIds) {
          matchedIds.add(classId);
        }
      }
    }

    // Create match results
    for (const classId of matchedIds) {
      const classNode = this.classCache.get(classId);
      if (!classNode) continue;

      const match: QuickMatch = {
        classNode,
        matchType: this.determineMatchType(classNode, searchTerm),
        matchScore: this.calculateMatchScore(classNode, searchTerm),
        matchedText: this.getMatchedText(classNode, searchTerm),
        context: this.getMatchContext(classNode, searchTerm),
        highlights: this.getTextHighlights(classNode.name, searchTerm)
      };

      matches.push(match);
    }

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    const searchTime = Date.now() - startTime;
    const suggestions = this.generateSearchSuggestions(searchTerm, matches.length);

    return {
      queryInfo: query,
      rootNodes: matches.slice(0, 20).map(m => m.classNode), // Top 20 matches
      traversalPaths: [],
      conceptMappings: [],
      insights: [],
      quickFinds: [{
        query: searchTerm,
        matches: matches.slice(0, 50), // Top 50 matches for display
        totalMatches: matches.length,
        searchTime,
        suggestions
      }],
      statistics: {} as TraversalStatistics
    };
  }

  // Helper methods for traversal algorithms

  private matchesQuery(classNode: ClassNode, query: ClassTraversalQuery): boolean {
    if (query.className && !classNode.name.toLowerCase().includes(query.className.toLowerCase())) {
      return false;
    }
    
    if (query.namespace && !classNode.namespace.toLowerCase().includes(query.namespace.toLowerCase())) {
      return false;
    }
    
    if (query.searchTerm) {
      const searchTerm = query.searchTerm.toLowerCase();
      return (
        classNode.name.toLowerCase().includes(searchTerm) ||
        classNode.qualifiedName.toLowerCase().includes(searchTerm) ||
        classNode.conceptTags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    return true;
  }

  private findInheritancePaths(classNode: ClassNode, maxDepth: number): TraversalPath[] {
    const paths: TraversalPath[] = [];
    const visited = new Set<string>();

    const traverse = (currentNode: ClassNode, currentPath: string[], relationships: string[], depth: number) => {
      if (depth > maxDepth || visited.has(currentNode.id)) return;
      
      visited.add(currentNode.id);
      currentPath.push(currentNode.id);

      // Find inheritance relationships
      const inheritanceRelationships = currentNode.relationships.filter(rel => 
        rel.type === RelationshipType.EXTENDS || rel.type === RelationshipType.IMPLEMENTS
      );

      if (inheritanceRelationships.length === 0 && currentPath.length > 1) {
        // End of inheritance chain
        paths.push({
          pathId: `inheritance-${currentPath.join('-')}`,
          type: TraversalType.INHERITANCE_CHAIN,
          nodes: [...currentPath],
          relationships: [...relationships],
          depth: depth,
          significance: this.calculatePathSignificance(currentPath),
          businessContext: `Inheritance chain of ${currentPath.length} classes`,
          conceptualMeaning: 'Class hierarchy representing is-a relationships'
        });
      }

      for (const rel of inheritanceRelationships) {
        const targetNode = this.findClassByQualifiedName(rel.target);
        if (targetNode && !visited.has(targetNode.id)) {
          relationships.push(rel.type);
          traverse(targetNode, [...currentPath], [...relationships], depth + 1);
          relationships.pop();
        }
      }

      visited.delete(currentNode.id);
      currentPath.pop();
    };

    traverse(classNode, [], [], 0);
    return paths;
  }

  private findCompositionPaths(classNode: ClassNode, maxDepth: number): TraversalPath[] {
    const paths: TraversalPath[] = [];
    const visited = new Set<string>();

    const traverse = (currentNode: ClassNode, currentPath: string[], relationships: string[], depth: number) => {
      if (depth > maxDepth || visited.has(currentNode.id)) return;
      
      visited.add(currentNode.id);
      currentPath.push(currentNode.id);

      const compositionRelationships = currentNode.relationships.filter(rel => 
        rel.type === RelationshipType.COMPOSES || rel.type === RelationshipType.AGGREGATES
      );

      for (const rel of compositionRelationships) {
        const targetNode = this.findClassByQualifiedName(rel.target);
        if (targetNode && !visited.has(targetNode.id)) {
          relationships.push(rel.type);
          traverse(targetNode, [...currentPath], [...relationships], depth + 1);
          relationships.pop();
        }
      }

      if (currentPath.length > 1) {
        paths.push({
          pathId: `composition-${currentPath.join('-')}`,
          type: TraversalType.COMPOSITION_TREE,
          nodes: [...currentPath],
          relationships: [...relationships],
          depth: depth,
          significance: this.calculatePathSignificance(currentPath),
          businessContext: `Composition structure of ${currentPath.length} classes`,
          conceptualMeaning: 'Object composition representing has-a relationships'
        });
      }

      visited.delete(currentNode.id);
      currentPath.pop();
    };

    traverse(classNode, [], [], 0);
    return paths;
  }

  private findDependencyPaths(classNode: ClassNode, maxDepth: number): TraversalPath[] {
    const paths: TraversalPath[] = [];
    const visited = new Set<string>();

    const traverse = (currentNode: ClassNode, currentPath: string[], relationships: string[], depth: number) => {
      if (depth > maxDepth || visited.has(currentNode.id)) return;
      
      visited.add(currentNode.id);
      currentPath.push(currentNode.id);

      const dependencyRelationships = currentNode.relationships.filter(rel => 
        rel.type === RelationshipType.USES || rel.type === RelationshipType.DEPENDS_ON
      );

      for (const rel of dependencyRelationships.slice(0, 3)) { // Limit to avoid explosion
        const targetNode = this.findClassByQualifiedName(rel.target);
        if (targetNode && !visited.has(targetNode.id)) {
          relationships.push(rel.type);
          traverse(targetNode, [...currentPath], [...relationships], depth + 1);
          relationships.pop();
        }
      }

      if (currentPath.length > 1) {
        paths.push({
          pathId: `dependency-${currentPath.join('-')}`,
          type: TraversalType.DEPENDENCY_GRAPH,
          nodes: [...currentPath],
          relationships: [...relationships],
          depth: depth,
          significance: this.calculatePathSignificance(currentPath),
          businessContext: `Dependency chain of ${currentPath.length} classes`,
          conceptualMeaning: 'Dependencies representing uses relationships'
        });
      }

      visited.delete(currentNode.id);
      currentPath.pop();
    };

    traverse(classNode, [], [], 0);
    return paths;
  }

  private findClassByQualifiedName(qualifiedName: string): ClassNode | undefined {
    return Array.from(this.classCache.values()).find(node => 
      node.qualifiedName === qualifiedName
    );
  }

  private calculatePathSignificance(nodePath: string[]): number {
    if (nodePath.length === 0) return 0;

    let significance = 0;
    let totalRelevance = 0;
    let complexityFactor = 0;

    for (const nodeId of nodePath) {
      const classNode = this.classCache.get(nodeId);
      if (classNode) {
        totalRelevance += classNode.businessRelevance;
        complexityFactor += Math.min(1, classNode.complexity.cyclomaticComplexity / 20);
      }
    }

    const averageRelevance = totalRelevance / nodePath.length;
    const averageComplexity = complexityFactor / nodePath.length;
    const pathLengthFactor = Math.min(1, nodePath.length / 5);

    significance = (averageRelevance * 0.5) + (pathLengthFactor * 0.3) + (averageComplexity * 0.2);

    return Math.max(0, Math.min(1, significance));
  }

  // Quick find helper methods

  private determineMatchType(classNode: ClassNode, searchTerm: string): MatchType {
    const searchTermLower = searchTerm.toLowerCase();
    const nameLower = classNode.name.toLowerCase();

    if (nameLower === searchTermLower) return MatchType.EXACT_NAME;
    if (nameLower.includes(searchTermLower)) return MatchType.PARTIAL_NAME;
    
    if (classNode.methods.some(method => method.name.toLowerCase().includes(searchTermLower))) {
      return MatchType.METHOD_NAME;
    }
    
    if (classNode.properties.some(prop => prop.name.toLowerCase().includes(searchTermLower))) {
      return MatchType.PROPERTY_NAME;
    }
    
    if (classNode.conceptTags.some(tag => tag.toLowerCase().includes(searchTermLower))) {
      return MatchType.CONCEPT_TAG;
    }
    
    return MatchType.USAGE_CONTEXT;
  }

  private calculateMatchScore(classNode: ClassNode, searchTerm: string): number {
    const searchTermLower = searchTerm.toLowerCase();
    const nameLower = classNode.name.toLowerCase();

    let score = 0;

    // Exact name match
    if (nameLower === searchTermLower) score += 1.0;
    
    // Partial name match
    else if (nameLower.includes(searchTermLower)) {
      const ratio = searchTermLower.length / nameLower.length;
      score += 0.8 * ratio;
    }
    
    // Method name match
    const methodMatches = classNode.methods.filter(method => 
      method.name.toLowerCase().includes(searchTermLower)
    ).length;
    score += Math.min(0.3, methodMatches * 0.1);
    
    // Property name match
    const propertyMatches = classNode.properties.filter(prop => 
      prop.name.toLowerCase().includes(searchTermLower)
    ).length;
    score += Math.min(0.2, propertyMatches * 0.1);
    
    // Concept tag match
    const tagMatches = classNode.conceptTags.filter(tag => 
      tag.toLowerCase().includes(searchTermLower)
    ).length;
    score += Math.min(0.4, tagMatches * 0.2);
    
    // Business relevance boost
    score += classNode.businessRelevance * 0.2;
    
    return Math.min(1, score);
  }

  private getMatchedText(classNode: ClassNode, searchTerm: string): string {
    const searchTermLower = searchTerm.toLowerCase();
    
    if (classNode.name.toLowerCase().includes(searchTermLower)) {
      return classNode.name;
    }
    
    const methodMatch = classNode.methods.find(method => 
      method.name.toLowerCase().includes(searchTermLower)
    );
    if (methodMatch) {
      return `${classNode.name}.${methodMatch.name}()`;
    }
    
    const propertyMatch = classNode.properties.find(prop => 
      prop.name.toLowerCase().includes(searchTermLower)
    );
    if (propertyMatch) {
      return `${classNode.name}.${propertyMatch.name}`;
    }
    
    const tagMatch = classNode.conceptTags.find(tag => 
      tag.toLowerCase().includes(searchTermLower)
    );
    if (tagMatch) {
      return `[${tagMatch}] ${classNode.name}`;
    }
    
    return classNode.name;
  }

  private getMatchContext(classNode: ClassNode, searchTerm: string): string {
    return `${classNode.type} in ${classNode.namespace} (${classNode.filePath})`;
  }

  private getTextHighlights(text: string, searchTerm: string): TextHighlight[] {
    const highlights: TextHighlight[] = [];
    const textLower = text.toLowerCase();
    const searchTermLower = searchTerm.toLowerCase();
    
    let index = textLower.indexOf(searchTermLower);
    while (index !== -1) {
      highlights.push({
        start: index,
        end: index + searchTermLower.length,
        type: 'match'
      });
      
      index = textLower.indexOf(searchTermLower, index + 1);
    }
    
    return highlights;
  }

  private generateSearchSuggestions(searchTerm: string, matchCount: number): string[] {
    const suggestions: string[] = [];
    
    if (matchCount === 0) {
      suggestions.push('Try a partial class name (e.g., "User", "Service", "Controller")');
      suggestions.push('Search for architectural concepts (e.g., "repository", "factory", "observer")');
      suggestions.push('Use business domain terms (e.g., "payment", "order", "customer")');
    } else if (matchCount > 50) {
      suggestions.push('Refine your search with more specific terms');
      suggestions.push('Add namespace qualifier (e.g., "com.example.User")');
      suggestions.push('Try method or property names');
    }
    
    // Suggest related terms from concept mappings
    for (const [concept, mapping] of this.conceptIndex) {
      if (mapping.keywords.some(keyword => keyword.includes(searchTerm.toLowerCase()))) {
        suggestions.push(`Related concept: "${concept}"`);
        break;
      }
    }
    
    return suggestions.slice(0, 3);
  }

  // Insight generation methods

  private async generateInsights(result: ClassTraversalResult, focusArea?: ClassFocusArea): Promise<ClassInsight[]> {
    const insights: ClassInsight[] = [];
    
    // Analyze for high coupling
    insights.push(...this.detectHighCouplingInsights(result));
    
    // Analyze for design patterns
    insights.push(...this.detectDesignPatternInsights(result));
    
    // Analyze for unused classes
    insights.push(...this.detectUnusedClassInsights(result));
    
    // Analyze for circular dependencies
    insights.push(...this.detectCircularDependencyInsights(result));
    
    // Focus area specific insights
    if (focusArea) {
      insights.push(...this.generateFocusAreaInsights(result, focusArea));
    }
    
    return insights.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  private detectHighCouplingInsights(result: ClassTraversalResult): ClassInsight[] {
    const insights: ClassInsight[] = [];
    
    for (const classNode of result.rootNodes) {
      if (classNode.complexity.couplingCount > 10) {
        insights.push({
          type: InsightType.HIGH_COUPLING,
          title: `High Coupling Detected: ${classNode.name}`,
          description: `Class ${classNode.name} has ${classNode.complexity.couplingCount} dependencies, indicating high coupling`,
          affectedClasses: [classNode.id],
          severity: classNode.complexity.couplingCount > 20 ? 'critical' : 'high',
          category: ClassFocusArea.ARCHITECTURE,
          actionable: true,
          recommendations: [
            'Consider applying the Dependency Inversion Principle',
            'Extract interfaces to reduce concrete dependencies',
            'Break the class into smaller, more focused components',
            'Use composition over inheritance where appropriate'
          ],
          evidence: [
            {
              type: 'metric',
              description: 'Coupling count',
              value: classNode.complexity.couplingCount,
              threshold: 10,
              context: 'Number of outbound dependencies'
            }
          ]
        });
      }
    }
    
    return insights;
  }

  private detectDesignPatternInsights(result: ClassTraversalResult): ClassInsight[] {
    const insights: ClassInsight[] = [];
    
    // Factory Pattern Detection
    const factoryClasses = result.rootNodes.filter(node => 
      node.name.toLowerCase().includes('factory') || 
      node.methods.some(method => method.name.toLowerCase().includes('create'))
    );
    
    if (factoryClasses.length > 0) {
      insights.push({
        type: InsightType.DESIGN_PATTERN_DETECTED,
        title: 'Factory Pattern Detected',
        description: `Found ${factoryClasses.length} classes implementing Factory pattern`,
        affectedClasses: factoryClasses.map(c => c.id),
        severity: 'low',
        category: ClassFocusArea.ARCHITECTURE,
        actionable: false,
        recommendations: [
          'Consider consistency in factory method naming',
          'Ensure factories handle all creation scenarios',
          'Document factory responsibilities clearly'
        ],
        evidence: [
          {
            type: 'pattern',
            description: 'Factory pattern indicators',
            context: `Classes with factory naming or create methods`
          }
        ]
      });
    }
    
    return insights;
  }

  private detectUnusedClassInsights(result: ClassTraversalResult): ClassInsight[] {
    const insights: ClassInsight[] = [];
    
    const unusedClasses = result.rootNodes.filter(node => 
      node.usage.referencedByCount === 0 && 
      node.usage.instantiationCount === 0 &&
      !node.filePath.toLowerCase().includes('test')
    );
    
    if (unusedClasses.length > 0) {
      insights.push({
        type: InsightType.UNUSED_CLASS,
        title: `Unused Classes Detected`,
        description: `Found ${unusedClasses.length} classes that appear to be unused`,
        affectedClasses: unusedClasses.map(c => c.id),
        severity: 'medium',
        category: ClassFocusArea.ARCHITECTURE,
        actionable: true,
        recommendations: [
          'Review if these classes are truly unused',
          'Remove unused classes to reduce code complexity',
          'Check for dynamic or reflection-based usage',
          'Consider if classes are part of public API'
        ],
        evidence: [
          {
            type: 'usage',
            description: 'Zero references found',
            value: 0,
            context: 'Static analysis of usage patterns'
          }
        ]
      });
    }
    
    return insights;
  }

  private detectCircularDependencyInsights(result: ClassTraversalResult): ClassInsight[] {
    const insights: ClassInsight[] = [];
    
    const circularPaths = result.traversalPaths.filter(path => {
      const firstNode = path.nodes[0];
      const lastNode = path.nodes[path.nodes.length - 1];
      return path.nodes.length > 2 && firstNode === lastNode;
    });
    
    if (circularPaths.length > 0) {
      const affectedClasses = new Set<string>();
      circularPaths.forEach(path => path.nodes.forEach(node => affectedClasses.add(node)));
      
      insights.push({
        type: InsightType.CIRCULAR_DEPENDENCY,
        title: 'Circular Dependencies Detected',
        description: `Found ${circularPaths.length} circular dependency chains`,
        affectedClasses: Array.from(affectedClasses),
        severity: 'high',
        category: ClassFocusArea.ARCHITECTURE,
        actionable: true,
        recommendations: [
          'Break circular dependencies using dependency injection',
          'Extract shared interfaces to break direct dependencies',
          'Consider using events or observer pattern',
          'Refactor to establish clear dependency direction'
        ],
        evidence: [
          {
            type: 'relationship',
            description: 'Circular dependency chains',
            value: circularPaths.length,
            context: 'Detected through dependency graph analysis'
          }
        ]
      });
    }
    
    return insights;
  }

  private generateFocusAreaInsights(result: ClassTraversalResult, focusArea: ClassFocusArea): ClassInsight[] {
    const insights: ClassInsight[] = [];
    
    switch (focusArea) {
      case ClassFocusArea.SECURITY:
        // Look for security-related classes without proper patterns
        const securityClasses = result.rootNodes.filter(node => 
          node.conceptTags.includes('authentication') || 
          node.conceptTags.includes('security')
        );
        
        if (securityClasses.length > 0) {
          insights.push({
            type: InsightType.BUSINESS_LOGIC_LEAK,
            title: 'Security Architecture Review Needed',
            description: `Found ${securityClasses.length} security-related classes that may need architecture review`,
            affectedClasses: securityClasses.map(c => c.id),
            severity: 'medium',
            category: ClassFocusArea.SECURITY,
            actionable: true,
            recommendations: [
              'Review security class responsibilities',
              'Ensure proper separation of security concerns',
              'Validate authentication and authorization patterns',
              'Check for security best practices compliance'
            ],
            evidence: [
              {
                type: 'pattern',
                description: 'Security-related classes identified',
                context: 'Classes with security concept tags'
              }
            ]
          });
        }
        break;
        
      case ClassFocusArea.PERFORMANCE:
        // Look for performance hotspots
        const hotspotClasses = result.rootNodes.filter(node => 
          node.usage.isHotspot || 
          node.complexity.cyclomaticComplexity > 20
        );
        
        if (hotspotClasses.length > 0) {
          insights.push({
            type: InsightType.HOTSPOT_CLASS,
            title: 'Performance Hotspots Identified',
            description: `Found ${hotspotClasses.length} classes that may be performance bottlenecks`,
            affectedClasses: hotspotClasses.map(c => c.id),
            severity: 'medium',
            category: ClassFocusArea.PERFORMANCE,
            actionable: true,
            recommendations: [
              'Profile these classes for performance bottlenecks',
              'Consider caching strategies where appropriate',
              'Review algorithms for optimization opportunities',
              'Monitor resource usage patterns'
            ],
            evidence: [
              {
                type: 'metric',
                description: 'High complexity or frequent changes',
                context: 'Performance risk indicators'
              }
            ]
          });
        }
        break;
    }
    
    return insights;
  }

  private async calculateTraversalStatistics(result: ClassTraversalResult, traversalTime: number): Promise<TraversalStatistics> {
    const complexities = result.rootNodes.map(node => node.complexity.cyclomaticComplexity);
    const couplingCounts = result.rootNodes.map(node => node.complexity.couplingCount);
    const cohesionScores = result.rootNodes.map(node => node.complexity.cohesionScore);
    
    const averageComplexity = complexities.length > 0 ? 
      complexities.reduce((sum, c) => sum + c, 0) / complexities.length : 0;
    
    const mostCoupledClass = result.rootNodes.reduce((most, current) => 
      current.complexity.couplingCount > most.complexity.couplingCount ? current : most,
      result.rootNodes[0] || {} as ClassNode
    );
    
    const leastCohesiveClass = result.rootNodes.reduce((least, current) => 
      current.complexity.cohesionScore < least.complexity.cohesionScore ? current : least,
      result.rootNodes[0] || {} as ClassNode
    );

    const businessCriticalClasses = result.rootNodes
      .filter(node => node.businessRelevance > 0.8)
      .map(node => node.name);

    const architecturalHotspots = result.rootNodes
      .filter(node => node.complexity.couplingCount > 10 || node.complexity.cyclomaticComplexity > 15)
      .map(node => node.name);

    const performanceBottlenecks = result.rootNodes
      .filter(node => node.usage.isHotspot && node.complexity.cyclomaticComplexity > 10)
      .map(node => node.name);

    const securityRisks = result.rootNodes
      .filter(node => 
        node.conceptTags.includes('authentication') && 
        (node.complexity.couplingCount > 8 || node.usage.referencedByCount > 15)
      )
      .map(node => node.name);

    const inheritanceDepths = result.rootNodes.map(node => node.complexity.inheritanceDepth);
    const deepestInheritanceChain = inheritanceDepths.length > 0 ? Math.max(...inheritanceDepths) : 0;

    const totalRelationships = result.rootNodes.reduce((sum, node) => sum + node.relationships.length, 0);

    return {
      totalNodesAnalyzed: result.rootNodes.length,
      totalRelationshipsFound: totalRelationships,
      averageComplexity,
      deepestInheritanceChain,
      mostCoupledClass: mostCoupledClass?.name || 'N/A',
      leastCohesiveClass: leastCohesiveClass?.name || 'N/A',
      businessCriticalClasses,
      architecturalHotspots,
      performanceBottlenecks,
      securityRisks,
      traversalTime
    };
  }

  // Public API methods for integration with knowledge system

  async quickFindClasses(projectPath: string, searchTerm: string): Promise<QuickMatch[]> {
    const result = await this.performTraversal(projectPath, {
      searchTerm,
      traversalType: TraversalType.QUICK_FIND
    });
    
    return result.quickFinds[0]?.matches || [];
  }

  async getClassHierarchy(projectPath: string, className: string, maxDepth = 5): Promise<TraversalPath[]> {
    const result = await this.performTraversal(projectPath, {
      className,
      traversalType: TraversalType.INHERITANCE_CHAIN,
      maxDepth
    });
    
    return result.traversalPaths;
  }

  async getConceptMap(projectPath: string, concept: string): Promise<ConceptMapping[]> {
    const result = await this.performTraversal(projectPath, {
      searchTerm: concept,
      traversalType: TraversalType.CONCEPT_MAP
    });
    
    return result.conceptMappings;
  }

  async getClassInsights(projectPath: string, focusArea?: ClassFocusArea): Promise<ClassInsight[]> {
    const result = await this.performTraversal(projectPath, {
      traversalType: TraversalType.USAGE_PATTERNS,
      focusArea,
      includeRelated: true
    });
    
    return result.insights;
  }

  // Cache management
  clearCache(): void {
    this.classCache.clear();
    this.relationshipIndex.clear();
    this.conceptIndex.clear();
    this.searchIndex.clear();
    this.logger.info('Class traversal cache cleared');
  }

  getCacheStats(): { classes: number; relationships: number; concepts: number; searchTerms: number } {
    return {
      classes: this.classCache.size,
      relationships: this.relationshipIndex.size,
      concepts: this.conceptIndex.size,
      searchTerms: this.searchIndex.size
    };
  }
}

export default ClassTraversalEngine;