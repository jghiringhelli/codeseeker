"use strict";
/**
 * Intelligent Cycle Features
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Enhanced cycle validation features that use semantic search and AI-powered analysis
 * to provide intelligent, proactive feedback during development.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentCycleFeatures = void 0;
const logger_1 = require("./logger");
const semantic_graph_1 = __importDefault(require("../cli/services/data/semantic-graph/semantic-graph"));
const semantic_deduplication_service_1 = require("./intelligent-cycle/services/semantic-deduplication-service");
const intent_analysis_service_1 = require("./intelligent-cycle/services/intent-analysis-service");
const similarity_matching_service_1 = require("./intelligent-cycle/services/similarity-matching-service");
const security_scanning_service_1 = require("./intelligent-cycle/services/security-scanning-service");
const code_extraction_service_1 = require("./intelligent-cycle/services/code-extraction-service");
class IntelligentCycleFeatures {
    semanticDeduplicationService;
    intentAnalysisService;
    similarityMatchingService;
    securityScanningService;
    codeExtractionService;
    logger;
    semanticGraph;
    initialized = false;
    constructor(semanticDeduplicationService, intentAnalysisService, similarityMatchingService, securityScanningService, codeExtractionService) {
        this.semanticDeduplicationService = semanticDeduplicationService;
        this.intentAnalysisService = intentAnalysisService;
        this.similarityMatchingService = similarityMatchingService;
        this.securityScanningService = securityScanningService;
        this.codeExtractionService = codeExtractionService;
        this.logger = logger_1.Logger.getInstance();
        this.semanticGraph = new semantic_graph_1.default();
        // Initialize services with dependency injection
        this.similarityMatchingService = this.similarityMatchingService || new similarity_matching_service_1.SimilarityMatchingService();
        this.intentAnalysisService = this.intentAnalysisService || new intent_analysis_service_1.IntentAnalysisService();
        this.semanticDeduplicationService = this.semanticDeduplicationService || new semantic_deduplication_service_1.SemanticDeduplicationService(this.intentAnalysisService, this.similarityMatchingService);
        this.securityScanningService = this.securityScanningService || new security_scanning_service_1.SecurityScanningService();
        this.codeExtractionService = this.codeExtractionService || new code_extraction_service_1.CodeExtractionService();
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.semanticGraph.initialize();
            this.initialized = true;
            this.logger.info('🧠 Intelligent cycle features initialized');
        }
        catch (error) {
            this.logger.warn('⚠️ Semantic features unavailable, using fallback methods');
            // Continue without semantic features
            this.initialized = true;
        }
    }
    /**
     * Semantic-Powered Deduplication
     * Uses semantic search to find existing implementations before creating new code
     */
    async checkSemanticDuplication(projectPath, userIntent, changedFiles) {
        await this.initialize();
        // Delegate to semantic deduplication service
        return this.semanticDeduplicationService.checkSemanticDuplication(userIntent, // functionality parameter
        userIntent, // userIntent parameter
        projectPath, changedFiles ? changedFiles.join(',') : undefined // cacheKey
        );
    }
    /**
     * Analyze user intent from their request
     */
    async analyzeUserIntent(userIntent) {
        // Delegate to intent analysis service
        return this.intentAnalysisService.analyzeUserIntent(userIntent);
    }
    /**
     * Smart Security Analysis
     * Enhanced security checking with context-aware vulnerability detection
     */
    async performSmartSecurity(projectPath, changedFiles, userIntent) {
        // Delegate to security scanning service
        return this.securityScanningService.performSmartSecurity(userIntent, // functionality parameter
        userIntent, projectPath);
    }
    /**
     * Extract code snippet from file (backward compatibility method)
     */
    async extractCodeSnippet(file, startLine, endLine) {
        // Delegate to code extraction service
        return this.codeExtractionService.extractCodeSnippet(file, undefined, // functionName
        undefined, // className
        { start: startLine, end: endLine });
    }
    // Additional method for validation cycle compatibility
    async performSemanticDeduplication(userIntent, projectPath, language) {
        return this.checkSemanticDuplication(projectPath, userIntent, language ? [language] : undefined);
    }
}
exports.IntelligentCycleFeatures = IntelligentCycleFeatures;
exports.default = IntelligentCycleFeatures;
//# sourceMappingURL=intelligent-cycle-features.js.map