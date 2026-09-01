/**
 * The starter plugin exists and obeys the contract that cites it.
 *
 * `docs/PLUGIN-CONTRACT.md` and `CLAUDE.md` both pointed at
 * `examples/plugin-skeleton/` while the directory did not exist — the contract
 * told a plugin author to go read a working example that had been deleted.
 *
 * It lives under `examples/`, which jest and eslint both exclude by design
 * (that tree is generator output held to its manifests by check:mfe-drift).
 * So nothing would notice it disappearing, or drifting away from the rules it
 * is supposed to demonstrate — which is how it went missing the first time.
 * This test is the smallest thing that keeps the citation honest.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SKELETON = path.join(REPO_ROOT, 'examples', 'plugin-skeleton');
const COMMAND = path.join(SKELETON, 'src', 'commands', 'greet', 'hello.ts');

const read = (p: string): string => fs.readFileSync(p, 'utf8');

describe('examples/plugin-skeleton', () => {
  it('exists, because two documents tell authors to read it', () => {
    expect(fs.existsSync(SKELETON)).toBe(true);
    for (const doc of ['docs/PLUGIN-CONTRACT.md', 'CLAUDE.md']) {
      expect(read(path.join(REPO_ROOT, doc))).toContain('examples/plugin-skeleton');
    }
  });

  describe('package.json', () => {
    const pkg = () => JSON.parse(read(path.join(SKELETON, 'package.json')));

    it('declares the oclif command directory and a topic', () => {
      expect(pkg().oclif?.commands).toBe('./dist/commands');
      expect(pkg().oclif?.bin).toBe('seans-mfe-tool');
      expect(Object.keys(pkg().oclif?.topics ?? {})).not.toHaveLength(0);
    });

    it('depends on oclif-base and contracts as real dependencies', () => {
      // PLUGIN-CONTRACT §1: regular dependencies, not peer — the plugin owns
      // its own copy.
      const deps = pkg().dependencies ?? {};
      expect(deps['@seans-mfe/oclif-base']).toBeDefined();
      expect(deps['@seans-mfe/contracts']).toBeDefined();
      expect(pkg().peerDependencies?.['@oclif/core']).toBeDefined();
    });
  });

  describe('the example command', () => {
    const source = () =>
      ts.createSourceFile(COMMAND, read(COMMAND), ts.ScriptTarget.Latest, true);

    const commandClass = (): ts.ClassDeclaration => {
      const found = source().statements.find(ts.isClassDeclaration);
      if (!found) throw new Error('no class declaration in the skeleton command');
      return found;
    };

    it('extends BaseCommand', () => {
      const heritage = commandClass().heritageClauses ?? [];
      const extended = heritage
        .filter((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
        .flatMap((h) => h.types.map((t) => t.expression.getText()));
      expect(extended).toContain('BaseCommand');
    });

    it('implements runCommand() and does not override run()', () => {
      const methods = commandClass()
        .members.filter(ts.isMethodDeclaration)
        .map((m) => m.name.getText());
      expect(methods).toContain('runCommand');
      // Overriding run() skips envelope emission and exit-code mapping — the
      // single most consequential mistake a plugin author can make (ADR-016).
      expect(methods).not.toContain('run');
    });

    // Both of the following read the AST rather than the text, for the reason
    // src/__tests__/import-direction.test.ts documents: this very file's doc
    // comment says "Do not call process.exit()", and a regex over the source
    // matched that sentence and failed the test. Prose about a rule is not a
    // violation of it.
    const callsIn = (file: string): string[] => {
      const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
      const calls: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) calls.push(node.expression.getText());
        if (ts.isNewExpression(node)) calls.push(`new ${node.expression.getText()}`);
        ts.forEachChild(node, visit);
      };
      visit(sf);
      return calls;
    };

    it('throws only typed errors, never a raw Error', () => {
      expect(callsIn(COMMAND)).not.toContain('new Error');
      expect(read(COMMAND)).toMatch(/from '@seans-mfe\/contracts'/);
    });

    it('never calls process.exit()', () => {
      expect(callsIn(COMMAND)).not.toContain('process.exit');
    });
  });
});
