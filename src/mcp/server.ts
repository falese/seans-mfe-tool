/**
 * MCP server bootstrap.
 *
 * Architecture (locked decision — CLAUDE.md):
 *   Each tool call spawns a fresh child process:
 *     seans-mfe-tool <topic> [<sub>] [args] --json
 *   stdout → parsed as CommandResult<T>
 *   stderr → buffered and surfaced as resource/log
 *
 * This isolates process.exit, cwd mutations, and env changes.
 * Concurrent calls are safe because each child is independent.
 *
 * Refs #106 (B7)
 */

import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import { loadToolRegistry, buildArgv, McpToolDefinition } from './tool-registry';
import type { CommandResult } from '@falese/smt-contracts';

export interface McpServerOptions {
  schemasDir:  string;
  cliBin:      string;
  timeoutMs:   number;
}

export interface ToolCallResult {
  ok:       boolean;
  data?:    unknown;
  error?:   { type: string; code: number; message: string };
  stderr:   string;
}

// ---------------------------------------------------------------------------
// Child-process execution
// ---------------------------------------------------------------------------

/**
 * The args this command takes positionally, as declared by the command itself
 * and carried through the generated schema (`x-positional`). Undefined for
 * third-party plugin schemas that predate it — buildArgv falls back there.
 */
function positionalsOf(tool?: McpToolDefinition): string[] | undefined {
  const schema = tool?.inputSchema as { 'x-positional'?: unknown } | undefined;
  const positional = schema?.['x-positional'];
  return Array.isArray(positional) ? (positional as string[]) : undefined;
}

/**
 * Find the `CommandResult<T>` envelope in a child's stdout.
 *
 * ADR-018 promises exactly one envelope line on stdout under `--json`, and
 * BaseCommand keeps that promise for everything it can see: `this.log()` and
 * `console.log` are redirected to stderr. What it cannot see is a *grandchild*.
 * `execSync(..., { stdio: 'inherit' })` hands the spawned process the real fd 1,
 * and no amount of patching `process.stdout.write` in the CLI's own process
 * affects a file descriptor another process is already writing to.
 *
 * So `deploy` returned docker's build log ahead of its envelope, `JSON.parse`
 * over the whole buffer threw, and a container that was already running was
 * reported to the agent as `system` error 69. Commands are being fixed to stop
 * leaking (ADR-018), but the parser has to be the side that holds: it is one
 * function, it faces every command including third-party plugin ones, and it is
 * where ADR-019 puts the responsibility — "maps CommandResult.success to the MCP
 * tool response".
 *
 * Walks back from the end because the envelope is written last, immediately
 * before the command exits. Still `JSON.parse` and no regex, per ADR-019: line
 * splitting is done with `split`, and a line either parses whole or is skipped —
 * nothing is pattern-matched out of the middle of the stream.
 *
 * Returns undefined when no line is an envelope, which is a genuine contract
 * failure and must stay one — tolerating noise is not the same as inventing
 * success.
 */
function findEnvelope(stdout: string): CommandResult<unknown> | undefined {
  // Progress output (npm, docker) redraws with a bare \r and no newline, so a
  // leak can end up on the same "line" as the envelope unless both count.
  const lines = stdout.split('\n').flatMap((line) => line.split('\r'));

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (value !== null && typeof value === 'object' && 'ok' in value) {
        return value as CommandResult<unknown>;
      }
    } catch {
      // Not the envelope — keep walking back.
    }
  }
  return undefined;
}

export async function executeToolCall(
  toolName:  string,
  input:     Record<string, unknown>,
  options:   McpServerOptions,
  tool?:     McpToolDefinition,
): Promise<ToolCallResult> {
  const argv   = buildArgv(toolName, input, positionalsOf(tool));
  const cliBin = options.cliBin;
  const timeoutMs = options.timeoutMs ?? 300_000;

  // Reserved execution argument (#279): run the child in the requested
  // directory. Validated here — the child would otherwise fail with an
  // opaque ENOENT before the CLI even parses argv.
  const requestedCwd = typeof input.cwd === 'string' ? input.cwd : undefined;
  if (requestedCwd !== undefined) {
    const stat = await fs.stat(requestedCwd).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return {
        ok: false,
        error: {
          type: 'validation',
          code: 400,
          message: `cwd is not an existing directory: ${requestedCwd}`,
        },
        stderr: '',
      };
    }
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn('node', [cliBin, ...argv], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      ...(requestedCwd !== undefined ? { cwd: requestedCwd } : {}),
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGTERM');
        resolve({
          ok:    false,
          error: { type: 'timeout', code: 124, message: `Tool call timed out after ${timeoutMs}ms` },
          stderr,
        });
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const line = stdout.trim();
      if (!line) {
        resolve({ ok: false, error: { type: 'system', code: 69, message: 'No output from command' }, stderr });
        return;
      }

      const envelope = findEnvelope(stdout);
      if (!envelope) {
        resolve({
          ok:    false,
          error: { type: 'system', code: 69, message: `Failed to parse command output: ${line.slice(0, 200)}` },
          stderr,
        });
        return;
      }

      resolve({
        ok:    envelope.ok,
        data:  envelope.data,
        error: envelope.error as ToolCallResult['error'],
        stderr,
      });
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: { type: 'system', code: 69, message: err.message }, stderr });
    });
  });
}

// ---------------------------------------------------------------------------
// Stdio-transport MCP server
// ---------------------------------------------------------------------------

/**
 * Start the MCP server speaking JSON-RPC 2.0 over stdio.
 * We implement the protocol directly (no SDK dep) to avoid adding a new
 * runtime dependency before the C-epic contracts package ships.
 */
export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const tools = await loadToolRegistry(options.schemasDir, { cliName: 'seans-mfe-tool' });
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  process.stdin.setEncoding('utf8');
  let buffer = '';

  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const request = JSON.parse(trimmed);
        const response = await handleRequest(request, tools, toolMap, options);
        if (response !== null) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch {
        const errResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        };
        process.stdout.write(JSON.stringify(errResponse) + '\n');
      }
    }
  });

  // This is the process's own stdio loop ending (parent disconnected) —
  // there is no caller above it to throw to.
  // eslint-disable-next-line no-process-exit
  process.stdin.on('end', () => { process.exit(0); });
}

async function handleRequest(
  request:  Record<string, unknown>,
  tools:    McpToolDefinition[],
  toolMap:  Map<string, McpToolDefinition>,
  options:  McpServerOptions,
): Promise<Record<string, unknown> | null> {
  const { jsonrpc, id, method, params } = request;

  if (method === 'initialize') {
    return {
      jsonrpc,
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities:    { tools: {} },
        serverInfo:      { name: 'seans-mfe-tool', version: '1.0.0' },
      },
    };
  }

  if (method === 'notifications/initialized') {
    return null; // notification, no response
  }

  if (method === 'tools/list') {
    return {
      jsonrpc,
      id,
      result: {
        tools: tools.map((t) => ({
          name:        t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }

  if (method === 'tools/call') {
    const paramsObj = (params ?? {}) as Record<string, unknown>;
    const toolName  = paramsObj.name as string;
    const input     = (paramsObj.arguments ?? {}) as Record<string, unknown>;

    if (!toolMap.has(toolName)) {
      return {
        jsonrpc, id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      };
    }

    const result = await executeToolCall(toolName, input, options, toolMap.get(toolName));

    if (result.ok) {
      return {
        jsonrpc, id,
        result: {
          content: [
            { type: 'text', text: JSON.stringify(result.data, null, 2) },
            ...(result.stderr ? [{ type: 'text', text: `[stderr]\n${result.stderr}` }] : []),
          ],
        },
      };
    } else {
      return {
        jsonrpc, id,
        result: {
          isError:  true,
          content: [
            { type: 'text', text: result.error?.message ?? 'Unknown error' },
            ...(result.stderr ? [{ type: 'text', text: `[stderr]\n${result.stderr}` }] : []),
          ],
        },
      };
    }
  }

  // Unknown method
  return {
    jsonrpc, id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}
