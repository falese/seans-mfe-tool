import { diffPackageDependencies } from '../package-dependency-diff';

const pkg = (dependencies: Record<string, string>, devDependencies: Record<string, string> = {}): string =>
  JSON.stringify({ name: 'x', dependencies, devDependencies });

describe('diffPackageDependencies', () => {
  it('returns nothing when the on-disk package.json already matches the render', () => {
    const rendered = pkg({ react: '~18.2.0' }, { typescript: '^5.3.3' });
    const current = pkg({ react: '~18.2.0' }, { typescript: '^5.3.3' });
    expect(diffPackageDependencies(rendered, current)).toEqual([]);
  });

  it('reports a dependency present in the render but absent on disk as missing', () => {
    const rendered = pkg({ react: '~18.2.0', express: '^4.18.2' });
    const current = pkg({ react: '~18.2.0' });
    expect(diffPackageDependencies(rendered, current)).toEqual([
      { section: 'dependencies', name: 'express', expected: '^4.18.2', actual: undefined },
    ]);
  });

  it('reports a version mismatch when both sides declare the dependency differently', () => {
    const rendered = pkg({ react: '~18.2.0' });
    const current = pkg({ react: '^18.0.0' });
    expect(diffPackageDependencies(rendered, current)).toEqual([
      { section: 'dependencies', name: 'react', expected: '~18.2.0', actual: '^18.0.0' },
    ]);
  });

  it('checks devDependencies the same way as dependencies', () => {
    const rendered = pkg({}, { '@graphql-mesh/cli': '^0.100.21' });
    const current = pkg({}, {});
    expect(diffPackageDependencies(rendered, current)).toEqual([
      { section: 'devDependencies', name: '@graphql-mesh/cli', expected: '^0.100.21', actual: undefined },
    ]);
  });

  it('does not flag a dependency the developer added that the render does not know about', () => {
    const rendered = pkg({ react: '~18.2.0' });
    const current = pkg({ react: '~18.2.0', lodash: '^4.17.21' });
    expect(diffPackageDependencies(rendered, current)).toEqual([]);
  });

  it('is generic across any dependency the template renders, not just BFF/Mesh ones', () => {
    const rendered = pkg(
      { react: '~18.2.0', '@mui/material': '^5.14.0' },
      { '@rspack/cli': '^1.7.0', '@types/react': '^18.0.28' },
    );
    const current = pkg({}, {});
    const diff = diffPackageDependencies(rendered, current);
    expect(diff.map((d) => d.name).sort()).toEqual(
      ['@mui/material', '@rspack/cli', '@types/react', 'react'].sort(),
    );
  });

  it('throws on unparseable JSON so the caller can decide what "not this reporter\'s problem" means', () => {
    expect(() => diffPackageDependencies('not json', pkg({}))).toThrow();
    expect(() => diffPackageDependencies(pkg({}), 'not json')).toThrow();
  });
});
