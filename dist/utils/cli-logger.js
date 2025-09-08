"use strict";
/**
 * Enhanced CLI Logger with Colors for Semantic Graph Integration
 * Provides visual feedback about semantic graph usage and status
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLILogger = void 0;
const chalk_1 = __importDefault(require("chalk"));
class CLILogger {
    static instance;
    static getInstance() {
        if (!CLILogger.instance) {
            CLILogger.instance = new CLILogger();
        }
        return CLILogger.instance;
    }
    // Standard logging methods with semantic awareness
    info(message, semanticStatus) {
        const prefix = this.getSemanticPrefix(semanticStatus);
        console.log(`${prefix}${chalk_1.default.cyan('ℹ')} ${message}`);
    }
    success(message, semanticStatus) {
        const prefix = this.getSemanticPrefix(semanticStatus);
        console.log(`${prefix}${chalk_1.default.green('✅')} ${chalk_1.default.green(message)}`);
    }
    warning(message, semanticStatus) {
        const prefix = this.getSemanticPrefix(semanticStatus);
        console.log(`${prefix}${chalk_1.default.yellow('⚠️')} ${chalk_1.default.yellow(message)}`);
    }
    error(message, details) {
        console.log(`${chalk_1.default.red('❌')} ${chalk_1.default.red(message)}`);
        if (details) {
            console.log(`   ${chalk_1.default.gray(details)}`);
        }
    }
    // Semantic-specific logging methods
    semanticInitializing() {
        console.log(`${chalk_1.default.blue('🧠')} ${chalk_1.default.blue('Initializing semantic graph...')}`);
    }
    semanticConnected(stats) {
        const statsText = stats ? chalk_1.default.gray(` (${stats.nodes} nodes, ${stats.relationships} relationships)`) : '';
        console.log(`${chalk_1.default.green('🧠')} ${chalk_1.default.green('Semantic graph connected')}${statsText}`);
    }
    semanticDisconnected() {
        console.log(`${chalk_1.default.red('🧠')} ${chalk_1.default.red('Semantic graph not available - using fallback mode')}`);
    }
    semanticSearching(query, intent) {
        const intentText = intent ? chalk_1.default.gray(` [${intent}]`) : '';
        console.log(`${chalk_1.default.magenta('🔍')} ${chalk_1.default.magenta('Semantic search:')} "${chalk_1.default.white(query)}"${intentText}`);
    }
    semanticResults(results) {
        const { primaryResults, relatedConcepts, crossDomainInsights, duration } = results;
        console.log(`${chalk_1.default.green('🔍')} ${chalk_1.default.green('Search completed')} ${chalk_1.default.gray(`(${duration}ms)`)}`);
        if (primaryResults > 0) {
            console.log(`   ${chalk_1.default.cyan('📋')} Primary results: ${chalk_1.default.white(primaryResults)}`);
        }
        if (relatedConcepts > 0) {
            console.log(`   ${chalk_1.default.yellow('🔗')} Related concepts: ${chalk_1.default.white(relatedConcepts)}`);
        }
        if (crossDomainInsights > 0) {
            console.log(`   ${chalk_1.default.magenta('🌐')} Cross-domain insights: ${chalk_1.default.white(crossDomainInsights)}`);
        }
        if (primaryResults === 0 && relatedConcepts === 0) {
            console.log(`   ${chalk_1.default.gray('💭')} No semantic matches found`);
        }
    }
    contextOptimizing(query, tokenBudget, semanticEnabled) {
        const semanticIndicator = semanticEnabled ?
            chalk_1.default.green('[🧠 Semantic]') :
            chalk_1.default.gray('[📁 Standard]');
        console.log(`${chalk_1.default.blue('🎯')} ${chalk_1.default.blue('Context optimization:')} "${chalk_1.default.white(query)}" ${semanticIndicator}`);
        console.log(`   ${chalk_1.default.gray('Token budget:')} ${chalk_1.default.white(tokenBudget)}`);
    }
    contextResults(results) {
        const { strategy, estimatedTokens, tokenBudget, priorityFiles, semanticBoosts } = results;
        console.log(`${chalk_1.default.green('🎯')} ${chalk_1.default.green('Optimization completed')}`);
        console.log(`   ${chalk_1.default.cyan('Strategy:')} ${chalk_1.default.white(strategy)}`);
        console.log(`   ${chalk_1.default.cyan('Tokens:')} ${chalk_1.default.white(estimatedTokens)}/${chalk_1.default.white(tokenBudget)}`);
        console.log(`   ${chalk_1.default.cyan('Priority files:')} ${chalk_1.default.white(priorityFiles)}`);
        if (semanticBoosts && semanticBoosts > 0) {
            console.log(`   ${chalk_1.default.green('🧠 Semantic boosts applied:')} ${chalk_1.default.white(semanticBoosts)} files`);
        }
    }
    fileList(files) {
        console.log(`\n${chalk_1.default.cyan('📁 Top Priority Files:')}`);
        files.forEach((file, index) => {
            const number = chalk_1.default.gray(`${index + 1}.`);
            const importance = this.getImportanceColor(file.importance);
            const semanticIcon = file.semanticBoost ? chalk_1.default.green(' 🧠') : '';
            const score = chalk_1.default.gray(`(${file.score.toFixed(3)})`);
            console.log(`${number} ${chalk_1.default.white(file.path)} ${importance}${semanticIcon} ${score}`);
            console.log(`   ${chalk_1.default.gray('Language:')} ${chalk_1.default.yellow(file.language)}`);
            if (file.summary) {
                const summary = file.summary.length > 80 ?
                    file.summary.substring(0, 80) + '...' :
                    file.summary;
                console.log(`   ${chalk_1.default.gray('Summary:')} ${chalk_1.default.dim(summary)}`);
            }
        });
    }
    conceptsList(concepts) {
        console.log(`\n${chalk_1.default.yellow('🔗 Related Concepts:')}`);
        concepts.forEach((concept, index) => {
            const number = chalk_1.default.gray(`${index + 1}.`);
            const domain = concept.domain ? chalk_1.default.gray(` [${concept.domain}]`) : '';
            const strength = concept.strength ? chalk_1.default.gray(` (${(concept.strength * 100).toFixed(0)}%)`) : '';
            console.log(`${number} ${chalk_1.default.white(concept.name)}${domain}${strength}`);
            if (concept.relatedCode || concept.relatedDocs) {
                const codeText = concept.relatedCode ? `${concept.relatedCode} code files` : '';
                const docsText = concept.relatedDocs ? `${concept.relatedDocs} docs` : '';
                const related = [codeText, docsText].filter(Boolean).join(', ');
                if (related) {
                    console.log(`   ${chalk_1.default.gray('Related:')} ${chalk_1.default.dim(related)}`);
                }
            }
        });
    }
    recommendationsList(recommendations) {
        if (recommendations.length === 0)
            return;
        console.log(`\n${chalk_1.default.green('💡 Recommendations:')}`);
        recommendations.forEach(rec => {
            console.log(`   ${chalk_1.default.green('•')} ${chalk_1.default.white(rec)}`);
        });
    }
    // CLI command headers
    commandHeader(command, description) {
        console.log(`\n${chalk_1.default.bold.blue('=')} ${chalk_1.default.bold.white(command)} ${chalk_1.default.bold.blue('=')}`);
        console.log(`${chalk_1.default.gray(description)}\n`);
    }
    // Status indicators
    statusLine(label, value, status = 'info') {
        const statusColors = {
            success: chalk_1.default.green,
            warning: chalk_1.default.yellow,
            error: chalk_1.default.red,
            info: chalk_1.default.cyan
        };
        const coloredValue = statusColors[status](value);
        console.log(`${chalk_1.default.gray(label + ':')} ${coloredValue}`);
    }
    // Progress indicator for long operations
    progress(message, current, total) {
        const percentage = Math.round((current / total) * 100);
        const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
        process.stdout.write(`\r${chalk_1.default.blue('⏳')} ${message} [${chalk_1.default.cyan(bar)}] ${chalk_1.default.white(percentage)}%`);
        if (current === total) {
            process.stdout.write('\n');
        }
    }
    // Helper methods
    getSemanticPrefix(status) {
        if (!status)
            return '';
        if (!status.enabled)
            return '';
        if (status.connected) {
            return chalk_1.default.green('🧠 ');
        }
        else {
            return chalk_1.default.red('🧠 ');
        }
    }
    getImportanceColor(importance) {
        switch (importance) {
            case 'critical':
                return chalk_1.default.red('[CRITICAL]');
            case 'high':
                return chalk_1.default.yellow('[HIGH]');
            case 'medium':
                return chalk_1.default.blue('[MEDIUM]');
            case 'low':
                return chalk_1.default.gray('[LOW]');
            default:
                return chalk_1.default.gray('[UNKNOWN]');
        }
    }
    // Utility methods for formatting
    highlight(text) {
        return chalk_1.default.yellow(text);
    }
    dim(text) {
        return chalk_1.default.dim(text);
    }
    bold(text) {
        return chalk_1.default.bold(text);
    }
    path(filePath) {
        return chalk_1.default.cyan(filePath);
    }
    code(text) {
        return chalk_1.default.green(text);
    }
    // Special methods for different CLI scenarios
    semanticFallback(reason) {
        console.log(`${chalk_1.default.yellow('⚠️')} ${chalk_1.default.yellow('Semantic graph unavailable:')} ${chalk_1.default.gray(reason)}`);
        console.log(`${chalk_1.default.gray('   Falling back to standard file analysis')}`);
    }
    semanticHealthCheck(services) {
        console.log(`\n${chalk_1.default.bold.cyan('🔍 Semantic Services Health Check:')}`);
        this.statusLine('Neo4j Database', services.neo4j ? 'Connected' : 'Disconnected', services.neo4j ? 'success' : 'error');
        this.statusLine('Semantic Graph', services.semanticGraph ? 'Available' : 'Unavailable', services.semanticGraph ? 'success' : 'error');
        this.statusLine('Orchestrator API', services.orchestrator ? 'Running' : 'Stopped', services.orchestrator ? 'success' : 'error');
        if (services.neo4j && services.semanticGraph && services.orchestrator) {
            console.log(`\n${chalk_1.default.green('✅ All semantic services operational')}`);
        }
        else {
            console.log(`\n${chalk_1.default.yellow('⚠️ Some semantic services are unavailable - limited functionality')}`);
        }
    }
}
exports.CLILogger = CLILogger;
exports.default = CLILogger;
//# sourceMappingURL=cli-logger.js.map