/**
 * Semantic Knowledge Graph Types for CodeMind
 * 
 * A knowledge graph representing code semantics using triads (subject-predicate-object)
 * to capture relationships between code entities, concepts, and patterns.
 */

export interface KnowledgeNode {
  id: string;
  type: NodeType;
  name: string;
  namespace?: string;
  sourceLocation?: SourceLocation;
  metadata: NodeMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeTriad {
  id: string;
  subject: string; // Node ID
  predicate: RelationType;
  object: string; // Node ID or literal value
  confidence: number; // 0.0 to 1.0
  source: TriadSource;
  metadata: TriadMetadata;
  createdAt: Date;
}

export enum NodeType {
  // Code Entities
  CLASS = 'class',
  FUNCTION = 'function',
  METHOD = 'method',
  INTERFACE = 'interface',
  VARIABLE = 'variable',
  CONSTANT = 'constant',
  TYPE = 'type',
  ENUM = 'enum',
  NAMESPACE = 'namespace',
  MODULE = 'module',
  PACKAGE = 'package',
  
  // Architectural Entities
  SERVICE = 'service',
  COMPONENT = 'component',
  REPOSITORY = 'repository',
  CONTROLLER = 'controller',
  MODEL = 'model',
  
  // Conceptual Entities
  PATTERN = 'pattern',
  CONCEPT = 'concept',
  FEATURE = 'feature',
  BUSINESS_RULE = 'business_rule',
  REQUIREMENT = 'requirement',
  
  // Infrastructure
  DATABASE_TABLE = 'database_table',
  API_ENDPOINT = 'api_endpoint',
  CONFIGURATION = 'configuration',
  DEPENDENCY = 'dependency'
}

export enum RelationType {
  // Structural Relationships
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  INHERITS_FROM = 'inherits_from',
  CONTAINS = 'contains',
  COMPOSED_OF = 'composed_of',
  PART_OF = 'part_of',
  
  // Behavioral Relationships
  CALLS = 'calls',
  INVOKES = 'invokes',
  RETURNS = 'returns',
  ACCEPTS = 'accepts',
  THROWS = 'throws',
  HANDLES = 'handles',
  
  // Data Flow Relationships
  READS_FROM = 'reads_from',
  WRITES_TO = 'writes_to',
  TRANSFORMS = 'transforms',
  PRODUCES = 'produces',
  CONSUMES = 'consumes',
  
  // Dependency Relationships
  DEPENDS_ON = 'depends_on',
  IMPORTS = 'imports',
  EXPORTS = 'exports',
  REQUIRES = 'requires',
  PROVIDES = 'provides',
  
  // Pattern Relationships
  FOLLOWS_PATTERN = 'follows_pattern',
  IMPLEMENTS_PATTERN = 'implements_pattern',
  VIOLATES_PATTERN = 'violates_pattern',
  
  // Semantic Relationships
  IS_SIMILAR_TO = 'is_similar_to',
  IS_OPPOSITE_OF = 'is_opposite_of',
  IS_TYPE_OF = 'is_type_of',
  IS_INSTANCE_OF = 'is_instance_of',
  REPRESENTS = 'represents',
  
  // Business Logic Relationships
  SATISFIES = 'satisfies',
  VALIDATES = 'validates',
  ENFORCES = 'enforces',
  TRIGGERS = 'triggers',
  
  // Quality Relationships
  DUPLICATES = 'duplicates',
  REFACTORS = 'refactors',
  REPLACES = 'replaces',
  IMPROVES = 'improves'
}

export interface SourceLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  repository?: string;
  commit?: string;
}

export interface NodeMetadata {
  complexity?: number;
  importance?: number;
  stability?: number;
  testCoverage?: number;
  documentation?: string;
  tags: string[];
  visibility?: 'public' | 'private' | 'protected' | 'internal';
  [key: string]: any;
}

export interface TriadMetadata {
  strength?: number; // Relationship strength 0?.0-1.0
  frequency?: number; // How often this relationship occurs
  context?: string; // Contextual information
  evidence?: Evidence[]; // Supporting evidence
  [key: string]: any;
}

export interface Evidence {
  type: EvidenceType;
  source: string;
  location?: SourceLocation;
  confidence: number;
  description: string;
}

export enum EvidenceType {
  STATIC_ANALYSIS = 'static_analysis',
  DYNAMIC_ANALYSIS = 'dynamic_analysis',
  PATTERN_MATCHING = 'pattern_matching',
  SEMANTIC_SIMILARITY = 'semantic_similarity',
  DOCUMENTATION = 'documentation',
  TEST_ANALYSIS = 'test_analysis',
  USER_ANNOTATION = 'user_annotation'
}

export enum TriadSource {
  STATIC_ANALYZER = 'static_analyzer',
  AST_PARSER = 'ast_parser',
  DEPENDENCY_ANALYZER = 'dependency_analyzer',
  PATTERN_DETECTOR = 'pattern_detector',
  SEMANTIC_ANALYZER = 'semantic_analyzer',
  USER_INPUT = 'user_input',
  MACHINE_LEARNING = 'machine_learning',
  GIT_ANALYSIS = 'git_analysis'
}

// Query and Traversal Types

export interface GraphQuery {
  nodes?: NodeQuery;
  triads?: TriadQuery;
  traversal?: TraversalQuery;
  limit?: number;
  offset?: number;
}

export interface NodeQuery {
  types?: NodeType[];
  names?: string[];
  namespaces?: string[];
  metadata?: Record<string, any>;
  sourceLocation?: SourceLocationQuery;
}

export interface TriadQuery {
  subjects?: string[];
  predicates?: RelationType[];
  objects?: string[];
  confidence?: { min?: number; max?: number };
  sources?: TriadSource[];
}

export interface TraversalQuery {
  startNodes: string[];
  relations: RelationType[];
  direction: 'incoming' | 'outgoing' | 'both';
  maxDepth?: number;
  filters?: NodeQuery;
}

export interface SourceLocationQuery {
  filePath?: string;
  filePattern?: string;
  lineRange?: { start: number; end: number };
}

// Analysis and Insights Types

export interface GraphAnalysis {
  nodeCount: number;
  triadCount: number;
  relationshipDistribution: Record<RelationType, number>;
  nodeTypeDistribution: Record<NodeType, number>;
  centralityScores: Record<string, number>;
  clusteringCoefficient: number;
  stronglyConnectedComponents: string[][];
}

export interface SemanticCluster {
  id: string;
  name: string;
  nodes: string[];
  coherenceScore: number;
  representativeTriads: KnowledgeTriad[];
  description?: string;
}

export interface ArchitecturalInsight {
  type: InsightType;
  confidence: number;
  description: string;
  affectedNodes: string[];
  recommendations: string[];
  evidence: Evidence[];
}

export enum InsightType {
  DESIGN_PATTERN_DETECTED = 'design_pattern_detected',
  ANTI_PATTERN_DETECTED = 'anti_pattern_detected',
  ARCHITECTURAL_VIOLATION = 'architectural_violation',
  COUPLING_ISSUE = 'coupling_issue',
  COHESION_OPPORTUNITY = 'cohesion_opportunity',
  REFACTORING_OPPORTUNITY = 'refactoring_opportunity',
  DUPLICATE_LOGIC = 'duplicate_logic',
  MISSING_ABSTRACTION = 'missing_abstraction'
}

// Graph Operations Types

export interface GraphMutation {
  addNodes?: KnowledgeNode[];
  addTriads?: KnowledgeTriad[];
  updateNodes?: Partial<KnowledgeNode>[];
  updateTriads?: Partial<KnowledgeTriad>[];
  removeNodes?: string[];
  removeTriads?: string[];
}

export interface GraphSnapshot {
  timestamp: Date;
  nodeCount: number;
  triadCount: number;
  hash: string;
  metadata: Record<string, any>;
}

export interface GraphDiff {
  fromSnapshot: string;
  toSnapshot: string;
  addedNodes: KnowledgeNode[];
  removedNodes: KnowledgeNode[];
  addedTriads: KnowledgeTriad[];
  removedTriads: KnowledgeTriad[];
  modifiedNodes: Array<{
    before: KnowledgeNode;
    after: KnowledgeNode;
  }>;
  modifiedTriads: Array<{
    before: KnowledgeTriad;
    after: KnowledgeTriad;
  }>;
}