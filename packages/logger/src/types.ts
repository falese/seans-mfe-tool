/**
 * Logger Type Definitions
 * Following ADR-069: Structured Logging with Logger Package
 */

export type LogLevel = 'debug' | 'info' | 'success' | 'warn' | 'error';
export type LogContext = string;

export interface LoggerOptions {
  level?: LogLevel;
  context?: LogContext;
  formatter?: 'cli' | 'json' | 'plain';
  silent?: boolean;
  colors?: boolean;
  timestamp?: boolean;
  metadata?: Record<string, unknown>;
  transport?: Transport;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export interface Formatter {
  format(entry: LogEntry): string;
}

export interface Transport {
  write(formatted: string): void;
}

export interface FormatHelpers {
  success: (text: string) => string;
  error: (text: string) => string;
  warn: (text: string) => string;
  info: (text: string) => string;
  debug: (text: string) => string;
  command: (text: string) => string;
  path: (text: string) => string;
  code: (text: string) => string;
}
