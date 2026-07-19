// Module Federation partial — merged into the Angular CLI's webpack config by
// @angular-builders/custom-webpack. withModuleFederationPlugin resolves
// ModuleFederationPlugin from Angular's own bundled webpack, preventing the
// "Cannot read properties of undefined (reading 'tap')" crash that occurs
// when a separately-installed webpack creates a second compiler instance.
const { withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack');

// Force classic-script output so the Angular webpack MF container is loadable
// by any host that injects remoteEntry.js as a classic <script> tag (including
// rspack's enhanced MF runtime). Two changes are required:
//
// 1. `library: { type: 'var' }` passed INTO withModuleFederationPlugin — the
//    plugin explicitly uses this before experiments.outputModule overrides it,
//    preventing `export { init, get }` (ES module exports only valid in
//    <script type="module">) and instead assigns window[name] = { init, get }.
//
// 2. `output.scriptType: 'text/javascript'` — prevents webpack from emitting
//    `import.meta.url` detection code, which is a SyntaxError in a classic-
//    script context and causes RUNTIME-008 in the shell.
const mfConfig = withModuleFederationPlugin({
  name: 'meridian_docking_control',
  filename: 'remoteEntry.js',
  library: { type: 'var', name: 'meridian_docking_control' },
  exposes: {
    './App': './src/remote.ts',
  },
  shared: {
    '@angular/core': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^19.2.16',
    },
    '@angular/common': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^19.2.16',
    },
    '@angular/platform-browser': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^19.2.16',
    },
    rxjs: {
      singleton: true,
      requiredVersion: '^7.8.0',
    },
  },
});

// The BFF endpoint needs no build-time wiring: the MFE and its BFF are one
// deployable unit, so codegen bakes manifest.endpoint + data.serve.endpoint
// into the generated connector (src/platform/bff/bff.ts).
module.exports = {
  ...mfConfig,
  output: {
    ...mfConfig.output,
    scriptType: 'text/javascript',
  },
};
