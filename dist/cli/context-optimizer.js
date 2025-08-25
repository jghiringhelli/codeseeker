"use strict";
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
exports.ContextOptimizer = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const logger_1 = require("../utils/logger");
const analyzer_1 = require("../shared/ast/analyzer");
class ContextOptimizer {
    logger = logger_1.Logger.getInstance();
    astAnalyzer = new analyzer_1.ASTAnalyzer();
    cache = new Map();
    async optimizeContext(request) {
        const cacheKey = this.getCacheKey(request);
        if (this.cache.has(cacheKey)) {
            this.logger.debug('Using cached context optimization');
            return this.cache.get(cacheKey);
        }
        this.logger.info(`Optimizing context for ${request.projectPath}`);
        const projectInfo = await this.analyzeProject({
            projectPath: request.projectPath,
            tokenBudget: request.tokenBudget,
            focusArea: request.focusArea
        });
        const optimization = {
            projectPath: request.projectPath,
            tokenBudget: request.tokenBudget,
            strategy: this.determineStrategy(request.contextType, projectInfo),
            estimatedTokens: 0,
            priorityFiles: [],
            projectInfo,
            focusArea: request.focusArea
        };
        // Select and prioritize files based on query and focus area
        optimization.priorityFiles = await this.selectPriorityFiles(request.projectPath, request.query, request.focusArea, optimization.strategy, request.tokenBudget);
        // Estimate total tokens
        optimization.estimatedTokens = await this.estimateTokenUsage(optimization.priorityFiles);
        // Detect architectural patterns
        optimization.detectedPatterns = await this.detectPatterns(optimization.priorityFiles);
        this.cache.set(cacheKey, optimization);
        this.logger.info(`Context optimized: ${optimization.priorityFiles.length} files, ~${optimization.estimatedTokens} tokens`);
        return optimization;
    }
    async analyzeProject(request) {
        this.logger.debug(`Analyzing project at ${request.projectPath}`);
        const allFiles = await this.getAllProjectFiles(request.projectPath);
        const primaryLanguage = this.detectPrimaryLanguage(allFiles);
        const projectType = this.detectProjectType(request.projectPath, allFiles);
        const framework = await this.detectFramework(request.projectPath, allFiles);
        const packageManager = await this.detectPackageManager(request.projectPath);
        let totalLinesOfCode = 0;
        for (const file of allFiles.slice(0, 100)) { // Sample first 100 files for LOC estimate
            try {
                const content = await fs.readFile(path.join(request.projectPath, file), 'utf-8');
                totalLinesOfCode += content.split('\n').length;
            }
            catch (error) {
                // Skip files that can't be read
            }
        }
        const projectInfo = {
            type: projectType,
            primaryLanguage,
            framework,
            packageManager,
            totalFiles: allFiles.length,
            totalLinesOfCode: Math.round(totalLinesOfCode * (allFiles.length / Math.min(100, allFiles.length)))
        };
        const result = {
            ...projectInfo,
            recommendations: this.generateRecommendations(projectInfo, request.focusArea)
        };
        return result;
    }
    async getAllProjectFiles(projectPath) {
        const patterns = [
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.go', '**/*.rs', '**/*.java',
            '**/*.md', '**/*.json', '**/*.yaml', '**/*.yml',
            '**/*.toml', '**/*.ini', '**/*.cfg'
        ];
        const ignore = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/coverage/**',
            '**/*.min.js',
            '**/*.map'
        ];
        return await (0, fast_glob_1.glob)(patterns, {
            cwd: projectPath,
            ignore,
            onlyFiles: true
        });
    }
    detectPrimaryLanguage(files) {
        const langCounts = {};
        files.forEach(file => {
            const ext = path.extname(file);
            const lang = this.getLanguageFromExtension(ext);
            langCounts[lang] = (langCounts[lang] || 0) + 1;
        });
        return Object.keys(langCounts).reduce((a, b) => langCounts[a] > langCounts[b] ? a : b) || 'unknown';
    }
    getLanguageFromExtension(ext) {
        const mapping = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp'
        };
        return mapping[ext] || 'other';
    }
    detectProjectType(projectPath, files) {
        const hasFile = (pattern) => files.some(f => f.includes(pattern));
        if (hasFile('package.json')) {
            if (hasFile('next.config') || hasFile('pages/') || hasFile('app/'))
                return 'web-app';
            if (hasFile('express') || hasFile('fastify') || hasFile('koa'))
                return 'api';
            if (hasFile('react-native') || hasFile('expo'))
                return 'mobile';
            if (hasFile('electron'))
                return 'desktop';
            return 'web-app';
        }
        if (hasFile('requirements.txt') || hasFile('pyproject.toml')) {
            if (hasFile('manage.py') || hasFile('wsgi.py'))
                return 'web-app';
            if (hasFile('main.py') && !hasFile('setup.py'))
                return 'cli';
            return 'library';
        }
        if (hasFile('Cargo.toml'))
            return 'cli';
        if (hasFile('go.mod'))
            return 'cli';
        return 'other';
    }
    async detectFramework(projectPath, files) {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            if (await fs.access(packageJsonPath).then(() => true).catch(() => false)) {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (deps.next)
                    return 'Next.js';
                if (deps.react)
                    return 'React';
                if (deps.vue)
                    return 'Vue.js';
                if (deps.angular)
                    return 'Angular';
                if (deps.express)
                    return 'Express.js';
                if (deps.fastify)
                    return 'Fastify';
            }
        }
        catch (error) {
            // Ignore errors
        }
        return undefined;
    }
    async detectPackageManager(projectPath) {
        const lockFiles = [
            { file: 'package-lock.json', manager: 'npm' },
            { file: 'yarn.lock', manager: 'yarn' },
            { file: 'pnpm-lock.yaml', manager: 'pnpm' },
            { file: 'requirements.txt', manager: 'pip' },
            { file: 'poetry.lock', manager: 'poetry' },
            { file: 'Cargo.lock', manager: 'cargo' }
        ];
        for (const { file, manager } of lockFiles) {
            try {
                await fs.access(path.join(projectPath, file));
                return manager;
            }
            catch {
                // File doesn't exist, continue
            }
        }
        return undefined;
    }
    determineStrategy(contextType, projectInfo) {
        if (contextType !== 'auto') {
            return contextType;
        }
        // Auto-determine based on project size
        if (projectInfo.totalFiles > 1000)
            return 'minimal';
        if (projectInfo.totalFiles > 100)
            return 'smart';
        return 'full';
    }
    async selectPriorityFiles(projectPath, query, focusArea, strategy, tokenBudget) {
        const allFiles = await this.getAllProjectFiles(projectPath);
        const scoredFiles = [];
        // Score files based on various factors
        for (const file of allFiles) {
            const score = await this.scoreFile(projectPath, file, query, focusArea);
            const language = this.getLanguageFromExtension(path.extname(file));
            scoredFiles.push({
                path: file,
                score,
                language,
                importance: this.getImportanceLevel(score)
            });
        }
        // Sort by score and apply strategy-specific filtering
        const sortedFiles = scoredFiles.sort((a, b) => b.score - a.score);
        let selectedFiles;
        switch (strategy) {
            case 'minimal':
                selectedFiles = sortedFiles.slice(0, 5);
                break;
            case 'full':
                selectedFiles = sortedFiles.slice(0, 50);
                break;
            case 'smart':
            default:
                selectedFiles = this.smartSelection(sortedFiles, tokenBudget || 8000);
                break;
        }
        // Add relevant sections for each selected file
        for (const file of selectedFiles) {
            file.relevantSections = await this.extractRelevantSections(projectPath, file.path, query, focusArea);
            file.summary = await this.generateFileSummary(projectPath, file.path);
        }
        return selectedFiles;
    }
    async scoreFile(projectPath, file, query, focusArea) {
        let score = 0;
        // Base score by file type
        const ext = path.extname(file);
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext))
            score += 10;
        if (['.py', '.go', '.rs', '.java'].includes(ext))
            score += 8;
        if (['.md', '.txt'].includes(ext))
            score += 2;
        if (['.json', '.yaml', '.yml'].includes(ext))
            score += 3;
        // Boost for important file names
        const fileName = path.basename(file, ext);
        const importantNames = ['index', 'main', 'app', 'server', 'config', 'types', 'interfaces'];
        if (importantNames.includes(fileName.toLowerCase()))
            score += 15;
        // Boost for files in important directories
        if (file.includes('/src/'))
            score += 5;
        if (file.includes('/lib/'))
            score += 4;
        if (file.includes('/components/'))
            score += 6;
        if (file.includes('/utils/') || file.includes('/helpers/'))
            score += 7;
        if (file.includes('/api/') || file.includes('/routes/'))
            score += 8;
        // Query relevance (simple keyword matching for now)
        if (query) {
            const queryWords = query.toLowerCase().split(/\s+/);
            const fileContent = file.toLowerCase();
            const matches = queryWords.filter(word => fileContent.includes(word)).length;
            score += matches * 5;
        }
        // Focus area relevance
        if (focusArea) {
            if (file.toLowerCase().includes(focusArea.toLowerCase())) {
                score += 20;
            }
        }
        return score;
    }
    getImportanceLevel(score) {
        if (score >= 30)
            return 'critical';
        if (score >= 20)
            return 'high';
        if (score >= 10)
            return 'medium';
        return 'low';
    }
    smartSelection(files, tokenBudget) {
        const selected = [];
        let estimatedTokens = 0;
        const maxTokensPerFile = tokenBudget * 0.15; // Max 15% of budget per file
        for (const file of files) {
            const estimatedFileTokens = Math.min(this.estimateFileTokens(file), maxTokensPerFile);
            if (estimatedTokens + estimatedFileTokens <= tokenBudget * 0.8) { // Use 80% of budget
                selected.push(file);
                estimatedTokens += estimatedFileTokens;
            }
            if (selected.length >= 20)
                break; // Max 20 files
        }
        return selected;
    }
    estimateFileTokens(file) {
        // Rough estimation based on typical file sizes
        const baseTokens = file.importance === 'critical' ? 800 :
            file.importance === 'high' ? 600 :
                file.importance === 'medium' ? 400 : 200;
        return baseTokens;
    }
    async extractRelevantSections(projectPath, file, query, focusArea) {
        try {
            const filePath = path.join(projectPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            // For now, return a simple implementation
            // In a full implementation, this would use AST parsing
            const sections = [];
            let currentSection = null;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Detect function/class/interface declarations
                if (this.isDeclarationLine(line)) {
                    if (currentSection) {
                        currentSection.endLine = i - 1;
                        sections.push(currentSection);
                    }
                    currentSection = {
                        startLine: i + 1,
                        endLine: i + 1,
                        content: line,
                        type: this.getDeclarationType(line),
                        relevanceScore: this.calculateRelevanceScore(line, query, focusArea)
                    };
                }
                else if (currentSection) {
                    currentSection.content += '\n' + line;
                    currentSection.endLine = i + 1;
                }
            }
            if (currentSection) {
                sections.push(currentSection);
            }
            // Return top relevant sections
            return sections
                .sort((a, b) => b.relevanceScore - a.relevanceScore)
                .slice(0, 5);
        }
        catch (error) {
            this.logger.warn(`Failed to extract sections from ${file}`, error);
            return [];
        }
    }
    isDeclarationLine(line) {
        const trimmed = line.trim();
        return /^(export\s+)?(function|class|interface|type|const|let|var)\s+/.test(trimmed) ||
            /^import\s+/.test(trimmed) ||
            /^export\s+/.test(trimmed);
    }
    getDeclarationType(line) {
        if (line.includes('function'))
            return 'function';
        if (line.includes('class'))
            return 'class';
        if (line.includes('interface'))
            return 'interface';
        if (line.includes('import'))
            return 'import';
        if (line.includes('export'))
            return 'export';
        return 'other';
    }
    calculateRelevanceScore(line, query, focusArea) {
        let score = 1;
        if (query) {
            const queryWords = query.toLowerCase().split(/\s+/);
            const lineText = line.toLowerCase();
            score += queryWords.filter(word => lineText.includes(word)).length * 2;
        }
        if (focusArea && line.toLowerCase().includes(focusArea.toLowerCase())) {
            score += 3;
        }
        return score;
    }
    async generateFileSummary(projectPath, file) {
        try {
            const filePath = path.join(projectPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            // Simple summary based on first few lines and exports
            const lines = content.split('\n').slice(0, 10);
            const exports = lines.filter(line => line.trim().startsWith('export'));
            if (exports.length > 0) {
                return `Contains ${exports.length} exports including: ${exports[0].substring(0, 50)}...`;
            }
            const firstMeaningfulLine = lines.find(line => line.trim() &&
                !line.trim().startsWith('//') &&
                !line.trim().startsWith('import'));
            return firstMeaningfulLine ?
                `Starts with: ${firstMeaningfulLine.substring(0, 50)}...` :
                'Code file - detailed analysis pending';
        }
        catch (error) {
            return 'Unable to generate summary';
        }
    }
    async estimateTokenUsage(files) {
        let totalTokens = 0;
        for (const file of files) {
            if (file.relevantSections) {
                for (const section of file.relevantSections) {
                    totalTokens += Math.ceil(section.content.length / 4); // ~4 chars per token
                }
            }
            else {
                totalTokens += this.estimateFileTokens(file);
            }
        }
        return totalTokens;
    }
    async detectPatterns(files) {
        const patterns = [];
        // Simple pattern detection - in a full implementation this would be more sophisticated
        const filesByLanguage = files.reduce((acc, file) => {
            acc[file.language] = (acc[file.language] || 0) + 1;
            return acc;
        }, {});
        if (filesByLanguage.typescript > 5) {
            patterns.push({
                name: 'TypeScript Project',
                description: 'Heavy use of TypeScript for type safety',
                confidence: 0.9,
                files: files.filter(f => f.language === 'typescript').map(f => f.path)
            });
        }
        const hasReactFiles = files.some(f => f.path.includes('component') || f.path.includes('jsx') || f.path.includes('tsx'));
        if (hasReactFiles) {
            patterns.push({
                name: 'React Application',
                description: 'Component-based React architecture',
                confidence: 0.8,
                files: files.filter(f => f.path.includes('component') || f.path.endsWith('.tsx') || f.path.endsWith('.jsx')).map(f => f.path)
            });
        }
        return patterns;
    }
    generateRecommendations(projectInfo, focusArea) {
        const recommendations = [];
        if (projectInfo.totalFiles > 500) {
            recommendations.push('Consider using minimal context mode for large projects');
        }
        if (projectInfo.primaryLanguage === 'typescript') {
            recommendations.push('Focus on type definitions and interfaces for better context');
        }
        if (focusArea) {
            recommendations.push(`Optimizing context for focus area: ${focusArea}`);
        }
        return recommendations;
    }
    getCacheKey(request) {
        return `${request.projectPath}:${request.query || ''}:${request.contextType}:${request.focusArea || ''}:${request.tokenBudget}`;
    }
    clearCache() {
        this.cache.clear();
        this.logger.info('Context optimization cache cleared');
    }
}
exports.ContextOptimizer = ContextOptimizer;
exports.default = ContextOptimizer;
//# sourceMappingURL=context-optimizer.js.map