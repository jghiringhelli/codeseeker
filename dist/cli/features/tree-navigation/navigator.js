"use strict";
/**
 * Minimal Tree Navigator - MVP Implementation
 * Provides basic tree navigation functionality to replace removed feature
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
exports.TreeNavigator = void 0;
const logger_1 = require("../../../utils/logger");
class TreeNavigator {
    logger = logger_1.Logger.getInstance().child('TreeNavigator');
    /**
     * Perform basic tree analysis for the project
     */
    async performAnalysis(request) {
        try {
            const { glob } = await Promise.resolve().then(() => __importStar(require('fast-glob')));
            // Find all source files
            const sourceFiles = await glob([
                '**/*.ts',
                '**/*.js',
                '**/*.tsx',
                '**/*.jsx'
            ], {
                cwd: request.projectPath,
                ignore: [
                    'node_modules/**',
                    'dist/**',
                    'build/**',
                    '**/*.test.*',
                    '**/*.spec.*'
                ]
            });
            // Basic directory analysis
            const directories = new Set();
            sourceFiles.forEach(file => {
                const parts = file.split('/');
                parts.pop(); // Remove filename
                if (parts.length > 0) {
                    directories.add(parts.join('/'));
                }
            });
            return {
                summary: `Project contains ${sourceFiles.length} source files across ${directories.size} directories`,
                fileCount: sourceFiles.length,
                directoryCount: directories.size,
                relevantFiles: sourceFiles.slice(0, 10) // Top 10 files
            };
        }
        catch (error) {
            this.logger.error('Tree navigation analysis failed', error);
            return {
                summary: 'Tree analysis failed',
                fileCount: 0,
                directoryCount: 0,
                relevantFiles: []
            };
        }
    }
}
exports.TreeNavigator = TreeNavigator;
//# sourceMappingURL=navigator.js.map