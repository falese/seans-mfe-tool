/**
 * React + rspack — the default variant (ADR-093).
 *
 * Everything here was previously the `else` half of six `templateVariant ===
 * 'angular-webpack'` comparisons inside `renderFiles`.
 */

import type { CodegenVariant, GenPlanContext } from './types';
import { escapeCapabilityName } from './shared';

/**
 * Capability metadata for the standalone dev entry. `displayName` and `icon`
 * are not part of `CapabilityConfigSchema`, so this reads through an
 * unknown-narrowed view rather than asserting a shape the schema does not
 * declare; both fall through to the defaults in practice.
 */
function capabilityMetadata(ctx: GenPlanContext): Record<string, unknown> {
  return {
    capabilities: ctx.domainCapabilities.map((name) => {
      const entry = ctx.manifest.capabilities.find((c) => Object.keys(c).includes(name));
      const config = entry?.[name] as unknown as Record<string, unknown> | undefined;
      return {
        className: name,
        displayName: (config?.displayName as string | undefined) || name,
        icon: (config?.icon as string | undefined) || '📦',
      };
    }),
  };
}

export const reactRspack: CodegenVariant = {
  id: 'react-rspack',
  framework: 'react',
  bundler: 'rspack',
  templateDirName: 'base-mfe',
  // The BFF's generic tsconfig serves React fine, so this variant emits its
  // own only when there is no BFF to provide one.
  ownsRootTsconfig: false,

  featureFiles: (name) => ({
    component: `${name}.tsx`,
    componentTemplate: 'feature.tsx.ejs',
    spec: `${name}.test.tsx`,
    specTemplate: 'feature.test.tsx.ejs',
  }),

  implementedPatterns: (name) => {
    const n = escapeCapabilityName(name);
    return [
      new RegExp(`export\\s+(?:default\\s+)?(?:const|let|var|function|class)\\s+${n}\\b`),
      new RegExp(`export\\s+default\\s+${n}\\b`),
      new RegExp(`export\\s*\\{[^}]*\\b${n}\\b[^}]*\\}`),
    ];
  },

  remoteEntry: { template: 'features/remote.tsx.ejs', out: 'src/remote.tsx' },
  slots: { template: 'slots.tsx.ejs', out: 'src/slots.tsx' },

  specs: [
    // Root config. Developer-owned by default: an MFE author edits
    // package.json, the bundler config and the tsconfig as a matter of course.
    { template: 'package.json.ejs', out: 'package.json', owner: 'developer' },
    { template: 'rspack.config.js.ejs', out: 'rspack.config.js', owner: 'developer' },
    {
      template: 'tsconfig.json.ejs',
      out: 'tsconfig.json',
      owner: 'developer',
      when: (c) => !(c as GenPlanContext).hasBff,
    },

    // The two ignore files are the exception (#341): every line of them names
    // a build artifact the PLATFORM produces (.mesh/, dist/, out-tsc/, the
    // compiled server.js), so the platform is the thing that knows when that
    // list changes. Owning them also brings them under check:mfe-drift.
    { template: '.gitignore.ejs', out: '.gitignore', owner: 'generator' },
    { template: '.dockerignore.ejs', out: '.dockerignore', owner: 'generator' },

    // Entry files — the standalone dev shell, user-owned once seeded.
    { template: 'App.tsx.ejs', out: 'src/App.tsx', owner: 'developer' },
    {
      template: 'index.tsx.ejs',
      out: 'src/index.tsx',
      owner: 'developer',
      vars: (c) => capabilityMetadata(c as GenPlanContext),
    },
  ],
};
