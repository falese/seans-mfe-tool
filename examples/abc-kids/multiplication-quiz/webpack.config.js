// Module Federation partial — merged into the Angular CLI's webpack config by
// @angular-builders/custom-webpack. The Angular toolchain owns AOT, the dev
// server, and asset handling; this file only layers native Module Federation
// (no @angular-architects wrapper).
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  output: {
    uniqueName: 'abc_kids_multiplication_quiz',
    publicPath: 'auto',
  },
  // Module Federation cannot run with a separate runtime chunk.
  optimization: {
    runtimeChunk: false,
  },
  experiments: {
    topLevelAwait: true,
  },
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
  plugins: [
    new ModuleFederationPlugin({
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
    }),
  ],
};
