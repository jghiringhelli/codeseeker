const { ToolAutodiscoveryService } = require('../dist/shared/tool-autodiscovery');
const { SemanticGraphService } = require('../dist/services/semantic-graph');
const { Logger } = require('../dist/shared/logger');

async function initializeProjectWithAutodiscovery() {
    const logger = Logger.getInstance();
    
    try {
        logger.info('🚀 CodeMind Enhanced Project Initialization with Autodiscovery...');
        
        const projectPath = process.env.PROJECT_PATH || process.cwd();
        const projectId = process.env.PROJECT_ID || `proj_${Date.now()}`;
        
        logger.info(`📂 Project: ${projectPath}`);
        logger.info(`🆔 Project ID: ${projectId}`);
        
        // 1. Initialize tool autodiscovery service
        const toolService = new ToolAutodiscoveryService();
        await toolService.initializeTools();
        
        // 2. Initialize semantic graph
        const semanticGraph = new SemanticGraphService();
        await semanticGraph.initialize();
        
        // 3. Use autodiscovery to initialize all tools for this project
        logger.info('🔧 Auto-initializing all internal tools with Claude Code analysis...');
        const initResult = await toolService.initializeProjectForAllTools(projectPath, projectId);
        
        if (initResult.success) {
            logger.info(`✅ Tool initialization complete:`);
            logger.info(`   📊 Tables created: ${initResult.totalTablesCreated}`);
            logger.info(`   📝 Records inserted: ${initResult.totalRecordsInserted}`);
            
            // Show per-tool results
            for (const [toolName, result] of initResult.results.entries()) {
                if (result.success) {
                    logger.info(`   ✅ ${toolName}: ${result.recordsInserted || 0} records`);
                } else {
                    logger.warn(`   ⚠️  ${toolName}: ${result.error}`);
                }
            }
        } else {
            logger.warn('⚠️  Some tools failed to initialize, but continuing...');
        }
        
        // 4. Run full project analysis with all tools
        logger.info('🧠 Running comprehensive project analysis...');
        const analysisResult = await toolService.analyzeProjectWithAllTools(projectPath, projectId);
        
        if (analysisResult.success) {
            logger.info(`✅ Project analysis complete in ${analysisResult.totalExecutionTime}ms`);
            
            // Show analysis insights
            for (const [toolName, result] of analysisResult.results.entries()) {
                if (result.recommendations && result.recommendations.length > 0) {
                    logger.info(`💡 ${toolName} recommendations:`);
                    result.recommendations.forEach(rec => logger.info(`   • ${rec}`));
                }
            }
        } else {
            logger.warn('⚠️  Some analysis steps failed, but data was collected');
        }
        
        // 5. Get final semantic graph statistics
        const stats = await semanticGraph.getGraphStatistics();
        logger.info('📊 Final Graph Statistics:', stats);
        
        // 6. Get tool status summary
        const toolStatuses = await toolService.getToolsStatus(projectId);
        logger.info('🔧 Tool Status Summary:');
        toolStatuses.forEach(({ name, status }) => {
            const health = status.health === 'healthy' ? '✅' : status.health === 'warning' ? '⚠️' : '❌';
            logger.info(`   ${health} ${name}: ${status.initialized ? 'Ready' : 'Not Ready'}`);
        });
        
        logger.info('🎉 Enhanced project initialization completed successfully!');
        
    } catch (error) {
        logger.error('❌ Enhanced project initialization failed:', error);
        process.exit(1);
    }
}

// Run initialization
initializeProjectWithAutodiscovery().catch(error => {
    console.error('💥 Fatal error during enhanced initialization:', error);
    process.exit(1);
});