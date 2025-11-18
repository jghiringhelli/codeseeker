"use strict";
/**
 * Code Relationship Parser
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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const semantic_graph_1 = require("./semantic-graph/semantic-graph");
const logger_1 = require("../../../utils/logger");
class CodeRelationshipParser {
    logger = logger_1.Logger.getInstance();
    semanticGraph;
    constructor() {
        this.semanticGraph = new semantic_graph_1.SemanticGraphService();
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
        return await this.parseCodeFile(filePath, relativePath);
    }
    /**
     * Parse entire project and populate semantic graph
     */
    async parseAndPopulateProject(projectPath, projectId) {
        this.logger.info(`🔄 Parsing project structure: ${projectPath}`);
        try {
            // Step 1: Parse all code files
            const structure = await this.parseProjectStructure(projectPath);
            // Step 2: Create nodes in Neo4j
            const nodeMap = await this.createGraphNodes(structure, projectId);
            // Step 3: Create relationships
            await this.createGraphRelationships(structure, nodeMap);
            // Step 4: Add business concept nodes
            await this.extractBusinessConcepts(structure, projectId);
            this.logger.info(`✅ Project parsed: ${structure.files.length} files, ${structure.relationships.length} relationships`);
        }
        catch (error) {
            this.logger.error(`❌ Project parsing failed: ${error}`);
            throw error;
        }
    }
    /**
     * Parse all files in the project to extract structure
     */
    async parseProjectStructure(projectPath) {
        const files = [];
        const relationships = [];
        // Discover code files
        const codeFiles = await (0, fast_glob_1.glob)([
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.java', '**/*.cpp', '**/*.c',
            '**/*.cs', '**/*.go', '**/*.rs'
        ], {
            cwd: projectPath,
            absolute: true,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
        });
        // Parse each file
        for (const filePath of codeFiles) {
            try {
                const relativePath = path.relative(projectPath, filePath);
                const parsedFile = await this.parseCodeFile(filePath, relativePath);
                files.push(parsedFile);
            }
            catch (error) {
                this.logger.warn(`Failed to parse ${filePath}: ${error}`);
            }
        }
        // Extract relationships between files
        for (const file of files) {
            for (const importInfo of file.imports) {
                const targetFile = this.resolveImportPath(file.filePath, importInfo.from, projectPath);
                if (targetFile && files.some(f => f.filePath === targetFile)) {
                    relationships.push({
                        fromFile: file.filePath,
                        toFile: targetFile,
                        type: 'IMPORTS',
                        metadata: { importName: importInfo.name }
                    });
                }
            }
        }
        return { files, relationships };
    }
    /**
     * Parse individual code file
     */
    async parseCodeFile(filePath, relativePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        const language = this.detectLanguage(filePath);
        switch (language) {
            case 'typescript':
            case 'javascript':
                return this.parseJavaScriptFile(content, relativePath, language);
            case 'python':
                return this.parsePythonFile(content, relativePath);
            case 'java':
                return this.parseJavaFile(content, relativePath);
            default:
                return this.parseGenericFile(content, relativePath, language);
        }
    }
    /**
     * Parse JavaScript/TypeScript files with detailed analysis
     */
    parseJavaScriptFile(content, filePath, language) {
        const exports = [];
        const imports = [];
        const classes = [];
        const functions = [];
        const interfaces = [];
        const constants = [];
        const enums = [];
        const lines = content.split('\n');
        // Extract exports
        const exportMatches = content.matchAll(/export\s+(?:(default)\s+)?(?:class|function|interface|const|let|var)\s+(\w+)/g);
        for (const match of exportMatches) {
            exports.push(match[2] || 'default');
        }
        // Extract named exports
        const namedExportMatches = content.matchAll(/export\s*\{\s*([^}]+)\s*\}/g);
        for (const match of namedExportMatches) {
            const names = match[1].split(',').map(n => n.trim().split(' as ')[0]);
            exports.push(...names);
        }
        // Extract imports
        const importMatches = content.matchAll(/import\s+(?:\*\s+as\s+(\w+)|(?:\{([^}]+)\}|\w+))\s+from\s+['"]([^'"]+)['"]/g);
        for (const match of importMatches) {
            const from = match[3];
            if (match[1]) {
                imports.push({ name: match[1], from });
            }
            else if (match[2]) {
                const names = match[2].split(',').map(n => n.trim().split(' as ')[0]);
                names.forEach(name => imports.push({ name, from }));
            }
            else {
                imports.push({ name: 'default', from });
            }
        }
        // Extract detailed classes with methods
        const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
        let classMatch;
        while ((classMatch = classRegex.exec(content)) !== null) {
            const className = classMatch[1];
            const extendsClass = classMatch[2];
            const implementsStr = classMatch[3];
            const classBody = classMatch[4];
            const startLine = content.substring(0, classMatch.index).split('\n').length;
            const endLine = startLine + classMatch[0].split('\n').length - 1;
            const implementsInterfaces = implementsStr ?
                implementsStr.split(',').map(i => i.trim()) : [];
            const methods = this.extractMethods(classBody, startLine);
            const properties = this.extractProperties(classBody);
            classes.push({
                name: className,
                extends: extendsClass,
                implements: implementsInterfaces,
                methods,
                properties,
                startLine,
                endLine
            });
        }
        // Extract standalone functions
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
        let funcMatch;
        while ((funcMatch = functionRegex.exec(content)) !== null) {
            const funcName = funcMatch[1];
            const paramsStr = funcMatch[2];
            const returnType = funcMatch[3]?.trim();
            const funcBody = funcMatch[4];
            const startLine = content.substring(0, funcMatch.index).split('\n').length;
            const endLine = startLine + funcMatch[0].split('\n').length - 1;
            const parameters = this.parseParameters(paramsStr);
            const callsTo = this.extractFunctionCalls(funcBody);
            const complexity = this.calculateComplexity(funcBody);
            functions.push({
                name: funcName,
                isAsync: funcMatch[0].includes('async'),
                parameters,
                returnType,
                startLine,
                endLine,
                complexity,
                callsTo
            });
        }
        // Extract arrow functions
        const arrowFunctionRegex = /(?:export\s+)?const\s+(\w+)\s*:\s*([^=]+)?\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([^=>\s]+))?\s*=>\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
        let arrowMatch;
        while ((arrowMatch = arrowFunctionRegex.exec(content)) !== null) {
            const funcName = arrowMatch[1];
            const paramsStr = arrowMatch[4];
            const returnType = arrowMatch[5]?.trim();
            const funcBody = arrowMatch[6];
            const startLine = content.substring(0, arrowMatch.index).split('\n').length;
            const endLine = startLine + arrowMatch[0].split('\n').length - 1;
            const parameters = this.parseParameters(paramsStr);
            const callsTo = this.extractFunctionCalls(funcBody);
            const complexity = this.calculateComplexity(funcBody);
            functions.push({
                name: funcName,
                isAsync: !!arrowMatch[3],
                parameters,
                returnType,
                startLine,
                endLine,
                complexity,
                callsTo
            });
        }
        // Extract constants
        const constMatches = content.matchAll(/(?:export\s+)?const\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/g);
        for (const match of constMatches) {
            constants.push({
                name: match[1],
                type: match[2]?.trim()
            });
        }
        // Extract enums (TypeScript)
        if (language === 'typescript') {
            const enumMatches = content.matchAll(/(?:export\s+)?enum\s+(\w+)\s*\{([^}]+)\}/g);
            for (const match of enumMatches) {
                const enumValues = match[2].split(',').map(v => v.trim().split('=')[0].trim());
                enums.push({
                    name: match[1],
                    values: enumValues
                });
            }
            // Extract interfaces
            const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)/g);
            for (const match of interfaceMatches) {
                interfaces.push(match[1]);
            }
        }
        return {
            filePath,
            language,
            exports,
            imports,
            classes,
            functions,
            interfaces,
            dependencies: imports.map(i => i.from),
            constants,
            enums
        };
    }
    /**
     * Parse Python files with detailed analysis
     */
    parsePythonFile(content, filePath) {
        const exports = [];
        const imports = [];
        const classes = [];
        const functions = [];
        const constants = [];
        // Extract imports
        const importMatches = content.matchAll(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm);
        for (const match of importMatches) {
            const from = match[1] || '';
            const names = match[2].split(',').map(n => n.trim().split(' as ')[0]);
            names.forEach(name => imports.push({ name, from }));
        }
        // Extract detailed classes
        const classRegex = /^class\s+(\w+)(?:\(([^)]+)\))?:\s*([\s\S]*?)(?=\n^(?:class|def|$))/gm;
        let classMatch;
        while ((classMatch = classRegex.exec(content)) !== null) {
            const className = classMatch[1];
            const inheritance = classMatch[2];
            const classBody = classMatch[3];
            const startLine = content.substring(0, classMatch.index).split('\n').length;
            const endLine = startLine + classMatch[0].split('\n').length - 1;
            const extendsClass = inheritance?.split(',')[0]?.trim();
            const implementsClasses = inheritance?.split(',').slice(1).map(i => i.trim()) || [];
            const methods = this.extractPythonMethods(classBody, startLine);
            const properties = this.extractPythonProperties(classBody);
            classes.push({
                name: className,
                extends: extendsClass,
                implements: implementsClasses,
                methods,
                properties,
                startLine,
                endLine
            });
            exports.push(className);
        }
        // Extract standalone functions
        const functionRegex = /^def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:\s*([\s\S]*?)(?=\n^(?:def|class|$))/gm;
        let funcMatch;
        while ((funcMatch = functionRegex.exec(content)) !== null) {
            const funcName = funcMatch[1];
            const paramsStr = funcMatch[2];
            const returnType = funcMatch[3]?.trim();
            const funcBody = funcMatch[4];
            const startLine = content.substring(0, funcMatch.index).split('\n').length;
            const endLine = startLine + funcMatch[0].split('\n').length - 1;
            const parameters = this.parsePythonParameters(paramsStr);
            const callsTo = this.extractFunctionCalls(funcBody);
            const complexity = this.calculateComplexity(funcBody);
            functions.push({
                name: funcName,
                isAsync: funcMatch[0].includes('async'),
                parameters,
                returnType,
                startLine,
                endLine,
                complexity,
                callsTo
            });
            if (!funcName.startsWith('_')) {
                exports.push(funcName);
            }
        }
        // Extract constants (uppercase variables)
        const constMatches = content.matchAll(/^([A-Z_][A-Z0-9_]*)\s*[:=]/gm);
        for (const match of constMatches) {
            constants.push({
                name: match[1]
            });
        }
        return {
            filePath,
            language: 'python',
            exports,
            imports,
            classes,
            functions,
            interfaces: [],
            dependencies: imports.map(i => i.from).filter(Boolean),
            constants,
            enums: []
        };
    }
    /**
     * Parse Java files
     */
    parseJavaFile(content, filePath) {
        const exports = [];
        const imports = [];
        const classes = [];
        const functions = [];
        // Extract imports
        const importMatches = content.matchAll(/import\s+(?:static\s+)?([^;]+);/g);
        for (const match of importMatches) {
            const fullImport = match[1];
            const name = fullImport.split('.').pop() || fullImport;
            imports.push({ name, from: fullImport });
        }
        // Extract classes (simplified - could be enhanced like JavaScript/Python)
        const classMatches = content.matchAll(/(?:public\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g);
        for (const match of classMatches) {
            const className = match[1];
            const extendsClass = match[2] || '';
            const implementsStr = match[3] || '';
            classes.push({
                name: className,
                extends: extendsClass,
                implements: implementsStr ? implementsStr.split(',').map(i => i.trim()) : [],
                methods: [], // Simplified - could extract methods here
                properties: [],
                startLine: 1,
                endLine: 1
            });
            exports.push(className);
        }
        // Extract methods (simplified - could be enhanced)
        const methodMatches = content.matchAll(/(?:public|private|protected)\s+(?:static\s+)?[\w<>[\]]+\s+(\w+)\s*\(([^)]*)\)/g);
        for (const match of methodMatches) {
            const methodName = match[1];
            functions.push({
                name: methodName,
                parameters: [],
                returnType: 'unknown',
                startLine: 1,
                endLine: 1,
                complexity: 1,
                callsTo: [],
                isAsync: false
            });
        }
        return {
            filePath,
            language: 'java',
            exports,
            imports,
            classes,
            functions,
            interfaces: [],
            dependencies: imports.map(i => i.from),
            constants: [],
            enums: []
        };
    }
    /**
     * Parse generic files (fallback)
     */
    parseGenericFile(content, filePath, language) {
        return {
            filePath,
            language,
            exports: [],
            imports: [],
            classes: [],
            functions: [],
            interfaces: [],
            dependencies: [],
            constants: [],
            enums: []
        };
    }
    /**
     * Extract Python methods from class body
     */
    extractPythonMethods(classBody, classStartLine) {
        const methods = [];
        const methodRegex = /^\s*(def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:)/gm;
        let methodMatch;
        while ((methodMatch = methodRegex.exec(classBody)) !== null) {
            const methodName = methodMatch[2];
            const paramsStr = methodMatch[3];
            const returnType = methodMatch[4]?.trim();
            const startLine = classStartLine + classBody.substring(0, methodMatch.index).split('\n').length;
            // Determine visibility
            let visibility = 'public';
            if (methodName.startsWith('__')) {
                visibility = 'private';
            }
            else if (methodName.startsWith('_')) {
                visibility = 'protected';
            }
            const parameters = this.parsePythonParameters(paramsStr);
            methods.push({
                name: methodName,
                visibility,
                isStatic: false, // Would need more context to determine
                isAsync: false, // Would need more context to determine
                parameters,
                returnType,
                startLine,
                endLine: startLine + 1, // Simplified
                complexity: 1, // Simplified
                callsTo: []
            });
        }
        return methods;
    }
    /**
     * Extract Python properties from class body
     */
    extractPythonProperties(classBody) {
        const properties = [];
        // Simple property detection (assignments in __init__)
        const propertyMatches = classBody.matchAll(/self\.(\w+)(?:\s*:\s*([^=\n]+))?\s*=/g);
        for (const match of propertyMatches) {
            const propName = match[1];
            const propType = match[2]?.trim();
            let visibility = 'public';
            if (propName.startsWith('__')) {
                visibility = 'private';
            }
            else if (propName.startsWith('_')) {
                visibility = 'protected';
            }
            properties.push({
                name: propName,
                type: propType,
                visibility
            });
        }
        return properties;
    }
    /**
     * Parse Python function parameters
     */
    parsePythonParameters(paramsStr) {
        if (!paramsStr.trim())
            return [];
        const params = paramsStr.split(',').map(p => p.trim());
        return params.map(param => {
            const parts = param.split(':');
            const name = parts[0].trim();
            const type = parts[1]?.split('=')[0]?.trim(); // Remove default values
            return {
                name,
                type
            };
        }).filter(p => p.name !== 'self'); // Remove self parameter
    }
    /**
     * Create detailed nodes in Neo4j graph
     */
    async createGraphNodes(structure, projectId) {
        const nodeMap = new Map();
        for (const file of structure.files) {
            try {
                // Create file node
                const fileNodeId = await this.semanticGraph.addNode('Code', {
                    name: path.basename(file.filePath),
                    path: file.filePath,
                    language: file.language,
                    project_id: projectId,
                    node_type: 'file',
                    exports: file.exports,
                    imports: file.dependencies,
                    constants_count: file.constants?.length || 0,
                    enums_count: file.enums?.length || 0
                });
                nodeMap.set(file.filePath, fileNodeId);
                // Create detailed class nodes
                for (const classInfo of file.classes) {
                    const classNodeId = await this.semanticGraph.addNode('Code', {
                        name: classInfo.name,
                        path: file.filePath,
                        language: file.language,
                        project_id: projectId,
                        node_type: 'class',
                        parent_file: file.filePath,
                        extends: classInfo.extends,
                        implements: classInfo.implements,
                        methods_count: classInfo.methods.length,
                        properties_count: classInfo.properties.length,
                        start_line: classInfo.startLine,
                        end_line: classInfo.endLine
                    });
                    nodeMap.set(`${file.filePath}:class:${classInfo.name}`, classNodeId);
                    // Link class to file
                    await this.semanticGraph.addRelationship(fileNodeId, classNodeId, 'DEFINES');
                    // Create inheritance relationships
                    if (classInfo.extends) {
                        nodeMap.set(`${file.filePath}:extends:${classInfo.name}:${classInfo.extends}`, classNodeId);
                    }
                    // Create method nodes
                    for (const method of classInfo.methods) {
                        const methodNodeId = await this.semanticGraph.addNode('Code', {
                            name: method.name,
                            path: file.filePath,
                            language: file.language,
                            project_id: projectId,
                            node_type: 'method',
                            parent_class: classInfo.name,
                            parent_file: file.filePath,
                            visibility: method.visibility,
                            is_static: method.isStatic,
                            is_async: method.isAsync,
                            parameters: method.parameters.map(p => p.name),
                            parameter_types: method.parameters.map(p => p.type || 'unknown'),
                            return_type: method.returnType,
                            complexity: method.complexity,
                            start_line: method.startLine,
                            end_line: method.endLine,
                            calls_to: method.callsTo
                        });
                        nodeMap.set(`${file.filePath}:method:${classInfo.name}:${method.name}`, methodNodeId);
                        // Link method to class
                        await this.semanticGraph.addRelationship(classNodeId, methodNodeId, 'CONTAINS');
                        // Create call relationships
                        for (const calledFunction of method.callsTo) {
                            nodeMap.set(`${file.filePath}:calls:${method.name}:${calledFunction}`, methodNodeId);
                        }
                    }
                    // Create property nodes
                    for (const property of classInfo.properties) {
                        const propertyNodeId = await this.semanticGraph.addNode('Code', {
                            name: property.name,
                            path: file.filePath,
                            language: file.language,
                            project_id: projectId,
                            node_type: 'property',
                            parent_class: classInfo.name,
                            parent_file: file.filePath,
                            visibility: property.visibility,
                            type: property.type || 'unknown'
                        });
                        nodeMap.set(`${file.filePath}:property:${classInfo.name}:${property.name}`, propertyNodeId);
                        // Link property to class
                        await this.semanticGraph.addRelationship(classNodeId, propertyNodeId, 'CONTAINS');
                    }
                }
                // Create detailed function nodes
                for (const functionInfo of file.functions) {
                    const functionNodeId = await this.semanticGraph.addNode('Code', {
                        name: functionInfo.name,
                        path: file.filePath,
                        language: file.language,
                        project_id: projectId,
                        node_type: 'function',
                        parent_file: file.filePath,
                        is_async: functionInfo.isAsync,
                        parameters: functionInfo.parameters.map(p => p.name),
                        parameter_types: functionInfo.parameters.map(p => p.type || 'unknown'),
                        return_type: functionInfo.returnType,
                        complexity: functionInfo.complexity,
                        start_line: functionInfo.startLine,
                        end_line: functionInfo.endLine,
                        calls_to: functionInfo.callsTo
                    });
                    nodeMap.set(`${file.filePath}:function:${functionInfo.name}`, functionNodeId);
                    // Link function to file
                    await this.semanticGraph.addRelationship(fileNodeId, functionNodeId, 'DEFINES');
                    // Create call relationships
                    for (const calledFunction of functionInfo.callsTo) {
                        nodeMap.set(`${file.filePath}:calls:${functionInfo.name}:${calledFunction}`, functionNodeId);
                    }
                }
                // Create interface nodes (TypeScript)
                for (const interfaceName of file.interfaces) {
                    const interfaceNodeId = await this.semanticGraph.addNode('Code', {
                        name: interfaceName,
                        path: file.filePath,
                        language: file.language,
                        project_id: projectId,
                        node_type: 'interface',
                        parent_file: file.filePath
                    });
                    nodeMap.set(`${file.filePath}:interface:${interfaceName}`, interfaceNodeId);
                    // Link interface to file
                    await this.semanticGraph.addRelationship(fileNodeId, interfaceNodeId, 'DEFINES');
                }
                // Create constant nodes
                for (const constant of file.constants || []) {
                    const constantNodeId = await this.semanticGraph.addNode('Code', {
                        name: constant.name,
                        path: file.filePath,
                        language: file.language,
                        project_id: projectId,
                        node_type: 'constant',
                        parent_file: file.filePath,
                        type: constant.type || 'unknown'
                    });
                    nodeMap.set(`${file.filePath}:constant:${constant.name}`, constantNodeId);
                    // Link constant to file
                    await this.semanticGraph.addRelationship(fileNodeId, constantNodeId, 'DEFINES');
                }
                // Create enum nodes
                for (const enumInfo of file.enums || []) {
                    const enumNodeId = await this.semanticGraph.addNode('Code', {
                        name: enumInfo.name,
                        path: file.filePath,
                        language: file.language,
                        project_id: projectId,
                        node_type: 'enum',
                        parent_file: file.filePath,
                        values: enumInfo.values,
                        values_count: enumInfo.values.length
                    });
                    nodeMap.set(`${file.filePath}:enum:${enumInfo.name}`, enumNodeId);
                    // Link enum to file
                    await this.semanticGraph.addRelationship(fileNodeId, enumNodeId, 'DEFINES');
                }
            }
            catch (error) {
                this.logger.warn(`Failed to create nodes for ${file.filePath}: ${error}`);
            }
        }
        return nodeMap;
    }
    /**
     * Create detailed relationships in Neo4j graph
     */
    async createGraphRelationships(structure, nodeMap) {
        // Create file-to-file import relationships
        for (const rel of structure.relationships) {
            try {
                const fromNodeId = nodeMap.get(rel.fromFile);
                const toNodeId = nodeMap.get(rel.toFile);
                if (fromNodeId && toNodeId) {
                    await this.semanticGraph.addRelationship(fromNodeId, toNodeId, rel.type, rel.metadata);
                }
            }
            catch (error) {
                this.logger.warn(`Failed to create relationship ${rel.fromFile} -> ${rel.toFile}: ${error}`);
            }
        }
        // Create inheritance and implementation relationships
        for (const file of structure.files) {
            for (const classInfo of file.classes) {
                try {
                    const classNodeId = nodeMap.get(`${file.filePath}:class:${classInfo.name}`);
                    if (!classNodeId)
                        continue;
                    // Create inheritance relationships
                    if (classInfo.extends) {
                        // Try to find the parent class in the same file or other files
                        for (const [nodeKey, nodeId] of nodeMap.entries()) {
                            if (nodeKey.includes(`:class:${classInfo.extends}`)) {
                                await this.semanticGraph.addRelationship(classNodeId, nodeId, 'EXTENDS', {
                                    relationship_type: 'inheritance',
                                    parent_class: classInfo.extends
                                });
                                break;
                            }
                        }
                    }
                    // Create implementation relationships
                    for (const interfaceName of classInfo.implements) {
                        for (const [nodeKey, nodeId] of nodeMap.entries()) {
                            if (nodeKey.includes(`:interface:${interfaceName}`) || nodeKey.includes(`:class:${interfaceName}`)) {
                                await this.semanticGraph.addRelationship(classNodeId, nodeId, 'IMPLEMENTS', {
                                    relationship_type: 'interface_implementation',
                                    interface_name: interfaceName
                                });
                                break;
                            }
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to create inheritance relationships for ${classInfo.name}: ${error}`);
                }
            }
        }
        // Create method-to-method call relationships
        for (const file of structure.files) {
            for (const classInfo of file.classes) {
                for (const method of classInfo.methods) {
                    try {
                        const methodNodeId = nodeMap.get(`${file.filePath}:method:${classInfo.name}:${method.name}`);
                        if (!methodNodeId)
                            continue;
                        // Create call relationships to other methods/functions
                        for (const calledFunction of method.callsTo) {
                            // Look for the called function in various forms
                            const possibleTargets = [
                                `${file.filePath}:method:${classInfo.name}:${calledFunction}`, // Same class method
                                `${file.filePath}:function:${calledFunction}`, // File-level function
                            ];
                            // Also search other classes in the same file
                            for (const otherClass of file.classes) {
                                possibleTargets.push(`${file.filePath}:method:${otherClass.name}:${calledFunction}`);
                            }
                            for (const targetKey of possibleTargets) {
                                const targetNodeId = nodeMap.get(targetKey);
                                if (targetNodeId) {
                                    await this.semanticGraph.addRelationship(methodNodeId, targetNodeId, 'CALLS', {
                                        relationship_type: 'function_call',
                                        called_function: calledFunction
                                    });
                                    break;
                                }
                            }
                        }
                    }
                    catch (error) {
                        this.logger.warn(`Failed to create call relationships for method ${method.name}: ${error}`);
                    }
                }
            }
            // Create relationships for standalone functions
            for (const functionInfo of file.functions) {
                try {
                    const functionNodeId = nodeMap.get(`${file.filePath}:function:${functionInfo.name}`);
                    if (!functionNodeId)
                        continue;
                    // Create call relationships
                    for (const calledFunction of functionInfo.callsTo) {
                        const possibleTargets = [
                            `${file.filePath}:function:${calledFunction}`, // Other functions
                        ];
                        // Also search methods in classes
                        for (const classInfo of file.classes) {
                            possibleTargets.push(`${file.filePath}:method:${classInfo.name}:${calledFunction}`);
                        }
                        for (const targetKey of possibleTargets) {
                            const targetNodeId = nodeMap.get(targetKey);
                            if (targetNodeId) {
                                await this.semanticGraph.addRelationship(functionNodeId, targetNodeId, 'CALLS', {
                                    relationship_type: 'function_call',
                                    called_function: calledFunction
                                });
                                break;
                            }
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to create call relationships for function ${functionInfo.name}: ${error}`);
                }
            }
        }
        // Create usage relationships for constants and enums
        for (const file of structure.files) {
            try {
                const fileNodeId = nodeMap.get(file.filePath);
                if (!fileNodeId)
                    continue;
                // Link constants and enums to classes/functions that might use them
                for (const constant of file.constants || []) {
                    const constantNodeId = nodeMap.get(`${file.filePath}:constant:${constant.name}`);
                    if (!constantNodeId)
                        continue;
                    // Create potential usage relationships (simplified detection)
                    for (const classInfo of file.classes) {
                        for (const method of classInfo.methods) {
                            if (method.callsTo.includes(constant.name)) {
                                const methodNodeId = nodeMap.get(`${file.filePath}:method:${classInfo.name}:${method.name}`);
                                if (methodNodeId) {
                                    await this.semanticGraph.addRelationship(methodNodeId, constantNodeId, 'USES', {
                                        relationship_type: 'constant_usage',
                                        constant_name: constant.name
                                    });
                                }
                            }
                        }
                    }
                }
            }
            catch (error) {
                this.logger.warn(`Failed to create usage relationships: ${error}`);
            }
        }
    }
    /**
     * Extract business concepts from code
     */
    async extractBusinessConcepts(structure, projectId) {
        const concepts = new Set();
        // Extract concepts from file names and class names
        for (const file of structure.files) {
            // Extract from file path
            const pathParts = file.filePath.split(/[/\\]/).map(part => part.replace(/\.(ts|js|tsx|jsx|py|java|cpp|c|cs|go|rs)$/i, ''));
            pathParts.forEach(part => {
                if (part.length > 2 && !['src', 'lib', 'dist', 'build', 'test', 'spec'].includes(part.toLowerCase())) {
                    concepts.add(part);
                }
            });
            // Extract from class names
            file.classes.forEach(classInfo => {
                concepts.add(classInfo.name);
            });
        }
        // Create business concept nodes
        for (const concept of concepts) {
            try {
                await this.semanticGraph.addNode('BusinessConcept', {
                    name: concept,
                    project_id: projectId,
                    extracted_from: 'code_analysis'
                });
            }
            catch (error) {
                this.logger.warn(`Failed to create business concept ${concept}: ${error}`);
            }
        }
    }
    /**
     * Resolve import path to actual file path
     */
    resolveImportPath(fromFile, importPath, projectPath) {
        // Skip external modules
        if (!importPath.startsWith('.') && !path.isAbsolute(importPath)) {
            return null;
        }
        try {
            const fromDir = path.dirname(fromFile);
            let resolvedPath = path.resolve(fromDir, importPath);
            // Try different extensions
            const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java'];
            for (const ext of extensions) {
                const withExt = resolvedPath + ext;
                if (fs.access(withExt).then(() => true).catch(() => false)) {
                    return path.relative(projectPath, withExt);
                }
            }
            // Try index files
            const indexFiles = extensions.map(ext => path.join(resolvedPath, 'index' + ext));
            for (const indexFile of indexFiles) {
                if (fs.access(indexFile).then(() => true).catch(() => false)) {
                    return path.relative(projectPath, indexFile);
                }
            }
        }
        catch (error) {
            // Resolution failed
        }
        return null;
    }
    /**
     * Detect programming language from file extension
     */
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust'
        };
        return languageMap[ext] || 'text';
    }
    /**
     * Extract methods from class body
     */
    extractMethods(classBody, classStartLine) {
        const methods = [];
        const methodRegex = /(public|private|protected)?\s*(static)?\s*(async)?\s*(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
        let methodMatch;
        while ((methodMatch = methodRegex.exec(classBody)) !== null) {
            const visibility = methodMatch[1] || 'public';
            const isStatic = !!methodMatch[2];
            const isAsync = !!methodMatch[3];
            const methodName = methodMatch[4];
            const paramsStr = methodMatch[5];
            const returnType = methodMatch[6]?.trim();
            const methodBody = methodMatch[7];
            const startLine = classStartLine + classBody.substring(0, methodMatch.index).split('\n').length;
            const endLine = startLine + methodMatch[0].split('\n').length - 1;
            const parameters = this.parseParameters(paramsStr);
            const callsTo = this.extractFunctionCalls(methodBody);
            const complexity = this.calculateComplexity(methodBody);
            methods.push({
                name: methodName,
                visibility,
                isStatic,
                isAsync,
                parameters,
                returnType,
                startLine,
                endLine,
                complexity,
                callsTo
            });
        }
        return methods;
    }
    /**
     * Extract properties from class body
     */
    extractProperties(classBody) {
        const properties = [];
        const propertyRegex = /(public|private|protected)?\s*(readonly)?\s*(\w+)(?:\s*:\s*([^=;\n]+))?(?:\s*=)?/g;
        let propMatch;
        while ((propMatch = propertyRegex.exec(classBody)) !== null) {
            const visibility = propMatch[1] || 'public';
            const propName = propMatch[3];
            const propType = propMatch[4]?.trim();
            // Skip if it looks like a method
            if (!classBody.includes(`${propName}(`)) {
                properties.push({
                    name: propName,
                    type: propType,
                    visibility
                });
            }
        }
        return properties;
    }
    /**
     * Parse function parameters
     */
    parseParameters(paramsStr) {
        if (!paramsStr.trim())
            return [];
        const params = paramsStr.split(',').map(p => p.trim());
        return params.map(param => {
            const parts = param.split(':');
            return {
                name: parts[0].trim(),
                type: parts[1]?.trim()
            };
        });
    }
    /**
     * Extract function calls from code body
     */
    extractFunctionCalls(codeBody) {
        const calls = [];
        // Simple function call extraction
        const callMatches = codeBody.matchAll(/(\w+)\s*\(/g);
        for (const match of callMatches) {
            const functionName = match[1];
            // Filter out common language keywords
            if (!['if', 'for', 'while', 'switch', 'catch', 'typeof', 'instanceof'].includes(functionName)) {
                calls.push(functionName);
            }
        }
        // Method calls with dots
        const methodCallMatches = codeBody.matchAll(/\.(\w+)\s*\(/g);
        for (const match of methodCallMatches) {
            calls.push(match[1]);
        }
        return [...new Set(calls)]; // Remove duplicates
    }
    /**
     * Calculate cyclomatic complexity (simplified)
     */
    calculateComplexity(codeBody) {
        let complexity = 1; // Base complexity
        // Count decision points
        const decisionPoints = [
            /\bif\b/g,
            /\belse\s+if\b/g,
            /\bfor\b/g,
            /\bwhile\b/g,
            /\bdo\b/g,
            /\bswitch\b/g,
            /\bcase\b/g,
            /\bcatch\b/g,
            /\?\s*.*\s*:/g, // ternary operator
            /&&/g,
            /\|\|/g
        ];
        decisionPoints.forEach(pattern => {
            const matches = codeBody.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });
        return complexity;
    }
    async close() {
        await this.semanticGraph.close();
    }
}
exports.CodeRelationshipParser = CodeRelationshipParser;
//# sourceMappingURL=code-relationship-parser.js.map