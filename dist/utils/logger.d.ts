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
    private static muted;
    private level;
    private context?;
    constructor(level?: LogLevel, context?: string);
    static getInstance(): Logger;
    /**
     * Mute all logging (useful during UI prompts to prevent log interference)
     */
    static mute(): void;
    /**
     * Unmute logging
     */
    static unmute(): void;
    /**
     * Check if logging is muted
     */
    static isMuted(): boolean;
    setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, error?: Error, meta?: unknown): void;
    child(context: string): Logger;
    private log;
}
export declare const defaultLogger: Logger;
//# sourceMappingURL=logger.d.ts.map