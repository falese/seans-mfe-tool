/**
 * mfe:validate — intra-MFE consistency checks (ADR-073, part of #296).
 *
 * Today this implements the slot half: every slot an MFE declares in
 * `providesSlots` should actually be registered by its app code. A declared
 * slot nothing registers is not a loud failure — under ADR-066 a placement
 * aimed at it simply parks forever — so it needs a design-time check.
 *
 * #296's other assertions (manifest dependencies vs package.json, runtime
 * resolution, federation shared keys, platform-pinned react) drop into the same
 * command; the issue stays open until they do.
 */

import { Flags } from '@oclif/core';
import chalk = require('chalk');
import * as path from 'path';
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError, BusinessError } from '@seans-mfe/contracts';
import {
  findManifest,
  parseManifestFile,
  findUnreferencedSlots,
  type SourceFile,
  type UnreferencedSlotFinding,
} from '@seans-mfe/dsl';

/** Extensions worth scanning for a slot reference. */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.vue', '.svelte']);

/** Never scanned: build output, dependencies, and the generated contract itself. */
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

interface MfeValidateResult {
  manifest: string;
  declaredSlots: string[];
  scannedFiles: number;
  findings: UnreferencedSlotFinding[];
  ok: boolean;
}

/**
 * Read every scannable source file under `dir`, skipping the generated slot
 * contract — `slots.tsx` mirrors the manifest by construction, so counting it
 * as a reference would make the check vacuous.
 */
async function collectSources(dir: string): Promise<SourceFile[]> {
  const sources: SourceFile[] = [];

  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (/^slots\.(tsx?|jsx?)$/.test(entry.name)) continue;
      sources.push({ path: full, text: await fs.readFile(full, 'utf8') });
    }
  };

  if (await fs.pathExists(dir)) await walk(dir);
  return sources;
}

export default class MfeValidate extends BaseCommand<MfeValidateResult> {
  static description = "Validate an MFE's internal consistency (currently: declared slots are implemented)";

  static examples = [
    '$ seans-mfe-tool mfe:validate',
    '$ seans-mfe-tool mfe:validate ./examples/meridian-station/meridian-console',
    '$ seans-mfe-tool mfe:validate --json',
  ];

  static args = {};

  static flags = {
    ...BaseCommand.baseFlags,
    dir: Flags.string({
      char: 'd',
      description: 'MFE directory to validate (default: current directory)',
    }),
    manifest: Flags.string({
      char: 'm',
      description: 'Path to mfe-manifest.yaml (default: auto-detect in the MFE directory)',
    }),
  };

  protected async runCommand(): Promise<MfeValidateResult> {
    const { flags } = await this.parse(MfeValidate);
    const dir = path.resolve(flags.dir ?? process.cwd());

    const manifestPath = flags.manifest ?? (await findManifest(dir));
    if (!manifestPath) {
      throw new ValidationError(
        `No mfe-manifest.yaml found in ${dir}. Pass --manifest to point at one explicitly.`,
        'manifest',
        'required'
      );
    }

    const manifest = (await parseManifestFile(manifestPath)) as {
      providesSlots?: { id: string; description?: string }[];
    };
    const declarations = manifest.providesSlots ?? [];

    const sources = await collectSources(path.join(dir, 'src'));
    const findings = findUnreferencedSlots(declarations, sources);

    const result: MfeValidateResult = {
      manifest: manifestPath,
      declaredSlots: declarations.map((d) => d.id),
      scannedFiles: sources.length,
      findings,
      ok: findings.length === 0,
    };

    if (!this.jsonEnabled()) this.report(result);

    if (!result.ok) {
      throw new BusinessError(
        `${findings.length} declared slot(s) are never registered in app code`,
        'SLOT_DECLARED_BUT_UNREFERENCED',
        { manifest: manifestPath, slots: findings.map((f) => f.slotId) }
      );
    }

    return result;
  }

  private report(result: MfeValidateResult): void {
    console.log(chalk.blue(`\nValidating ${path.relative(process.cwd(), result.manifest) || result.manifest}`));

    if (result.declaredSlots.length === 0) {
      console.log(chalk.gray('  no providesSlots declared — nothing to check\n'));
      return;
    }

    console.log(
      chalk.gray(
        `  ${result.declaredSlots.length} declared slot(s), ${result.scannedFiles} source file(s) scanned\n`
      )
    );

    for (const slotId of result.declaredSlots) {
      const finding = result.findings.find((f) => f.slotId === slotId);
      const mark = finding ? chalk.red('✗') : chalk.green('✓');
      console.log(`  ${mark} ${slotId}`);
      if (finding) console.log(chalk.yellow(`      ${finding.message}`));
    }

    console.log('');
    if (result.ok) {
      console.log(chalk.green('Every declared slot is referenced in app code.'));
    } else {
      // Say plainly what this check can and cannot see (ADR-073 §3).
      console.log(
        chalk.gray(
          'This is a static scan: it matches the literal id (or the prefix before the first\n' +
            '{param} segment). It catches dead declarations and typos, not conditional\n' +
            'registration or ids assembled from non-literal parts.'
        )
      );
    }
    console.log('');
  }
}
