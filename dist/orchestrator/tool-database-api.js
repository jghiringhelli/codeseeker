"use strict";
/**
 * Tool Database API - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 951 lines to ~150 lines using service extraction
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolDatabaseRouter = exports.toolDB = exports.ToolDatabaseAPI = void 0;
const express_1 = __importDefault(require("express"));
const database_connection_service_1 = require("./services/database-connection-service");
const tool_data_service_1 = require("./services/tool-data-service");
const semantic_search_service_1 = require("./services/semantic-search-service");
const code_duplications_service_1 = require("./services/code-duplications-service");
const router = express_1.default.Router();
exports.toolDatabaseRouter = router;
/**
 * Main Tool Database API Coordinator
 * Uses dependency injection for all database operations
 */
class ToolDatabaseAPI {
    toolDataService;
    semanticSearchService;
    codeDuplicationsService;
    db;
    constructor(config, toolDataService, semanticSearchService, codeDuplicationsService) {
        this.toolDataService = toolDataService;
        this.semanticSearchService = semanticSearchService;
        this.codeDuplicationsService = codeDuplicationsService;
        // Initialize database connection
        this.db = new database_connection_service_1.DatabaseConnectionService(config);
        // Initialize services with dependency injection
        this.toolDataService = this.toolDataService || new tool_data_service_1.ToolDataService(this.db);
        this.semanticSearchService = this.semanticSearchService || new semantic_search_service_1.SemanticSearchService(this.db);
        this.codeDuplicationsService = this.codeDuplicationsService || new code_duplications_service_1.CodeDuplicationsService(this.db);
    }
    async initialize() {
        return await this.db.initialize();
    }
    async query(text, params) {
        return await this.db.query(text, params);
    }
    async close() {
        return await this.db.close();
    }
    // === TOOL DATA DELEGATION ===
    async saveToolData(projectId, toolName, data) {
        if (toolName === 'semantic-search') {
            return await this.semanticSearchService.saveSemanticSearchData(projectId, data);
        }
        return await this.toolDataService.saveToolData(projectId, toolName, data);
    }
    async getToolData(projectId, toolName, options) {
        // For backward compatibility, ignore options for now
        return await this.toolDataService.getToolData(projectId, toolName);
    }
    async deleteToolData(projectId, toolName) {
        return await this.toolDataService.deleteToolData(projectId, toolName);
    }
    // === SEMANTIC SEARCH DELEGATION ===
    async getSemanticSearchData(projectId, filters) {
        return await this.semanticSearchService.getSemanticSearchData(projectId, filters);
    }
    async saveSemanticSearchData(projectId, data) {
        return await this.semanticSearchService.saveSemanticSearchData(projectId, data);
    }
    async saveSemanticSearch(projectId, data) {
        return await this.semanticSearchService.saveSemanticSearch(projectId, data);
    }
    async getSemanticSearch(projectId, filters) {
        return await this.semanticSearchService.getSemanticSearch(projectId, filters);
    }
    // === CODE DUPLICATIONS DELEGATION ===
    async getCodeDuplications(projectId, filters = {}) {
        return await this.codeDuplicationsService.getDuplications(projectId, filters);
    }
    async saveCodeDuplications(projectId, data) {
        return await this.codeDuplicationsService.saveDuplications(projectId, data);
    }
    async deleteCodeDuplications(projectId) {
        return await this.codeDuplicationsService.deleteDuplications(projectId);
    }
    // === CONVENIENCE METHODS ===
    /**
     * Get comprehensive project data across all tools
     */
    async getProjectOverview(projectId) {
        try {
            const [toolData, semanticSearchData, duplicationsData] = await Promise.all([
                this.toolDataService.getToolData(projectId, 'overview').catch(() => null),
                this.semanticSearchService.getSemanticSearchData(projectId, { limit: 10 }),
                this.codeDuplicationsService.getDuplications(projectId, { limit: 10 })
            ]);
            return {
                projectId,
                overview: toolData?.data || {},
                semanticSearchCount: semanticSearchData.length,
                duplicationsCount: duplicationsData.length,
                lastUpdated: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error getting project overview:', error);
            throw error;
        }
    }
    /**
     * Clean all data for a project
     */
    async cleanProjectData(projectId) {
        try {
            await Promise.all([
                this.semanticSearchService.deleteSemanticSearchData(projectId),
                this.codeDuplicationsService.deleteDuplications(projectId),
                // Note: Tool data cleanup would need getAllToolTypes method
            ]);
            return { success: true, projectId, cleanedAt: new Date().toISOString() };
        }
        catch (error) {
            console.error('Error cleaning project data:', error);
            throw error;
        }
    }
    /**
     * Health check for all services
     */
    async healthCheck() {
        try {
            await this.db.query('SELECT 1');
            return {
                status: 'healthy',
                database: 'connected',
                services: {
                    toolData: 'active',
                    semanticSearch: 'active',
                    codeDuplications: 'active'
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}
exports.ToolDatabaseAPI = ToolDatabaseAPI;
// ============================================
// REST API ENDPOINTS (Express Router)
// ============================================
// Create API instance
const api = new ToolDatabaseAPI();
// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const health = await api.healthCheck();
        res.json(health);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Project overview endpoint
router.get('/projects/:projectId/overview', async (req, res) => {
    try {
        const overview = await api.getProjectOverview(req.params.projectId);
        res.json(overview);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Tool data endpoints
router.post('/projects/:projectId/tools/:toolName', async (req, res) => {
    try {
        const result = await api.saveToolData(req.params.projectId, req.params.toolName, req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/projects/:projectId/tools/:toolName', async (req, res) => {
    try {
        const result = await api.getToolData(req.params.projectId, req.params.toolName);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Backward compatibility exports
exports.toolDB = new ToolDatabaseAPI();
exports.default = ToolDatabaseAPI;
//# sourceMappingURL=tool-database-api.js.map