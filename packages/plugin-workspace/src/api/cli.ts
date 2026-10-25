/**
 * The workspace API's way into the CLI: one child process per command, with
 * `--json`, reading the single envelope the command prints (CLAUDE.md, "MCP
 * child-process per tool call"). A command's `process.exit` or `chdir` cannot
 * reach the server that called it.
 */

import { spawn } from 'child_process';
import type { CommandResult } from '@seans-mfe/contracts';
import type { CliRunner } from './server';

/** `command` is the CLI and its leading arguments, e.g. `[process.execPath, '/path/to/bin/run.js']`. */
export function makeCliRunner(command: string[]): CliRunner {
  const [bin, ...lead] = command;
  return {
    run(args) {
      return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        const child = spawn(bin, [...lead, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
        child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));
        const failure = (message: string): CommandResult<never> => ({
          ok: false,
          error: { type: 'SystemError', code: 1, message, retryable: false, userFacing: false },
          warnings: [],
          telemetry: { durationMs: 0, correlationId: '' },
        });
        child.on('error', (err) => resolve(failure(`could not run ${bin}: ${err.message}`)));
        child.on('close', (code) => {
          const last = stdout.trim().split('\n').pop() ?? '';
          try {
            const envelope = JSON.parse(last) as CommandResult<unknown>;
            if (typeof envelope === 'object' && envelope !== null && 'ok' in envelope) return resolve(envelope);
          } catch {
            // not an envelope; reported below
          }
          resolve(failure(`${args[0] ?? bin} exited ${code} without a JSON envelope: ${stderr.trim().split('\n').slice(-3).join(' | ')}`));
        });
      });
    },
  };
}
