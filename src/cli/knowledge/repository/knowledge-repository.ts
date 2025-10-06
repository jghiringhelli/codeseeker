// Advanced Knowledge Repository with Hybrid Semantic Search

import { EventEmitter } from 'events';
import { Logger } from '../../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface KnowledgeDocument {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  source: KnowledgeSource;
  metadata: DocumentMetadata;
  vector: Float32Array;
  invertedIndex: Map<string, number[]>; // term -> [positions]
  semanticHash: string;
  relevanceScore: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

export enum KnowledgeType {
  COMMON_PRACTICE = 'COMMON_PRACTICE',
  PROFESSIONAL_ADVICE = 'PROFESSIONAL_ADVICE',
  RESEARCH_PAPER = 'RESEARCH_PAPER',
  EXPERIMENTAL = 'EXPERIMENTAL',
  BEST_PRACTICE = 'BEST_PRACTICE',
  ANTI_PATTERN = 'ANTI_PATTERN',
  CASE_STUDY = 'CASE_STUDY',
  TUTORIAL = 'TUTORIAL',
  API_DOCUMENTATION = 'API_DOCUMENTATION',
  ARCHITECTURE_PATTERN = 'ARCHITECTURE_PATTERN'
}

export enum KnowledgeSource {
  STACKOVERFLOW = 'STACKOVERFLOW',
  GITHUB = 'GITHUB',
  ARXIV = 'ARXIV',
  MEDIUM = 'MEDIUM',
  DOCUMENTATION = 'DOCUMENTATION',
  RESEARCH_GATE = 'RESEARCH_GATE',
  IEEE = 'IEEE',
  ACM = 'ACM',
  INTERNAL = 'INTERNAL',
  COMMUNITY = 'COMMUNITY'
}

export interface DocumentMetadata {
  author?: string;
  publishedDate?: Date;
  citations?: number;
  quality: QualityMetrics;
  tags: string[];
  language: string;
  framework?: string;
  version?: string;
  dependencies?: string[];
}

export interface QualityMetrics {
  reliability: number; // 0-1
  relevance: number; // 0-1
  recency: number; // 0-1
  authority: number; // 0-1
  completeness: number; // 0-1
}

export interface SearchResult {
  document: KnowledgeDocument;
  score: number;
  matchType: 'exact' | 'semantic' | 'fuzzy' | 'hybrid';
  highlights: string[];
  explanation: string;
}

export interface RAGContext {
  query: string;
  relevantDocuments: KnowledgeDocument[];
  synthesizedKnowledge: string;
  confidence: number;
  sources: string[];
}

export class KnowledgeRepository extends EventEmitter {
  private logger: Logger;
  private documents: Map<string, KnowledgeDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // term -> doc IDs
  private vectorIndex: Map<string, Float32Array> = new Map(); // doc ID -> vector
  private semanticCache: Map<string, SearchResult[]> = new Map();
  private apiEndpoints: Map<KnowledgeSource, APIEndpoint> = new Map();
  private knowledgeBasePath: string;

  constructor(logger: Logger, basePath: string = './knowledge-base') {
    super();
    this.logger = logger;
    this.knowledgeBasePath = basePath;
    this.initializeAPIEndpoints();
    this.loadKnowledgeBase();
  }

  private initializeAPIEndpoints(): void {
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

  async searchKnowledge(
    query: string,
    options: {
      types?: KnowledgeType[];
      sources?: KnowledgeSource[];
      minQuality?: number;
      limit?: number;
      useHybrid?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      types = Object.values(KnowledgeType),
      sources = Object.values(KnowledgeSource),
      minQuality = 0.7,
      limit = 10,
      useHybrid = true
    } = options;

    this.logger.info(`Searching knowledge: "${query}" with hybrid=${useHybrid}`);

    // Check cache first
    const cacheKey = this.generateCacheKey(query, options);
    if (this.semanticCache.has(cacheKey)) {
      this.logger.info('Returning cached search results');
      return this.semanticCache.get(cacheKey)!;
    }

    let results: SearchResult[] = [];

    if (useHybrid) {
      // Hybrid search: combine keyword and semantic search
      const [keywordResults, semanticResults] = await Promise.all([
        this.keywordSearch(query, types, sources, minQuality),
        this.semanticSearch(query, types, sources, minQuality)
      ]);

      // Merge and re-rank results
      results = this.mergeAndRerankResults(keywordResults, semanticResults);
    } else {
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

  private async keywordSearch(
    query: string,
    types: KnowledgeType[],
    sources: KnowledgeSource[],
    minQuality: number
  ): Promise<SearchResult[]> {
    const terms = this.tokenize(query.toLowerCase());
    const docScores = new Map<string, number>();

    // Search inverted index
    for (const term of terms) {
      const docIds = this.invertedIndex.get(term);
      if (docIds) {
        for (const docId of docIds) {
          const doc = this.documents.get(docId);
          if (!doc) continue;

          // Check filters
          if (!types.includes(doc.type)) continue;
          if (!sources.includes(doc.source)) continue;
          if (this.calculateQualityScore(doc.metadata.quality) < minQuality) continue;

          // Calculate TF-IDF score
          const tfidf = this.calculateTFIDF(term, doc);
          docScores.set(docId, (docScores.get(docId) || 0) + tfidf);
        }
      }
    }

    // Convert to search results
    const results: SearchResult[] = [];
    for (const [docId, score] of docScores) {
      const doc = this.documents.get(docId)!;
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

  private async semanticSearch(
    query: string,
    types: KnowledgeType[],
    sources: KnowledgeSource[],
    minQuality: number
  ): Promise<SearchResult[]> {
    // Generate query vector
    const queryVector = await this.generateVector(query);
    const results: SearchResult[] = [];

    // Calculate cosine similarity with all documents
    for (const [docId, doc] of this.documents) {
      // Check filters
      if (!types.includes(doc.type)) continue;
      if (!sources.includes(doc.source)) continue;
      if (this.calculateQualityScore(doc.metadata.quality) < minQuality) continue;

      const docVector = this.vectorIndex.get(docId);
      if (!docVector) continue;

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

  private mergeAndRerankResults(
    keywordResults: SearchResult[],
    semanticResults: SearchResult[]
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();
    
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
        const existing = merged.get(id)!;
        existing.score += result.score * 0.4; // Semantic weight
        existing.explanation = 'Hybrid match: keyword + semantic';
      } else {
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

  async fetchExternalKnowledge(
    query: string,
    source: KnowledgeSource
  ): Promise<KnowledgeDocument[]> {
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
      const documents: KnowledgeDocument[] = [];
      for (const result of results) {
        const doc = await this.createKnowledgeDocument(result, source);
        documents.push(doc);
        
        // Store in repository
        this.addDocument(doc);
      }

      return documents;
    } catch (error) {
      this.logger.error(`Failed to fetch from ${source}`, error);
      return [];
    }
  }

  async generateRAGContext(query: string, roleType?: string): Promise<RAGContext> {
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
    const sources = relevantDocuments.map(doc => 
      `${doc.source}: ${doc.title} (${doc.metadata.author || 'Unknown'})`
    );

    const context: RAGContext = {
      query,
      relevantDocuments,
      synthesizedKnowledge: synthesized,
      confidence,
      sources
    };

    this.logger.info(`Generated RAG context with ${relevantDocuments.length} documents, confidence: ${(confidence * 100).toFixed(1)}%`);
    
    return context;
  }

  private synthesizeKnowledge(documents: KnowledgeDocument[], query: string): string {
    if (documents.length === 0) {
      return 'No relevant knowledge found for the query.';
    }

    // Group by knowledge type
    const byType = new Map<KnowledgeType, KnowledgeDocument[]>();
    for (const doc of documents) {
      if (!byType.has(doc.type)) {
        byType.set(doc.type, []);
      }
      byType.get(doc.type)!.push(doc);
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

  private async createKnowledgeDocument(
    rawData: any,
    source: KnowledgeSource
  ): Promise<KnowledgeDocument> {
    const doc: KnowledgeDocument = {
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

  private inferKnowledgeType(data: any, source: KnowledgeSource): KnowledgeType {
    // Infer knowledge type based on source and content
    if (source === KnowledgeSource.ARXIV || source === KnowledgeSource.IEEE) {
      return KnowledgeType.RESEARCH_PAPER;
    }
    if (source === KnowledgeSource.STACKOVERFLOW) {
      if (data.score > 100) return KnowledgeType.BEST_PRACTICE;
      if (data.score < 0) return KnowledgeType.ANTI_PATTERN;
      return KnowledgeType.COMMON_PRACTICE;
    }
    if (source === KnowledgeSource.DOCUMENTATION) {
      return KnowledgeType.API_DOCUMENTATION;
    }
    
    // Analyze content for patterns
    const content = (data.content || '').toLowerCase();
    if (content.includes('best practice')) return KnowledgeType.BEST_PRACTICE;
    if (content.includes('anti-pattern') || content.includes('avoid')) return KnowledgeType.ANTI_PATTERN;
    if (content.includes('case study')) return KnowledgeType.CASE_STUDY;
    if (content.includes('tutorial')) return KnowledgeType.TUTORIAL;
    if (content.includes('experimental')) return KnowledgeType.EXPERIMENTAL;
    
    return KnowledgeType.COMMON_PRACTICE;
  }

  private assessQuality(data: any, source: KnowledgeSource): QualityMetrics {
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

  private calculateReliability(data: any, source: KnowledgeSource): number {
    // Source-based reliability
    const sourceReliability: Record<KnowledgeSource, number> = {
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
    if (data.score) reliability += Math.min(0.2, data.score / 1000);
    if (data.verified) reliability += 0.1;
    
    return Math.min(1, reliability);
  }

  private calculateAuthority(data: any, source: KnowledgeSource): number {
    let authority = 0.5;
    
    // Check author reputation
    if (data.author_reputation > 10000) authority += 0.3;
    else if (data.author_reputation > 1000) authority += 0.2;
    else if (data.author_reputation > 100) authority += 0.1;
    
    // Check citations
    if (data.citations > 100) authority += 0.2;
    else if (data.citations > 10) authority += 0.1;
    
    // Official documentation has high authority
    if (source === KnowledgeSource.DOCUMENTATION) authority = 0.95;
    
    return Math.min(1, authority);
  }

  private calculateCompleteness(data: any): number {
    let completeness = 0;
    
    // Check for various components
    if (data.content && data.content.length > 500) completeness += 0.3;
    if (data.code_samples) completeness += 0.2;
    if (data.examples) completeness += 0.2;
    if (data.references) completeness += 0.1;
    if (data.diagrams || data.images) completeness += 0.1;
    if (data.test_cases) completeness += 0.1;
    
    return Math.min(1, completeness);
  }

  // Helper methods
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2);
  }

  private buildInvertedIndex(content: string): Map<string, number[]> {
    const index = new Map<string, number[]>();
    const tokens = this.tokenize(content);
    
    tokens.forEach((token, position) => {
      if (!index.has(token)) {
        index.set(token, []);
      }
      index.get(token)!.push(position);
    });
    
    return index;
  }

  private calculateTFIDF(term: string, doc: KnowledgeDocument): number {
    // Calculate Term Frequency
    const termPositions = doc.invertedIndex.get(term) || [];
    const tf = termPositions.length / doc.invertedIndex.size;
    
    // Calculate Inverse Document Frequency
    const docsWithTerm = this.invertedIndex.get(term)?.size || 1;
    const idf = Math.log(this.documents.size / docsWithTerm);
    
    return tf * idf;
  }

  private async generateVector(text: string): Promise<Float32Array> {
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

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    return dotProduct; // Assuming normalized vectors
  }

  private generateHighlights(doc: KnowledgeDocument, terms: string[]): string[] {
    const highlights: string[] = [];
    const sentences = doc.content.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      if (terms.some(term => sentenceLower.includes(term))) {
        highlights.push(sentence.trim());
        if (highlights.length >= 3) break;
      }
    }
    
    return highlights;
  }

  private generateSemanticHighlights(doc: KnowledgeDocument, query: string): string[] {
    // Extract most relevant sentences based on semantic similarity
    const sentences = doc.content.split(/[.!?]+/).slice(0, 10);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  private calculateQualityScore(metrics: QualityMetrics): number {
    return (
      metrics.reliability * 0.3 +
      metrics.relevance * 0.25 +
      metrics.recency * 0.15 +
      metrics.authority * 0.2 +
      metrics.completeness * 0.1
    );
  }

  private calculateConfidence(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    // Average of top 3 results' scores and quality
    const topResults = results.slice(0, 3);
    const avgScore = topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length;
    const avgQuality = topResults.reduce((sum, r) => 
      sum + this.calculateQualityScore(r.document.metadata.quality), 0
    ) / topResults.length;
    
    return (avgScore * 0.6 + avgQuality * 0.4);
  }

  private generateCacheKey(query: string, options: any): string {
    return `${query}-${JSON.stringify(options)}`;
  }

  private generateSemanticHash(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private extractKeyPoint(content: string): string {
    // Extract first meaningful sentence
    const sentences = content.split(/[.!?]+/);
    return sentences[0]?.trim() || content.substring(0, 100) + '...';
  }

  private async simulateAPICall(
    query: string,
    source: KnowledgeSource,
    endpoint: APIEndpoint
  ): Promise<any[]> {
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

  private async loadKnowledgeBase(): Promise<void> {
    try {
      // Load persisted knowledge base
      const files = await fs.readdir(this.knowledgeBasePath).catch(() => []);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.knowledgeBasePath, file),
            'utf-8'
          );
          const doc = JSON.parse(content) as KnowledgeDocument;
          
          // Restore Float32Array from array
          if (doc.vector) {
            doc.vector = new Float32Array(doc.vector as any);
          }
          
          this.addDocument(doc);
        }
      }
      
      this.logger.info(`Loaded ${this.documents.size} knowledge documents`);
    } catch (error) {
      this.logger.error('Failed to load knowledge base', error);
    }
  }

  private addDocument(doc: KnowledgeDocument): void {
    this.documents.set(doc.id, doc);
    
    // Update inverted index
    const terms = this.tokenize(doc.content);
    for (const term of terms) {
      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, new Set());
      }
      this.invertedIndex.get(term)!.add(doc.id);
    }
    
    // Update vector index
    this.vectorIndex.set(doc.id, doc.vector);
  }

  // Public API
  async getDocument(id: string): Promise<KnowledgeDocument | null> {
    return this.documents.get(id) || null;
  }

  async saveKnowledgeBase(): Promise<void> {
    try {
      await fs.mkdir(this.knowledgeBasePath, { recursive: true });
      
      for (const [id, doc] of this.documents) {
        const docToSave = {
          ...doc,
          vector: Array.from(doc.vector) // Convert Float32Array to regular array
        };
        
        await fs.writeFile(
          path.join(this.knowledgeBasePath, `${id}.json`),
          JSON.stringify(docToSave, null, 2)
        );
      }
      
      this.logger.info(`Saved ${this.documents.size} knowledge documents`);
    } catch (error) {
      this.logger.error('Failed to save knowledge base', error);
    }
  }
}

interface APIEndpoint {
  baseUrl: string;
  rateLimit: number;
  authRequired: boolean;
  searchEndpoint: string;
  params: Record<string, any>;
}