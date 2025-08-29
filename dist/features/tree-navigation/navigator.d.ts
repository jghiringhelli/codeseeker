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
}
export interface NodeMetadata {
    exports: string[];
    imports: string[];
    lastModified: Date;
    linesOfCode: number;
    maintainabilityIndex: number;
    isEntryPoint: boolean;
    isLeaf: boolean;
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
export declare class TreeNavigator {
    private logger;
    private astAnalyzer;
    private rl?;
    analyze(params: any): Promise<any>;
    buildDependencyTree(projectPath: string): Promise<DependencyTree>;
    buildTree(request: TreeNavigationRequest): Promise<DependencyTree>;
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
}
export default TreeNavigator;
//# sourceMappingURL=navigator.d.ts.map