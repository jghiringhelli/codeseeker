"use strict";
/**
 * Duplicate Code Detector
 * Uses semantic search and smart comparison to find duplicated code patterns
 * Following SOLID principles with configurable similarity thresholds
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
exports.DuplicateCodeDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../../../../utils/logger");
const database_config_1 = require("../../../../config/database-config");
const content_processor_1 = require("../../data/content-processing/content-processor");
class DuplicateCodeDetector {
    logger = logger_1.Logger.getInstance();
    dbConnections;
    embeddingProvider;
    defaultOptions = {
        exactSimilarityThreshold: 0.98,
        semanticSimilarityThreshold: 0.80,
        structuralSimilarityThreshold: 0.70,
        minimumChunkSize: 5,
        excludePatterns: ['*.test.*', '*.spec.*', '**/node_modules/**', '**/dist/**'],
        includeTypes: ['function', 'class', 'method', 'block']
    };
    constructor(dbConnections) {
        this.dbConnections = dbConnections || new database_config_1.DatabaseConnections();
        this.embeddingProvider = new content_processor_1.LocalEmbeddingProvider();
    }
    /**
     * Analyze project for duplicate code patterns
     */
    async analyzeProject(projectPath, options) {
        const config = { ...this.defaultOptions, ...options };
        this.logger.info(`🔍 Starting duplicate code analysis for project: ${projectPath}`);
        try {
            // Step 1: Extract code chunks from all files
            console.log('  📁 Extracting code chunks from project files...');
            const codeChunks = await this.extractCodeChunks(projectPath, config);
            console.log(`  ✅ Found ${codeChunks.length} code chunks to analyze`);
            // Step 2: Generate embeddings for semantic comparison
            console.log('  🧠 Generating embeddings for semantic analysis...');
            await this.generateEmbeddings(codeChunks);
            // Step 3: Find duplicate groups
            console.log('  🔄 Detecting duplicate patterns...');
            const duplicateGroups = await this.findDuplicateGroups(codeChunks, config);
            // Step 4: Generate consolidation suggestions
            console.log('  💡 Generating consolidation suggestions...');
            await this.generateConsolidationSuggestions(duplicateGroups);
            // Step 5: Create comprehensive report
            const report = this.createReport(codeChunks, duplicateGroups);
            this.logger.info(`✅ Duplicate analysis complete: ${report.duplicateGroups.length} duplicate groups found`);
            return report;
        }
        catch (error) {
            this.logger.error(`Failed to analyze duplicates: ${error.message}`);
            throw error;
        }
    }
    /**
     * Extract code chunks from project files using Tree-sitter
     */
    async extractCodeChunks(projectPath, config) {
        const chunks = [];
        const { ProjectFileScanner } = await Promise.resolve().then(() => __importStar(require('../../monitoring/file-scanning/project-file-scanner')));
        const { TreeSitterSemanticBuilder } = await Promise.resolve().then(() => __importStar(require('../../data/semantic-graph/tree-sitter-semantic-builder')));
        // Get all code files
        const fileScanner = new ProjectFileScanner();
        const scanResult = await fileScanner.scanProject(projectPath);
        // Filter for code files
        const codeFiles = scanResult.files.filter(file => {
            const ext = path.extname(file.path).toLowerCase();
            return ['.ts', '.js', '.py', '.java', '.go', '.rs'].includes(ext) &&
                !config.excludePatterns.some(pattern => file.path.includes(pattern.replace('*', '')));
        });
        const semanticBuilder = new TreeSitterSemanticBuilder();
        for (const file of codeFiles) {
            try {
                const content = await fs.promises.readFile(file.path, 'utf8');
                const language = this.detectLanguage(file.path);
                if (!language)
                    continue;
                // Extract semantic entities using buildSemanticGraph
                const analysis = await semanticBuilder.buildSemanticGraph([file]);
                // Convert entities to code chunks
                for (const entity of analysis.entities) {
                    if (config.includeTypes.includes(entity.type)) {
                        const entityContent = this.extractEntityContent(content, entity.startLine, entity.endLine);
                        if (entityContent.split('\n').length >= config.minimumChunkSize) {
                            chunks.push({
                                id: `${file.path}:${entity.startLine}-${entity.endLine}`,
                                filePath: file.path,
                                startLine: entity.startLine,
                                endLine: entity.endLine,
                                content: entityContent,
                                functionName: entity.type === 'function' ? entity.name : undefined,
                                className: entity.type === 'class' ? entity.name : undefined,
                                type: entity.type,
                                hash: this.generateContentHash(entityContent)
                            });
                        }
                    }
                }
                // Also extract larger code blocks
                await this.extractCodeBlocks(content, file.path, chunks, config);
            }
            catch (error) {
                this.logger.warn(`Failed to process file ${file.path}: ${error.message}`);
            }
        }
        return chunks;
    }
    /**
     * Generate embeddings for semantic comparison
     */
    async generateEmbeddings(chunks) {
        for (const chunk of chunks) {
            try {
                // Normalize content for better semantic comparison
                const normalizedContent = this.normalizeCodeContent(chunk.content);
                chunk.embedding = await this.embeddingProvider.generateEmbedding(normalizedContent);
            }
            catch (error) {
                this.logger.warn(`Failed to generate embedding for chunk ${chunk.id}: ${error.message}`);
            }
        }
    }
    /**
     * Find duplicate groups using multiple similarity measures
     */
    async findDuplicateGroups(chunks, config) {
        const groups = [];
        const processed = new Set();
        for (let i = 0; i < chunks.length; i++) {
            if (processed.has(chunks[i].id))
                continue;
            const similarChunks = [chunks[i]];
            processed.add(chunks[i].id);
            // Find similar chunks
            for (let j = i + 1; j < chunks.length; j++) {
                if (processed.has(chunks[j].id))
                    continue;
                const similarity = await this.calculateSimilarity(chunks[i], chunks[j]);
                if (similarity.score >= config.exactSimilarityThreshold) {
                    similarChunks.push(chunks[j]);
                    processed.add(chunks[j].id);
                }
                else if (similarity.score >= config.semanticSimilarityThreshold && similarity.type === 'semantic') {
                    similarChunks.push(chunks[j]);
                    processed.add(chunks[j].id);
                }
                else if (similarity.score >= config.structuralSimilarityThreshold && similarity.type === 'structural') {
                    similarChunks.push(chunks[j]);
                    processed.add(chunks[j].id);
                }
            }
            // Create group if duplicates found
            if (similarChunks.length > 1) {
                const maxSimilarity = Math.max(...similarChunks.slice(1).map(chunk => this.calculateSimilaritySync(chunks[i], chunk).score));
                groups.push({
                    id: `group-${groups.length + 1}`,
                    similarity: maxSimilarity,
                    chunks: similarChunks,
                    type: this.determineDuplicateType(maxSimilarity, config),
                    consolidationSuggestion: '',
                    estimatedSavings: {
                        linesReduced: 0,
                        filesAffected: new Set(similarChunks.map(c => c.filePath)).size,
                        maintenanceImprovement: ''
                    }
                });
            }
        }
        return groups;
    }
    /**
     * Calculate similarity between two code chunks
     */
    async calculateSimilarity(chunk1, chunk2) {
        // 1. Exact hash comparison
        if (chunk1.hash === chunk2.hash) {
            return { score: 1.0, type: 'exact' };
        }
        // 2. Semantic similarity using embeddings
        if (chunk1.embedding && chunk2.embedding) {
            const semanticScore = this.cosineSimilarity(chunk1.embedding, chunk2.embedding);
            if (semanticScore > 0.75) {
                return { score: semanticScore, type: 'semantic' };
            }
        }
        // 3. Structural similarity (AST-based comparison)
        const structuralScore = this.calculateStructuralSimilarity(chunk1.content, chunk2.content);
        return { score: structuralScore, type: 'structural' };
    }
    /**
     * Synchronous version for quick comparisons
     */
    calculateSimilaritySync(chunk1, chunk2) {
        if (chunk1.hash === chunk2.hash) {
            return { score: 1.0, type: 'exact' };
        }
        if (chunk1.embedding && chunk2.embedding) {
            const semanticScore = this.cosineSimilarity(chunk1.embedding, chunk2.embedding);
            if (semanticScore > 0.75) {
                return { score: semanticScore, type: 'semantic' };
            }
        }
        const structuralScore = this.calculateStructuralSimilarity(chunk1.content, chunk2.content);
        return { score: structuralScore, type: 'structural' };
    }
    /**
     * Generate consolidation suggestions for duplicate groups
     */
    async generateConsolidationSuggestions(groups) {
        for (const group of groups) {
            const mainChunk = group.chunks[0];
            const duplicateCount = group.chunks.length - 1;
            const totalLines = group.chunks.reduce((sum, chunk) => sum + (chunk.endLine - chunk.startLine + 1), 0);
            const potentialSavings = totalLines - (mainChunk.endLine - mainChunk.startLine + 1);
            group.estimatedSavings.linesReduced = potentialSavings;
            switch (group.type) {
                case 'exact':
                    group.consolidationSuggestion = `Extract exact duplicate ${mainChunk.type} "${mainChunk.functionName || mainChunk.className || 'code block'}" into a shared utility. Found ${duplicateCount} exact copies across ${group.estimatedSavings.filesAffected} files.`;
                    group.estimatedSavings.maintenanceImprovement = 'High - Single point of maintenance, reduced bug propagation';
                    break;
                case 'semantic':
                    group.consolidationSuggestion = `Refactor semantically similar ${mainChunk.type} "${mainChunk.functionName || mainChunk.className || 'code block'}" into a configurable shared function. Found ${duplicateCount} similar implementations with ${(group.similarity * 100).toFixed(1)}% similarity.`;
                    group.estimatedSavings.maintenanceImprovement = 'Medium - Reduced code duplication, improved consistency';
                    break;
                case 'structural':
                    group.consolidationSuggestion = `Consider creating a common base class or utility function for structurally similar ${mainChunk.type} patterns. Found ${duplicateCount} similar structures with ${(group.similarity * 100).toFixed(1)}% structural similarity.`;
                    group.estimatedSavings.maintenanceImprovement = 'Medium - Better code organization, reduced structural duplication';
                    break;
            }
        }
    }
    /**
     * Create comprehensive deduplication report
     */
    createReport(chunks, groups) {
        const exactDuplicates = groups.filter(g => g.type === 'exact').length;
        const semanticDuplicates = groups.filter(g => g.type === 'semantic').length;
        const structuralDuplicates = groups.filter(g => g.type === 'structural').length;
        const totalLinesAffected = groups.reduce((sum, group) => sum + group.chunks.reduce((groupSum, chunk) => groupSum + (chunk.endLine - chunk.startLine + 1), 0), 0);
        const potentialSavings = groups.reduce((sum, group) => sum + group.estimatedSavings.linesReduced, 0);
        const recommendations = [
            exactDuplicates > 0 ? `Prioritize ${exactDuplicates} exact duplicate groups for immediate consolidation` : null,
            semanticDuplicates > 0 ? `Review ${semanticDuplicates} semantic duplicate groups for potential refactoring` : null,
            structuralDuplicates > 0 ? `Consider architectural improvements for ${structuralDuplicates} structural duplicate groups` : null,
            potentialSavings > 100 ? `Significant code reduction opportunity: ${potentialSavings} lines could be eliminated` : null,
            groups.length > 10 ? 'Consider implementing automated duplication detection in CI/CD pipeline' : null
        ].filter(Boolean);
        return {
            totalChunksAnalyzed: chunks.length,
            duplicateGroups: groups,
            summary: {
                exactDuplicates,
                semanticDuplicates,
                structuralDuplicates,
                totalLinesAffected,
                potentialSavings
            },
            recommendations
        };
    }
    // Helper methods
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust'
        };
        return languageMap[ext] || null;
    }
    extractEntityContent(content, startLine, endLine) {
        const lines = content.split('\n');
        return lines.slice(startLine - 1, endLine).join('\n');
    }
    async extractCodeBlocks(content, filePath, chunks, config) {
        // Extract larger code blocks (e.g., conditional blocks, loops)
        const lines = content.split('\n');
        let currentBlock = '';
        let blockStart = 0;
        let braceLevel = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            if (trimmedLine.includes('{')) {
                if (braceLevel === 0) {
                    blockStart = i + 1;
                    currentBlock = '';
                }
                braceLevel += (line.match(/{/g) || []).length;
            }
            if (braceLevel > 0) {
                currentBlock += line + '\n';
            }
            if (trimmedLine.includes('}')) {
                braceLevel -= (line.match(/}/g) || []).length;
                if (braceLevel === 0 && currentBlock.trim()) {
                    const blockLines = currentBlock.trim().split('\n');
                    if (blockLines.length >= config.minimumChunkSize) {
                        chunks.push({
                            id: `${filePath}:block-${blockStart}-${i + 1}`,
                            filePath,
                            startLine: blockStart,
                            endLine: i + 1,
                            content: currentBlock.trim(),
                            type: 'block',
                            hash: this.generateContentHash(currentBlock.trim())
                        });
                    }
                    currentBlock = '';
                }
            }
        }
    }
    normalizeCodeContent(content) {
        return content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/;+/g, ';') // Normalize semicolons
            .trim();
    }
    generateContentHash(content) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(this.normalizeCodeContent(content)).digest('hex');
    }
    cosineSimilarity(a, b) {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }
    calculateStructuralSimilarity(content1, content2) {
        // Simple structural similarity based on normalized structure
        const structure1 = this.extractStructure(content1);
        const structure2 = this.extractStructure(content2);
        const common = structure1.filter(item => structure2.includes(item)).length;
        const total = new Set([...structure1, ...structure2]).size;
        return total > 0 ? common / total : 0;
    }
    extractStructure(content) {
        // Extract structural elements (keywords, patterns)
        const patterns = [
            /\b(if|else|for|while|switch|case|try|catch|finally)\b/g,
            /\b(function|class|interface|enum|type)\b/g,
            /[{}();,]/g
        ];
        const structure = [];
        patterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches)
                structure.push(...matches);
        });
        return structure;
    }
    determineDuplicateType(similarity, config) {
        if (similarity >= config.exactSimilarityThreshold)
            return 'exact';
        if (similarity >= config.semanticSimilarityThreshold)
            return 'semantic';
        return 'structural';
    }
}
exports.DuplicateCodeDetector = DuplicateCodeDetector;
exports.default = DuplicateCodeDetector;
//# sourceMappingURL=duplicate-code-detector.js.map