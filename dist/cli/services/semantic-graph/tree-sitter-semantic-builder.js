"use strict";
/**
 * Tree-sitter Semantic Graph Builder - SOLID Principles
 * Uses Tree-sitter for CPU-optimized AST parsing and semantic relationship extraction
 * Builds Neo4j knowledge graph from discovered code files
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
exports.TreeSitterSemanticBuilder = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class TreeSitterSemanticBuilder {
    parsers = new Map();
    entityIdCounter = 0;
    relationshipIdCounter = 0;
    constructor() {
        this.initializeParsers();
    }
    /**
     * Initialize Tree-sitter parsers for supported languages
     */
    async initializeParsers() {
        try {
            // Dynamic imports to avoid build-time dependencies
            const Parser = require('tree-sitter');
            const languages = {
                typescript: 'tree-sitter-typescript',
                javascript: 'tree-sitter-javascript',
                python: 'tree-sitter-python',
                java: 'tree-sitter-java',
                go: 'tree-sitter-go',
                rust: 'tree-sitter-rust'
            };
            for (const [lang, packageName] of Object.entries(languages)) {
                try {
                    const parser = new Parser();
                    const Language = require(packageName);
                    // Handle TypeScript which has multiple grammars
                    if (lang === 'typescript') {
                        parser.setLanguage(Language.typescript);
                    }
                    else {
                        parser.setLanguage(Language);
                    }
                    this.parsers.set(lang, parser);
                    console.log(`✓ Tree-sitter parser loaded: ${lang}`);
                }
                catch (error) {
                    console.warn(`⚠ Tree-sitter parser not available: ${lang} (${error.message})`);
                    // Continue without this parser - we'll fall back gracefully
                }
            }
        }
        catch (error) {
            console.warn('⚠ Tree-sitter not available, falling back to regex parsing');
        }
    }
    /**
     * Build semantic graph from discovered files
     */
    async buildSemanticGraph(files) {
        const startTime = Date.now();
        const entities = [];
        const relationships = [];
        const fileNodes = new Map();
        const stats = {
            totalFiles: files.length,
            totalEntities: 0,
            totalRelationships: 0,
            byLanguage: {},
            processingTime: 0
        };
        console.log('🌳 Building semantic graph with Tree-sitter...');
        // Process each file
        for (const file of files) {
            try {
                // Only process source files (skip configs, docs, etc.)
                if (!this.shouldProcessFile(file))
                    continue;
                const language = this.getTreeSitterLanguage(file.language);
                if (!language || !this.parsers.has(language)) {
                    // Fall back to Claude Code CLI for unsupported languages
                    await this.processWithClaudeProxy(file, entities, relationships);
                    continue;
                }
                // Process with Tree-sitter
                await this.processWithTreeSitter(file, language, entities, relationships);
                // Track file node
                fileNodes.set(file.path, this.generateEntityId());
                // Update stats
                stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;
            }
            catch (error) {
                console.warn(`Failed to process ${file.path}: ${error.message}`);
            }
        }
        // Build cross-file relationships (imports, inheritance, etc.)
        await this.buildCrossFileRelationships(entities, relationships);
        stats.totalEntities = entities.length;
        stats.totalRelationships = relationships.length;
        stats.processingTime = Date.now() - startTime;
        console.log(`✓ Semantic graph built: ${stats.totalEntities} entities, ${stats.totalRelationships} relationships`);
        return {
            entities,
            relationships,
            fileNodes,
            stats
        };
    }
    shouldProcessFile(file) {
        return file.type === 'source' && file.size > 0 && file.size < 1000000; // Skip huge files
    }
    getTreeSitterLanguage(language) {
        if (!language)
            return null;
        const mapping = {
            'TypeScript': 'typescript',
            'JavaScript': 'javascript',
            'Python': 'python',
            'Java': 'java',
            'Go': 'go',
            'Rust': 'rust'
        };
        return mapping[language] || null;
    }
    /**
     * Process file using Tree-sitter AST parsing
     */
    async processWithTreeSitter(file, language, entities, relationships) {
        try {
            const content = await fs.readFile(file.path, 'utf8');
            const parser = this.parsers.get(language);
            const tree = parser.parse(content);
            // Extract entities and relationships from AST
            await this.extractFromAST(tree.rootNode, file, content, entities, relationships);
        }
        catch (error) {
            console.warn(`Tree-sitter parsing failed for ${file.path}, falling back to Claude proxy`);
            await this.processWithClaudeProxy(file, entities, relationships);
        }
    }
    /**
     * Extract semantic information from Tree-sitter AST
     */
    async extractFromAST(node, file, content, entities, relationships) {
        // Process different node types based on language
        switch (node.type) {
            case 'import_statement':
            case 'import_from_statement':
                this.extractImportRelationship(node, file, relationships);
                break;
            case 'class_declaration':
            case 'class_definition':
                this.extractClassEntity(node, file, content, entities, relationships);
                break;
            case 'function_declaration':
            case 'function_definition':
            case 'method_definition':
                this.extractFunctionEntity(node, file, content, entities, relationships);
                break;
            case 'call_expression':
                this.extractCallRelationship(node, file, relationships);
                break;
        }
        // Recursively process children
        for (const child of node.namedChildren) {
            await this.extractFromAST(child, file, content, entities, relationships);
        }
    }
    extractImportRelationship(node, file, relationships) {
        // Implementation specific to import patterns in Tree-sitter AST
        const importPath = this.findImportPath(node);
        if (importPath) {
            relationships.push({
                id: this.generateRelationshipId(),
                sourceFile: file.path,
                sourceEntity: path.basename(file.path, path.extname(file.path)),
                targetEntity: importPath,
                relationshipType: 'IMPORTS',
                confidence: 0.95,
                lineNumber: node.startPosition.row + 1,
                metadata: {
                    importType: 'module',
                    astNodeType: node.type
                }
            });
        }
    }
    extractClassEntity(node, file, content, entities, relationships) {
        const className = this.getClassName(node);
        if (className) {
            entities.push({
                id: this.generateEntityId(),
                name: className,
                type: 'class',
                filePath: file.path,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                signature: node.text.split('\n')[0], // First line as signature
                modifiers: this.extractModifiers(node),
                metadata: {
                    astNodeType: node.type,
                    language: file.language
                }
            });
            // Create DEFINES relationship
            relationships.push({
                id: this.generateRelationshipId(),
                sourceFile: file.path,
                sourceEntity: path.basename(file.path, path.extname(file.path)),
                targetEntity: className,
                relationshipType: 'DEFINES',
                confidence: 0.95,
                lineNumber: node.startPosition.row + 1,
                metadata: { entityType: 'class' }
            });
            // Check for inheritance
            const superClass = this.getSuperClass(node);
            if (superClass) {
                relationships.push({
                    id: this.generateRelationshipId(),
                    sourceFile: file.path,
                    sourceEntity: className,
                    targetEntity: superClass,
                    relationshipType: 'EXTENDS',
                    confidence: 0.9,
                    lineNumber: node.startPosition.row + 1,
                    metadata: { inheritanceType: 'class' }
                });
            }
        }
    }
    extractFunctionEntity(node, file, content, entities, relationships) {
        const functionName = this.getFunctionName(node);
        if (functionName) {
            entities.push({
                id: this.generateEntityId(),
                name: functionName,
                type: node.type.includes('method') ? 'method' : 'function',
                filePath: file.path,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                signature: this.extractFunctionSignature(node),
                modifiers: this.extractModifiers(node),
                metadata: {
                    astNodeType: node.type,
                    language: file.language
                }
            });
            // Create DEFINES relationship
            relationships.push({
                id: this.generateRelationshipId(),
                sourceFile: file.path,
                sourceEntity: path.basename(file.path, path.extname(file.path)),
                targetEntity: functionName,
                relationshipType: 'DEFINES',
                confidence: 0.9,
                lineNumber: node.startPosition.row + 1,
                metadata: { entityType: 'function' }
            });
        }
    }
    extractCallRelationship(node, file, relationships) {
        const functionName = this.getCallTarget(node);
        if (functionName && !this.isKeyword(functionName)) {
            relationships.push({
                id: this.generateRelationshipId(),
                sourceFile: file.path,
                sourceEntity: path.basename(file.path, path.extname(file.path)),
                targetEntity: functionName,
                relationshipType: 'CALLS',
                confidence: 0.7,
                lineNumber: node.startPosition.row + 1,
                metadata: { callType: 'function' }
            });
        }
    }
    /**
     * Fallback to Claude Code CLI for unsupported languages or failed parsing
     */
    async processWithClaudeProxy(file, entities, relationships) {
        // TODO: Implement Claude Code CLI integration
        // This would make a request to Claude Code CLI to analyze the file
        console.log(`📎 Using Claude Code CLI proxy for: ${file.path}`);
        // For now, create basic file entity
        entities.push({
            id: this.generateEntityId(),
            name: path.basename(file.path, path.extname(file.path)),
            type: 'module',
            filePath: file.path,
            startLine: 1,
            endLine: 1,
            modifiers: [],
            metadata: {
                processedBy: 'claude-proxy',
                language: file.language,
                fileType: file.type
            }
        });
    }
    async buildCrossFileRelationships(entities, relationships) {
        // Build relationships between entities across files
        // This would analyze imports, inheritance hierarchies, etc.
        console.log('🔗 Building cross-file relationships...');
    }
    // Helper methods for AST traversal
    findImportPath(node) {
        // Implementation depends on language-specific AST structure
        return null;
    }
    getClassName(node) {
        return node.childForFieldName('name')?.text || null;
    }
    getFunctionName(node) {
        return node.childForFieldName('name')?.text || null;
    }
    getSuperClass(node) {
        return node.childForFieldName('superclass')?.text || null;
    }
    getCallTarget(node) {
        return node.childForFieldName('function')?.text || null;
    }
    extractModifiers(node) {
        return []; // Extract public, private, static, etc.
    }
    extractFunctionSignature(node) {
        return node.text.split('\n')[0].trim();
    }
    isKeyword(word) {
        const keywords = new Set([
            'if', 'else', 'for', 'while', 'return', 'class', 'function', 'const', 'let', 'var'
        ]);
        return keywords.has(word.toLowerCase());
    }
    generateEntityId() {
        return `entity_${++this.entityIdCounter}`;
    }
    generateRelationshipId() {
        return `rel_${++this.relationshipIdCounter}`;
    }
}
exports.TreeSitterSemanticBuilder = TreeSitterSemanticBuilder;
//# sourceMappingURL=tree-sitter-semantic-builder.js.map