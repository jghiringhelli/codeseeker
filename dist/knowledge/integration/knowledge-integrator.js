"use strict";
/**
 * Knowledge Graph Integrator
 *
 * Integrates the semantic knowledge graph with existing CodeMind features
 * to provide enhanced analysis, insights, and cross-feature collaboration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeIntegrator = void 0;
const types_1 = require("../graph/types");
const logger_1 = require("../../utils/logger");
class KnowledgeIntegrator {
    knowledgeGraph;
    queryEngine;
    semanticAnalyzer;
    logger;
    constructor(knowledgeGraph, queryEngine, semanticAnalyzer) {
        this.knowledgeGraph = knowledgeGraph;
        this.queryEngine = queryEngine;
        this.semanticAnalyzer = semanticAnalyzer;
        this.logger = logger_1.Logger?.getInstance().child('KnowledgeIntegrator');
    }
    // Integration with Duplication Detector
    async enhanceDuplicationAnalysis(duplicationDetector) {
        this.logger.info('Enhancing duplication analysis with knowledge graph...');
        // Get existing duplications
        const duplications = await duplicationDetector?.findDuplicates({
            projectPath: process?.cwd(),
            includeSemantic: true,
            similarityThreshold: 0.7,
            includeRefactoringSuggestions: true
        });
        const enhancedDuplicates = [];
        // Enhance each duplication with knowledge graph insights
        for (const duplicate of duplications.duplicates) {
            const knowledgeNodes = await this?.findRelatedKnowledgeNodes(duplicate.locations);
            const semanticContext = await this?.getSemanticContext(knowledgeNodes);
            const refactoringInsights = await this?.generateRefactoringInsights(knowledgeNodes, semanticContext);
            enhancedDuplicates?.push({
                ...duplicate,
                knowledgeContext: {
                    relatedNodes: knowledgeNodes,
                    semanticPatterns: semanticContext.patterns,
                    architecturalImpact: semanticContext.architecturalImpact,
                    refactoringStrategy: refactoringInsights
                }
            });
            // Create knowledge graph relationships for duplications
            await this?.createDuplicationTriads(knowledgeNodes, duplicate.similarity);
        }
        // Find semantic clusters of similar functionality
        const semanticClusters = await this?.findSemanticDuplicationClusters();
        return {
            enhancedDuplicates,
            semanticClusters
        };
    }
    // Integration with Tree Navigator
    async enhanceTreeNavigation(treeNavigator) {
        this.logger.info('Enhancing tree navigation with semantic knowledge...');
        // Build dependency tree
        const tree = await treeNavigator?.buildTree({
            projectPath: process?.cwd(),
            filePattern: '**/*.{ts,js}',
            showDependencies: true
        });
        // Enhance tree with semantic information
        const semanticTree = await this?.addSemanticInformationToTree(tree);
        // Find knowledge-based clusters
        const knowledgeBasedClusters = await this?.identifyKnowledgeClusters(tree);
        // Find cross-reference paths using knowledge graph
        const crossReferencePaths = await this?.findSemanticCrossReferences(tree);
        return {
            semanticTree,
            knowledgeBasedClusters,
            crossReferencePaths
        };
    }
    // Integration with Centralization Detector
    async enhanceCentralizationAnalysis(centralizationDetector) {
        this.logger.info('Enhancing centralization analysis with knowledge graph...');
        // Get centralization opportunities
        const opportunities = await centralizationDetector?.scanProject({
            projectPath: process?.cwd(),
            includeMigrationPlan: true,
            includeRiskAssessment: true
        });
        const enhancedOpportunities = [];
        // Enhance each opportunity with knowledge graph insights
        for (const opportunity of opportunities.opportunities) {
            const relatedNodes = await this?.findConfigurationRelatedNodes(opportunity.configType);
            const semanticImpact = await this?.assessSemanticImpactOfCentralization(relatedNodes, opportunity);
            const migrationPath = await this?.generateKnowledgeBasedMigrationPath(relatedNodes);
            enhancedOpportunities?.push({
                ...opportunity,
                knowledgeContext: {
                    relatedNodes: relatedNodes?.map(n => n.id),
                    semanticImpact,
                    migrationComplexity: migrationPath.complexity,
                    riskFactors: migrationPath.riskFactors
                }
            });
        }
        // Find semantic centralization opportunities
        const semanticCentralization = await this?.findSemanticCentralizationOpportunities();
        // Generate knowledge-based migration strategies
        const knowledgeBasedMigrations = await this?.generateKnowledgeBasedMigrations(enhancedOpportunities);
        return {
            enhancedOpportunities,
            semanticCentralization,
            knowledgeBasedMigrations
        };
    }
    // Integration with Git Integration
    async enhanceGitAnalysis(gitIntegration) {
        this.logger.info('Enhancing Git analysis with knowledge graph...');
        // Analyze commits from semantic perspective
        const recentCommits = await gitIntegration?.getCommitsSince('HEAD~10');
        const semanticCommitAnalysis = [];
        for (const commit of recentCommits) {
            const diff = await gitIntegration?.getDiffBetweenCommits(`${commit.hash}~1`, commit.hash);
            const affectedNodes = await this?.mapChangesToKnowledgeNodes(diff);
            const semanticImpact = await this?.calculateSemanticImpact(affectedNodes);
            const knowledgeEvolution = await this?.analyzeKnowledgeEvolution(affectedNodes, commit);
            semanticCommitAnalysis?.push({
                commit: commit.hash,
                semanticImpact: semanticImpact.score,
                affectedKnowledgeAreas: semanticImpact.areas,
                knowledgeEvolution,
                recommendations: semanticImpact.recommendations
            });
            // Update knowledge graph with commit information
            await this?.updateKnowledgeGraphFromCommit(commit, affectedNodes);
        }
        // Calculate overall knowledge impact metrics
        const knowledgeImpactMetrics = await this?.calculateKnowledgeImpactMetrics(semanticCommitAnalysis);
        // Generate evolution insights
        const evolutionInsights = await this?.generateEvolutionInsights(semanticCommitAnalysis);
        return {
            semanticCommitAnalysis,
            knowledgeImpactMetrics,
            evolutionInsights
        };
    }
    // Integration with Context Optimizer
    async enhanceContextOptimization(contextOptimizer, query) {
        this.logger.info('Enhancing context optimization with knowledge graph...');
        // Find relevant knowledge nodes for the query
        const relevantNodes = await this.queryEngine?.semanticSearch(query, 'both', 20);
        // Get semantic context around relevant nodes
        const semanticContext = await this?.expandSemanticContext(relevantNodes.data);
        // Prioritize context based on knowledge graph metrics
        const semanticPriority = await this?.calculateSemanticPriority(semanticContext, query);
        // Build knowledge-enhanced context
        const knowledgeEnhancedContext = {
            coreNodes: semanticContext.core,
            relatedConcepts: semanticContext.related,
            architecturalContext: semanticContext.architectural,
            businessContext: semanticContext.business,
            implementationContext: semanticContext.implementation
        };
        // Calculate context quality based on knowledge graph completeness
        const contextQuality = this?.calculateContextQuality(knowledgeEnhancedContext, query);
        return {
            knowledgeEnhancedContext,
            semanticPriority,
            contextQuality
        };
    }
    // Comprehensive Integration Analysis
    async performIntegratedAnalysis() {
        this.logger.info('Performing comprehensive integrated analysis...');
        // Knowledge graph metrics
        const graphAnalysis = await this.knowledgeGraph?.analyzeGraph();
        const knowledgeGraphMetrics = {
            nodeCount: graphAnalysis.nodeCount,
            triadCount: graphAnalysis.triadCount,
            density: this?.calculateGraphDensity(graphAnalysis),
            avgClustering: graphAnalysis.clusteringCoefficient
        };
        // Duplication analysis
        const duplicationsInKnowledge = await this?.analyzeDuplicationsInKnowledgeGraph();
        // Dependency insights
        const dependencyInsights = await this?.generateDependencyInsights();
        // Context optimizations
        const contextOptimizations = await this?.generateContextOptimizations();
        // Git integration insights
        const gitIntegrationInsights = await this?.generateGitInsights();
        return {
            knowledgeGraphMetrics,
            duplicationsInKnowledge,
            dependencyInsights,
            contextOptimizations,
            gitIntegrationInsights
        };
    }
    // Private Helper Methods
    async findRelatedKnowledgeNodes(locations) {
        const relatedNodes = [];
        for (const location of locations) {
            const searchResult = await this.queryEngine?.semanticSearch(location.file, 'nodes', 5);
            relatedNodes?.push(...searchResult.data?.map(r => r.item));
        }
        return relatedNodes;
    }
    async getSemanticContext(nodes) {
        const patterns = [];
        const architecturalAreas = new Set();
        for (const node of nodes) {
            // Find patterns this node follows
            const patternTriads = await this.knowledgeGraph?.queryTriads({
                triads: {
                    subjects: [node.id],
                    predicates: [types_1.RelationType.FOLLOWS_PATTERN]
                }
            });
            patterns?.push(...patternTriads?.map(t => t.object));
            // Determine architectural impact
            if (node?.type === types_1.NodeType.SERVICE || node?.type === types_1.NodeType.REPOSITORY) {
                architecturalAreas?.add('business_logic');
            }
            else if (node?.type === types_1.NodeType.CONTROLLER) {
                architecturalAreas?.add('presentation');
            }
            else if (node?.type === types_1.NodeType.MODEL) {
                architecturalAreas?.add('data_layer');
            }
        }
        return {
            patterns: [...new Set(patterns)],
            architecturalImpact: Array.from(architecturalAreas).join(', ')
        };
    }
    async generateRefactoringInsights(nodes, context) {
        // Analyze the semantic context to suggest refactoring strategies
        const hasServices = nodes?.some(n => n?.type === types_1.NodeType.SERVICE);
        const hasRepositories = nodes?.some(n => n?.type === types_1.NodeType.REPOSITORY);
        const complexity = nodes?.length > 5 ? 'high' : nodes?.length > 2 ? 'medium' : 'low';
        let strategy = 'extract_utility';
        const recommendations = [];
        if (hasServices) {
            strategy = 'extract_service_method';
            recommendations?.push('Consider extracting common logic into a shared service method');
        }
        else if (hasRepositories) {
            strategy = 'extract_repository_method';
            recommendations?.push('Consider creating a base repository with shared functionality');
        }
        if (context.patterns?.length > 0) {
            recommendations?.push(`Ensure refactoring maintains ${context.patterns?.join(', ')} pattern(s)`);
        }
        return {
            strategy,
            complexity,
            recommendations
        };
    }
    async createDuplicationTriads(nodes, similarity) {
        for (let i = 0; i < nodes?.length; i++) {
            for (let j = i + 1; j < nodes?.length; j++) {
                await this.knowledgeGraph?.addTriad({
                    subject: nodes?.[i].id,
                    predicate: types_1.RelationType.DUPLICATES,
                    object: nodes?.[j].id,
                    confidence: similarity,
                    source: types_1.TriadSource.PATTERN_DETECTOR,
                    metadata: {
                        duplicationLevel: similarity > 0.8 ? 'high' : similarity > 0.6 ? 'medium' : 'low'
                    }
                });
            }
        }
    }
    async findSemanticDuplicationClusters() {
        const duplicateTriads = await this.knowledgeGraph?.queryTriads({
            triads: {
                predicates: [types_1.RelationType.DUPLICATES]
            }
        });
        // Group duplicates into clusters
        const clusters = new Map();
        for (const triad of duplicateTriads) {
            let foundCluster = false;
            for (const [clusterId, cluster] of clusters?.entries()) {
                if (cluster?.has(triad.subject) || cluster?.has(triad.object)) {
                    cluster?.add(triad.subject);
                    cluster?.add(triad.object);
                    foundCluster = true;
                    break;
                }
            }
            if (!foundCluster) {
                const newCluster = new Set([triad.subject, triad.object]);
                clusters?.set(`cluster_${clusters.size}`, newCluster);
            }
        }
        return Array.from(clusters?.entries()).map(([id, nodes]) => ({
            id,
            nodes: Array.from(nodes),
            size: nodes.size
        }));
    }
    async addSemanticInformationToTree(tree) {
        // Add semantic annotations to tree nodes
        const enhancedTree = { ...tree };
        for (const node of enhancedTree.nodes || []) {
            const semanticInfo = await this.queryEngine?.semanticSearch(node.name, 'nodes', 3);
            node.semanticContext = {
                relatedConcepts: semanticInfo.data?.map(r => r.item.name),
                complexity: semanticInfo.data[0]?.item.metadata?.complexity || 0,
                patterns: semanticInfo.data[0]?.item.metadata?.tags || []
            };
        }
        return enhancedTree;
    }
    async identifyKnowledgeClusters(tree) {
        const clusters = await this.knowledgeGraph?.findSemanticClusters();
        return clusters?.map(cluster => ({
            id: cluster.id,
            name: cluster.name,
            nodes: cluster.nodes,
            coherence: cluster.coherenceScore,
            treeMapping: this?.mapClusterToTree(cluster, tree)
        }));
    }
    async findSemanticCrossReferences(tree) {
        const crossRefs = [];
        // Find semantic relationships that cross module boundaries
        const allTriads = await this.knowledgeGraph?.queryTriads({});
        for (const triad of allTriads) {
            const subjectNode = await this.knowledgeGraph?.queryNodes({
                nodes: { names: [triad.subject] }
            });
            const objectNode = await this.knowledgeGraph?.queryNodes({
                nodes: { names: [triad.object] }
            });
            if (subjectNode[0] && objectNode[0] &&
                subjectNode?.[0].namespace !== objectNode?.[0].namespace) {
                crossRefs?.push({
                    from: subjectNode[0],
                    to: objectNode[0],
                    relationship: triad.predicate,
                    confidence: triad.confidence
                });
            }
        }
        return crossRefs;
    }
    mapClusterToTree(cluster, tree) {
        // Map cluster nodes to tree structure
        return {
            treeNodes: cluster.nodes?.filter((nodeId) => tree.nodes?.some((treeNode) => treeNode?.id === nodeId)),
            coverage: cluster.nodes?.length / (tree.nodes?.length || 1)
        };
    }
    calculateGraphDensity(analysis) {
        const maxPossibleEdges = analysis?.nodeCount * (analysis?.nodeCount - 1) / 2;
        return maxPossibleEdges > 0 ? analysis?.triadCount / maxPossibleEdges : 0;
    }
    async analyzeDuplicationsInKnowledgeGraph() {
        const duplicateTriads = await this.knowledgeGraph?.queryTriads({
            triads: {
                predicates: [types_1.RelationType.DUPLICATES]
            }
        });
        return duplicateTriads?.map(triad => ({
            duplicateGroup: { subject: triad.subject, object: triad.object },
            knowledgeNodes: [triad.subject, triad.object],
            semanticSimilarity: triad.confidence
        }));
    }
    async generateDependencyInsights() {
        const allNodes = await this.knowledgeGraph?.queryNodes({});
        const insights = [];
        for (const node of allNodes?.slice(0, 10)) { // Limit for performance
            const dependencies = await this.knowledgeGraph?.queryTriads({
                triads: {
                    subjects: [node.id],
                    predicates: [types_1.RelationType.DEPENDS_ON]
                }
            });
            const dependencyRisk = dependencies?.length > 5 ? 0.8 : dependencies?.length > 2 ? 0.5 : 0.2;
            const couplingLevel = dependencies?.length > 5 ? 'high' : dependencies?.length > 2 ? 'medium' : 'low';
            insights?.push({
                node,
                dependencyRisk,
                couplingLevel,
                recommendations: this?.generateDependencyRecommendations(dependencies?.length)
            });
        }
        return insights;
    }
    generateDependencyRecommendations(dependencyCount) {
        if (dependencyCount > 5) {
            return [
                'Consider breaking down this component',
                'Apply dependency inversion principle',
                'Look for opportunities to extract interfaces'
            ];
        }
        else if (dependencyCount > 2) {
            return [
                'Monitor dependency growth',
                'Consider using dependency injection'
            ];
        }
        else {
            return ['Good dependency management'];
        }
    }
    async generateContextOptimizations() {
        // Generate context optimization suggestions based on knowledge graph
        const features = ['duplication', 'tree-navigation', 'centralization'];
        const optimizations = [];
        for (const feature of features) {
            const relevantNodes = await this.queryEngine?.semanticSearch(feature, 'nodes', 5);
            const relevanceScore = relevantNodes.data?.reduce((sum, item) => sum + item.similarity, 0) / relevantNodes.data?.length;
            optimizations?.push({
                feature,
                knowledgeContext: relevantNodes.data?.map(r => r.item),
                relevanceScore
            });
        }
        return optimizations;
    }
    async generateGitInsights() {
        // This would integrate with actual git data
        return [
            {
                commit: 'example-commit-hash',
                affectedKnowledgeNodes: ['node1', 'node2'],
                semanticImpact: 0.7
            }
        ];
    }
    async findConfigurationRelatedNodes(configType) {
        return await this.knowledgeGraph?.queryNodes({
            nodes: {
                types: [types_1.NodeType.CONFIGURATION],
                names: [configType]
            }
        });
    }
    async assessSemanticImpactOfCentralization(nodes, opportunity) {
        const areas = [];
        let score = 0;
        for (const node of nodes) {
            // Find what this configuration affects
            const affectedTriads = await this.knowledgeGraph?.queryTriads({
                triads: {
                    objects: [node.id],
                    predicates: [types_1.RelationType.DEPENDS_ON, types_1.RelationType.USES]
                }
            });
            score += affectedTriads?.length * 0.1;
            areas?.push(...affectedTriads?.map(t => t.subject));
        }
        return {
            score: Math.min(score, 1.0),
            areas: [...new Set(areas)]
        };
    }
    async generateKnowledgeBasedMigrationPath(nodes) {
        const complexity = nodes?.length * 0.2; // Simplified complexity calculation
        const riskFactors = [];
        for (const node of nodes) {
            if (node.metadata.complexity && node.metadata.complexity > 10) {
                riskFactors?.push('High complexity component affected');
            }
            if (node.metadata.testCoverage && node.metadata.testCoverage < 0.8) {
                riskFactors?.push('Low test coverage in affected area');
            }
        }
        return { complexity, riskFactors };
    }
    async findSemanticCentralizationOpportunities() {
        // Find semantic patterns that suggest centralization opportunities
        const similarities = await this.knowledgeGraph?.queryTriads({
            triads: {
                predicates: [types_1.RelationType.IS_SIMILAR_TO]
            }
        });
        const opportunities = [];
        const processed = new Set();
        for (const similarity of similarities) {
            if (processed?.has(similarity.id))
                continue;
            const relatedSimilarities = similarities?.filter(s => s?.subject === similarity.subject || s?.object === similarity.subject ||
                s?.subject === similarity.object || s?.object === similarity.object);
            if (relatedSimilarities?.length > 2) {
                opportunities?.push({
                    type: 'semantic_centralization',
                    relatedNodes: [...new Set([
                            similarity.subject,
                            similarity.object,
                            ...relatedSimilarities?.flatMap(s => [s.subject, s.object])
                        ])],
                    confidence: relatedSimilarities?.reduce((sum, s) => sum + s.confidence, 0) / relatedSimilarities?.length
                });
                relatedSimilarities?.forEach(s => processed?.add(s.id));
            }
        }
        return opportunities;
    }
    async generateKnowledgeBasedMigrations(opportunities) {
        return opportunities?.map(opp => ({
            ...opp,
            migrationStrategy: this?.determineMigrationStrategy(opp),
            estimatedEffort: this?.estimateMigrationEffort(opp),
            prerequisites: this?.identifyMigrationPrerequisites(opp)
        }));
    }
    determineMigrationStrategy(opportunity) {
        if (opportunity?.configType === 'database') {
            return 'centralize_database_config';
        }
        else if (opportunity?.configType === 'api') {
            return 'centralize_api_config';
        }
        else {
            return 'generic_centralization';
        }
    }
    estimateMigrationEffort(opportunity) {
        if (opportunity.scatteredLocations?.length > 5)
            return 'high';
        if (opportunity.scatteredLocations?.length > 2)
            return 'medium';
        return 'low';
    }
    identifyMigrationPrerequisites(opportunity) {
        const prerequisites = [];
        if (opportunity.knowledgeContext?.riskFactors?.includes('Low test coverage')) {
            prerequisites?.push('Increase test coverage before migration');
        }
        if (opportunity.knowledgeContext?.migrationComplexity > 0.7) {
            prerequisites?.push('Break down into smaller migration steps');
        }
        return prerequisites;
    }
    async mapChangesToKnowledgeNodes(diff) {
        const affectedNodes = [];
        for (const change of diff) {
            const searchResult = await this.queryEngine?.semanticSearch(change.file, 'nodes', 3);
            affectedNodes?.push(...searchResult.data?.map(r => r.item));
        }
        return affectedNodes;
    }
    async calculateSemanticImpact(nodes) {
        const areas = [...new Set(nodes?.map(n => n.namespace || 'global'))];
        const score = Math.min(nodes?.length * 0.1, 1.0);
        const recommendations = [];
        if (score > 0.7) {
            recommendations?.push('High-impact change - consider additional testing');
        }
        if (areas?.length > 3) {
            recommendations?.push('Change affects multiple areas - coordinate with team');
        }
        return { score, areas, recommendations };
    }
    async analyzeKnowledgeEvolution(nodes, commit) {
        return {
            nodesModified: nodes?.length,
            architecturalImpact: nodes?.some(n => n?.type === types_1.NodeType.SERVICE) ? 'high' : 'medium',
            evolutionTrend: 'growing_complexity' // Simplified
        };
    }
    async updateKnowledgeGraphFromCommit(commit, nodes) {
        // Create commit-related triads
        for (const node of nodes) {
            await this.knowledgeGraph?.addTriad({
                subject: node.id,
                predicate: types_1.RelationType.PART_OF,
                object: `commit_${commit.hash}`,
                confidence: 1.0,
                source: types_1.TriadSource.GIT_ANALYSIS,
                metadata: {
                    commitHash: commit.hash,
                    commitMessage: commit.message,
                    timestamp: commit.date
                }
            });
        }
    }
    async calculateKnowledgeImpactMetrics(analysis) {
        const totalImpact = analysis?.reduce((sum, a) => sum + a.semanticImpact, 0);
        const avgImpact = analysis?.length > 0 ? totalImpact / analysis?.length : 0;
        const highImpactCommits = analysis?.filter(a => a.semanticImpact > 0.7).length;
        return {
            averageSemanticImpact: avgImpact,
            highImpactCommits,
            totalAnalyzedCommits: analysis?.length,
            knowledgeEvolutionRate: avgImpact > 0.5 ? 'fast' : 'moderate'
        };
    }
    async generateEvolutionInsights(analysis) {
        const insights = [];
        // Trend analysis
        const recentImpact = analysis?.slice(0, 3).reduce((sum, a) => sum + a.semanticImpact, 0) / 3;
        const earlierImpact = analysis?.slice(-3).reduce((sum, a) => sum + a.semanticImpact, 0) / 3;
        if (recentImpact > earlierImpact * 1.2) {
            insights?.push({
                type: 'increasing_complexity',
                description: 'Recent commits show increasing semantic impact',
                recommendation: 'Consider refactoring to manage complexity'
            });
        }
        return insights;
    }
    async expandSemanticContext(relevantData) {
        const core = relevantData?.slice(0, 5).map(r => r.item);
        const related = [];
        const architectural = [];
        const business = [];
        const implementation = [];
        // Expand context by following relationships
        for (const coreNode of core) {
            const relatedResult = await this.queryEngine?.findRelatedNodes(coreNode.id, [types_1.RelationType.RELATES_TO, types_1.RelationType.IS_SIMILAR_TO], 'both', 1);
            related?.push(...relatedResult.data);
        }
        // Categorize nodes
        for (const node of [...core, ...related]) {
            if (node?.type === types_1.NodeType.SERVICE || node?.type === types_1.NodeType.CONTROLLER) {
                architectural?.push(node);
            }
            else if (node?.type === types_1.NodeType.BUSINESS_RULE || node?.type === types_1.NodeType.FEATURE) {
                business?.push(node);
            }
            else {
                implementation?.push(node);
            }
        }
        return {
            core,
            related: related?.slice(0, 10), // Limit to prevent explosion
            architectural: architectural?.slice(0, 5),
            business: business?.slice(0, 5),
            implementation: implementation?.slice(0, 5)
        };
    }
    async calculateSemanticPriority(context, query) {
        const priorities = [];
        // Core nodes have highest priority
        context.core?.forEach((node, index) => {
            priorities?.push({
                node,
                priority: 1.0 - (index * 0.1),
                reason: 'Core semantic match'
            });
        });
        // Architectural context has high priority if query is architecture-related
        if (query?.toLowerCase().includes('architecture') || query?.toLowerCase().includes('design')) {
            context.architectural?.forEach((node, index) => {
                priorities?.push({
                    node,
                    priority: 0.8 - (index * 0.1),
                    reason: 'Architectural relevance'
                });
            });
        }
        return priorities?.sort((a, b) => b?.priority - a.priority);
    }
    calculateContextQuality(context, query) {
        const totalNodes = Number(Object.values(context).reduce((sum, nodes) => sum + (Array.isArray(nodes) ? nodes.length : 0), 0));
        const coverage = Math.min(totalNodes / 20, 1.0); // Ideal context has ~20 nodes
        // Boost quality if we have diverse node types
        const nodeTypes = new Set();
        Object.values(context)?.forEach((nodes) => {
            nodes?.forEach((node) => nodeTypes?.add(node.type));
        });
        const diversity = Math.min(nodeTypes?.size / 5, 1.0); // Ideal has 5 different types
        return (coverage * 0.7) + (diversity * 0.3);
    }
}
exports.KnowledgeIntegrator = KnowledgeIntegrator;
//# sourceMappingURL=knowledge-integrator.js.map