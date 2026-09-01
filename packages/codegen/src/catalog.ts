/**
 * Codegen catalog — the constant data the generator renders from.
 *
 * This is data, not logic: pinned dependency versions (ADR-050), the Mesh
 * plugin/transform defaults and allow-lists (ADR-027), and the set of public
 * assets a template variant may legitimately omit (#341).
 *
 * It lived in unified-generator.ts, where 257 lines of version strings and
 * plugin tables sat between the validation functions and the render pipeline —
 * a sixth of a 1,597-line file, and the part a reader scrolls past to reach
 * anything that executes. Splitting it out is what lets the generator file be
 * about generating.
 *
 * ADR-050 is the rule these tables serve: every version string in a generated
 * package.json comes from DEPENDENCY_VERSIONS, and no template hardcodes one.
 */

/**
 * Public assets a template variant may legitimately not ship (#341).
 *
 * Absence is a variant's choice, not a defect, so it is emitted silently rather
 * than warned about. `base-mfe-angular` ships neither: an Angular MFE is served
 * through the Angular builder and has no standalone demo page. Warning anyway
 * printed two lines per Angular MFE on every run — eight across the fleet,
 * landing in the middle of `check:mfe-drift` output a reader is meant to be
 * studying carefully.
 *
 * The set is deliberately short. Everything not in it — `index.html`,
 * `App.tsx`, `index.tsx`, `mfe.ts` — still warns when its template is missing,
 * because there the absence really is a broken variant. Silencing the
 * diagnostic wholesale would trade a noisy gate for a silent one.
 *
 * Follows the same rule as slot emission below, which probes the variant's
 * `templateDir` for a `slots.*.ejs` instead of hardcoding framework names, so
 * a new framework adds support by shipping a template (ADR-036).
 */
export const OPTIONAL_PUBLIC_ASSETS: readonly string[] = ['demo.html', 'favicon.ico'];

/**
 * Centralized dependency versions for template generation
 * Following e2e2 dependency resolution (2025-12-06)
 * Based on GraphQL Mesh v0.100.x stable releases
 */
export const DEPENDENCY_VERSIONS = {
  // GraphQL Mesh (BFF Layer)
  graphqlMesh: {
    cli: '^0.100.21',
    openapi: '^0.109.26',
    serveRuntime: '^1.2.4',
  },

  // GraphQL Tools (Peer Dependencies)
  graphqlTools: {
    delegate: '^10.2.4',
    utils: '^9.2.1',
    wrap: '^10.0.5',
  },

  // Mesh Plugins (Production Features)
  meshPlugins: {
    responseCache: '^0.104.20',
    prometheus: '^2.1.8',
    opentelemetry: '^1.3.67',
  },

  // Mesh Transforms (Schema Manipulation)
  // NOTE: these track the Mesh v0.10x line — NOT ^1.0.0. A legacy 1.0.0 is
  // published for several of these but predates and is incompatible with
  // @graphql-mesh/cli@0.100.x (verified in the demo-mode trial, ADR-052).
  meshTransforms: {
    namingConvention: '^0.105.19',
    rateLimit: '^0.105.38',
    filterSchema: '^0.104.37',
    resolversComposition: '^0.104.36',
    cache: '^0.105.37',
  },

  // Core Dependencies
  core: {
    graphql: '^16.8.1',
    express: '^4.18.2',
    cors: '^2.8.5',
    helmet: '^8.1.0',
    tslib: '^2.6.0',
  },

  // React (Module Federation - Singleton)
  react: {
    react: '~18.2.0',
    reactDom: '~18.2.0',
  },

  // Platform runtime contract (@seans-mfe-tool/runtime).
  // Not published to npm yet (ADR-064); generated projects stage dist/runtime
  // (Dockerfile copies it as a real directory, #274). Single-sourced here so
  // the React and Angular templates can't drift on the declared spec.
  runtime: {
    package: '^0.1.0',
  },

  // MUI (Design System)
  mui: {
    material: '^5.14.0',
    system: '^5.14.0',
    emotionReact: '^11.11.1',
    emotionStyled: '^11.11.0',
  },

  // Build Tools
  buildTools: {
    rspackCli: '^1.7.0',
    rspackCore: '^1.7.0',
    typescript: '^5.3.3',
    tsNode: '^10.9.1',
    concurrently: '^8.2.0',
    serve: '^14.2.1',
    tsJest: '^29.2.0',
    jestEnvJsdom: '^29.7.0',
    typesJest: '^29.5.0',
    jest: '^29.7.0',
    eslint: '^8.55.0',
    supertest: '^6.3.3',
  },

  // Type definitions (shared across React and Angular templates)
  types: {
    cors: '^2.8.17',
    express: '^4.17.21',
    node: '^20.10.0',
    react: '^18.0.28',
    reactDom: '^18.0.11',
  },

  // React Testing Library
  testingLibrary: {
    react: '^14.0.0',
    jestDom: '^6.4.0',
    userEvent: '^14.5.0',
  },

  // Angular 19+ (Module Federation - Singleton + strictVersion)
  // Upgraded from ^17.0.0 to ^19.2.16 to resolve five HIGH severity XSS CVEs:
  //   GHSA-58c5-g7wp-6w37, GHSA-v4hv-rgfq-gp49, GHSA-g93w-mfhg-p222,
  //   GHSA-prjf-86w9-mfqv (all @angular/common, fixed in 19.2.16+)
  //   GHSA-jrmj-c5cx-3cw6 (@angular/core + @angular/compiler, fixed in 18.2.15+)
  // See ADR-051.
  angular: {
    core: '^19.2.16',
    common: '^19.2.16',
    compiler: '^19.2.16',
    compilerCli: '^19.2.16',
    platformBrowser: '^19.2.16',
    forms: '^19.2.16',
    rxjs: '^7.8.0',
    // ADR-051 recorded this as "~0.14.0 — unchanged, compatible with Angular
    // 19", but @angular/core@19.2.16's own peerDependencies require
    // zone.js@~0.15.0 (verified via `npm view @angular/core@19.2.16
    // peerDependencies`) — the claim was wrong from the start, and every
    // fresh Angular MFE install failed with ERESOLVE until this was caught by
    // the #281 fresh-scaffold typecheck gate, which actually runs `npm
    // install`. See `scripts/check-template-typecheck.ts`.
    zoneJs: '~0.15.0',
  },

  // Angular CLI builder toolchain (angular-webpack variant).
  // Versions track Angular major: @angular-builders/custom-webpack@19.0.1 and
  // @angular-architects/module-federation@19.0.3 for Angular 19 compatibility.
  // TypeScript bumped from ~5.2.0 to ~5.7.0 — Angular 19 requires >=5.5 <5.9.
  angularBuild: {
    cli: '^19.2.16',
    buildAngular: '^19.2.16',
    customWebpack: '^19.0.1',
    moduleFederation: '^19.0.3',
    typescript: '~5.7.0',
  },

  // Jest preset (standalone webpack removed — use Angular's bundled copy).
  webpackTools: {
    jestPresetAngular: '^14.0.0',
    typesJest: '^29.5.0',
  },

  // npm overrides — force safe versions of packages with known vulnerabilities.
  // Applied selectively: BFF projects get fast-uri; non-BFF projects get uuid.
  //
  // fast-uri: GHSA-q3j6-qgpj-74h6 + GHSA-v39h-62p7-jpjc (high, BFF chain)
  //   graphql-jit → fast-json-stringify → fast-uri@^2; both fjs@5 and @6 pin ^2.
  //
  // uuid: GHSA-w5hq-g745-h8pq (moderate, dev-only React chain)
  //   @rspack/cli → @rspack/dev-server → webpack-dev-server → sockjs → uuid@<11.1.1
  // npm overrides — force safe versions of transitively-pulled packages with
  // known CVEs. These are deliberate and minimal; `npm audit fix --force` is
  // prohibited (it downgrades and introduces its own regression surface).
  overrides: {
    // fast-uri: GHSA-q3j6-qgpj-74h6 + GHSA-v39h-62p7-jpjc (high) — BFF Mesh chain.
    fastUri: '^3.1.2',
    // uuid: GHSA-w5hq-g745-h8pq (moderate) — rspack/webpack-dev-server → sockjs → uuid.
    uuid: '^11.1.1',
    // tar: node-tar CVEs (GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-qj8w-gfj5-8c6v)
    // — @angular/cli → node-gyp → tar in the Angular build toolchain.
    tar: '^7.5.11',
    // serialize-javascript: GHSA-5c6j-r48x-rmvq (high RCE) + GHSA-qj8w-gfj5-8c6v (DoS)
    // — terser-webpack-plugin → serialize-javascript in the Angular build toolchain.
    serializeJavascript: '^7.0.5',
    // webpack-dev-server: GHSA-79cf-xcqc-c78w (moderate, cross-origin source exposure)
    // — Angular dev-server uses wds 5.x; 5.2.4 is the patched release.
    webpackDevServer: '^5.2.4',
  },
};

/**
 * Plugin configuration defaults
 */
export const DEFAULT_MESH_PLUGINS = {
  // Always include (performance critical)
  responseCache: {
    ttl: 300000, // 5 minutes
  },

  // Production observability (standard tier)
  prometheus: {},

  // Optional (advanced tier)
  opentelemetry: {
    enabled: false,
    sampling: { probability: 0.1 },
  },
};

/**
 * Transform configuration defaults
 */
export const DEFAULT_MESH_TRANSFORMS = {
  // Always include (API consistency)
  namingConvention: {
    typeNames: 'pascalCase',
    fieldNames: 'camelCase',
  },

  // Optional (advanced tier)
  rateLimit: {
    enabled: false,
  },

  filterSchema: {
    enabled: false,
  },
};

// =============================================================================
// Validation Layer (ADR-027)
// =============================================================================

/**
 * NOTE: These validation constants are duplicated in src/utils/manifestValidator.js
 * for CLI pre-generation checks. Keep both in sync until TypeScript migration completes.
 * See ADR-014 for migration strategy.
 */

/**
 * Known GraphQL Mesh plugins (production-ready)
 * Source: @graphql-mesh/plugin-* packages
 * Used to validate manifest plugin configurations and prevent misclassification
 */
export const KNOWN_MESH_PLUGINS = new Set([
  'responseCache',
  'prometheus',
  'opentelemetry',
  'newrelic',
  'statsd',
  'liveQuery',
  'defer-stream',
  'meshHttp',
  'snapshot',
  'mock',
  'operationFieldPermissions',
  'jwtAuth',
  'hmac',
]);

/**
 * Known GraphQL Mesh transforms
 * Source: @graphql-mesh/transform-* packages
 * Used to validate manifest transform configurations and prevent misclassification
 */
export const KNOWN_MESH_TRANSFORMS = new Set([
  'namingConvention',
  'rateLimit',
  'filterSchema',
  'resolversComposition',
  'cache',
  'prefix',
  'rename',
  'encapsulate',
  'federation',
  'extend',
  'replace',
  'typeMerging',
  'mock',
  'bare',
  'type-merging',
]);

