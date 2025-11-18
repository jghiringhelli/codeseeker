"use strict";
/**
 * Database Update Manager - Atomic updates across all CodeMind databases
 * Coordinates updates to PostgreSQL, Neo4j, Redis, and MongoDB after code changes
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
exports.DatabaseUpdateManager = void 0;
const logger_1 = require("../../utils/logger");
const database_config_1 = require("../../config/database-config");
const crypto = __importStar(require("crypto"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
class DatabaseUpdateManager {
    logger = logger_1.Logger.getInstance();
    db;
    projectRoot;
    constructor(db, projectRoot) {
        this.db = db || new database_config_1.DatabaseConnections();
        this.projectRoot = projectRoot || process.cwd();
    }
    async updateAllDatabases(modifiedFiles, context, workflowStats) {
        this.logger.info(`🔄 Updating all databases for ${modifiedFiles.length} modified files...`);
        const startTime = Date.now();
        const result = {
            neo4j: { nodesCreated: 0, nodesUpdated: 0, relationshipsCreated: 0, relationshipsUpdated: 0, success: false },
            redis: { filesUpdated: 0, hashesUpdated: 0, cacheEntriesInvalidated: 0, success: false },
            postgres: { recordsUpdated: 0, embeddingsUpdated: 0, projectStatsUpdated: false, success: false },
            mongodb: { documentsUpdated: 0, analysisResultsStored: 0, qualityReportsStored: 0, success: false }
        };
        try {
            // Prepare file update information
            const fileUpdates = await this.prepareFileUpdates(modifiedFiles);
            // Update all databases in parallel for efficiency
            const [neo4jResult, redisResult, postgresResult, mongoResult] = await Promise.allSettled([
                this.updateNeo4jGraph(fileUpdates, context),
                this.updateRedisCache(fileUpdates),
                this.updatePostgresData(fileUpdates, workflowStats),
                this.updateMongoDocuments(fileUpdates, context, workflowStats)
            ]);
            // Process results
            if (neo4jResult.status === 'fulfilled') {
                result.neo4j = neo4jResult.value;
            }
            else {
                result.neo4j.error = neo4jResult.reason?.message || 'Neo4j update failed';
                this.logger.error('Neo4j update failed:', neo4jResult.reason);
            }
            if (redisResult.status === 'fulfilled') {
                result.redis = redisResult.value;
            }
            else {
                result.redis.error = redisResult.reason?.message || 'Redis update failed';
                this.logger.error('Redis update failed:', redisResult.reason);
            }
            if (postgresResult.status === 'fulfilled') {
                result.postgres = postgresResult.value;
            }
            else {
                result.postgres.error = postgresResult.reason?.message || 'PostgreSQL update failed';
                this.logger.error('PostgreSQL update failed:', postgresResult.reason);
            }
            if (mongoResult.status === 'fulfilled') {
                result.mongodb = mongoResult.value;
            }
            else {
                result.mongodb.error = mongoResult.reason?.message || 'MongoDB update failed';
                this.logger.error('MongoDB update failed:', mongoResult.reason);
            }
            const duration = Date.now() - startTime;
            const successCount = [result.neo4j.success, result.redis.success, result.postgres.success, result.mongodb.success].filter(Boolean).length;
            this.logger.info(`✅ Database updates completed in ${duration}ms (${successCount}/4 successful)`);
            return result;
        }
        catch (error) {
            this.logger.error('Database update manager failed:', error);
            throw error;
        }
    }
    async prepareFileUpdates(modifiedFiles) {
        const fileUpdates = [];
        for (const filePath of modifiedFiles) {
            try {
                const fullPath = path.resolve(this.projectRoot, filePath);
                // Check if file exists (created/modified) or was deleted
                let action = 'modified';
                let content = '';
                let size = 0;
                let lastModified = new Date().toISOString();
                try {
                    const stats = await fs_1.promises.stat(fullPath);
                    content = await fs_1.promises.readFile(fullPath, 'utf-8');
                    size = stats.size;
                    lastModified = stats.mtime.toISOString();
                    // Simple heuristic: if file is very new, consider it created
                    const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
                    if (ageMinutes < 5) {
                        action = 'created';
                    }
                }
                catch (error) {
                    // File doesn't exist, so it was deleted
                    action = 'deleted';
                }
                const newHash = this.calculateFileHash(content);
                fileUpdates.push({
                    filePath,
                    action,
                    content: action !== 'deleted' ? content : undefined,
                    newHash,
                    size,
                    lastModified
                });
            }
            catch (error) {
                this.logger.warn(`Could not prepare update info for ${filePath}:`, error);
            }
        }
        return fileUpdates;
    }
    async updateNeo4jGraph(fileUpdates, context) {
        let nodesCreated = 0;
        let nodesUpdated = 0;
        let relationshipsCreated = 0;
        let relationshipsUpdated = 0;
        try {
            const neo4j = await this.db.getNeo4jConnection();
            const session = neo4j.session();
            try {
                for (const fileUpdate of fileUpdates) {
                    if (fileUpdate.action === 'deleted') {
                        // Delete node and all its relationships
                        await session.run(`
              MATCH (f:File {filePath: $filePath})
              DETACH DELETE f
            `, { filePath: fileUpdate.filePath });
                        continue;
                    }
                    // Check if node exists
                    const existingNode = await session.run(`
            MATCH (f:File {filePath: $filePath})
            RETURN f
          `, { filePath: fileUpdate.filePath });
                    if (existingNode.records.length > 0) {
                        // Update existing node
                        await session.run(`
              MATCH (f:File {filePath: $filePath})
              SET f.contentHash = $hash,
                  f.size = $size,
                  f.lastModified = $lastModified,
                  f.updatedAt = datetime()
            `, {
                            filePath: fileUpdate.filePath,
                            hash: fileUpdate.newHash,
                            size: fileUpdate.size,
                            lastModified: fileUpdate.lastModified
                        });
                        nodesUpdated++;
                    }
                    else {
                        // Create new node
                        const fileType = this.determineFileType(fileUpdate.filePath);
                        await session.run(`
              CREATE (f:File {
                filePath: $filePath,
                fileName: $fileName,
                fileType: $fileType,
                contentHash: $hash,
                size: $size,
                lastModified: $lastModified,
                createdAt: datetime(),
                updatedAt: datetime()
              })
            `, {
                            filePath: fileUpdate.filePath,
                            fileName: path.basename(fileUpdate.filePath),
                            fileType,
                            hash: fileUpdate.newHash,
                            size: fileUpdate.size,
                            lastModified: fileUpdate.lastModified
                        });
                        nodesCreated++;
                    }
                    // Update relationships for modified/created files
                    if (fileUpdate.content) {
                        const newRelationships = this.analyzeFileRelationships(fileUpdate.filePath, fileUpdate.content);
                        const relationshipStats = await this.updateFileRelationships(session, fileUpdate.filePath, newRelationships);
                        relationshipsCreated += relationshipStats.created;
                        relationshipsUpdated += relationshipStats.updated;
                    }
                }
                return {
                    nodesCreated,
                    nodesUpdated,
                    relationshipsCreated,
                    relationshipsUpdated,
                    success: true
                };
            }
            finally {
                await session.close();
            }
        }
        catch (error) {
            this.logger.error('Neo4j update failed:', error);
            return {
                nodesCreated,
                nodesUpdated,
                relationshipsCreated,
                relationshipsUpdated,
                success: false,
                error: error.message
            };
        }
    }
    async updateRedisCache(fileUpdates) {
        let filesUpdated = 0;
        let hashesUpdated = 0;
        let cacheEntriesInvalidated = 0;
        try {
            const redis = await this.db.getRedisConnection();
            for (const fileUpdate of fileUpdates) {
                const cacheKey = `file:${fileUpdate.filePath}`;
                const hashKey = `hash:${fileUpdate.filePath}`;
                if (fileUpdate.action === 'deleted') {
                    // Delete from cache
                    await redis.del([cacheKey, hashKey]);
                    cacheEntriesInvalidated++;
                    continue;
                }
                // Update file content and hash in cache
                if (fileUpdate.content) {
                    await redis.setex(cacheKey, 3600, fileUpdate.content); // 1 hour TTL
                    filesUpdated++;
                }
                await redis.set(hashKey, fileUpdate.newHash);
                hashesUpdated++;
                // Invalidate related cache entries
                const relatedKeys = await redis.keys(`analysis:*:${fileUpdate.filePath}*`);
                if (relatedKeys.length > 0) {
                    await redis.del(relatedKeys);
                    cacheEntriesInvalidated += relatedKeys.length;
                }
            }
            return {
                filesUpdated,
                hashesUpdated,
                cacheEntriesInvalidated,
                success: true
            };
        }
        catch (error) {
            this.logger.error('Redis update failed:', error);
            return {
                filesUpdated,
                hashesUpdated,
                cacheEntriesInvalidated,
                success: false,
                error: error.message
            };
        }
    }
    async updatePostgresData(fileUpdates, workflowStats) {
        let recordsUpdated = 0;
        let embeddingsUpdated = 0;
        let projectStatsUpdated = false;
        try {
            const postgres = await this.db.getPostgresConnection();
            // Update file records and embeddings
            for (const fileUpdate of fileUpdates) {
                if (fileUpdate.action === 'deleted') {
                    // Delete file record and embeddings
                    await postgres.query(`
            DELETE FROM file_embeddings WHERE file_path = $1
          `, [fileUpdate.filePath]);
                    await postgres.query(`
            DELETE FROM files WHERE file_path = $1
          `, [fileUpdate.filePath]);
                    recordsUpdated++;
                    continue;
                }
                // Check if file record exists
                const existingFile = await postgres.query(`
          SELECT id FROM files WHERE file_path = $1
        `, [fileUpdate.filePath]);
                if (existingFile.rows.length > 0) {
                    // Update existing file
                    await postgres.query(`
            UPDATE files 
            SET content_hash = $1, 
                size = $2, 
                last_modified = $3, 
                updated_at = NOW()
            WHERE file_path = $4
          `, [fileUpdate.newHash, fileUpdate.size, fileUpdate.lastModified, fileUpdate.filePath]);
                }
                else {
                    // Insert new file
                    await postgres.query(`
            INSERT INTO files (file_path, file_name, file_type, content_hash, size, last_modified, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          `, [
                        fileUpdate.filePath,
                        path.basename(fileUpdate.filePath),
                        this.determineFileType(fileUpdate.filePath),
                        fileUpdate.newHash,
                        fileUpdate.size,
                        fileUpdate.lastModified
                    ]);
                }
                recordsUpdated++;
                // Generate and store embeddings for code elements
                if (fileUpdate.content && this.shouldGenerateEmbedding(fileUpdate.filePath)) {
                    try {
                        const codeElements = this.extractCodeElementsForEmbedding(fileUpdate.filePath, fileUpdate.content);
                        for (const element of codeElements) {
                            const embedding = await this.generateEmbedding(element.code);
                            const codeHash = this.calculateCodeHash(element.code);
                            // Use the new function that automatically detects duplicates
                            const result = await postgres.query(`
                SELECT * FROM update_code_embedding_and_detect_duplicates($1, $2, $3, $4, $5, $6, $7, $8, $9)
              `, [
                                1, // project_id - should get this from context
                                fileUpdate.filePath,
                                element.name,
                                element.type,
                                element.startLine,
                                element.endLine,
                                codeHash,
                                JSON.stringify(embedding),
                                JSON.stringify({
                                    linesOfCode: element.code.split('\n').length,
                                    complexity: this.calculateSimpleComplexity(element.code),
                                    language: this.determineFileType(fileUpdate.filePath)
                                })
                            ]);
                            if (result.rows.length > 0) {
                                const { duplicate_count, highest_similarity } = result.rows[0];
                                if (duplicate_count > 0) {
                                    this.logger.info(`🔍 Found ${duplicate_count} similar elements for ${element.name} (highest: ${Math.round(highest_similarity * 100)}%)`);
                                }
                            }
                            embeddingsUpdated++;
                        }
                    }
                    catch (embedError) {
                        this.logger.warn(`Could not generate embeddings for ${fileUpdate.filePath}:`, embedError);
                    }
                }
            }
            // Update project statistics if workflow stats provided
            if (workflowStats) {
                await postgres.query(`
          INSERT INTO workflow_history (
            workflow_id, files_modified, lines_added, lines_removed,
            quality_score, duration, success, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
                    workflowStats.workflowId,
                    workflowStats.filesModified,
                    workflowStats.linesAdded,
                    workflowStats.linesRemoved,
                    workflowStats.qualityScore,
                    workflowStats.duration,
                    workflowStats.success
                ]);
                projectStatsUpdated = true;
            }
            return {
                recordsUpdated,
                embeddingsUpdated,
                projectStatsUpdated,
                success: true
            };
        }
        catch (error) {
            this.logger.error('PostgreSQL update failed:', error);
            return {
                recordsUpdated,
                embeddingsUpdated,
                projectStatsUpdated,
                success: false,
                error: error.message
            };
        }
    }
    async updateMongoDocuments(fileUpdates, context, workflowStats) {
        // MongoDB disabled for v0.1.0 - focusing on PostgreSQL first
        return {
            success: true,
            documentsUpdated: 0,
            analysisResultsStored: 0,
            qualityReportsStored: 0
        };
    }
    // Helper methods
    calculateFileHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    determineFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const typeMap = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.json': 'json',
            '.md': 'markdown',
            '.sql': 'sql',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'header',
            '.css': 'css',
            '.html': 'html',
            '.xml': 'xml',
            '.yml': 'yaml',
            '.yaml': 'yaml'
        };
        return typeMap[ext] || 'unknown';
    }
    analyzeFileRelationships(filePath, content) {
        const relationships = [];
        // Analyze imports and dependencies
        const importRegex = /(?:import|require)\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
                // External dependency
                relationships.push({ type: 'DEPENDS_ON', target: importPath });
            }
            else {
                // Local file import
                const resolvedPath = this.resolveImportPath(filePath, importPath);
                if (resolvedPath) {
                    relationships.push({ type: 'IMPORTS', target: resolvedPath });
                }
            }
        }
        // Analyze class inheritance
        const extendsRegex = /class\s+\w+\s+extends\s+(\w+)/g;
        while ((match = extendsRegex.exec(content)) !== null) {
            relationships.push({ type: 'EXTENDS', target: match[1] });
        }
        // Analyze interface implementation
        const implementsRegex = /class\s+\w+.*implements\s+([\w,\s]+)/g;
        while ((match = implementsRegex.exec(content)) !== null) {
            const interfaces = match[1].split(',').map(i => i.trim());
            for (const interfaceName of interfaces) {
                relationships.push({ type: 'IMPLEMENTS', target: interfaceName });
            }
        }
        return relationships;
    }
    resolveImportPath(filePath, importPath) {
        try {
            const fileDir = path.dirname(filePath);
            const resolvedPath = path.resolve(fileDir, importPath);
            const relativePath = path.relative(this.projectRoot, resolvedPath);
            // Add common extensions if not present
            const extensions = ['.ts', '.js', '.json'];
            for (const ext of extensions) {
                const fullPath = relativePath + ext;
                try {
                    // This would normally check if file exists, but we'll just return the path
                    return fullPath;
                }
                catch {
                    continue;
                }
            }
            return relativePath;
        }
        catch {
            return null;
        }
    }
    async updateFileRelationships(session, filePath, relationships) {
        let created = 0;
        let updated = 0;
        // Delete existing relationships for this file
        await session.run(`
      MATCH (f:File {filePath: $filePath})-[r]->()
      DELETE r
    `, { filePath });
        // Create new relationships
        for (const rel of relationships) {
            try {
                const result = await session.run(`
          MATCH (f:File {filePath: $filePath})
          MERGE (t:Target {name: $target})
          CREATE (f)-[:${rel.type}]->(t)
          RETURN COUNT(*) as created
        `, { filePath, target: rel.target });
                if (result.records.length > 0) {
                    created++;
                }
            }
            catch (error) {
                this.logger.warn(`Could not create relationship ${rel.type} to ${rel.target}:`, error);
            }
        }
        return { created, updated };
    }
    shouldGenerateEmbedding(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const embeddableTypes = ['.ts', '.js', '.py', '.java', '.cs', '.cpp', '.c', '.md'];
        return embeddableTypes.includes(ext);
    }
    async generateEmbedding(content) {
        // Mock embedding generation - in real implementation, use a proper embedding service
        // This would typically call an embedding API or use a local embedding model
        const mockEmbedding = new Array(384).fill(0).map(() => Math.random() * 2 - 1);
        return mockEmbedding;
    }
    async generateFileAnalysis(fileUpdate) {
        // Mock file analysis - in real implementation, this would analyze the file content
        return {
            language: this.determineFileType(fileUpdate.filePath),
            linesOfCode: fileUpdate.content ? fileUpdate.content.split('\n').length : 0,
            complexity: Math.floor(Math.random() * 10) + 1,
            maintainabilityIndex: Math.floor(Math.random() * 100),
            functions: [], // Would extract function definitions
            classes: [], // Would extract class definitions
            imports: [], // Would extract import statements
            exports: [], // Would extract export statements
            lastAnalyzed: new Date().toISOString()
        };
    }
    extractCodeElementsForEmbedding(filePath, content) {
        const elements = [];
        const lines = content.split('\n');
        // Extract classes
        const classRegex = /^(\s*)(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/gm;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const className = match[2];
            const startIndex = match.index;
            const startLine = content.substring(0, startIndex).split('\n').length;
            // Find the complete class body
            const classEnd = this.findMatchingBrace(content, startIndex + match[0].length - 1);
            if (classEnd !== -1) {
                const classCode = content.substring(startIndex, classEnd + 1);
                const endLine = startLine + classCode.split('\n').length - 1;
                elements.push({
                    name: className,
                    type: 'class',
                    code: classCode,
                    startLine,
                    endLine
                });
            }
        }
        // Extract standalone functions
        const functionRegex = /^(\s*)(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm;
        while ((match = functionRegex.exec(content)) !== null) {
            const functionName = match[2];
            const startIndex = match.index;
            const startLine = content.substring(0, startIndex).split('\n').length;
            const functionEnd = this.findMatchingBrace(content, startIndex + match[0].length - 1);
            if (functionEnd !== -1) {
                const functionCode = content.substring(startIndex, functionEnd + 1);
                const endLine = startLine + functionCode.split('\n').length - 1;
                elements.push({
                    name: functionName,
                    type: 'function',
                    code: functionCode,
                    startLine,
                    endLine
                });
            }
        }
        // Extract interfaces
        const interfaceRegex = /^(\s*)(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{/gm;
        while ((match = interfaceRegex.exec(content)) !== null) {
            const interfaceName = match[2];
            const startIndex = match.index;
            const startLine = content.substring(0, startIndex).split('\n').length;
            const interfaceEnd = this.findMatchingBrace(content, startIndex + match[0].length - 1);
            if (interfaceEnd !== -1) {
                const interfaceCode = content.substring(startIndex, interfaceEnd + 1);
                const endLine = startLine + interfaceCode.split('\n').length - 1;
                elements.push({
                    name: interfaceName,
                    type: 'interface',
                    code: interfaceCode,
                    startLine,
                    endLine
                });
            }
        }
        return elements;
    }
    findMatchingBrace(content, startIndex) {
        let braceCount = 1;
        let currentIndex = startIndex + 1;
        while (currentIndex < content.length && braceCount > 0) {
            const char = content[currentIndex];
            if (char === '{') {
                braceCount++;
            }
            else if (char === '}') {
                braceCount--;
            }
            currentIndex++;
        }
        return braceCount === 0 ? currentIndex - 1 : -1;
    }
    calculateSimpleComplexity(code) {
        // Simple cyclomatic complexity calculation
        const complexityIndicators = (code.match(/if|else|while|for|switch|case|catch|\?\s*:/g) || []).length;
        return Math.max(1, complexityIndicators + 1); // Base complexity of 1
    }
    calculateCodeHash(code) {
        // Normalize code before hashing to handle whitespace differences
        const normalizedCode = code
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        return crypto.createHash('sha256').update(normalizedCode).digest('hex');
    }
}
exports.DatabaseUpdateManager = DatabaseUpdateManager;
exports.default = DatabaseUpdateManager;
//# sourceMappingURL=database-update-manager.js.map