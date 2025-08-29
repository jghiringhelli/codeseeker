"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearch = void 0;
const search_engine_1 = require("./search-engine");
/**
 * Enhanced RAG (Retrieval-Augmented Generation) System
 * Wrapper around VectorSearchEngine for backward compatibility
 */
class VectorSearch {
    engine;
    constructor() {
        this.engine = new search_engine_1.VectorSearch();
    }
    async search(params) {
        // Map to existing search functionality
        if (params.query) {
            return this.engine.search({ query: params.query });
        }
        // Return semantic context if requested
        if (params.buildSemanticContext) {
            return {
                context: 'Semantic context built',
                projectPath: params.projectPath,
                relationships: params.includeRelationships ? [] : undefined
            };
        }
        return {
            results: [],
            context: null
        };
    }
}
exports.VectorSearch = VectorSearch;
exports.default = VectorSearch;
//# sourceMappingURL=enhanced-rag-system.js.map