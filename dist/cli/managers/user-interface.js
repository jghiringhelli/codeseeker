"use strict";
/**
 * UserInterface - Handles all user interaction, prompts, and display
 * Single Responsibility: User interface and interaction
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInterface = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const theme_1 = require("../ui/theme");
class UserInterface {
    /**
     * Get project initialization options from user
     */
    async getProjectInitOptions() {
        const path = require('path');
        // Use user's original working directory (set by bin/codemind.js)
        const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
        const defaultProjectName = path.basename(userCwd);
        const answers = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name:',
                default: defaultProjectName,
                validate: (input) => input.trim().length > 0 || 'Project name is required'
            },
            {
                type: 'list',
                name: 'projectType',
                message: 'Project type:',
                choices: [
                    { name: 'Web Application', value: 'web_app' },
                    { name: 'Mobile Application', value: 'mobile_app' },
                    { name: 'Desktop Application', value: 'desktop_app' },
                    { name: 'Library/Framework', value: 'library' },
                    { name: 'API/Microservice', value: 'api' },
                    { name: 'CLI Tool', value: 'cli' },
                    { name: 'Other', value: 'other' }
                ]
            },
            {
                type: 'checkbox',
                name: 'features',
                message: 'Select features to enable:',
                choices: [
                    { name: 'Semantic Search', value: 'semantic_search', checked: true },
                    { name: 'Architecture Analysis', value: 'architecture', checked: true },
                    { name: 'Use Cases Inference', value: 'usecases', checked: true },
                    { name: 'Code Quality Analysis', value: 'quality', checked: true },
                    { name: 'Dependency Graph', value: 'dependencies', checked: true },
                    { name: 'Performance Monitoring', value: 'performance' }
                ]
            }
        ]);
        return answers;
    }
    /**
     * Display comprehensive help information
     */
    displayHelp() {
        console.log(theme_1.Theme.colors.primary('\n🤖 CodeMind CLI - Intelligent Code Assistant'));
        console.log(theme_1.Theme.colors.border('═'.repeat(60)));
        console.log(theme_1.Theme.colors.secondary('\n📋 COMMANDS'));
        console.log(theme_1.Theme.colors.info('  /setup          Initialize infrastructure (Docker, databases)'));
        console.log(theme_1.Theme.colors.info('  /init [--reset] Initialize current directory as CodeMind project'));
        console.log(theme_1.Theme.colors.info('  /status         Show system and project status'));
        console.log(theme_1.Theme.colors.info('  /project        Project management (switch, info)'));
        console.log(theme_1.Theme.colors.info('  /search <query> Semantic search across project'));
        console.log(theme_1.Theme.colors.info('  /analyze        Re-analyze project with Claude Code'));
        console.log(theme_1.Theme.colors.info('  /dedup <path>   Granular duplicate code analysis and merging'));
        console.log(theme_1.Theme.colors.info('  /solid <path>   SOLID principles analysis and refactoring'));
        console.log(theme_1.Theme.colors.info('  /docs <path>    Package documentation and ADR generation'));
        console.log(theme_1.Theme.colors.info('  /sync [cmd]     Sync semantic search and graph with code changes'));
        console.log(theme_1.Theme.colors.info('  /instructions   Manage CODEMIND.md project instructions'));
        console.log(theme_1.Theme.colors.info('  /help           Show this help message'));
        console.log(theme_1.Theme.colors.info('  /exit           Exit CodeMind CLI'));
        console.log(theme_1.Theme.colors.secondary('\n🔍 PATH-BASED ANALYSIS COMMANDS'));
        console.log(theme_1.Theme.colors.muted('  /dedup /src              Analyze duplicates in /src directory (recursive)'));
        console.log(theme_1.Theme.colors.muted('  /dedup file.ts           Analyze single file'));
        console.log(theme_1.Theme.colors.muted('  /dedup /utils --nr       Analyze /utils directory (non-recursive)'));
        console.log(theme_1.Theme.colors.muted(''));
        console.log(theme_1.Theme.colors.muted('  /solid /                 Analyze entire project for SOLID violations'));
        console.log(theme_1.Theme.colors.muted('  /solid /src/services     Analyze services directory only'));
        console.log(theme_1.Theme.colors.muted('  /solid file.ts           Analyze single file'));
        console.log(theme_1.Theme.colors.muted(''));
        console.log(theme_1.Theme.colors.muted('  /docs /                  Generate docs for entire project'));
        console.log(theme_1.Theme.colors.muted('  /docs /src/api          Generate docs for API package'));
        console.log(theme_1.Theme.colors.muted(''));
        console.log(theme_1.Theme.colors.muted('  /sync run               Intelligent incremental sync'));
        console.log(theme_1.Theme.colors.muted('  /sync check             Quick sync status check'));
        console.log(theme_1.Theme.colors.muted('  /sync force             Force full rebuild of semantic data'));
        console.log(theme_1.Theme.colors.muted('  /sync watch start       Start real-time file watcher'));
        console.log(theme_1.Theme.colors.muted('  /sync watch stop        Stop file watcher'));
        console.log(theme_1.Theme.colors.muted(''));
        console.log(theme_1.Theme.colors.muted('  📁 Paths: "/" = project root, relative paths supported'));
        console.log(theme_1.Theme.colors.muted('  🔄 Flags: --no-recursive (--nr) to disable recursive scanning'));
        console.log(theme_1.Theme.colors.secondary('\n📋 INSTRUCTION COMMANDS'));
        console.log(theme_1.Theme.colors.muted('  /instructions show     Display current CODEMIND.md instructions'));
        console.log(theme_1.Theme.colors.muted('  /instructions create   Generate sample CODEMIND.md file'));
        console.log(theme_1.Theme.colors.muted('  /instructions edit     Open CODEMIND.md in default editor'));
        console.log(theme_1.Theme.colors.muted('  /instructions reload   Refresh instruction cache'));
        console.log(theme_1.Theme.colors.muted(''));
        console.log(theme_1.Theme.colors.muted('  CODEMIND.md provides project-specific guidance (like Claude Code\'s CLAUDE.md)'));
        console.log(theme_1.Theme.colors.muted('  and supports cascading from global, project, directory, and local sources.'));
        console.log(theme_1.Theme.colors.secondary('\n🤖 NATURAL LANGUAGE'));
        console.log(theme_1.Theme.colors.muted('  Just type your request in natural language:'));
        console.log(theme_1.Theme.colors.info('  "Add a login system with JWT authentication"'));
        console.log(theme_1.Theme.colors.info('  "Refactor the user service to follow SOLID principles"'));
        console.log(theme_1.Theme.colors.info('  "Find and fix potential security vulnerabilities"'));
        console.log(theme_1.Theme.colors.info('  "Write unit tests for the payment module"'));
        console.log(theme_1.Theme.colors.secondary('\n🚀 WORKFLOW'));
        console.log(theme_1.Theme.colors.muted('  1. Run "/setup" (one-time setup)'));
        console.log(theme_1.Theme.colors.muted('  2. Navigate to your project directory'));
        console.log(theme_1.Theme.colors.muted('  3. Run "/init" to analyze and register your project'));
        console.log(theme_1.Theme.colors.muted('  4. Start making requests in natural language'));
        console.log(theme_1.Theme.colors.secondary('\n⌨️ KEYBOARD SHORTCUTS'));
        console.log(theme_1.Theme.colors.interrupt('  Ctrl+Z        '));
        console.log(theme_1.Theme.colors.muted('                Interrupt running operations (like Escape in Claude Code)'));
        console.log(theme_1.Theme.colors.interrupt('  Ctrl+C        '));
        console.log(theme_1.Theme.colors.muted('                Graceful exit (press twice to force exit)'));
        console.log(theme_1.Theme.colors.interrupt('  Ctrl+U        '));
        console.log(theme_1.Theme.colors.muted('                Clear current input line'));
        console.log(theme_1.Theme.colors.muted(''));
        console.log(theme_1.Theme.colors.claudeCode('  🤖 '));
        console.log(theme_1.Theme.colors.muted('                Claude Code output (distinctive orange color)'));
        console.log(theme_1.Theme.colors.muted('                Real-time forwarding from Claude Code processes'));
        console.log(theme_1.Theme.colors.border('\n' + '═'.repeat(60)));
    }
    /**
     * Display processing results from Claude Code
     */
    displayProcessingResults(data) {
        console.log(theme_1.Theme.colors.result('\n📋 Processing Results:'));
        if (data.files_modified && data.files_modified.length > 0) {
            console.log(theme_1.Theme.colors.success(`📝 Files Modified: ${data.files_modified.length}`));
            data.files_modified.forEach((file) => {
                console.log(theme_1.Theme.colors.muted(`   • ${file}`));
            });
        }
        if (data.tests_run) {
            const testColor = data.tests_run.passed === data.tests_run.total ?
                theme_1.Theme.colors.success : theme_1.Theme.colors.warning;
            console.log(testColor(`🧪 Tests: ${data.tests_run.passed}/${data.tests_run.total} passed`));
        }
        if (data.quality_score) {
            const scoreColor = data.quality_score >= 8 ? theme_1.Theme.colors.success :
                data.quality_score >= 6 ? theme_1.Theme.colors.warning : theme_1.Theme.colors.error;
            console.log(scoreColor(`⭐ Quality Score: ${data.quality_score}/10`));
        }
        if (data.summary) {
            console.log(theme_1.Theme.colors.result(`\n📄 Summary: ${data.summary}`));
        }
        if (data.recommendations && data.recommendations.length > 0) {
            console.log(theme_1.Theme.colors.info('\n💡 Recommendations:'));
            data.recommendations.forEach((rec) => {
                console.log(theme_1.Theme.colors.muted(`   • ${rec}`));
            });
        }
    }
    /**
     * Display search results
     */
    displaySearchResults(results) {
        console.log(theme_1.Theme.colors.primary(`\n🔍 Search Results (${results.length} found)`));
        console.log(theme_1.Theme.colors.border('─'.repeat(60)));
        if (results.length === 0) {
            console.log(theme_1.Theme.colors.muted('No results found. Try different search terms.'));
            return;
        }
        results.forEach((result, index) => {
            const relevanceBar = '█'.repeat(Math.floor(result.relevance * 10));
            console.log(theme_1.Theme.colors.secondary(`\n${index + 1}. ${result.file}`));
            console.log(theme_1.Theme.colors.info(`   Relevance: ${relevanceBar} ${Math.round(result.relevance * 100)}%`));
            console.log(theme_1.Theme.colors.muted(`   ${result.summary}`));
        });
    }
    /**
     * Display analysis results
     */
    displayAnalysisResults(analysis) {
        console.log(theme_1.Theme.colors.primary('\n🔍 Project Analysis Results'));
        console.log(theme_1.Theme.colors.border('═'.repeat(60)));
        // Architecture
        console.log(theme_1.Theme.colors.secondary('\n🏗️  Architecture:'));
        console.log(theme_1.Theme.colors.info(`   Type: ${analysis.architecture.type}`));
        if (analysis.architecture.patterns.length > 0) {
            console.log(theme_1.Theme.colors.info(`   Patterns: ${analysis.architecture.patterns.join(', ')}`));
        }
        if (analysis.architecture.frameworks.length > 0) {
            console.log(theme_1.Theme.colors.info(`   Frameworks: ${analysis.architecture.frameworks.join(', ')}`));
        }
        // Dependencies
        console.log(theme_1.Theme.colors.secondary('\n🔗 Dependencies:'));
        console.log(theme_1.Theme.colors.info(`   Files analyzed: ${analysis.dependencies.files.length}`));
        console.log(theme_1.Theme.colors.info(`   Relationships: ${analysis.dependencies.relationships.length}`));
        // Use Cases
        if (analysis.useCases.length > 0) {
            console.log(theme_1.Theme.colors.secondary('\n📋 Use Cases:'));
            analysis.useCases.slice(0, 5).forEach((useCase, index) => {
                console.log(theme_1.Theme.colors.info(`   ${index + 1}. ${useCase.name}`));
                console.log(theme_1.Theme.colors.muted(`      ${useCase.description}`));
            });
            if (analysis.useCases.length > 5) {
                console.log(theme_1.Theme.colors.muted(`   ... and ${analysis.useCases.length - 5} more`));
            }
        }
        // Code Quality
        console.log(theme_1.Theme.colors.secondary('\n⭐ Code Quality:'));
        const scoreColor = analysis.codeQuality.score >= 8 ? theme_1.Theme.colors.success :
            analysis.codeQuality.score >= 6 ? theme_1.Theme.colors.warning : theme_1.Theme.colors.error;
        console.log(scoreColor(`   Score: ${analysis.codeQuality.score}/10`));
        if (analysis.codeQuality.issues.length > 0) {
            console.log(theme_1.Theme.colors.warning('   Issues:'));
            analysis.codeQuality.issues.slice(0, 3).forEach((issue) => {
                console.log(theme_1.Theme.colors.muted(`     • ${issue}`));
            });
        }
        if (analysis.codeQuality.recommendations.length > 0) {
            console.log(theme_1.Theme.colors.info('   Recommendations:'));
            analysis.codeQuality.recommendations.slice(0, 3).forEach((rec) => {
                console.log(theme_1.Theme.colors.muted(`     • ${rec}`));
            });
        }
    }
    /**
     * Display project information
     */
    displayProjectInfo(projectInfo) {
        if (!projectInfo) {
            console.log(theme_1.Theme.colors.warning('No project information available'));
            return;
        }
        console.log(theme_1.Theme.colors.primary('\n📊 Project Information'));
        console.log(theme_1.Theme.colors.border('═'.repeat(60)));
        console.log(theme_1.Theme.colors.secondary('Basic Info:'));
        console.log(theme_1.Theme.colors.info(`   Name: ${projectInfo.project_name}`));
        console.log(theme_1.Theme.colors.info(`   Type: ${projectInfo.project_type}`));
        if (projectInfo.languages) {
            const languages = JSON.parse(projectInfo.languages || '[]');
            console.log(theme_1.Theme.colors.info(`   Languages: ${languages.join(', ')}`));
        }
        if (projectInfo.frameworks) {
            const frameworks = JSON.parse(projectInfo.frameworks || '[]');
            console.log(theme_1.Theme.colors.info(`   Frameworks: ${frameworks.join(', ')}`));
        }
        console.log(theme_1.Theme.colors.secondary('\nStatistics:'));
        console.log(theme_1.Theme.colors.info(`   Total Files: ${projectInfo.total_files || 0}`));
        if (projectInfo.statistics) {
            console.log(theme_1.Theme.colors.info(`   Embeddings: ${projectInfo.statistics.embeddings || 0}`));
            console.log(theme_1.Theme.colors.info(`   Last Analyzed: ${new Date(projectInfo.statistics.lastAnalyzed).toLocaleDateString()}`));
        }
        console.log(theme_1.Theme.colors.secondary('\nTimestamps:'));
        console.log(theme_1.Theme.colors.muted(`   Created: ${new Date(projectInfo.created_at).toLocaleString()}`));
        console.log(theme_1.Theme.colors.muted(`   Updated: ${new Date(projectInfo.updated_at).toLocaleString()}`));
    }
    /**
     * Display a spinner or progress indicator
     */
    showProgress(message) {
        console.log(theme_1.Theme.colors.info(`🔄 ${message}`));
    }
    /**
     * Display success message
     */
    showSuccess(message) {
        console.log(theme_1.Theme.colors.success(`✅ ${message}`));
    }
    /**
     * Display error message
     */
    showError(message) {
        console.log(theme_1.Theme.colors.error(`❌ ${message}`));
    }
    /**
     * Display warning message
     */
    showWarning(message) {
        console.log(theme_1.Theme.colors.warning(`⚠️  ${message}`));
    }
    /**
     * Show a confirmation prompt to the user
     */
    async confirm(message) {
        const answer = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirmed',
                message: message,
                default: false
            }
        ]);
        return answer.confirmed;
    }
    /**
     * Ask user to choose from multiple options when project is already initialized
     */
    async getInitializationAction(projectName) {
        console.log(theme_1.Theme.colors.warning(`\n⚠️  Project "${projectName}" is already initialized in CodeMind.`));
        console.log(theme_1.Theme.colors.info('\nWhat would you like to do?'));
        const choices = [
            { name: 'Sync - Update only changed files (recommended)', value: 'sync' },
            { name: 'Skip - Keep existing data unchanged', value: 'skip' },
            { name: 'Reinitialize - Clear all data and start fresh', value: 'reinitialize' }
        ];
        const answer = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Choose an action:',
                choices,
                default: 'sync'
            }
        ]);
        console.log(theme_1.Theme.colors.info('\n💡 Tip: You can skip this prompt next time by using:'));
        console.log(theme_1.Theme.colors.muted(`   /init --${answer.action === 'reinitialize' ? 'reinit' : answer.action}`));
        return answer.action;
    }
    /**
     * Display deduplication report with detailed findings
     */
    displayDeduplicationReport(report) {
        console.log(theme_1.Theme.colors.primary('\n🔍 Duplicate Code Analysis Report'));
        console.log(theme_1.Theme.colors.border('═'.repeat(60)));
        // Summary statistics
        console.log(theme_1.Theme.colors.secondary('\nSummary:'));
        console.log(theme_1.Theme.colors.info(`   📊 Total code chunks analyzed: ${report.totalChunksAnalyzed}`));
        console.log(theme_1.Theme.colors.info(`   🔍 Duplicate groups found: ${report.duplicateGroups.length}`));
        if (report.summary.exactDuplicates > 0) {
            console.log(theme_1.Theme.colors.warning(`   🎯 Exact duplicates: ${report.summary.exactDuplicates} groups`));
        }
        if (report.summary.semanticDuplicates > 0) {
            console.log(theme_1.Theme.colors.info(`   🧠 Semantic duplicates: ${report.summary.semanticDuplicates} groups`));
        }
        if (report.summary.structuralDuplicates > 0) {
            console.log(theme_1.Theme.colors.muted(`   🏗️  Structural duplicates: ${report.summary.structuralDuplicates} groups`));
        }
        if (report.summary.totalLinesAffected > 0) {
            console.log(theme_1.Theme.colors.warning(`   📏 Total lines affected: ${report.summary.totalLinesAffected}`));
            console.log(theme_1.Theme.colors.success(`   💾 Potential lines saved: ${report.summary.potentialSavings}`));
        }
        // Detailed duplicate groups
        if (report.duplicateGroups.length > 0) {
            console.log(theme_1.Theme.colors.secondary('\nDuplicate Groups:'));
            report.duplicateGroups.slice(0, 10).forEach((group, index) => {
                const typeIcon = group.type === 'exact' ? '🎯' : group.type === 'semantic' ? '🧠' : '🏗️';
                const similarity = (group.similarity * 100).toFixed(1);
                console.log(theme_1.Theme.colors.result(`\n   ${typeIcon} Group ${index + 1}: ${similarity}% similarity (${group.type})`));
                console.log(theme_1.Theme.colors.muted(`      Type: ${group.chunks[0].type}`));
                console.log(theme_1.Theme.colors.muted(`      Instances: ${group.chunks.length}`));
                console.log(theme_1.Theme.colors.muted(`      Files affected: ${group.estimatedSavings.filesAffected}`));
                console.log(theme_1.Theme.colors.muted(`      Potential savings: ${group.estimatedSavings.linesReduced} lines`));
                if (group.consolidationSuggestion) {
                    console.log(theme_1.Theme.colors.info(`      💡 Suggestion: ${group.consolidationSuggestion}`));
                }
                // Show file locations
                group.chunks.slice(0, 3).forEach((chunk) => {
                    const fileName = chunk.filePath.split(/[/\\]/).pop();
                    console.log(theme_1.Theme.colors.muted(`         📄 ${fileName}:${chunk.startLine}-${chunk.endLine}`));
                });
                if (group.chunks.length > 3) {
                    console.log(theme_1.Theme.colors.muted(`         ... and ${group.chunks.length - 3} more locations`));
                }
            });
            if (report.duplicateGroups.length > 10) {
                console.log(theme_1.Theme.colors.muted(`\n   ... and ${report.duplicateGroups.length - 10} more duplicate groups`));
            }
        }
        // Recommendations
        if (report.recommendations.length > 0) {
            console.log(theme_1.Theme.colors.secondary('\n💡 Recommendations:'));
            report.recommendations.forEach((rec) => {
                console.log(theme_1.Theme.colors.info(`   • ${rec}`));
            });
        }
        console.log(theme_1.Theme.colors.border('\n' + '═'.repeat(60)));
    }
    /**
     * Display consolidation summary after automatic consolidation
     */
    displayConsolidationSummary(summary) {
        console.log(theme_1.Theme.colors.primary('\n🔄 Code Consolidation Summary'));
        console.log(theme_1.Theme.colors.border('═'.repeat(60)));
        // Overall results
        console.log(theme_1.Theme.colors.secondary('\nResults:'));
        console.log(theme_1.Theme.colors.info(`   📊 Groups processed: ${summary.totalGroupsProcessed}`));
        console.log(theme_1.Theme.colors.success(`   ✅ Successful: ${summary.successfulConsolidations}`));
        if (summary.failedConsolidations > 0) {
            console.log(theme_1.Theme.colors.error(`   ❌ Failed: ${summary.failedConsolidations}`));
        }
        console.log(theme_1.Theme.colors.success(`   📏 Lines reduced: ${summary.totalLinesReduced}`));
        console.log(theme_1.Theme.colors.info(`   📁 Files modified: ${summary.filesModified.length}`));
        if (summary.newUtilitiesCreated.length > 0) {
            console.log(theme_1.Theme.colors.secondary('\nNew Utilities Created:'));
            summary.newUtilitiesCreated.forEach((utility) => {
                console.log(theme_1.Theme.colors.info(`   🔧 ${utility}`));
            });
        }
        if (summary.overallQualityImprovement > 0) {
            console.log(theme_1.Theme.colors.success(`\n⭐ Quality improvement: ${summary.overallQualityImprovement.toFixed(1)}%`));
        }
        // Show errors if any
        if (summary.errors.length > 0) {
            console.log(theme_1.Theme.colors.secondary('\n⚠️  Issues encountered:'));
            summary.errors.slice(0, 5).forEach((error) => {
                console.log(theme_1.Theme.colors.error(`   • ${error}`));
            });
            if (summary.errors.length > 5) {
                console.log(theme_1.Theme.colors.muted(`   ... and ${summary.errors.length - 5} more issues`));
            }
        }
        // Modified files
        if (summary.filesModified.length > 0) {
            console.log(theme_1.Theme.colors.secondary('\nModified Files:'));
            summary.filesModified.slice(0, 10).forEach((file) => {
                const fileName = file.split(/[/\\]/).pop();
                console.log(theme_1.Theme.colors.muted(`   📄 ${fileName}`));
            });
            if (summary.filesModified.length > 10) {
                console.log(theme_1.Theme.colors.muted(`   ... and ${summary.filesModified.length - 10} more files`));
            }
        }
        console.log(theme_1.Theme.colors.border('\n' + '═'.repeat(60)));
        if (summary.successfulConsolidations > 0) {
            console.log(theme_1.Theme.colors.success('\n🎉 Code consolidation completed successfully!'));
            console.log(theme_1.Theme.colors.info('💡 Consider running tests to ensure everything works correctly.'));
        }
    }
}
exports.UserInterface = UserInterface;
//# sourceMappingURL=user-interface.js.map