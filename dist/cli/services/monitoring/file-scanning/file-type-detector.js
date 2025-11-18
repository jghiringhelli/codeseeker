"use strict";
/**
 * File Type Detector - Single Responsibility Principle
 * Detects file types and languages based on extensions and configuration
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
exports.FileTypeDetector = void 0;
const path = __importStar(require("path"));
const configurable_exclusion_filter_1 = require("./configurable-exclusion-filter");
class FileTypeDetector {
    filter;
    typeMapping;
    languageMapping;
    constructor(configPath) {
        this.filter = new configurable_exclusion_filter_1.ConfigurableExclusionFilter(configPath);
        const config = this.filter.getConfig();
        this.typeMapping = config.typeMapping;
        this.languageMapping = config.languageMapping;
    }
    detectType(filePath, extension) {
        const cleanExt = extension.toLowerCase().replace('.', '');
        // Check each type mapping
        for (const [type, extensions] of Object.entries(this.typeMapping)) {
            if (extensions.includes(cleanExt)) {
                return type;
            }
        }
        // Special cases
        if (this.isConfigFile(filePath, cleanExt)) {
            return 'config';
        }
        if (this.isDocumentationFile(filePath, cleanExt)) {
            return 'documentation';
        }
        return 'other';
    }
    detectLanguage(filePath, extension) {
        const cleanExt = extension.toLowerCase().replace('.', '');
        return this.languageMapping[cleanExt];
    }
    isConfigFile(filePath, extension) {
        const fileName = path.basename(filePath).toLowerCase();
        const configFiles = [
            'package.json', 'tsconfig.json', 'webpack.config.js',
            'babel.config.js', 'rollup.config.js', 'vite.config.ts',
            'jest.config.js', 'cypress.config.js',
            'docker-compose.yml', 'dockerfile'
        ];
        return configFiles.includes(fileName) ||
            fileName.includes('config') ||
            fileName.includes('settings') ||
            extension === 'ini' ||
            extension === 'cfg' ||
            extension === 'conf';
    }
    isDocumentationFile(filePath, extension) {
        const fileName = path.basename(filePath).toLowerCase();
        const docFiles = [
            'readme', 'license', 'changelog', 'contributing',
            'authors', 'contributors', 'history', 'news'
        ];
        return docFiles.some(docFile => fileName.startsWith(docFile)) ||
            extension === 'md' ||
            extension === 'txt' ||
            extension === 'rst';
    }
    // Allow runtime configuration updates
    updateConfig(configPath) {
        this.filter.reloadConfig(configPath);
        const config = this.filter.getConfig();
        this.typeMapping = config.typeMapping;
        this.languageMapping = config.languageMapping;
    }
}
exports.FileTypeDetector = FileTypeDetector;
//# sourceMappingURL=file-type-detector.js.map