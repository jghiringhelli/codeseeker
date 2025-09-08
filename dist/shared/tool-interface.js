"use strict";
/**
 * Common interface that all internal tools must implement
 * Enables autodiscovery and automatic integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = exports.InternalTool = void 0;
/**
 * Base interface that all CodeMind internal tools must implement
 */
class InternalTool {
    /**
     * Check if tool can analyze the given project
     */
    canAnalyzeProject(projectPath) {
        // Default implementation - most tools can analyze any project
        return Promise.resolve(true);
    }
    /**
     * Get tool status for a project
     */
    async getStatus(projectId) {
        // Default implementation - override for specific needs
        return {
            initialized: true,
            health: 'healthy'
        };
    }
}
exports.InternalTool = InternalTool;
/**
 * Tool discovery registry
 */
class ToolRegistry {
    static tools = new Map();
    static registerTool(tool) {
        const metadata = tool.getMetadata();
        this.tools.set(metadata.name, tool);
    }
    static getAllTools() {
        return Array.from(this.tools.values());
    }
    static getTool(name) {
        return this.tools.get(name);
    }
    static getToolById(id) {
        return this.getTool(id);
    }
    static getToolsByCategory(category) {
        return Array.from(this.tools.values()).filter(tool => tool.getMetadata().category === category);
    }
    static discoverTools() {
        return Array.from(this.tools.values()).map(tool => tool.getMetadata());
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=tool-interface.js.map