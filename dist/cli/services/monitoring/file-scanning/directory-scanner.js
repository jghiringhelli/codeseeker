"use strict";
/**
 * Directory Scanner - Single Responsibility Principle + Dependency Inversion
 * Scans directories using configurable filters (depends on abstractions)
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
exports.DirectoryScanner = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const file_type_detector_1 = require("./file-type-detector");
class DirectoryScanner {
    typeDetector;
    constructor(configPath) {
        this.typeDetector = new file_type_detector_1.FileTypeDetector(configPath);
    }
    async scan(rootPath, filters) {
        const startTime = Date.now();
        const files = [];
        const byType = {};
        const byLanguage = {};
        let totalSize = 0;
        try {
            await this.scanDirectory(rootPath, rootPath, files, filters, byType, byLanguage);
            // Calculate total size
            totalSize = files.reduce((sum, file) => sum + file.size, 0);
            return {
                files,
                totalFiles: files.length,
                totalSize,
                byType,
                byLanguage,
                scanDuration: Date.now() - startTime
            };
        }
        catch (error) {
            throw new Error(`Failed to scan directory ${rootPath}: ${error.message}`);
        }
    }
    async scanDirectory(dirPath, rootPath, files, filters, byType, byLanguage) {
        let entries;
        try {
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        }
        catch (error) {
            // Skip directories we can't read (permission issues, etc.)
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(rootPath, fullPath);
            if (entry.isDirectory()) {
                // Check if directory should be excluded
                const shouldIncludeDir = filters.every(filter => filter.shouldInclude(fullPath, entry.name, { isDirectory: true }));
                if (shouldIncludeDir) {
                    await this.scanDirectory(fullPath, rootPath, files, filters, byType, byLanguage);
                }
            }
            else if (entry.isFile()) {
                try {
                    const stats = await fs.stat(fullPath);
                    // Apply all filters
                    const shouldInclude = filters.every(filter => filter.shouldInclude(fullPath, entry.name, stats));
                    if (shouldInclude) {
                        const extension = path.extname(entry.name);
                        const fileType = this.typeDetector.detectType(fullPath, extension);
                        const language = this.typeDetector.detectLanguage(fullPath, extension);
                        const fileInfo = {
                            path: fullPath,
                            relativePath,
                            name: entry.name,
                            extension,
                            size: stats.size,
                            type: fileType,
                            language
                        };
                        files.push(fileInfo);
                        // Update statistics
                        byType[fileType] = (byType[fileType] || 0) + 1;
                        if (language) {
                            byLanguage[language] = (byLanguage[language] || 0) + 1;
                        }
                    }
                }
                catch (error) {
                    // Skip files we can't stat (permission issues, etc.)
                    continue;
                }
            }
        }
    }
}
exports.DirectoryScanner = DirectoryScanner;
//# sourceMappingURL=directory-scanner.js.map