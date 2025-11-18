"use strict";
/**
 * Content Chunker Service - Single Responsibility
 * Handles breaking down files into searchable semantic chunks
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
exports.ContentChunker = void 0;
const crypto = __importStar(require("crypto"));
class ContentChunker {
    chunkSize = 1000; // characters
    chunkOverlap = 200; // characters
    async createSemanticChunks(filePath, content, fileHash) {
        const lines = content.split('\n');
        const chunks = [];
        // For small files, create single chunk
        if (content.length <= this.chunkSize) {
            chunks.push(this.createSingleChunk(filePath, content, fileHash, lines, 0, lines.length - 1, 0, true));
            return chunks;
        }
        // Create overlapping chunks for larger files
        let chunkIndex = 0;
        let startChar = 0;
        while (startChar < content.length) {
            const endChar = Math.min(startChar + this.chunkSize, content.length);
            const chunkContent = content.substring(startChar, endChar);
            const startLine = this.getLineNumber(content, startChar);
            const endLine = this.getLineNumber(content, endChar);
            const chunk = this.createSingleChunk(filePath, chunkContent, fileHash, lines.slice(startLine, endLine + 1), startLine, endLine, chunkIndex, false);
            chunks.push(chunk);
            chunkIndex++;
            // Move start position with overlap
            startChar = endChar - this.chunkOverlap;
            if (startChar >= content.length - this.chunkOverlap)
                break;
        }
        return chunks;
    }
    async createStructuralChunks(filePath, content, fileHash, lines) {
        const chunks = [];
        const language = this.detectLanguage(filePath);
        // Extract structural elements based on language
        const functions = this.extractFunctions(content, language);
        const classes = this.extractClasses(content, language);
        // Create chunks for each function
        functions.forEach((func, index) => {
            const chunk = this.createStructuralChunk(filePath, func.content, fileHash, func.startLine, func.endLine, `func_${index}`, {
                language,
                size: func.content.length,
                functions: [func.name],
                classes: [],
                imports: [],
                exports: [],
                significance: this.calculateSignificance(func.content)
            });
            chunks.push(chunk);
        });
        // Create chunks for each class
        classes.forEach((cls, index) => {
            const chunk = this.createStructuralChunk(filePath, cls.content, fileHash, cls.startLine, cls.endLine, `class_${index}`, {
                language,
                size: cls.content.length,
                functions: [],
                classes: [cls.name],
                imports: [],
                exports: [],
                significance: this.calculateSignificance(cls.content)
            });
            chunks.push(chunk);
        });
        return chunks;
    }
    createSingleChunk(filePath, content, fileHash, lines, startLine, endLine, chunkIndex, isFullFile) {
        const language = this.detectLanguage(filePath);
        return {
            id: crypto.createHash('sha256').update(`${filePath}_${chunkIndex}_${fileHash}`).digest('hex'),
            filePath,
            content,
            startLine,
            endLine,
            chunkIndex,
            isFullFile,
            hash: crypto.createHash('sha256').update(content).digest('hex'),
            metadata: {
                language,
                size: content.length,
                functions: this.extractFunctionNames(content, language),
                classes: this.extractClassNames(content, language),
                imports: this.extractImports(content, language),
                exports: this.extractExports(content, language),
                significance: this.calculateSignificance(content)
            }
        };
    }
    createStructuralChunk(filePath, content, fileHash, startLine, endLine, structureId, metadata) {
        return {
            id: crypto.createHash('sha256').update(`${filePath}_${structureId}_${fileHash}`).digest('hex'),
            filePath,
            content,
            startLine,
            endLine,
            chunkIndex: 0,
            isFullFile: false,
            hash: crypto.createHash('sha256').update(content).digest('hex'),
            metadata
        };
    }
    getLineNumber(content, charPosition) {
        return content.substring(0, charPosition).split('\n').length - 1;
    }
    detectLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'java': 'java',
            'rs': 'rust',
            'go': 'go',
            'cpp': 'cpp',
            'c': 'c',
            'cs': 'csharp'
        };
        return languageMap[ext || ''] || 'text';
    }
    extractFunctions(content, language) {
        // Simplified function extraction - would use proper AST parsing in production
        const functions = [];
        const lines = content.split('\n');
        const functionPatterns = {
            typescript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
            javascript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
            python: /def\s+(\w+)/,
            java: /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/
        };
        const pattern = functionPatterns[language];
        if (!pattern)
            return functions;
        lines.forEach((line, index) => {
            const match = line.match(pattern);
            if (match) {
                functions.push({
                    name: match[1],
                    content: line,
                    startLine: index,
                    endLine: index
                });
            }
        });
        return functions;
    }
    extractClasses(content, language) {
        const classes = [];
        const lines = content.split('\n');
        const classPatterns = {
            typescript: /(?:export\s+)?class\s+(\w+)/,
            javascript: /class\s+(\w+)/,
            python: /class\s+(\w+)/,
            java: /(?:public\s+)?class\s+(\w+)/
        };
        const pattern = classPatterns[language];
        if (!pattern)
            return classes;
        lines.forEach((line, index) => {
            const match = line.match(pattern);
            if (match) {
                classes.push({
                    name: match[1],
                    content: line,
                    startLine: index,
                    endLine: index
                });
            }
        });
        return classes;
    }
    extractFunctionNames(content, language) {
        return this.extractFunctions(content, language).map(f => f.name);
    }
    extractClassNames(content, language) {
        return this.extractClasses(content, language).map(c => c.name);
    }
    extractImports(content, language) {
        const lines = content.split('\n');
        const imports = [];
        const importPatterns = {
            typescript: /import.*from\s+['"]([^'"]+)['"]/,
            javascript: /import.*from\s+['"]([^'"]+)['"]/,
            python: /import\s+(\w+)|from\s+(\w+)\s+import/,
            java: /import\s+([\w.]+)/
        };
        const pattern = importPatterns[language];
        if (!pattern)
            return imports;
        lines.forEach(line => {
            const match = line.match(pattern);
            if (match) {
                imports.push(match[1] || match[2]);
            }
        });
        return imports;
    }
    extractExports(content, language) {
        const lines = content.split('\n');
        const exports = [];
        const exportPatterns = {
            typescript: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/,
            javascript: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/
        };
        const pattern = exportPatterns[language];
        if (!pattern)
            return exports;
        lines.forEach(line => {
            const match = line.match(pattern);
            if (match) {
                exports.push(match[1]);
            }
        });
        return exports;
    }
    calculateSignificance(content) {
        const keywordCount = (content.match(/\b(class|function|interface|type|enum|export|import)\b/g) || []).length;
        if (keywordCount >= 5)
            return 'high';
        if (keywordCount >= 2)
            return 'medium';
        return 'low';
    }
}
exports.ContentChunker = ContentChunker;
//# sourceMappingURL=content-chunker.js.map