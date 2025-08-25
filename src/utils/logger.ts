/**
 * Logger implementation for the Intelligent Code Auxiliary System
 */

import { Logger as ILogger } from '../core/interfaces';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger implements ILogger {
  private static instance: Logger;
  private level: LogLevel;
  private context?: string;

  constructor(level: LogLevel = LogLevel.INFO, context?: string) {
    this.level = level;
    this.context = context;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
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

  debug(message: string, meta?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      this?.log('DEBUG', message, meta);
    }
  }

  info(message: string, meta?: any): void {
    if (this.level <= LogLevel.INFO) {
      this?.log('INFO', message, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.level <= LogLevel.WARN) {
      this?.log('WARN', message, meta);
    }
  }

  error(message: string, error?: Error, meta?: any): void {
    if (this.level <= LogLevel.ERROR) {
      const errorInfo = error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined;

      this?.log('ERROR', message, { error: errorInfo, ...meta });
    }
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(this.level, childContext);
  }

  private log(level: string, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? ` [${this.context}]` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';

    console?.log(`${timestamp} ${level}${contextStr}: ${message}${metaStr}`);
  }
}

// Default logger instance
export const defaultLogger = new Logger(
  process.env?.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);