/**
 * seans-mfe-tool mcp serve
 *
 * Starts an MCP server over stdio. Each tool call spawns a fresh child process
 * so that process.exit, cwd mutations, and env changes are isolated.
 *
 * Claude Desktop config snippet:
 *
 *   {
 *     "mcpServers": {
 *       "seans-mfe": {
 *         "command": "seans-mfe-tool",
 *         "args": ["mcp", "serve"]
 *       }
 *     }
 *   }
 *
 * Refs #106 (B7)
 */

import { Flags } from '@oclif/core';
import * as path from 'path';
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { startMcpServer } from '../../mcp/server';
import { SystemError } from '../../runtime/errors';

export default class McpServe extends BaseCommand<void> {
  static description = 'Start MCP server over stdio (child-process per tool call)'

  static examples = [
    '# Start MCP server (used by Claude Desktop / MCP clients)\n$ seans-mfe-tool mcp serve',
    '# Custom timeout (default 5 min)\n$ seans-mfe-tool mcp serve --timeout-ms 120000',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    'timeout-ms': Flags.integer({
      description: 'Per-tool-call timeout in milliseconds',
      default: 300_000,
    }),
  }

  protected async runCommand(): Promise<void> {
    const { flags } = await this.parse(McpServe)

    const schemasDir = resolveSchemaDir();
    const cliBin = resolveCliBin();

    await startMcpServer({
      schemasDir,
      cliBin,
      timeoutMs: flags['timeout-ms'],
    });
  }
}

function resolveSchemaDir(): string {
  const distSchemas = path.resolve(__dirname, '..', '..', 'schemas');
  if (fs.existsSync(distSchemas)) return distSchemas;

  const devSchemas = path.resolve(__dirname, '..', '..', '..', 'schemas');
  if (fs.existsSync(devSchemas)) return devSchemas;

  throw new SystemError('schemas/ directory not found. Run: npm run build:schemas');
}

function resolveCliBin(): string {
  // Published bin
  const runJs = path.resolve(__dirname, '..', '..', '..', 'bin', 'run.js');
  if (fs.existsSync(runJs)) return runJs;

  // Dev (from dist/)
  const distBin = path.resolve(__dirname, '..', '..', '..', '..', 'bin', 'run.js');
  if (fs.existsSync(distBin)) return distBin;

  throw new SystemError('bin/run.js not found. Run: npm run build');
}
