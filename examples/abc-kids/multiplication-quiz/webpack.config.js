// Module Federation config for Angular 17 MFE.
// Uses @angular-architects/module-federation so withModuleFederationPlugin
// resolves ModuleFederationPlugin from Angular's bundled webpack — avoiding
// the "Cannot read properties of undefined (reading 'tap')" crash that occurs
// when a separate webpack devDependency creates a second webpack instance.
const { withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack');

module.exports = withModuleFederationPlugin({
  name: 'abc_kids_multiplication_quiz',
  filename: 'remoteEntry.js',
  exposes: {
    './Component': './src/remote.ts',
  },
  shared: {
    '@angular/core': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^17.0.0',
    },
    '@angular/common': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^17.0.0',
    },
    '@angular/platform-browser': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^17.0.0',
    },
    rxjs: {
      singleton: true,
      requiredVersion: '^7.8.0',
    },
  },
});

