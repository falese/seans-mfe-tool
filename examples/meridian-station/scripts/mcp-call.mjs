#!/usr/bin/env node
/**
 * Drives one seans-mfe-tool MCP tool call and prints the result envelope —
 * the agent-facing entry point exercised by the Meridian build (see
 * DX-REPORT.md). Tools accept a reserved `cwd` argument (#279), so ONE
 * server instance can target any directory — the first positional here is
 * passed through as that argument.
 *
 * Usage: node scripts/mcp-call.mjs <cwd> <tool> '<json-args>'
 *   e.g. node scripts/mcp-call.mjs meridian-crew-services mfe:remote:generate '{}'
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const [cwd, tool, rawArgs] = process.argv.slice(2);
if (!cwd || !tool) {
  console.error("usage: mcp-call.mjs <cwd> <tool> '<json-args>'");
  process.exit(2);
}

const cliBin = resolve(new URL('.', import.meta.url).pathname, '../../../bin/run.js');
const proc = spawn(cliBin, ['mcp:serve'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

let buf = '';
const pending = new Map();
let nextId = 1;

proc.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolvePromise, reject) => {
    pending.set(id, resolvePromise);
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 300000);
  });
}

await rpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'meridian-mcp-driver', version: '1.0.0' },
});
proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');

const response = await rpc('tools/call', {
  name: tool,
  arguments: { ...(rawArgs ? JSON.parse(rawArgs) : {}), cwd: resolve(cwd) },
});

const result = response.result ?? response.error;
console.log(JSON.stringify(result, null, 2));
proc.kill();
process.exit(result?.isError ? 1 : 0);
