/**
 * Offline-First Smart Cache
 * Allows CodeSeeker workflow to proceed even when databases are unavailable
 * Falls back gracefully from Redis → File Cache → Memory Cache → Continue without cache
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

export interface CachedContent {
  content: string;
  hash: string;
  lastModified: number;
  language: string;
  exports: string[];
  imports: string[];
  functions: string[];
  classes: string[];
}

export interface CacheStats {
  redisAvailable: boolean;
  filesCached: number;
  memoryHits: number;
  fileHits: number;
  redisHits: number;
  misses: number;
}

export class OfflineFirstCache {
  private logger = Logger.getInstance();
  private memoryCache = new Map<string, CachedContent>();
  private cacheDir: string;
  private redisClient: any = null;
  private stats: CacheStats = {
    redisAvailable: false,
    filesCached: 0,
    memoryHits: 0,
    fileHits: 0,
    redisHits: 0,
    misses: 0
  };

  constructor(projectPath: string = process.cwd()) {
    this.cacheDir = path.join(projectPath, '.codeseeker', 'cache');
  }

  /**
   * Initialize cache with non-blocking Redis connection
   */
  async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Try to connect to Redis with very short timeout
      await this.tryRedisConnection();
      
      this.logger.info(`🔧 Offline-first cache initialized (Redis: ${this.stats.redisAvailable ? 'available' : 'unavailable'})`);
      
    } catch (error) {
      this.logger.warn(`⚠️ Cache initialization partial: ${error.message}`);
    }
  }

  /**
   * Get cached file content with multi-level fallback
   */
  async getCachedFile(filePath: string): Promise<CachedContent | null> {
    const cacheKey = this.getCacheKey(filePath);

    try {
      // Level 1: Memory cache (fastest)
      if (this.memoryCache.has(cacheKey)) {
        this.stats.memoryHits++;
        return this.memoryCache.get(cacheKey)!;
      }

      // Level 2: Redis cache (fast, if available)
      if (this.redisClient) {
        try {
          const redisData = await this.redisClient.get(cacheKey);
          if (redisData) {
            const cached = JSON.parse(redisData);
            this.memoryCache.set(cacheKey, cached); // Promote to memory
            this.stats.redisHits++;
            return cached;
          }
        } catch (error) {
          // Redis failed, continue to file cache
          this.logger.debug(`Redis cache miss: ${error.message}`);
        }
      }

      // Level 3: File cache (slower but reliable)
      const fileData = await this.getFromFileCache(cacheKey);
      if (fileData) {
        this.memoryCache.set(cacheKey, fileData); // Promote to memory
        this.stats.fileHits++;
        return fileData;
      }

      // Level 4: Generate fresh content
      const freshContent = await this.generateFreshContent(filePath);
      if (freshContent) {
        // Cache in all available levels
        await this.setInAllCaches(cacheKey, freshContent);
        return freshContent;
      }

      this.stats.misses++;
      return null;

    } catch (error) {
      this.logger.warn(`Cache retrieval failed for ${filePath}: ${error.message}`);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set content in all available cache levels
   */
  async setCachedFile(filePath: string, content: CachedContent): Promise<void> {
    const cacheKey = this.getCacheKey(filePath);
    await this.setInAllCaches(cacheKey, content);
  }

  /**
   * Clear all caches for a specific file
   */
  async invalidateFile(filePath: string): Promise<void> {
    const cacheKey = this.getCacheKey(filePath);

    // Remove from memory
    this.memoryCache.delete(cacheKey);

    // Remove from Redis
    if (this.redisClient) {
      try {
        await this.redisClient.del(cacheKey);
      } catch (error) {
        // Ignore Redis errors
      }
    }

    // Remove from file cache
    try {
      const fileCachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      await fs.unlink(fileCachePath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Preload commonly accessed files into cache
   */
  async preloadCommonFiles(filePaths: string[]): Promise<void> {
    this.logger.info(`🚀 Preloading ${filePaths.length} files into cache...`);
    
    const startTime = Date.now();
    let loaded = 0;

    // Process files in small batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (filePath) => {
        try {
          await this.getCachedFile(filePath);
          loaded++;
        } catch (error) {
          // Continue with other files
        }
      }));
    }

    const duration = Date.now() - startTime;
    this.logger.info(`✅ Preloaded ${loaded}/${filePaths.length} files in ${duration}ms`);
  }

  // Private helper methods

  private async tryRedisConnection(): Promise<void> {
    try {
      // Create a very aggressive timeout to prevent hanging
      const timeoutMs = 500; // 500ms max
      
      await Promise.race([
        this.attemptRedisConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), timeoutMs)
        )
      ]);
      
      this.stats.redisAvailable = true;
      this.logger.info('✅ Redis cache connected');

    } catch (error) {
      this.redisClient = null;
      this.stats.redisAvailable = false;
      this.logger.debug(`Redis unavailable: ${error.message}`);
    }
  }

  private async attemptRedisConnection(): Promise<void> {
    const { createClient } = await import('redis');
    this.redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        connectTimeout: 300 // 300ms timeout
      }
    });

    await this.redisClient.connect();
    await this.redisClient.ping();
  }

  private getCacheKey(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  private async getFromFileCache(cacheKey: string): Promise<CachedContent | null> {
    try {
      const fileCachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      const data = await fs.readFile(fileCachePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  private async setInFileCache(cacheKey: string, content: CachedContent): Promise<void> {
    try {
      const fileCachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      await fs.writeFile(fileCachePath, JSON.stringify(content, null, 2));
      this.stats.filesCached++;
    } catch (error) {
      this.logger.warn(`Failed to write file cache: ${error.message}`);
    }
  }

  private async setInAllCaches(cacheKey: string, content: CachedContent): Promise<void> {
    // Set in memory cache
    this.memoryCache.set(cacheKey, content);

    // Set in Redis cache (if available)
    if (this.redisClient) {
      try {
        await this.redisClient.setex(cacheKey, 3600, JSON.stringify(content)); // 1 hour TTL
      } catch (error) {
        // Ignore Redis errors
      }
    }

    // Set in file cache
    await this.setInFileCache(cacheKey, content);
  }

  private async generateFreshContent(filePath: string): Promise<CachedContent | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      return {
        content,
        hash,
        lastModified: stats.mtime.getTime(),
        language: this.detectLanguage(filePath),
        exports: this.extractExports(content),
        imports: this.extractImports(content),
        functions: this.extractFunctions(content),
        classes: this.extractClasses(content)
      };
    } catch (error) {
      this.logger.warn(`Failed to generate fresh content for ${filePath}: ${error.message}`);
      return null;
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript', 
      '.py': 'Python',
      '.java': 'Java',
      '.cs': 'C#',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C'
    };
    return langMap[ext] || 'Unknown';
  }

  private extractExports(content: string): string[] {
    const matches = content.match(/export\s+(?:class|function|const|let|var|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(/\s+/).pop() || '').filter(Boolean);
  }

  private extractImports(content: string): string[] {
    const matches = content.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g) || [];
    return matches.map(m => m.match(/['"`]([^'"`]+)['"`]/)?.[1] || '').filter(Boolean);
  }

  private extractFunctions(content: string): string[] {
    const matches = content.match(/(?:function|const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\(|=)/g) || [];
    return matches.map(m => m.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)/)?.[1] || '').filter(Boolean);
  }

  private extractClasses(content: string): string[] {
    const matches = content.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(/\s+/)[1]).filter(Boolean);
  }
}

export default OfflineFirstCache;