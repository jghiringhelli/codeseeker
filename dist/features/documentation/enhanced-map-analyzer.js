"use strict";
/**
 * Enhanced Document Map Analyzer with Semantic Graph Integration
 * Combines documentation analysis with graph-based semantic search
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedDocumentMapAnalyzer = void 0;
const map_analyzer_1 = require("./map-analyzer");
const semantic_graph_1 = require("../../services/semantic-graph");
const logger_1 = require("../../utils/logger");
class EnhancedDocumentMapAnalyzer extends map_analyzer_1.DocumentMapAnalyzer {
    semanticGraph;
    constructor(semanticGraph) {
        super();
        this.semanticGraph = semanticGraph || new semantic_graph_1.SemanticGraphService();
    }
    async analyzeDocumentationWithSemantics(params) {
        const startTime = Date.now();
        const logger = logger_1.Logger.getInstance();
        try {
            logger.info('📚🔗 Starting enhanced documentation analysis with semantic graph...');
            // 1. Run base documentation analysis
            const baseResult = await super.analyzeDocumentation(params);
            // 2. Initialize semantic graph if needed
            await this.semanticGraph.initialize();
            // 3. Populate semantic graph with documentation data
            await this.populateSemanticGraph(baseResult, params.projectPath);
            // 4. Extract concept clusters using graph analysis
            const conceptClusters = await this.extractConceptClusters(baseResult);
            // 5. Find cross-domain insights
            const crossDomainInsights = await this.findCrossDomainInsights(baseResult);
            // 6. Get graph statistics
            const graphStats = await this.semanticGraph.getGraphStatistics();
            const duration = Date.now() - startTime;
            logger.info(`✅ Enhanced documentation analysis completed in ${duration}ms`, {
                documentsFound: baseResult.documents.length,
                conceptClusters: conceptClusters.length,
                graphNodes: graphStats.total_nodes,
                graphRelationships: graphStats.total_relationships
            });
            return {
                ...baseResult,
                semanticGraph: {
                    totalNodes: graphStats.total_nodes,
                    totalRelationships: graphStats.total_relationships,
                    conceptClusters
                },
                crossDomainInsights
            };
        }
        catch (error) {
            logger.error('❌ Enhanced documentation analysis failed:', error);
            throw error;
        }
    }
    async semanticDocumentSearch(query, context) {
        try {
            const searchResults = await this.semanticGraph.semanticSearch(query, {
                includeTypes: context?.includeCode ? ['Documentation', 'Code', 'BusinessConcept'] : ['Documentation', 'BusinessConcept'],
                maxDepth: context?.maxResults || 10
            });
            return searchResults
                .filter(result => result.node.labels.includes('Documentation'))
                .map(result => ({
                document: result.node.properties,
                relatedConcepts: result.relatedNodes
                    .filter(rel => rel.node.labels.includes('BusinessConcept'))
                    .map(rel => rel.node.properties.name),
                relatedCode: result.relatedNodes
                    .filter(rel => rel.node.labels.includes('Code'))
                    .map(rel => rel.node.properties.path),
                relevanceScore: result.relevanceScore
            }))
                .slice(0, context?.maxResults || 10);
        }
        catch (error) {
            logger_1.Logger.getInstance().error('❌ Semantic document search failed:', error);
            return [];
        }
    }
    async populateSemanticGraph(result, projectPath) {
        const logger = logger_1.Logger.getInstance();
        logger.info('🔗 Populating semantic graph with documentation data...');
        try {
            // 1. Create business concept nodes
            const conceptNodes = new Map();
            for (const topic of result.topics) {
                const conceptId = await this.semanticGraph.addNode('BusinessConcept', {
                    name: topic.topic,
                    domain: this.inferDomain(topic.topic),
                    description: `Business concept derived from documentation analysis`,
                    keywords: topic.keywords,
                    importance: topic.importance,
                    documentCount: topic.documents.length
                });
                conceptNodes.set(topic.topic, conceptId);
            }
            // 2. Create documentation nodes
            const docNodes = new Map();
            for (const doc of result.documents) {
                const docId = await this.semanticGraph.addNode('Documentation', {
                    path: doc.path,
                    title: doc.title,
                    type: doc.type,
                    summary: doc.summary,
                    content: doc.summary, // Full content would be too large
                    wordCount: doc.wordCount,
                    topics: doc.topics,
                    lastModified: doc.lastModified.toISOString()
                });
                docNodes.set(doc.id, docId);
            }
            // 3. Create code nodes for referenced classes
            const codeNodes = new Map();
            for (const classSummary of result.mainClasses) {
                const codeId = await this.semanticGraph.addNode('Code', {
                    name: classSummary.name,
                    type: 'class',
                    description: classSummary.description,
                    category: classSummary.category,
                    mentionCount: classSummary.mentions.length
                });
                codeNodes.set(classSummary.name, codeId);
            }
            // 4. Create relationships
            await this.createSemanticRelationships(result, conceptNodes, docNodes, codeNodes);
            logger.info(`✅ Populated semantic graph: ${conceptNodes.size} concepts, ${docNodes.size} docs, ${codeNodes.size} code nodes`);
        }
        catch (error) {
            logger.error('❌ Failed to populate semantic graph:', error);
        }
    }
    async createSemanticRelationships(result, conceptNodes, docNodes, codeNodes) {
        // Document -> Business Concept relationships
        for (const doc of result.documents) {
            const docId = docNodes.get(doc.id);
            if (!docId)
                continue;
            for (const topic of doc.topics) {
                const conceptId = conceptNodes.get(topic);
                if (conceptId) {
                    await this.semanticGraph.addRelationship(docId, conceptId, 'DEFINES', {
                        strength: this.calculateTopicStrength(doc, topic)
                    });
                }
            }
        }
        // Documentation -> Code relationships
        for (const classSummary of result.mainClasses) {
            const codeId = codeNodes.get(classSummary.name);
            if (!codeId)
                continue;
            for (const mention of classSummary.mentions) {
                const docId = docNodes.get(mention.documentId);
                if (docId) {
                    await this.semanticGraph.addRelationship(docId, codeId, 'DESCRIBES', {
                        context: mention.context,
                        strength: 1.0 / classSummary.mentions.length // Distribute strength across mentions
                    });
                }
            }
        }
        // Business Concept relationships (based on co-occurrence)
        const concepts = Array.from(conceptNodes.keys());
        for (let i = 0; i < concepts.length; i++) {
            for (let j = i + 1; j < concepts.length; j++) {
                const concept1 = concepts[i];
                const concept2 = concepts[j];
                // Find documents that mention both concepts
                const sharedDocs = result.documents.filter(doc => doc.topics.includes(concept1) && doc.topics.includes(concept2));
                if (sharedDocs.length > 0) {
                    const conceptId1 = conceptNodes.get(concept1);
                    const conceptId2 = conceptNodes.get(concept2);
                    await this.semanticGraph.addRelationship(conceptId1, conceptId2, 'RELATES_TO', {
                        sharedDocuments: sharedDocs.length,
                        strength: sharedDocs.length / result.documents.length
                    });
                }
            }
        }
        // Cross-references
        for (const crossRef of result.crossReferences) {
            const fromDocId = docNodes.get(crossRef.from);
            const toDocId = docNodes.get(crossRef.to);
            if (fromDocId && toDocId) {
                await this.semanticGraph.addRelationship(fromDocId, toDocId, 'RELATES_TO', {
                    type: crossRef.type,
                    context: crossRef.context
                });
            }
        }
    }
    async extractConceptClusters(result) {
        const clusters = [];
        for (const topic of result.topics) {
            try {
                const crossRefs = await this.semanticGraph.findCrossReferences(topic.topic);
                clusters.push({
                    conceptName: topic.topic,
                    relatedDocs: crossRefs.relatedDocs.map(node => node.properties.path),
                    relatedCode: crossRefs.relatedCode.map(node => node.properties.name),
                    relatedUI: crossRefs.relatedUI.map(node => node.properties.name),
                    strength: this.calculateClusterStrength(crossRefs)
                });
            }
            catch (error) {
                // Concept might not exist in graph yet
                logger_1.Logger.getInstance().debug(`Could not find cross-references for ${topic.topic}`);
            }
        }
        return clusters.sort((a, b) => b.strength - a.strength);
    }
    async findCrossDomainInsights(result) {
        const insights = [];
        // Find concepts that appear across multiple domains
        const domainMap = new Map();
        for (const doc of result.documents) {
            const domain = this.inferDomain(doc.type);
            for (const topic of doc.topics) {
                if (!domainMap.has(topic)) {
                    domainMap.set(topic, new Set());
                }
                domainMap.get(topic).add(domain);
            }
        }
        // Find cross-domain concepts
        for (const [concept, domains] of domainMap.entries()) {
            if (domains.size > 1) {
                try {
                    const crossRefs = await this.semanticGraph.findCrossReferences(concept);
                    // Analyze connections between domains
                    const connections = [];
                    const domainsArray = Array.from(domains);
                    for (let i = 0; i < domainsArray.length; i++) {
                        for (let j = i + 1; j < domainsArray.length; j++) {
                            connections.push({
                                from: domainsArray[i],
                                to: domainsArray[j],
                                type: 'concept_bridge',
                                strength: this.calculateConnectionStrength(crossRefs, domainsArray[i], domainsArray[j])
                            });
                        }
                    }
                    insights.push({
                        concept,
                        domains: domainsArray,
                        connections
                    });
                }
                catch (error) {
                    logger_1.Logger.getInstance().debug(`Could not analyze cross-domain insight for ${concept}`);
                }
            }
        }
        return insights.sort((a, b) => b.domains.length - a.domains.length);
    }
    // Helper methods
    inferDomain(input) {
        const domainKeywords = {
            'frontend': ['ui', 'component', 'navigation', 'user', 'interface'],
            'backend': ['api', 'server', 'database', 'service'],
            'security': ['auth', 'authentication', 'authorization', 'security'],
            'testing': ['test', 'testing', 'spec', 'coverage'],
            'documentation': ['readme', 'guide', 'docs', 'documentation'],
            'architecture': ['architecture', 'design', 'patterns', 'principles']
        };
        const inputLower = input.toLowerCase();
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            if (keywords.some(keyword => inputLower.includes(keyword))) {
                return domain;
            }
        }
        return 'general';
    }
    calculateTopicStrength(doc, topic) {
        // Higher strength for topics that appear in title or multiple times
        let strength = 0.5; // Base strength
        if (doc.title.toLowerCase().includes(topic.toLowerCase())) {
            strength += 0.3;
        }
        // Count occurrences in summary
        const escapedTopic = topic.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const occurrences = (doc.summary.toLowerCase().match(new RegExp(escapedTopic, 'g')) || []).length;
        strength += Math.min(occurrences * 0.1, 0.3);
        return Math.min(strength, 1.0);
    }
    calculateClusterStrength(crossRefs) {
        const totalConnections = crossRefs.relatedDocs.length +
            crossRefs.relatedCode.length +
            crossRefs.relatedUI.length +
            crossRefs.relatedTests.length;
        // Normalize to 0-1 scale (assume max 20 connections for a strong cluster)
        return Math.min(totalConnections / 20, 1.0);
    }
    calculateConnectionStrength(crossRefs, domain1, domain2) {
        // Simple heuristic based on shared resources
        const sharedResources = crossRefs.relatedDocs.length + crossRefs.relatedCode.length;
        return Math.min(sharedResources / 10, 1.0);
    }
}
exports.EnhancedDocumentMapAnalyzer = EnhancedDocumentMapAnalyzer;
exports.default = EnhancedDocumentMapAnalyzer;
//# sourceMappingURL=enhanced-map-analyzer.js.map