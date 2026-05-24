// Module Federation partial — merged into the Angular CLI's webpack config by
// @angular-builders/custom-webpack. withModuleFederationPlugin resolves
// ModuleFederationPlugin from Angular's own bundled webpack, preventing the
// "Cannot read properties of undefined (reading 'tap')" crash that occurs
// when a separately-installed webpack creates a second compiler instance.
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
