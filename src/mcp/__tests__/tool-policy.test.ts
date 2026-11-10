/**
 * What the MCP server refuses before it spawns anything (ADR-121).
 *
 * An MCP caller is an agent acting on text it has read, so a tool call is
 * untrusted input. Until now the server turned any key into `--key value`,
 * ran the child wherever the caller said, offered tools that can never
 * return, and left a timed-out child's own children running.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

const spawnMock = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { validateToolInput, confineCwd, MCP_DEFAULT_OFF } from '../policy';
import { loadToolRegistry, type McpToolDefinition } from '../tool-registry';
import { executeToolCall } from '../server';

const SCHEMAS = path.join(__dirname, '..', '..', '..', 'schemas');

const DEPLOY_INPUT = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string', enum: ['shell', 'remote', 'api'] },
    port: { type: 'string' },
    retries: { type: 'integer' },
    'dry-run': { type: 'boolean' },
    specs: { type: 'array', items: { type: 'string' } },
    cwd: { type: 'string' },
  },
  required: ['name', 'type'],
  'x-positional': ['name'],
};

const tool: McpToolDefinition = {
  name: 'mfe:deploy',
  description: 'deploy',
  inputSchema: DEPLOY_INPUT,
  command: 'deploy',
};

function fakeChild(opts: { hang?: boolean } = {}): { kill: jest.Mock; pid: number } & Record<string, unknown> {
  return {
    pid: 4242,
    stdout: { on: (event: string, cb: (chunk: Buffer) => void) => event === 'data' && !opts.hang && cb(Buffer.from('{"ok":true,"data":{}}')) },
    stderr: { on: () => undefined },
    on: (event: string, cb: (code: number) => void) => {
      if (event === 'close' && !opts.hang) setImmediate(() => cb(0));
    },
    kill: jest.fn(),
  };
}

beforeEach(() => {
  jest.useRealTimers();
  spawnMock.mockReset();
});
afterEach(() => {
  jest.useFakeTimers();
  jest.restoreAllMocks();
});

describe('validateToolInput', () => {
  it('accepts input that matches the schema', () => {
    expect(validateToolInput(DEPLOY_INPUT, { name: 'app', type: 'remote', 'dry-run': true, specs: ['a.yaml'] })).toEqual([]);
  });

  it('accepts a number where the command takes a string: argv is text either way', () => {
    expect(validateToolInput(DEPLOY_INPUT, { name: 'app', type: 'remote', port: 8080 })).toEqual([]);
  });

  it('refuses a key the tool does not declare', () => {
    const problems = validateToolInput(DEPLOY_INPUT, { name: 'app', type: 'remote', privileged: true });
    expect(problems).toEqual([expect.stringContaining('privileged')]);
  });

  it('refuses a missing required argument', () => {
    expect(validateToolInput(DEPLOY_INPUT, { name: 'app' })).toEqual([expect.stringContaining('type')]);
  });

  it('refuses a value outside the enum', () => {
    expect(validateToolInput(DEPLOY_INPUT, { name: 'app', type: 'cluster' })).toEqual([expect.stringContaining('type')]);
  });

  it.each([
    ['an object for a string', { name: { a: 1 }, type: 'remote' }, 'name'],
    ['a string for a boolean', { name: 'app', type: 'remote', 'dry-run': 'yes' }, 'dry-run'],
    ['a fraction for an integer', { name: 'app', type: 'remote', retries: 1.5 }, 'retries'],
    ['a string for an array', { name: 'app', type: 'remote', specs: 'a.yaml' }, 'specs'],
    ['an object inside an array', { name: 'app', type: 'remote', specs: [{}] }, 'specs'],
  ])('refuses %s', (_label, input, field) => {
    expect(validateToolInput(DEPLOY_INPUT, input as Record<string, unknown>)).toEqual([expect.stringContaining(field)]);
  });

  it('refuses a positional that the CLI would read as a flag', () => {
    expect(validateToolInput(DEPLOY_INPUT, { name: '--force', type: 'remote' })).toEqual([expect.stringContaining('name')]);
  });

  it('refuses a value carrying a NUL or a newline', () => {
    expect(validateToolInput(DEPLOY_INPUT, { name: 'a\nb', type: 'remote' })).toEqual([expect.stringContaining('name')]);
  });

  it('passes a schema with no declared properties through: a third-party tool that predates them', () => {
    expect(validateToolInput({ type: 'object' }, { anything: 1 })).toEqual([]);
  });
});

describe('confineCwd', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-root-')));
    await fs.ensureDir(path.join(root, 'apps', 'one'));
  });
  afterEach(() => fs.remove(root));

  it('accepts the root and a directory inside it', async () => {
    expect(await confineCwd(root, root)).toBe(root);
    expect(await confineCwd(root, path.join(root, 'apps', 'one'))).toBe(path.join(root, 'apps', 'one'));
  });

  it('resolves a relative cwd against the root', async () => {
    expect(await confineCwd(root, 'apps/one')).toBe(path.join(root, 'apps', 'one'));
  });

  it('refuses a directory outside the root', async () => {
    await expect(confineCwd(root, os.tmpdir())).rejects.toThrow(/outside/);
    await expect(confineCwd(root, path.join(root, '..'))).rejects.toThrow(/outside/);
  });

  it('refuses a sibling whose name merely starts with the root', async () => {
    const sibling = `${root}-sibling`;
    await fs.ensureDir(sibling);
    await expect(confineCwd(root, sibling)).rejects.toThrow(/outside/);
    await fs.remove(sibling);
  });

  it('refuses a symlink inside the root that points out of it', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-out-'));
    await fs.symlink(outside, path.join(root, 'escape'));
    await expect(confineCwd(root, path.join(root, 'escape'))).rejects.toThrow(/outside/);
    await fs.remove(outside);
  });

  it('refuses a path that is not an existing directory', async () => {
    await expect(confineCwd(root, path.join(root, 'missing'))).rejects.toThrow(/not an existing directory/);
  });
});

describe('the default tool catalog', () => {
  it('leaves out commands that never return and the one that removes a container', async () => {
    const names = (await loadToolRegistry(SCHEMAS)).map((t) => t.command);
    for (const id of Object.keys(MCP_DEFAULT_OFF)) expect(names).not.toContain(id);
    expect(names).toContain('remote:generate');
    expect(names).toContain('build:prod');
  });

  it('gives a reason for each one it leaves out', () => {
    expect(Object.keys(MCP_DEFAULT_OFF).sort()).toEqual(['bff:dev', 'build:dev', 'decompose:workspace', 'deploy']);
    for (const reason of Object.values(MCP_DEFAULT_OFF)) expect(reason.length).toBeGreaterThan(20);
  });

  it('offers one again when the operator allows it by command id', async () => {
    const names = (await loadToolRegistry(SCHEMAS, { allow: ['build:dev'] })).map((t) => t.command);
    expect(names).toContain('build:dev');
    expect(names).not.toContain('deploy');
  });
});

describe('executeToolCall', () => {
  const options = { schemasDir: SCHEMAS, cliBin: '/fake/cli.js', timeoutMs: 5000 };

  it('refuses invalid input without spawning', async () => {
    const result = await executeToolCall('mfe:deploy', { name: 'app', type: 'remote', privileged: true }, options, tool);
    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe('validation');
    expect(result.error?.message).toContain('privileged');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('refuses a cwd outside the root without spawning', async () => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-root-')));
    const result = await executeToolCall('mfe:deploy', { name: 'app', type: 'remote', cwd: os.homedir() }, { ...options, root }, tool);
    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe('validation');
    expect(result.error?.message).toContain('outside');
    expect(spawnMock).not.toHaveBeenCalled();
    await fs.remove(root);
  });

  it('runs in the root when the call names no cwd', async () => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-root-')));
    spawnMock.mockReturnValue(fakeChild());
    await executeToolCall('mfe:deploy', { name: 'app', type: 'remote' }, { ...options, root }, tool);
    expect((spawnMock.mock.calls[0][2] as { cwd?: string }).cwd).toBe(root);
    await fs.remove(root);
  });

  it('starts the child as a process-group leader, so its own children can be stopped with it', async () => {
    spawnMock.mockReturnValue(fakeChild());
    await executeToolCall('mfe:deploy', { name: 'app', type: 'remote' }, options, tool);
    expect((spawnMock.mock.calls[0][2] as { detached?: boolean }).detached).toBe(process.platform !== 'win32');
  });

  it('on timeout, signals the whole process group rather than the one child', async () => {
    const child = fakeChild({ hang: true });
    spawnMock.mockReturnValue(child);
    const kill = jest.spyOn(process, 'kill').mockImplementation(() => true);

    const result = await executeToolCall('mfe:deploy', { name: 'app', type: 'remote' }, { ...options, timeoutMs: 20 }, tool);

    expect(result.error?.type).toBe('timeout');
    if (process.platform === 'win32') {
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    } else {
      expect(kill).toHaveBeenCalledWith(-4242, 'SIGTERM');
    }
  });

  it('falls back to the child alone when the group cannot be signalled', async () => {
    const child = fakeChild({ hang: true });
    spawnMock.mockReturnValue(child);
    jest.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('ESRCH');
    });

    await executeToolCall('mfe:deploy', { name: 'app', type: 'remote' }, { ...options, timeoutMs: 20 }, tool);

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});

describe('every tool offered is one this server can run', () => {
  /**
   * The registry used to read ~/.config/seans-mfe/mcp.json, start each server
   * listed there and advertise its tools — but `tools/call` only ever spawns
   * this CLI, so a federated tool resolved to a command that does not exist.
   * Starting the server also ran whatever command that file named. The source
   * is gone until a real proxy exists; a config file changes nothing.
   */
  it('does not start anything named in an MCP federation config', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-fed-'));
    const config = path.join(dir, 'mcp.json');
    await fs.writeJson(config, { servers: [{ name: 'coder', command: 'bunx', args: ['some-mcp'] }] });

    const tools = await loadToolRegistry(SCHEMAS, { remoteMcpConfigPath: config } as never);

    expect(spawnMock).not.toHaveBeenCalled();
    expect(tools.some((t) => t.name.startsWith('coder:'))).toBe(false);
    await fs.remove(dir);
  });
});
