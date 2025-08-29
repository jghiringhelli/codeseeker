"use strict";
/**
 * Semantic Analyzer for Knowledge Graph Construction
 *
 * Extracts semantic relationships and creates triads from code analysis.
 * Uses AST parsing, pattern recognition, and semantic similarity detection
 * to build comprehensive knowledge graphs.
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
exports.SemanticAnalyzer = void 0;
const types_1 = require("../graph/types");
const analyzer_1 = require("../../shared/ast/analyzer");
const logger_1 = require("../../utils/logger");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const fast_glob_1 = require("fast-glob");
class SemanticAnalyzer {
    config;
    logger;
    astAnalyzer;
    knowledgeGraph;
    fileContents = new Map();
    constructor(config, knowledgeGraph) {
        this.config = config;
        this.logger = logger_1.Logger?.getInstance().child('SemanticAnalyzer');
        this.astAnalyzer = new analyzer_1.ASTAnalyzer();
        this.knowledgeGraph = knowledgeGraph;
    }
    async analyzeProject() {
        this.logger.info('Starting semantic analysis of project...');
        let nodesExtracted = 0;
        let triadsCreated = 0;
        const patterns = [];
        const insights = [];
        try {
            // Discover files to analyze
            const files = await this?.discoverFiles();
            this.logger.info(`Found ${files?.length} files to analyze`);
            // Load file contents
            await this?.loadFileContents(files);
            // Phase 1: Extract code entities and basic relationships
            for (const filePath of files) {
                const result = await this?.analyzeFile(filePath);
                nodesExtracted += result.nodes;
                triadsCreated += result.triads;
            }
            // Phase 2: Detect semantic relationships
            if (this.config.enableSemanticSimilarity) {
                const semanticTriads = await this?.detectSemanticSimilarities();
                triadsCreated += semanticTriads;
                insights?.push(`Detected ${semanticTriads} semantic similarity relationships`);
            }
            // Phase 3: Pattern detection
            if (this.config.enablePatternDetection) {
                const detectedPatterns = await this?.detectSemanticPatterns();
                patterns?.push(...detectedPatterns);
                insights?.push(`Detected ${detectedPatterns?.length} semantic patterns`);
            }
            // Phase 4: Create higher-level abstractions
            const abstractionTriads = await this?.createAbstractions();
            triadsCreated += abstractionTriads;
            this.logger.info(`Analysis complete: ${nodesExtracted} nodes, ${triadsCreated} triads`);
            return {
                nodesExtracted,
                triadsCreated,
                patterns,
                insights
            };
        }
        catch (error) {
            this.logger.error('Semantic analysis failed', error);
            throw error;
        }
    }
    async discoverFiles() {
        const patterns = this.config.includeTests
            ? this.config.filePatterns
            : this.config.filePatterns?.filter(p => !p?.includes('test') && !p?.includes('spec'));
        const files = await (0, fast_glob_1.glob)(patterns, {
            cwd: this.config.projectPath,
            absolute: true,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
        });
        return files;
    }
    async loadFileContents(files) {
        for (const filePath of files) {
            try {
                const content = await fs?.readFile(filePath, 'utf-8');
                this.fileContents?.set(filePath, content);
            }
            catch (error) {
                this.logger.warn(`Failed to load file: ${filePath}`, error);
            }
        }
    }
    async analyzeFile(filePath) {
        const content = this.fileContents?.get(filePath);
        if (!content)
            return { nodes: 0, triads: 0 };
        try {
            this.logger.debug(`Analyzing file: ${path?.relative(this.config.projectPath, filePath)}`);
            const analysis = await this.astAnalyzer?.analyzeCode?.(content, this?.getLanguageFromPath(filePath)) || { functions: [], classes: [], dependencies: [] };
            const sourceLocation = {
                filePath: path?.relative(this.config.projectPath, filePath),
                startLine: 1,
                endLine: content?.split('\n').length
            };
            let nodeCount = 0;
            let triadCount = 0;
            // Extract classes
            for (const cls of analysis.classes) {
                const nodeId = await this.knowledgeGraph?.addNode({
                    type: types_1.NodeType.CLASS,
                    name: cls.name,
                    namespace: this?.extractNamespace(filePath),
                    sourceLocation: {
                        ...sourceLocation,
                        startLine: cls.location.line,
                        endLine: cls.location.line,
                        startColumn: cls.location.column
                    },
                    metadata: {
                        complexity: cls.complexity || 0,
                        visibility: cls.modifiers?.includes('public') ? 'public' : 'private',
                        isAbstract: cls.modifiers?.includes('abstract') || false,
                        tags: this?.extractTags(cls),
                        methods: cls.methods?.length || 0,
                        properties: cls.properties?.length || 0
                    }
                });
                nodeCount++;
                // Create inheritance relationships
                if (cls.extends) {
                    const superClassId = await this?.findOrCreateNode(types_1.NodeType.CLASS, cls.extends, sourceLocation);
                    await this.knowledgeGraph?.addTriad({
                        subject: nodeId,
                        predicate: types_1.RelationType.EXTENDS,
                        object: superClassId,
                        confidence: 0.95,
                        source: types_1.TriadSource.AST_PARSER,
                        metadata: {
                            evidence: [{
                                    type: types_1.EvidenceType.STATIC_ANALYSIS,
                                    source: filePath,
                                    location: sourceLocation,
                                    confidence: 0.95,
                                    description: `Class ${cls.name} extends ${cls.extends}`
                                }]
                        }
                    });
                    triadCount++;
                }
                // Create interface implementation relationships
                if (cls.implements) {
                    for (const interfaceName of cls.implements) {
                        const interfaceId = await this?.findOrCreateNode(types_1.NodeType.INTERFACE, interfaceName, sourceLocation);
                        await this.knowledgeGraph?.addTriad({
                            subject: nodeId,
                            predicate: types_1.RelationType.IMPLEMENTS,
                            object: interfaceId,
                            confidence: 0.95,
                            source: types_1.TriadSource.AST_PARSER,
                            metadata: {
                                evidence: [{
                                        type: types_1.EvidenceType.STATIC_ANALYSIS,
                                        source: filePath,
                                        location: sourceLocation,
                                        confidence: 0.95,
                                        description: `Class ${cls.name} implements ${interfaceName}`
                                    }]
                            }
                        });
                        triadCount++;
                    }
                }
                // Extract methods
                if (cls.methods) {
                    for (const method of cls.methods) {
                        const methodId = await this.knowledgeGraph?.addNode({
                            type: types_1.NodeType.METHOD,
                            name: method.name,
                            namespace: `${this?.extractNamespace(filePath)}.${cls.name}`,
                            sourceLocation: {
                                ...sourceLocation,
                                startLine: method.location.line,
                                endLine: method.location.line,
                                startColumn: method.location.column
                            },
                            metadata: {
                                complexity: method.complexity || 0,
                                visibility: method.modifiers?.includes('public') ? 'public' : 'private',
                                isStatic: method.modifiers?.includes('static') || false,
                                isAsync: method.isAsync || false,
                                parameters: method.parameters?.length || 0,
                                returnType: method.returnType,
                                tags: this?.extractTags(method)
                            }
                        });
                        nodeCount++;
                        // Link method to class
                        await this.knowledgeGraph?.addTriad({
                            subject: nodeId,
                            predicate: types_1.RelationType.CONTAINS,
                            object: methodId,
                            confidence: 1.0,
                            source: types_1.TriadSource.AST_PARSER,
                            metadata: {}
                        });
                        triadCount++;
                        // Create method call relationships
                        if (method.calls) {
                            triadCount += await this?.createMethodCallTriads(methodId, method.calls, filePath);
                        }
                    }
                }
            }
            // Extract functions
            for (const func of analysis.functions) {
                const functionId = await this.knowledgeGraph?.addNode({
                    type: types_1.NodeType.FUNCTION,
                    name: func.name,
                    namespace: this?.extractNamespace(filePath),
                    sourceLocation: {
                        ...sourceLocation,
                        startLine: func.location.line,
                        endLine: func.location.line,
                        startColumn: func.location.column
                    },
                    metadata: {
                        complexity: func.complexity || 0,
                        isAsync: func.isAsync || false,
                        isExported: func.isExported || false,
                        parameters: func.parameters?.length || 0,
                        returnType: func.returnType,
                        tags: this?.extractTags(func)
                    }
                });
                nodeCount++;
                // Create function call relationships
                if (func.calls) {
                    triadCount += await this?.createMethodCallTriads(functionId, func.calls, filePath);
                }
            }
            // Extract imports/exports
            triadCount += await this?.createImportExportTriads(analysis.imports || [], analysis.exports || [], filePath);
            // Extract variables and constants
            for (const variable of analysis.variables || []) {
                const varId = await this.knowledgeGraph?.addNode({
                    type: variable.isConstant ? types_1.NodeType.CONSTANT : types_1.NodeType.VARIABLE,
                    name: variable.name,
                    namespace: this?.extractNamespace(filePath),
                    sourceLocation,
                    metadata: {
                        type: variable.type,
                        isExported: variable.isExported || false,
                        tags: []
                    }
                });
                nodeCount++;
            }
            return { nodes: nodeCount, triads: triadCount };
        }
        catch (error) {
            this.logger.error(`Failed to analyze file: ${filePath}`, error);
            return { nodes: 0, triads: 0 };
        }
    }
    async createMethodCallTriads(callerId, calls, filePath) {
        let triadCount = 0;
        for (const calledFunction of calls) {
            const calleeId = await this?.findOrCreateNode(types_1.NodeType.FUNCTION, calledFunction, {
                filePath: path?.relative(this.config.projectPath, filePath),
                startLine: 1,
                endLine: 1
            });
            await this.knowledgeGraph?.addTriad({
                subject: callerId,
                predicate: types_1.RelationType.CALLS,
                object: calleeId,
                confidence: 0.9,
                source: types_1.TriadSource.AST_PARSER,
                metadata: {
                    evidence: [{
                            type: types_1.EvidenceType.STATIC_ANALYSIS,
                            source: filePath,
                            confidence: 0.9,
                            description: `Function call detected: ${calledFunction}`
                        }]
                }
            });
            triadCount++;
        }
        return triadCount;
    }
    async createImportExportTriads(imports, exports, filePath) {
        let triadCount = 0;
        // Handle imports
        for (const imp of imports) {
            const moduleId = await this?.findOrCreateNode(types_1.NodeType.MODULE, imp.module, {
                filePath: imp.module,
                startLine: 1,
                endLine: 1
            });
            const importingModuleId = await this?.findOrCreateNode(types_1.NodeType.MODULE, filePath, {
                filePath: path?.relative(this.config.projectPath, filePath),
                startLine: 1,
                endLine: 1
            });
            await this.knowledgeGraph?.addTriad({
                subject: importingModuleId,
                predicate: types_1.RelationType.IMPORTS,
                object: moduleId,
                confidence: 1.0,
                source: types_1.TriadSource.AST_PARSER,
                metadata: {
                    importedItems: imp.names || [],
                    importType: imp.type || 'named'
                }
            });
            triadCount++;
            // Create dependency relationship
            await this.knowledgeGraph?.addTriad({
                subject: importingModuleId,
                predicate: types_1.RelationType.DEPENDS_ON,
                object: moduleId,
                confidence: 0.8,
                source: types_1.TriadSource.DEPENDENCY_ANALYZER,
                metadata: {
                    strength: 0.8,
                    type: 'code_dependency'
                }
            });
            triadCount++;
        }
        // Handle exports
        for (const exp of exports) {
            const exportingModuleId = await this?.findOrCreateNode(types_1.NodeType.MODULE, filePath, {
                filePath: path?.relative(this.config.projectPath, filePath),
                startLine: 1,
                endLine: 1
            });
            if (exp.name) {
                const exportedItemId = await this?.findOrCreateNode(this?.inferNodeTypeFromName(exp.name), exp.name, {
                    filePath: path?.relative(this.config.projectPath, filePath),
                    startLine: 1,
                    endLine: 1
                });
                await this.knowledgeGraph?.addTriad({
                    subject: exportingModuleId,
                    predicate: types_1.RelationType.EXPORTS,
                    object: exportedItemId,
                    confidence: 1.0,
                    source: types_1.TriadSource.AST_PARSER,
                    metadata: {
                        exportType: exp.type || 'named'
                    }
                });
                triadCount++;
            }
        }
        return triadCount;
    }
    async detectSemanticSimilarities() {
        this.logger.info('Detecting semantic similarities...');
        let triadCount = 0;
        const nodes = await this.knowledgeGraph?.queryNodes({});
        // Compare functions with similar names or purposes
        const functions = nodes?.filter(n => n?.type === types_1.NodeType.FUNCTION || n?.type === types_1.NodeType.METHOD);
        for (let i = 0; i < functions?.length; i++) {
            for (let j = i + 1; j < functions?.length; j++) {
                const similarity = this?.calculateSimilarity(functions[i], functions[j]);
                if (similarity >= this.config.minConfidence) {
                    await this.knowledgeGraph?.addTriad({
                        subject: functions?.[i].id,
                        predicate: types_1.RelationType.IS_SIMILAR_TO,
                        object: functions?.[j].id,
                        confidence: similarity,
                        source: types_1.TriadSource.SEMANTIC_ANALYZER,
                        metadata: {
                            similarityScore: similarity,
                            evidence: [{
                                    type: types_1.EvidenceType.SEMANTIC_SIMILARITY,
                                    source: 'semantic_analyzer',
                                    confidence: similarity,
                                    description: `Functions show ${(similarity * 100).toFixed(1)}% semantic similarity`
                                }]
                        }
                    });
                    triadCount++;
                }
            }
        }
        // Compare classes for structural similarity
        const classes = nodes?.filter(n => n?.type === types_1.NodeType.CLASS);
        for (let i = 0; i < classes?.length; i++) {
            for (let j = i + 1; j < classes?.length; j++) {
                const similarity = this?.calculateStructuralSimilarity(classes[i], classes[j]);
                if (similarity >= this.config.minConfidence) {
                    await this.knowledgeGraph?.addTriad({
                        subject: classes?.[i].id,
                        predicate: types_1.RelationType.IS_SIMILAR_TO,
                        object: classes?.[j].id,
                        confidence: similarity,
                        source: types_1.TriadSource.SEMANTIC_ANALYZER,
                        metadata: {
                            similarityScore: similarity,
                            similarityType: 'structural'
                        }
                    });
                    triadCount++;
                }
            }
        }
        this.logger.info(`Created ${triadCount} semantic similarity relationships`);
        return triadCount;
    }
    async detectSemanticPatterns() {
        this.logger.info('Detecting semantic patterns...');
        const patterns = [];
        const nodes = await this.knowledgeGraph?.queryNodes({});
        // Detect repository pattern
        const repositoryPattern = await this?.detectRepositoryPattern(nodes);
        if (repositoryPattern)
            patterns?.push(repositoryPattern);
        // Detect service layer pattern
        const servicePattern = await this?.detectServicePattern(nodes);
        if (servicePattern)
            patterns?.push(servicePattern);
        // Detect factory pattern
        const factoryPattern = await this?.detectFactoryPattern(nodes);
        if (factoryPattern)
            patterns?.push(factoryPattern);
        // Detect observer pattern
        const observerPattern = await this?.detectObserverPattern(nodes);
        if (observerPattern)
            patterns?.push(observerPattern);
        // Create pattern nodes and relationships
        for (const pattern of patterns) {
            const patternId = await this.knowledgeGraph?.addNode({
                type: types_1.NodeType.PATTERN,
                name: pattern.name,
                namespace: 'patterns',
                metadata: {
                    patternType: pattern.type,
                    confidence: pattern.confidence,
                    description: pattern.description,
                    tags: ['detected_pattern']
                }
            });
            // Link pattern to involved nodes
            for (const nodeId of pattern.nodes) {
                await this.knowledgeGraph?.addTriad({
                    subject: nodeId,
                    predicate: types_1.RelationType.FOLLOWS_PATTERN,
                    object: patternId,
                    confidence: pattern.confidence,
                    source: types_1.TriadSource.PATTERN_DETECTOR,
                    metadata: {
                        patternType: pattern.type
                    }
                });
            }
        }
        this.logger.info(`Detected ${patterns?.length} semantic patterns`);
        return patterns;
    }
    async createAbstractions() {
        this.logger.info('Creating higher-level abstractions...');
        let triadCount = 0;
        // Create module-level abstractions
        const modules = new Map();
        const nodes = await this.knowledgeGraph?.queryNodes({});
        // Group nodes by module/namespace
        for (const node of nodes) {
            const module = node.namespace || 'global';
            if (!modules?.has(module)) {
                modules?.set(module, []);
            }
            modules?.get(module).push(node.id);
        }
        // Create module nodes and relationships
        for (const [moduleName, nodeIds] of modules?.entries()) {
            if (nodeIds?.length > 1) { // Only create modules with multiple members
                const moduleId = await this.knowledgeGraph?.addNode({
                    type: types_1.NodeType.MODULE,
                    name: moduleName,
                    namespace: 'modules',
                    metadata: {
                        memberCount: nodeIds?.length,
                        tags: ['abstraction', 'module']
                    }
                });
                // Link nodes to module
                for (const nodeId of nodeIds) {
                    await this.knowledgeGraph?.addTriad({
                        subject: nodeId,
                        predicate: types_1.RelationType.PART_OF,
                        object: moduleId,
                        confidence: 1.0,
                        source: types_1.TriadSource.SEMANTIC_ANALYZER,
                        metadata: {
                            abstractionLevel: 'module'
                        }
                    });
                    triadCount++;
                }
            }
        }
        // Create feature-level abstractions based on naming patterns
        const features = await this?.identifyFeatures(nodes);
        for (const [featureName, featureNodes] of features?.entries()) {
            if (featureNodes?.length > 2) {
                const featureId = await this.knowledgeGraph?.addNode({
                    type: types_1.NodeType.FEATURE,
                    name: featureName,
                    namespace: 'features',
                    metadata: {
                        componentCount: featureNodes?.length,
                        tags: ['abstraction', 'feature']
                    }
                });
                for (const nodeId of featureNodes) {
                    await this.knowledgeGraph?.addTriad({
                        subject: nodeId,
                        predicate: types_1.RelationType.PART_OF,
                        object: featureId,
                        confidence: 0.7,
                        source: types_1.TriadSource.SEMANTIC_ANALYZER,
                        metadata: {
                            abstractionLevel: 'feature'
                        }
                    });
                    triadCount++;
                }
            }
        }
        this.logger.info(`Created ${triadCount} abstraction relationships`);
        return triadCount;
    }
    // Helper methods
    getLanguageFromPath(filePath) {
        const ext = path?.extname(filePath).toLowerCase();
        const languageMap = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust'
        };
        return languageMap[ext] || 'javascript';
    }
    extractNamespace(filePath) {
        const relativePath = path?.relative(this.config.projectPath, filePath);
        const dirs = path?.dirname(relativePath).split(path.sep);
        // Skip common top-level directories
        const skipDirs = ['src', 'lib', 'app', 'components', 'utils'];
        const meaningfulDirs = dirs?.filter(dir => !skipDirs?.includes(dir) && dir !== '.');
        return meaningfulDirs?.length > 0 ? meaningfulDirs?.join('.') : 'global';
    }
    extractTags(entity) {
        const tags = [];
        if (entity.modifiers) {
            tags?.push(...entity.modifiers);
        }
        if (entity.isAsync)
            tags?.push('async');
        if (entity.isExported)
            tags?.push('exported');
        if (entity.complexity && entity.complexity > 10)
            tags?.push('complex');
        return tags;
    }
    async findOrCreateNode(type, name, location) {
        // Try to find existing node first
        const existingNodes = await this.knowledgeGraph?.queryNodes({
            nodes: {
                types: [type],
                names: [name]
            }
        });
        if (existingNodes?.length > 0) {
            return existingNodes?.[0].id;
        }
        // Create new node
        return await this.knowledgeGraph?.addNode({
            type,
            name,
            sourceLocation: location,
            metadata: {
                tags: ['auto_created']
            }
        });
    }
    inferNodeTypeFromName(name) {
        const lowerName = name?.toLowerCase();
        if (lowerName?.endsWith('service'))
            return types_1.NodeType.SERVICE;
        if (lowerName?.endsWith('repository'))
            return types_1.NodeType.REPOSITORY;
        if (lowerName?.endsWith('controller'))
            return types_1.NodeType.CONTROLLER;
        if (lowerName?.endsWith('component'))
            return types_1.NodeType.COMPONENT;
        if (lowerName?.endsWith('model'))
            return types_1.NodeType.MODEL;
        if (lowerName?.includes('config'))
            return types_1.NodeType.CONFIGURATION;
        // Check for class-like patterns
        if (name?.charAt(0).toUpperCase() === name?.charAt(0)) {
            return types_1.NodeType.CLASS;
        }
        return types_1.NodeType.FUNCTION;
    }
    calculateSimilarity(node1, node2) {
        // Simple similarity based on name similarity and metadata
        const nameSimilarity = this?.stringSimilarity(node1.name, node2.name);
        const namespaceSimilarity = node1?.namespace === node2.namespace ? 1.0 : 0.0;
        let metadataSimilarity = 0;
        const metadata1Tags = node1.metadata.tags || [];
        const metadata2Tags = node2.metadata.tags || [];
        const commonTags = metadata1Tags?.filter(tag => metadata2Tags?.includes(tag));
        if (metadata1Tags?.length > 0 || metadata2Tags?.length > 0) {
            metadataSimilarity = commonTags?.length / Math.max(metadata1Tags?.length, metadata2Tags?.length);
        }
        return (nameSimilarity * 0.5 + namespaceSimilarity * 0.3 + metadataSimilarity * 0.2);
    }
    calculateStructuralSimilarity(node1, node2) {
        const methods1 = node1.metadata.methods || 0;
        const methods2 = node2.metadata.methods || 0;
        const properties1 = node1.metadata.properties || 0;
        const properties2 = node2.metadata.properties || 0;
        const methodSimilarity = 1 - Math.abs(methods1 - methods2) / Math.max(methods1, methods2, 1);
        const propertySimilarity = 1 - Math.abs(properties1 - properties2) / Math.max(properties1, properties2, 1);
        return (methodSimilarity + propertySimilarity) / 2;
    }
    stringSimilarity(str1, str2) {
        const longer = str1?.length > str2?.length ? str1 : str2;
        const shorter = str1?.length > str2?.length ? str2 : str1;
        if (longer?.length === 0)
            return 1.0;
        const distance = this?.levenshteinDistance(longer, shorter);
        return (longer?.length - distance) / longer?.length;
    }
    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2?.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1?.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2?.length; i++) {
            for (let j = 1; j <= str1?.length; j++) {
                if (str2?.charAt(i - 1) === str1?.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[str2?.length][str1?.length];
    }
    async detectRepositoryPattern(nodes) {
        const repositories = nodes?.filter(n => n.name?.toLowerCase().includes('repository') ||
            n.metadata.tags?.includes('repository'));
        if (repositories?.length >= 2) {
            return {
                name: 'Repository Pattern',
                type: 'data_access',
                confidence: 0.8,
                nodes: repositories?.map(r => r.id),
                description: 'Repository pattern detected with multiple repository classes'
            };
        }
        return null;
    }
    async detectServicePattern(nodes) {
        const services = nodes?.filter(n => n.name?.toLowerCase().includes('service') ||
            n.metadata.tags?.includes('service'));
        if (services?.length >= 2) {
            return {
                name: 'Service Layer Pattern',
                type: 'business_logic',
                confidence: 0.8,
                nodes: services?.map(s => s.id),
                description: 'Service layer pattern with multiple service classes'
            };
        }
        return null;
    }
    async detectFactoryPattern(nodes) {
        const factories = nodes?.filter(n => n.name?.toLowerCase().includes('factory') ||
            n.name?.toLowerCase().includes('builder') ||
            n.metadata.tags?.includes('factory'));
        if (factories?.length >= 1) {
            return {
                name: 'Factory Pattern',
                type: 'creational',
                confidence: 0.7,
                nodes: factories?.map(f => f.id),
                description: 'Factory pattern detected for object creation'
            };
        }
        return null;
    }
    async detectObserverPattern(nodes) {
        const observers = nodes?.filter(n => n.name?.toLowerCase().includes('observer') ||
            n.name?.toLowerCase().includes('listener') ||
            n.name?.toLowerCase().includes('subscriber'));
        const subjects = nodes?.filter(n => n.name?.toLowerCase().includes('subject') ||
            n.name?.toLowerCase().includes('publisher') ||
            n.name?.toLowerCase().includes('observable'));
        if (observers?.length >= 1 && subjects?.length >= 1) {
            return {
                name: 'Observer Pattern',
                type: 'behavioral',
                confidence: 0.8,
                nodes: [...observers?.map(o => o.id), ...subjects?.map(s => s.id)],
                description: 'Observer pattern with publishers and subscribers'
            };
        }
        return null;
    }
    async identifyFeatures(nodes) {
        const features = new Map();
        for (const node of nodes) {
            // Extract feature names from node names and namespaces
            const featureName = this?.extractFeatureName(node.name, node.namespace);
            if (featureName) {
                if (!features?.has(featureName)) {
                    features?.set(featureName, []);
                }
                features?.get(featureName).push(node.id);
            }
        }
        return features;
    }
    extractFeatureName(nodeName, namespace) {
        // Look for common feature-naming patterns
        const featurePatterns = [
            /^(auth|authentication)/i,
            /^(user|users)/i,
            /^(order|orders)/i,
            /^(product|products)/i,
            /^(payment|payments)/i,
            /^(notification|notifications)/i,
            /^(report|reports)/i,
            /^(dashboard)/i,
            /^(search)/i,
            /^(admin)/i
        ];
        const lowerName = nodeName?.toLowerCase();
        const lowerNamespace = namespace?.toLowerCase() || '';
        for (const pattern of featurePatterns) {
            if (pattern?.test(lowerName) || pattern?.test(lowerNamespace)) {
                const match = lowerName?.match(pattern) || lowerNamespace?.match(pattern);
                if (match) {
                    return match?.[1].charAt(0).toUpperCase() + match?.[1].slice(1);
                }
            }
        }
        // Extract from namespace if available
        if (namespace) {
            const parts = namespace?.split('.');
            if (parts?.length > 0) {
                const lastPart = parts[parts?.length - 1];
                if (lastPart?.length > 3) { // Avoid very short namespace parts
                    return lastPart?.charAt(0).toUpperCase() + lastPart?.slice(1);
                }
            }
        }
        return null;
    }
}
exports.SemanticAnalyzer = SemanticAnalyzer;
//# sourceMappingURL=semantic-analyzer.js.map