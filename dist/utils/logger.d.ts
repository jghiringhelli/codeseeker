/**
 * Logger implementation for the Intelligent Code Auxiliary System
 */
import { Logger as ILogger } from '../core/interfaces';
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare class Logger implements ILogger {
    private static instance;
    private level;
    private context?;
    constructor(level?: LogLevel, context?: string);
    static getInstance(): Logger;
    setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, error?: Error, meta?: any): void;
    child(context: string): Logger;
    private log;
}
export declare const defaultLogger: Logger;
//# sourceMappingURL=logger.d.ts.map