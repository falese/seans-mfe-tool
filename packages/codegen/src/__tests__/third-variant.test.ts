/**
 * The acceptance test for ADR-091: a third framework generates without editing
 * the generator.
 *
 * ADR-036 promised framework support as template-variant data. `renderFiles`
 * then carried six comparisons against the string literal `'angular-webpack'`,
 * and `FrameworkVariant.templateVariant` was a closed union of the two
 * built-ins, so adding a framework meant editing the generator in six places
 * and widening a type. The generator's own header asserted the opposite the
 * whole time, which is why a test has to hold this rather than a comment.
 *
 * This registers a minimal `preact-rspack` variant against a temporary
 * template directory and generates a real MFE from it. **Nothing under
 * `packages/codegen/src/` is modified to make it pass.** If a future change
 * puts a framework decision back into the generator, this fails.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import type { DSLManifest } from '@seans-mfe/dsl';
import { generateAllFiles } from '../unified-generator';
import { registerVariant, unregisterVariant, type CodegenVariant } from '../variants';

const VARIANT_ID = 'preact-rspack';

/** A manifest with one domain capability and no BFF. */
const manifest = {
  name: 'third-variant-demo',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  framework: 'preact',
  bundler: 'rspack',
  endpoint: 'http://localhost:3131',
  capabilities: [{ Widget: { type: 'domain', description: 'a widget' } }],
} as unknown as DSLManifest;

describe('a third framework variant', () => {
  let templateDir: string;
  let outDir: string;
  let variant: CodegenVariant;

  beforeAll(async () => {
    // The variant's own template directory — the only thing a new framework
    // ships besides the variant object itself.
    templateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preact-tpl-'));
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preact-out-'));

    await fs.outputFile(
      path.join(templateDir, 'app.tsx.ejs'),
      "export const App = () => <div><%= name %></div>;\n",
    );
    await fs.outputFile(
      path.join(templateDir, 'features', 'component.tsx.ejs'),
      "export const <%= name %> = () => <div><%= description %></div>;\n",
    );
    await fs.outputFile(path.join(templateDir, 'features', 'index.ts.ejs'), "export * from './<%= name %>';\n");
    await fs.outputFile(path.join(templateDir, 'features', 'spec.tsx.ejs'), "test('<%= name %>', () => {});\n");
    await fs.outputFile(
      path.join(templateDir, 'features', 'remote.tsx.ejs'),
      "<%_ capabilities.forEach(function (c) { _%>\nexport * from './features/<%= c %>';\n<%_ }); _%>",
    );

    variant = {
      id: VARIANT_ID,
      framework: 'preact',
      bundler: 'rspack',
      // Absolute, because this variant's templates are not inside the
      // generator's own templates/ directory — exactly the case a plugin is in.
      templateDirName: templateDir,
      ownsRootTsconfig: true,
      featureFiles: (name) => ({
        component: `${name}.tsx`,
        componentTemplate: 'component.tsx.ejs',
        spec: `${name}.spec.tsx`,
        specTemplate: 'spec.tsx.ejs',
      }),
      implementedPatterns: (name) => [new RegExp(`export const ${name}\\b`)],
      remoteEntry: { template: 'features/remote.tsx.ejs', out: 'src/remote.tsx' },
      specs: [{ template: 'app.tsx.ejs', out: 'src/App.tsx', owner: 'developer' }],
    };
    registerVariant(variant);
  });

  afterAll(async () => {
    unregisterVariant(VARIANT_ID);
    await fs.remove(templateDir);
    await fs.remove(outDir);
  });

  it('generates from a variant the generator has never heard of', async () => {
    const { files } = await generateAllFiles(manifest, outDir, {
      frameworkVariant: { framework: 'preact', bundler: 'rspack', templateVariant: VARIANT_ID },
    });

    const byPath = new Map(files.map((f) => [path.relative(outDir, f.path), f]));

    // The variant's own spec.
    expect(byPath.get('src/App.tsx')?.content).toContain('third-variant-demo');
    // Its per-capability naming, used for the feature file and its barrel.
    expect(byPath.get('src/features/Widget/Widget.tsx')?.content).toContain('a widget');
    expect(byPath.get('src/features/Widget/Widget.spec.tsx')).toBeDefined();
    // Its remote entry naming.
    expect(byPath.get('src/remote.tsx')?.content).toContain("./features/Widget");
  });

  it('gets the shared platform contract without declaring it', async () => {
    // PLATFORM_SPECS is variant-independent: a new framework does not restate
    // where mfe.ts lives, only what its template says. This variant ships no
    // platform templates, so those specs report and skip rather than crash —
    // the point being that the plan, not the variant, decides the addresses.
    const { files } = await generateAllFiles(manifest, outDir, {
      frameworkVariant: { framework: 'preact', bundler: 'rspack', templateVariant: VARIANT_ID },
    });
    expect(files.some((f) => f.path.endsWith('__mocks__/fileMock.js'))).toBe(true);
  });

  it('carries the variant ownership decisions into overwrite flags', async () => {
    const { files } = await generateAllFiles(manifest, outDir, {
      frameworkVariant: { framework: 'preact', bundler: 'rspack', templateVariant: VARIANT_ID },
    });
    const app = files.find((f) => f.path.endsWith('src/App.tsx'));
    const remote = files.find((f) => f.path.endsWith('src/remote.tsx'));

    expect(app?.overwrite).toBe(false); // developer-owned, per the variant's spec
    expect(remote?.overwrite).toBe(true); // generator-owned, per the shared plan
  });

  it('required no framework name in the render pipeline', () => {
    // The structural half of the property: grep the files that decide what
    // gets emitted. Comments may name frameworks; code may not.
    const src = fs
      .readFileSync(path.join(__dirname, '..', 'unified-generator.ts'), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');

    // renderFiles is the function that used to hold all six branches.
    const renderFilesBody = src.slice(src.indexOf('async function renderFiles'));
    expect(renderFilesBody).not.toMatch(/'angular-webpack'|'react-rspack'/);
  });
});
