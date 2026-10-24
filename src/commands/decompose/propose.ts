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
 * Each BFF's data sources need an OpenAPI document. Where the evidence bundle
 * recorded traffic, one is inferred per backend from it and the client code;
 * a published spec (`--spec`, or a non-inferred one left in specs/) wins, and
 * the inferred one reports how it differs (ADR-112).
 *
 * Judgment — names, merges, splits — is the operating agent's: edit
 * decomposition.yaml and run `propose --from` to re-derive.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { propose } from '../../decompose/propose/cluster';
import { deriveFleet, type BackendSpecs } from '../../decompose/propose/derive';
import { dumpYaml, readAnalysis, readDecomposition, readSpecs, readTraffic, writeFleet, writeSpecs } from '../../decompose/propose/io';
import type { Decomposition } from '../../decompose/propose/model';
import { chooseSpecs, inferSpecs, validateOpenApi, type InferredBackend, type OpenApiDocument, type SpecReport } from '../../decompose/propose/openapi';
import type { Endpoint, SourceGraph } from '../../decompose/source/graph';
import type { DecomposeProposeResult, DecomposeSpecSummary } from '../../oclif/results';

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
    evidence: Flags.string({
      description: 'The decompose:capture bundle whose recorded traffic the BFF specs are inferred from (default: the parent of the analysis directory, or of the proposal with --from)',
    }),
    spec: Flags.string({ description: 'backend=path — a published OpenAPI document for a backend; it is used instead of the inferred one (ADR-112 §3)', multiple: true }),
  };

  protected async runCommand(): Promise<DecomposeProposeResult> {
    const { args, flags } = await this.parse(DecomposePropose);
    let doc: Decomposition;
    let outDir: string;
    let graph: SourceGraph | undefined;
    let evidenceDefault: string;
    const files: string[] = [];

    if (flags.from) {
      const from = path.resolve(flags.from);
      doc = await readDecomposition(from);
      outDir = path.resolve(flags.out ?? path.dirname(from));
      evidenceDefault = path.join(path.dirname(from), '..');
      const graphFile = path.join(evidenceDefault, 'source', 'graph.json');
      if (await fs.pathExists(graphFile)) graph = (await fs.readJson(graphFile)) as SourceGraph;
      this.log(chalk.blue(`\nRe-deriving from ${from}\n`));
    } else {
      if (!args.analysis) throw new ValidationError('pass the decompose:analyze output directory, or --from', 'analysis', 'required');
      const dir = path.resolve(args.analysis);
      const analysis = await readAnalysis(dir);
      graph = analysis.graph;
      evidenceDefault = path.join(dir, '..');
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

    const { backends, report } = await this.specs(outDir, path.resolve(flags.evidence ?? evidenceDefault), flags.spec ?? [], graph);
    if (backends) files.push(...(await writeSpecs(outDir, backends)));
    const specs: DecomposeSpecSummary[] = [];
    for (const r of report) {
      const errors = backends ? await validateOpenApi(backends.specs[r.backend]) : [];
      const c = r.comparison;
      specs.push({
        backend: r.backend,
        source: r.source,
        operations: r.operations,
        errors,
        ...(c
          ? {
              differences: {
                operationsMatched: c.operations.matched.length,
                inferredOnly: c.operations.inferredOnly,
                publishedOnly: c.operations.realOnly,
                fieldsMatched: c.fields.matched,
                fieldsInferredOnly: c.fields.inferredOnly.length,
                fieldsPublishedOnly: c.fields.realOnly.length,
                typeMismatches: c.fields.typeMismatches,
              },
            }
          : {}),
      });
      if (c) {
        const diff = path.join(outDir, 'specs', `${r.backend}.differences.json`);
        await fs.writeFile(diff, `${JSON.stringify(c, null, 2)}\n`);
        files.push(diff);
      }
    }
    const fleet = deriveFleet(doc, backends);
    files.push(...(await writeFleet(outDir, fleet)));

    const valid =
      Object.values(fleet.validation.manifests).every((e) => e.length === 0) &&
      fleet.validation.composition.length === 0 &&
      specs.every((sp) => sp.errors.length === 0);
    const verdicts = { keep: 0, rewrite: 0, discard: 0 };
    for (const t of doc.tests) verdicts[t.verdict] += 1;

    for (const d of doc.domains) {
      this.log(`  ${chalk.bold(d.id.padEnd(16))} ${String(d.files.length).padStart(2)} files  ${d.capabilities.map((c) => c.name).join(', ')}${d.backends.length ? chalk.gray(`  ← ${d.backends.join(', ')}`) : ''}`);
    }
    this.log(`  shared: ${doc.shared.map((s) => s.file).join(', ') || 'none'}`);
    for (const c of doc.couplings) this.log(chalk.yellow(`  coupling: ${c.file} reads ${c.owner}'s ${c.field} — ${c.note}`));
    for (const sp of specs) {
      const d = sp.differences;
      this.log(
        `  spec ${chalk.bold(sp.backend.padEnd(14))} ${sp.source.padEnd(9)} ${String(sp.operations).padStart(3)} operations` +
          (sp.errors.length ? chalk.red(`  ✗ ${sp.errors[0]}`) : chalk.green('  ✓ OpenAPI 3')) +
          (d ? chalk.gray(`  inferred matches ${d.operationsMatched} operations, ${d.fieldsMatched} fields; ${d.inferredOnly.length} not published, ${d.typeMismatches.length} type mismatches`) : '')
      );
    }
    if (specs.length === 0) this.log(chalk.yellow('  specs: no recorded traffic or published spec — the BFF data sources point at specs that do not exist yet'));
    this.log(`  tests: ${verdicts.keep} keep, ${verdicts.rewrite} rewrite, ${verdicts.discard} discard; ${doc.uncovered.length} capabilities uncovered`);
    this.log(valid ? chalk.green('  ✓ every manifest, the composition and every spec validate') : chalk.red('  ✗ validation failed — see validation and specs in --json'));
    this.log(`  out   ${outDir}\n`);
    if (!valid) this.warnings.push('derived manifests, composition or BFF specs do not validate');

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
      specs,
      files: files.sort(),
    };
  }

  /**
   * The spec for each backend (ADR-112): inferred from the bundle's traffic and
   * the client code, with a published one — `--spec`, or a non-inferred file
   * already in specs/ — winning. Without traffic, the specs already beside the
   * proposal are kept as they are.
   */
  private async specs(
    outDir: string,
    evidenceDir: string,
    specFlags: string[],
    graph: SourceGraph | undefined
  ): Promise<{ backends?: BackendSpecs; report: SpecReport[] }> {
    const existing = await readSpecs(outDir);
    const published: Record<string, OpenApiDocument> = {};
    for (const [b, d] of Object.entries(existing?.specs ?? {})) if (!d.info?.['x-smt-inferred']) published[b] = d;
    for (const s of specFlags) {
      const i = s.indexOf('=');
      if (i <= 0) throw new ValidationError(`--spec expects backend=path, got "${s}"`, 'spec', 'backend=path');
      const file = path.resolve(s.slice(i + 1));
      if (!(await fs.pathExists(file))) throw new ValidationError(`--spec ${s}: ${file} does not exist`, 'spec', 'exists');
      published[s.slice(0, i)] = yaml.load(await fs.readFile(file, 'utf8')) as OpenApiDocument;
    }

    const traffic = await readTraffic(evidenceDir);
    if (!traffic) {
      // Nothing to infer from: keep the inferred specs already beside the proposal.
      const kept: Record<string, InferredBackend> = {};
      for (const [b, d] of Object.entries(existing?.specs ?? {})) if (!published[b]) kept[b] = { document: d, mocks: existing?.mocks?.[b] ?? {} };
      if (Object.keys(kept).length + Object.keys(published).length === 0) return { report: [] };
      const chosen = chooseSpecs(kept, published);
      // A published spec's fixtures were re-keyed when it was first chosen; keep them.
      for (const b of Object.keys(published)) if (existing?.mocks?.[b]) chosen.backends.mocks[b] = existing.mocks[b];
      return chosen;
    }

    const code: Endpoint[] = [];
    const seen = new Set<string>();
    for (const f of graph?.files ?? []) {
      for (const e of [...f.endpoints, ...f.storeReads.flatMap((r) => r.endpoints)]) {
        const k = `${e.method} ${e.url}`;
        if (!seen.has(k)) {
          seen.add(k);
          code.push(e);
        }
      }
    }
    return chooseSpecs(inferSpecs({ ...traffic, code }), published);
  }
}
