"use strict";
/**
 * Intelligent Code Auxiliary System
 * Main entry point for the system
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemConfig = exports.SystemConfigManager = exports.generateUUID = exports.md5 = exports.sha256 = exports.HashUtils = exports.CacheFactory = exports.FileCacheManager = exports.InMemoryCacheManager = exports.FileSystemHelper = exports.defaultLogger = exports.LogLevel = exports.Logger = exports.PostgreSQLAdapter = exports.DatabaseFactory = exports.MigrationManager = void 0;
var migrate_1 = require("./database/migrate");
Object.defineProperty(exports, "MigrationManager", { enumerable: true, get: function () { return migrate_1.MigrationManager; } });
var factory_1 = require("./database/factory");
Object.defineProperty(exports, "DatabaseFactory", { enumerable: true, get: function () { return factory_1.DatabaseFactory; } });
var postgresql_1 = require("./database/adapters/postgresql");
Object.defineProperty(exports, "PostgreSQLAdapter", { enumerable: true, get: function () { return postgresql_1.PostgreSQLAdapter; } });
// Utilities
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return logger_1.LogLevel; } });
Object.defineProperty(exports, "defaultLogger", { enumerable: true, get: function () { return logger_1.defaultLogger; } });
var file_system_1 = require("./utils/file-system");
Object.defineProperty(exports, "FileSystemHelper", { enumerable: true, get: function () { return file_system_1.FileSystemHelper; } });
var cache_1 = require("./utils/cache");
Object.defineProperty(exports, "InMemoryCacheManager", { enumerable: true, get: function () { return cache_1.InMemoryCacheManager; } });
Object.defineProperty(exports, "FileCacheManager", { enumerable: true, get: function () { return cache_1.FileCacheManager; } });
Object.defineProperty(exports, "CacheFactory", { enumerable: true, get: function () { return cache_1.CacheFactory; } });
var hash_1 = require("./utils/hash");
Object.defineProperty(exports, "HashUtils", { enumerable: true, get: function () { return hash_1.HashUtils; } });
Object.defineProperty(exports, "sha256", { enumerable: true, get: function () { return hash_1.sha256; } });
Object.defineProperty(exports, "md5", { enumerable: true, get: function () { return hash_1.md5; } });
Object.defineProperty(exports, "generateUUID", { enumerable: true, get: function () { return hash_1.generateUUID; } });
var config_1 = require("./utils/config");
Object.defineProperty(exports, "SystemConfigManager", { enumerable: true, get: function () { return config_1.SystemConfigManager; } });
Object.defineProperty(exports, "systemConfig", { enumerable: true, get: function () { return config_1.systemConfig; } });
// Core types and interfaces
__exportStar(require("./core/types"), exports);
__exportStar(require("./core/interfaces"), exports);
//# sourceMappingURL=index.js.map