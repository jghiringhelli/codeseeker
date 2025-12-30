/**
 * Embedded Storage Provider
 *
 * Zero-infrastructure storage using:
 * - SQLite + better-sqlite3 for vector search and projects
 * - Graphology for graph database
 * - LRU-cache for caching
 *
 * All data persists to ~/.codemind/data by default.
 * No Docker, no external services required.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  IStorageProvider,
  IVectorStore,
  IGraphStore,
  ICacheStore,
  IProjectStore,
  ITextStore,
  StorageMode,
  StorageConfig
} from '../interfaces';
import { SQLiteVectorStore } from './sqlite-vector-store';
import { GraphologyGraphStore } from './graphology-graph-store';
import { LRUCacheStore } from './lru-cache-store';
import { SQLiteProjectStore } from './sqlite-project-store';
import { MiniSearchTextStore } from './minisearch-text-store';

export class EmbeddedStorageProvider implements IStorageProvider {
  private vectorStore: SQLiteVectorStore;
  private graphStore: GraphologyGraphStore;
  private cacheStore: LRUCacheStore;
  private projectStore: SQLiteProjectStore;
  private dataDir: string;

  constructor(config?: StorageConfig) {
    // Determine data directory
    this.dataDir = config?.dataDir || this.getDefaultDataDir();

    // Ensure data directory exists
    fs.mkdirSync(this.dataDir, { recursive: true });

    const flushInterval = config?.flushIntervalSeconds ?? 30;

    // Initialize all stores
    this.vectorStore = new SQLiteVectorStore(this.dataDir, flushInterval);
    this.graphStore = new GraphologyGraphStore(this.dataDir, flushInterval);
    this.cacheStore = new LRUCacheStore(this.dataDir, flushInterval);
    this.projectStore = new SQLiteProjectStore(this.dataDir, flushInterval);

    // Silent initialization - verbose output handled by CLI when needed
  }

  private getDefaultDataDir(): string {
    // Platform-specific default locations
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows: %APPDATA%\codemind\data
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'codemind', 'data');
    } else if (platform === 'darwin') {
      // macOS: ~/Library/Application Support/codemind/data
      return path.join(os.homedir(), 'Library', 'Application Support', 'codemind', 'data');
    } else {
      // Linux/Unix: ~/.local/share/codemind/data (XDG standard)
      return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'codemind', 'data');
    }
  }

  getVectorStore(): IVectorStore {
    return this.vectorStore;
  }

  getGraphStore(): IGraphStore {
    return this.graphStore;
  }

  getCacheStore(): ICacheStore {
    return this.cacheStore;
  }

  getProjectStore(): IProjectStore {
    return this.projectStore;
  }

  getTextStore(): ITextStore {
    // Text store is integrated into the vector store (MiniSearch)
    return this.vectorStore.getTextStore();
  }

  getMode(): StorageMode {
    return 'embedded';
  }

  getDataDir(): string {
    return this.dataDir;
  }

  async flushAll(): Promise<void> {
    await Promise.all([
      this.vectorStore.flush(),
      this.graphStore.flush(),
      this.cacheStore.flush(),
      this.projectStore.flush()
    ]);
  }

  async closeAll(): Promise<void> {
    await Promise.all([
      this.vectorStore.close(),
      this.graphStore.close(),
      this.cacheStore.close(),
      this.projectStore.close()
    ]);
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, boolean> }> {
    const details: Record<string, boolean> = {
      vectorStore: true,
      graphStore: true,
      cacheStore: true,
      projectStore: true
    };

    // For embedded storage, all stores are always "healthy" if they initialized
    return {
      healthy: true,
      details
    };
  }
}

// Re-export individual stores for direct use
export { SQLiteVectorStore } from './sqlite-vector-store';
export { GraphologyGraphStore } from './graphology-graph-store';
export { LRUCacheStore } from './lru-cache-store';
export { SQLiteProjectStore } from './sqlite-project-store';
export { MiniSearchTextStore } from './minisearch-text-store';