/**
 * JSON Formatter
 * Formats log entries as JSON for structured logging
 */

import type { Formatter, LogEntry } from '../types';

export class JSONFormatter implements Formatter {
  format(entry: LogEntry): string {
    const output = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      ...(entry.context && { context: entry.context }),
      ...(entry.metadata && { metadata: entry.metadata }),
      ...(entry.error && {
        error: {
          message: entry.error.message,
          stack: entry.error.stack,
          name: entry.error.name
        }
      })
    };

    return JSON.stringify(output);
  }
}
