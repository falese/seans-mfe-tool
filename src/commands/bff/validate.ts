import { Flags } from '@oclif/core';
import chalk = require('chalk');
import * as path from 'path';
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError } from '@seans-mfe/contracts';
import { extractMeshConfig } from './_shared';
import type { BFFCommandOptions } from './_shared';
import type { BffValidateResult, BffValidationIssue } from '../../oclif/results';

export async function bffValidateCommand(
  options: BFFCommandOptions = {}
): Promise<BffValidateResult> {
  const issues: BffValidationIssue[] = [];

  try {
    console.log(chalk.blue('Validating BFF configuration...'));

    const manifestPath = options.manifest || 'mfe-manifest.yaml';
    const { meshConfig, manifest } = await extractMeshConfig(manifestPath);

    console.log(chalk.blue('\nValidating sources...'));
    for (const source of meshConfig.sources) {
      if (!source.name) {
        throw new ValidationError(
          'Each source must have a "name" property',
          'source.name',
          'required'
        );
      }
      if (!source.handler?.openapi?.source) {
        throw new ValidationError(
          `Source "${source.name}" is missing handler.openapi.source`,
          `sources.${source.name}.handler.openapi.source`,
          'required'
        );
      }
      const specPath = source.handler.openapi.source;
      if (!specPath.startsWith('http')) {
        const absoluteSpecPath = path.resolve(process.cwd(), specPath);
        if (!(await fs.pathExists(absoluteSpecPath))) {
          issues.push({
            severity: 'warning',
            message: `OpenAPI spec not found: ${specPath}`,
            path: specPath,
          });
          console.log(chalk.yellow(`⚠ OpenAPI spec not found: ${specPath}`));
        } else {
          console.log(chalk.green(`✓ Source "${source.name}": ${specPath}`));
        }
      } else {
        console.log(chalk.green(`✓ Source "${source.name}": ${specPath} (remote)`));
      }
    }

    if (meshConfig.transforms) {
      console.log(chalk.blue('\nValidating transforms...'));
      const validTransforms = [
        'prefix',
        'rename',
        'filterSchema',
        'encapsulate',
        'namingConvention',
      ];
      for (const transform of meshConfig.transforms) {
        const transformType = Object.keys(transform)[0];
        if (!validTransforms.includes(transformType)) {
          issues.push({
            severity: 'warning',
            message: `Unknown transform type: ${transformType}`,
            path: transformType,
          });
          console.log(chalk.yellow(`⚠ Unknown transform type: ${transformType}`));
        } else {
          console.log(chalk.green(`✓ Transform: ${transformType}`));
        }
      }
    }

    if (meshConfig.plugins) {
      console.log(chalk.blue('\nValidating plugins...'));
      const knownPlugins = ['responseCache', 'rateLimit', 'prometheus', 'depthLimit', 'csrf'];
      for (const plugin of meshConfig.plugins) {
        const pluginName = Object.keys(plugin)[0];
        if (!knownPlugins.includes(pluginName)) {
          issues.push({
            severity: 'warning',
            message: `Unknown plugin: ${pluginName} (may require additional package)`,
            path: pluginName,
          });
          console.log(chalk.yellow(`⚠ Unknown plugin: ${pluginName}`));
        } else {
          console.log(chalk.green(`✓ Plugin: ${pluginName}`));
        }
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    if (!hasErrors) {
      console.log(chalk.green('\n✓ BFF configuration is valid'));
    }
    return { valid: !hasErrors, issues, meshConfig, manifest };
  } catch (error) {
    console.error(chalk.red('\n✗ Validation failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class BffValidate extends BaseCommand<BffValidateResult> {
  static description = 'Validate BFF configuration without building';

  static flags = {
    ...BaseCommand.baseFlags,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to mfe-manifest.yaml',
      default: 'mfe-manifest.yaml',
    }),
  };

  protected async runCommand(): Promise<BffValidateResult> {
    const { flags } = await this.parse(BffValidate);
    return bffValidateCommand({ manifest: flags.manifest });
  }
}
