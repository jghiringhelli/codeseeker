"use strict";
/**
 * Node Builder - Single Responsibility: Create Neo4j nodes
 * Follows Single Responsibility and Open/Closed principles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeBuilder = void 0;
const logger_1 = require("../../../../utils/logger");
class NodeBuilder {
    semanticGraph;
    logger = logger_1.Logger.getInstance();
    constructor(semanticGraph) {
        this.semanticGraph = semanticGraph;
    }
    /**
     * Create all nodes for a parsed file structure
     */
    async createNodesForFile(structure, projectId) {
        const result = {
            fileNodeId: '',
            classNodeIds: new Map(),
            functionNodeIds: new Map(),
            interfaceNodeIds: new Map()
        };
        try {
            // Create file node
            result.fileNodeId = await this.createFileNode(structure, projectId);
            // Create class nodes
            for (const classInfo of structure.classes) {
                const nodeId = await this.createClassNode(classInfo, structure.filePath, projectId);
                result.classNodeIds.set(classInfo.name, nodeId);
            }
            // Create function nodes  
            for (const functionInfo of structure.functions) {
                const nodeId = await this.createFunctionNode(functionInfo, structure.filePath, projectId);
                result.functionNodeIds.set(functionInfo.name, nodeId);
            }
            // Create interface nodes
            for (const interfaceName of structure.interfaces) {
                const nodeId = await this.createInterfaceNode(interfaceName, structure.filePath, projectId);
                result.interfaceNodeIds.set(interfaceName, nodeId);
            }
            this.logger.debug(`Created nodes for ${structure.filePath}: ${structure.classes.length} classes, ${structure.functions.length} functions`);
        }
        catch (error) {
            this.logger.error(`Failed to create nodes for ${structure.filePath}:`, error);
            throw error;
        }
        return result;
    }
    /**
     * Create file node with metadata
     */
    async createFileNode(structure, projectId) {
        return await this.semanticGraph.addNode('Code', {
            name: this.getFileName(structure.filePath),
            path: structure.filePath,
            language: structure.language,
            project_id: projectId,
            node_type: 'file',
            imports_count: structure.imports.length,
            exports_count: structure.exports.length,
            classes_count: structure.classes.length,
            functions_count: structure.functions.length,
            imports: structure.imports.map(imp => imp.name),
            exports: structure.exports.map(exp => exp.name),
            dependencies: structure.dependencies,
            keywords: this.extractKeywords(structure)
        });
    }
    /**
     * Create class node with inheritance info
     */
    async createClassNode(classInfo, filePath, projectId) {
        return await this.semanticGraph.addNode('Code', {
            name: classInfo.name,
            path: filePath,
            project_id: projectId,
            node_type: 'class',
            extends: classInfo.extends,
            implements: classInfo.implements || [],
            methods: classInfo.methods,
            properties: classInfo.properties,
            methods_count: classInfo.methods.length,
            properties_count: classInfo.properties.length,
            is_abstract: classInfo.isAbstract || false,
            keywords: [classInfo.name, ...(classInfo.methods || []), ...(classInfo.properties || [])]
        });
    }
    /**
     * Create function node with signature info
     */
    async createFunctionNode(functionInfo, filePath, projectId) {
        return await this.semanticGraph.addNode('Code', {
            name: functionInfo.name,
            path: filePath,
            project_id: projectId,
            node_type: 'function',
            parameters: functionInfo.parameters,
            parameter_count: functionInfo.parameters.length,
            return_type: functionInfo.returnType,
            is_async: functionInfo.isAsync || false,
            is_exported: functionInfo.isExported || false,
            signature: this.buildFunctionSignature(functionInfo),
            keywords: [functionInfo.name, ...(functionInfo.parameters || [])]
        });
    }
    /**
     * Create interface node
     */
    async createInterfaceNode(interfaceName, filePath, projectId) {
        return await this.semanticGraph.addNode('Code', {
            name: interfaceName,
            path: filePath,
            project_id: projectId,
            node_type: 'interface',
            keywords: [interfaceName]
        });
    }
    /**
     * Create business concept node from code analysis
     */
    async createBusinessConceptNode(conceptName, description, domain, projectId) {
        return await this.semanticGraph.addNode('BusinessConcept', {
            name: conceptName,
            description,
            domain,
            project_id: projectId,
            keywords: conceptName.toLowerCase().split(/[A-Z]/).filter(w => w.length > 0)
        });
    }
    /**
     * Create documentation node
     */
    async createDocumentationNode(title, filePath, content, projectId) {
        return await this.semanticGraph.addNode('Documentation', {
            title,
            path: filePath,
            content: content.substring(0, 1000), // Limit content size
            project_id: projectId,
            keywords: this.extractDocumentationKeywords(title, content)
        });
    }
    /**
     * Create test node
     */
    async createTestNode(testName, filePath, testedFile, projectId) {
        return await this.semanticGraph.addNode('TestCase', {
            name: testName,
            path: filePath,
            tested_file: testedFile,
            project_id: projectId,
            keywords: [testName, this.getFileName(testedFile)]
        });
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    getFileName(filePath) {
        return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
    }
    extractKeywords(structure) {
        const keywords = new Set();
        // Add file name components
        const fileName = this.getFileName(structure.filePath).replace(/\.[^.]+$/, '');
        fileName.split(/[-_.]/).forEach(part => {
            if (part.length > 2)
                keywords.add(part.toLowerCase());
        });
        // Add class names
        structure.classes.forEach(cls => {
            keywords.add(cls.name.toLowerCase());
        });
        // Add function names
        structure.functions.forEach(fn => {
            keywords.add(fn.name.toLowerCase());
        });
        // Add import/export names
        structure.imports.forEach(imp => {
            if (imp.name !== '*')
                keywords.add(imp.name.toLowerCase());
        });
        return Array.from(keywords);
    }
    extractDocumentationKeywords(title, content) {
        const keywords = new Set();
        // Extract from title
        title.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 3)
                keywords.add(word);
        });
        // Extract key terms from content
        const keyTerms = content.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]*)*\b/g) || [];
        keyTerms.forEach(term => {
            if (term.length > 3)
                keywords.add(term.toLowerCase());
        });
        return Array.from(keywords).slice(0, 20); // Limit keywords
    }
    buildFunctionSignature(functionInfo) {
        const params = functionInfo.parameters.join(', ');
        const asyncPrefix = functionInfo.isAsync ? 'async ' : '';
        const returnType = functionInfo.returnType ? `: ${functionInfo.returnType}` : '';
        return `${asyncPrefix}${functionInfo.name}(${params})${returnType}`;
    }
}
exports.NodeBuilder = NodeBuilder;
//# sourceMappingURL=NodeBuilder.js.map