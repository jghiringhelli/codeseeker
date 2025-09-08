"use strict";
/**
 * Document Map Analyzer - Semantic Documentation Understanding
 * Maps project documentation structure and provides semantic search for Claude Code context
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
exports.DocumentMapAnalyzer = void 0;
const logger_1 = require("../../utils/logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
class DocumentMapAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeDocumentation(params) {
        const startTime = Date.now();
        try {
            this.logger.info('📚 Starting documentation map analysis...');
            // 1. Find all documentation files
            const docFiles = await this.findDocumentationFiles(params.projectPath, params.excludePatterns);
            // 2. Analyze each document
            const documents = await this.analyzeDocuments(docFiles, params.projectPath);
            // 3. Extract referenced classes if requested
            const mainClasses = params.includeCodeStructure
                ? await this.extractMainClasses(documents)
                : [];
            // 4. Identify topic clusters
            const topics = this.identifyTopicClusters(documents);
            // 5. Find cross-references
            const crossReferences = this.findCrossReferences(documents);
            // 6. Build semantic search index
            const searchIndex = this.buildSearchIndex(documents, topics, mainClasses);
            // 7. Generate Mermaid diagram if requested
            const mermaidMap = params.generateMermaid
                ? this.generateMermaidMap(documents, crossReferences, topics)
                : undefined;
            // 8. Calculate statistics
            const statistics = this.calculateStatistics(documents, topics);
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Documentation map completed in ${duration}ms`, {
                documentsFound: documents.length,
                topicsIdentified: topics.length,
                classesExtracted: mainClasses.length
            });
            return {
                documents,
                mainClasses,
                topics,
                crossReferences,
                mermaidMap,
                searchIndex,
                statistics
            };
        }
        catch (error) {
            this.logger.error('❌ Documentation map analysis failed:', error);
            throw error;
        }
    }
    async searchDocumentation(query, searchIndex, context) {
        // Tokenize query
        const queryTokens = this.tokenize(query.toLowerCase());
        // Find matching documents
        const scores = new Map();
        searchIndex.documents.forEach((vector, docId) => {
            let score = 0;
            // Keyword matching
            queryTokens.forEach(token => {
                if (vector.keywords.includes(token))
                    score += 2;
                if (vector.semanticTokens.includes(token))
                    score += 1;
            });
            // Context boost
            if (context && vector.keywords.includes(context.toLowerCase())) {
                score *= 1.5;
            }
            if (score > 0)
                scores.set(docId, score);
        });
        // Sort by relevance
        const sortedDocs = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([docId]) => docId);
        return sortedDocs; // Would need to map back to DocumentNode objects
    }
    async findDocumentationFiles(projectPath, excludePatterns) {
        const patterns = [
            '**/*.md',
            '**/*.MD',
            '**/docs/**/*.txt',
            '**/documentation/**/*',
            'README*',
            'CHANGELOG*',
            'CONTRIBUTING*',
            'LICENSE*'
        ];
        const exclude = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '.git/**',
            ...(excludePatterns || [])
        ];
        const files = await (0, fast_glob_1.glob)(patterns, {
            cwd: projectPath,
            ignore: exclude,
            absolute: false
        });
        return files.map(f => path.join(projectPath, f));
    }
    async analyzeDocuments(files, projectPath) {
        const documents = [];
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const stats = await fs.stat(file);
                const relativePath = path.relative(projectPath, file);
                const doc = {
                    id: this.generateDocId(relativePath),
                    path: relativePath,
                    title: this.extractTitle(content, relativePath),
                    type: this.determineDocType(relativePath, content),
                    summary: this.generateSummary(content),
                    topics: this.extractTopics(content),
                    referencedClasses: this.extractClassReferences(content),
                    relatedDocs: this.extractDocLinks(content),
                    codeExamples: this.extractCodeExamples(content),
                    wordCount: content.split(/\s+/).length,
                    lastModified: stats.mtime
                };
                documents.push(doc);
            }
            catch (error) {
                this.logger.warn(`Failed to analyze ${file}:`, error);
            }
        }
        return documents;
    }
    extractTitle(content, filepath) {
        // Try to extract from markdown header
        const headerMatch = content.match(/^#\s+(.+)$/m);
        if (headerMatch)
            return headerMatch[1];
        // Use filename as fallback
        return path.basename(filepath, path.extname(filepath))
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    determineDocType(filepath, content) {
        const filename = path.basename(filepath).toLowerCase();
        if (filename.includes('readme'))
            return 'readme';
        if (filename.includes('api'))
            return 'api';
        if (filename.includes('guide'))
            return 'guide';
        if (filename.includes('architecture') || filename.includes('design'))
            return 'architecture';
        if (filename.includes('changelog') || filename.includes('history'))
            return 'changelog';
        if (filename.includes('contributing'))
            return 'contributing';
        // Check content for clues
        if (content.includes('## API') || content.includes('# API'))
            return 'api';
        if (content.includes('## Architecture') || content.includes('# Architecture'))
            return 'architecture';
        return 'other';
    }
    generateSummary(content) {
        // Extract first paragraph or first 200 characters
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        const firstParagraph = lines[0] || '';
        if (firstParagraph.length > 200) {
            return firstParagraph.substring(0, 197) + '...';
        }
        return firstParagraph;
    }
    extractTopics(content) {
        const topics = new Set();
        // Extract from headers
        const headers = content.match(/^#{1,3}\s+(.+)$/gm) || [];
        headers.forEach((header) => {
            const topic = header.replace(/^#+\s+/, '').toLowerCase();
            if (topic.length > 2 && topic.length < 50) {
                topics.add(topic);
            }
        });
        // Look for common topic keywords
        const topicKeywords = [
            'authentication', 'authorization', 'api', 'database', 'testing',
            'deployment', 'configuration', 'security', 'performance', 'architecture',
            'installation', 'usage', 'examples', 'troubleshooting', 'migration'
        ];
        topicKeywords.forEach(keyword => {
            if (content.toLowerCase().includes(keyword)) {
                topics.add(keyword);
            }
        });
        return Array.from(topics);
    }
    extractClassReferences(content) {
        const classes = new Set();
        // Look for class/interface/component patterns
        const patterns = [
            /`([A-Z][a-zA-Z0-9]+)`/g, // Backtick references
            /\b([A-Z][a-zA-Z0-9]+(?:Service|Controller|Component|Manager|Handler|Model|View))\b/g,
            /class\s+([A-Z][a-zA-Z0-9]+)/g,
            /interface\s+([A-Z][a-zA-Z0-9]+)/g,
            /extends\s+([A-Z][a-zA-Z0-9]+)/g,
            /implements\s+([A-Z][a-zA-Z0-9]+)/g
        ];
        patterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && match[1].length > 2) {
                    classes.add(match[1]);
                }
            }
        });
        return Array.from(classes);
    }
    extractDocLinks(content) {
        const links = new Set();
        // Markdown links
        const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
        const matches = content.matchAll(linkPattern);
        for (const match of matches) {
            const link = match[2];
            if (link && !link.startsWith('http') && (link.endsWith('.md') || link.includes('doc'))) {
                links.add(link);
            }
        }
        return Array.from(links);
    }
    extractCodeExamples(content) {
        const examples = [];
        // Match code blocks
        const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
        const matches = content.matchAll(codeBlockPattern);
        let lineNumber = 1;
        const lines = content.split('\n');
        for (const match of matches) {
            const language = match[1] || 'plaintext';
            const code = match[2];
            // Find line numbers
            const startIndex = content.indexOf(match[0]);
            const lineStart = content.substring(0, startIndex).split('\n').length;
            const lineEnd = lineStart + match[0].split('\n').length - 1;
            examples.push({
                language,
                code,
                lineStart,
                lineEnd
            });
        }
        return examples;
    }
    async extractMainClasses(documents) {
        const classMap = new Map();
        // Collect all class mentions
        documents.forEach(doc => {
            doc.referencedClasses.forEach(className => {
                if (!classMap.has(className)) {
                    classMap.set(className, []);
                }
                classMap.get(className).push({
                    documentId: doc.id,
                    documentPath: doc.path,
                    context: doc.summary,
                    lineNumber: 0 // Would need proper line tracking
                });
            });
        });
        // Create summaries for frequently mentioned classes
        const summaries = [];
        classMap.forEach((mentions, className) => {
            if (mentions.length >= 2) { // Only include if mentioned in multiple docs
                summaries.push({
                    name: className,
                    mentions,
                    description: this.generateClassDescription(className, mentions),
                    category: this.categorizeClass(className)
                });
            }
        });
        return summaries.sort((a, b) => b.mentions.length - a.mentions.length);
    }
    generateClassDescription(className, mentions) {
        // Simple heuristic based on class name and mention context
        if (className.includes('Service'))
            return `Service class for ${className.replace('Service', '')} operations`;
        if (className.includes('Controller'))
            return `Controller handling ${className.replace('Controller', '')} requests`;
        if (className.includes('Component'))
            return `UI component for ${className.replace('Component', '')}`;
        if (className.includes('Model'))
            return `Data model for ${className.replace('Model', '')}`;
        return `${className} referenced in ${mentions.length} documents`;
    }
    categorizeClass(className) {
        if (className.includes('Service') || className.includes('Manager'))
            return 'core';
        if (className.includes('Util') || className.includes('Helper'))
            return 'utility';
        if (className.startsWith('I') || className.includes('Interface'))
            return 'interface';
        if (className.includes('Component') || className.includes('View'))
            return 'component';
        return 'core';
    }
    identifyTopicClusters(documents) {
        const topicMap = new Map();
        // Group documents by topics
        documents.forEach(doc => {
            doc.topics.forEach(topic => {
                if (!topicMap.has(topic)) {
                    topicMap.set(topic, new Set());
                }
                topicMap.get(topic).add(doc.id);
            });
        });
        // Create clusters
        const clusters = [];
        topicMap.forEach((docIds, topic) => {
            if (docIds.size >= 2) { // Only create cluster if multiple docs share topic
                clusters.push({
                    topic,
                    documents: Array.from(docIds),
                    keywords: this.extractTopicKeywords(topic),
                    importance: this.assessTopicImportance(docIds.size, documents.length)
                });
            }
        });
        return clusters.sort((a, b) => b.documents.length - a.documents.length);
    }
    extractTopicKeywords(topic) {
        // Simple keyword extraction from topic
        return topic.split(/[\s-_]+/)
            .filter(word => word.length > 2)
            .map(word => word.toLowerCase());
    }
    assessTopicImportance(docCount, totalDocs) {
        const ratio = docCount / totalDocs;
        if (ratio > 0.5)
            return 'high';
        if (ratio > 0.2)
            return 'medium';
        return 'low';
    }
    findCrossReferences(documents) {
        const references = [];
        documents.forEach(doc => {
            // Find links to other docs
            doc.relatedDocs.forEach(relatedPath => {
                const targetDoc = documents.find(d => d.path.includes(relatedPath) ||
                    relatedPath.includes(path.basename(d.path)));
                if (targetDoc) {
                    references.push({
                        from: doc.id,
                        to: targetDoc.id,
                        type: 'links'
                    });
                }
            });
            // Find class mentions
            doc.referencedClasses.forEach(className => {
                documents.forEach(otherDoc => {
                    if (otherDoc.id !== doc.id && otherDoc.referencedClasses.includes(className)) {
                        references.push({
                            from: doc.id,
                            to: otherDoc.id,
                            type: 'mentions',
                            context: `Both reference ${className}`
                        });
                    }
                });
            });
        });
        // Deduplicate
        const seen = new Set();
        return references.filter(ref => {
            const key = `${ref.from}-${ref.to}-${ref.type}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    buildSearchIndex(documents, topics, classes) {
        const documentVectors = new Map();
        const topicIndex = new Map();
        const classIndex = new Map();
        // Build document vectors
        documents.forEach(doc => {
            const keywords = [
                ...this.tokenize(doc.title),
                ...doc.topics.flatMap(t => this.tokenize(t)),
                ...doc.referencedClasses.map(c => c.toLowerCase())
            ];
            const semanticTokens = this.tokenize(doc.summary);
            documentVectors.set(doc.id, {
                documentId: doc.id,
                keywords: [...new Set(keywords)],
                semanticTokens: [...new Set(semanticTokens)]
            });
        });
        // Build topic index
        topics.forEach(cluster => {
            topicIndex.set(cluster.topic, cluster.documents);
        });
        // Build class index
        classes.forEach(cls => {
            classIndex.set(cls.name, cls.mentions.map(m => m.documentId));
        });
        return {
            documents: documentVectors,
            topics: topicIndex,
            classes: classIndex
        };
    }
    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 2);
    }
    generateMermaidMap(documents, crossReferences, topics) {
        const lines = ['graph TD'];
        // Add document nodes with styling based on type
        documents.forEach(doc => {
            const label = `${doc.title}<br/><i>${doc.type}</i>`;
            const shape = doc.type === 'readme' ? '((' : doc.type === 'api' ? '{{' : '[';
            const endShape = doc.type === 'readme' ? '))' : doc.type === 'api' ? '}}' : ']';
            lines.push(`    ${doc.id}${shape}"${label}"${endShape}`);
        });
        // Add cross-reference edges
        crossReferences.slice(0, 20).forEach(ref => {
            const style = ref.type === 'links' ? '-->' : '-..->';
            const label = ref.context ? `: ${ref.context.substring(0, 20)}` : '';
            lines.push(`    ${ref.from} ${style} ${ref.to}${label}`);
        });
        // Add topic subgraphs for high-importance topics
        topics.filter(t => t.importance === 'high').forEach(topic => {
            lines.push(`    subgraph ${topic.topic.replace(/\s+/g, '_')}`);
            lines.push(`        direction TB`);
            topic.documents.forEach(docId => {
                lines.push(`        ${docId}`);
            });
            lines.push(`    end`);
        });
        // Add styling
        lines.push('    classDef readme fill:#e1f5fe,stroke:#01579b,stroke-width:2px');
        lines.push('    classDef api fill:#f3e5f5,stroke:#4a148c,stroke-width:2px');
        lines.push('    classDef guide fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px');
        documents.forEach(doc => {
            if (doc.type === 'readme')
                lines.push(`    class ${doc.id} readme`);
            if (doc.type === 'api')
                lines.push(`    class ${doc.id} api`);
            if (doc.type === 'guide')
                lines.push(`    class ${doc.id} guide`);
        });
        return lines.join('\n');
    }
    calculateStatistics(documents, topics) {
        const typeCount = {};
        let totalWords = 0;
        let codeExamples = 0;
        documents.forEach(doc => {
            typeCount[doc.type] = (typeCount[doc.type] || 0) + 1;
            totalWords += doc.wordCount;
            codeExamples += doc.codeExamples.length;
        });
        return {
            totalDocuments: documents.length,
            totalWords,
            documentTypes: typeCount,
            averageWordCount: Math.round(totalWords / documents.length),
            topicCoverage: topics.length,
            codeExampleCount: codeExamples
        };
    }
    generateDocId(filepath) {
        return filepath
            .replace(/[\/\\]/g, '_')
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9_]/g, '_');
    }
}
exports.DocumentMapAnalyzer = DocumentMapAnalyzer;
exports.default = DocumentMapAnalyzer;
//# sourceMappingURL=map-analyzer.js.map