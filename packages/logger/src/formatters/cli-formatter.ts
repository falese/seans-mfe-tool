/**
 * CLI Formatter
 * Formats log entries with chalk colors for CLI output
 * Following ADR-069: Structured Logging with Logger Package
 */

import chalk = require('chalk');
import type { Formatter, LogEntry } from '../types';

export class CLIFormatter implements Formatter {
  private colors: boolean;

  constructor(colors: boolean = true) {
    this.colors = colors;
  }

  format(entry: LogEntry): string {
    const { level, message, context, metadata, error } = entry;

    let formatted = '';

    // Add context prefix if present
    if (context) {
      formatted += this.colors ? chalk.gray(`[${context}] `) : `[${context}] `;
    }

    // Format message based on level
    switch (level) {
      case 'success':
        formatted += this.colors ? chalk.green(`✓ ${message}`) : `✓ ${message}`;
        break;
      case 'error':
        formatted += this.colors ? chalk.red(`✗ ${message}`) : `✗ ${message}`;
        break;
      case 'warn':
        formatted += this.colors ? chalk.yellow(`⚠ ${message}`) : `⚠ ${message}`;
        break;
      case 'info':
        formatted += this.colors ? chalk.blue(message) : message;
        break;
      case 'debug':
        formatted += this.colors ? chalk.gray(message) : message;
        break;
    }

    // Add error details if present
    if (error) {
      formatted += this.colors ? chalk.red(`\n  ${error.message}`) : `\n  ${error.message}`;
      if (error.stack) {
        formatted += this.colors ? chalk.gray(`\n${error.stack}`) : `\n${error.stack}`;
      }
    }

    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      const metaStr = JSON.stringify(metadata);
      formatted += this.colors ? chalk.gray(` ${metaStr}`) : ` ${metaStr}`;
    }

    return formatted;
  }
}
