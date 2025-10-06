"use strict";
/**
 * Configurable Exclusion Filter - Open/Closed Principle
 * Externalized configuration allows users to modify rules without code changes
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
exports.ConfigurableExclusionFilter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ConfigurableExclusionFilter {
    config;
    excludedDirectories;
    excludedExtensions;
    excludedFileNames;
    importantDotFiles;
    constructor(configPath) {
        this.loadConfig(configPath);
        this.initializeSets();
    }
    loadConfig(configPath) {
        const defaultConfigPath = path.join(__dirname, 'file-scanner-config.json');
        const finalConfigPath = configPath || defaultConfigPath;
        try {
            const configContent = fs.readFileSync(finalConfigPath, 'utf8');
            this.config = JSON.parse(configContent);
        }
        catch (error) {
            console.warn(`Warning: Could not load scanner config from ${finalConfigPath}, using defaults`);
            this.config = this.getDefaultConfig();
        }
    }
    initializeSets() {
        this.excludedDirectories = new Set(this.config.exclusions.directories);
        this.excludedExtensions = new Set(this.config.exclusions.extensions);
        this.excludedFileNames = new Set(this.config.exclusions.fileNames);
        this.importantDotFiles = new Set(this.config.inclusions.importantDotFiles);
    }
    getDefaultConfig() {
        return {
            scanning: {
                maxFileSize: 10485760, // 10MB
                maxFiles: 10000,
                followSymlinks: false
            },
            exclusions: {
                directories: ['node_modules', 'vendor', '.git', 'dist', 'build'],
                extensions: ['.exe', '.dll', '.jpg', '.png', '.zip'],
                fileNames: ['package-lock.json', 'yarn.lock']
            },
            inclusions: {
                sourceExtensions: ['.ts', '.js', '.py', '.java'],
                configExtensions: ['.json', '.yaml', '.yml'],
                documentationExtensions: ['.md', '.txt'],
                templateExtensions: ['.html', '.css'],
                scriptExtensions: ['.sh', '.bat'],
                schemaExtensions: ['.sql'],
                importantDotFiles: ['.env', '.gitignore', '.editorconfig']
            },
            typeMapping: {
                source: ['ts', 'js', 'py', 'java'],
                config: ['json', 'yaml', 'yml'],
                documentation: ['md', 'txt'],
                template: ['html', 'css'],
                script: ['sh', 'bat'],
                schema: ['sql']
            },
            languageMapping: {
                ts: 'TypeScript',
                js: 'JavaScript',
                py: 'Python',
                java: 'Java'
            }
        };
    }
    shouldInclude(filePath, fileName, stats) {
        // Check file size limit
        if (stats.size > this.config.scanning.maxFileSize) {
            return false;
        }
        // Skip directories that are excluded
        if (this.containsExcludedDirectory(filePath)) {
            return false;
        }
        // Skip excluded file names
        if (this.excludedFileNames.has(fileName)) {
            return false;
        }
        // Skip excluded extensions
        const extension = this.getFileExtension(fileName);
        if (this.excludedExtensions.has(extension)) {
            return false;
        }
        // Handle dot files - only include important ones
        if (fileName.startsWith('.') && !this.isImportantDotFile(fileName)) {
            return false;
        }
        return true;
    }
    containsExcludedDirectory(filePath) {
        const pathParts = filePath.split(/[/\\]/);
        return pathParts.some(part => this.excludedDirectories.has(part));
    }
    getFileExtension(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot === -1 ? '' : fileName.substring(lastDot).toLowerCase();
    }
    isImportantDotFile(fileName) {
        return Array.from(this.importantDotFiles).some(pattern => fileName === pattern || fileName.startsWith(pattern + '.'));
    }
    getFilterName() {
        return 'ConfigurableExclusionFilter';
    }
    // Public method to reload configuration at runtime
    reloadConfig(configPath) {
        this.loadConfig(configPath);
        this.initializeSets();
    }
    // Public method to get current configuration
    getConfig() {
        return { ...this.config };
    }
}
exports.ConfigurableExclusionFilter = ConfigurableExclusionFilter;
//# sourceMappingURL=configurable-exclusion-filter.js.map