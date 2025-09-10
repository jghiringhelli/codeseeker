"use strict";
/**
 * Comprehensive Change Assessment System
 * Analyzes codebase changes after CLI requests and updates all tool databases
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
exports.ChangeAssessmentSystem = void 0;
const tool_interface_1 = require("./tool-interface");
const logger_1 = require("./logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class ChangeAssessmentSystem {
    logger;
    claudeCodeApiUrl;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.claudeCodeApiUrl = process.env.CLAUDE_CODE_API_URL || 'http://localhost:3007';
    }
    /**
     * Main method to assess changes and update all tools
     */
    async assessChangesAndUpdateTools(request) {
        this.logger.info(`📊 Assessing changes for project: ${request.projectId}`);
        try {
            // Step 1: Capture current project state if not provided
            const afterState = request.afterState || await this.captureProjectState(request.projectPath);
            // Step 2: Analyze changes using Claude Code
            const claudeAnalysis = await this.analyzeChangesWithClaudeCode(request, afterState);
            // Step 3: Detect file and structural changes
            const changeDetails = await this.detectChanges(request, afterState);
            // Step 4: Calculate code metrics changes
            const metricsChanges = await this.calculateMetricsChanges(request, afterState);
            // Step 5: Update all tools with change information
            const toolUpdates = await this.updateAllToolsWithChanges(request, changeDetails, claudeAnalysis);
            // Step 6: Assess overall impact
            const overallImpact = this.assessOverallImpact(changeDetails, metricsChanges, claudeAnalysis);
            // Step 7: Generate assessment summary
            const assessmentSummary = await this.generateAssessmentSummary(changeDetails, claudeAnalysis, toolUpdates);
            const result = {
                filesChanged: changeDetails.filesChanged,
                structuralChanges: changeDetails.structuralChanges,
                codeMetrics: metricsChanges,
                toolUpdates,
                overallImpact,
                assessmentSummary
            };
            this.logger.info(`✅ Change assessment completed: ${result.filesChanged.length} files changed, ${toolUpdates.size} tools updated`);
            return result;
        }
        catch (error) {
            this.logger.error('❌ Change assessment failed:', error);
            throw error;
        }
    }
    /**
     * Capture current state of the project
     */
    async captureProjectState(projectPath) {
        const state = {
            fileCount: 0,
            totalLines: 0,
            languages: [],
            lastModified: new Date(),
            fileHashes: new Map(),
            directoryStructure: {}
        };
        try {
            // Get git hash if available
            try {
                state.gitHash = (0, child_process_1.execSync)('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
            }
            catch {
                // Not a git repo or git not available
            }
            // Analyze project files
            await this.analyzeProjectFiles(projectPath, state);
            return state;
        }
        catch (error) {
            this.logger.warn('Could not fully capture project state:', error);
            return state;
        }
    }
    /**
     * Analyze all files in the project
     */
    async analyzeProjectFiles(projectPath, state) {
        const walkDir = (dir, relativeBase = '') => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relativePath = path.join(relativeBase, item);
                // Skip common ignored directories
                if (['.git', 'node_modules', '.vscode', 'dist', 'build'].includes(item)) {
                    continue;
                }
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    state.directoryStructure[relativePath] = 'directory';
                    walkDir(fullPath, relativePath);
                }
                else if (stat.isFile()) {
                    state.fileCount++;
                    // Track file hash for change detection
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const hash = this.simpleHash(content);
                    state.fileHashes.set(relativePath, hash);
                    // Count lines
                    const lines = content.split('\n').length;
                    state.totalLines += lines;
                    // Track languages
                    const ext = path.extname(item).toLowerCase();
                    const language = this.getLanguageFromExtension(ext);
                    if (language && !state.languages.includes(language)) {
                        state.languages.push(language);
                    }
                    state.directoryStructure[relativePath] = {
                        type: 'file',
                        size: stat.size,
                        lines,
                        language,
                        lastModified: stat.mtime
                    };
                }
            }
        };
        walkDir(projectPath);
    }
    /**
     * Simple hash function for change detection
     */
    simpleHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    /**
     * Get programming language from file extension
     */
    getLanguageFromExtension(ext) {
        const languageMap = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cs': 'C#',
            '.cpp': 'C++',
            '.c': 'C',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.json': 'JSON',
            '.yml': 'YAML',
            '.yaml': 'YAML',
            '.md': 'Markdown',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.sql': 'SQL'
        };
        return languageMap[ext] || null;
    }
    /**
     * Analyze changes using Claude Code
     */
    async analyzeChangesWithClaudeCode(request, afterState) {
        try {
            const analysisPrompt = this.buildChangeAnalysisPrompt(request, afterState);
            const response = await fetch(`${this.claudeCodeApiUrl}/api/analyze-changes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: analysisPrompt,
                    projectPath: request.projectPath,
                    maxTokens: 2000
                })
            });
            if (!response.ok) {
                throw new Error(`Claude Code API error: ${response.status}`);
            }
            const result = await response.json();
            return {
                success: true,
                changes: result.changes || [],
                insights: result.insights || [],
                recommendations: result.recommendations || [],
                quality: result.quality || { before: 7, after: 7, improvement: 0 },
                tokensSaved: result.tokensSaved || 0,
                executionTime: result.executionTime || 0
            };
        }
        catch (error) {
            this.logger.warn('Claude Code analysis unavailable, using fallback');
            return {
                success: false,
                changes: [],
                insights: ['Change analysis completed without Claude Code integration'],
                recommendations: [],
                quality: { before: 7, after: 7, improvement: 0 },
                executionTime: 0
            };
        }
    }
    /**
     * Build analysis prompt for Claude Code
     */
    buildChangeAnalysisPrompt(request, afterState) {
        return `
TASK: Analyze Codebase Changes After CLI Request

USER QUERY: "${request.userQuery}"
CLI COMMAND: ${request.cliCommand}
PROJECT PATH: ${request.projectPath}

CURRENT PROJECT STATE:
- Files: ${afterState.fileCount}
- Total Lines: ${afterState.totalLines}
- Languages: ${afterState.languages.join(', ')}
- Git Hash: ${afterState.gitHash || 'N/A'}

CONTEXT:
The user just executed a CodeMind CLI command. Please analyze what changes might have occurred
and assess the impact on the codebase.

ANALYSIS FOCUS:
1. What types of changes would this CLI command typically produce?
2. How might the codebase quality have been affected?
3. What insights can be gleaned about the user's intent?
4. What follow-up actions or improvements are recommended?

RESPONSE FORMAT (JSON):
{
  "changes": [
    {"type": "file_modification", "description": "Description of change", "impact": "positive/negative/neutral"}
  ],
  "insights": ["Insight 1", "Insight 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "quality": {
    "before": 7.5,
    "after": 8.0,
    "improvement": 0.5
  },
  "tokensSaved": 150
}

Provide actionable insights that can help improve the codebase and user experience.
`;
    }
    /**
     * Detect file and structural changes
     */
    async detectChanges(request, afterState) {
        const filesChanged = [];
        const structuralChanges = [];
        if (request.beforeState) {
            // Compare before and after states
            const beforeFiles = request.beforeState.fileHashes;
            const afterFiles = afterState.fileHashes;
            // Find added, modified, and deleted files
            for (const [filePath, hash] of afterFiles) {
                if (!beforeFiles.has(filePath)) {
                    filesChanged.push({
                        path: filePath,
                        changeType: 'added',
                        linesAdded: afterState.directoryStructure[filePath]?.lines || 0,
                        linesRemoved: 0,
                        language: afterState.directoryStructure[filePath]?.language || 'unknown'
                    });
                }
                else if (beforeFiles.get(filePath) !== hash) {
                    filesChanged.push({
                        path: filePath,
                        changeType: 'modified',
                        linesAdded: 5, // Estimate - would need deeper analysis
                        linesRemoved: 2,
                        language: afterState.directoryStructure[filePath]?.language || 'unknown'
                    });
                }
            }
            // Find deleted files
            for (const [filePath] of beforeFiles) {
                if (!afterFiles.has(filePath)) {
                    filesChanged.push({
                        path: filePath,
                        changeType: 'deleted',
                        linesAdded: 0,
                        linesRemoved: request.beforeState.directoryStructure[filePath]?.lines || 0,
                        language: request.beforeState.directoryStructure[filePath]?.language || 'unknown'
                    });
                }
            }
            // Detect structural changes
            const beforeDirs = Object.keys(request.beforeState.directoryStructure);
            const afterDirs = Object.keys(afterState.directoryStructure);
            const addedDirs = afterDirs.filter(dir => !beforeDirs.includes(dir));
            const removedDirs = beforeDirs.filter(dir => !afterDirs.includes(dir));
            addedDirs.forEach(dir => {
                if (afterState.directoryStructure[dir] === 'directory') {
                    structuralChanges.push({
                        type: 'directory_added',
                        details: `New directory: ${dir}`
                    });
                }
            });
            removedDirs.forEach(dir => {
                if (request.beforeState.directoryStructure[dir] === 'directory') {
                    structuralChanges.push({
                        type: 'directory_removed',
                        details: `Removed directory: ${dir}`
                    });
                }
            });
        }
        return { filesChanged, structuralChanges };
    }
    /**
     * Calculate changes in code metrics
     */
    async calculateMetricsChanges(request, afterState) {
        // Simplified metrics calculation - in real implementation, would use actual analysis tools
        const complexityChange = Math.random() * 10 - 5; // -5 to +5 change
        const duplicatedLinesChange = Math.random() * 20 - 10; // -10 to +10 lines
        const testCoverageChange = Math.random() * 10 - 2; // -2% to +8% change
        return {
            complexityChange,
            duplicatedLinesChange,
            testCoverageChange
        };
    }
    /**
     * Update all tools with change information
     */
    async updateAllToolsWithChanges(request, changeDetails, claudeAnalysis) {
        const updates = new Map();
        const allTools = tool_interface_1.ToolRegistry.getAllTools();
        const updateData = {
            ...request.claudeCodeResult,
            success: claudeAnalysis.success,
            filesChanged: changeDetails.filesChanged,
            structuralChanges: changeDetails.structuralChanges,
            insights: claudeAnalysis.insights,
            recommendations: claudeAnalysis.recommendations,
            qualityImprovement: claudeAnalysis.quality.improvement
        };
        for (const tool of allTools) {
            try {
                const metadata = tool.getMetadata();
                this.logger.info(`  🔄 Updating ${metadata.name} with change analysis...`);
                const updateResult = await tool.updateAfterCliRequest(request.projectPath, request.projectId, `change-assessment: ${request.cliCommand}`, updateData);
                updates.set(metadata.name, updateResult);
            }
            catch (error) {
                this.logger.warn(`⚠️ Failed to update ${tool.getMetadata().name}:`, error);
                updates.set(tool.getMetadata().name, {
                    success: false,
                    updated: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return updates;
    }
    /**
     * Assess overall impact of changes
     */
    assessOverallImpact(changeDetails, metricsChanges, claudeAnalysis) {
        let impactScore = 0;
        // File changes impact
        const totalChanges = changeDetails.filesChanged.length;
        if (totalChanges > 10)
            impactScore += 3;
        else if (totalChanges > 5)
            impactScore += 2;
        else if (totalChanges > 0)
            impactScore += 1;
        // Structural changes impact
        if (changeDetails.structuralChanges.length > 0)
            impactScore += 2;
        // Quality improvement impact
        if (claudeAnalysis.quality.improvement > 1)
            impactScore += 2;
        else if (claudeAnalysis.quality.improvement > 0.5)
            impactScore += 1;
        else if (claudeAnalysis.quality.improvement < -0.5)
            impactScore += 3; // Negative impact
        // Metrics changes impact
        if (Math.abs(metricsChanges.complexityChange) > 5)
            impactScore += 1;
        if (Math.abs(metricsChanges.duplicatedLinesChange) > 50)
            impactScore += 1;
        if (impactScore >= 6)
            return 'high';
        if (impactScore >= 3)
            return 'medium';
        return 'low';
    }
    /**
     * Generate comprehensive assessment summary
     */
    async generateAssessmentSummary(changeDetails, claudeAnalysis, toolUpdates) {
        const summary = [];
        summary.push(`📊 CHANGE ASSESSMENT SUMMARY`);
        summary.push(`Files Changed: ${changeDetails.filesChanged.length}`);
        summary.push(`Structural Changes: ${changeDetails.structuralChanges.length}`);
        if (claudeAnalysis.success) {
            summary.push(`Quality Change: ${claudeAnalysis.quality.improvement >= 0 ? '+' : ''}${claudeAnalysis.quality.improvement.toFixed(1)}`);
        }
        const successfulUpdates = Array.from(toolUpdates.values()).filter(u => u.success).length;
        summary.push(`Tools Updated: ${successfulUpdates}/${toolUpdates.size}`);
        if (claudeAnalysis.insights.length > 0) {
            summary.push(`\nKey Insights:`);
            claudeAnalysis.insights.slice(0, 3).forEach(insight => {
                summary.push(`• ${insight}`);
            });
        }
        if (claudeAnalysis.recommendations.length > 0) {
            summary.push(`\nRecommendations:`);
            claudeAnalysis.recommendations.slice(0, 2).forEach(rec => {
                summary.push(`• ${rec}`);
            });
        }
        return summary.join('\n');
    }
}
exports.ChangeAssessmentSystem = ChangeAssessmentSystem;
//# sourceMappingURL=change-assessment-system.js.map