"use strict";
/**
 * Code Relationship Parser
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Parses project files to extract relationships for the semantic graph
 */
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
exports.CodeRelationshipParser = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../../../utils/logger");
const semantic_graph_1 = require("./semantic-graph/semantic-graph");
const file_parsing_service_1 = require("./code-parsing/services/file-parsing-service");
const project_structure_service_1 = require("./code-parsing/services/project-structure-service");
const graph_population_service_1 = require("./code-parsing/services/graph-population-service");
class CodeRelationshipParser {
    fileParsingService;
    projectStructureService;
    graphPopulationService;
    logger = logger_1.Logger.getInstance();
    semanticGraph;
    constructor(fileParsingService, projectStructureService, graphPopulationService) {
        this.fileParsingService = fileParsingService;
        this.projectStructureService = projectStructureService;
        this.graphPopulationService = graphPopulationService;
        this.semanticGraph = new semantic_graph_1.SemanticGraphService();
        // Initialize services with dependency injection
        this.fileParsingService = this.fileParsingService || new file_parsing_service_1.FileParsingService();
        this.projectStructureService = this.projectStructureService || new project_structure_service_1.ProjectStructureService(this.fileParsingService);
        this.graphPopulationService = this.graphPopulationService || new graph_population_service_1.GraphPopulationService(this.semanticGraph);
    }
    async initialize() {
        await this.semanticGraph.initialize();
        this.logger.info('🔍 Code relationship parser initialized');
    }
    /**
     * Parse individual file (public wrapper for parseCodeFile)
     */
    async parseFile(filePath) {
        const relativePath = path.relative(process.cwd(), filePath);
        return await this.fileParsingService.parseCodeFile(filePath, relativePath);
    }
    /**
     * Parse entire project and populate semantic graph
     */
    async parseAndPopulateProject(projectPath, projectId) {
        this.logger.info(`🔄 Parsing project structure: ${projectPath}`);
        try {
            // Step 1: Parse all code files and analyze relationships
            const structure = await this.projectStructureService.parseProjectStructure(projectPath);
            // Step 2: Create nodes in Neo4j
            this.logger.info('📊 Creating graph nodes...');
            const nodeIdMap = await this.graphPopulationService.createGraphNodes(structure, projectId);
            // Step 3: Create relationships in Neo4j
            this.logger.info('🔗 Creating graph relationships...');
            await this.graphPopulationService.createGraphRelationships(structure, nodeIdMap, projectId);
            // Step 4: Extract business concepts
            this.logger.info('🧠 Extracting business concepts...');
            await this.graphPopulationService.extractBusinessConcepts(structure, projectId);
            // Step 5: Generate project summary
            this.generateProjectSummary(structure, projectId);
            this.logger.info('✅ Project parsing and graph population completed successfully');
        }
        catch (error) {
            this.logger.error('❌ Project parsing failed:', error);
            throw error;
        }
    }
    /**
     * Analyze project structure without populating the graph
     */
    async analyzeProjectStructure(projectPath) {
        this.logger.info(`📋 Analyzing project structure: ${projectPath}`);
        try {
            const structure = await this.projectStructureService.parseProjectStructure(projectPath);
            // Generate analysis report
            this.logger.info('📊 Project Analysis Summary:');
            this.logger.info(`📁 Files analyzed: ${structure.files.length}`);
            this.logger.info(`🔗 Relationships found: ${structure.relationships.length}`);
            const languageStats = this.calculateLanguageStatistics(structure);
            this.logger.info(`💻 Languages: ${Object.entries(languageStats).map(([lang, count]) => `${lang}(${count})`).join(', ')}`);
            const complexityStats = this.calculateComplexityStatistics(structure);
            this.logger.info(`🎯 Average complexity: ${complexityStats.average.toFixed(2)}`);
            return structure;
        }
        catch (error) {
            this.logger.error('❌ Project analysis failed:', error);
            throw error;
        }
    }
    /**
     * Get parsing statistics for a project
     */
    getProjectStatistics(structure) {
        const languageStats = this.calculateLanguageStatistics(structure);
        const complexityStats = this.calculateComplexityStatistics(structure);
        const architecturalPatterns = this.projectStructureService.analyzeArchitecturalPatterns(structure);
        const classCount = structure.files.reduce((sum, file) => sum + file.classes.length, 0);
        const functionCount = structure.files.reduce((sum, file) => sum + file.functions.length, 0);
        const interfaceCount = structure.files.reduce((sum, file) => sum + file.interfaces.length, 0);
        return {
            files: structure.files.length,
            relationships: structure.relationships.length,
            languages: languageStats,
            classes: classCount,
            functions: functionCount,
            interfaces: interfaceCount,
            complexity: complexityStats,
            patterns: architecturalPatterns
        };
    }
    generateProjectSummary(structure, projectId) {
        const stats = this.getProjectStatistics(structure);
        this.logger.info('📈 Project Analysis Complete:');
        this.logger.info(`  📁 Files: ${stats.files}`);
        this.logger.info(`  🏗️ Classes: ${stats.classes}`);
        this.logger.info(`  🔧 Functions: ${stats.functions}`);
        this.logger.info(`  📋 Interfaces: ${stats.interfaces}`);
        this.logger.info(`  🔗 Relationships: ${stats.relationships}`);
        this.logger.info(`  🎯 Avg Complexity: ${stats.complexity.average.toFixed(2)}`);
        this.logger.info(`  🏛️ Architecture: ${stats.patterns.layered ? 'Layered' : 'Flat'}, ${stats.patterns.modular ? 'Modular' : 'Monolithic'}`);
        if (stats.patterns.patterns.length > 0) {
            this.logger.info(`  🎨 Patterns: ${stats.patterns.patterns.join(', ')}`);
        }
        if (stats.patterns.suggestions.length > 0) {
            this.logger.info(`  💡 Suggestions:`);
            stats.patterns.suggestions.forEach(suggestion => {
                this.logger.info(`    • ${suggestion}`);
            });
        }
    }
    calculateLanguageStatistics(structure) {
        const languageStats = {};
        for (const file of structure.files) {
            languageStats[file.language] = (languageStats[file.language] || 0) + 1;
        }
        return languageStats;
    }
    calculateComplexityStatistics(structure) {
        let totalComplexity = 0;
        let maxComplexity = 0;
        let functionCount = 0;
        for (const file of structure.files) {
            // Count standalone functions
            for (const func of file.functions) {
                totalComplexity += func.complexity;
                maxComplexity = Math.max(maxComplexity, func.complexity);
                functionCount++;
            }
            // Count class methods
            for (const cls of file.classes) {
                for (const method of cls.methods) {
                    totalComplexity += method.complexity;
                    maxComplexity = Math.max(maxComplexity, method.complexity);
                    functionCount++;
                }
            }
        }
        return {
            average: functionCount > 0 ? totalComplexity / functionCount : 0,
            max: maxComplexity,
            total: totalComplexity
        };
    }
    async close() {
        await this.semanticGraph.close();
        this.logger.info('📊 Code relationship parser closed');
    }
}
exports.CodeRelationshipParser = CodeRelationshipParser;
exports.default = CodeRelationshipParser;
//# sourceMappingURL=code-relationship-parser.js.map