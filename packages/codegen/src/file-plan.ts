/**
 * The file plan — what the generator emits, as data rather than as procedure.
 *
 * `renderFiles` used to be ~300 lines containing about 25 hand-written
 * `files.push({ path, content, overwrite })` calls. Template selection, output
 * path, ownership, conditional inclusion and framework branching were
 * interleaved at every site, each in a slightly different shape: some guarded
 * with `fs.pathExists`, some not; some warned on a missing template, some were
 * silent, some consulted a separate allow-list; three near-identical
 * `{tpl, out, overwrite}` loops used three different field names; one file was
 * emitted as a hardcoded string with no template at all.
 *
 * Every one of those is this operation:
 *
 *     if the spec applies, render its template with the model and emit it,
 *     owned by whoever the spec says owns it.
 *
 * Stating it once, and the specs as data, is what lets a framework variant be
 * a directory plus a list instead of six `if (angular)` branches in the
 * generator (ADR-036 promised this; ADR-091 delivers it), and what gives the
 * ownership split a single definition instead of 25 inline booleans that three
 * separate subsystems each had to re-infer.
 *
 * Pure with respect to the filesystem: all IO goes through the injected
 * `PlanIO`, so a plan can be resolved and asserted without a disk.
 */

/** Where a spec's template is looked up. A variant may name additional roots. */
export type TemplateRootName = 'variant' | 'bff';

/** The context a spec's predicates and var-builders see. Opaque to this module. */
export type PlanContext = unknown;

/**
 * One file the generator may emit.
 *
 * Exactly one of `template` or `content` is required: most files come from an
 * EJS template, and a couple are fixed strings that were previously inline
 * literals in the middle of the render procedure.
 */
export interface FileSpec {
  /** Template path relative to its root. Mutually exclusive with `content`. */
  template?: string;
  /** Literal file content, for files with no template. */
  content?: string;
  /** Output path relative to the MFE root. */
  out: string;
  /**
   * Who owns the emitted file. THE most consequential field in a spec:
   * `generator` becomes `overwrite: true` — re-stamped every run and held
   * byte-identical by `check:mfe-drift`; `developer` becomes `overwrite: false`
   * — seeded once and then the developer's, reachable afterwards only by an
   * explicit `--force` re-seed (ADR-089).
   */
  owner: 'generator' | 'developer';
  /** Template root to resolve `template` against. Defaults to `variant`. */
  root?: TemplateRootName;
  /** Emit only when this returns true. Absent means always. */
  when?: (ctx: PlanContext) => boolean;
  /** Extra template variables, merged over the shared model. */
  vars?: (ctx: PlanContext) => Record<string, unknown>;
  /**
   * A missing template is this variant's choice, not a defect — emitted
   * silently instead of warned about. `base-mfe-angular` ships neither
   * `demo.html` nor `favicon.ico`; warning anyway printed two lines per Angular
   * MFE on every run, in the middle of output a reader is meant to study.
   */
  optional?: boolean;
}

/** The filesystem operations a plan needs, injected so the plan stays pure. */
export interface PlanIO {
  exists(templatePath: string): Promise<boolean>;
  render(templatePath: string, vars: Record<string, unknown>): Promise<string>;
}

export interface ResolvePlanOptions {
  /** MFE root that `out` paths are relative to. */
  basePath: string;
  /** Template roots by name. `variant` is required; others are per-spec. */
  roots: Partial<Record<TemplateRootName, string>> & { variant: string };
  /** The shared render model handed to every template. */
  vars: Record<string, unknown>;
  /** Passed to each spec's `when` and `vars`. */
  ctx: PlanContext;
  io: PlanIO;
}

/** A file the plan produced. Mirrors `GeneratedFile` in unified-generator. */
export interface PlannedFile {
  path: string;
  content: string;
  overwrite: boolean;
}

/**
 * Something the generator has to say, returned instead of printed (ADR-092).
 *
 * Deliberately the same shape wherever it comes from — the file plan, manifest
 * validation, a variant's missing slot template — so a caller renders one list
 * rather than learning three reporting conventions. `severity` decides whether
 * it blocks; `fix` is filled in by whoever can say what to do about it.
 */
export interface GeneratorDiagnostic {
  severity: 'warning' | 'error';
  /** Stable, greppable kind — e.g. `missing-template`, `mesh-unknown`. */
  code: string;
  message: string;
  /** What the diagnostic is about: an output path, a manifest field, a name. */
  target?: string;
  /** What to do about it, when that can be said concretely. */
  fix?: string;
}

/** @deprecated Use {@link GeneratorDiagnostic}. */
export type PlanDiagnostic = GeneratorDiagnostic;

export interface ResolvedPlan {
  files: PlannedFile[];
  diagnostics: GeneratorDiagnostic[];
}

/** Join without importing `path`, so this module stays trivially portable. */
function joinPath(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

/**
 * Turn a plan into concrete files.
 *
 * Emits a diagnostic rather than throwing when a required template is absent:
 * the generator's job is to report what it could not do and produce everything
 * else, not to abandon 20 correct files because the 21st has no template.
 */
export async function resolveFilePlan(
  plan: readonly FileSpec[],
  options: ResolvePlanOptions,
): Promise<ResolvedPlan> {
  const { basePath, roots, vars, ctx, io } = options;
  const files: PlannedFile[] = [];
  const diagnostics: GeneratorDiagnostic[] = [];

  for (const spec of plan) {
    if (spec.when && !spec.when(ctx)) continue;

    const overwrite = spec.owner === 'generator';
    const outPath = joinPath(basePath, spec.out);

    if (spec.content !== undefined) {
      files.push({ path: outPath, content: spec.content, overwrite });
      continue;
    }

    if (!spec.template) {
      diagnostics.push({
        severity: 'error',
        code: 'invalid-spec',
        target: spec.out,
        message: `file plan entry for "${spec.out}" has neither a template nor content`,
      });
      continue;
    }

    const root = roots[spec.root ?? 'variant'];
    if (root === undefined) {
      diagnostics.push({
        severity: 'error',
        code: 'unknown-template-root',
        target: spec.out,
        message: `file plan entry for "${spec.out}" names template root "${spec.root}", which is not configured`,
      });
      continue;
    }

    const templatePath = joinPath(root, spec.template);
    if (!(await io.exists(templatePath))) {
      if (!spec.optional) {
        diagnostics.push({
          severity: 'warning',
          code: 'missing-template',
          target: spec.out,
          message: `missing template for ${spec.out}: ${templatePath}`,
        });
      }
      continue;
    }

    files.push({
      path: outPath,
      content: await io.render(templatePath, { ...vars, ...spec.vars?.(ctx) }),
      overwrite,
    });
  }

  return { files, diagnostics };
}

/**
 * The ownership map, read straight off the plan.
 *
 * Three subsystems need this split and each used to derive it independently:
 * `check:mfe-drift` (compares only generator-owned files), `mfe:validate`'s
 * `developerOwned` predicate (scans only the other half for platform
 * migrations), and the dry-run planner. Ownership was 25 inline booleans, so
 * moving a file between the two was invisible in review — which is the risk
 * ADR-082 exists to mitigate. Here it is one column.
 */
export function ownershipOf(plan: readonly FileSpec[]): Record<string, FileSpec['owner']> {
  const map: Record<string, FileSpec['owner']> = {};
  for (const spec of plan) map[spec.out] = spec.owner;
  return map;
}
