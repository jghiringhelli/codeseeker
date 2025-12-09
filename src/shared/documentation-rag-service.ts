/**
 * Documentation RAG Service
 * Specialized RAG system for documentation with different chunking strategies than code
 * Handles technical documentation, README files, and internet-sourced technical info
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';
import { DatabaseConnections } from '../config/database-config';
import { EmbeddingService } from '../cli/services/data/embedding/embedding-service';
import { SemanticSearchService } from '../cli/services/search/semantic-search';
import { SearchServiceFactory } from '../core/factories/search-service-factory';

export interface DocumentationChunk {
  id: string;
  filePath: string;
  title: string;
  content: string;
  chunkIndex: number;
  hash: string;
  documentType: 'readme' | 'manual' | 'api-doc' | 'tutorial' | 'reference' | 'changelog' | 'internet-doc';
  metadata: {
    language: string;
    size: number;
    headings: string[];
    codeBlocks: string[];
    links: string[];
    techStack: string[];
    version?: string;
    source: 'local' | 'internet';
    sourceUrl?: string;
    lastUpdated: number;
    significance: 'critical' | 'high' | 'medium' | 'low';
  };
}

export interface DocumentationSearchResult {
  chunk: DocumentationChunk;
  relevanceScore: number;
  matchReason: string;
  contextSnippet: string;
  relatedChunks?: DocumentationChunk[];
}

export interface TechnicalContext {
  query: string;
  documentationResults: DocumentationSearchResult[];
  techStackInfo: Array<{
    technology: string;
    version?: string;
    officialDocs: string[];
    bestPractices: string[];
    commonPatterns: string[];
  }>;
  totalDocuments: number;
  searchTime: number;
  cacheHitRate: number;
  generatedAt: number;
}

/**
 * Documentation RAG Service
 * Separate collection for documentation with specialized chunking and search
 */
export class DocumentationRAGService {
  private logger: Logger;
  private dbConnections: DatabaseConnections;
  private embeddingService: EmbeddingService;
  private semanticSearchService: SemanticSearchService;
  private initialized = false;
  private cacheHits = 0;
  private cacheRequests = 0;

  // Documentation-specific configuration
  private readonly DOC_CHUNK_SIZE = 2000; // Smaller chunks for documentation
  private readonly DOC_OVERLAP_SIZE = 100; // Less overlap for cleaner sections
  private readonly MIN_DOC_CHUNK_SIZE = 300; // Minimum viable doc chunk
  private readonly MAX_HEADING_LEVELS = 6; // H1-H6 headings

  constructor(projectId: string) {
    this.logger = Logger.getInstance();
    this.dbConnections = new DatabaseConnections();
    const defaultConfig = { provider: 'local' as const, model: 'local' as const, batchSize: 32 };
    this.embeddingService = new EmbeddingService(defaultConfig);
    const searchFactory = SearchServiceFactory.getInstance();
    this.semanticSearchService = searchFactory.createSemanticSearchService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.dbConnections.getPostgresConnection();
    // SemanticSearchManager initialization handled internally
    await this.createDocumentationTables();

    this.initialized = true;
    this.logger.info('📚 DocumentationRAGService initialized');
  }

  /**
   * Ingest documentation from specified paths
   */
  async ingestDocumentationPaths(paths: string[]): Promise<{
    processed: number;
    chunksCreated: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      chunksCreated: 0,
      errors: []
    };

    for (const docPath of paths) {
      try {
        const stats = await fs.stat(docPath);

        if (stats.isDirectory()) {
          const dirResult = await this.ingestDocumentationDirectory(docPath);
          result.processed += dirResult.processed;
          result.chunksCreated += dirResult.chunksCreated;
          result.errors.push(...dirResult.errors);
        } else {
          const fileResult = await this.ingestDocumentationFile(docPath);
          if (fileResult) {
            result.processed++;
            result.chunksCreated += fileResult.chunks.length;
          }
        }
      } catch (error) {
        // Handle missing files gracefully (common when auto-discovering docs)
        if (error.code === 'ENOENT') {
          this.logger.debug(`Documentation file not found (skipping): ${docPath}`);
          result.errors.push(`File not found: ${docPath}`);
        } else {
          // Log actual errors (permissions, etc.) as errors
          result.errors.push(`Failed to process ${docPath}: ${error.message}`);
          this.logger.error(`Documentation ingestion error for ${docPath}`, error as any);
        }
      }
    }

    return result;
  }

  /**
   * Ingest documentation directory recursively
   */
  private async ingestDocumentationDirectory(dirPath: string): Promise<{
    processed: number;
    chunksCreated: number;
    errors: string[];
  }> {
    const result = { processed: 0, chunksCreated: 0, errors: [] };

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursive directory processing
          const subResult = await this.ingestDocumentationDirectory(fullPath);
          result.processed += subResult.processed;
          result.chunksCreated += subResult.chunksCreated;
          result.errors.push(...subResult.errors);
        } else if (this.isDocumentationFile(entry.name)) {
          try {
            const fileResult = await this.ingestDocumentationFile(fullPath);
            if (fileResult) {
              result.processed++;
              result.chunksCreated += fileResult.chunks.length;
            }
          } catch (error) {
            result.errors.push(`Failed to process ${fullPath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to read directory ${dirPath}: ${error.message}`);
    }

    return result;
  }

  /**
   * Ingest single documentation file
   */
  private async ingestDocumentationFile(filePath: string): Promise<{
    chunks: DocumentationChunk[];
    metadata: any;
  } | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);

      // Skip empty files
      if (content.trim().length < this.MIN_DOC_CHUNK_SIZE) {
        return null;
      }

      const documentType = this.detectDocumentType(filePath, content);
      const chunks = await this.chunkDocumentation(filePath, content, documentType);

      // Store chunks in documentation collection
      for (const chunk of chunks) {
        await this.storeDocumentationChunk(chunk);
      }

      this.logger.debug(`📄 Ingested documentation: ${filePath} (${chunks.length} chunks)`);

      return {
        chunks,
        metadata: {
          filePath,
          documentType,
          size: stats.size,
          lastModified: stats.mtime
        }
      };
    } catch (error) {
      this.logger.error(`Failed to ingest documentation file ${filePath}`, error as any);
      throw error;
    }
  }

  /**
   * Chunk documentation with heading-aware strategy
   */
  private async chunkDocumentation(
    filePath: string,
    content: string,
    documentType: DocumentationChunk['documentType']
  ): Promise<DocumentationChunk[]> {
    const chunks: DocumentationChunk[] = [];

    // Parse headings for structure-aware chunking
    const headingStructure = this.parseHeadingStructure(content);

    if (headingStructure.length > 0) {
      // Structure-aware chunking based on headings
      chunks.push(...await this.chunkByHeadings(filePath, content, documentType, headingStructure));
    } else {
      // Fallback to content-based chunking
      chunks.push(...await this.chunkByContent(filePath, content, documentType));
    }

    return chunks;
  }

  /**
   * Parse heading structure from markdown/text
   */
  private parseHeadingStructure(content: string): Array<{
    level: number;
    title: string;
    startIndex: number;
    endIndex?: number;
  }> {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        title: match[2].trim(),
        startIndex: match.index
      });
    }

    // Set end indices
    for (let i = 0; i < headings.length - 1; i++) {
      headings[i].endIndex = headings[i + 1].startIndex;
    }
    if (headings.length > 0) {
      headings[headings.length - 1].endIndex = content.length;
    }

    return headings;
  }

  /**
   * Chunk by heading sections
   */
  private async chunkByHeadings(
    filePath: string,
    content: string,
    documentType: DocumentationChunk['documentType'],
    headings: Array<{ level: number; title: string; startIndex: number; endIndex?: number; }>
  ): Promise<DocumentationChunk[]> {
    const chunks: DocumentationChunk[] = [];

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const sectionContent = content.slice(heading.startIndex, heading.endIndex);

      if (sectionContent.length >= this.MIN_DOC_CHUNK_SIZE) {
        // Single chunk for this section
        const chunk = await this.createDocumentationChunk(
          filePath,
          heading.title,
          sectionContent,
          i,
          documentType
        );
        chunks.push(chunk);
      } else if (sectionContent.length > this.DOC_CHUNK_SIZE) {
        // Split large sections
        const subChunks = await this.chunkByContent(filePath, sectionContent, documentType, i);
        chunks.push(...subChunks);
      }
    }

    return chunks;
  }

  /**
   * Fallback content-based chunking
   */
  private async chunkByContent(
    filePath: string,
    content: string,
    documentType: DocumentationChunk['documentType'],
    baseIndex: number = 0
  ): Promise<DocumentationChunk[]> {
    const chunks: DocumentationChunk[] = [];

    for (let i = 0; i < content.length; i += this.DOC_CHUNK_SIZE - this.DOC_OVERLAP_SIZE) {
      const chunkContent = content.slice(i, i + this.DOC_CHUNK_SIZE);

      if (chunkContent.trim().length < this.MIN_DOC_CHUNK_SIZE) {
        continue;
      }

      const title = this.extractTitleFromChunk(chunkContent);
      const chunkIndex = baseIndex + Math.floor(i / (this.DOC_CHUNK_SIZE - this.DOC_OVERLAP_SIZE));

      const chunk = await this.createDocumentationChunk(
        filePath,
        title,
        chunkContent,
        chunkIndex,
        documentType
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Create documentation chunk with metadata
   */
  private async createDocumentationChunk(
    filePath: string,
    title: string,
    content: string,
    chunkIndex: number,
    documentType: DocumentationChunk['documentType']
  ): Promise<DocumentationChunk> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const id = `doc_${hash.substring(0, 16)}`;

    return {
      id,
      filePath,
      title,
      content,
      chunkIndex,
      hash,
      documentType,
      metadata: {
        language: this.detectLanguage(filePath),
        size: content.length,
        headings: this.extractHeadings(content),
        codeBlocks: this.extractCodeBlocks(content),
        links: this.extractLinks(content),
        techStack: this.detectTechStack(content),
        source: 'local',
        lastUpdated: Date.now(),
        significance: this.calculateSignificance(content, documentType)
      }
    };
  }

  /**
   * Search documentation with specialized ranking
   */
  async searchDocumentation(query: string, options: {
    maxResults?: number;
    minSimilarity?: number;
    documentTypes?: DocumentationChunk['documentType'][];
    techStack?: string[];
    includeRelated?: boolean;
  } = {}): Promise<DocumentationSearchResult[]> {
    const {
      maxResults = 10,
      minSimilarity = 0.7,
      documentTypes,
      techStack,
      includeRelated = true
    } = options;

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query, 'documentation-search');

      // Search documentation collection
      const results = await this.searchDocumentationChunks(
        queryEmbedding,
        maxResults,
        minSimilarity,
        documentTypes,
        techStack
      );

      // Enhance results with related chunks if requested
      if (includeRelated) {
        for (const result of results) {
          result.relatedChunks = await this.findRelatedDocumentationChunks(
            result.chunk,
            3 // Max 3 related chunks
          );
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Documentation search failed', error as any);
      return [];
    }
  }

  /**
   * Get technical context for Claude Code integration
   */
  async getTechnicalContext(query: string, maxTokens: number = 4000): Promise<TechnicalContext> {
    const startTime = Date.now();

    const documentationResults = await this.searchDocumentation(query, {
      maxResults: 5,
      includeRelated: true
    });

    // Extract tech stack info from results
    const techStackInfo = this.extractTechStackInfo(documentationResults);

    return {
      query,
      documentationResults,
      techStackInfo,
      totalDocuments: documentationResults.length,
      searchTime: Date.now() - startTime,
      cacheHitRate: this.calculateCacheHitRate(),
      generatedAt: Date.now()
    };
  }

  /**
   * Fetch and ingest documentation from internet sources
   */
  async fetchInternetDocumentation(techStack: string[], options: {
    includeOfficialDocs?: boolean;
    includeGuides?: boolean;
    maxDocumentsPerTech?: number;
  } = {}): Promise<{
    fetched: number;
    ingested: number;
    errors: string[];
  }> {
    // Internet documentation fetching - placeholder implementation
    // In production, this would use WebFetch to get official documentation
    this.logger.info('📡 Internet documentation fetching not implemented - using local docs only');
    return {
      fetched: 0,
      ingested: 0,
      errors: ['Internet documentation fetching not yet implemented']
    };
  }

  private calculateCacheHitRate(): number {
    if (this.cacheRequests === 0) return 0;
    return (this.cacheHits / this.cacheRequests) * 100;
  }

  // Helper methods

  private isDocumentationFile(filename: string): boolean {
    const docExtensions = ['.md', '.txt', '.rst', '.adoc', '.wiki'];
    const docNames = ['readme', 'changelog', 'license', 'contributing', 'api', 'docs'];

    const ext = path.extname(filename).toLowerCase();
    const name = path.basename(filename, ext).toLowerCase();

    return docExtensions.includes(ext) || docNames.some(docName => name.includes(docName));
  }

  private detectDocumentType(filePath: string, content: string): DocumentationChunk['documentType'] {
    const filename = path.basename(filePath).toLowerCase();

    if (filename.includes('readme')) return 'readme';
    if (filename.includes('api')) return 'api-doc';
    if (filename.includes('changelog')) return 'changelog';
    if (filename.includes('tutorial') || filename.includes('guide')) return 'tutorial';
    if (content.includes('# API') || content.includes('## API')) return 'api-doc';
    if (content.includes('# Tutorial') || content.includes('Getting Started')) return 'tutorial';

    return 'manual';
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md' ? 'markdown' : 'text';
  }

  private extractTitleFromChunk(content: string): string {
    // Extract first heading or first line
    const headingMatch = content.match(/^#+\s*(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();

    const firstLine = content.split('\n')[0].trim();
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  }

  private extractHeadings(content: string): string[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[2].trim());
    }

    return headings;
  }

  private extractCodeBlocks(content: string): string[] {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push(match[1] || 'unknown');
    }

    return codeBlocks;
  }

  private extractLinks(content: string): string[] {
    const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g;
    const links = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[2]);
    }

    return links;
  }

  private detectTechStack(content: string): string[] {
    const techKeywords = [
      'javascript', 'typescript', 'node.js', 'react', 'vue', 'angular',
      'python', 'django', 'flask', 'fastapi',
      'java', 'spring', 'kotlin',
      'c#', '.net', 'asp.net',
      'go', 'rust', 'ruby', 'rails',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp',
      'postgresql', 'mysql', 'mongodb', 'redis',
      'git', 'github', 'gitlab', 'ci/cd'
    ];

    const lowerContent = content.toLowerCase();
    return techKeywords.filter(tech =>
      lowerContent.includes(tech) || lowerContent.includes(tech.replace('.', ''))
    );
  }

  private calculateSignificance(
    content: string,
    documentType: DocumentationChunk['documentType']
  ): DocumentationChunk['metadata']['significance'] {
    // Critical documents
    if (documentType === 'readme' || documentType === 'api-doc') return 'critical';

    // High importance based on content
    if (content.includes('getting started') || content.includes('installation') ||
        content.includes('quick start') || content.includes('configuration')) {
      return 'high';
    }

    // Medium for tutorials and references
    if (documentType === 'tutorial' || documentType === 'reference') return 'medium';

    return 'low';
  }

  // Database operations

  private async createDocumentationTables(): Promise<void> {
    const client = await this.dbConnections.getPostgresConnection();

    await client.query(`
      CREATE TABLE IF NOT EXISTS documentation_chunks (
        id VARCHAR(64) PRIMARY KEY,
        file_path TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        hash VARCHAR(64) NOT NULL,
        document_type VARCHAR(32) NOT NULL,
        metadata JSONB NOT NULL,
        embedding vector(384),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_documentation_chunks_embedding ON documentation_chunks
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

      CREATE INDEX IF NOT EXISTS idx_documentation_chunks_type ON documentation_chunks (document_type);
      CREATE INDEX IF NOT EXISTS idx_documentation_chunks_file_path ON documentation_chunks (file_path);
      CREATE INDEX IF NOT EXISTS idx_documentation_chunks_tech_stack ON documentation_chunks
      USING gin ((metadata->'techStack'));
    `);

    this.logger.debug('📚 Documentation tables created/verified');
  }

  private async storeDocumentationChunk(chunk: DocumentationChunk): Promise<void> {
    const client = await this.dbConnections.getPostgresConnection();

    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(
      `${chunk.title}\n${chunk.content}`,
      chunk.filePath
    );

    await client.query(`
      INSERT INTO documentation_chunks (
        id, file_path, title, content, chunk_index, hash, document_type, metadata, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        updated_at = CURRENT_TIMESTAMP
    `, [
      chunk.id,
      chunk.filePath,
      chunk.title,
      chunk.content,
      chunk.chunkIndex,
      chunk.hash,
      chunk.documentType,
      JSON.stringify(chunk.metadata),
      `[${embedding.join(',')}]`
    ]);
  }

  private async searchDocumentationChunks(
    queryEmbedding: number[],
    maxResults: number,
    minSimilarity: number,
    documentTypes?: DocumentationChunk['documentType'][],
    techStack?: string[]
  ): Promise<DocumentationSearchResult[]> {
    const client = await this.dbConnections.getPostgresConnection();

    let whereClause = '';
    const params = [`[${queryEmbedding.join(',')}]`, maxResults];
    let paramIndex = 3;

    if (documentTypes && documentTypes.length > 0) {
      whereClause += ` AND document_type = ANY($${paramIndex}::text[])`;
      params.push(documentTypes as any);
      paramIndex++;
    }

    if (techStack && techStack.length > 0) {
      whereClause += ` AND metadata->'techStack' ?| $${paramIndex}::text[]`;
      params.push(techStack as any);
      paramIndex++;
    }

    const query = `
      SELECT
        id, file_path, title, content, chunk_index, hash, document_type, metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM documentation_chunks
      WHERE 1 - (embedding <=> $1::vector) > ${minSimilarity}
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    const result = await client.query(query, params);

    return result.rows.map(row => ({
      chunk: {
        id: row.id,
        filePath: row.file_path,
        title: row.title,
        content: row.content,
        chunkIndex: row.chunk_index,
        hash: row.hash,
        documentType: row.document_type,
        metadata: row.metadata
      },
      relevanceScore: row.similarity,
      matchReason: this.generateMatchReason(row.similarity, row.metadata),
      contextSnippet: this.generateContextSnippet(row.content)
    }));
  }

  private async findRelatedDocumentationChunks(
    chunk: DocumentationChunk,
    maxResults: number
  ): Promise<DocumentationChunk[]> {
    // Implementation for finding related chunks based on same file, similar tech stack, etc.
    return [];
  }

  private extractTechStackInfo(results: DocumentationSearchResult[]): TechnicalContext['techStackInfo'] {
    const techStackMap = new Map();

    results.forEach(result => {
      result.chunk.metadata.techStack.forEach(tech => {
        if (!techStackMap.has(tech)) {
          techStackMap.set(tech, {
            technology: tech,
            version: result.chunk.metadata.version,
            officialDocs: [],
            bestPractices: [],
            commonPatterns: []
          });
        }
      });
    });

    return Array.from(techStackMap.values());
  }

  private generateMatchReason(similarity: number, metadata: any): string {
    if (similarity > 0.9) return 'Exact technical match';
    if (similarity > 0.8) return 'High relevance to tech stack';
    if (similarity > 0.7) return 'Good documentation match';
    return 'Related documentation';
  }

  private generateContextSnippet(content: string, maxLength: number = 200): string {
    const firstParagraph = content.split('\n\n')[0];
    return firstParagraph.length > maxLength ?
      firstParagraph.substring(0, maxLength - 3) + '...' :
      firstParagraph;
  }
}

export default DocumentationRAGService;