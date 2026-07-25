/**
 * slots:validate — cross-MFE placement-target validation (ADR-073).
 *
 * ADR-067 §4 named the manifest "the registry-side validation target": the
 * thing rule-authoring tooling checks a placement against before runtime. This
 * is that check. Given the fleet's manifests and its placement rules, every
 * `resolve.props.slot` must name an address some provider declares.
 *
 * Rules aimed at an address nobody declares do not fail loudly at runtime —
 * ADR-066 parks them and waits — which is exactly why the check has to happen
 * here, at config time.
 */

import { Flags } from '@oclif/core';
import chalk = require('chalk');
import * as path from 'path';
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError, BusinessError } from '@seans-mfe/contracts';
import {
  parseManifestFile,
  validatePlacementRules,
  type PlacementFinding,
  type PlacementRuleDocument,
} from '@seans-mfe/dsl';
import type { SlotProviderDeclarations } from '@seans-mfe/contracts';

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

interface SlotsValidateResult {
  providers: { mfe: string; slots: string[] }[];
  rulesFile: string;
  rulesChecked: number;
  findings: PlacementFinding[];
  ok: boolean;
}

/** Every directory under `root` holding an mfe-manifest.yaml. */
async function findManifests(root: string): Promise<string[]> {
  const found: string[] = [];

  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        await walk(path.join(current, entry.name));
      } else if (entry.name === 'mfe-manifest.yaml') {
        found.push(path.join(current, entry.name));
      }
    }
  };

  if (await fs.pathExists(root)) await walk(root);
  return found.sort();
}

export default class SlotsValidate extends BaseCommand<SlotsValidateResult> {
  static description = 'Validate registry placement targets against the fleet\'s declared slots';

  static examples = [
    '$ seans-mfe-tool slots:validate --rules ./control-plane/rules.json',
    '$ seans-mfe-tool slots:validate --rules ./rules.json --manifests ./examples/meridian-station',
    '$ seans-mfe-tool slots:validate --rules ./rules.json --json',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    rules: Flags.string({
      char: 'r',
      description: 'Path to a placement rules JSON file ({registration, routes} documents)',
      required: true,
    }),
    manifests: Flags.string({
      char: 'm',
      description: 'Directory to scan for mfe-manifest.yaml files (default: current directory)',
    }),
  };

  protected async runCommand(): Promise<SlotsValidateResult> {
    const { flags } = await this.parse(SlotsValidate);

    const rulesFile = path.resolve(flags.rules);
    if (!(await fs.pathExists(rulesFile))) {
      throw new ValidationError(`Rules file not found: ${rulesFile}`, 'rules', 'existing-path');
    }

    let documents: PlacementRuleDocument[];
    try {
      const parsed: unknown = await fs.readJson(rulesFile);
      documents = Array.isArray(parsed) ? (parsed as PlacementRuleDocument[]) : [parsed as PlacementRuleDocument];
    } catch (error) {
      throw new ValidationError(
        `Could not parse ${rulesFile} as JSON: ${(error as Error).message}`,
        'rules',
        'valid-json'
      );
    }

    const manifestRoot = path.resolve(flags.manifests ?? process.cwd());
    const providers: SlotProviderDeclarations[] = [];
    for (const manifestPath of await findManifests(manifestRoot)) {
      const manifest = (await parseManifestFile(manifestPath)) as {
        name?: string;
        providesSlots?: { id: string; description?: string }[];
      };
      // Only providers matter here — an MFE that declares no slots contributes
      // no addresses, and including it would wrongly turn "unknown provider"
      // (advisory) into "undeclared slot" (fatal) for a typo'd provider id.
      if (!manifest.name || !manifest.providesSlots?.length) continue;
      providers.push({ mfeId: manifest.name, declarations: manifest.providesSlots });
    }

    const findings = validatePlacementRules(documents, providers);
    const rulesChecked = documents.reduce((total, doc) => total + (doc.routes?.length ?? 0), 0);

    const result: SlotsValidateResult = {
      providers: providers.map((p) => ({ mfe: p.mfeId, slots: p.declarations.map((d) => d.id) })),
      rulesFile,
      rulesChecked,
      findings,
      ok: !findings.some((f) => f.fatal),
    };

    if (!this.jsonEnabled()) this.report(result);

    if (!result.ok) {
      const fatal = findings.filter((f) => f.fatal);
      throw new BusinessError(
        `${fatal.length} placement rule(s) target a slot no provider declares`,
        'PLACEMENT_TARGET_UNDECLARED',
        { rulesFile, targets: fatal.map((f) => f.slot) }
      );
    }

    return result;
  }

  private report(result: SlotsValidateResult): void {
    console.log(chalk.blue(`\nValidating ${path.relative(process.cwd(), result.rulesFile) || result.rulesFile}`));
    console.log(
      chalk.gray(`  ${result.rulesChecked} route(s) against ${result.providers.length} slot provider(s)\n`)
    );

    for (const provider of result.providers) {
      console.log(chalk.gray(`  ${provider.mfe}: ${provider.slots.join(', ')}`));
    }
    console.log('');

    for (const finding of result.findings) {
      const mark = finding.fatal ? chalk.red('✗') : chalk.yellow('!');
      console.log(`  ${mark} ${finding.mfe}.${finding.capability} → ${finding.slot}`);
      console.log(chalk.gray(`      ${finding.message}`));
    }

    if (result.findings.length === 0) {
      console.log(chalk.green('Every placement target resolves to a declared slot.'));
    } else if (result.ok) {
      console.log(chalk.yellow('Advisory findings only — no rule targets an undeclared slot.'));
    }
    console.log('');
  }
}
