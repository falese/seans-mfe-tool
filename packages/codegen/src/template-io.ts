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
 * `remote:generate` should scaffold a capability's feature stub only when it
 * has not been implemented yet, and otherwise leave the file untouched. The
 * signal is the presence of an exported symbol matching the capability name in
 * its own feature file:
 *   - React:   `export const <Name>` / `function` / `class` / `default <Name>`
 *   - Angular: `export class <Name>Component`
 *
 * Note: the generated stub already exports `<Name>`, so a capability counts as
 * "implemented" from the moment its file exists — which is the intended
 * hands-off behavior (features are user-owned once created). A missing file
 * means the capability has not been generated yet → returns false.
 */
export async function capabilityImplemented(
  componentFilePath: string,
  name: string,
  variant: 'react-rspack' | 'angular-webpack',
): Promise<boolean> {
  if (!(await fs.pathExists(componentFilePath))) return false;
  const content = await fs.readFile(componentFilePath, 'utf8');
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns =
    variant === 'angular-webpack'
      ? [new RegExp(`export\\s+(?:default\\s+)?class\\s+${esc}(?:Component)?\\b`)]
      : [
          // export const/let/var/function/class/default <Name>
          new RegExp(`export\\s+(?:default\\s+)?(?:const|let|var|function|class)\\s+${esc}\\b`),
          // export default <Name>
          new RegExp(`export\\s+default\\s+${esc}\\b`),
          // export { ... <Name> ... }
          new RegExp(`export\\s*\\{[^}]*\\b${esc}\\b[^}]*\\}`),
        ];
  return patterns.some((re) => re.test(content));
}

/**
 * Write the generation plan to disk.
 *
 * Ownership decides what happens to a file that already exists (ADR-043,
 * ADR-077 §1); `force` decides whether the developer-owned half can be
 * re-seeded (ADR-089).
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
 * is why it did nothing at all until ADR-089 gave it this one.
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
 * it must not (ADR-089 §3).
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
      if (exists && !file.overwrite) {
        if (!options.force) {
          result.skipped.push(file.path);
          continue;
        }
        result.reseeded.push(file.path);
      }
      if (options.dryRun) {
        result.files.push(file);
        continue;
      }
      await fs.ensureDir(path.dirname(file.path));
      await fs.writeFile(file.path, file.content, 'utf8');
      result.files.push(file);
    } catch (error) {
      result.errors.push(`Failed to write ${file.path}: ${(error as Error).message}`);
    }
  }
  return result;
}
