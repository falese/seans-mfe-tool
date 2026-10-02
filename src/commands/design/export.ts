/**
 * design:export — capture a working UI and emit a Figma import bundle (POC).
 *
 * The reverse direction of every other generator in the tool: instead of
 * manifest → code, this renders the running UI in headless Chromium, folds
 * the DOM + computed styles into a normalized design tree, and writes a
 * self-contained Figma plugin that recreates the page as editable layers.
 *
 * Output layout under --out:
 *   design.json            the normalized tree (inspect / diff / debug)
 *   screenshot.png         reference render of the captured page
 *   figma-plugin/          manifest.json + code.js + README.md — import via
 *                          Plugins → Development → Import plugin from manifest
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { captureDesignTree } from '../../design/dom-capture';
import { buildDesignTree } from '../../design/design-tree';
import { renderPluginBundle } from '../../design/figma-plugin';
import { ValidationError } from '@seans-mfe/contracts';
import type { DesignExportResult } from '../../oclif/results';

function parseViewport(raw: string): { width: number; height: number } {
  const m = raw.match(/^(\d+)x(\d+)$/);
  if (!m) {
    throw new ValidationError(
      `--viewport must look like 1440x900, got "${raw}"`,
      'viewport',
      'WxH'
    );
  }
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

export default class DesignExport extends BaseCommand<DesignExportResult> {
  static description =
    'Capture a running UI and generate a Figma import bundle: renders the page ' +
    'in headless Chromium, extracts the layout/styles into a design tree, and ' +
    'writes a Figma plugin (manifest.json + code.js) that recreates it as ' +
    'editable frames, text, and images. Experimental — POC, no ADR yet.';

  static args = {
    url: Args.string({
      description: 'URL of the running UI to capture (e.g. http://localhost:3001)',
      required: true,
    }),
  };

  static examples = [
    '$ seans-mfe-tool design:export http://localhost:3001',
    '$ seans-mfe-tool design:export http://localhost:3001 --out ./figma-export --viewport 1440x900',
    '$ seans-mfe-tool design:export https://staging.example.com/app --name "Checkout Flow"',
    '$ seans-mfe-tool design:export http://localhost:3001 --no-full-page  # viewport only',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    out: Flags.string({
      description: 'Output directory for the export bundle',
      default: './figma-export',
    }),
    name: Flags.string({
      description: 'Name for the root frame / plugin (default: page title)',
      required: false,
    }),
    viewport: Flags.string({
      description: 'Capture viewport as WxH',
      default: '1440x900',
    }),
    wait: Flags.integer({
      description: 'Settle time in ms after page load before capturing',
      default: 1200,
    }),
    'full-page': Flags.boolean({
      description: 'Expand the viewport to the full scroll height',
      default: true,
      allowNo: true,
    }),
    'max-depth': Flags.integer({
      description: 'Maximum element nesting depth to capture',
      default: 20,
    }),
  };

  protected async runCommand(): Promise<DesignExportResult> {
    const { args, flags } = await this.parse(DesignExport);

    const url = args.url;
    if (!/^https?:\/\//.test(url) && !url.startsWith('file://')) {
      throw new ValidationError(
        `url must be http(s) or file:// — got "${url}"`,
        'url',
        'absolute-url'
      );
    }

    const outDir = path.resolve(flags.out);
    const viewport = parseViewport(flags.viewport);

    this.log(chalk.blue(`\nCapturing ${url} (${viewport.width}x${viewport.height})...\n`));

    const capture = await captureDesignTree({
      url,
      viewport,
      waitMs: flags.wait,
      fullPage: flags['full-page'],
    });

    const { root, fonts, stats } = buildDesignTree(capture.records, {
      maxDepth: flags['max-depth'],
    });
    const name = flags.name ?? capture.title ?? 'Design Export';
    root.name = name;

    const bundle = renderPluginBundle(root, fonts, { name, sourceUrl: url });

    const pluginDir = path.join(outDir, 'figma-plugin');
    await fs.ensureDir(pluginDir);
    const files: string[] = [];
    const write = async (rel: string, content: string | Buffer): Promise<void> => {
      const full = path.join(outDir, rel);
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, content);
      files.push(full);
    };

    await write('design.json', `${JSON.stringify(root, null, 2)}\n`);
    await write('screenshot.png', capture.screenshot);
    for (const [file, content] of Object.entries(bundle)) {
      await write(path.join('figma-plugin', file), content);
    }

    if (stats.truncated > 0) {
      this.warnings.push(
        `${stats.truncated} node(s) dropped beyond --max-depth ${flags['max-depth']}`
      );
    }

    this.log(
      chalk.green(
        `  ✓ ${stats.elements + stats.texts + stats.images + stats.placeholders} layers ` +
          `(${stats.elements} frames, ${stats.texts} text, ${stats.images} images, ` +
          `${stats.placeholders} placeholders), ${fonts.length} fonts`
      )
    );
    this.log(`  design.json     ${path.join(outDir, 'design.json')}`);
    this.log(`  screenshot.png  ${path.join(outDir, 'screenshot.png')}`);
    this.log(`  figma-plugin/   ${pluginDir}`);
    this.log(
      chalk.gray(
        '\n  In Figma desktop: Plugins → Development → Import plugin from manifest →\n' +
          `  pick ${path.join(pluginDir, 'manifest.json')}, then run the plugin.\n`
      )
    );

    return {
      url,
      outDir,
      name,
      stats,
      fonts,
      files,
    };
  }
}
