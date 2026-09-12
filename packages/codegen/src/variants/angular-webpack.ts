/**
 * Angular + webpack (ADR-091).
 *
 * Everything here was previously the `if (templateVariant ===
 * 'angular-webpack')` half of six branches inside `renderFiles`.
 */

import type { CodegenVariant } from './types';
import { escapeCapabilityName } from './shared';

export const angularWebpack: CodegenVariant = {
  id: 'angular-webpack',
  framework: 'angular',
  bundler: 'webpack',
  templateDirName: 'base-mfe-angular',
  // Angular's tsconfig carries experimentalDecorators and
  // angularCompilerOptions; the BFF's generic one would clobber them.
  ownsRootTsconfig: true,

  featureFiles: (name) => ({
    component: `${name}.component.ts`,
    componentTemplate: 'feature.component.ts.ejs',
    spec: `${name}.component.spec.ts`,
    specTemplate: 'feature.component.spec.ts.ejs',
  }),

  implementedPatterns: (name) => [
    new RegExp(`export\\s+(?:default\\s+)?class\\s+${escapeCapabilityName(name)}(?:Component)?\\b`),
  ],

  remoteEntry: { template: 'features/remote.ts.ejs', out: 'src/remote.ts' },
  slots: { template: 'slots.ts.ejs', out: 'src/slots.ts' },

  specs: [
    { template: 'package.json.ejs', out: 'package.json', owner: 'developer' },
    { template: 'angular.json.ejs', out: 'angular.json', owner: 'developer' },
    { template: 'webpack.config.js.ejs', out: 'webpack.config.js', owner: 'developer' },
    { template: 'tsconfig.json.ejs', out: 'tsconfig.json', owner: 'developer' },
    { template: 'tsconfig.app.json.ejs', out: 'tsconfig.app.json', owner: 'developer' },
    { template: 'tsconfig.spec.json.ejs', out: 'tsconfig.spec.json', owner: 'developer' },
    { template: 'jest.config.js.ejs', out: 'jest.config.js', owner: 'developer' },
    { template: 'setup.jest.ts.ejs', out: 'setup.jest.ts', owner: 'developer' },

    // Platform-produced artifact lists — see the note in react-rspack.
    { template: '.gitignore.ejs', out: '.gitignore', owner: 'generator' },
    { template: '.dockerignore.ejs', out: '.dockerignore', owner: 'generator' },

    // Entry files.
    { template: 'src/main.ts.ejs', out: 'src/main.ts', owner: 'developer' },
    { template: 'src/bootstrap.ts.ejs', out: 'src/bootstrap.ts', owner: 'developer' },
    {
      template: 'src/app/app.component.ts.ejs',
      out: 'src/app/app.component.ts',
      owner: 'developer',
    },
  ],
};
