/**
 * Document Map Analyzer - Semantic Documentation Understanding
 * Maps project documentation structure and provides semantic search for Claude Code context
 */
export interface DocumentMapRequest {
    projectPath: string;
    includeCodeStructure?: boolean;
    generateMermaid?: boolean;
    maxDepth?: number;
    excludePatterns?: string[];
}
export interface DocumentMapResult {
    documents: DocumentNode[];
    mainClasses: ClassSummary[];
    topics: TopicCluster[];
    crossReferences: CrossReference[];
    mermaidMap?: string;
    searchIndex: SemanticIndex;
    statistics: DocumentStatistics;
}
export interface DocumentNode {
    id: string;
    path: string;
    title: string;
    type: 'readme' | 'api' | 'guide' | 'architecture' | 'changelog' | 'contributing' | 'other';
    summary: string;
    topics: string[];
    referencedClasses: string[];
    relatedDocs: string[];
    codeExamples: CodeSnippet[];
    wordCount: number;
    lastModified: Date;
}
export interface ClassSummary {
    name: string;
    mentions: DocumentMention[];
    description: string;
    category: 'core' | 'utility' | 'interface' | 'component';
}
export interface DocumentMention {
    documentId: string;
    documentPath: string;
    context: string;
    lineNumber: number;
}
export interface TopicCluster {
    topic: string;
    documents: string[];
    keywords: string[];
    importance: 'high' | 'medium' | 'low';
}
export interface CrossReference {
    from: string;
    to: string;
    type: 'links' | 'mentions' | 'example';
    context?: string;
}
export interface CodeSnippet {
    language: string;
    code: string;
    description?: string;
    lineStart: number;
    lineEnd: number;
}
export interface SemanticIndex {
    documents: Map<string, DocumentVector>;
    topics: Map<string, string[]>;
    classes: Map<string, string[]>;
}
export interface DocumentVector {
    documentId: string;
    keywords: string[];
    semanticTokens: string[];
}
export interface DocumentStatistics {
    totalDocuments: number;
    totalWords: number;
    documentTypes: Record<string, number>;
    averageWordCount: number;
    topicCoverage: number;
    codeExampleCount: number;
}
export declare class DocumentMapAnalyzer {
    private logger;
    analyzeDocumentation(params: DocumentMapRequest): Promise<DocumentMapResult>;
    searchDocumentation(query: string, searchIndex: SemanticIndex, context?: string): Promise<DocumentNode[]>;
    private findDocumentationFiles;
    private analyzeDocuments;
    private extractTitle;
    private determineDocType;
    private generateSummary;
    private extractTopics;
    private extractClassReferences;
    private extractDocLinks;
    private extractCodeExamples;
    private extractMainClasses;
    private generateClassDescription;
    private categorizeClass;
    private identifyTopicClusters;
    private extractTopicKeywords;
    private assessTopicImportance;
    private findCrossReferences;
    private buildSearchIndex;
    private tokenize;
    private generateMermaidMap;
    private calculateStatistics;
    private generateDocId;
}
export default DocumentMapAnalyzer;
//# sourceMappingURL=map-analyzer.d.ts.map