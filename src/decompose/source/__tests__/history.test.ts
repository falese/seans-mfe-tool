import { coChange, MAX_COMMIT_FILES, ownersOf, parseCodeOwners, parseGitLog } from '../history';

describe('parseGitLog / coChange', () => {
  const log = ['@@aaa', 'src/a.ts', 'src/b.ts', '', '@@bbb', 'src/a.ts', 'src/b.ts', 'README.md', '', '@@ccc', 'src/c.ts', ''].join('\n');
  const files = new Set(['src/a.ts', 'src/b.ts', 'src/c.ts']);

  it('splits the log into commits', () => {
    expect(parseGitLog(log)).toEqual([['src/a.ts', 'src/b.ts'], ['src/a.ts', 'src/b.ts', 'README.md'], ['src/c.ts']]);
  });

  it('counts pairs of source files changed together, and changes per file', () => {
    expect(coChange(parseGitLog(log), files)).toEqual({
      pairs: [{ a: 'src/a.ts', b: 'src/b.ts', commits: 2 }],
      changes: { 'src/a.ts': 2, 'src/b.ts': 2, 'src/c.ts': 1 },
    });
  });

  it('ignores sweeping commits', () => {
    const many = Array.from({ length: MAX_COMMIT_FILES + 1 }, (_, i) => `src/f${i}.ts`);
    expect(coChange([many], new Set(many)).pairs).toEqual([]);
  });
});

describe('CODEOWNERS', () => {
  const rules = parseCodeOwners(`
# platform owns everything by default
*                     @platform
/src/pages/cargo/     @cargo-team   # trailing comment
src/components/crew/** @crew-team
*.test.tsx            @qa
`);

  it('parses rules and lets the last match win', () => {
    expect(ownersOf(rules, 'src/api/client.ts')).toEqual(['@platform']);
    expect(ownersOf(rules, 'src/pages/cargo/CargoManifest.tsx')).toEqual(['@cargo-team']);
    expect(ownersOf(rules, 'src/components/crew/PayStatus.tsx')).toEqual(['@crew-team']);
    expect(ownersOf(rules, 'src/components/crew/__tests__/PayStatus.test.tsx')).toEqual(['@qa']);
  });

  it('anchors patterns with a leading or middle slash to the root; others match at any depth', () => {
    expect(ownersOf(parseCodeOwners('/pages/ @x'), 'src/pages/a.ts')).toEqual([]);
    expect(ownersOf(parseCodeOwners('docs/pages/ @x'), 'src/pages/a.ts')).toEqual([]);
    expect(ownersOf(parseCodeOwners('pages/ @x'), 'src/pages/a.ts')).toEqual(['@x']);
    expect(ownersOf(parseCodeOwners('a.ts @x'), 'src/pages/a.ts')).toEqual(['@x']);
  });
});
