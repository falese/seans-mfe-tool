/**
 * Plain Formatter
 * Formats log entries as plain text without colors
 */

import type { Formatter, LogEntry } from '../types';

export class PlainFormatter implements Formatter {
  format(entry: LogEntry): string {
    const { level, message, context, metadata, error } = entry;

    let formatted = '';

    // Add timestamp
    formatted += `[${entry.timestamp.toISOString()}] `;

    // Add level
    formatted += `[${level.toUpperCase()}] `;

    // Add context if present
    if (context) {
      formatted += `[${context}] `;
    }

    // Add message
    formatted += message;

    // Add error if present
    if (error) {
      formatted += `\n  Error: ${error.message}`;
      if (error.stack) {
        formatted += `\n${error.stack}`;
      }
    }

    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      formatted += ` ${JSON.stringify(metadata)}`;
    }

    return formatted;
  }
}
