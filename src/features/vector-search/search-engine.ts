import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { ASTAnalyzer } from '../../shared/ast/analyzer';
import { Logger } from '../../utils/logger';
import { createHash } from 'crypto';

export interface VectorSearchRequest {
  query: string;
  projectPath: string;
  limit: number;
  crossProject: boolean;
  useSemanticSearch: boolean;
  contextWeight?: number;
  similarityThreshold?: number;
}

export interface VectorSearchResult {
  query: string;
  matches: SemanticMatch[];
  searchTime: number;
  indexStats: IndexStatistics;
  searchMetadata: SearchMetadata;
}

export interface SemanticMatch {
  file: string;
  line: number;
  column?: number;
  codeSnippet: string;
  similarity: number;
  context?: string;
  relevanceScore: number;
  matchType: MatchType;
  embedding?: number[];
  metadata: MatchMetadata;
}

export interface MatchMetadata {
  function?: string;
  class?: string;
  language: string;
  complexity: number;
  linesOfCode: number;
  symbols: string[];
  comments: string[];
}

export interface IndexStatistics {
  totalFiles: number;
  indexedBlocks: number;
  embeddingDimensions: number;
  indexSize: number;
  lastUpdated: Date;
}

export interface SearchMetadata {
  queryProcessingTime: number;
  indexSearchTime: number;
  resultRankingTime: number;
  totalResults: number;
  filteredResults: number;
}

export enum MatchType {
  EXACT = 'exact',
  FUZZY = 'fuzzy',
  SEMANTIC = 'semantic',
  CONTEXTUAL = 'contextual',
  STRUCTURAL = 'structural'
}

interface CodeBlock {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  hash: string;
  embedding?: number[];
  tokens: string[];
  semanticFeatures: SemanticFeatures;
  context: BlockContext;
}

interface SemanticFeatures {
  keywords: string[];
  functionNames: string[];
  variableNames: string[];
  concepts: string[];
  patterns: string[];
  complexity: number;
}

interface BlockContext {
  parentFunction?: string;
  parentClass?: string;
  imports: string[];
  comments: string[];
  surroundingCode: string;
}

interface VectorIndex {
  blocks: Map<string, CodeBlock>;
  embeddings: Map<string, number[]>;
  keywordIndex: Map<string, Set<string>>;
  conceptIndex: Map<string, Set<string>>;
  lastUpdated: Date;
}

interface EmbeddingCache {
  embeddings: Map<string, number[]>;
  metadata: Map<string, { timestamp: Date; hash: string }>;
}

export class VectorSearch {
  private logger = Logger.getInstance();
  private astAnalyzer = new ASTAnalyzer();
  private index: VectorIndex | null = null;
  private embeddingCache: EmbeddingCache;
  private readonly EMBEDDING_DIMENSION = 384; // Using sentence-transformers dimension

  constructor() {
    this.embeddingCache = {
      embeddings: new Map(),
      metadata: new Map()
    };
  }

  async search(request: VectorSearchRequest): Promise<VectorSearchResult> {
    const startTime = Date.now();
    this.logger.info(`Starting vector search for: "${request.query}"`);

    const searchMetadata: SearchMetadata = {
      queryProcessingTime: 0,
      indexSearchTime: 0,
      resultRankingTime: 0,
      totalResults: 0,
      filteredResults: 0
    };

    try {
      // Ensure index is built
      if (!this.index || this.shouldRebuildIndex(request.projectPath)) {
        await this.buildIndex(request.projectPath);
      }

      // Process query
      const queryStart = Date.now();
      const queryEmbedding = await this.createQueryEmbedding(request.query);
      const queryTokens = this.tokenizeText(request.query);
      searchMetadata.queryProcessingTime = Date.now() - queryStart;

      // Search index
      const indexSearchStart = Date.now();
      const candidates = await this.searchIndex(queryEmbedding, queryTokens, request);
      searchMetadata.indexSearchTime = Date.now() - indexSearchStart;
      searchMetadata.totalResults = candidates.length;

      // Rank and filter results
      const rankingStart = Date.now();
      const rankedMatches = this.rankResults(candidates, request.query, queryEmbedding);
      const limitedMatches = rankedMatches.slice(0, request.limit);
      searchMetadata.resultRankingTime = Date.now() - rankingStart;
      searchMetadata.filteredResults = limitedMatches.length;

      const searchTime = Date.now() - startTime;

      this.logger.info(`Vector search completed: found ${limitedMatches.length} matches in ${searchTime}ms`);

      return {
        query: request.query,
        matches: limitedMatches,
        searchTime,
        indexStats: this.getIndexStatistics(),
        searchMetadata
      };

    } catch (error) {
      this.logger.error('Vector search failed', error);
      throw error;
    }
  }

  private async buildIndex(projectPath: string): Promise<void> {
    this.logger.info(`Building vector index for ${projectPath}`);
    const startTime = Date.now();

    const files = await this.getIndexableFiles(projectPath);
    const blocks = new Map<string, CodeBlock>();
    const embeddings = new Map<string, number[]>();
    const keywordIndex = new Map<string, Set<string>>();
    const conceptIndex = new Map<string, Set<string>>();

    for (const file of files) {
      try {
        const filePath = path.join(projectPath, file);
        const codeBlocks = await this.extractCodeBlocks(filePath, projectPath);

        for (const block of codeBlocks) {
          blocks.set(block.id, block);
          
          // Generate embedding
          if (block.content.trim().length > 10) {
            const embedding = await this.generateEmbedding(block);
            embeddings.set(block.id, embedding);
            
            // Update keyword index
            for (const keyword of block.semanticFeatures.keywords) {
              if (!keywordIndex.has(keyword)) {
                keywordIndex.set(keyword, new Set());
              }
              keywordIndex.get(keyword)!.add(block.id);
            }
            
            // Update concept index
            for (const concept of block.semanticFeatures.concepts) {
              if (!conceptIndex.has(concept)) {
                conceptIndex.set(concept, new Set());
              }
              conceptIndex.get(concept)!.add(block.id);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to index file ${file}`, error);
      }
    }

    this.index = {
      blocks,
      embeddings,
      keywordIndex,
      conceptIndex,
      lastUpdated: new Date()
    };

    const indexTime = Date.now() - startTime;
    this.logger.info(`Vector index built: ${blocks.size} blocks indexed in ${indexTime}ms`);
  }

  private async getIndexableFiles(projectPath: string): Promise<string[]> {
    const patterns = [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py'
    ];

    const excludes = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/*.test.*',
      '**/*.spec.*',
      '**/coverage/**'
    ];

    return await glob(patterns, {
      cwd: projectPath,
      ignore: excludes,
      onlyFiles: true
    });
  }

  private async extractCodeBlocks(filePath: string, projectRoot: string): Promise<CodeBlock[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(projectRoot, filePath);
    const blocks: CodeBlock[] = [];

    try {
      // Use AST analysis for better code understanding
      const astResult = await this.astAnalyzer.analyzeFile(filePath);
      
      // Extract function-level blocks
      for (const symbol of astResult.symbols) {
        if ((symbol.type === 'function' || symbol.type === 'method' || symbol.type === 'class') && 
            symbol.location.endLine) {
          
          const startLine = symbol.location.line - 1;
          const endLine = Math.min(symbol.location.endLine - 1, lines.length - 1);
          
          const blockContent = lines.slice(startLine, endLine + 1).join('\n');
          if (blockContent.trim().length > 20) {
            const block = await this.createCodeBlock(
              blockContent,
              relativePath,
              startLine + 1,
              endLine + 1,
              filePath,
              astResult
            );
            blocks.push(block);
          }
        }
      }

      // Also create blocks for meaningful code sections (classes, large functions, etc.)
      const significantBlocks = this.findSignificantCodeBlocks(lines, relativePath, astResult);
      blocks.push(...significantBlocks);

    } catch (error) {
      // Fallback to simple line-based extraction
      this.logger.warn(`AST analysis failed for ${filePath}, using fallback extraction`);
      const fallbackBlocks = this.extractBlocksFallback(lines, relativePath);
      blocks.push(...fallbackBlocks);
    }

    return blocks;
  }

  private async createCodeBlock(
    content: string,
    file: string,
    startLine: number,
    endLine: number,
    fullPath: string,
    astResult?: any
  ): Promise<CodeBlock> {
    const id = this.generateBlockId(file, startLine, endLine);
    const hash = createHash('md5').update(content).digest('hex');
    const tokens = this.tokenizeCode(content);
    
    const semanticFeatures = this.extractSemanticFeatures(content, astResult);
    const context = await this.extractBlockContext(content, fullPath, startLine, endLine, astResult);

    return {
      id,
      file,
      startLine,
      endLine,
      content,
      hash,
      tokens,
      semanticFeatures,
      context
    };
  }

  private generateBlockId(file: string, startLine: number, endLine: number): string {
    return `${file}:${startLine}-${endLine}`;
  }

  private tokenizeCode(content: string): string[] {
    // Advanced tokenization considering code structure
    const codeTokens: string[] = [];
    
    // Extract identifiers, keywords, and meaningful tokens
    const patterns = [
      /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,  // Identifiers
      /\b\d+\b/g,                      // Numbers
      /["'][^"']*["']/g,               // Strings
      /\/\/.*$/gm,                     // Comments
      /\/\*.*?\*\//gs                  // Block comments
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern) || [];
      codeTokens.push(...matches);
    }

    // Clean and normalize tokens
    return codeTokens
      .map(token => token.toLowerCase().trim())
      .filter(token => token.length > 2 && !this.isStopWord(token))
      .slice(0, 100); // Limit tokens per block
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'try', 'catch'
    ]);
    return stopWords.has(word);
  }

  private extractSemanticFeatures(content: string, astResult?: any): SemanticFeatures {
    const keywords = this.extractKeywords(content);
    const functionNames = this.extractFunctionNames(content);
    const variableNames = this.extractVariableNames(content);
    const concepts = this.extractConcepts(content);
    const patterns = this.extractCodePatterns(content);
    const complexity = astResult?.complexity?.cyclomaticComplexity || this.estimateComplexity(content);

    return {
      keywords,
      functionNames,
      variableNames,
      concepts,
      patterns,
      complexity
    };
  }

  private extractKeywords(content: string): string[] {
    const keywords = new Set<string>();
    
    // Programming keywords
    const codeKeywords = content.match(/\b(async|await|class|interface|type|enum|import|export|extends|implements|constructor|static|private|public|protected|abstract|override)\b/gi) || [];
    codeKeywords.forEach(kw => keywords.add(kw.toLowerCase()));
    
    // Domain-specific keywords from comments and strings
    const domainKeywords = this.extractDomainKeywords(content);
    domainKeywords.forEach(kw => keywords.add(kw));
    
    return Array.from(keywords).slice(0, 20);
  }

  private extractDomainKeywords(content: string): string[] {
    const keywords: string[] = [];
    
    // Extract from comments
    const comments = content.match(/\/\/.*$|\/\*.*?\*\//gms) || [];
    comments.forEach(comment => {
      const words = comment.replace(/[^a-zA-Z\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .map(word => word.toLowerCase());
      keywords.push(...words);
    });
    
    // Extract from string literals
    const strings = content.match(/["'`][^"'`]*["'`]/g) || [];
    strings.forEach(str => {
      const words = str.replace(/[^a-zA-Z\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .map(word => word.toLowerCase());
      keywords.push(...words);
    });
    
    return [...new Set(keywords)].slice(0, 10);
  }

  private extractFunctionNames(content: string): string[] {
    const functions = new Set<string>();
    
    // Function declarations and calls
    const patterns = [
      /function\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi,
      /\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2) {
          functions.add(match[1].toLowerCase());
        }
      }
    });
    
    return Array.from(functions).slice(0, 15);
  }

  private extractVariableNames(content: string): string[] {
    const variables = new Set<string>();
    
    const patterns = [
      /(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2) {
          variables.add(match[1].toLowerCase());
        }
      }
    });
    
    return Array.from(variables).slice(0, 15);
  }

  private extractConcepts(content: string): string[] {
    const concepts: string[] = [];
    
    // Common programming concepts
    const conceptPatterns = [
      { pattern: /authentication|auth|login|signin/gi, concept: 'authentication' },
      { pattern: /validation|validate|valid/gi, concept: 'validation' },
      { pattern: /database|db|sql|query/gi, concept: 'database' },
      { pattern: /api|endpoint|route|request|response/gi, concept: 'api' },
      { pattern: /test|spec|mock|stub/gi, concept: 'testing' },
      { pattern: /error|exception|catch|throw/gi, concept: 'error_handling' },
      { pattern: /cache|redis|memory/gi, concept: 'caching' },
      { pattern: /config|settings|env|environment/gi, concept: 'configuration' },
      { pattern: /log|logging|debug|trace/gi, concept: 'logging' },
      { pattern: /security|secure|encrypt|decrypt/gi, concept: 'security' }
    ];
    
    conceptPatterns.forEach(({ pattern, concept }) => {
      if (pattern.test(content)) {
        concepts.push(concept);
      }
    });
    
    return concepts;
  }

  private extractCodePatterns(content: string): string[] {
    const patterns: string[] = [];
    
    // Design patterns
    if (/class.*Factory/i.test(content)) patterns.push('factory_pattern');
    if (/class.*Singleton/i.test(content)) patterns.push('singleton_pattern');
    if (/class.*Observer/i.test(content)) patterns.push('observer_pattern');
    if (/class.*Strategy/i.test(content)) patterns.push('strategy_pattern');
    
    // Code structures
    if (/try\s*{.*catch/s.test(content)) patterns.push('error_handling');
    if (/async.*await/s.test(content)) patterns.push('async_await');
    if (/Promise/.test(content)) patterns.push('promises');
    if (/class.*extends/i.test(content)) patterns.push('inheritance');
    if (/interface/i.test(content)) patterns.push('interface_definition');
    
    return patterns;
  }

  private estimateComplexity(content: string): number {
    let complexity = 1;
    
    // Count branching statements
    complexity += (content.match(/if\s*\(/g) || []).length;
    complexity += (content.match(/for\s*\(/g) || []).length;
    complexity += (content.match(/while\s*\(/g) || []).length;
    complexity += (content.match(/catch\s*\(/g) || []).length;
    complexity += (content.match(/case\s+/g) || []).length;
    
    return complexity;
  }

  private async extractBlockContext(
    content: string,
    fullPath: string,
    startLine: number,
    endLine: number,
    astResult?: any
  ): Promise<BlockContext> {
    const context: BlockContext = {
      imports: [],
      comments: [],
      surroundingCode: ''
    };

    try {
      // Extract imports from AST result
      if (astResult?.dependencies) {
        context.imports = astResult.dependencies
          .filter((dep: any) => dep.type === 'import')
          .map((dep: any) => dep.target);
      }

      // Extract comments from the block
      const comments = content.match(/\/\/.*$|\/\*.*?\*\//gms) || [];
      context.comments = comments.map(comment => 
        comment.replace(/\/\/|\/\*|\*\//g, '').trim()
      ).filter(comment => comment.length > 5);

      // Get surrounding code for better context
      const fileContent = await fs.readFile(fullPath, 'utf-8');
      const lines = fileContent.split('\n');
      const contextStart = Math.max(0, startLine - 3);
      const contextEnd = Math.min(lines.length, endLine + 3);
      context.surroundingCode = lines.slice(contextStart, contextEnd).join('\n');

      // Try to determine parent function/class
      context.parentFunction = this.findParentFunction(content, astResult);
      context.parentClass = this.findParentClass(content, astResult);

    } catch (error) {
      this.logger.warn('Failed to extract block context', error);
    }

    return context;
  }

  private findParentFunction(content: string, astResult?: any): string | undefined {
    // Simple heuristic - look for function definition above
    const lines = content.split('\n');
    for (const line of lines.slice(0, 5)) {
      const match = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (match) return match[1];
    }
    return undefined;
  }

  private findParentClass(content: string, astResult?: any): string | undefined {
    // Simple heuristic - look for class definition
    const lines = content.split('\n');
    for (const line of lines.slice(0, 10)) {
      const match = line.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (match) return match[1];
    }
    return undefined;
  }

  private findSignificantCodeBlocks(lines: string[], file: string, astResult: any): CodeBlock[] {
    // This would implement more sophisticated block detection
    // For now, return empty array
    return [];
  }

  private extractBlocksFallback(lines: string[], file: string): CodeBlock[] {
    // Simple fallback implementation
    const blocks: CodeBlock[] = [];
    const blockSize = 20;
    
    for (let i = 0; i < lines.length; i += blockSize) {
      const endIdx = Math.min(i + blockSize, lines.length);
      const content = lines.slice(i, endIdx).join('\n');
      
      if (this.isSignificantContent(content)) {
        // Create a simple block without full analysis
        const block: CodeBlock = {
          id: this.generateBlockId(file, i + 1, endIdx),
          file,
          startLine: i + 1,
          endLine: endIdx,
          content,
          hash: createHash('md5').update(content).digest('hex'),
          tokens: this.tokenizeCode(content),
          semanticFeatures: this.extractSemanticFeatures(content),
          context: {
            imports: [],
            comments: [],
            surroundingCode: content
          }
        };
        blocks.push(block);
      }
    }
    
    return blocks;
  }

  private isSignificantContent(content: string): boolean {
    const meaningfulLines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('/*') &&
             trimmed !== '{' && 
             trimmed !== '}';
    });
    
    return meaningfulLines.length >= 5;
  }

  private async generateEmbedding(block: CodeBlock): Promise<number[]> {
    // Check cache first
    const cacheKey = block.hash;
    if (this.embeddingCache.embeddings.has(cacheKey)) {
      return this.embeddingCache.embeddings.get(cacheKey)!;
    }

    // Generate embedding (simplified implementation)
    // In a full implementation, this would use a proper embedding model
    const embedding = this.createSimpleEmbedding(block);
    
    // Cache the result
    this.embeddingCache.embeddings.set(cacheKey, embedding);
    this.embeddingCache.metadata.set(cacheKey, {
      timestamp: new Date(),
      hash: block.hash
    });

    return embedding;
  }

  private createSimpleEmbedding(block: CodeBlock): number[] {
    // Simplified embedding based on features
    // In production, use sentence-transformers or similar
    const embedding = new Array(this.EMBEDDING_DIMENSION).fill(0);
    
    // Feature-based embedding
    const allFeatures = [
      ...block.semanticFeatures.keywords,
      ...block.semanticFeatures.functionNames,
      ...block.semanticFeatures.variableNames,
      ...block.semanticFeatures.concepts,
      ...block.semanticFeatures.patterns
    ];
    
    // Hash features to embedding dimensions
    allFeatures.forEach(feature => {
      const hash = createHash('md5').update(feature).digest('hex');
      const index = parseInt(hash.substring(0, 8), 16) % this.EMBEDDING_DIMENSION;
      embedding[index] += 1;
    });
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  private async createQueryEmbedding(query: string): Promise<number[]> {
    // Create a simple query embedding
    const queryTokens = this.tokenizeText(query);
    const embedding = new Array(this.EMBEDDING_DIMENSION).fill(0);
    
    queryTokens.forEach(token => {
      const hash = createHash('md5').update(token).digest('hex');
      const index = parseInt(hash.substring(0, 8), 16) % this.EMBEDDING_DIMENSION;
      embedding[index] += 1;
    });
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  private tokenizeText(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.isStopWord(token));
  }

  private async searchIndex(
    queryEmbedding: number[],
    queryTokens: string[],
    request: VectorSearchRequest
  ): Promise<SemanticMatch[]> {
    if (!this.index) throw new Error('Index not built');

    const matches: SemanticMatch[] = [];
    const threshold = request.similarityThreshold || 0.1;

    // Search through all blocks
    for (const [blockId, block] of this.index.blocks) {
      const blockEmbedding = this.index.embeddings.get(blockId);
      if (!blockEmbedding) continue;

      // Calculate similarity
      const similarity = this.cosineSimilarity(queryEmbedding, blockEmbedding);
      
      if (similarity >= threshold) {
        // Calculate additional scores
        const textSimilarity = this.calculateTextSimilarity(queryTokens, block.tokens);
        const contextScore = this.calculateContextScore(request.query, block);
        
        // Determine match type
        const matchType = this.determineMatchType(similarity, textSimilarity, queryTokens, block);
        
        const match: SemanticMatch = {
          file: block.file,
          line: block.startLine,
          codeSnippet: this.createCodeSnippet(block),
          similarity,
          context: this.createMatchContext(block),
          relevanceScore: this.calculateRelevanceScore(similarity, textSimilarity, contextScore),
          matchType,
          embedding: blockEmbedding,
          metadata: {
            language: this.detectLanguageFromPath(block.file),
            complexity: block.semanticFeatures.complexity,
            linesOfCode: block.endLine - block.startLine + 1,
            symbols: [...block.semanticFeatures.functionNames, ...block.semanticFeatures.variableNames],
            comments: block.context.comments,
            function: block.context.parentFunction,
            class: block.context.parentClass
          }
        };

        matches.push(match);
      }
    }

    return matches;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateTextSimilarity(queryTokens: string[], blockTokens: string[]): number {
    const querySet = new Set(queryTokens);
    const blockSet = new Set(blockTokens);
    
    const intersection = new Set([...querySet].filter(x => blockSet.has(x)));
    const union = new Set([...querySet, ...blockSet]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateContextScore(query: string, block: CodeBlock): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Check if query matches concepts
    for (const concept of block.semanticFeatures.concepts) {
      if (queryLower.includes(concept)) score += 0.3;
    }
    
    // Check if query matches patterns
    for (const pattern of block.semanticFeatures.patterns) {
      if (queryLower.includes(pattern.replace(/_/g, ' '))) score += 0.2;
    }
    
    // Check comments for context
    for (const comment of block.context.comments) {
      if (comment.toLowerCase().includes(queryLower)) score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }

  private determineMatchType(
    similarity: number,
    textSimilarity: number,
    queryTokens: string[],
    block: CodeBlock
  ): MatchType {
    // Check for exact token matches
    const exactMatches = queryTokens.filter(token => 
      block.tokens.some(blockToken => blockToken === token)
    );
    
    if (exactMatches.length === queryTokens.length) {
      return MatchType.EXACT;
    } else if (similarity > 0.8) {
      return MatchType.SEMANTIC;
    } else if (textSimilarity > 0.5) {
      return MatchType.FUZZY;
    } else if (this.hasStructuralSimilarity(queryTokens, block)) {
      return MatchType.STRUCTURAL;
    } else {
      return MatchType.CONTEXTUAL;
    }
  }

  private hasStructuralSimilarity(queryTokens: string[], block: CodeBlock): boolean {
    // Check if query contains function/variable names from the block
    return queryTokens.some(token => 
      block.semanticFeatures.functionNames.includes(token) ||
      block.semanticFeatures.variableNames.includes(token)
    );
  }

  private calculateRelevanceScore(
    similarity: number,
    textSimilarity: number,
    contextScore: number
  ): number {
    return similarity * 0.5 + textSimilarity * 0.3 + contextScore * 0.2;
  }

  private createCodeSnippet(block: CodeBlock): string {
    const lines = block.content.split('\n');
    
    // Return first few lines or up to 200 characters
    const snippet = lines.slice(0, 5).join('\n');
    return snippet.length > 200 ? snippet.substring(0, 197) + '...' : snippet;
  }

  private createMatchContext(block: CodeBlock): string {
    const contextParts: string[] = [];
    
    if (block.context.parentClass) {
      contextParts.push(`in class ${block.context.parentClass}`);
    }
    
    if (block.context.parentFunction) {
      contextParts.push(`in function ${block.context.parentFunction}`);
    }
    
    if (block.context.comments.length > 0) {
      contextParts.push(`// ${block.context.comments[0]}`);
    }
    
    return contextParts.join(', ');
  }

  private detectLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath);
    const mapping: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python'
    };
    return mapping[ext] || 'unknown';
  }

  private rankResults(matches: SemanticMatch[], query: string, queryEmbedding: number[]): SemanticMatch[] {
    return matches.sort((a, b) => {
      // Primary sort by relevance score
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      
      // Secondary sort by similarity
      if (a.similarity !== b.similarity) {
        return b.similarity - a.similarity;
      }
      
      // Tertiary sort by match type priority
      const matchTypePriority = {
        [MatchType.EXACT]: 5,
        [MatchType.SEMANTIC]: 4,
        [MatchType.FUZZY]: 3,
        [MatchType.STRUCTURAL]: 2,
        [MatchType.CONTEXTUAL]: 1
      };
      
      return matchTypePriority[b.matchType] - matchTypePriority[a.matchType];
    });
  }

  private shouldRebuildIndex(projectPath: string): boolean {
    if (!this.index) return true;
    
    // Rebuild if index is older than 1 hour
    const oneHour = 60 * 60 * 1000;
    return Date.now() - this.index.lastUpdated.getTime() > oneHour;
  }

  private getIndexStatistics(): IndexStatistics {
    if (!this.index) {
      return {
        totalFiles: 0,
        indexedBlocks: 0,
        embeddingDimensions: this.EMBEDDING_DIMENSION,
        indexSize: 0,
        lastUpdated: new Date()
      };
    }

    const indexSize = this.index.embeddings.size * this.EMBEDDING_DIMENSION * 8; // 8 bytes per float

    return {
      totalFiles: new Set(Array.from(this.index.blocks.values()).map(b => b.file)).size,
      indexedBlocks: this.index.blocks.size,
      embeddingDimensions: this.EMBEDDING_DIMENSION,
      indexSize,
      lastUpdated: this.index.lastUpdated
    };
  }

  // Utility methods for managing the index
  async clearIndex(): Promise<void> {
    this.index = null;
    this.embeddingCache.embeddings.clear();
    this.embeddingCache.metadata.clear();
    this.logger.info('Vector search index cleared');
  }

  async rebuildIndex(projectPath: string): Promise<void> {
    await this.clearIndex();
    await this.buildIndex(projectPath);
  }
}

export default VectorSearch;