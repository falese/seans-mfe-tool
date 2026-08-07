/**
 * ADR-019 conformance — MCP tool calls are child processes, and their envelopes
 * survive the trip back.
 *
 * ADR-019 states five things about every MCP tool call: it spawns
 * `seans-mfe-tool <cmd> --json` as a child process; it captures stdout (the
 * `CommandResult<T>` envelope) and stderr; it parses stdout with `JSON.parse()`
 * and no regex; it maps `CommandResult.success` to the MCP tool response; and it
 * forwards stderr so the agent can see warnings. The rationale is isolation —
 * `process.exit()` in a command must kill only the child.
 *
 * Deliberately driven with **real child processes** rather than a mocked
 * `spawn`. The decision is about process isolation, and a mock cannot exit, so
 * mocking it out would check the code's shape while assuming away the property
 * being decided. `__tests__/cwd-targeting.test.ts` mocks spawn and is right to —
 * it checks argv and options plumbing. This pack checks what actually happens.
 *
 * The mapping check (`ok:true` envelope → MCP success) was **red** when written,
 * for a reason no reading of `src/mcp/server.ts` alone would reveal: commands
 * shell out with `stdio: 'inherit'`, which hands the grandchild the real fd 1,
 * and `redirectStdoutToStderr()` can only patch `process.stdout.write` inside
 * its own process. So a successful `deploy` returned docker's build log *and*
 * its envelope on stdout, `JSON.parse` of the whole buffer threw, and the agent
 * was told the deploy failed with a system error — after the container was
 * already running.
 *
 * Each check has been proven able to fail: point the parser at the first line
 * instead of the last (4), drop `--json` from buildArgv (3), swallow the child's
 * exit code (2), stop forwarding stderr (5).
 */
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { buildArgv } from '../tool-registry';
import { executeToolCall } from '../server';

// The server's timeout uses real setTimeout, and these children are real
// processes; the suite-wide fake timers would park both forever.
jest.useRealTimers();

const MCP_DIR = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.resolve(__dirname, '..', '..', 'commands');

let tmp: string;
beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'adr019-'));
});
afterAll(async () => {
  await fs.remove(tmp);
});

/** Write a throwaway CLI and return the path, for `spawn('node', [cliBin])`. */
async function fakeCli(name: string, body: string): Promise<string> {
  const file = path.join(tmp, `${name}.js`);
  await fs.writeFile(file, body);
  return file;
}

const call = (cliBin: string): ReturnType<typeof executeToolCall> =>
  executeToolCall('mfe:deploy', {}, { schemasDir: 'schemas', cliBin, timeoutMs: 20_000 });

/** Every `.ts` under src/mcp, excluding its own test trees. */
function mcpSources(dir: string = MCP_DIR): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return /^__(tests|conformance)__$/.test(entry.name) ? [] : mcpSources(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

describe('ADR-019: MCP child-process isolation', () => {
  it('never reaches command logic in-process', () => {
    // The decision in one line: "never calling command logic in-process". An
    // import is how that would happen — someone shaving the ~300ms startup cost
    // the ADR accepts under Negative consequences. Checked as a dependency
    // direction rather than by looking for a spawn, because the hazard is the
    // edge that must not exist, not the call that must.
    const files = mcpSources();
    expect(files.length).toBeGreaterThan(0);

    // All three edge forms, because the first draft of this check matched only
    // `from '…'` and a break-test with a bare `import '../commands/deploy'`
    // passed it — a side-effect import is the *most* dangerous of the three
    // here, since loading an oclif command module is itself the risk.
    const SPECIFIER = /(?:from\s*|import\s*|require\s*\(\s*)['"](\.[^'"]+)['"]/g;

    // Collected rather than asserted in the loop so a violation names itself.
    const violations: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(SPECIFIER)) {
        const resolved = path.resolve(path.dirname(file), match[1]);
        if (resolved.startsWith(COMMANDS_DIR + path.sep)) {
          violations.push(`${path.relative(MCP_DIR, file)} imports ${match[1]}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('always asks the child for the JSON envelope', () => {
    // Without --json the child prints human output and there is no envelope to
    // parse at all. It is appended unconditionally, so no input shape can drop
    // it — including one that supplies `json` itself.
    const shapes: Record<string, unknown>[] = [
      {},
      { name: 'widget' },
      { force: true, port: 3000 },
      { json: false },
      { cwd: '/tmp' },
    ];
    for (const input of shapes) {
      expect(buildArgv('mfe:deploy', input)).toContain('--json');
    }
  });

  it('survives a child that exits non-zero, and reports its envelope', async () => {
    // Rationale #1: "oclif commands call process.exit() on validation failure —
    // killing the MCP server". A real exit(64), not a mocked close event.
    const cli = await fakeCli(
      'exits',
      `process.stdout.write(JSON.stringify({ok:false,error:{type:'validation',code:64,message:'bad flag'}})+'\\n');
       process.exit(64);`
    );
    const result = await call(cli);

    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe('validation');
    expect(process.exitCode).toBeUndefined(); // this process is still here to assert it
  });

  it('maps a successful envelope to success even when the child could not keep stdout clean', async () => {
    // The check that was red. ADR-018 says one envelope line on stdout, and
    // BaseCommand redirects `this.log()` to stderr to keep that promise — but
    // the redirect patches `process.stdout.write` in the CLI's own process, and
    // `execSync(..., {stdio:'inherit'})` hands the grandchild the real fd 1.
    // Six MCP-exposed commands do exactly that (api, deploy, build:docker,
    // bff:init, bff:build, bff:dev), so this is the normal case for anything
    // that shells out to npm or docker, not an edge case.
    //
    // Parsing the whole buffer turned that into `system` error 69 for a command
    // that had already succeeded — the worst direction for a failure report,
    // because the side effects happened and the agent is told they did not.
    const cli = await fakeCli(
      'noisy',
      `const {execSync} = require('child_process');
       execSync('echo "#1 [internal] load build definition"', {stdio:'inherit'});
       execSync('echo "#7 naming to docker.io/library/widget:latest done"', {stdio:'inherit'});
       process.stdout.write(JSON.stringify({ok:true,data:{container:'widget-dev',port:3000}})+'\\n');`
    );
    const result = await call(cli);

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ container: 'widget-dev', port: 3000 });
  });

  it('forwards the child stderr to the agent', async () => {
    // Decision point 5. stderr is where every warning and progress line lands
    // under --json, so dropping it leaves an agent debugging blind.
    const cli = await fakeCli(
      'warns',
      `process.stderr.write('warning: framework not declared, defaulting to react\\n');
       process.stdout.write(JSON.stringify({ok:true,data:{}})+'\\n');`
    );
    const result = await call(cli);

    expect(result.ok).toBe(true);
    expect(result.stderr).toContain('framework not declared');
  });

  it('reports a system error when the child produces no envelope at all', async () => {
    // Not every unparseable stdout is a leak to be tolerated. A child that
    // emits only noise genuinely failed the contract, and must be reported as
    // such rather than silently reported ok — otherwise the check above would
    // have been bought by making the parser credulous.
    const cli = await fakeCli('silent', `process.stdout.write('Cannot find module\\n');`);
    const result = await call(cli);

    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe('system');
  });
});
