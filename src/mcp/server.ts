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
import * as path from 'path';
import * as fs from 'fs-extra';
import { loadToolRegistry, buildArgv, McpToolDefinition } from './tool-registry';
import type { CommandResult } from '../oclif/envelope';

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

export async function executeToolCall(
  toolName:  string,
  input:     Record<string, unknown>,
  options:   McpServerOptions,
): Promise<ToolCallResult> {
  const argv   = buildArgv(toolName, input);
  const cliBin = options.cliBin;
  const timeoutMs = options.timeoutMs ?? 300_000;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn('node', [cliBin, ...argv], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
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

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const line = stdout.trim();
      if (!line) {
        resolve({ ok: false, error: { type: 'system', code: 69, message: 'No output from command' }, stderr });
        return;
      }

      try {
        const envelope = JSON.parse(line) as CommandResult<unknown>;
        resolve({
          ok:    envelope.ok,
          data:  envelope.data,
          error: envelope.error as ToolCallResult['error'],
          stderr,
        });
      } catch {
        resolve({
          ok:    false,
          error: { type: 'system', code: 69, message: `Failed to parse command output: ${line.slice(0, 200)}` },
          stderr,
        });
      }
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
  const tools = await loadToolRegistry(options.schemasDir);
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
      } catch (err) {
        const errResponse = {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        };
        process.stdout.write(JSON.stringify(errResponse) + '\n');
      }
    }
  });

  process.stdin.on('end', () => { process.exit(0); });
}

async function handleRequest(
  request:  Record<string, unknown>,
  tools:    McpToolDefinition[],
  toolMap:  Map<string, McpToolDefinition>,
  options:  McpServerOptions,
): Promise<Record<string, unknown> | null> {
  const { jsonrpc, id, method, params } = request as any;

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
    const toolName = (params as any)?.name as string;
    const input    = ((params as any)?.arguments ?? {}) as Record<string, unknown>;

    if (!toolMap.has(toolName)) {
      return {
        jsonrpc, id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      };
    }

    const result = await executeToolCall(toolName, input, options);

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
