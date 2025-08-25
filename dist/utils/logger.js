"use strict";
/**
 * Logger implementation for the Intelligent Code Auxiliary System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLogger = exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    static instance;
    level;
    context;
    constructor(level = LogLevel.INFO, context) {
        this.level = level;
        this.context = context;
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLevel(level) {
        switch (level) {
            case 'debug':
                this.level = LogLevel.DEBUG;
                break;
            case 'info':
                this.level = LogLevel.INFO;
                break;
            case 'warn':
                this.level = LogLevel.WARN;
                break;
            case 'error':
                this.level = LogLevel.ERROR;
                break;
        }
    }
    debug(message, meta) {
        if (this.level <= LogLevel.DEBUG) {
            this?.log('DEBUG', message, meta);
        }
    }
    info(message, meta) {
        if (this.level <= LogLevel.INFO) {
            this?.log('INFO', message, meta);
        }
    }
    warn(message, meta) {
        if (this.level <= LogLevel.WARN) {
            this?.log('WARN', message, meta);
        }
    }
    error(message, error, meta) {
        if (this.level <= LogLevel.ERROR) {
            const errorInfo = error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined;
            this?.log('ERROR', message, { error: errorInfo, ...meta });
        }
    }
    child(context) {
        const childContext = this.context ? `${this.context}:${context}` : context;
        return new Logger(this.level, childContext);
    }
    log(level, message, meta) {
        const timestamp = new Date().toISOString();
        const contextStr = this.context ? ` [${this.context}]` : '';
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        console?.log(`${timestamp} ${level}${contextStr}: ${message}${metaStr}`);
    }
}
exports.Logger = Logger;
// Default logger instance
exports.defaultLogger = new Logger(process.env?.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO);
//# sourceMappingURL=logger.js.map