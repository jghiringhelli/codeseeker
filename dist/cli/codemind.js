#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.program = void 0;
const commander_1 = require("commander");
const claude_integration_1 = require("./claude-integration");
const context_optimizer_1 = require("./context-optimizer");
const detector_1 = require("../features/duplication/detector");
const navigator_1 = require("../features/tree-navigation/navigator");
const search_engine_1 = require("../features/vector-search/search-engine");
const detector_2 = require("../features/centralization/detector");
const git_integration_1 = require("../git/git-integration");
const knowledge_graph_1 = require("../knowledge/graph/knowledge-graph");
const semantic_analyzer_1 = require("../knowledge/analyzers/semantic-analyzer");
const graph_query_engine_1 = require("../knowledge/query/graph-query-engine");
const self_improvement_engine_1 = require("../self-improvement/self-improvement-engine");
const auto_fix_1 = require("./commands/auto-fix");
const logger_1 = require("../utils/logger");
const fs = __importStar(require("fs"));
const program = new commander_1.Command();
exports.program = program;
const logger = logger_1.Logger?.getInstance();
// Initialize core services
const claudeIntegration = new claude_integration_1.ClaudeIntegration();
const contextOptimizer = new context_optimizer_1.ContextOptimizer();
const duplicationDetector = new detector_1.DuplicationDetector();
const treeNavigator = new navigator_1.TreeNavigator();
const vectorSearch = new search_engine_1.VectorSearch();
const centralizationDetector = new detector_2.CentralizationDetector();
const gitIntegration = new git_integration_1.GitIntegration();
const selfImprovementEngine = new self_improvement_engine_1.SelfImprovementEngine();
// Initialize knowledge graph components
let knowledgeGraph;
let semanticAnalyzer;
let queryEngine;
function initializeKnowledgeGraph(projectPath) {
    if (!knowledgeGraph) {
        knowledgeGraph = new knowledge_graph_1.SemanticKnowledgeGraph(projectPath);
        queryEngine = new graph_query_engine_1.GraphQueryEngine(knowledgeGraph);
        semanticAnalyzer = new semantic_analyzer_1.SemanticAnalyzer({
            projectPath,
            filePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
            includeTests: true,
            minConfidence: 0.6,
            enableSemanticSimilarity: true,
            enablePatternDetection: true
        }, knowledgeGraph);
    }
    return { knowledgeGraph, semanticAnalyzer, queryEngine };
}
program
    .name('codemind')
    .description('Intelligent Code Auxiliary System CLI')
    .version('0.1.0');
// Claude integration commands
program
    .command('ask')
    .description('Ask Claude a question with optimized context')
    .argument('<question>', 'Question to ask Claude')
    .option('-c, --context <type>', 'Context type (auto|smart|minimal|full)', 'smart')
    .option('-b, --budget <tokens>', 'Token budget for context', '8000')
    .option('-f, --focus <area>', 'Focus area for context selection')
    .option('--project <path>', 'Project path', '.')
    .action(async (question, options) => {
    try {
        logger.info('Processing question with context optimization...');
        const optimization = await contextOptimizer?.optimizeContext({
            projectPath: options.project,
            query: question,
            tokenBudget: parseInt(options.budget),
            contextType: options.context,
            focusArea: options.focus
        });
        const response = await claudeIntegration?.askQuestion(question, optimization);
        console?.log('\n🤖 Claude Response:');
        console?.log('─'.repeat(50));
        console?.log(response.content);
        if (response.contextUsed) {
            console?.log('\n📊 Context Info:');
            console?.log(`- Tokens used: ${response.contextUsed.tokensUsed}/${options.budget}`);
            console?.log(`- Files included: ${response.contextUsed.filesIncluded?.length}`);
            console?.log(`- Optimization: ${response.contextUsed.optimizationStrategy}`);
        }
    }
    catch (error) {
        logger.error('Failed to process question', error);
        process?.exit(1);
    }
});
program
    .command('optimize-context')
    .description('Optimize context window for better Claude interactions')
    .option('-b, --budget <tokens>', 'Token budget', '8000')
    .option('-f, --focus <area>', 'Focus area')
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        const analysis = await contextOptimizer?.analyzeProject({
            projectPath: options.project,
            tokenBudget: parseInt(options.budget),
            focusArea: options.focus
        });
        console?.log('\n📈 Context Optimization Analysis:');
        console?.log('─'.repeat(50));
        console?.log(`Project type: ${analysis.type}`);
        console?.log(`Total files: ${analysis.totalFiles}`);
        console?.log(`Primary language: ${analysis.primaryLanguage}`);
        console?.log(`Framework: ${analysis.framework || 'None detected'}`);
        if ('recommendations' in analysis && analysis.recommendations) {
            console?.log('\n💡 Recommendations:');
            analysis.recommendations?.forEach((rec, i) => {
                console?.log(`${i + 1}. ${rec}`);
            });
        }
    }
    catch (error) {
        logger.error('Failed to optimize context', error);
        process?.exit(1);
    }
});
// Duplication detection commands
program
    .command('find-duplicates')
    .description('Find code duplications across the codebase')
    .option('--semantic', 'Include semantic duplications', false)
    .option('-t, --threshold <value>', 'Similarity threshold', '0.8')
    .option('--suggest-refactor', 'Include refactoring suggestions', false)
    .option('--project <path>', 'Project path', '.')
    .option('--output <format>', 'Output format (json|table)', 'table')
    .action(async (options) => {
    try {
        logger.info('Scanning for code duplications...');
        const results = await duplicationDetector?.findDuplicates({
            projectPath: options.project,
            includeSemantic: options.semantic,
            similarityThreshold: parseFloat(options.threshold),
            includeRefactoringSuggestions: options.suggestRefactor
        });
        if (options?.output === 'json') {
            console?.log(JSON.stringify(results, null, 2));
        }
        else {
            console?.log('\n🔍 Duplication Analysis Results:');
            console?.log('─'.repeat(50));
            console?.log(`Found ${results.duplicates?.length} duplication groups`);
            results.duplicates?.forEach((group, i) => {
                console?.log(`\n${i + 1}. ${group.type} duplication (${group.similarity?.toFixed(2)} similarity)`);
                console?.log(`   Files: ${group.locations?.map(l => l.file).join(', ')}`);
                if (group.refactoring && options.suggestRefactor) {
                    console?.log(`   💡 Suggestion: ${group.refactoring.approach}`);
                    console?.log(`   ⏱️  Estimated effort: ${group.refactoring.estimatedEffort}`);
                }
            });
        }
    }
    catch (error) {
        logger.error('Failed to find duplicates', error);
        process?.exit(1);
    }
});
// Tree navigation commands
program
    .command('tree')
    .description('Navigate project dependency tree')
    .option('-i, --interactive', 'Interactive navigation mode', false)
    .option('-f, --filter <pattern>', 'File filter pattern', '**/*.{ts,js,py}')
    .option('--show-deps', 'Show dependencies', false)
    .option('--circular', 'Show circular dependencies only', false)
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        logger.info('Building dependency tree...');
        const tree = await treeNavigator?.buildTree({
            projectPath: options.project,
            filePattern: options.filter,
            showDependencies: options.showDeps,
            circularOnly: options.circular
        });
        if (options.interactive) {
            await treeNavigator?.startInteractiveMode(tree);
        }
        else {
            console?.log('\n🌲 Project Dependency Tree:');
            console?.log('─'.repeat(50));
            treeNavigator?.printTree(tree);
            if (tree.circularDependencies?.length > 0) {
                console?.log('\n⚠️  Circular Dependencies:');
                tree.circularDependencies?.forEach((cycle, i) => {
                    console?.log(`${i + 1}. ${cycle.path?.join(' → ')}`);
                });
            }
        }
    }
    catch (error) {
        logger.error('Failed to build tree', error);
        process?.exit(1);
    }
});
// Vector search commands
program
    .command('search')
    .description('Search code using semantic similarity')
    .argument('<query>', 'Search query')
    .option('--semantic', 'Use semantic search', true)
    .option('-l, --limit <number>', 'Number of results', '10')
    .option('--cross-project', 'Search across projects', false)
    .option('--project <path>', 'Project path', '.')
    .action(async (query, options) => {
    try {
        logger.info('Searching with vector similarity...');
        const results = await vectorSearch?.search({
            query,
            projectPath: options.project,
            limit: parseInt(options.limit),
            crossProject: options.crossProject,
            useSemanticSearch: options.semantic
        });
        console?.log('\n🔎 Search Results:');
        console?.log('─'.repeat(50));
        results.matches?.forEach((match, i) => {
            console?.log(`\n${i + 1}. ${match.file}:${match.line} (${match.similarity?.toFixed(3)} similarity)`);
            console?.log(`   ${match.codeSnippet}`);
            if (match.context) {
                console?.log(`   📝 Context: ${match.context}`);
            }
        });
    }
    catch (error) {
        logger.error('Failed to search', error);
        process?.exit(1);
    }
});
// Centralization detection commands
program
    .command('centralize-config')
    .description('Detect scattered configurations that can be centralized')
    .option('--scan', 'Scan for opportunities', false)
    .option('--suggest-migrations', 'Include migration suggestions', false)
    .option('--risk-assess', 'Include risk assessment', false)
    .option('--type <types>', 'Config types to check (comma-separated)')
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        logger.info('Scanning for centralization opportunities...');
        const results = await centralizationDetector?.scanProject({
            projectPath: options.project,
            configTypes: options.type ? options.type?.split(',') : undefined,
            includeMigrationPlan: options.suggestMigrations,
            includeRiskAssessment: options.riskAssess
        });
        console?.log('\n🎯 Centralization Opportunities:');
        console?.log('─'.repeat(50));
        results.opportunities?.forEach((opp, i) => {
            console?.log(`\n${i + 1}. ${opp.configType} (${opp.scatteredLocations?.length} locations)`);
            console?.log(`   Benefit score: ${opp.benefitScore?.toFixed(2)}`);
            console?.log(`   Complexity: ${opp.complexityScore?.toFixed(2)}`);
            console?.log(`   Locations: ${opp.scatteredLocations?.map(l => l.file).join(', ')}`);
            if (opp.migrationPlan && options.suggestMigrations) {
                console?.log(`   📋 Migration: ${opp.migrationPlan.approach}`);
                console?.log(`   ⏱️  Estimated effort: ${opp.migrationPlan.estimatedEffort}`);
            }
        });
    }
    catch (error) {
        logger.error('Failed to detect centralization opportunities', error);
        process?.exit(1);
    }
});
// Git integration commands
program
    .command('git')
    .description('Git integration and auto-commit management')
    .addCommand(new commander_1.Command('status')
    .description('Show Git integration status and recent commits')
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        const status = await gitIntegration?.getIntegrationStatus(options.project);
        console?.log('\n📊 Git Integration Status:');
        console?.log('─'.repeat(50));
        console?.log(`Repository: ${status.isRepository ? '✅ Valid' : '❌ Not a git repo'}`);
        console?.log(`Auto-commit: ${status.autoCommitEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        console?.log(`Tracking: ${status.isTracking ? '🔍 Active' : '⏸️  Paused'}`);
        if (status.recentCommits?.length > 0) {
            console?.log('\n📝 Recent Commits:');
            status.recentCommits?.forEach(commit => {
                console?.log(`  ${commit.hash?.substring(0, 8)} - ${commit.message} (${commit.timestamp?.toLocaleDateString()})`);
            });
        }
    }
    catch (error) {
        logger.error('Failed to get Git status', error);
        process?.exit(1);
    }
}))
    .addCommand(new commander_1.Command('analyze')
    .description('Analyze changes between commits')
    .option('--from <hash>', 'From commit hash', 'HEAD~1')
    .option('--to <hash>', 'To commit hash', 'HEAD')
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        logger.info(`Analyzing changes from ${options.from} to ${options.to}...`);
        const analysis = await gitIntegration?.analyzeCommitRange(options.project, options.from, options.to);
        console?.log('\n🔍 Change Analysis:');
        console?.log('─'.repeat(50));
        console?.log(`Significance Score: ${analysis.significanceScore?.toFixed(2)}/5.0`);
        console?.log(`Files Changed: ${analysis.filesChanged}`);
        console?.log(`Lines Added: +${analysis.linesAdded}`);
        console?.log(`Lines Deleted: -${analysis.linesDeleted}`);
        if (analysis.newFeatures?.length > 0) {
            console?.log(`\n✨ New Features Detected:`);
            analysis.newFeatures?.forEach(feature => {
                console?.log(`  • ${feature}`);
            });
        }
    }
    catch (error) {
        logger.error('Failed to analyze commits', error);
        process?.exit(1);
    }
}))
    .addCommand(new commander_1.Command('enable-autocommit')
    .description('Enable automatic commits for significant changes')
    .option('--min-score <value>', 'Minimum significance score for auto-commit', '2.0')
    .option('--check-compilation', 'Only commit if code compiles', true)
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        logger.info('Enabling auto-commit system...');
        const rules = {
            enabled: true,
            minSignificanceScore: parseFloat(options.minScore),
            requiresCompilation: options.checkCompilation,
            watchPatterns: ['src/**/*', 'test/**/*', 'tests/**/*']
        };
        await gitIntegration?.configureAutoCommit(options.project, rules);
        await gitIntegration?.startAutoCommitWatcher();
        console?.log('\n✅ Auto-commit system enabled');
        console?.log(`• Minimum score: ${rules.minSignificanceScore}`);
        console?.log(`• Compilation check: ${rules.requiresCompilation ? 'Yes' : 'No'}`);
        console?.log('• File watcher started');
    }
    catch (error) {
        logger.error('Failed to enable auto-commit', error);
        process?.exit(1);
    }
}))
    .addCommand(new commander_1.Command('disable-autocommit')
    .description('Disable automatic commits')
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        await gitIntegration?.configureAutoCommit(options.project, { enabled: false });
        await gitIntegration?.stopAutoCommitWatcher();
        console?.log('✅ Auto-commit system disabled');
    }
    catch (error) {
        logger.error('Failed to disable auto-commit', error);
        process?.exit(1);
    }
}));
// Knowledge Graph commands
program
    .command('knowledge')
    .description('Knowledge graph operations for semantic code analysis')
    .addCommand(new commander_1.Command('analyze')
    .description('Build semantic knowledge graph from codebase')
    .option('--project <path>', 'Project path', '.')
    .option('--include-tests', 'Include test files in analysis', false)
    .option('--min-confidence <value>', 'Minimum confidence threshold', '0.6')
    .action(async (options) => {
    try {
        logger.info('🧠 Building semantic knowledge graph...');
        const { knowledgeGraph, semanticAnalyzer } = initializeKnowledgeGraph(options.project);
        const result = await semanticAnalyzer?.analyzeProject();
        console?.log('\n🧠 Semantic Knowledge Graph Analysis:');
        console?.log('─'.repeat(50));
        console?.log(`Nodes extracted: ${result.nodesExtracted}`);
        console?.log(`Triads created: ${result.triadsCreated}`);
        console?.log(`Patterns detected: ${result.patterns?.length}`);
        if (result.patterns?.length > 0) {
            console?.log('\n📋 Detected Patterns:');
            result.patterns?.forEach((pattern, i) => {
                console?.log(`${i + 1}. ${pattern.name} (${pattern.type}) - ${(pattern?.confidence * 100).toFixed(1)}% confidence`);
                console?.log(`   Description: ${pattern.description}`);
                console?.log(`   Affected nodes: ${pattern.nodes?.length}`);
            });
        }
        if (result.insights?.length > 0) {
            console?.log('\n💡 Analysis Insights:');
            result.insights?.forEach((insight, i) => {
                console?.log(`${i + 1}. ${insight}`);
            });
        }
    }
    catch (error) {
        logger.error('Failed to analyze knowledge graph', error);
        process?.exit(1);
    }
}))
    .addCommand(new commander_1.Command('query')
    .description('Query the knowledge graph')
    .argument('<query>', 'Query to execute')
    .option('--type <type>', 'Query type: cypher, semantic, pattern', 'semantic')
    .option('--limit <number>', 'Limit results', '10')
    .option('--project <path>', 'Project path', '.')
    .action(async (query, options) => {
    try {
        logger.info(`🔍 Executing ${options.type} query...`);
        const { queryEngine } = initializeKnowledgeGraph(options.project);
        let result;
        switch (options.type) {
            case 'cypher':
                result = await queryEngine?.executeCypher({ query });
                break;
            case 'semantic':
                result = await queryEngine?.semanticSearch(query, 'both', parseInt(options.limit));
                break;
            case 'pattern':
                // For pattern queries, we'd need to parse the query into a pattern structure
                console?.log('Pattern queries not yet implemented. Use semantic or cypher queries.');
                return;
            default:
                throw new Error(`Unknown query type: ${options.type}`);
        }
        console?.log('\n🔍 Query Results:');
        console?.log('─'.repeat(50));
        console?.log(`Found ${result.data?.length} results in ${result.metadata.executionTime}ms`);
        console?.log(`Nodes traversed: ${result.metadata.nodesTraversed}`);
        console?.log(`Triads examined: ${result.metadata.triadsExamined}`);
        if (options?.type === 'semantic') {
            result.data?.forEach((item, i) => {
                console?.log(`\n${i + 1}. ${item.item.name || item.item.id} (${(item?.similarity * 100).toFixed(1)}% similarity)`);
                if (item.item.type) {
                    console?.log(`   Type: ${item.item.type}`);
                }
                if (item.item.sourceLocation) {
                    console?.log(`   Location: ${item.item.sourceLocation.filePath}:${item.item.sourceLocation.startLine}`);
                }
                if (item.item.metadata?.description) {
                    console?.log(`   Description: ${item.item.metadata.description}`);
                }
            });
        }
        else {
            result.data?.slice(0, parseInt(options.limit))?.forEach((item, i) => {
                console?.log(`${i + 1}. ${JSON.stringify(item, null, 2)}`);
            });
        }
    }
    catch (error) {
        logger.error('Failed to execute query', error);
        process?.exit(1);
    }
}))
    .addCommand(new commander_1.Command('path')
    .description('Find paths between nodes in the knowledge graph')
    .argument('<from>', 'Source node name or ID')
    .argument('<to>', 'Target node name or ID')
    .option('--relations <types>', 'Relationship types to traverse (comma-separated)')
    .option('--max-depth <number>', 'Maximum path depth', '5')
    .option('--all-paths', 'Find all paths (not just shortest)', false)
    .option('--project <path>', 'Project path', '.')
    .action(async (from, to, options) => {
    try {
        logger.info(`🛤️  Finding paths from ${from} to ${to}...`);
        const { queryEngine } = initializeKnowledgeGraph(options.project);
        // Find nodes by name first
        const fromResult = await queryEngine?.semanticSearch(from, 'nodes', 1);
        const toResult = await queryEngine?.semanticSearch(to, 'nodes', 1);
        if (fromResult.data?.length === 0) {
            console?.log(`❌ Source node '${from}' not found`);
            return;
        }
        if (toResult.data?.length === 0) {
            console?.log(`❌ Target node '${to}' not found`);
            return;
        }
        const fromNodeId = (fromResult.data?.[0].item).id;
        const toNodeId = (toResult.data?.[0].item).id;
        const relationTypes = options.relations ? options.relations?.split(',') : undefined;
        const maxDepth = parseInt(options.maxDepth);
        const result = options.allPaths
            ? await queryEngine?.findAllPaths(fromNodeId, toNodeId, relationTypes, maxDepth, 10)
            : await queryEngine?.findShortestPath(fromNodeId, toNodeId, relationTypes, maxDepth);
        console?.log('\n🛤️  Path Analysis:');
        console?.log('─'.repeat(50));
        if (options.allPaths) {
            console?.log(`Found ${result.data?.length} paths`);
            result.data?.forEach((path, i) => {
                console?.log(`\nPath ${i + 1} (confidence: ${(path?.confidence * 100).toFixed(1)}%):`);
                path.path?.forEach((node, nodeIndex) => {
                    console?.log(`  ${nodeIndex + 1}. ${node.name} (${node.type})`);
                    if (nodeIndex < path.relationships?.length) {
                        const rel = path.relationships[nodeIndex];
                        console?.log(`     --[${rel.predicate}]-->`);
                    }
                });
            });
        }
        else if (result.data) {
            console?.log(`Shortest path found (confidence: ${(result.data?.confidence * 100).toFixed(1)}%):`);
            result.data.path?.forEach((node, i) => {
                console?.log(`${i + 1}. ${node.name} (${node.type})`);
                if (i < result.data.relationships?.length) {
                    const rel = result.data.relationships[i];
                    console?.log(`   --[${rel.predicate}]-->`);
                }
            });
            console?.log(`\nTotal weight: ${result.data.totalWeight?.toFixed(2)}`);
        }
        else {
            console?.log('❌ No path found between the specified nodes');
        }
        console?.log(`\nQuery took ${result.metadata.executionTime}ms`);
    }
    catch (error) {
        logger.error('Failed to find paths', error);
        process?.exit(1);
    }
}))
    .addCommand(new commander_1.Command('insights')
    .description('Get architectural insights from the knowledge graph')
    .option('--type <types>', 'Insight types: patterns, communities, centrality', 'patterns')
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        logger.info('🔬 Analyzing knowledge graph for insights...');
        const { knowledgeGraph, queryEngine } = initializeKnowledgeGraph(options.project);
        console?.log('\n🔬 Knowledge Graph Insights:');
        console?.log('─'.repeat(50));
        const insightTypes = options.type?.split(',');
        if (insightTypes?.includes('patterns')) {
            const insights = await knowledgeGraph?.detectArchitecturalInsights();
            console?.log('\n📐 Architectural Insights:');
            insights?.forEach((insight, i) => {
                console?.log(`${i + 1}. ${insight.description} (${(insight?.confidence * 100).toFixed(1)}% confidence)`);
                console?.log(`   Type: ${insight.type}`);
                console?.log(`   Affected nodes: ${insight.affectedNodes?.length}`);
                if (insight.recommendations?.length > 0) {
                    console?.log(`   Recommendations:`);
                    insight.recommendations?.forEach(rec => {
                        console?.log(`   - ${rec}`);
                    });
                }
            });
        }
        if (insightTypes?.includes('communities')) {
            const communities = await queryEngine?.findCommunities();
            console?.log('\n🏘️  Semantic Communities:');
            communities.data?.forEach((community, i) => {
                console?.log(`${i + 1}. ${community.name} (${community.nodes?.length} nodes)`);
                console?.log(`   Coherence: ${(community?.coherenceScore * 100).toFixed(1)}%`);
                console?.log(`   Representative triads: ${community.representativeTriads?.length}`);
                if (community.description) {
                    console?.log(`   Description: ${community.description}`);
                }
            });
        }
        if (insightTypes?.includes('centrality')) {
            // Analyze centrality for most important nodes
            const allNodes = await knowledgeGraph?.queryNodes({ limit: 10 });
            console?.log('\n📊 Node Centrality Analysis:');
            for (const node of allNodes) {
                const centrality = await queryEngine?.analyzeNodeCentrality(node.id);
                console?.log(`\n${node.name} (${node.type}):`);
                console?.log(`  Betweenness: ${(centrality.data?.betweennessCentrality * 100).toFixed(1)}%`);
                console?.log(`  Closeness: ${(centrality.data?.closenessCentrality * 100).toFixed(1)}%`);
                console?.log(`  Degree: ${(centrality.data?.degreeCentrality * 100).toFixed(1)}%`);
                console?.log(`  Eigenvector: ${(centrality.data?.eigenvectorCentrality * 100).toFixed(1)}%`);
            }
        }
    }
    catch (error) {
        logger.error('Failed to analyze insights', error);
        process?.exit(1);
    }
}))
    .addCommand(new commander_1.Command('export')
    .description('Export knowledge graph data')
    .option('--format <format>', 'Export format: json, graphml, cypher', 'json')
    .option('--output <file>', 'Output file path')
    .option('--project <path>', 'Project path', '.')
    .action(async (options) => {
    try {
        logger.info(`📤 Exporting knowledge graph in ${options.format} format...`);
        const { knowledgeGraph } = initializeKnowledgeGraph(options.project);
        const graphData = await knowledgeGraph?.exportGraph();
        let exportData;
        let defaultFilename;
        switch (options.format) {
            case 'json':
                exportData = JSON.stringify(graphData, null, 2);
                defaultFilename = 'knowledge-graph.json';
                break;
            case 'graphml':
                exportData = await this?.convertToGraphML(graphData);
                defaultFilename = 'knowledge-graph.graphml';
                break;
            case 'cypher':
                exportData = await this?.convertToCypher(graphData);
                defaultFilename = 'knowledge-graph.cypher';
                break;
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
        const outputPath = options.output || defaultFilename;
        await fs?.writeFile(outputPath, exportData, 'utf-8');
        console?.log(`✅ Knowledge graph exported to ${outputPath}`);
        console?.log(`   Nodes: ${graphData.nodes?.length}`);
        console?.log(`   Triads: ${graphData.triads?.length}`);
        console?.log(`   Size: ${(exportData?.length / 1024).toFixed(2)} KB`);
    }
    catch (error) {
        logger.error('Failed to export knowledge graph', error);
        process?.exit(1);
    }
}));
// Self-improvement commands
program
    .command('self-improve')
    .description('Run self-improvement analysis on CodeMind codebase')
    .option('--apply', 'Apply identified improvements', false)
    .option('--report', 'Generate detailed report', true)
    .option('--project <path>', 'CodeMind project path', '.')
    .action(async (options) => {
    try {
        logger.info('🔄 Running self-improvement analysis...');
        const engine = new self_improvement_engine_1.SelfImprovementEngine(options.project);
        const report = await engine?.runSelfImprovement();
        console?.log('\n🎯 Self-Improvement Report:');
        console?.log('─'.repeat(50));
        console?.log(`Analysis Date: ${report.timestamp?.toISOString()}`);
        console?.log(`Total Improvements: ${report.improvements?.length}`);
        // Group by type
        const byType = report.improvements?.reduce((acc, imp) => {
            acc[imp.type] = (acc[imp.type] || 0) + 1;
            return acc;
        }, {});
        console?.log('\n📊 Improvement Categories:');
        for (const [type, count] of Object.entries(byType)) {
            console?.log(`  ${type?.replace('_', ' ')}: ${count}`);
        }
        // High priority items
        const highPriority = report.improvements?.filter(i => i.benefit > 7);
        if (highPriority?.length > 0) {
            console?.log('\n🔥 High Priority Improvements:');
            highPriority?.forEach((imp, i) => {
                console?.log(`${i + 1}. ${imp.description} (benefit: ${imp.benefit})`);
                console?.log(`   Target: ${imp.target}`);
                console?.log(`   Suggestion: ${imp.suggestion}`);
            });
        }
        // Recommendations
        if (report.recommendations?.length > 0) {
            console?.log('\n💡 Recommendations:');
            report.recommendations?.forEach((rec, i) => {
                console?.log(`${i + 1}. ${rec}`);
            });
        }
        // Metrics comparison
        console?.log('\n📈 Impact Metrics:');
        console?.log(`Before: ${report.metrics.before.totalDuplications || 0} duplications, ${report.metrics.before.circularDependencies || 0} circular deps`);
        console?.log(`After:  ${report.metrics.after.totalDuplications || 0} duplications, ${report.metrics.after.circularDependencies || 0} circular deps`);
        if (options.apply) {
            console?.log('\n🚀 Applying improvements...');
            // In a real scenario, you'd selectively apply improvements
            // For now, just mark them as ready for manual application
            console?.log('Manual application required. Review suggestions above.');
        }
        engine?.close();
    }
    catch (error) {
        logger.error('Self-improvement failed', error);
        process?.exit(1);
    }
});
program
    .command('dogfood')
    .alias('df')
    .description('Use CodeMind tools on CodeMind itself (dogfooding)')
    .option('--feature <feature>', 'Specific feature to dogfood: duplicates|tree|search|centralize', 'all')
    .option('--project <path>', 'CodeMind project path', '.')
    .action(async (options) => {
    try {
        const projectPath = options.project;
        switch (options.feature) {
            case 'duplicates':
            case 'all':
                console?.log('🔍 Finding duplicates in CodeMind codebase...');
                const duplicates = await duplicationDetector?.findDuplicates({
                    projectPath,
                    includeSemantic: true,
                    similarityThreshold: 0.8,
                    includeRefactoringSuggestions: true,
                    filePatterns: ['src/**/*.ts'],
                    excludePatterns: ['**/node_modules/**', '**/dist/**']
                });
                console?.log(`Found ${duplicates.duplicates?.length} duplication groups`);
                if (options?.feature !== 'all')
                    break;
            case 'tree':
                console?.log('🌳 Analyzing CodeMind dependency tree...');
                const tree = await treeNavigator?.buildDependencyTree({
                    projectPath,
                    filePattern: 'src/**/*.ts',
                    showDependencies: true,
                    circularOnly: false
                });
                console?.log(`Tree has ${tree.nodes.size} nodes and ${tree.circularDependencies?.length} circular dependencies`);
                if (options?.feature !== 'all')
                    break;
            case 'search':
                console?.log('🔎 Testing semantic search on CodeMind...');
                const searchResults = await vectorSearch?.search({
                    query: 'AST analysis',
                    projectPath,
                    limit: 5,
                    crossProject: false,
                    useSemanticSearch: true
                });
                console?.log(`Found ${searchResults.matches?.length} semantic matches`);
                if (options?.feature !== 'all')
                    break;
            case 'centralize':
                console?.log('🎯 Finding centralization opportunities in CodeMind...');
                const centralization = await centralizationDetector?.scanProject({
                    projectPath,
                    includeMigrationPlan: true,
                    includeRiskAssessment: true
                });
                console?.log(`Found ${centralization.opportunities?.length} centralization opportunities`);
                break;
            default:
                console?.log('❌ Unknown feature. Use: duplicates, tree, search, centralize, or all');
                return;
        }
        console?.log('✅ Dogfooding complete. CodeMind has been analyzed by CodeMind!');
    }
    catch (error) {
        logger.error('Dogfooding failed', error);
        process?.exit(1);
    }
});
// Add the auto-fix command
program.addCommand((0, auto_fix_1.createAutoFixCommand)());
// Global options
program?.option('-v, --verbose', 'Verbose logging', false);
program?.option('--debug', 'Debug mode', false);
program?.hook('preAction', (thisCommand) => {
    const options = thisCommand?.opts();
    if (options.verbose) {
        logger.setLevel('info');
    }
    if (options.debug) {
        logger.setLevel('debug');
    }
});
// Parse CLI arguments
program?.parse();
//# sourceMappingURL=codemind.js.map