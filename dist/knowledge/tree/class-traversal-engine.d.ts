/**
 * Class Traversal Engine for Knowledge Integration
 * Provides advanced tree traversal capabilities for class understanding,
 * quick finding, and concept mapping within the knowledge integration system.
 */
import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
export interface ClassTraversalQuery {
    className?: string;
    namespace?: string;
    searchTerm?: string;
    traversalType: TraversalType;
    maxDepth?: number;
    includeRelated?: boolean;
    focusArea?: ClassFocusArea;
}
export declare enum TraversalType {
    INHERITANCE_CHAIN = "INHERITANCE_CHAIN",
    COMPOSITION_TREE = "COMPOSITION_TREE",
    DEPENDENCY_GRAPH = "DEPENDENCY_GRAPH",
    CONCEPT_MAP = "CONCEPT_MAP",
    USAGE_PATTERNS = "USAGE_PATTERNS",
    QUICK_FIND = "QUICK_FIND"
}
export declare enum ClassFocusArea {
    ARCHITECTURE = "ARCHITECTURE",
    BUSINESS_LOGIC = "BUSINESS_LOGIC",
    DATA_FLOW = "DATA_FLOW",
    TESTING = "TESTING",
    SECURITY = "SECURITY",
    PERFORMANCE = "PERFORMANCE"
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
    businessRelevance: number;
}
export declare enum ClassNodeType {
    CLASS = "CLASS",
    INTERFACE = "INTERFACE",
    ABSTRACT_CLASS = "ABSTRACT_CLASS",
    ENUM = "ENUM",
    TRAIT = "TRAIT",
    MIXIN = "MIXIN",
    SERVICE = "SERVICE",
    CONTROLLER = "CONTROLLER",
    REPOSITORY = "REPOSITORY",
    ENTITY = "ENTITY",
    VALUE_OBJECT = "VALUE_OBJECT",
    FACTORY = "FACTORY",
    BUILDER = "BUILDER",
    OBSERVER = "OBSERVER",
    STRATEGY = "STRATEGY"
}
export interface ClassRelationship {
    type: RelationshipType;
    target: string;
    strength: number;
    context: string;
    isKey: boolean;
}
export declare enum RelationshipType {
    EXTENDS = "EXTENDS",
    IMPLEMENTS = "IMPLEMENTS",
    COMPOSES = "COMPOSES",
    AGGREGATES = "AGGREGATES",
    USES = "USES",
    DEPENDS_ON = "DEPENDS_ON",
    CREATES = "CREATES",
    OBSERVES = "OBSERVES",
    DECORATES = "DECORATES",
    ADAPTS = "ADAPTS"
}
export interface ClassMethod {
    name: string;
    visibility: 'public' | 'private' | 'protected' | 'package';
    isStatic: boolean;
    isAbstract: boolean;
    returnType?: string;
    parameters: MethodParameter[];
    complexity: number;
    isKey: boolean;
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
    isKey: boolean;
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
    inheritanceCount: number;
    referencedByCount: number;
    testCoveragePercent: number;
    isHotspot: boolean;
    lastModified: Date;
}
export interface TraversalPath {
    pathId: string;
    type: TraversalType;
    nodes: string[];
    relationships: string[];
    depth: number;
    significance: number;
    businessContext: string;
    conceptualMeaning: string;
}
export interface ConceptMapping {
    concept: string;
    relatedClasses: string[];
    strength: number;
    category: ConceptCategory;
    description: string;
    keywords: string[];
}
export declare enum ConceptCategory {
    ARCHITECTURAL_PATTERN = "ARCHITECTURAL_PATTERN",
    BUSINESS_CONCEPT = "BUSINESS_CONCEPT",
    DATA_STRUCTURE = "DATA_STRUCTURE",
    BEHAVIORAL_PATTERN = "BEHAVIORAL_PATTERN",
    INTEGRATION_PATTERN = "INTEGRATION_PATTERN",
    SECURITY_PATTERN = "SECURITY_PATTERN"
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
export declare enum InsightType {
    DESIGN_PATTERN_DETECTED = "DESIGN_PATTERN_DETECTED",
    ANTI_PATTERN_DETECTED = "ANTI_PATTERN_DETECTED",
    HIGH_COUPLING = "HIGH_COUPLING",
    LOW_COHESION = "LOW_COHESION",
    CIRCULAR_DEPENDENCY = "CIRCULAR_DEPENDENCY",
    UNUSED_CLASS = "UNUSED_CLASS",
    HOTSPOT_CLASS = "HOTSPOT_CLASS",
    MISSING_ABSTRACTION = "MISSING_ABSTRACTION",
    OVERENGINEERED = "OVERENGINEERED",
    BUSINESS_LOGIC_LEAK = "BUSINESS_LOGIC_LEAK"
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
    matchScore: number;
    matchedText: string;
    context: string;
    highlights: TextHighlight[];
}
export declare enum MatchType {
    EXACT_NAME = "EXACT_NAME",
    PARTIAL_NAME = "PARTIAL_NAME",
    METHOD_NAME = "METHOD_NAME",
    PROPERTY_NAME = "PROPERTY_NAME",
    CONCEPT_TAG = "CONCEPT_TAG",
    ANNOTATION = "ANNOTATION",
    COMMENT = "COMMENT",
    USAGE_CONTEXT = "USAGE_CONTEXT"
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
export declare class ClassTraversalEngine extends EventEmitter {
    private logger;
    private treeNavigator;
    private classCache;
    private relationshipIndex;
    private conceptIndex;
    private searchIndex;
    constructor(logger?: Logger);
    performTraversal(projectPath: string, query: ClassTraversalQuery): Promise<ClassTraversalResult>;
    private buildClassNodes;
    private isClassFile;
    private createClassNode;
    private extractClassName;
    private extractQualifiedName;
    private inferClassType;
    private extractNamespace;
    private calculateInheritanceDepth;
    private calculateCohesionScore;
    private generateConceptTags;
    private calculateBusinessRelevance;
    private buildRelationshipIndex;
    private inferRelationshipsFromName;
    private inferRelationshipsFromPath;
    private getCommonPath;
    private buildConceptMappings;
    private calculateConceptStrength;
    private categoryConcept;
    private generateConceptDescription;
    private generateConceptKeywords;
    private buildSearchIndex;
    private performInheritanceTraversal;
    private performCompositionTraversal;
    private performDependencyTraversal;
    private performConceptTraversal;
    private performUsageTraversal;
    private performQuickFind;
    private matchesQuery;
    private findInheritancePaths;
    private findCompositionPaths;
    private findDependencyPaths;
    private findClassByQualifiedName;
    private calculatePathSignificance;
    private determineMatchType;
    private calculateMatchScore;
    private getMatchedText;
    private getMatchContext;
    private getTextHighlights;
    private generateSearchSuggestions;
    private generateInsights;
    private detectHighCouplingInsights;
    private detectDesignPatternInsights;
    private detectUnusedClassInsights;
    private detectCircularDependencyInsights;
    private generateFocusAreaInsights;
    private calculateTraversalStatistics;
    quickFindClasses(projectPath: string, searchTerm: string): Promise<QuickMatch[]>;
    getClassHierarchy(projectPath: string, className: string, maxDepth?: number): Promise<TraversalPath[]>;
    getConceptMap(projectPath: string, concept: string): Promise<ConceptMapping[]>;
    getClassInsights(projectPath: string, focusArea?: ClassFocusArea): Promise<ClassInsight[]>;
    clearCache(): void;
    getCacheStats(): {
        classes: number;
        relationships: number;
        concepts: number;
        searchTerms: number;
    };
}
export default ClassTraversalEngine;
//# sourceMappingURL=class-traversal-engine.d.ts.map