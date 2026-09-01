import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { BaseCommand } from '@seans-mfe/oclif-base';
import { ValidationError } from '@seans-mfe/contracts';
import { formatErrorsForCLI } from '@seans-mfe/dsl';
import { compileIntent } from '../../coder-service';
import { validateManifestText } from '../../oracle';
import {
  DEFAULT_ADAPTOR,
  type CoderRunner,
  type CoderTransport,
  type IntentCompileRequest,
  type IntentCompileResult,
} from '../../types';

/** Options accepted by {@link coderCompileCommand}, decoupled from oclif flags. */
export interface CoderCompileOptions {
  intent: string;
  adaptor?: string;
  system?: string;
  model?: string;
  context?: string[];
  endpoint?: string;
  out?: string;
  /** Return an invalid candidate instead of failing closed (debug/eval). */
  allowInvalid?: boolean;
}

/**
 * Compile a business intent into a candidate `mfe-manifest.yaml` via the
 * external coder service, then validate it with the in-repo DSL oracle.
 *
 * Fails closed (ADR-084/086): an invalid manifest throws {@link ValidationError}
 * unless `allowInvalid` is set. The `runner` is injectable so this is unit-
 * testable without a running coder model.
 */
export async function coderCompileCommand(
  options: CoderCompileOptions,
  runner?: CoderRunner,
): Promise<IntentCompileResult> {
  const started = Date.now();

  const transport: CoderTransport | undefined = options.endpoint
    ? { kind: 'serve', endpoint: options.endpoint }
    : undefined;

  const request: IntentCompileRequest = {
    intent: options.intent,
    adaptor: options.adaptor ?? DEFAULT_ADAPTOR,
    ...(options.system ? { systemPromptPath: options.system } : {}),
    ...(options.model ? { model: options.model } : {}),
    ...(options.context && options.context.length > 0
      ? { context: { contextFiles: options.context } }
      : {}),
    ...(transport ? { transport } : {}),
  };

  console.log(
    chalk.blue(
      `Compiling intent via coder (adaptor: ${request.adaptor}, transport: ${
        transport?.kind ?? 'subprocess'
      })...`,
    ),
  );

  const candidate = await compileIntent(request, runner);
  const validation = validateManifestText(candidate.yaml);
  const durationMs = Date.now() - started;

  if (!validation.valid) {
    console.error(chalk.red('\n✗ Generated manifest failed DSL validation:'));
    console.error(formatErrorsForCLI(validation.errors));
    if (!options.allowInvalid) {
      // Fail closed: the deterministic pipeline downstream must never receive an
      // invalid manifest (ADR-084). --allow-invalid opts out for debugging.
      throw new ValidationError(
        `coder produced an invalid manifest (${validation.errors.length} error(s)); ` +
          `re-run with --allow-invalid to inspect it`,
        'mfe-manifest.yaml',
        'dsl-valid',
      );
    }
  }

  let outPath: string | undefined;
  if (options.out && validation.valid) {
    outPath = path.resolve(process.cwd(), options.out);
    await writeFile(outPath, ensureTrailingNewline(candidate.yaml), 'utf8');
    console.log(chalk.green(`\n✓ Wrote ${outPath}`));
  }

  if (validation.valid) {
    console.log(chalk.green('✓ Manifest is DSL-valid'));
  }

  return {
    candidate,
    validation,
    valid: validation.valid,
    ...(outPath ? { outPath } : {}),
    durationMs,
  };
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

export default class CoderCompile extends BaseCommand<IntentCompileResult> {
  static description =
    'Compile a business intent into a DSL mfe-manifest.yaml via the external coder service (ADR-085/ADR-088)';

  static examples = [
    '<%= config.bin %> coder:compile "A kids game MFE that mixes two paints to hit a target color"',
    '<%= config.bin %> coder:compile "..." --adaptor intent-manifest --system prompts/system.md --out mfe-manifest.yaml',
    '<%= config.bin %> coder:compile "..." --endpoint http://localhost:3991 --json',
  ];

  static args = {
    intent: Args.string({
      description: 'The refined natural-language business intent to compile',
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
    adaptor: Flags.string({
      char: 'a',
      description: 'coder adaptor to select',
      default: DEFAULT_ADAPTOR,
    }),
    system: Flags.string({
      char: 's',
      description: 'Path to the DSL-grammar system prompt passed to coder (--system)',
    }),
    model: Flags.string({
      char: 'm',
      description: 'MLX model dir/id to pass through to coder (--model)',
    }),
    context: Flags.string({
      char: 'c',
      description: 'Context file forwarded to coder (--context); repeatable',
      multiple: true,
    }),
    endpoint: Flags.string({
      char: 'e',
      description: 'Use a running `coder serve` SSE endpoint instead of a subprocess',
    }),
    out: Flags.string({
      char: 'o',
      description: 'Write the validated manifest to this path',
    }),
    'allow-invalid': Flags.boolean({
      description: 'Return an invalid candidate instead of failing closed (debug/eval)',
      default: false,
    }),
  };

  protected async runCommand(): Promise<IntentCompileResult> {
    const { args, flags } = await this.parse(CoderCompile);
    return coderCompileCommand({
      intent: args.intent,
      adaptor: flags.adaptor,
      ...(flags.system ? { system: flags.system } : {}),
      ...(flags.model ? { model: flags.model } : {}),
      ...(flags.context ? { context: flags.context } : {}),
      ...(flags.endpoint ? { endpoint: flags.endpoint } : {}),
      ...(flags.out ? { out: flags.out } : {}),
      allowInvalid: flags['allow-invalid'],
    });
  }
}
