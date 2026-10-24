/**
 * decompose:propose — the deterministic first draft of a decomposition, and
 * everything derived from it (ADR-110, #415).
 *
 * Clusters the analysis (and the capture, when joined) into candidate domains
 * and writes decomposition.yaml: domains with their files, capabilities,
 * backends and per-signal evidence; shared files with suggestions; couplings
 * through the shared store or the shell; slots and routes; test triage; and
 * the capabilities no kept test covers. Then derives a manifest per domain and
 * the composition, and validates both as `mfe:validate` and `compose:build`
 * would.
 *
 * Judgment — names, merges, splits — is the operating agent's: edit
 * decomposition.yaml and run `propose --from` to re-derive.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { propose } from '../../decompose/propose/cluster';
import { deriveFleet } from '../../decompose/propose/derive';
import { dumpYaml, readAnalysis, readDecomposition, writeFleet } from '../../decompose/propose/io';
import type { Decomposition } from '../../decompose/propose/model';
import type { DecomposeProposeResult } from '../../oclif/results';

const SAFE = (s: string) => s.toLowerCase().replace(/^@[^/]+\//, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'app';

export default class DecomposePropose extends BaseCommand<DecomposeProposeResult> {
  static description =
    'Propose a decomposition from decompose:analyze output — candidate domains with per-signal evidence, ' +
    'shared files, couplings, slots, routes and test triage — and derive validated MFE manifests and a ' +
    'composition. --from re-derives after the proposal is edited (ADR-110).';

  static args = {
    analysis: Args.string({
      description: 'Directory holding decompose:analyze output (an evidence bundle\'s source/, or its --out)',
      required: false,
    }),
  };

  static examples = [
    '$ seans-mfe-tool decompose:propose ./evidence/source --name meridian',
    '$ seans-mfe-tool decompose:propose --from ./evidence/proposal/decomposition.yaml',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    out: Flags.string({ description: 'Directory to write the proposal and derived fleet (default: <analysis>/../proposal)' }),
    name: Flags.string({ description: 'Prefix for MFE names (default: the app\'s package name)' }),
    namespace: Flags.string({ description: 'Control-plane namespace (default: the name)' }),
    from: Flags.string({ description: 'An edited decomposition.yaml to re-derive from, instead of clustering' }),
  };

  protected async runCommand(): Promise<DecomposeProposeResult> {
    const { args, flags } = await this.parse(DecomposePropose);
    let doc: Decomposition;
    let outDir: string;
    const files: string[] = [];

    if (flags.from) {
      const from = path.resolve(flags.from);
      doc = await readDecomposition(from);
      outDir = path.resolve(flags.out ?? path.dirname(from));
      this.log(chalk.blue(`\nRe-deriving from ${from}\n`));
    } else {
      if (!args.analysis) throw new ValidationError('pass the decompose:analyze output directory, or --from', 'analysis', 'required');
      const dir = path.resolve(args.analysis);
      const analysis = await readAnalysis(dir);
      const name = SAFE(flags.name ?? analysis.project.name);
      doc = propose({
        appName: name,
        namespace: flags.namespace ?? name,
        graph: analysis.graph,
        tests: analysis.tests,
        history: analysis.history,
        join: analysis.join,
      });
      outDir = path.resolve(flags.out ?? path.join(dir, '..', 'proposal'));
      await fs.ensureDir(outDir);
      const base = path.join(outDir, 'proposal.base.yaml');
      await fs.writeFile(base, `# The deterministic draft (decompose:propose). Kept to diff the agent's edits against; do not edit.\n${dumpYaml(doc)}`);
      files.push(base);
      this.log(chalk.blue(`\nProposing from ${dir}\n`));
    }

    await fs.ensureDir(outDir);
    const proposalFile = path.join(outDir, 'decomposition.yaml');
    if (!flags.from || path.resolve(flags.from) !== proposalFile) {
      await fs.writeFile(proposalFile, `# Edit this, then: seans-mfe-tool decompose:propose --from ${path.relative(process.cwd(), proposalFile)}\n${dumpYaml(doc)}`);
    }
    files.push(proposalFile);
    const fleet = deriveFleet(doc);
    files.push(...(await writeFleet(outDir, fleet)));

    const valid = Object.values(fleet.validation.manifests).every((e) => e.length === 0) && fleet.validation.composition.length === 0;
    const verdicts = { keep: 0, rewrite: 0, discard: 0 };
    for (const t of doc.tests) verdicts[t.verdict] += 1;

    for (const d of doc.domains) {
      this.log(`  ${chalk.bold(d.id.padEnd(16))} ${String(d.files.length).padStart(2)} files  ${d.capabilities.map((c) => c.name).join(', ')}${d.backends.length ? chalk.gray(`  ← ${d.backends.join(', ')}`) : ''}`);
    }
    this.log(`  shared: ${doc.shared.map((s) => s.file).join(', ') || 'none'}`);
    for (const c of doc.couplings) this.log(chalk.yellow(`  coupling: ${c.file} reads ${c.owner}'s ${c.field} — ${c.note}`));
    this.log(`  tests: ${verdicts.keep} keep, ${verdicts.rewrite} rewrite, ${verdicts.discard} discard; ${doc.uncovered.length} capabilities uncovered`);
    this.log(valid ? chalk.green('  ✓ every manifest and the composition validate') : chalk.red('  ✗ validation failed — see validation in --json'));
    this.log(`  out   ${outDir}\n`);
    if (!valid) this.warnings.push('derived manifests or composition do not validate');

    return {
      outDir,
      mode: flags.from ? 'rederived' : 'clustered',
      domains: doc.domains.map((d) => ({ id: d.id, mfe: d.mfe, files: d.files.length, capabilities: d.capabilities.map((c) => c.name), backends: d.backends })),
      shared: doc.shared.map((s) => s.file),
      unassigned: doc.unassigned,
      couplings: doc.couplings.length,
      tests: verdicts,
      uncovered: doc.uncovered.length,
      validation: fleet.validation,
      valid,
      files: files.sort(),
    };
  }
}
