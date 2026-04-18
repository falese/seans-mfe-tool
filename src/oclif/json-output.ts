/**
 * Helpers for --json mode: chalk suppression, stdout→stderr redirect,
 * and interactive-prompt blocking.
 *
 * All helpers are idempotent and safe to call multiple times.
 * The real stdout write reference is preserved so the final JSON envelope
 * can be emitted on stdout even after the redirect is active.
 *
 * Refs #101 (B2)
 */

import chalk from 'chalk';
import { SystemError } from '../runtime/errors';

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
  if (_originalStdoutWrite) return; // already patched

  _originalStdoutWrite = process.stdout.write.bind(process.stdout);

  // Redirect all console.* helpers that write to stdout
  const toStderr = (...args: unknown[]): void => {
    process.stderr.write(
      args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ') + '\n',
    );
  };
  console.log   = toStderr;
  console.info  = toStderr;
  console.debug = toStderr;

  // Redirect process.stdout.write itself
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
export function writeJsonLine(json: string): void {
  const write = _originalStdoutWrite ?? process.stdout.write.bind(process.stdout);
  write(json + '\n');
}

// ---------------------------------------------------------------------------
// Interactive-prompt blocking
// ---------------------------------------------------------------------------

export function blockInteractivePrompts(): void {
  // Force stdin into non-TTY mode so inquirer skips prompts
  Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });

  // Wrap inquirer.prompt if it has been imported already
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const inquirer = require('inquirer') as { prompt: (...args: unknown[]) => Promise<unknown> };
    if (inquirer && typeof inquirer.prompt === 'function') {
      const originalPrompt = inquirer.prompt.bind(inquirer);
      inquirer.prompt = (...args: unknown[]): Promise<unknown> => {
        // Check if we are in json mode (stdin is non-TTY means we already patched)
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
