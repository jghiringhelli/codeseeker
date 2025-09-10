"use strict";
/**
 * Claude Code Outcome Analyzer
 * Analyzes the outcome of Claude Code execution to determine intelligent database updates
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeOutcomeAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const colored_logger_1 = require("../utils/colored-logger");
const cli_logger_1 = __importDefault(require("../utils/cli-logger"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const cliLoggerInstance = cli_logger_1.default.getInstance();
class ClaudeCodeOutcomeAnalyzer {
    static instance;
    beforeSnapshot = new Map();
    afterSnapshot = new Map();
    static getInstance() {
        if (!ClaudeCodeOutcomeAnalyzer.instance) {
            ClaudeCodeOutcomeAnalyzer.instance = new ClaudeCodeOutcomeAnalyzer();
        }
        return ClaudeCodeOutcomeAnalyzer.instance;
    }
    /**
     * Take a snapshot before Claude Code execution
     */
    async takeBeforeSnapshot(projectPath) {
        cliLoggerInstance.info('Taking before-execution snapshot...');
        try {
            const files = await this.getAllRelevantFiles(projectPath);
            for (const filePath of files) {
                try {
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const relativePath = path.relative(projectPath, filePath);
                    this.beforeSnapshot.set(relativePath, content);
                }
                catch (error) {
                    // File might not exist or be readable, skip
                    continue;
                }
            }
            colored_logger_1.cliLogger.info('SNAPSHOT', 'Before-execution snapshot captured', {
                filesTracked: this.beforeSnapshot.size
            });
        }
        catch (error) {
            colored_logger_1.cliLogger.error('SNAPSHOT', 'Failed to take before snapshot', { error: error.message });
        }
    }
    /**
     * Take a snapshot after Claude Code execution and analyze differences
     */
    async takeAfterSnapshotAndAnalyze(projectPath) {
        cliLoggerInstance.info('Taking after-execution snapshot and analyzing changes...');
        try {
            const files = await this.getAllRelevantFiles(projectPath);
            const outcome = {
                filesModified: [],
                classesChanged: [],
                newClasses: [],
                functionsChanged: [],
                newFunctions: [],
                importsModified: [],
                success: true,
                errorMessages: [],
                warnings: []
            };
            // Take after snapshot
            for (const filePath of files) {
                try {
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const relativePath = path.relative(projectPath, filePath);
                    this.afterSnapshot.set(relativePath, content);
                }
                catch (error) {
                    continue;
                }
            }
            // Analyze differences
            const modifiedFiles = [];
            // Check for modifications in existing files
            for (const [relativePath, afterContent] of this.afterSnapshot) {
                const beforeContent = this.beforeSnapshot.get(relativePath);
                if (beforeContent !== afterContent) {
                    const analysis = await this.analyzeFileChanges(relativePath, beforeContent || '', afterContent);
                    if (analysis.wasModified) {
                        modifiedFiles.push(analysis);
                        outcome.filesModified.push(analysis.path);
                    }
                }
            }
            // Check for new files
            for (const [relativePath, afterContent] of this.afterSnapshot) {
                if (!this.beforeSnapshot.has(relativePath)) {
                    const analysis = await this.analyzeFileChanges(relativePath, '', afterContent);
                    modifiedFiles.push(analysis);
                    outcome.filesModified.push(analysis.path);
                }
            }
            // Aggregate changes
            for (const file of modifiedFiles) {
                outcome.classesChanged.push(...file.classChanges.modified);
                outcome.newClasses.push(...file.classChanges.added);
                outcome.functionsChanged.push(...file.functionChanges.modified);
                outcome.newFunctions.push(...file.functionChanges.added);
                outcome.importsModified.push(...file.importChanges.added, ...file.importChanges.removed);
            }
            // Check for compilation errors
            const compilationCheck = await this.checkCompilationStatus(projectPath);
            if (!compilationCheck.success) {
                outcome.success = false;
                outcome.errorMessages = compilationCheck.errors;
            }
            colored_logger_1.cliLogger.info('OUTCOME', 'Claude Code outcome analysis completed', {
                filesModified: outcome.filesModified.length,
                classesChanged: outcome.classesChanged.length,
                newClasses: outcome.newClasses.length,
                functionsChanged: outcome.functionsChanged.length,
                success: outcome.success
            });
            return outcome;
        }
        catch (error) {
            colored_logger_1.cliLogger.error('OUTCOME', 'Failed to analyze Claude Code outcome', { error: error.message });
            return {
                filesModified: [],
                classesChanged: [],
                newClasses: [],
                functionsChanged: [],
                newFunctions: [],
                importsModified: [],
                success: false,
                errorMessages: [error.message]
            };
        }
    }
    /**
     * Analyze changes in a specific file
     */
    async analyzeFileChanges(filePath, beforeContent, afterContent) {
        const analysis = {
            path: filePath,
            wasModified: beforeContent !== afterContent,
            classChanges: { added: [], modified: [], removed: [] },
            functionChanges: { added: [], modified: [], removed: [] },
            importChanges: { added: [], removed: [] },
            needsRehashing: false
        };
        if (!analysis.wasModified) {
            return analysis;
        }
        try {
            // Extract classes and functions using regex patterns
            const beforeClasses = this.extractClasses(beforeContent);
            const afterClasses = this.extractClasses(afterContent);
            const beforeFunctions = this.extractFunctions(beforeContent);
            const afterFunctions = this.extractFunctions(afterContent);
            const beforeImports = this.extractImports(beforeContent);
            const afterImports = this.extractImports(afterContent);
            // Analyze class changes
            analysis.classChanges.added = afterClasses.filter(cls => !beforeClasses.includes(cls));
            analysis.classChanges.removed = beforeClasses.filter(cls => !afterClasses.includes(cls));
            analysis.classChanges.modified = afterClasses.filter(cls => beforeClasses.includes(cls) &&
                this.getClassContent(beforeContent, cls) !== this.getClassContent(afterContent, cls));
            // Analyze function changes
            analysis.functionChanges.added = afterFunctions.filter(fn => !beforeFunctions.includes(fn));
            analysis.functionChanges.removed = beforeFunctions.filter(fn => !afterFunctions.includes(fn));
            analysis.functionChanges.modified = afterFunctions.filter(fn => beforeFunctions.includes(fn) &&
                this.getFunctionContent(beforeContent, fn) !== this.getFunctionContent(afterContent, fn));
            // Analyze import changes
            analysis.importChanges.added = afterImports.filter(imp => !beforeImports.includes(imp));
            analysis.importChanges.removed = beforeImports.filter(imp => !afterImports.includes(imp));
            // Determine if rehashing is needed
            analysis.needsRehashing =
                analysis.classChanges.added.length > 0 ||
                    analysis.classChanges.modified.length > 0 ||
                    analysis.functionChanges.added.length > 0 ||
                    analysis.functionChanges.modified.length > 0;
        }
        catch (error) {
            colored_logger_1.cliLogger.warning('ANALYSIS', `Failed to analyze file ${filePath}`, { error: error.message });
        }
        return analysis;
    }
    /**
     * Extract class names from code content
     */
    extractClasses(content) {
        const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
        const classes = [];
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            classes.push(match[1]);
        }
        return classes;
    }
    /**
     * Extract function names from code content
     */
    extractFunctions(content) {
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
        const functions = [];
        let match;
        while ((match = functionRegex.exec(content)) !== null) {
            functions.push(match[1] || match[2]);
        }
        return functions;
    }
    /**
     * Extract import statements from code content
     */
    extractImports(content) {
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        const imports = [];
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    }
    /**
     * Get class content for comparison
     */
    getClassContent(content, className) {
        const classRegex = new RegExp(`class\\s+${className}[^{]*{`, 'g');
        const match = classRegex.exec(content);
        if (!match)
            return '';
        const startIndex = match.index;
        let braceCount = 0;
        let endIndex = startIndex;
        for (let i = startIndex; i < content.length; i++) {
            if (content[i] === '{')
                braceCount++;
            if (content[i] === '}')
                braceCount--;
            if (braceCount === 0 && i > startIndex) {
                endIndex = i + 1;
                break;
            }
        }
        return content.substring(startIndex, endIndex);
    }
    /**
     * Get function content for comparison
     */
    getFunctionContent(content, functionName) {
        const functionRegex = new RegExp(`function\\s+${functionName}[^{]*{|${functionName}\\s*\\([^)]*\\)\\s*{`, 'g');
        const match = functionRegex.exec(content);
        if (!match)
            return '';
        const startIndex = match.index;
        let braceCount = 0;
        let endIndex = startIndex;
        for (let i = startIndex; i < content.length; i++) {
            if (content[i] === '{')
                braceCount++;
            if (content[i] === '}')
                braceCount--;
            if (braceCount === 0 && i > startIndex) {
                endIndex = i + 1;
                break;
            }
        }
        return content.substring(startIndex, endIndex);
    }
    /**
     * Get all relevant files for tracking
     */
    async getAllRelevantFiles(projectPath) {
        try {
            const { stdout } = await execAsync(`find "${projectPath}" -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.py" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.h" | head -1000`);
            return stdout.trim().split('\n').filter(line => line.length > 0);
        }
        catch (error) {
            // Fallback for Windows or other systems
            return this.getFilesRecursively(projectPath, ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h']);
        }
    }
    /**
     * Recursively get files with specific extensions
     */
    async getFilesRecursively(dir, extensions) {
        const files = [];
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subFiles = await this.getFilesRecursively(fullPath, extensions);
                    files.push(...subFiles);
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        }
        catch (error) {
            // Directory not accessible, skip
        }
        return files.slice(0, 1000); // Limit to prevent excessive processing
    }
    /**
     * Check compilation status after changes
     */
    async checkCompilationStatus(projectPath) {
        try {
            // Check if there's a tsconfig.json or package.json with build script
            const tsconfigExists = await fs.promises.access(path.join(projectPath, 'tsconfig.json')).then(() => true).catch(() => false);
            const packageJsonExists = await fs.promises.access(path.join(projectPath, 'package.json')).then(() => true).catch(() => false);
            if (tsconfigExists) {
                // Try TypeScript compilation
                const { stderr } = await execAsync('npx tsc --noEmit', {
                    cwd: projectPath,
                    timeout: 30000
                });
                if (stderr) {
                    return { success: false, errors: [stderr] };
                }
            }
            else if (packageJsonExists) {
                // Try npm run build if available
                try {
                    const { stderr } = await execAsync('npm run build --if-present', {
                        cwd: projectPath,
                        timeout: 30000
                    });
                    if (stderr && stderr.includes('error')) {
                        return { success: false, errors: [stderr] };
                    }
                }
                catch (buildError) {
                    // Build script might not exist, that's ok
                }
            }
            return { success: true, errors: [] };
        }
        catch (error) {
            return { success: false, errors: [error.message] };
        }
    }
    /**
     * Clear snapshots to free memory
     */
    clearSnapshots() {
        this.beforeSnapshot.clear();
        this.afterSnapshot.clear();
        colored_logger_1.cliLogger.debug('SNAPSHOT', 'Snapshots cleared');
    }
}
exports.ClaudeCodeOutcomeAnalyzer = ClaudeCodeOutcomeAnalyzer;
exports.default = ClaudeCodeOutcomeAnalyzer;
//# sourceMappingURL=claude-code-outcome-analyzer.js.map