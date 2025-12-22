/**
 * Core Logger Class
 * Provides structured logging with level filtering, context support, and chalk integration
 * Following ADR-069: Structured Logging with Logger Package
 */

import chalk = require('chalk');
import type {
  LogLevel,
  LogContext,
  LoggerOptions,
  LogEntry,
  Formatter,
  Transport,
  FormatHelpers
} from './types';
import { shouldLog } from './levels';
import { CLIFormatter, JSONFormatter, PlainFormatter } from './formatters';
import { ConsoleTransport } from './transports';

export class Logger {
  private level: LogLevel;
  private context?: LogContext;
  private formatter: Formatter;
  private transport: Transport;
  private silent: boolean;
  private metadata?: Record<string, unknown>;

  public readonly format: FormatHelpers;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || this.getDefaultLevel();
    this.context = options.context;
    this.silent = options.silent || process.env.LOG_SILENT === 'true';
    this.metadata = options.metadata;

    // Initialize formatter
    const formatterType = options.formatter || 'cli';
    const useColors = options.colors !== false && process.stdout.isTTY;

    switch (formatterType) {
      case 'json':
        this.formatter = new JSONFormatter();
        break;
      case 'plain':
        this.formatter = new PlainFormatter();
        break;
      case 'cli':
      default:
        this.formatter = new CLIFormatter(useColors);
        break;
    }

    // Initialize transport
    this.transport = options.transport || new ConsoleTransport();

    // Initialize format helpers (chalk integration)
    this.format = {
      success: (text: string) => chalk.green(` ${text}`),
      error: (text: string) => chalk.red(` ${text}`),
      warn: (text: string) => chalk.yellow(`  ${text}`),
      info: (text: string) => chalk.blue(text),
      debug: (text: string) => chalk.gray(text),
      command: (text: string) => chalk.cyan(text),
      path: (text: string) => chalk.gray(text),
      code: (text: string) => chalk.cyan(text),
    };
  }

  private getDefaultLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    if (envLevel && this.isValidLevel(envLevel)) {
      return envLevel as LogLevel;
    }
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  }

  private isValidLevel(level: string): boolean {
    return ['debug', 'info', 'success', 'warn', 'error'].includes(level);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    if (this.silent) {
      return;
    }

    if (!shouldLog(this.level, level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      timestamp: new Date(),
      metadata: { ...this.metadata, ...metadata },
      error,
    };

    const formatted = this.formatter.format(entry);
    this.transport.write(formatted);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  success(message: string, metadata?: Record<string, unknown>): void {
    this.log('success', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(messageOrError: string | Error, metadata?: Record<string, unknown>): void {
    if (messageOrError instanceof Error) {
      this.log('error', messageOrError.message, metadata, messageOrError);
    } else {
      this.log('error', messageOrError, metadata);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setContext(context: LogContext): void {
    this.context = context;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  child(context: LogContext, metadata?: Record<string, unknown>): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    const childMetadata = { ...this.metadata, ...metadata };

    return new Logger({
      level: this.level,
      context: childContext,
      formatter: this.formatter instanceof CLIFormatter ? 'cli' :
                 this.formatter instanceof JSONFormatter ? 'json' : 'plain',
      silent: this.silent,
      metadata: childMetadata,
      transport: this.transport,
    });
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

// Singleton default logger
export const logger = new Logger();
