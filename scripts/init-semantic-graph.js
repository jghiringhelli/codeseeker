const { SemanticGraphService } = require('../dist/services/semantic-graph');
const { EnhancedDocumentMapAnalyzer } = require('../dist/features/documentation/enhanced-map-analyzer');
const { Logger } = require('../dist/shared/logger');

async function initializeSemanticGraph() {
    const logger = Logger.getInstance();
    
    try {
        logger.info('🧠 Initializing CodeMind Semantic Graph...');
        
        // Initialize semantic graph service
        const semanticGraph = new SemanticGraphService();
        
        // Initialize the enhanced document analyzer  
        const analyzer = new EnhancedDocumentMapAnalyzer();
        
        // Analyze the project and populate the semantic graph
        const projectPath = process.cwd();
        logger.info(`📂 Analyzing project: ${projectPath}`);
        
        const analysisParams = {
            projectPath: projectPath,
            includeCodeAnalysis: true,
            maxDepth: 3,
            fileTypes: ['.ts', '.js', '.md', '.json']
        };
        
        const result = await analyzer.analyzeDocumentationWithSemantics(analysisParams);
        logger.info('✅ Project analysis completed');
        
        // Get graph statistics
        const stats = await semanticGraph.getGraphStatistics();
        logger.info('📊 Graph Statistics:', stats);
        
        // Test semantic search
        logger.info('🔍 Testing semantic search...');
        const searchResults = await semanticGraph.semanticSearch('authentication');
        logger.info(`🎯 Found ${searchResults.length} results for 'authentication'`);
        
        logger.info('🎉 Semantic graph initialization completed successfully!');
        
    } catch (error) {
        logger.error('❌ Semantic graph initialization failed:', error);
        process.exit(1);
    }
}

// Run initialization
initializeSemanticGraph().catch(error => {
    console.error('💥 Fatal error during initialization:', error);
    process.exit(1);
});