/**
 * decompose:present — the agreement artifact for a proposal PR (ADR-110 §3, #416).
 *
 * Writes, beside decomposition.yaml:
 *   PROPOSAL.md                 domains and why, shared files, risks, test triage, how to change it
 *   overlay/index.html          the captured screens with each proposed domain outlined
 *   overlay/screens/*.png       the screenshots it shows
 *   overlay/figma-plugin/       the same overlay as a Figma page (Plugins → Development → Import plugin from manifest)
 *
 * Re-run after any edit: everything is derived from the proposal and the evidence bundle.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { ValidationError } from '@seans-mfe/contracts';
import { BaseCommand } from '../../oclif/BaseCommand';
import { readDecomposition, readEvidenceSteps } from '../../decompose/propose/io';
import { buildOverlay, renderOverlayHtml, renderOverlayPlugin, renderProposalMarkdown } from '../../decompose/propose/present';
import type { DecomposePresentResult } from '../../oclif/results';

export default class DecomposePresent extends BaseCommand<DecomposePresentResult> {
  static description =
    'Write the agreement artifact for a decomposition proposal PR: PROPOSAL.md, and an overlay of the proposed ' +
    'domains on the captured screens as an HTML page and a Figma plugin (ADR-110).';

  static args = {
    proposal: Args.string({ description: 'The proposal directory (holding decomposition.yaml)', required: true }),
  };

  static examples = ['$ seans-mfe-tool decompose:present ./evidence/proposal --evidence ./evidence'];

  static flags = {
    ...BaseCommand.baseFlags,
    evidence: Flags.string({ description: 'The decompose:capture evidence bundle whose screens to overlay (default: the proposal directory\'s parent)' }),
  };

  protected async runCommand(): Promise<DecomposePresentResult> {
    const { args, flags } = await this.parse(DecomposePresent);
    const dir = path.resolve(args.proposal);
    const doc = await readDecomposition(path.join(dir, 'decomposition.yaml'));
    const bundle = path.resolve(flags.evidence ?? path.join(dir, '..'));
    if (!(await fs.pathExists(path.join(bundle, 'bundle.json')))) {
      throw new ValidationError(`${bundle} is not an evidence bundle (no bundle.json) — pass --evidence`, 'evidence', 'bundle');
    }
    const meta = (await fs.readJson(path.join(bundle, 'bundle.json'))) as { viewport: { width: number; height: number } };
    const overlay = buildOverlay(doc, await readEvidenceSteps(bundle), meta.viewport);

    const files: string[] = [];
    const write = async (rel: string, content: string | Buffer) => {
      const full = path.join(dir, rel);
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, content);
      files.push(full);
    };
    await write('PROPOSAL.md', renderProposalMarkdown(doc));
    await fs.remove(path.join(dir, 'overlay'));
    const pngs: Record<string, Buffer> = {};
    for (const s of overlay.screens) {
      const src = path.join(bundle, s.screenshot);
      if (!(await fs.pathExists(src))) continue;
      pngs[s.screenshot] = await fs.readFile(src);
      await write(path.join('overlay', s.screenshot), pngs[s.screenshot]);
    }
    await write(path.join('overlay', 'index.html'), renderOverlayHtml(overlay, doc.app.name));
    for (const [name, content] of Object.entries(renderOverlayPlugin(overlay, pngs, doc.app.name))) {
      await write(path.join('overlay', 'figma-plugin', name), content);
    }

    const shown = [...new Set(overlay.screens.flatMap((s) => s.boxes.map((b) => b.domain)))];
    const notShown = doc.domains.map((d) => d.id).filter((d) => !shown.includes(d));
    const boxes = overlay.screens.reduce((n, s) => n + s.boxes.length, 0);
    if (notShown.length > 0) this.warnings.push(`no captured screen shows ${notShown.join(', ')} — add a journey that reaches it`);
    this.log(chalk.green(`\n  ✓ ${overlay.screens.length} screens, ${boxes} domain boxes; ${shown.length}/${doc.domains.length} domains shown`));
    this.log(`  PROPOSAL.md       ${path.join(dir, 'PROPOSAL.md')}`);
    this.log(`  overlay           ${path.join(dir, 'overlay', 'index.html')}`);
    this.log(`  figma plugin      ${path.join(dir, 'overlay', 'figma-plugin', 'manifest.json')}\n`);

    return {
      proposalDir: dir,
      screens: overlay.screens.length,
      boxes,
      domainsShown: shown,
      domainsNotShown: notShown,
      files: files.sort(),
    };
  }
}
