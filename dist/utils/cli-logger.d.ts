/**
 * Enhanced CLI Logger with Colors for Semantic Graph Integration
 * Provides visual feedback about semantic graph usage and status
 */
export interface SemanticStatus {
    enabled: boolean;
    connected: boolean;
    nodesCount?: number;
    relationshipsCount?: number;
    searchResultsCount?: number;
    relevantConceptsCount?: number;
}
export declare class CLILogger {
    private static instance;
    static getInstance(): CLILogger;
    info(message: string, semanticStatus?: SemanticStatus): void;
    success(message: string, semanticStatus?: SemanticStatus): void;
    warning(message: string, semanticStatus?: SemanticStatus): void;
    error(message: string, details?: string): void;
    semanticInitializing(): void;
    semanticConnected(stats?: {
        nodes: number;
        relationships: number;
    }): void;
    semanticDisconnected(): void;
    semanticSearching(query: string, intent?: string): void;
    semanticResults(results: {
        primaryResults: number;
        relatedConcepts: number;
        crossDomainInsights: number;
        duration: number;
    }): void;
    contextOptimizing(query: string, tokenBudget: number, semanticEnabled: boolean): void;
    contextResults(results: {
        strategy: string;
        estimatedTokens: number;
        tokenBudget: number;
        priorityFiles: number;
        semanticBoosts?: number;
    }): void;
    fileList(files: Array<{
        path: string;
        score: number;
        importance: string;
        language: string;
        semanticBoost?: boolean;
        summary?: string;
    }>): void;
    conceptsList(concepts: Array<{
        name: string;
        domain?: string;
        strength?: number;
        relatedCode?: number;
        relatedDocs?: number;
    }>): void;
    recommendationsList(recommendations: string[]): void;
    commandHeader(command: string, description: string): void;
    statusLine(label: string, value: string | number, status?: 'success' | 'warning' | 'error' | 'info'): void;
    progress(message: string, current: number, total: number): void;
    private getSemanticPrefix;
    private getImportanceColor;
    highlight(text: string): string;
    dim(text: string): string;
    bold(text: string): string;
    path(filePath: string): string;
    code(text: string): string;
    semanticFallback(reason: string): void;
    semanticHealthCheck(services: {
        neo4j: boolean;
        semanticGraph: boolean;
        orchestrator: boolean;
    }): void;
}
export default CLILogger;
//# sourceMappingURL=cli-logger.d.ts.map