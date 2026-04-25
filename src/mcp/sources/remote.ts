/**
 * Remote MCP source — proxies tools from external MCP servers defined in
 * ~/.config/seans-mfe/mcp.json.
 *
 * Config shape:
 *   {
 *     "servers": [
 *       { "name": "coder",  "command": "bunx", "args": ["@falese/coder-mcp"] },
 *       { "name": "daemon", "url": "http://daemon.local:8080/mcp" }
 *     ]
 *   }
 *
 * Each server's tools are prefixed with its "name" field: coder:refactor, etc.
 *
 * Refs #113 (C5)
 */

import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';
import type { McpToolDefinition } from '../tool-registry';

const MCP_CONFIG_PATH = path.join(os.homedir(), '.config', 'seans-mfe', 'mcp.json');

interface ServerEntry {
  name: string;
  /** For child-process servers */
  command?: string;
  args?: string[];
  /** For HTTP MCP servers */
  url?: string;
}

interface McpFederationConfig {
  servers?: ServerEntry[];
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: object;
}

export async function loadRemoteTools(
  configPath = MCP_CONFIG_PATH,
): Promise<McpToolDefinition[]> {
  if (!await fs.pathExists(configPath)) return [];

  let config: McpFederationConfig;
  try {
    config = await fs.readJson(configPath);
  } catch {
    return [];
  }

  const tools: McpToolDefinition[] = [];

  for (const server of config.servers ?? []) {
    try {
      let serverTools: McpTool[];
      if (server.url) {
        serverTools = await listToolsHttp(server.url);
      } else if (server.command) {
        serverTools = await listToolsChildProcess(server.command, server.args ?? []);
      } else {
        continue;
      }

      for (const tool of serverTools) {
        tools.push({
          name: `${server.name}:${tool.name}`,
          description: tool.description ?? `${server.name} tool: ${tool.name}`,
          inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
        });
      }
    } catch {
      // Remote server unavailable — skip, don't block startup
    }
  }

  return tools;
}

// ---------------------------------------------------------------------------
// HTTP MCP server (SSE or JSON-RPC over HTTP)
// ---------------------------------------------------------------------------

function listToolsHttp(url: string): Promise<McpTool[]> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

    const req = lib.request(
      { ...parsedUrl, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve((parsed?.result?.tools ?? []) as McpTool[]);
          } catch {
            reject(new Error('Invalid MCP response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(5_000, () => { req.destroy(); reject(new Error('HTTP timeout')); });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Child-process MCP server (stdio JSON-RPC)
// ---------------------------------------------------------------------------

function listToolsChildProcess(command: string, args: string[]): Promise<McpTool[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });

    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Child process MCP server timeout'));
    }, 5_000);

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });

    child.on('spawn', () => {
      // Send tools/list request
      const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) + '\n';
      child.stdin.write(req);
      child.stdin.end();
    });

    child.on('close', () => {
      clearTimeout(timer);
      try {
        // Find the last complete JSON line
        const lines = stdout.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]);
            if (parsed?.result?.tools) {
              resolve(parsed.result.tools as McpTool[]);
              return;
            }
          } catch { /* try previous line */ }
        }
        resolve([]);
      } catch {
        resolve([]);
      }
    });

    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}
