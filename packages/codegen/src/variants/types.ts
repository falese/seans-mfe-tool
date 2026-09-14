/**
 * What a codegen variant is (ADR-093).
 *
 * ADR-036 said framework support should be a template variant, not a branch,
 * and `unified-generator.ts`'s own header asserted that *"framework differences
 * are template-variant data, never branches in this file"*. They were branches:
 * six comparisons against the string literal `'angular-webpack'` decided the
 * template directory, the feature filenames, the remote-entry filename, the
 * root-template list, the entry-file list, and whether the BFF tsconfig was
 * emitted. Adding a third framework meant editing the generator in six places
 * and widening a union.
 *
 * A variant is now this interface: a template directory, a few naming
 * decisions, and a list of `FileSpec`s. The generator reads it and contains no
 * framework name at all.
 *
 * NOTE THE SHAPE OF THE PREDICATES. Shared specs ask the variant declarative
 * questions (`ownsRootTsconfig`) rather than comparing its id. An id comparison
 * in a shared list is the same defect in a new location — it just moves the
 * branch from the generator into the plan.
 */

import type { FileSpec } from '../file-plan';
import type { DSLManifest } from '@seans-mfe/dsl';
import type { RenderHandlerSource } from '../render-model';

/** What a spec's `when` and `vars` receive. */
export interface GenPlanContext {
  manifest: DSLManifest;
  /** The shared render model (template vars). */
  vars: Record<string, unknown>;
  variant: CodegenVariant;
  /** Domain capability names, in manifest order. */
  domainCapabilities: string[];
  /** Manifest-declared handler imports (ADR-040). */
  handlerSources: RenderHandlerSource[];
  /** True when the manifest declares a `data:` section. */
  hasBff: boolean;
}

/** The files one domain capability contributes. */
export interface FeatureFileNames {
  /** e.g. `Flappy.tsx` or `Flappy.component.ts`. */
  component: string;
  componentTemplate: string;
  /** e.g. `Flappy.test.tsx` or `Flappy.component.spec.ts`. */
  spec: string;
  specTemplate: string;
}

export interface CodegenVariant {
  /** Stable id, also the `templateVariant` value in the render model. */
  id: string;
  framework: string;
  bundler: string;
  /**
   * Directory under `packages/codegen/templates/`, or an absolute path — the
   * generator resolves it with `path.resolve`, so a variant shipped by a
   * plugin points at its own package's templates without the generator
   * knowing where that is.
   */
  templateDirName: string;

  /**
   * This variant emits its own root `tsconfig.json`, so shared plans must not.
   * Asked as a question rather than inferred from the id: the Angular variant
   * ships a tsconfig with `experimentalDecorators` and `angularCompilerOptions`
   * that the BFF's generic one would clobber.
   */
  ownsRootTsconfig: boolean;

  /** Per-capability filenames and their templates, under `features/`. */
  featureFiles(capability: string): FeatureFileNames;

  /**
   * Patterns meaning "this capability is already implemented in this file".
   * A framework question — React exports a const/function/class of that name,
   * Angular a `<Name>Component` class — so the variant answers it instead of
   * the generator branching on an id.
   */
  implementedPatterns(capability: string): RegExp[];

  /** The barrel re-exporting every domain capability. */
  remoteEntry: { template: string; out: string };

  /**
   * Slot sugar this variant ships, if any (ADR-067). React ships a
   * `DeclaredSlot` component, Angular a directive; a variant with no slot
   * support omits this and a manifest declaring `providesSlots` gets a
   * diagnostic rather than a silently missing file.
   */
  slots?: { template: string; out: string };

  /** Root and entry files. Everything not per-capability and not shared. */
  specs: FileSpec[];
}
