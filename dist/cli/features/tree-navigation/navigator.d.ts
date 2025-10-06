import { AnalysisTool } from '../../../shared/tool-interface';
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
    similarityMappings: Array<{
        nodeId: string;
        similarTo: string;
        similarity: number;
    }>;
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
export declare enum NodeType {
    FILE = "file",
    MODULE = "module",
    PACKAGE = "package",
    EXTERNAL = "external",
    VIRTUAL = "virtual"
}
export declare enum DependencyType {
    IMPORT = "import",
    EXPORT = "export",
    DYNAMIC_IMPORT = "dynamic_import",
    TYPE_ONLY = "type_only",
    INHERITANCE = "inheritance",
    COMPOSITION = "composition"
}
export declare class TreeNavigator extends AnalysisTool {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    languages: string[];
    frameworks: string[];
    purposes: string[];
    intents: string[];
    keywords: string[];
    performanceImpact: 'low' | 'medium' | 'high';
    tokenUsage: 'minimal' | 'low' | 'medium' | 'high' | 'variable';
    capabilities: {
        semanticClustering: boolean;
        similarityDetection: boolean;
        interactiveMode: boolean;
        dependencyTracking: boolean;
        circularDependencyDetection: boolean;
    };
    private logger;
    private astAnalyzer;
    private rl?;
    /**
     * Database tool name for API calls
     */
    getDatabaseToolName(): string;
    /**
     * Perform the actual tree navigation analysis
     */
    performAnalysis(projectPath: string, projectId: string, parameters: any): Promise<any>;
    /**
     * Check if tool is applicable to the project
     */
    isApplicable(projectPath: string, context: any): boolean;
    /**
     * Generate recommendations from tree analysis
     */
    getRecommendations(analysisResult: any): string[];
    /**
     * Convert tree structure to database format
     */
    private convertTreeToDbFormat;
    /**
     * Map internal node types to database enum values
     */
    private mapNodeTypeToDb;
    /**
     * Generate analysis summary
     */
    private generateSummary;
    /**
     * Calculate tree metrics
     */
    private calculateMetrics;
    analyze(params: any): Promise<any>;
    buildDependencyTree(request: TreeNavigationRequest, fileContext?: any): Promise<DependencyTree>;
    buildTree(request: TreeNavigationRequest, fileContext?: any): Promise<DependencyTree>;
    private getProjectFiles;
    private createFileNode;
    private detectLanguage;
    private generateNodeId;
    private isEntryPoint;
    private createDependencyEdge;
    private resolveImportPath;
    private mapDependencyType;
    private calculateEdgeWeight;
    private buildTreeStructure;
    private detectCircularDependencies;
    private calculateCycleSeverity;
    private generateCycleDescription;
    private generateCycleSuggestions;
    private deduplicateCycles;
    private createModuleClusters;
    private calculateCohesion;
    private calculateCoupling;
    private calculateTreeStatistics;
    private calculateNodeDepth;
    private findRootNode;
    private createVirtualRoot;
    private isPartOfCircularDependency;
    startInteractiveMode(tree: DependencyTree): Promise<void>;
    private navigationLoop;
    private printCommands;
    private printCurrentNode;
    private executeCommand;
    private listChildren;
    private getNodeIcon;
    private navigateTo;
    private navigateToParent;
    private navigateBack;
    private showDetailedInfo;
    private showDependencies;
    private showCircularDependencies;
    private showStatistics;
    printTree(tree: DependencyTree, maxDepth?: number): void;
    private printNodeRecursive;
    private prompt;
    /**
     * Enhance tree with semantic analysis - replaces vector search functionality
     */
    enhanceWithSemanticAnalysis(tree: DependencyTree): Promise<DependencyTree>;
    /**
     * Add semantic metadata to nodes for business logic understanding
     */
    private addSemanticMetadata;
    /**
     * Extract semantic keywords from file content
     */
    private extractSemanticKeywords;
    /**
     * Identify business domain from content and path
     */
    private identifyBusinessDomain;
    /**
     * Identify architectural role from content and path
     */
    private identifyArchitecturalRole;
    /**
     * Find semantic similarities between nodes (replaces vector search)
     */
    private findSemanticSimilarities;
    /**
     * Calculate semantic similarity between two nodes
     */
    private calculateSemanticSimilarity;
    /**
     * Create semantic clusters based on business domains and architectural roles
     */
    private createSemanticClusters;
    /**
     * Calculate cluster cohesion based on internal similarities
     */
    private calculateClusterCohesion;
    /**
     * Calculate cluster coupling based on external similarities
     */
    private calculateClusterCoupling;
    private convertClustersToRecord;
}
export default TreeNavigator;
//# sourceMappingURL=navigator.d.ts.map