/**
 * CodeSeeker - Graph-powered code intelligence
 * Main entry point for the package
 */

// MCP Server (primary export for integrations)
export { CodeSeekerMcpServer, startMcpServer } from './mcp';

// Storage abstraction
export {
  getStorageManager,
  getStorageProvider,
  isUsingEmbeddedStorage,
  type IVectorStore,
  type IGraphStore,
  type ICacheStore,
  type IProjectStore,
  type StorageMode
} from './storage';

// Database utilities
export { DatabaseFactory } from './database/factory';
export { PostgreSQLAdapter } from './database/adapters/postgresql';

// Utilities
export { Logger, LogLevel, defaultLogger } from './utils/logger';
export { FileSystemHelper } from './utils/file-system';
export { InMemoryCacheManager, FileCacheManager, CacheFactory } from './utils/cache';
export { HashUtils, sha256, md5, generateUUID } from './utils/hash';
export { SystemConfigManager, systemConfig } from './utils/config';

// Core types and interfaces
export * from './core/types';
export * from './core/interfaces';