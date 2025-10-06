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
        const defaultProjectName = path.basename(process.cwd());
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
        console.log(theme_1.Theme.colors.info('  /help           Show this help message'));
        console.log(theme_1.Theme.colors.info('  /exit           Exit CodeMind CLI'));
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
}
exports.UserInterface = UserInterface;
//# sourceMappingURL=UserInterface.js.map