/**
 * MCP cwd targeting (#279): every tool accepts a reserved `cwd` argument —
 * advertised in the tool schema, stripped from the CLI argv, validated, and
 * applied as the child process working directory. One server instance can
 * scaffold into any directory (found while dogfooding the Meridian build:
 * DX-REPORT punch list #11).
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

const spawnMock = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { buildArgv, loadToolRegistry } from '../tool-registry';
import { executeToolCall } from '../server';

function fakeChild(exitCode = 0, stdout = '{"ok":true,"data":{}}'): unknown {
  const listeners: Record<string, (arg?: unknown) => void> = {};
  return {
    stdout: { on: (event: string, cb: (chunk: Buffer) => void) => event === 'data' && cb(Buffer.from(stdout)) },
    stderr: { on: () => undefined },
    on: (event: string, cb: (code: number) => void) => {
      listeners[event] = cb as (arg?: unknown) => void;
      if (event === 'close') setImmediate(() => cb(exitCode));
    },
    kill: () => undefined,
  };
}

describe('MCP cwd targeting (#279)', () => {
  // The server's call timeout uses real setTimeout; the global fake timers
  // would park it (and setImmediate) forever.
  beforeEach(() => {
    jest.useRealTimers();
    spawnMock.mockReset();
  });
  afterEach(() => jest.useFakeTimers());

  describe('buildArgv', () => {
    it('never forwards cwd as a CLI flag or positional', () => {
      const argv = buildArgv('mfe:remote:generate', { cwd: '/tmp/somewhere', force: true });
      expect(argv).toEqual(['remote:generate', '--force', '--json']);
      expect(argv.join(' ')).not.toContain('/tmp/somewhere');
    });
  });

  describe('executeToolCall', () => {
    const options = { schemasDir: 'schemas', cliBin: '/fake/cli.js', timeoutMs: 5000 };

    it('spawns the child in the requested cwd', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-cwd-'));
      spawnMock.mockReturnValue(fakeChild());

      const result = await executeToolCall('mfe:remote:generate', { cwd: dir }, options);

      expect(result.ok).toBe(true);
      const spawnOptions = spawnMock.mock.calls[0][2] as { cwd?: string };
      expect(spawnOptions.cwd).toBe(dir);
      await fs.remove(dir);
    });

    it('defaults to the server cwd when no cwd is given', async () => {
      spawnMock.mockReturnValue(fakeChild());
      await executeToolCall('mfe:remote:generate', {}, options);
      const spawnOptions = spawnMock.mock.calls[0][2] as { cwd?: string };
      expect(spawnOptions.cwd).toBeUndefined();
    });

    it('rejects a cwd that does not exist without spawning', async () => {
      const result = await executeToolCall(
        'mfe:remote:generate',
        { cwd: '/definitely/not/a/real/dir' },
        options
      );
      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.message).toContain('cwd');
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('rejects a cwd that is a file, not a directory', async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-cwd-'));
      const file = path.join(dir, 'not-a-dir.txt');
      await fs.writeFile(file, 'x');

      const result = await executeToolCall('mfe:remote:generate', { cwd: file }, options);

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(spawnMock).not.toHaveBeenCalled();
      await fs.remove(dir);
    });
  });

  describe('tool schemas', () => {
    it('advertises cwd on every tool', async () => {
      const tools = await loadToolRegistry(path.join(__dirname, '..', '..', '..', 'schemas'));
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        const schema = tool.inputSchema as { properties?: Record<string, { type?: string }> };
        expect(schema.properties?.cwd).toBeDefined();
        expect(schema.properties?.cwd.type).toBe('string');
      }
    });
  });
});
