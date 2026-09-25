/**
 * docs/PLATFORM-CONTRACT.md is the base-class reference, and its tables are
 * generated (ADR-080: the contract is defined once, in code). These pin the
 * three sources the tables read and prove the per-build names it prints are
 * the names the generated Swift and Rust actually use — a table that could
 * disagree with the code would be the drift the generator exists to stop.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
} from '../../packages/contracts/src/platform-contract';
import {
  capabilityTable,
  laneNames,
  lifecycleTable,
  readResultShapes,
  resultShapesSection,
  applyGenerated,
  MARKERS,
} from '../generate-platform-contract';

const REPO = path.resolve(__dirname, '..', '..');
const EXAMPLE = path.join(REPO, 'examples/meridian-station/meridian-crew-services');

describe('capabilityTable', () => {
  const table = capabilityTable();

  /** Every row for one capability, across both tables. */
  const rowsFor = (name: string): string =>
    table.split('\n').filter((l) => l.startsWith(`| \`${name}\``)).join('\n');

  it('has one row per platform capability in each of its two tables, in contract order', () => {
    const rows = table.split('\n').filter((l) => l.startsWith('| `'));
    const names = rows.map((r) => r.match(/^\| `([a-zA-Z]+)`/)![1]);
    expect(names).toEqual([...PLATFORM_CAPABILITIES, ...PLATFORM_CAPABILITIES]);
  });

  it('keeps each table narrow enough for the published page (four columns at most)', () => {
    for (const header of table.split('\n').filter((l) => l.startsWith('| Capability'))) {
      expect(header.split('|').length - 2).toBeLessThanOrEqual(4);
    }
  });

  it('carries each capability\'s hook, result type and state rules from the spec', () => {
    const load = rowsFor('load');
    expect(load).toContain('`doLoad`');
    expect(load).toContain('`LoadResult`');
    expect(load).toContain('`loading`');
    expect(load).toContain('`ready`');
    expect(load).toContain(PLATFORM_CAPABILITY_SPECS.load.description);
  });

  it('says "any state" for emit, the one capability with no pre-states', () => {
    expect(rowsFor('emit')).toContain('any state');
  });
});

describe('lifecycleTable', () => {
  it('lists every legal edge and marks destroyed terminal', () => {
    const table = lifecycleTable();
    expect(table).toContain('| `uninitialized` | `loading` |');
    expect(table).toContain('| `ready` | `loading`, `rendering`, `destroyed` |');
    expect(table).toContain('| `destroyed` | none (terminal) |');
  });
});

describe('readResultShapes', () => {
  const shapes = readResultShapes();

  it('reads every result interface a capability names, from capability-results.ts', () => {
    for (const name of PLATFORM_CAPABILITIES) {
      const type = PLATFORM_CAPABILITY_SPECS[name].resultType;
      if (type === 'void' || type === 'boolean') continue;
      expect(Object.keys(shapes)).toContain(type);
    }
  });

  it('records optionality and the declared type, comments stripped', () => {
    const health = shapes.HealthResult;
    expect(health.find((f) => f.name === 'status')).toEqual({
      name: 'status',
      optional: false,
      type: "'healthy' | 'degraded' | 'unhealthy'",
    });
    const error = shapes.LoadResult.find((f) => f.name === 'error')!;
    expect(error.optional).toBe(true);
    expect(error.type).not.toContain('/*');
  });

  it('uses plain-text headings, which the published page\'s table of contents can show', () => {
    const headings = resultShapesSection(shapes).split('\n').filter((l) => l.startsWith('#'));
    expect(headings).toContain('#### load → LoadResult');
    for (const h of headings) expect(h).not.toContain('`');
  });

  it('renders void and boolean results as prose, not empty tables', () => {
    const section = resultShapesSection(shapes);
    expect(section).toContain('`refresh` returns nothing');
    expect(section).toContain('`authorizeAccess` returns a boolean');
  });
});

describe('laneNames', () => {
  const table = laneNames();

  it('gives the Swift and Rust spellings of every orchestrator and hook', () => {
    const row = table.split('\n').find((l) => l.startsWith('| `updateControlPlaneState`'))!;
    expect(row).toContain('`doUpdateControlPlaneState`');
    expect(row).toContain('`update_control_plane_state`');
    expect(row).toContain('`do_update_control_plane_state`');
  });

  it('prints only names the generated Rust crate actually defines', () => {
    const rust = fs.readFileSync(path.join(EXAMPLE, 'rust/src/platform/mfe_base.rs'), 'utf8');
    for (const name of table.match(/`[a-z_]+`/g)!.map((n) => n.slice(1, -1)).filter((n) => /_|^[a-z]+$/.test(n))) {
      expect(rust).toMatch(new RegExp(`fn ${name}\\b`));
    }
  });

  it('prints only names the generated Swift package actually defines', () => {
    const dir = path.join(EXAMPLE, 'swift/Sources/MFE/Platform');
    const swift = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    for (const name of PLATFORM_CAPABILITIES) {
      expect(swift).toMatch(new RegExp(`func ${name}\\(`));
      expect(swift).toMatch(new RegExp(`func ${PLATFORM_CAPABILITY_SPECS[name].wrapperMethod}\\(`));
    }
  });
});

describe('applyGenerated', () => {
  const blocks = { capabilities: 'CAPS', lifecycle: 'LIFE', results: 'RES', lanes: 'LANES' };
  const doc = Object.keys(MARKERS)
    .map((key) => `prose\n${MARKERS[key as keyof typeof MARKERS][0]}\nstale\n${MARKERS[key as keyof typeof MARKERS][1]}`)
    .join('\n');

  it('replaces only what sits between each pair of markers', () => {
    const out = applyGenerated(doc, blocks);
    expect(out).toContain(`${MARKERS.capabilities[0]}\nCAPS\n${MARKERS.capabilities[1]}`);
    expect(out).not.toContain('stale');
    expect(out.match(/prose/g)).toHaveLength(4);
  });

  it('fails loudly when a marker is missing', () => {
    expect(() => applyGenerated('no markers here', blocks)).toThrow(/capabilities/);
  });

  it('keeps the committed document current', () => {
    const committed = fs.readFileSync(path.join(REPO, 'docs/PLATFORM-CONTRACT.md'), 'utf8');
    const fresh = applyGenerated(committed, {
      capabilities: capabilityTable(),
      lifecycle: lifecycleTable(),
      results: resultShapesSection(readResultShapes()),
      lanes: laneNames(),
    });
    expect(fresh).toBe(committed);
  });
});
