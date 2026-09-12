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

/**
 * Where a spec's template is looked up.
 *
 * `variant` is reserved for the framework variant's own template directory and
 * is the default for a spec that names none. Any other value is a
 * `FileContributor` id, which is an open string — a plugin ships templates the
 * generator has never heard of, which is the point (ADR-092 §2). Typed as such
 * so the two literals below read as documentation rather than as a closed set
 * the generator can be trusted to enumerate.
 */
export type TemplateRootName = 'variant' | (string & {});

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
  /**
   * Template roots by name. `variant` is required; others are contributor ids.
   * Build it with {@link mergeTemplateRoots} rather than by spreading — a
   * contributor id colliding with `variant` is otherwise a silent takeover.
   */
  roots: Record<string, string> & { variant: string };
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

/**
 * Build the template-root table from the variant's directory and whatever
 * contributors registered.
 *
 * `variant` is reserved: it is the root every spec falls back to when it names
 * none, which is most of them. The table used to be assembled as
 * `{ variant: templateDir, ...contributorRoots }` keyed by contributor id —
 * and `FileContributor.id` is an open string, so a contributor registering
 * under `variant` silently replaced the variant's own directory and the whole
 * MFE rendered from that package's templates. No error, no missing file: a
 * complete MFE built from the wrong source, which is why the collision is an
 * error diagnostic rather than a warning.
 *
 * Duplicate ids get the same treatment. `fileContributors()` de-duplicates by
 * id today, so this is defence for any other caller assembling the list.
 */
export function mergeTemplateRoots(
  variantRoot: string,
  contributors: ReadonlyArray<{ id: string; templateRoot: string }>,
): { roots: ResolvePlanOptions['roots']; diagnostics: GeneratorDiagnostic[] } {
  // Null-prototype, for the same reason the Mesh alias table is: this is
  // indexed by `spec.root`, and on a plain object `roots['toString']` is the
  // inherited function — sailing past the `root === undefined` guard in
  // resolveFilePlan and surfacing as a misleading `missing-template`. Assigning
  // `roots['__proto__'] = x` on a literal also sets the prototype instead of a
  // key, so a contributor with that id got no root AND no diagnostic.
  const roots: ResolvePlanOptions['roots'] = Object.assign(Object.create(null), {
    variant: variantRoot,
  });
  const diagnostics: GeneratorDiagnostic[] = [];
  // A Set rather than an `in`/hasOwnProperty check on `roots`: the ids being
  // tested come from registered contributors, and testing membership against
  // an object would consult Object.prototype for `toString` and friends.
  const claimed = new Set<string>(['variant']);

  for (const { id, templateRoot } of contributors) {
    if (id === 'variant') {
      diagnostics.push({
        severity: 'error',
        code: 'reserved-template-root',
        target: id,
        message:
          `a file contributor registered under the reserved id "variant"; ` +
          `its templates were ignored`,
        fix: 'Give the contributor an id of its own — "variant" names the framework variant\'s own template directory.',
      });
      continue;
    }
    if (claimed.has(id)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-template-root',
        target: id,
        message: `two file contributors registered under the id "${id}"; the second was ignored`,
        fix: 'Give each contributor a unique id.',
      });
      continue;
    }
    claimed.add(id);
    roots[id] = templateRoot;
  }

  return { roots, diagnostics };
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
