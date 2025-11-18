"use strict";
/**
 * Relationship Builder - Single Responsibility: Create Neo4j relationships
 * Follows Single Responsibility and Dependency Inversion principles
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
exports.RelationshipBuilder = void 0;
const logger_1 = require("../../../../../utils/logger");
const path = __importStar(require("path"));
class RelationshipBuilder {
    semanticGraph;
    logger = logger_1.Logger.getInstance();
    constructor(semanticGraph) {
        this.semanticGraph = semanticGraph;
    }
    /**
     * Create all relationships for a file's structure
     */
    async createRelationshipsForFile(structure, nodeResult, allFileNodes, projectPath) {
        try {
            // Create import relationships
            await this.createImportRelationships(structure, nodeResult.fileNodeId, allFileNodes, projectPath);
            // Create class inheritance relationships
            await this.createClassRelationships(structure, nodeResult, allFileNodes);
            // Create function relationships (methods to classes)
            await this.createFunctionRelationships(structure, nodeResult);
            // Create file-to-code element relationships
            await this.createContainmentRelationships(nodeResult);
            this.logger.debug(`Created relationships for ${structure.filePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to create relationships for ${structure.filePath}:`, error);
            throw error;
        }
    }
    /**
     * Create import/dependency relationships between files
     */
    async createImportRelationships(structure, fileNodeId, allFileNodes, projectPath) {
        for (const importInfo of structure.imports) {
            // Resolve import path to actual file
            const resolvedPath = this.resolveImportPath(structure.filePath, importInfo.from, projectPath);
            if (resolvedPath && allFileNodes.has(resolvedPath)) {
                const targetNodeId = allFileNodes.get(resolvedPath);
                await this.semanticGraph.addRelationship(fileNodeId, targetNodeId, 'IMPORTS', {
                    import_name: importInfo.name,
                    is_default: importInfo.isDefault || false,
                    alias: importInfo.alias,
                    from_path: importInfo.from
                });
                // Create stronger dependency relationship for relative imports
                if (importInfo.from.startsWith('./') || importInfo.from.startsWith('../')) {
                    await this.semanticGraph.addRelationship(fileNodeId, targetNodeId, 'DEPENDS_ON', {
                        dependency_type: 'file_import',
                        strength: 'high'
                    });
                }
            }
        }
    }
    /**
     * Create class inheritance and implementation relationships
     */
    async createClassRelationships(structure, nodeResult, allFileNodes) {
        for (const classInfo of structure.classes) {
            const classNodeId = nodeResult.classNodeIds.get(classInfo.name);
            if (!classNodeId)
                continue;
            // Create extends relationship
            if (classInfo.extends) {
                await this.createInheritanceRelationship(classInfo.extends, classNodeId, 'EXTENDS', allFileNodes);
            }
            // Create implements relationships
            if (classInfo.implements) {
                for (const interfaceName of classInfo.implements) {
                    await this.createInheritanceRelationship(interfaceName, classNodeId, 'IMPLEMENTS', allFileNodes);
                }
            }
            // Create method relationships (class contains methods)
            for (const methodName of classInfo.methods) {
                const methodNodeId = nodeResult.functionNodeIds.get(methodName);
                if (methodNodeId) {
                    await this.semanticGraph.addRelationship(classNodeId, methodNodeId, 'CONTAINS', {
                        element_type: 'method'
                    });
                }
            }
        }
    }
    /**
     * Create inheritance relationship (extends/implements)
     */
    async createInheritanceRelationship(targetName, sourceNodeId, relationshipType, allFileNodes) {
        // Find target class/interface in current file nodes
        // This is simplified - in reality, we'd need to resolve across files
        try {
            await this.semanticGraph.addRelationship(sourceNodeId, sourceNodeId, // Placeholder - should resolve to actual target
            relationshipType, {
                target_name: targetName,
                resolved: false // Mark as unresolved for post-processing
            });
        }
        catch (error) {
            this.logger.debug(`Could not resolve ${relationshipType} relationship to ${targetName}`);
        }
    }
    /**
     * Create function-related relationships
     */
    async createFunctionRelationships(structure, nodeResult) {
        // This is where we'd analyze function calls within the code
        // For now, we'll create basic relationships
        for (const functionInfo of structure.functions) {
            const functionNodeId = nodeResult.functionNodeIds.get(functionInfo.name);
            if (!functionNodeId)
                continue;
            // Create relationship to file
            await this.semanticGraph.addRelationship(nodeResult.fileNodeId, functionNodeId, 'CONTAINS', {
                element_type: 'function',
                is_exported: functionInfo.isExported || false
            });
        }
    }
    /**
     * Create containment relationships (file contains classes, functions, etc.)
     */
    async createContainmentRelationships(nodeResult) {
        // File contains classes
        for (const [className, classNodeId] of nodeResult.classNodeIds) {
            await this.semanticGraph.addRelationship(nodeResult.fileNodeId, classNodeId, 'CONTAINS', {
                element_type: 'class',
                element_name: className
            });
        }
        // File contains interfaces
        for (const [interfaceName, interfaceNodeId] of nodeResult.interfaceNodeIds) {
            await this.semanticGraph.addRelationship(nodeResult.fileNodeId, interfaceNodeId, 'CONTAINS', {
                element_type: 'interface',
                element_name: interfaceName
            });
        }
    }
    /**
     * Create business concept relationships
     */
    async createBusinessConceptRelationships(conceptNodeId, relatedCodeNodeIds, relatedDocNodeIds = [], relatedTestNodeIds = []) {
        // Concept implemented by code
        for (const codeNodeId of relatedCodeNodeIds) {
            await this.semanticGraph.addRelationship(codeNodeId, conceptNodeId, 'IMPLEMENTS', {
                relationship_type: 'business_concept'
            });
        }
        // Concept documented by docs
        for (const docNodeId of relatedDocNodeIds) {
            await this.semanticGraph.addRelationship(docNodeId, conceptNodeId, 'DESCRIBES', {
                relationship_type: 'documentation'
            });
        }
        // Concept tested by tests
        for (const testNodeId of relatedTestNodeIds) {
            await this.semanticGraph.addRelationship(testNodeId, conceptNodeId, 'TESTS', {
                relationship_type: 'test_coverage'
            });
        }
    }
    /**
     * Create configuration relationships
     */
    async createConfigurationRelationships(configNodeId, affectedFileNodeIds) {
        for (const fileNodeId of affectedFileNodeIds) {
            await this.semanticGraph.addRelationship(configNodeId, fileNodeId, 'CONFIGURES', {
                relationship_type: 'configuration'
            });
        }
    }
    /**
     * Create test relationships
     */
    async createTestRelationships(testNodeId, testedFileNodeIds) {
        for (const fileNodeId of testedFileNodeIds) {
            await this.semanticGraph.addRelationship(testNodeId, fileNodeId, 'TESTS', {
                relationship_type: 'test_coverage'
            });
        }
    }
    // ============================================
    // UTILITY METHODS  
    // ============================================
    /**
     * Resolve import path to actual file path
     */
    resolveImportPath(fromFile, importPath, projectPath) {
        try {
            // Handle relative imports
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
                const fromDir = path.dirname(fromFile);
                const resolved = path.resolve(fromDir, importPath);
                // Try common extensions
                const extensions = ['.ts', '.tsx', '.js', '.jsx', '.index.ts', '.index.js'];
                for (const ext of extensions) {
                    const candidate = resolved + ext;
                    if (this.fileExists(candidate)) {
                        return candidate;
                    }
                }
                // Try with index file
                const indexFile = path.join(resolved, 'index.ts');
                if (this.fileExists(indexFile)) {
                    return indexFile;
                }
            }
            // Handle node_modules imports (external dependencies)
            // These typically don't create file relationships in our graph
            return null;
        }
        catch (error) {
            this.logger.debug(`Failed to resolve import: ${importPath} from ${fromFile}`);
            return null;
        }
    }
    fileExists(filePath) {
        try {
            const fs = require('fs');
            return fs.existsSync(filePath);
        }
        catch {
            return false;
        }
    }
}
exports.RelationshipBuilder = RelationshipBuilder;
//# sourceMappingURL=relationship-builder.js.map