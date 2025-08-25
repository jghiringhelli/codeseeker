"use strict";
// Advanced Knowledge Repository with Hybrid Semantic Search
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
exports.KnowledgeRepository = exports.KnowledgeSource = exports.KnowledgeType = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
var KnowledgeType;
(function (KnowledgeType) {
    KnowledgeType["COMMON_PRACTICE"] = "COMMON_PRACTICE";
    KnowledgeType["PROFESSIONAL_ADVICE"] = "PROFESSIONAL_ADVICE";
    KnowledgeType["RESEARCH_PAPER"] = "RESEARCH_PAPER";
    KnowledgeType["EXPERIMENTAL"] = "EXPERIMENTAL";
    KnowledgeType["BEST_PRACTICE"] = "BEST_PRACTICE";
    KnowledgeType["ANTI_PATTERN"] = "ANTI_PATTERN";
    KnowledgeType["CASE_STUDY"] = "CASE_STUDY";
    KnowledgeType["TUTORIAL"] = "TUTORIAL";
    KnowledgeType["API_DOCUMENTATION"] = "API_DOCUMENTATION";
    KnowledgeType["ARCHITECTURE_PATTERN"] = "ARCHITECTURE_PATTERN";
})(KnowledgeType || (exports.KnowledgeType = KnowledgeType = {}));
var KnowledgeSource;
(function (KnowledgeSource) {
    KnowledgeSource["STACKOVERFLOW"] = "STACKOVERFLOW";
    KnowledgeSource["GITHUB"] = "GITHUB";
    KnowledgeSource["ARXIV"] = "ARXIV";
    KnowledgeSource["MEDIUM"] = "MEDIUM";
    KnowledgeSource["DOCUMENTATION"] = "DOCUMENTATION";
    KnowledgeSource["RESEARCH_GATE"] = "RESEARCH_GATE";
    KnowledgeSource["IEEE"] = "IEEE";
    KnowledgeSource["ACM"] = "ACM";
    KnowledgeSource["INTERNAL"] = "INTERNAL";
    KnowledgeSource["COMMUNITY"] = "COMMUNITY";
})(KnowledgeSource || (exports.KnowledgeSource = KnowledgeSource = {}));
class KnowledgeRepository extends events_1.EventEmitter {
    logger;
    documents = new Map();
    invertedIndex = new Map(); // term -> doc IDs
    vectorIndex = new Map(); // doc ID -> vector
    semanticCache = new Map();
    apiEndpoints = new Map();
    knowledgeBasePath;
    constructor(logger, basePath = './knowledge-base') {
        super();
        this.logger = logger;
        this.knowledgeBasePath = basePath;
        this.initializeAPIEndpoints();
        this.loadKnowledgeBase();
    }
    initializeAPIEndpoints() {
        // Define API endpoints for different knowledge sources
        this.apiEndpoints.set(KnowledgeSource.STACKOVERFLOW, {
            baseUrl: 'https://api.stackexchange.com/2.3',
            rateLimit: 30,
            authRequired: false,
            searchEndpoint: '/search/advanced',
            params: { site: 'stackoverflow', order: 'desc', sort: 'relevance' }
        });
        this.apiEndpoints.set(KnowledgeSource.GITHUB, {
            baseUrl: 'https://api.github.com',
            rateLimit: 60,
            authRequired: true,
            searchEndpoint: '/search/code',
            params: { sort: 'indexed', order: 'desc' }
        });
        this.apiEndpoints.set(KnowledgeSource.ARXIV, {
            baseUrl: 'http://export.arxiv.org/api',
            rateLimit: 10,
            authRequired: false,
            searchEndpoint: '/query',
            params: { sortBy: 'relevance', sortOrder: 'descending' }
        });
        // Add more endpoints...
    }
    async searchKnowledge(query, options = {}) {
        const { types = Object.values(KnowledgeType), sources = Object.values(KnowledgeSource), minQuality = 0.7, limit = 10, useHybrid = true } = options;
        this.logger.info(`Searching knowledge: "${query}" with hybrid=${useHybrid}`);
        // Check cache first
        const cacheKey = this.generateCacheKey(query, options);
        if (this.semanticCache.has(cacheKey)) {
            this.logger.info('Returning cached search results');
            return this.semanticCache.get(cacheKey);
        }
        let results = [];
        if (useHybrid) {
            // Hybrid search: combine keyword and semantic search
            const [keywordResults, semanticResults] = await Promise.all([
                this.keywordSearch(query, types, sources, minQuality),
                this.semanticSearch(query, types, sources, minQuality)
            ]);
            // Merge and re-rank results
            results = this.mergeAndRerankResults(keywordResults, semanticResults);
        }
        else {
            // Keyword-only search
            results = await this.keywordSearch(query, types, sources, minQuality);
        }
        // Apply limit
        results = results.slice(0, limit);
        // Cache results
        this.semanticCache.set(cacheKey, results);
        // Update access statistics
        results.forEach(result => {
            result.document.lastAccessed = new Date();
            result.document.accessCount++;
        });
        return results;
    }
    async keywordSearch(query, types, sources, minQuality) {
        const terms = this.tokenize(query.toLowerCase());
        const docScores = new Map();
        // Search inverted index
        for (const term of terms) {
            const docIds = this.invertedIndex.get(term);
            if (docIds) {
                for (const docId of docIds) {
                    const doc = this.documents.get(docId);
                    if (!doc)
                        continue;
                    // Check filters
                    if (!types.includes(doc.type))
                        continue;
                    if (!sources.includes(doc.source))
                        continue;
                    if (this.calculateQualityScore(doc.metadata.quality) < minQuality)
                        continue;
                    // Calculate TF-IDF score
                    const tfidf = this.calculateTFIDF(term, doc);
                    docScores.set(docId, (docScores.get(docId) || 0) + tfidf);
                }
            }
        }
        // Convert to search results
        const results = [];
        for (const [docId, score] of docScores) {
            const doc = this.documents.get(docId);
            results.push({
                document: doc,
                score,
                matchType: 'exact',
                highlights: this.generateHighlights(doc, terms),
                explanation: `Keyword match: ${terms.join(', ')}`
            });
        }
        return results.sort((a, b) => b.score - a.score);
    }
    async semanticSearch(query, types, sources, minQuality) {
        // Generate query vector
        const queryVector = await this.generateVector(query);
        const results = [];
        // Calculate cosine similarity with all documents
        for (const [docId, doc] of this.documents) {
            // Check filters
            if (!types.includes(doc.type))
                continue;
            if (!sources.includes(doc.source))
                continue;
            if (this.calculateQualityScore(doc.metadata.quality) < minQuality)
                continue;
            const docVector = this.vectorIndex.get(docId);
            if (!docVector)
                continue;
            const similarity = this.cosineSimilarity(queryVector, docVector);
            if (similarity > 0.5) { // Threshold for semantic relevance
                results.push({
                    document: doc,
                    score: similarity,
                    matchType: 'semantic',
                    highlights: this.generateSemanticHighlights(doc, query),
                    explanation: `Semantic similarity: ${(similarity * 100).toFixed(1)}%`
                });
            }
        }
        return results.sort((a, b) => b.score - a.score);
    }
    mergeAndRerankResults(keywordResults, semanticResults) {
        const merged = new Map();
        // Add keyword results with weight
        for (const result of keywordResults) {
            const id = result.document.id;
            merged.set(id, {
                ...result,
                score: result.score * 0.6, // Keyword weight
                matchType: 'hybrid'
            });
        }
        // Merge semantic results
        for (const result of semanticResults) {
            const id = result.document.id;
            if (merged.has(id)) {
                // Document appears in both - boost score
                const existing = merged.get(id);
                existing.score += result.score * 0.4; // Semantic weight
                existing.explanation = 'Hybrid match: keyword + semantic';
            }
            else {
                merged.set(id, {
                    ...result,
                    score: result.score * 0.4,
                    matchType: 'hybrid'
                });
            }
        }
        // Apply quality boost
        for (const result of merged.values()) {
            const qualityScore = this.calculateQualityScore(result.document.metadata.quality);
            result.score *= (1 + qualityScore * 0.2); // Quality boost up to 20%
        }
        return Array.from(merged.values()).sort((a, b) => b.score - a.score);
    }
    async fetchExternalKnowledge(query, source) {
        const endpoint = this.apiEndpoints.get(source);
        if (!endpoint) {
            this.logger.warn(`No endpoint configured for source: ${source}`);
            return [];
        }
        try {
            this.logger.info(`Fetching external knowledge from ${source}: "${query}"`);
            // Simulate API call (would be actual HTTP request in production)
            const results = await this.simulateAPICall(query, source, endpoint);
            // Convert to knowledge documents
            const documents = [];
            for (const result of results) {
                const doc = await this.createKnowledgeDocument(result, source);
                documents.push(doc);
                // Store in repository
                this.addDocument(doc);
            }
            return documents;
        }
        catch (error) {
            this.logger.error(`Failed to fetch from ${source}`, error);
            return [];
        }
    }
    async generateRAGContext(query, roleType) {
        // Search for relevant documents
        const searchResults = await this.searchKnowledge(query, {
            useHybrid: true,
            limit: 5
        });
        const relevantDocuments = searchResults.map(r => r.document);
        // Synthesize knowledge from documents
        const synthesized = this.synthesizeKnowledge(relevantDocuments, query);
        // Calculate confidence based on quality and relevance
        const confidence = this.calculateConfidence(searchResults);
        // Extract sources
        const sources = relevantDocuments.map(doc => `${doc.source}: ${doc.title} (${doc.metadata.author || 'Unknown'})`);
        const context = {
            query,
            relevantDocuments,
            synthesizedKnowledge: synthesized,
            confidence,
            sources
        };
        this.logger.info(`Generated RAG context with ${relevantDocuments.length} documents, confidence: ${(confidence * 100).toFixed(1)}%`);
        return context;
    }
    synthesizeKnowledge(documents, query) {
        if (documents.length === 0) {
            return 'No relevant knowledge found for the query.';
        }
        // Group by knowledge type
        const byType = new Map();
        for (const doc of documents) {
            if (!byType.has(doc.type)) {
                byType.set(doc.type, []);
            }
            byType.get(doc.type).push(doc);
        }
        let synthesis = `Based on ${documents.length} relevant sources:\n\n`;
        // Synthesize best practices
        const bestPractices = byType.get(KnowledgeType.BEST_PRACTICE);
        if (bestPractices && bestPractices.length > 0) {
            synthesis += '**Best Practices:**\n';
            bestPractices.forEach(doc => {
                synthesis += `- ${this.extractKeyPoint(doc.content)}\n`;
            });
            synthesis += '\n';
        }
        // Synthesize professional advice
        const professional = byType.get(KnowledgeType.PROFESSIONAL_ADVICE);
        if (professional && professional.length > 0) {
            synthesis += '**Professional Recommendations:**\n';
            professional.forEach(doc => {
                synthesis += `- ${this.extractKeyPoint(doc.content)}\n`;
            });
            synthesis += '\n';
        }
        // Synthesize research findings
        const research = byType.get(KnowledgeType.RESEARCH_PAPER);
        if (research && research.length > 0) {
            synthesis += '**Research Findings:**\n';
            research.forEach(doc => {
                synthesis += `- ${this.extractKeyPoint(doc.content)} (${doc.metadata.author}, ${doc.metadata.publishedDate?.getFullYear() || 'n.d.'})\n`;
            });
            synthesis += '\n';
        }
        // Add warnings about anti-patterns
        const antiPatterns = byType.get(KnowledgeType.ANTI_PATTERN);
        if (antiPatterns && antiPatterns.length > 0) {
            synthesis += '**Avoid These Anti-Patterns:**\n';
            antiPatterns.forEach(doc => {
                synthesis += `- ${this.extractKeyPoint(doc.content)}\n`;
            });
        }
        return synthesis;
    }
    async createKnowledgeDocument(rawData, source) {
        const doc = {
            id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: this.inferKnowledgeType(rawData, source),
            title: rawData.title || 'Untitled',
            content: rawData.content || rawData.body || rawData.abstract || '',
            source,
            metadata: {
                author: rawData.author || rawData.owner || undefined,
                publishedDate: rawData.publishedDate ? new Date(rawData.publishedDate) : undefined,
                citations: rawData.citations || 0,
                quality: this.assessQuality(rawData, source),
                tags: rawData.tags || [],
                language: rawData.language || 'en',
                framework: rawData.framework,
                version: rawData.version,
                dependencies: rawData.dependencies || []
            },
            vector: await this.generateVector(rawData.content || ''),
            invertedIndex: this.buildInvertedIndex(rawData.content || ''),
            semanticHash: this.generateSemanticHash(rawData),
            relevanceScore: 0.5, // Initial neutral score
            createdAt: new Date(),
            lastAccessed: new Date(),
            accessCount: 0
        };
        return doc;
    }
    inferKnowledgeType(data, source) {
        // Infer knowledge type based on source and content
        if (source === KnowledgeSource.ARXIV || source === KnowledgeSource.IEEE) {
            return KnowledgeType.RESEARCH_PAPER;
        }
        if (source === KnowledgeSource.STACKOVERFLOW) {
            if (data.score > 100)
                return KnowledgeType.BEST_PRACTICE;
            if (data.score < 0)
                return KnowledgeType.ANTI_PATTERN;
            return KnowledgeType.COMMON_PRACTICE;
        }
        if (source === KnowledgeSource.DOCUMENTATION) {
            return KnowledgeType.API_DOCUMENTATION;
        }
        // Analyze content for patterns
        const content = (data.content || '').toLowerCase();
        if (content.includes('best practice'))
            return KnowledgeType.BEST_PRACTICE;
        if (content.includes('anti-pattern') || content.includes('avoid'))
            return KnowledgeType.ANTI_PATTERN;
        if (content.includes('case study'))
            return KnowledgeType.CASE_STUDY;
        if (content.includes('tutorial'))
            return KnowledgeType.TUTORIAL;
        if (content.includes('experimental'))
            return KnowledgeType.EXPERIMENTAL;
        return KnowledgeType.COMMON_PRACTICE;
    }
    assessQuality(data, source) {
        // Assess quality based on various factors
        const now = new Date();
        const publishedDate = data.publishedDate ? new Date(data.publishedDate) : now;
        const ageInDays = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        return {
            reliability: this.calculateReliability(data, source),
            relevance: 0.5, // Will be updated based on usage
            recency: Math.max(0, 1 - ageInDays / 365), // Decay over a year
            authority: this.calculateAuthority(data, source),
            completeness: this.calculateCompleteness(data)
        };
    }
    calculateReliability(data, source) {
        // Source-based reliability
        const sourceReliability = {
            [KnowledgeSource.DOCUMENTATION]: 0.95,
            [KnowledgeSource.IEEE]: 0.90,
            [KnowledgeSource.ACM]: 0.90,
            [KnowledgeSource.ARXIV]: 0.85,
            [KnowledgeSource.RESEARCH_GATE]: 0.80,
            [KnowledgeSource.STACKOVERFLOW]: 0.70,
            [KnowledgeSource.GITHUB]: 0.75,
            [KnowledgeSource.MEDIUM]: 0.60,
            [KnowledgeSource.COMMUNITY]: 0.50,
            [KnowledgeSource.INTERNAL]: 1.0
        };
        let reliability = sourceReliability[source] || 0.5;
        // Adjust based on metrics
        if (data.score)
            reliability += Math.min(0.2, data.score / 1000);
        if (data.verified)
            reliability += 0.1;
        return Math.min(1, reliability);
    }
    calculateAuthority(data, source) {
        let authority = 0.5;
        // Check author reputation
        if (data.author_reputation > 10000)
            authority += 0.3;
        else if (data.author_reputation > 1000)
            authority += 0.2;
        else if (data.author_reputation > 100)
            authority += 0.1;
        // Check citations
        if (data.citations > 100)
            authority += 0.2;
        else if (data.citations > 10)
            authority += 0.1;
        // Official documentation has high authority
        if (source === KnowledgeSource.DOCUMENTATION)
            authority = 0.95;
        return Math.min(1, authority);
    }
    calculateCompleteness(data) {
        let completeness = 0;
        // Check for various components
        if (data.content && data.content.length > 500)
            completeness += 0.3;
        if (data.code_samples)
            completeness += 0.2;
        if (data.examples)
            completeness += 0.2;
        if (data.references)
            completeness += 0.1;
        if (data.diagrams || data.images)
            completeness += 0.1;
        if (data.test_cases)
            completeness += 0.1;
        return Math.min(1, completeness);
    }
    // Helper methods
    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length > 2);
    }
    buildInvertedIndex(content) {
        const index = new Map();
        const tokens = this.tokenize(content);
        tokens.forEach((token, position) => {
            if (!index.has(token)) {
                index.set(token, []);
            }
            index.get(token).push(position);
        });
        return index;
    }
    calculateTFIDF(term, doc) {
        // Calculate Term Frequency
        const termPositions = doc.invertedIndex.get(term) || [];
        const tf = termPositions.length / doc.invertedIndex.size;
        // Calculate Inverse Document Frequency
        const docsWithTerm = this.invertedIndex.get(term)?.size || 1;
        const idf = Math.log(this.documents.size / docsWithTerm);
        return tf * idf;
    }
    async generateVector(text) {
        // Simplified vector generation
        // In production, use proper embedding model
        const vector = new Float32Array(384); // Smaller than typical 768 for efficiency
        const tokens = this.tokenize(text);
        tokens.forEach((token, i) => {
            const hash = token.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            vector[i % 384] += Math.sin(hash) / tokens.length;
        });
        // Normalize
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < vector.length; i++) {
                vector[i] /= magnitude;
            }
        }
        return vector;
    }
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
        }
        return dotProduct; // Assuming normalized vectors
    }
    generateHighlights(doc, terms) {
        const highlights = [];
        const sentences = doc.content.split(/[.!?]+/);
        for (const sentence of sentences) {
            const sentenceLower = sentence.toLowerCase();
            if (terms.some(term => sentenceLower.includes(term))) {
                highlights.push(sentence.trim());
                if (highlights.length >= 3)
                    break;
            }
        }
        return highlights;
    }
    generateSemanticHighlights(doc, query) {
        // Extract most relevant sentences based on semantic similarity
        const sentences = doc.content.split(/[.!?]+/).slice(0, 10);
        return sentences.slice(0, 3).map(s => s.trim());
    }
    calculateQualityScore(metrics) {
        return (metrics.reliability * 0.3 +
            metrics.relevance * 0.25 +
            metrics.recency * 0.15 +
            metrics.authority * 0.2 +
            metrics.completeness * 0.1);
    }
    calculateConfidence(results) {
        if (results.length === 0)
            return 0;
        // Average of top 3 results' scores and quality
        const topResults = results.slice(0, 3);
        const avgScore = topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length;
        const avgQuality = topResults.reduce((sum, r) => sum + this.calculateQualityScore(r.document.metadata.quality), 0) / topResults.length;
        return (avgScore * 0.6 + avgQuality * 0.4);
    }
    generateCacheKey(query, options) {
        return `${query}-${JSON.stringify(options)}`;
    }
    generateSemanticHash(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    extractKeyPoint(content) {
        // Extract first meaningful sentence
        const sentences = content.split(/[.!?]+/);
        return sentences[0]?.trim() || content.substring(0, 100) + '...';
    }
    async simulateAPICall(query, source, endpoint) {
        // Simulate API response
        await new Promise(resolve => setTimeout(resolve, 100));
        return [
            {
                title: `${source} Result: ${query}`,
                content: `Knowledge about ${query} from ${source}`,
                author: 'Expert',
                score: Math.random() * 100,
                publishedDate: new Date().toISOString(),
                tags: ['example', 'simulated']
            }
        ];
    }
    async loadKnowledgeBase() {
        try {
            // Load persisted knowledge base
            const files = await fs.readdir(this.knowledgeBasePath).catch(() => []);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readFile(path.join(this.knowledgeBasePath, file), 'utf-8');
                    const doc = JSON.parse(content);
                    // Restore Float32Array from array
                    if (doc.vector) {
                        doc.vector = new Float32Array(doc.vector);
                    }
                    this.addDocument(doc);
                }
            }
            this.logger.info(`Loaded ${this.documents.size} knowledge documents`);
        }
        catch (error) {
            this.logger.error('Failed to load knowledge base', error);
        }
    }
    addDocument(doc) {
        this.documents.set(doc.id, doc);
        // Update inverted index
        const terms = this.tokenize(doc.content);
        for (const term of terms) {
            if (!this.invertedIndex.has(term)) {
                this.invertedIndex.set(term, new Set());
            }
            this.invertedIndex.get(term).add(doc.id);
        }
        // Update vector index
        this.vectorIndex.set(doc.id, doc.vector);
    }
    // Public API
    async getDocument(id) {
        return this.documents.get(id) || null;
    }
    async saveKnowledgeBase() {
        try {
            await fs.mkdir(this.knowledgeBasePath, { recursive: true });
            for (const [id, doc] of this.documents) {
                const docToSave = {
                    ...doc,
                    vector: Array.from(doc.vector) // Convert Float32Array to regular array
                };
                await fs.writeFile(path.join(this.knowledgeBasePath, `${id}.json`), JSON.stringify(docToSave, null, 2));
            }
            this.logger.info(`Saved ${this.documents.size} knowledge documents`);
        }
        catch (error) {
            this.logger.error('Failed to save knowledge base', error);
        }
    }
}
exports.KnowledgeRepository = KnowledgeRepository;
//# sourceMappingURL=knowledge-repository.js.map