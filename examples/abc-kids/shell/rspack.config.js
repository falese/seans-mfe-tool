const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'http://localhost:3000/',
    // Content-hashed filenames make nginx's immutable-cache headers safe:
    // every build emits new names, so browsers can never serve a stale shell.
    // index.html (expires -1) picks up the new names via HtmlRspackPlugin.
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    // @seans-mfe-tool/runtime is not imported by the shell directly.
    // Each remote (flappy, hockey, multiplication-quiz) resolves it via a
    // file: dep in their own node_modules.
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
  },
  module: {
    rules: [{ test: /\.(ts|tsx)$/, use: 'builtin:swc-loader' }],
  },
  devServer: {
    port: 3000,
    historyApiFallback: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      // Daemon control-plane endpoint for the LayoutManager (ADR-055).
      // Default 3004: flappy/hockey/quiz own 3001-3003 on localhost.
      'process.env.DAEMON_WS_URL': JSON.stringify(process.env.DAEMON_WS_URL || 'ws://localhost:3004/graphql'),
    }),
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
    }),
    new ModuleFederationPlugin({
      name: 'abc_kids_shell',
      remotes: {
        abcKidsFlappy: 'abc_kids_flappy@http://localhost:3001/remoteEntry.js',
        abcKidsHockey: 'abc_kids_hockey@http://localhost:3002/remoteEntry.js',
        abcKidsMultiplicationQuiz: 'abc_kids_multiplication_quiz@http://localhost:3003/remoteEntry.js',
      },
      shared: {
        react:              { singleton: true, requiredVersion: '^18.2.0', eager: true },
        'react-dom':        { singleton: true, requiredVersion: '^18.2.0', eager: true },
        '@mui/material':    { singleton: true, requiredVersion: '^5.14.0', eager: true },
        '@emotion/react':   { singleton: true, requiredVersion: '^11.11.1', eager: true },
        '@emotion/styled':  { singleton: true, requiredVersion: '^11.11.0', eager: true },
        // Angular singletons — lazy (no eager:true) so shell bundle isn't
        // bloated for React-only sessions; Angular only loads when an
        // Angular remote is actually mounted.
        '@angular/core':              { singleton: true, requiredVersion: '^17.0.0' },
        '@angular/common':            { singleton: true, requiredVersion: '^17.0.0' },
        '@angular/platform-browser':  { singleton: true, requiredVersion: '^17.0.0' },
      },
    }),
  ],
};
