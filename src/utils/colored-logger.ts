import chalk from 'chalk';

export interface LogEntry {
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error' | 'debug' | 'tool' | 'context' | 'db';
    category: string;
    message: string;
    data?: any;
}

export class ColoredLogger {
    private static instance: ColoredLogger;
    private logs: LogEntry[] = [];
    private maxLogs = 1000;

    static getInstance(): ColoredLogger {
        if (!ColoredLogger.instance) {
            ColoredLogger.instance = new ColoredLogger();
        }
        return ColoredLogger.instance;
    }

    private formatTimestamp(): string {
        return chalk.gray(new Date().toLocaleTimeString());
    }

    private log(level: LogEntry['level'], category: string, message: string, data?: any): void {
        const entry: LogEntry = {
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

    private printLog(entry: LogEntry): void {
        const timestamp = this.formatTimestamp();
        const categoryFormatted = this.formatCategory(entry.level, entry.category);
        const messageFormatted = this.formatMessage(entry.level, entry.message);
        
        console.log(`${timestamp} ${categoryFormatted} ${messageFormatted}`);
        
        if (entry.data) {
            console.log(chalk.gray('  →'), this.formatData(entry.data));
        }
    }

    private formatCategory(level: LogEntry['level'], category: string): string {
        switch (level) {
            case 'info':
                return chalk.blue.bold(`[${category.toUpperCase()}]`);
            case 'success':
                return chalk.green.bold(`[${category.toUpperCase()}]`);
            case 'warning':
                return chalk.yellow.bold(`[${category.toUpperCase()}]`);
            case 'error':
                return chalk.red.bold(`[${category.toUpperCase()}]`);
            case 'debug':
                return chalk.gray.bold(`[${category.toUpperCase()}]`);
            case 'tool':
                return chalk.magenta.bold(`[🔧 ${category.toUpperCase()}]`);
            case 'context':
                return chalk.cyan.bold(`[📝 ${category.toUpperCase()}]`);
            case 'db':
                return chalk.blueBright.bold(`[💾 ${category.toUpperCase()}]`);
            default:
                return chalk.white.bold(`[${category.toUpperCase()}]`);
        }
    }

    private formatMessage(level: LogEntry['level'], message: string): string {
        switch (level) {
            case 'info':
                return chalk.blue(message);
            case 'success':
                return chalk.green(message);
            case 'warning':
                return chalk.yellow(message);
            case 'error':
                return chalk.red(message);
            case 'debug':
                return chalk.gray(message);
            case 'tool':
                return chalk.magenta(message);
            case 'context':
                return chalk.cyan(message);
            case 'db':
                return chalk.blueBright(message);
            default:
                return chalk.white(message);
        }
    }

    private formatData(data: any): string {
        if (typeof data === 'object') {
            return chalk.gray(JSON.stringify(data, null, 2));
        }
        return chalk.gray(String(data));
    }

    // Public logging methods with color coding
    info(category: string, message: string, data?: any): void {
        this.log('info', category, message, data);
    }

    success(category: string, message: string, data?: any): void {
        this.log('success', category, message, data);
    }

    warning(category: string, message: string, data?: any): void {
        this.log('warning', category, message, data);
    }

    error(category: string, message: string, data?: any): void {
        this.log('error', category, message, data);
    }

    debug(category: string, message: string, data?: any): void {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            this.log('debug', category, message, data);
        }
    }

    // Specialized logging methods for CLI components
    toolSelection(toolName: string, reason: string, confidence: number, data?: any): void {
        const message = `Selected "${toolName}" (confidence: ${Math.round(confidence * 100)}%) - ${reason}`;
        this.log('tool', 'TOOL-SELECT', message, data);
    }

    toolExecution(toolName: string, status: 'started' | 'completed' | 'failed', duration?: number, data?: any): void {
        const durationText = duration ? ` in ${duration}ms` : '';
        const message = `Tool "${toolName}" ${status}${durationText}`;
        const level = status === 'failed' ? 'error' : status === 'completed' ? 'success' : 'tool';
        this.log(level as LogEntry['level'], 'TOOL-EXEC', message, data);
    }

    contextOptimization(operation: string, before: number, after: number, savings: number, data?: any): void {
        const message = `${operation}: ${before} → ${after} tokens (${Math.round(savings)}% saved)`;
        this.log('context', 'CONTEXT', message, data);
    }

    databaseOperation(operation: string, table: string, affected: number, data?: any): void {
        const message = `${operation} on "${table}" - ${affected} record(s) affected`;
        this.log('db', 'DATABASE', message, data);
    }

    sessionStart(sessionId: string, projectPath: string, config: any): void {
        const message = `Starting CodeSeeker CLI session`;
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

    sessionEnd(sessionId: string, metrics: any): void {
        const message = `CodeSeeker CLI session completed`;
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

    private printBanner(): void {
        console.log();
        console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan.bold('║') + chalk.white.bold('                    🚀 CodeSeeker CLI v2.0                     ') + chalk.cyan.bold('║'));
        console.log(chalk.cyan.bold('║') + chalk.white('          Intelligent Tool Selection & Token Optimization    ') + chalk.cyan.bold('║'));
        console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
        console.log();
    }

    // Utility methods
    getLogs(count?: number): LogEntry[] {
        return count ? this.logs.slice(-count) : [...this.logs];
    }

    getLogsByCategory(category: string, count?: number): LogEntry[] {
        const filtered = this.logs.filter(log => log.category.toLowerCase() === category.toLowerCase());
        return count ? filtered.slice(-count) : filtered;
    }

    getLogsByLevel(level: LogEntry['level'], count?: number): LogEntry[] {
        const filtered = this.logs.filter(log => log.level === level);
        return count ? filtered.slice(-count) : filtered;
    }

    clearLogs(): void {
        this.logs = [];
        this.success('SYSTEM', 'Logs cleared');
    }

    printSummary(): void {
        const categories = [...new Set(this.logs.map(log => log.category))];
        const levels = [...new Set(this.logs.map(log => log.level))];

        console.log();
        console.log(chalk.cyan.bold('📊 CodeSeeker CLI Session Summary'));
        console.log(chalk.cyan('═'.repeat(40)));
        
        console.log(chalk.white.bold('\n📈 Log Statistics:'));
        console.log(chalk.gray(`  Total log entries: ${this.logs.length}`));
        
        console.log(chalk.white.bold('\n🏷️  Categories:'));
        categories.forEach(cat => {
            const count = this.logs.filter(log => log.category === cat).length;
            console.log(chalk.gray(`  ${cat}: ${count} entries`));
        });

        console.log(chalk.white.bold('\n🚦 Log Levels:'));
        levels.forEach(level => {
            const count = this.logs.filter(log => log.level === level).length;
            const color = this.getLevelColor(level);
            console.log(color(`  ${level}: ${count} entries`));
        });

        const toolSelections = this.getLogsByLevel('tool').filter(log => log.category === 'TOOL-SELECT');
        if (toolSelections.length > 0) {
            console.log(chalk.white.bold('\n🔧 Tool Selections:'));
            toolSelections.forEach(log => {
                console.log(chalk.magenta(`  ${log.message}`));
            });
        }

        const contextOptimizations = this.getLogsByLevel('context');
        if (contextOptimizations.length > 0) {
            console.log(chalk.white.bold('\n📝 Context Optimizations:'));
            contextOptimizations.forEach(log => {
                console.log(chalk.cyan(`  ${log.message}`));
            });
        }

        console.log();
    }

    private getLevelColor(level: LogEntry['level']) {
        switch (level) {
            case 'success': return chalk.green;
            case 'error': return chalk.red;
            case 'warning': return chalk.yellow;
            case 'tool': return chalk.magenta;
            case 'context': return chalk.cyan;
            case 'db': return chalk.blueBright;
            case 'debug': return chalk.gray;
            default: return chalk.white;
        }
    }
}

// Export singleton instance
export const cliLogger = ColoredLogger.getInstance();
export default ColoredLogger;