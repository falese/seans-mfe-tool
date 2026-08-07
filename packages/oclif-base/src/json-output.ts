/**
 * Helpers for --json mode: chalk suppression, stdout→stderr redirect,
 * and interactive-prompt blocking.
 *
 * All helpers are idempotent and safe to call multiple times.
 * The real stdout write reference is preserved so the final JSON envelope
 * can be emitted on stdout even after the redirect is active.
 */

import chalk from 'chalk';
import { SystemError, JSON_MODE_ENV } from '@falese/smt-contracts';

// ---------------------------------------------------------------------------
// Chalk / color suppression
// ---------------------------------------------------------------------------

export function suppressChalk(): void {
  chalk.level = 0;
  process.env['NO_COLOR'] = '1';
}

// ---------------------------------------------------------------------------
// stdout → stderr redirect
// ---------------------------------------------------------------------------

let _originalStdoutWrite: typeof process.stdout.write | undefined;

export function redirectStdoutToStderr(): void {
  if (_originalStdoutWrite) return;

  // Patching process.stdout.write covers this process only — a child given
  // `stdio: 'inherit'` writes to the real fd 1 and is untouched by any of the
  // below. Publish the mode so `childStdio()` can point that child's stdout at
  // fd 2 instead, and so the marker survives into grandchildren (ADR-018).
  process.env[JSON_MODE_ENV] = '1';

  _originalStdoutWrite = process.stdout.write.bind(process.stdout);

  const toStderr = (...args: unknown[]): void => {
    process.stderr.write(
      args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ') + '\n',
    );
  };
  console.log   = toStderr;
  console.info  = toStderr;
  console.debug = toStderr;

  (process.stdout as NodeJS.WriteStream).write = (
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean => {
    if (typeof encodingOrCallback === 'function') {
      return process.stderr.write(chunk, encodingOrCallback);
    }
    return process.stderr.write(
      chunk,
      encodingOrCallback as BufferEncoding | undefined,
      callback,
    );
  };
}

/**
 * Write the final JSON envelope line to the REAL stdout, bypassing any
 * redirect that may be active.
 */
export function writeJsonLine(json: string, callback?: () => void): void {
  const write = _originalStdoutWrite ?? process.stdout.write.bind(process.stdout);
  if (callback) {
    write(json + '\n', callback as (err?: Error | null) => void);
  } else {
    write(json + '\n');
  }
}

// ---------------------------------------------------------------------------
// Interactive-prompt blocking
// ---------------------------------------------------------------------------

export function blockInteractivePrompts(): void {
  Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });

  try {
    const inquirer = require('inquirer') as { prompt: (...args: unknown[]) => Promise<unknown> };
    if (inquirer && typeof inquirer.prompt === 'function') {
      const originalPrompt = inquirer.prompt.bind(inquirer);
      inquirer.prompt = (...args: unknown[]): Promise<unknown> => {
        if (process.stdin.isTTY === false) {
          return Promise.reject(
            new SystemError('interactive input disabled in --json mode'),
          );
        }
        return originalPrompt(...args);
      };
    }
  } catch {
    // inquirer not loaded yet — the isTTY=false guard is sufficient
  }
}
