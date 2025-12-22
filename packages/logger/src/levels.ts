/**
 * Log Level Definitions
 * Following ADR-069: Structured Logging with Logger Package
 */

import type { LogLevel } from './types';

export enum LogLevelValue {
  debug = 0,
  info = 1,
  success = 2,
  warn = 3,
  error = 4,
}

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'success', 'warn', 'error'] as const;

export function shouldLog(currentLevel: LogLevel, messageLevel: LogLevel): boolean {
  return LogLevelValue[messageLevel] >= LogLevelValue[currentLevel];
}

export function isValidLevel(level: string): level is LogLevel {
  return LOG_LEVELS.includes(level as LogLevel);
}
