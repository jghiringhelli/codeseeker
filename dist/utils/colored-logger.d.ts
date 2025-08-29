export interface LogEntry {
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error' | 'debug' | 'tool' | 'context' | 'db';
    category: string;
    message: string;
    data?: any;
}
export declare class ColoredLogger {
    private static instance;
    private logs;
    private maxLogs;
    static getInstance(): ColoredLogger;
    private formatTimestamp;
    private log;
    private printLog;
    private formatCategory;
    private formatMessage;
    private formatData;
    info(category: string, message: string, data?: any): void;
    success(category: string, message: string, data?: any): void;
    warning(category: string, message: string, data?: any): void;
    error(category: string, message: string, data?: any): void;
    debug(category: string, message: string, data?: any): void;
    toolSelection(toolName: string, reason: string, confidence: number, data?: any): void;
    toolExecution(toolName: string, status: 'started' | 'completed' | 'failed', duration?: number, data?: any): void;
    contextOptimization(operation: string, before: number, after: number, savings: number, data?: any): void;
    databaseOperation(operation: string, table: string, affected: number, data?: any): void;
    sessionStart(sessionId: string, projectPath: string, config: any): void;
    sessionEnd(sessionId: string, metrics: any): void;
    private printBanner;
    getLogs(count?: number): LogEntry[];
    getLogsByCategory(category: string, count?: number): LogEntry[];
    getLogsByLevel(level: LogEntry['level'], count?: number): LogEntry[];
    clearLogs(): void;
    printSummary(): void;
    private getLevelColor;
}
export declare const cliLogger: ColoredLogger;
export default ColoredLogger;
//# sourceMappingURL=colored-logger.d.ts.map