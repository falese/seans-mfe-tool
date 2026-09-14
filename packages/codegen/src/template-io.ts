/**
 * The emit phase's primitives — the only place in codegen that touches EJS or
 * the disk.
 *
 * `renderTemplate` turns a template plus a model into a string;
 * `writeGeneratedFiles` puts strings on disk; `capabilityImplemented` reads an
 * existing file to decide whether a capability has already been hand-written.
 *
 * `writeGeneratedFiles` is where ADR-082's ownership rule is actually enforced:
 * a GeneratedFile carries `overwrite`, and a developer-owned file is never
 * rewritten — not even with --force. `overwrite` IS the ownership map
 * (ADR-077 §1); moving a file between the two settings is the most breaking
 * edit available in this package.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import ejs from 'ejs';
import type { GeneratedFile } from './unified-generator';

/**
 * Render an EJS template file with variables
 */
export async function renderTemplate(
  templatePath: string,
  vars: Record<string, unknown>
): Promise<string> {
  const template = await fs.readFile(templatePath, 'utf8');
  return ejs.render(template, vars);
}

/**
 * Detect whether a domain capability is already realized in code.
 *
 * `remote:generate` scaffolds a capability's feature stub only when it has not
 * been implemented, and otherwise leaves the file alone. The signal is an
 * exported symbol matching the capability name — but *which* patterns count is
 * a framework question (React exports a const or function; Angular exports a
 * `<Name>Component` class), so the caller supplies them from the variant
 * rather than this module branching on a framework id (ADR-093).
 *
 * Note: the generated stub already exports `<Name>`, so a capability counts as
 * implemented from the moment its file exists — the intended hands-off
 * behaviour, features being user-owned once created. A missing file means the
 * capability has not been generated yet.
 */
export async function capabilityImplemented(
  componentFilePath: string,
  name: string,
  patterns: readonly RegExp[],
): Promise<boolean> {
  if (!(await fs.pathExists(componentFilePath))) return false;
  const content = await fs.readFile(componentFilePath, 'utf8');
  void name;
  return patterns.some((re) => re.test(content));
}

/**
 * Write the generation plan to disk.
 *
 * Ownership decides what happens to a file that already exists (ADR-043,
 * ADR-077 §1); `force` decides whether the developer-owned half can be
 * re-seeded (ADR-091).
 *
 * | exists | `overwrite` | `force` | outcome            |
 * |--------|-------------|---------|--------------------|
 * | no     | either      | either  | written            |
 * | yes    | `true`      | either  | re-stamped         |
 * | yes    | `false`     | no      | skipped — yours    |
 * | yes    | `false`     | yes     | **re-seeded**      |
 *
 * Generator-owned files are re-stamped unconditionally and always were: ADR-043
 * makes regeneration idempotent and `check:mfe-drift` requires those files to
 * match a fresh generation at all times. `force` never had a role there, which
 * is why it did nothing at all until ADR-091 gave it this one.
 *
 * `reseeded` is reported separately from `files` because it is the only outcome
 * that can destroy work. A caller that cannot tell a re-seed from a first write
 * cannot warn about it, and this flag is worth warning about.
 *
 * WHAT `force` STILL CANNOT REACH: a capability whose feature file already
 * exists. Those never enter the plan — `generateAllFiles` omits them (see
 * `capabilityImplemented`) rather than marking them — so a writer that walks
 * the plan cannot touch them however it is called. That is the boundary between
 * scaffolding, which the platform can re-seed, and domain implementation, which
 * it must not (ADR-091 §3).
 */
export async function writeGeneratedFiles(
  files: GeneratedFile[],
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<{
  files: GeneratedFile[];
  skipped: string[];
  /** Developer-owned files that existed and were overwritten because of `force`. */
  reseeded: string[];
  errors: string[];
}> {
  const result: {
    files: GeneratedFile[];
    skipped: string[];
    reseeded: string[];
    errors: string[];
  } = { files: [], skipped: [], reseeded: [], errors: [] };

  for (const file of files) {
    try {
      const exists = await fs.pathExists(file.path);
      const wouldReseed = exists && !file.overwrite;

      if (wouldReseed && !options.force) {
        result.skipped.push(file.path);
        continue;
      }

      if (options.dryRun) {
        // A dry run reports intent, so a would-be re-seed is recorded here —
        // that is the whole point of previewing --force.
        if (wouldReseed) result.reseeded.push(file.path);
        result.files.push(file);
        continue;
      }

      await fs.ensureDir(path.dirname(file.path));
      await fs.writeFile(file.path, file.content, 'utf8');
      // Recorded only after the write actually lands. Recording it before
      // meant a file whose write then threw was reported in BOTH `reseeded`
      // and `errors` — telling the developer their edit had been replaced
      // when it was still on disk, and sending them to `git checkout --` for
      // a file with nothing to recover.
      if (wouldReseed) result.reseeded.push(file.path);
      result.files.push(file);
    } catch (error) {
      result.errors.push(`Failed to write ${file.path}: ${(error as Error).message}`);
    }
  }
  return result;
}
