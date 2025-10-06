/**
 * Knowledge Base Updater - Single Responsibility: Updating all knowledge base systems
 */
export declare class KnowledgeBaseUpdater {
    update(analysis: any): Promise<void>;
    private updateAnalysisRepository;
    private updateSemanticSearch;
    private updateSemanticGraph;
    private updateRedisCache;
    private updateProjectIntelligence;
}
//# sourceMappingURL=knowledge-base-updater.d.ts.map