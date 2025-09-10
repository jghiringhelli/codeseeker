/**
 * CodeMind Embedding Service
 * Generates vector embeddings for semantic search using multiple strategies
 */

import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { DatabaseConnections } from '../config/database-config';

export interface EmbeddingConfig {
  provider: 'openai' | 'local' | 'hybrid';
  openaiApiKey?: string;
  model: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large' | 'local';
  chunkSize: number;
  maxTokens: number;
  batchSize: number;
}

export interface FileEmbedding {
  filePath: string;
  content: string;
  hash: string;
  embedding: number[];
  metadata: {
    language: string;
    size: number;
    lines: number;
    functions: string[];
    classes: string[];
    imports: string[];
    exports: string[];
  };
}

export class EmbeddingService {
  private logger: Logger;
  private config: EmbeddingConfig;
  private openaiClient?: any;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.logger = Logger.getInstance();
    this.config = {
      provider: 'hybrid',
      model: 'text-embedding-ada-002',
      chunkSize: 8000, // tokens
      maxTokens: 8191,
      batchSize: 20,
      ...config
    };

    this.initializeProviders();
  }

  /**
   * Generate embeddings for all files in a project
   */
  async generateProjectEmbeddings(
    projectId: string,
    files: string[],
    progressCallback?: (progress: number, current: string) => void
  ): Promise<{ success: number; errors: number; skipped: number }> {
    
    this.logger.info(`🚀 Generating embeddings for ${files.length} files using ${this.config.provider} strategy`);
    
    let success = 0;
    let errors = 0;
    let skipped = 0;
    
    const dbConnections = new DatabaseConnections();
    
    try {
      // Process files in batches
      for (let i = 0; i < files.length; i += this.config.batchSize) {
        const batch = files.slice(i, i + this.config.batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (filePath, index) => {
            try {
              progressCallback?.(
                Math.round(((i + index) / files.length) * 100),
                filePath
              );
              
              const result = await this.processFile(projectId, filePath, dbConnections);
              return result;
            } catch (error) {
              this.logger.warn(`Failed to process ${filePath}: ${error.message}`);
              throw error;
            }
          })
        );
        
        // Count results
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            if (result.value === 'success') success++;
            else if (result.value === 'skipped') skipped++;
          } else {
            errors++;
          }
        });
        
        // Small delay to avoid overwhelming the API
        if (this.config.provider === 'openai' || this.config.provider === 'hybrid') {
          await this.delay(100);
        }
      }
      
      this.logger.info(`✅ Embedding generation complete: ${success} success, ${skipped} skipped, ${errors} errors`);
      
    } finally {
      await dbConnections.closeAll();
    }
    
    return { success, errors, skipped };
  }

  /**
   * Process a single file for embedding generation
   */
  private async processFile(
    projectId: string, 
    filePath: string, 
    dbConnections: DatabaseConnections
  ): Promise<'success' | 'skipped' | 'error'> {
    
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Skip binary or very large files
      if (this.shouldSkipFile(filePath, content)) {
        return 'skipped';
      }
      
      // Check if already processed with same hash
      const pgClient = await dbConnections.getPostgresConnection();
      const existing = await pgClient.query(
        'SELECT content_hash FROM semantic_search_embeddings WHERE project_id = $1 AND file_path = $2',
        [projectId, filePath]
      );
      
      if (existing.rows.length > 0 && existing.rows[0].content_hash === hash) {
        return 'skipped'; // Already up to date
      }
      
      // Generate embedding
      const embedding = await this.generateEmbedding(content, filePath);
      
      // Extract metadata
      const metadata = this.extractFileMetadata(filePath, content);
      
      // Store in database
      await this.storeEmbedding(projectId, filePath, content, hash, embedding, metadata, pgClient);
      
      return 'success';
      
    } catch (error) {
      this.logger.error(`Failed to process ${filePath}:`, error);
      return 'error';
    }
  }

  /**
   * Generate embedding for content using configured provider
   */
  private async generateEmbedding(content: string, filePath: string): Promise<number[]> {
    // Truncate content if too large
    const truncatedContent = this.truncateContent(content);
    
    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.generateOpenAIEmbedding(truncatedContent);
          
        case 'local':
          return await this.generateLocalEmbedding(truncatedContent, filePath);
          
        case 'hybrid':
          // Try OpenAI first, fallback to local
          try {
            return await this.generateOpenAIEmbedding(truncatedContent);
          } catch (error) {
            this.logger.warn(`OpenAI failed for ${filePath}, using local embedding`);
            return await this.generateLocalEmbedding(truncatedContent, filePath);
          }
          
        default:
          throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
      }
    } catch (error) {
      this.logger.error(`Embedding generation failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Generate OpenAI embedding
   */
  private async generateOpenAIEmbedding(content: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }
    
    try {
      const response = await this.openaiClient.embeddings.create({
        model: this.config.model,
        input: content,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('OpenAI embedding API error:', error);
      throw error;
    }
  }

  /**
   * Generate local embedding using simple but effective algorithm
   */
  private async generateLocalEmbedding(content: string, filePath: string): Promise<number[]> {
    // Create a 1536-dimensional embedding to match OpenAI format
    const embedding = new Array(1536).fill(0);
    
    // Extract meaningful features
    const features = this.extractContentFeatures(content, filePath);
    
    // Map features to embedding dimensions
    this.mapFeaturesToEmbedding(features, embedding);
    
    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  /**
   * Extract content features for local embedding
   */
  private extractContentFeatures(content: string, filePath: string) {
    const features = {
      // File type features
      language: this.detectLanguage(filePath),
      extension: filePath.split('.').pop()?.toLowerCase() || '',
      
      // Content features
      length: content.length,
      lines: content.split('\n').length,
      
      // Code structure features
      functions: this.extractFunctions(content),
      classes: this.extractClasses(content),
      imports: this.extractImports(content),
      exports: this.extractExports(content),
      
      // Semantic features
      keywords: this.extractKeywords(content),
      comments: this.extractComments(content),
      
      // Complexity features
      cyclomaticComplexity: this.estimateComplexity(content),
      nestingDepth: this.estimateNestingDepth(content),
      
      // Hash-based features for similarity
      contentHash: crypto.createHash('md5').update(content).digest('hex'),
      structureHash: this.generateStructureHash(content)
    };
    
    return features;
  }

  /**
   * Map extracted features to embedding dimensions
   */
  private mapFeaturesToEmbedding(features: any, embedding: number[]): void {
    let index = 0;
    
    // Language encoding (dimensions 0-99)
    const languageEncoding = this.encodeLanguage(features.language);
    for (let i = 0; i < 100 && index < embedding.length; i++, index++) {
      embedding[index] = languageEncoding[i] || 0;
    }
    
    // Keywords encoding (dimensions 100-699)
    const keywordEncoding = this.encodeKeywords(features.keywords);
    for (let i = 0; i < 600 && index < embedding.length; i++, index++) {
      embedding[index] = keywordEncoding[i] || 0;
    }
    
    // Structure encoding (dimensions 700-1199)
    const structureEncoding = this.encodeStructure(features);
    for (let i = 0; i < 500 && index < embedding.length; i++, index++) {
      embedding[index] = structureEncoding[i] || 0;
    }
    
    // Hash-based similarity features (dimensions 1200-1535)
    const hashEncoding = this.encodeHashes(features.contentHash, features.structureHash);
    for (let i = 0; i < 336 && index < embedding.length; i++, index++) {
      embedding[index] = hashEncoding[i] || 0;
    }
  }

  /**
   * Store embedding in database
   */
  private async storeEmbedding(
    projectId: string,
    filePath: string,
    content: string,
    hash: string,
    embedding: number[],
    metadata: any,
    pgClient: any
  ): Promise<void> {
    
    const truncatedContent = content.length > 50000 
      ? content.substring(0, 50000) + '...[truncated]'
      : content;
    
    const query = `
      INSERT INTO semantic_search_embeddings (
        project_id,
        file_path,
        content_text,
        content_hash,
        embedding,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (project_id, file_path)
      DO UPDATE SET
        content_text = EXCLUDED.content_text,
        content_hash = EXCLUDED.content_hash,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
    
    await pgClient.query(query, [
      projectId,
      filePath,
      truncatedContent,
      hash,
      `[${embedding.join(',')}]`, // PostgreSQL vector format
      JSON.stringify(metadata)
    ]);
  }

  // Helper methods
  private shouldSkipFile(filePath: string, content: string): boolean {
    const skipExtensions = ['.png', '.jpg', '.gif', '.pdf', '.zip', '.exe'];
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    return skipExtensions.includes(`.${ext}`) || 
           content.length > 100000 || // Skip very large files
           content.length === 0; // Skip empty files
  }

  private truncateContent(content: string): string {
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = content.length / 4;
    
    if (estimatedTokens > this.config.maxTokens) {
      const maxChars = this.config.maxTokens * 4;
      return content.substring(0, maxChars);
    }
    
    return content;
  }

  private extractFileMetadata(filePath: string, content: string) {
    return {
      language: this.detectLanguage(filePath),
      size: content.length,
      lines: content.split('\n').length,
      functions: this.extractFunctions(content),
      classes: this.extractClasses(content),
      imports: this.extractImports(content),
      exports: this.extractExports(content),
    };
  }

  // Feature extraction methods (simplified versions)
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: { [key: string]: string } = {
      'ts': 'TypeScript', 'js': 'JavaScript', 'py': 'Python',
      'java': 'Java', 'cpp': 'C++', 'cs': 'C#', 'go': 'Go'
    };
    return langMap[ext || ''] || 'Unknown';
  }

  private extractFunctions(content: string): string[] {
    const functions: string[] = [];
    const patterns = [
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        functions.push(match[1]);
      }
    });
    
    return [...new Set(functions)];
  }

  private extractClasses(content: string): string[] {
    const classes: string[] = [];
    const pattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const patterns = [
      /import\s+.*?from\s+['"']([^'"]+)['"]/g,
      /require\s*\(\s*['"']([^'"]+)['"]\s*\)/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    });
    
    return [...new Set(imports)];
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const patterns = [
      /export\s+(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      /export\s+\{\s*([^}]+)\s*\}/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          exports.push(match[1].trim());
        }
      }
    });
    
    return [...new Set(exports)];
  }

  private extractKeywords(content: string): string[] {
    const codeKeywords = [
      'async', 'await', 'promise', 'callback', 'function', 'class', 'interface',
      'type', 'enum', 'export', 'import', 'const', 'let', 'var',
      'if', 'else', 'for', 'while', 'switch', 'try', 'catch', 'finally'
    ];
    
    const found: string[] = [];
    const words: string[] = content.toLowerCase().match(/\b\w+\b/g) || [];
    
    codeKeywords.forEach(keyword => {
      if (words.includes(keyword)) {
        found.push(keyword);
      }
    });
    
    return found;
  }

  private extractComments(content: string): string {
    const commentPatterns = [
      /\/\/.*$/gm,
      /\/\*[\s\S]*?\*\//g,
      /#.*$/gm
    ];
    
    let comments = '';
    commentPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        comments += matches.join(' ');
      }
    });
    
    return comments;
  }

  private estimateComplexity(content: string): number {
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'catch'];
    let complexity = 1; // Base complexity
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      complexity += matches ? matches.length : 0;
    });
    
    return Math.min(complexity, 50); // Cap at 50
  }

  private estimateNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const char of content) {
      if (char === '{' || char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ')') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }
    
    return Math.min(maxDepth, 20); // Cap at 20
  }

  private generateStructureHash(content: string): string {
    // Remove whitespace and comments, then hash the structure
    const structure = content
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return crypto.createHash('md5').update(structure).digest('hex');
  }

  // Encoding methods for local embeddings
  private encodeLanguage(language: string): number[] {
    const encoding = new Array(100).fill(0);
    const languages = ['TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go'];
    const index = languages.indexOf(language);
    
    if (index >= 0) {
      encoding[index] = 1.0;
      // Add some noise for uniqueness
      for (let i = 10; i < 100; i++) {
        encoding[i] = Math.sin(index * i) * 0.1;
      }
    }
    
    return encoding;
  }

  private encodeKeywords(keywords: string[]): number[] {
    const encoding = new Array(600).fill(0);
    
    keywords.forEach((keyword, i) => {
      const hash = this.simpleHash(keyword);
      const startIndex = Math.abs(hash) % 500;
      
      for (let j = 0; j < 10; j++) {
        const index = (startIndex + j) % 600;
        encoding[index] += 0.1;
      }
    });
    
    return encoding;
  }

  private encodeStructure(features: any): number[] {
    const encoding = new Array(500).fill(0);
    
    // Encode numeric features
    encoding[0] = Math.min(features.length / 10000, 1); // File size
    encoding[1] = Math.min(features.lines / 1000, 1); // Line count
    encoding[2] = Math.min(features.functions.length / 50, 1); // Function count
    encoding[3] = Math.min(features.classes.length / 20, 1); // Class count
    encoding[4] = Math.min(features.cyclomaticComplexity / 50, 1); // Complexity
    encoding[5] = Math.min(features.nestingDepth / 20, 1); // Nesting
    
    // Fill remaining with derived features
    for (let i = 6; i < 500; i++) {
      encoding[i] = Math.sin(features.length * i) * 0.01;
    }
    
    return encoding;
  }

  private encodeHashes(contentHash: string, structureHash: string): number[] {
    const encoding = new Array(336).fill(0);
    
    // Convert hex hashes to numeric features
    for (let i = 0; i < 168 && i < contentHash.length; i += 2) {
      const hexPair = contentHash.substr(i, 2);
      const value = parseInt(hexPair, 16) / 255; // Normalize to 0-1
      encoding[Math.floor(i / 2)] = value;
    }
    
    for (let i = 0; i < 168 && i < structureHash.length; i += 2) {
      const hexPair = structureHash.substr(i, 2);
      const value = parseInt(hexPair, 16) / 255;
      encoding[168 + Math.floor(i / 2)] = value;
    }
    
    return encoding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  private async initializeProviders(): Promise<void> {
    // Initialize OpenAI client if available
    if (this.config.openaiApiKey || process.env.OPENAI_API_KEY) {
      try {
        // Would require: npm install openai
        // this.openaiClient = new OpenAI({
        //   apiKey: this.config.openaiApiKey || process.env.OPENAI_API_KEY
        // });
        this.logger.info('OpenAI client would be initialized here');
      } catch (error) {
        this.logger.warn('OpenAI client initialization failed, using local embeddings only');
        this.config.provider = 'local';
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default EmbeddingService;