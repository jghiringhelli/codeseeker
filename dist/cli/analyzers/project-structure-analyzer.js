"use strict";
/**
 * Project Structure Analyzer - Single Responsibility: Analyzing project structure
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
exports.ProjectStructureAnalyzer = void 0;
class ProjectStructureAnalyzer {
    async analyze(projectPath) {
        try {
            const { glob } = await Promise.resolve().then(() => __importStar(require('fast-glob')));
            const files = await glob('**/*', {
                cwd: projectPath,
                ignore: ['node_modules/**', '.git/**', 'dist/**', '*.log'],
                onlyFiles: false,
                markDirectories: true
            });
            const structure = {
                directories: files.filter(f => f.endsWith('/')).slice(0, 20),
                sourceFiles: files.filter(f => /\.(ts|js|tsx|jsx)$/.test(f)).slice(0, 50),
                configFiles: files.filter(f => /\.(json|yml|yaml|toml|ini)$/.test(f)).slice(0, 10),
                totalFiles: files.length
            };
            return `PROJECT STRUCTURE:
Directories (${structure.directories.length}): ${structure.directories.join(', ')}
Source Files (${structure.sourceFiles.length}): ${structure.sourceFiles.join(', ')}
Config Files (${structure.configFiles.length}): ${structure.configFiles.join(', ')}
Total Files: ${structure.totalFiles}`;
        }
        catch (error) {
            return `Error analyzing project structure: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
exports.ProjectStructureAnalyzer = ProjectStructureAnalyzer;
//# sourceMappingURL=project-structure-analyzer.js.map