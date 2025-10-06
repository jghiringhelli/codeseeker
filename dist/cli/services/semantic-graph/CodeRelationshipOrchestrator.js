"use strict";
/**
 * Code Relationship Orchestrator - Main coordinator following SOLID principles
 * Single Responsibility: Orchestrate semantic graph population
 * Open/Closed: Easy to extend with new parsers
 * Dependency Inversion: Depends on abstractions (interfaces)
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeRelationshipOrchestrator = void 0;
const TypeScriptParser_1 = require("./parsers/TypeScriptParser");
const PythonParser_1 = require("./parsers/PythonParser");
const JavaParser_1 = require("./parsers/JavaParser");
const GenericParser_1 = require("./parsers/GenericParser");
const TreeSitterPythonParser_1 = require("./parsers/TreeSitterPythonParser");
const TreeSitterJavaParser_1 = require("./parsers/TreeSitterJavaParser");
const NodeBuilder_1 = require("./builders/NodeBuilder");
const RelationshipBuilder_1 = require("./builders/RelationshipBuilder");
const logger_1 = require("../../../utils/logger");
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Main orchestrator for semantic graph population
 * Follows Dependency Inversion Principle - depends on interfaces
 */
class CodeRelationshipOrchestrator {
    semanticGraph;
    logger = logger_1.Logger.getInstance();
    parsers = new Map();
    genericParser;
    nodeBuilder;
    relationshipBuilder;
    constructor(semanticGraph) {
        this.semanticGraph = semanticGraph;
        this.nodeBuilder = new NodeBuilder_1.NodeBuilder(semanticGraph);
        this.relationshipBuilder = new RelationshipBuilder_1.RelationshipBuilder(semanticGraph);
        this.initializeParsers();
    }
    /**
     * Initialize and register language parsers
     * Follows Open/Closed Principle - easy to add new parsers
     */
    initializeParsers() {
        // Try to initialize Tree-sitter parsers first (excellent quality)
        const treeSitterParsers = this.initializeTreeSitterParsers();
        // Fallback to regex parsers for languages without Tree-sitter
        const regexParsers = [
            new TypeScriptParser_1.TypeScriptParser(), // Always available (Babel)
            new PythonParser_1.PythonParser(), // Regex fallback
            new JavaParser_1.JavaParser() // Regex fallback
        ];
        // Register Tree-sitter parsers first (they take priority)
        for (const parser of treeSitterParsers) {
            for (const ext of parser.getSupportedExtensions()) {
                this.parsers.set(ext, parser);
                this.logger.debug(`Registered Tree-sitter parser for .${ext} files`);
            }
        }
        // Register regex parsers for extensions not covered by Tree-sitter
        for (const parser of regexParsers) {
            for (const ext of parser.getSupportedExtensions()) {
                if (!this.parsers.has(ext)) {
                    this.parsers.set(ext, parser);
                    this.logger.debug(`Registered regex parser for .${ext} files`);
                }
            }
        }
        // Register generic parser as fallback
        this.genericParser = new GenericParser_1.GenericParser();
        this.logger.info(`🔧 Initialized ${this.parsers.size} language parsers (Tree-sitter + regex + generic fallback)`);
    }
    /**
     * Initialize Tree-sitter parsers if packages are available
     */
    initializeTreeSitterParsers() {
        const parsers = [];
        try {
            // Try Python Tree-sitter parser
            const pythonParser = new TreeSitterPythonParser_1.TreeSitterPythonParser();
            parsers.push(pythonParser);
            this.logger.debug('✅ Tree-sitter Python parser available');
        }
        catch (error) {
            this.logger.debug('⚠️ Tree-sitter Python not available, using regex fallback');
        }
        try {
            // Try Java Tree-sitter parser
            const javaParser = new TreeSitterJavaParser_1.TreeSitterJavaParser();
            parsers.push(javaParser);
            this.logger.debug('✅ Tree-sitter Java parser available');
        }
        catch (error) {
            this.logger.debug('⚠️ Tree-sitter Java not available, using regex fallback');
        }
        // TODO: Add more Tree-sitter parsers as they become available
        // try {
        //   const cppParser = new TreeSitterCppParser();
        //   parsers.push(cppParser);
        // } catch (error) { ... }
        return parsers;
    }
    /**
     * Main entry point - populate semantic graph for entire project
     */
    async populateSemanticGraph(projectPath, projectId) {
        this.logger.info(`🔄 Starting semantic graph population for project: ${projectPath}`);
        const result = {
            totalFiles: 0,
            successfullyParsed: 0,
            errors: [],
            nodeStats: { files: 0, classes: 0, functions: 0, interfaces: 0 },
            relationshipStats: { imports: 0, inheritance: 0, containment: 0 }
        };
        try {
            // Step 1: Initialize semantic graph connection
            await this.semanticGraph.initialize();
            // Step 2: Discover and parse all code files
            const codeFiles = await this.discoverCodeFiles(projectPath);
            result.totalFiles = codeFiles.length;
            this.logger.info(`📁 Found ${codeFiles.length} code files to parse`);
            // Step 3: Parse files and extract structure
            const parsedStructures = await this.parseAllFiles(codeFiles, projectPath, result);
            // Step 4: Create nodes in Neo4j
            const nodeResults = await this.createAllNodes(parsedStructures, projectId, result);
            // Step 5: Create relationships
            await this.createAllRelationships(parsedStructures, nodeResults, projectPath, result);
            // Step 6: Post-processing and optimization
            await this.postProcessGraph(projectId);
            this.logger.info(`✅ Semantic graph population complete: ${result.successfullyParsed}/${result.totalFiles} files processed`);
        }
        catch (error) {
            this.logger.error(`❌ Semantic graph population failed: ${error.message}`);
            result.errors.push(error.message);
            throw error;
        }
        return result;
    }
    /**
     * Update semantic graph for specific files (incremental updates)
     */
    async updateFilesInGraph(filePaths, projectPath, projectId) {
        this.logger.info(`🔄 Updating ${filePaths.length} files in semantic graph`);
        try {
            // Parse only the changed files
            const parsedStructures = [];
            for (const filePath of filePaths) {
                try {
                    const structure = await this.parseFile(filePath, projectPath);
                    if (structure) {
                        parsedStructures.push(structure);
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to parse updated file ${filePath}: ${error.message}`);
                }
            }
            // TODO: Remove old nodes for these files first
            // await this.removeExistingNodes(filePaths, projectId);
            // Create new nodes and relationships
            const result = this.createEmptyResult();
            const nodeResults = await this.createAllNodes(parsedStructures, projectId, result);
            await this.createAllRelationships(parsedStructures, nodeResults, projectPath, result);
            this.logger.info(`✅ Updated ${parsedStructures.length} files in semantic graph`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to update files in semantic graph: ${error.message}`);
            throw error;
        }
    }
    // ============================================
    // PRIVATE IMPLEMENTATION METHODS
    // ============================================
    async discoverCodeFiles(projectPath) {
        const patterns = [
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.java', '**/*.cpp', '**/*.c',
            '**/*.cs', '**/*.go', '**/*.rs'
        ];
        const codeFiles = await (0, fast_glob_1.default)(patterns, {
            cwd: projectPath,
            absolute: true,
            ignore: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/coverage/**',
                '**/*.test.*',
                '**/*.spec.*'
            ]
        });
        return codeFiles;
    }
    async parseAllFiles(codeFiles, projectPath, result) {
        const parsedStructures = [];
        for (const filePath of codeFiles) {
            try {
                const structure = await this.parseFile(filePath, projectPath);
                if (structure) {
                    parsedStructures.push(structure);
                    result.successfullyParsed++;
                }
            }
            catch (error) {
                result.errors.push(`${filePath}: ${error.message}`);
                this.logger.debug(`Failed to parse ${filePath}: ${error.message}`);
            }
        }
        return parsedStructures;
    }
    async parseFile(filePath, projectPath) {
        const ext = this.getFileExtension(filePath);
        let parser = this.parsers.get(ext);
        // Use generic parser as fallback if no specific parser found
        if (!parser) {
            parser = this.genericParser;
            this.logger.debug(`Using generic parser for ${ext} files: ${filePath}`);
        }
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(projectPath, filePath);
        return await parser.parse(content, relativePath);
    }
    async createAllNodes(parsedStructures, projectId, result) {
        const nodeResults = new Map();
        for (const structure of parsedStructures) {
            try {
                const nodeResult = await this.nodeBuilder.createNodesForFile(structure, projectId);
                nodeResults.set(structure.filePath, nodeResult);
                // Update stats
                result.nodeStats.files++;
                result.nodeStats.classes += structure.classes.length;
                result.nodeStats.functions += structure.functions.length;
                result.nodeStats.interfaces += structure.interfaces.length;
            }
            catch (error) {
                this.logger.error(`Failed to create nodes for ${structure.filePath}: ${error.message}`);
                result.errors.push(`Node creation failed for ${structure.filePath}: ${error.message}`);
            }
        }
        return nodeResults;
    }
    async createAllRelationships(parsedStructures, nodeResults, projectPath, result) {
        // Build file node lookup map
        const allFileNodes = new Map();
        for (const [filePath, nodeResult] of nodeResults) {
            allFileNodes.set(filePath, nodeResult.fileNodeId);
        }
        // Create relationships for each file
        for (const structure of parsedStructures) {
            const nodeResult = nodeResults.get(structure.filePath);
            if (!nodeResult)
                continue;
            try {
                await this.relationshipBuilder.createRelationshipsForFile(structure, nodeResult, allFileNodes, projectPath);
                // Update relationship stats (simplified)
                result.relationshipStats.imports += structure.imports.length;
                result.relationshipStats.containment += structure.classes.length + structure.functions.length;
            }
            catch (error) {
                this.logger.error(`Failed to create relationships for ${structure.filePath}: ${error.message}`);
                result.errors.push(`Relationship creation failed for ${structure.filePath}: ${error.message}`);
            }
        }
    }
    async postProcessGraph(projectId) {
        try {
            // TODO: Resolve unresolved inheritance relationships
            // TODO: Detect circular dependencies
            // TODO: Calculate complexity metrics
            // TODO: Identify architectural patterns
            this.logger.debug('Post-processing completed');
        }
        catch (error) {
            this.logger.warn(`Post-processing failed: ${error.message}`);
        }
    }
    getFileExtension(filePath) {
        return filePath.split('.').pop()?.toLowerCase() || '';
    }
    createEmptyResult() {
        return {
            totalFiles: 0,
            successfullyParsed: 0,
            errors: [],
            nodeStats: { files: 0, classes: 0, functions: 0, interfaces: 0 },
            relationshipStats: { imports: 0, inheritance: 0, containment: 0 }
        };
    }
}
exports.CodeRelationshipOrchestrator = CodeRelationshipOrchestrator;
exports.default = CodeRelationshipOrchestrator;
//# sourceMappingURL=CodeRelationshipOrchestrator.js.map