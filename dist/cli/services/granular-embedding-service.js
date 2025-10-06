"use strict";
/**
 * Granular Embedding Service
 * Creates method-level and class-level embeddings aligned with semantic graph nodes
 * Instead of arbitrary chunking, we chunk by semantic boundaries (methods, classes)
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
exports.GranularEmbeddingService = void 0;
const logger_1 = require("../../utils/logger");
const embedding_service_1 = require("./embedding-service");
const code_relationship_parser_1 = require("./code-relationship-parser");
const semantic_graph_1 = require("./semantic-graph");
const database_config_1 = require("../../config/database-config");
class GranularEmbeddingService {
    logger;
    embeddingService;
    codeParser;
    semanticGraph;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.embeddingService = new embedding_service_1.EmbeddingService();
        this.codeParser = new code_relationship_parser_1.CodeRelationshipParser();
        this.semanticGraph = new semantic_graph_1.SemanticGraphService();
    }
    /**
     * Generate method and class level embeddings for a project
     */
    async generateGranularEmbeddings(projectId, files, progressCallback) {
        this.logger.info(`🔍 Generating granular embeddings for ${files.length} files`);
        let methodCount = 0;
        let classCount = 0;
        let errors = 0;
        const dbConnections = new database_config_1.DatabaseConnections();
        try {
            for (let i = 0; i < files.length; i++) {
                const filePath = files[i];
                progressCallback?.(Math.round((i / files.length) * 100), `Processing ${filePath}`);
                try {
                    // Parse the file to extract methods and classes
                    const parsedFile = await this.codeParser.parseFile(filePath);
                    // Generate class-level embeddings
                    for (const classInfo of parsedFile.classes) {
                        await this.generateClassEmbedding(projectId, parsedFile, classInfo, dbConnections);
                        classCount++;
                        // Generate method-level embeddings for each method in the class
                        for (const method of classInfo.methods) {
                            await this.generateMethodEmbedding(projectId, parsedFile, classInfo, method, dbConnections);
                            methodCount++;
                        }
                    }
                    // Generate method-level embeddings for standalone functions
                    for (const functionInfo of parsedFile.functions) {
                        await this.generateMethodEmbedding(projectId, parsedFile, null, functionInfo, dbConnections);
                        methodCount++;
                    }
                }
                catch (error) {
                    this.logger.error(`Failed to process ${filePath}:`, error);
                    errors++;
                }
            }
            this.logger.info(`✅ Generated ${methodCount} method embeddings and ${classCount} class embeddings`);
        }
        finally {
            await dbConnections.closeAll();
        }
        return { methodEmbeddings: methodCount, classEmbeddings: classCount, errors };
    }
    /**
     * Generate embedding for a single class
     */
    async generateClassEmbedding(projectId, parsedFile, classInfo, dbConnections) {
        try {
            // Extract the class content from the file
            const content = await this.extractClassContent(parsedFile.filePath, classInfo);
            // Create class context for embedding
            const classContext = this.buildClassContext(classInfo, content);
            // Generate embedding using the embedding service
            const embedding = await this.embeddingService.generateEmbedding(classContext, parsedFile.filePath);
            // Create class embedding object
            const classEmbedding = {
                classId: `${parsedFile.filePath}:class:${classInfo.name}`,
                className: classInfo.name,
                filePath: parsedFile.filePath,
                content,
                embedding,
                metadata: {
                    extends: classInfo.extends,
                    implements: classInfo.implements,
                    methodCount: classInfo.methods.length,
                    propertyCount: classInfo.properties.length,
                    startLine: classInfo.startLine,
                    endLine: classInfo.endLine,
                    language: parsedFile.language,
                    methods: classInfo.methods.map((m) => m.name),
                    properties: classInfo.properties.map((p) => p.name)
                }
            };
            // Store in database
            await this.storeClassEmbedding(projectId, classEmbedding, dbConnections);
        }
        catch (error) {
            this.logger.error(`Failed to generate class embedding for ${classInfo.name}:`, error);
            throw error;
        }
    }
    /**
     * Generate embedding for a single method
     */
    async generateMethodEmbedding(projectId, parsedFile, classInfo, methodInfo, dbConnections) {
        try {
            // Extract the method content from the file
            const content = await this.extractMethodContent(parsedFile.filePath, methodInfo);
            // Create method context for embedding
            const methodContext = this.buildMethodContext(classInfo, methodInfo, content);
            // Generate embedding using the embedding service
            const embedding = await this.embeddingService.generateEmbedding(methodContext, parsedFile.filePath);
            // Create method embedding object
            const methodEmbedding = {
                methodId: classInfo
                    ? `${parsedFile.filePath}:method:${classInfo.name}:${methodInfo.name}`
                    : `${parsedFile.filePath}:function:${methodInfo.name}`,
                className: classInfo?.name,
                methodName: methodInfo.name,
                filePath: parsedFile.filePath,
                content,
                signature: this.buildMethodSignature(methodInfo),
                parameters: methodInfo.parameters,
                returnType: methodInfo.returnType,
                complexity: methodInfo.complexity,
                embedding,
                metadata: {
                    isAsync: methodInfo.isAsync || false,
                    visibility: methodInfo.visibility || 'public',
                    isStatic: methodInfo.isStatic || false,
                    startLine: methodInfo.startLine,
                    endLine: methodInfo.endLine,
                    language: parsedFile.language,
                    callsTo: methodInfo.callsTo || []
                }
            };
            // Store in database
            await this.storeMethodEmbedding(projectId, methodEmbedding, dbConnections);
        }
        catch (error) {
            this.logger.error(`Failed to generate method embedding for ${methodInfo.name}:`, error);
            throw error;
        }
    }
    /**
     * Find similar methods using cosine similarity
     */
    async findSimilarMethods(projectId, methodId, threshold = 0.8, limit = 10) {
        const dbConnections = new database_config_1.DatabaseConnections();
        try {
            const pgClient = await dbConnections.getPostgresConnection();
            // Get the target method embedding
            const targetQuery = `
        SELECT embedding, content, metadata
        FROM granular_method_embeddings
        WHERE project_id = $1 AND method_id = $2
      `;
            const targetResult = await pgClient.query(targetQuery, [projectId, methodId]);
            if (targetResult.rows.length === 0) {
                throw new Error(`Method ${methodId} not found`);
            }
            const targetEmbedding = JSON.parse(targetResult.rows[0].embedding);
            // Find similar methods using cosine similarity
            const similarQuery = `
        SELECT
          method_id,
          content,
          metadata,
          embedding,
          (1 - (embedding <=> $3::vector)) as similarity
        FROM granular_method_embeddings
        WHERE project_id = $1
          AND method_id != $2
          AND (1 - (embedding <=> $3::vector)) >= $4
        ORDER BY similarity DESC
        LIMIT $5
      `;
            const embeddingVector = `[${targetEmbedding.join(',')}]`;
            const results = await pgClient.query(similarQuery, [
                projectId,
                methodId,
                embeddingVector,
                threshold,
                limit
            ]);
            return results.rows.map(row => ({
                targetId: row.method_id,
                targetType: 'method',
                similarity: parseFloat(row.similarity),
                target: {
                    methodId: row.method_id,
                    content: row.content,
                    embedding: JSON.parse(row.embedding),
                    ...JSON.parse(row.metadata)
                }
            }));
        }
        finally {
            await dbConnections.closeAll();
        }
    }
    /**
     * Find similar classes using cosine similarity
     */
    async findSimilarClasses(projectId, classId, threshold = 0.8, limit = 10) {
        const dbConnections = new database_config_1.DatabaseConnections();
        try {
            const pgClient = await dbConnections.getPostgresConnection();
            // Get the target class embedding
            const targetQuery = `
        SELECT embedding, content, metadata
        FROM granular_class_embeddings
        WHERE project_id = $1 AND class_id = $2
      `;
            const targetResult = await pgClient.query(targetQuery, [projectId, classId]);
            if (targetResult.rows.length === 0) {
                throw new Error(`Class ${classId} not found`);
            }
            const targetEmbedding = JSON.parse(targetResult.rows[0].embedding);
            // Find similar classes using cosine similarity
            const similarQuery = `
        SELECT
          class_id,
          content,
          metadata,
          embedding,
          (1 - (embedding <=> $3::vector)) as similarity
        FROM granular_class_embeddings
        WHERE project_id = $1
          AND class_id != $2
          AND (1 - (embedding <=> $3::vector)) >= $4
        ORDER BY similarity DESC
        LIMIT $5
      `;
            const embeddingVector = `[${targetEmbedding.join(',')}]`;
            const results = await pgClient.query(similarQuery, [
                projectId,
                classId,
                embeddingVector,
                threshold,
                limit
            ]);
            return results.rows.map(row => ({
                targetId: row.class_id,
                targetType: 'class',
                similarity: parseFloat(row.similarity),
                target: {
                    classId: row.class_id,
                    content: row.content,
                    embedding: JSON.parse(row.embedding),
                    ...JSON.parse(row.metadata)
                }
            }));
        }
        finally {
            await dbConnections.closeAll();
        }
    }
    /**
     * Extract class content from file
     */
    async extractClassContent(filePath, classInfo) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        // Extract lines from startLine to endLine
        const classLines = lines.slice(classInfo.startLine - 1, classInfo.endLine);
        return classLines.join('\n');
    }
    /**
     * Extract method content from file
     */
    async extractMethodContent(filePath, methodInfo) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        // Extract lines from startLine to endLine
        const methodLines = lines.slice(methodInfo.startLine - 1, methodInfo.endLine);
        return methodLines.join('\n');
    }
    /**
     * Build class context for embedding generation
     */
    buildClassContext(classInfo, content) {
        const context = [
            `Class: ${classInfo.name}`,
            classInfo.extends ? `Extends: ${classInfo.extends}` : '',
            classInfo.implements.length > 0 ? `Implements: ${classInfo.implements.join(', ')}` : '',
            `Methods: ${classInfo.methods.map((m) => m.name).join(', ')}`,
            `Properties: ${classInfo.properties.map((p) => p.name).join(', ')}`,
            '',
            'Code:',
            content
        ].filter(Boolean).join('\n');
        return context;
    }
    /**
     * Build method context for embedding generation
     */
    buildMethodContext(classInfo, methodInfo, content) {
        const context = [
            classInfo ? `Class: ${classInfo.name}` : 'Standalone Function',
            `Method: ${methodInfo.name}`,
            `Parameters: ${methodInfo.parameters.map((p) => p.name).join(', ')}`,
            methodInfo.returnType ? `Returns: ${methodInfo.returnType}` : '',
            `Complexity: ${methodInfo.complexity}`,
            methodInfo.callsTo.length > 0 ? `Calls: ${methodInfo.callsTo.join(', ')}` : '',
            '',
            'Code:',
            content
        ].filter(Boolean).join('\n');
        return context;
    }
    /**
     * Build method signature string
     */
    buildMethodSignature(methodInfo) {
        const params = methodInfo.parameters.map((p) => p.type ? `${p.name}: ${p.type}` : p.name).join(', ');
        const returnType = methodInfo.returnType ? `: ${methodInfo.returnType}` : '';
        return `${methodInfo.name}(${params})${returnType}`;
    }
    /**
     * Store class embedding in database
     */
    async storeClassEmbedding(projectId, classEmbedding, dbConnections) {
        const pgClient = await dbConnections.getPostgresConnection();
        const query = `
      INSERT INTO granular_class_embeddings (
        project_id,
        class_id,
        class_name,
        file_path,
        content,
        embedding,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (project_id, class_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
        await pgClient.query(query, [
            projectId,
            classEmbedding.classId,
            classEmbedding.className,
            classEmbedding.filePath,
            classEmbedding.content,
            `[${classEmbedding.embedding.join(',')}]`,
            JSON.stringify(classEmbedding.metadata)
        ]);
    }
    /**
     * Store method embedding in database
     */
    async storeMethodEmbedding(projectId, methodEmbedding, dbConnections) {
        const pgClient = await dbConnections.getPostgresConnection();
        const query = `
      INSERT INTO granular_method_embeddings (
        project_id,
        method_id,
        method_name,
        class_name,
        file_path,
        content,
        signature,
        embedding,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (project_id, method_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        signature = EXCLUDED.signature,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
        await pgClient.query(query, [
            projectId,
            methodEmbedding.methodId,
            methodEmbedding.methodName,
            methodEmbedding.className,
            methodEmbedding.filePath,
            methodEmbedding.content,
            methodEmbedding.signature,
            `[${methodEmbedding.embedding.join(',')}]`,
            JSON.stringify(methodEmbedding.metadata)
        ]);
    }
    /**
     * Initialize database tables for granular embeddings
     */
    async initializeDatabase(projectId) {
        const dbConnections = new database_config_1.DatabaseConnections();
        try {
            const pgClient = await dbConnections.getPostgresConnection();
            // Create granular method embeddings table
            await pgClient.query(`
        CREATE TABLE IF NOT EXISTS granular_method_embeddings (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          method_id VARCHAR(500) NOT NULL,
          method_name VARCHAR(255) NOT NULL,
          class_name VARCHAR(255),
          file_path TEXT NOT NULL,
          content TEXT NOT NULL,
          signature TEXT NOT NULL,
          embedding vector(384) NOT NULL,
          metadata JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(project_id, method_id)
        )
      `);
            // Create granular class embeddings table
            await pgClient.query(`
        CREATE TABLE IF NOT EXISTS granular_class_embeddings (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          class_id VARCHAR(500) NOT NULL,
          class_name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding vector(384) NOT NULL,
          metadata JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(project_id, class_id)
        )
      `);
            // Create indexes for similarity search
            await pgClient.query(`
        CREATE INDEX IF NOT EXISTS idx_granular_method_embedding
        ON granular_method_embeddings USING ivfflat (embedding vector_cosine_ops)
      `);
            await pgClient.query(`
        CREATE INDEX IF NOT EXISTS idx_granular_class_embedding
        ON granular_class_embeddings USING ivfflat (embedding vector_cosine_ops)
      `);
            this.logger.info('✅ Granular embedding database tables initialized');
        }
        finally {
            await dbConnections.closeAll();
        }
    }
}
exports.GranularEmbeddingService = GranularEmbeddingService;
exports.default = GranularEmbeddingService;
//# sourceMappingURL=granular-embedding-service.js.map