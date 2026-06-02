/**
 * Unit tests for capabilityImplemented — the symbol-presence check that lets
 * remote:generate preserve a capability whose feature file already exports it.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { capabilityImplemented } from '../unified-generator';

let dir: string;

beforeEach(async () => {
  dir = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'cap-impl-')),
  );
});

afterEach(async () => {
  await fs.remove(dir);
});

async function writeComponent(file: string, content: string): Promise<string> {
  const p = path.join(dir, file);
  await fs.writeFile(p, content, 'utf8');
  return p;
}

describe('capabilityImplemented (react-rspack)', () => {
  it('returns false when the feature file does not exist', async () => {
    const missing = path.join(dir, 'PlayGame.tsx');
    expect(await capabilityImplemented(missing, 'PlayGame', 'react-rspack')).toBe(false);
  });

  it('returns true for the generated stub (export const + default)', async () => {
    const p = await writeComponent(
      'PlayGame.tsx',
      `export const PlayGame: React.FC<PlayGameProps> = () => null;\nexport default PlayGame;\n`,
    );
    expect(await capabilityImplemented(p, 'PlayGame', 'react-rspack')).toBe(true);
  });

  it('returns true for a hand-written implementation', async () => {
    const p = await writeComponent(
      'PlayGame.tsx',
      `import React from 'react';\nexport const PlayGame: React.FC = () => {\n  return <canvas />;\n};\n`,
    );
    expect(await capabilityImplemented(p, 'PlayGame', 'react-rspack')).toBe(true);
  });

  it('returns false when the file exists but exports no matching symbol', async () => {
    const p = await writeComponent('PlayGame.tsx', `export const SomethingElse = 1;\n`);
    expect(await capabilityImplemented(p, 'PlayGame', 'react-rspack')).toBe(false);
  });
});

describe('capabilityImplemented (angular-webpack)', () => {
  it('returns true for an exported <Name>Component class', async () => {
    const p = await writeComponent(
      'PlayGame.component.ts',
      `@Component({})\nexport class PlayGameComponent {}\nexport default PlayGameComponent;\n`,
    );
    expect(await capabilityImplemented(p, 'PlayGame', 'angular-webpack')).toBe(true);
  });

  it('returns false when no matching class is exported', async () => {
    const p = await writeComponent('PlayGame.component.ts', `export class OtherComponent {}\n`);
    expect(await capabilityImplemented(p, 'PlayGame', 'angular-webpack')).toBe(false);
  });
});
