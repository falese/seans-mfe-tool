/**
 * ADR-011 conformance — `data.generatedFrom` records where generated types came
 * from, and survives the round trip.
 *
 * Reported plainly, because it is the first of these that came out clean:
 * **nothing here was red.** ADR-011 says the DSL `data:` section carries an
 * optional `generatedFrom` array whose entries record the spec path, the
 * upstream service, and the version. The schema accepts exactly that, the
 * generated registry-facing JSON schema exposes all three fields, the BFF
 * template emits an entry per source, and lineage survives a pass through
 * `extractMeshConfig`. A small decision, correctly implemented.
 *
 * Two things are worth writing down rather than asserting.
 *
 * **The field is written and never read.** ADR-011's justification is registry
 * queries — "which MFEs use this API?", "impact analysis when an API changes" —
 * and no code in this repo reads `generatedFrom`. Every occurrence is a schema
 * declaration, a type, or a template that writes it. That is not a violation:
 * the Decision is only that the section *includes* the field, and the use cases
 * are listed as "enabled", not built. But an unread field is how a schema rots,
 * so check 2 pins the shape the future reader will depend on.
 *
 * **`version` is documented and never generated.** The Decision's example shows
 * `version: 2.1.0` and the template — the ADR's own sole `implemented-by` —
 * emits `openapi` and `service` only. The ADR's Consequences say version fields
 * "require discipline", which reads as human-maintained, so check 4 requires
 * the two the generator can actually know and does not manufacture a failure
 * out of the third.
 *
 * The one real hazard is the mirror. `packages/bff-plugin/src/shared.ts` keeps a
 * hand-written copy of the manifest's `data:` block, and its own docstring
 * records that this exact field, plus ADR-052's `mockSwitch`, "were added there
 * and never mirrored here, so bff:validate returned a manifest its own
 * published schema rejected". It has drifted once already. Check 3 is the
 * regression guard, and check 5 covers the behaviour that drift destroyed.
 *
 * Each check proven able to fail: drop `version` from DataLineageSchema (1),
 * remove the field from the generated JSON schema (2), delete it from the
 * plugin mirror (3), stop the template emitting a service (4), strip the field
 * on the BFF path (5).
 */
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as ejs from 'ejs';
import { dump as toYaml, load as parseYaml } from 'js-yaml';
import { DataConfigSchema } from '@falese/smt-dsl';
import { extractMeshConfig } from '@falese/smt-plugin-bff/shared';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE = path.join(
  REPO_ROOT,
  'packages',
  'bff-plugin',
  'templates',
  'mfe-manifest.yaml.ejs'
);

/** A `data:` block carrying lineage in exactly the shape ADR-011 documents. */
const LINEAGE = [
  { openapi: './specs/api.yaml', service: 'analysis-api', version: '2.1.0' },
  { openapi: 'https://orders.internal/swagger.json', service: 'orders-api', version: '3.0.0' },
];

describe('ADR-011: generatedFrom traceability', () => {
  it('accepts the lineage shape the decision documents', () => {
    // The ADR's own example, parsed. All three keys, both a relative path and a
    // URL, because the Decision text explicitly allows "file path or URL".
    const parsed = DataConfigSchema.safeParse({
      sources: [{ name: 'api', handler: { openapi: { source: './specs/api.yaml' } } }],
      generatedFrom: LINEAGE,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.generatedFrom).toEqual(LINEAGE);

    // Optional — an MFE with hand-written types declares no lineage and must
    // still parse.
    expect(
      DataConfigSchema.safeParse({
        sources: [{ name: 'api', handler: { openapi: { source: './s.yaml' } } }],
      }).success
    ).toBe(true);

    // An array, not a single object. The registry queries in the rationale are
    // "which MFEs share data sources" — plural by construction.
    expect(
      DataConfigSchema.safeParse({
        sources: [{ name: 'api', handler: { openapi: { source: './s.yaml' } } }],
        generatedFrom: LINEAGE[0],
      }).success
    ).toBe(false);
  });

  it('exposes lineage in the registry-facing JSON schema', () => {
    // The contract a registry actually consumes. ADR-011 exists for queries by
    // `service` and by `openapi`; a field that is in the Zod schema but absent
    // from the published JSON schema is invisible to every consumer that is not
    // this codebase.
    const schema = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'schemas', 'dsl', 'manifest.schema.json'), 'utf8')
    ) as Record<string, never>;

    const found: Record<string, unknown>[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      const props = obj.properties as Record<string, unknown> | undefined;
      if (props?.generatedFrom) found.push(props.generatedFrom as Record<string, unknown>);
      for (const value of Object.values(obj)) walk(value);
    };
    walk(schema);

    expect(found.length).toBeGreaterThan(0);
    const items = found[0].items as { properties?: Record<string, unknown> };
    expect(found[0].type).toBe('array');
    for (const key of ['openapi', 'service', 'version']) {
      expect(Object.keys(items.properties ?? {})).toContain(key);
    }
  });

  it('keeps the plugin mirror carrying the field it once lost', () => {
    // `packages/bff-plugin/src/shared.ts` is a hand-maintained copy of the
    // canonical DataConfigSchema — deliberately, because the plugin is
    // self-contained — and its docstring records that it already fell behind on
    // this exact field. A copy that has drifted once will drift again; this is
    // the cheap guard that says so.
    const mirror = fs.readFileSync(
      path.join(REPO_ROOT, 'packages', 'bff-plugin', 'src', 'shared.ts'),
      'utf8'
    );
    // To end of line, not to the first `;` — the declaration is an inline
    // object literal whose own members are semicolon-separated, so a `[^;]+`
    // match stopped after `openapi?: string` and reported the field as having
    // lost `service` and `version` when it had not.
    const declaration = mirror.match(/^\s*generatedFrom\?:.*$/m)?.[0];
    expect(declaration).toBeDefined();
    for (const key of ['openapi', 'service', 'version']) {
      expect(declaration).toContain(key);
    }
  });

  it('emits one lineage entry per source from the template', async () => {
    // The ADR's sole `implemented-by`. Rendered rather than read, because the
    // failure worth catching is a context key that quietly resolves to
    // undefined and writes `- openapi:` with nothing after it.
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    const rendered = await ejs.render(
      template,
      {
        name: 'probe-mfe',
        version: '1.0.0',
        type: 'remote',
        port: 3000,
        playground: true,
        transforms: [],
        plugins: [],
        sources: [
          { name: 'analysisAPI', spec: './specs/analysis.yaml' },
          { name: 'ordersAPI', spec: './specs/orders.yaml' },
        ],
      },
      { async: true }
    );

    const manifest = parseYaml(rendered) as { data?: { generatedFrom?: unknown[] } };
    const lineage = manifest.data?.generatedFrom as { openapi?: string; service?: string }[];

    expect(lineage).toHaveLength(2);
    expect(lineage).toEqual([
      { openapi: './specs/analysis.yaml', service: 'analysisAPI' },
      { openapi: './specs/orders.yaml', service: 'ordersAPI' },
    ]);
  });

  it('preserves lineage through the BFF path', async () => {
    // The behaviour the mirror drift destroyed: a manifest carrying lineage went
    // through `bff:validate` and came back as something its own published schema
    // rejected. Driven through the real `extractMeshConfig` against a real
    // example manifest rather than a fixture, so the parse is the one the
    // command performs.
    const source = path.join(REPO_ROOT, 'examples', 'abc-kids', 'flappy', 'mfe-manifest.yaml');
    const doc = parseYaml(fs.readFileSync(source, 'utf8')) as {
      data: Record<string, unknown>;
    };
    doc.data.generatedFrom = LINEAGE;

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'adr011-'));
    try {
      const file = path.join(dir, 'mfe-manifest.yaml');
      await fs.writeFile(file, toYaml(doc));

      const { manifest } = await extractMeshConfig(file);
      expect((manifest as { data?: { generatedFrom?: unknown } }).data?.generatedFrom).toEqual(
        LINEAGE
      );
    } finally {
      await fs.remove(dir);
    }
  }, 60_000);
});
