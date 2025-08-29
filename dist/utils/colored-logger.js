"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliLogger = exports.ColoredLogger = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ColoredLogger {
    static instance;
    logs = [];
    maxLogs = 1000;
    static getInstance() {
        if (!ColoredLogger.instance) {
            ColoredLogger.instance = new ColoredLogger();
        }
        return ColoredLogger.instance;
    }
    formatTimestamp() {
        return chalk_1.default.gray(new Date().toLocaleTimeString());
    }
    log(level, category, message, data) {
        const entry = {
            timestamp: new Date(),
            level,
            category,
            message,
            data
        };
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        this.printLog(entry);
    }
    printLog(entry) {
        const timestamp = this.formatTimestamp();
        const categoryFormatted = this.formatCategory(entry.level, entry.category);
        const messageFormatted = this.formatMessage(entry.level, entry.message);
        console.log(`${timestamp} ${categoryFormatted} ${messageFormatted}`);
        if (entry.data) {
            console.log(chalk_1.default.gray('  →'), this.formatData(entry.data));
        }
    }
    formatCategory(level, category) {
        switch (level) {
            case 'info':
                return chalk_1.default.blue.bold(`[${category.toUpperCase()}]`);
            case 'success':
                return chalk_1.default.green.bold(`[${category.toUpperCase()}]`);
            case 'warning':
                return chalk_1.default.yellow.bold(`[${category.toUpperCase()}]`);
            case 'error':
                return chalk_1.default.red.bold(`[${category.toUpperCase()}]`);
            case 'debug':
                return chalk_1.default.gray.bold(`[${category.toUpperCase()}]`);
            case 'tool':
                return chalk_1.default.magenta.bold(`[🔧 ${category.toUpperCase()}]`);
            case 'context':
                return chalk_1.default.cyan.bold(`[📝 ${category.toUpperCase()}]`);
            case 'db':
                return chalk_1.default.blueBright.bold(`[💾 ${category.toUpperCase()}]`);
            default:
                return chalk_1.default.white.bold(`[${category.toUpperCase()}]`);
        }
    }
    formatMessage(level, message) {
        switch (level) {
            case 'info':
                return chalk_1.default.blue(message);
            case 'success':
                return chalk_1.default.green(message);
            case 'warning':
                return chalk_1.default.yellow(message);
            case 'error':
                return chalk_1.default.red(message);
            case 'debug':
                return chalk_1.default.gray(message);
            case 'tool':
                return chalk_1.default.magenta(message);
            case 'context':
                return chalk_1.default.cyan(message);
            case 'db':
                return chalk_1.default.blueBright(message);
            default:
                return chalk_1.default.white(message);
        }
    }
    formatData(data) {
        if (typeof data === 'object') {
            return chalk_1.default.gray(JSON.stringify(data, null, 2));
        }
        return chalk_1.default.gray(String(data));
    }
    // Public logging methods with color coding
    info(category, message, data) {
        this.log('info', category, message, data);
    }
    success(category, message, data) {
        this.log('success', category, message, data);
    }
    warning(category, message, data) {
        this.log('warning', category, message, data);
    }
    error(category, message, data) {
        this.log('error', category, message, data);
    }
    debug(category, message, data) {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            this.log('debug', category, message, data);
        }
    }
    // Specialized logging methods for CLI components
    toolSelection(toolName, reason, confidence, data) {
        const message = `Selected "${toolName}" (confidence: ${Math.round(confidence * 100)}%) - ${reason}`;
        this.log('tool', 'TOOL-SELECT', message, data);
    }
    toolExecution(toolName, status, duration, data) {
        const durationText = duration ? ` in ${duration}ms` : '';
        const message = `Tool "${toolName}" ${status}${durationText}`;
        const level = status === 'failed' ? 'error' : status === 'completed' ? 'success' : 'tool';
        this.log(level, 'TOOL-EXEC', message, data);
    }
    contextOptimization(operation, before, after, savings, data) {
        const message = `${operation}: ${before} → ${after} tokens (${Math.round(savings)}% saved)`;
        this.log('context', 'CONTEXT', message, data);
    }
    databaseOperation(operation, table, affected, data) {
        const message = `${operation} on "${table}" - ${affected} record(s) affected`;
        this.log('db', 'DATABASE', message, data);
    }
    sessionStart(sessionId, projectPath, config) {
        const message = `Starting CodeMind CLI session`;
        this.log('info', 'SESSION', message, {
            sessionId,
            projectPath,
            config: {
                tokenBudget: config.tokenBudget,
                smartSelection: config.smartSelection,
                optimization: config.optimization
            }
        });
        this.printBanner();
    }
    sessionEnd(sessionId, metrics) {
        const message = `CodeMind CLI session completed`;
        this.log('success', 'SESSION', message, {
            sessionId,
            metrics: {
                totalQueries: metrics.totalQueries,
                tokensUsed: metrics.tokensUsed,
                tokensSaved: metrics.tokensSaved,
                avgRelevance: metrics.avgRelevance,
                successRate: metrics.successRate
            }
        });
    }
    printBanner() {
        console.log();
        console.log(chalk_1.default.cyan.bold('╔══════════════════════════════════════════════════════════════╗'));
        console.log(chalk_1.default.cyan.bold('║') + chalk_1.default.white.bold('                    🚀 CodeMind CLI v2.0                     ') + chalk_1.default.cyan.bold('║'));
        console.log(chalk_1.default.cyan.bold('║') + chalk_1.default.white('          Intelligent Tool Selection & Token Optimization    ') + chalk_1.default.cyan.bold('║'));
        console.log(chalk_1.default.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
        console.log();
    }
    // Utility methods
    getLogs(count) {
        return count ? this.logs.slice(-count) : [...this.logs];
    }
    getLogsByCategory(category, count) {
        const filtered = this.logs.filter(log => log.category.toLowerCase() === category.toLowerCase());
        return count ? filtered.slice(-count) : filtered;
    }
    getLogsByLevel(level, count) {
        const filtered = this.logs.filter(log => log.level === level);
        return count ? filtered.slice(-count) : filtered;
    }
    clearLogs() {
        this.logs = [];
        this.success('SYSTEM', 'Logs cleared');
    }
    printSummary() {
        const categories = [...new Set(this.logs.map(log => log.category))];
        const levels = [...new Set(this.logs.map(log => log.level))];
        console.log();
        console.log(chalk_1.default.cyan.bold('📊 CodeMind CLI Session Summary'));
        console.log(chalk_1.default.cyan('═'.repeat(40)));
        console.log(chalk_1.default.white.bold('\n📈 Log Statistics:'));
        console.log(chalk_1.default.gray(`  Total log entries: ${this.logs.length}`));
        console.log(chalk_1.default.white.bold('\n🏷️  Categories:'));
        categories.forEach(cat => {
            const count = this.logs.filter(log => log.category === cat).length;
            console.log(chalk_1.default.gray(`  ${cat}: ${count} entries`));
        });
        console.log(chalk_1.default.white.bold('\n🚦 Log Levels:'));
        levels.forEach(level => {
            const count = this.logs.filter(log => log.level === level).length;
            const color = this.getLevelColor(level);
            console.log(color(`  ${level}: ${count} entries`));
        });
        const toolSelections = this.getLogsByLevel('tool').filter(log => log.category === 'TOOL-SELECT');
        if (toolSelections.length > 0) {
            console.log(chalk_1.default.white.bold('\n🔧 Tool Selections:'));
            toolSelections.forEach(log => {
                console.log(chalk_1.default.magenta(`  ${log.message}`));
            });
        }
        const contextOptimizations = this.getLogsByLevel('context');
        if (contextOptimizations.length > 0) {
            console.log(chalk_1.default.white.bold('\n📝 Context Optimizations:'));
            contextOptimizations.forEach(log => {
                console.log(chalk_1.default.cyan(`  ${log.message}`));
            });
        }
        console.log();
    }
    getLevelColor(level) {
        switch (level) {
            case 'success': return chalk_1.default.green;
            case 'error': return chalk_1.default.red;
            case 'warning': return chalk_1.default.yellow;
            case 'tool': return chalk_1.default.magenta;
            case 'context': return chalk_1.default.cyan;
            case 'db': return chalk_1.default.blueBright;
            case 'debug': return chalk_1.default.gray;
            default: return chalk_1.default.white;
        }
    }
}
exports.ColoredLogger = ColoredLogger;
// Export singleton instance
exports.cliLogger = ColoredLogger.getInstance();
exports.default = ColoredLogger;
//# sourceMappingURL=colored-logger.js.map