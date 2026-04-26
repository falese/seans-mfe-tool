const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      // 3 levels deep: examples/abc-kids/flappy/ → repo root
      '@seans-mfe-tool/runtime': path.resolve(__dirname, '../../../src/runtime/index.ts'),
    },
  },
  devServer: {
    port: 3001,
    host: '0.0.0.0',
    hot: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
  module: {
    rules: [
      {
        test: /\.(jsx?|tsx?)$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript', jsx: true },
              transform: { react: { runtime: 'automatic' } },
            },
          },
        },
      },
    ],
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
    }),
    new ModuleFederationPlugin({
      name: 'abc_kids_flappy',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/remote.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.2.0', eager: true },
        'react-dom': { singleton: true, requiredVersion: '^18.2.0', eager: true },
        '@mui/material': { singleton: true, requiredVersion: '^5.14.0', eager: false },
        '@mui/system': { singleton: true, requiredVersion: '^5.14.0', eager: false },
        '@emotion/react': { singleton: true, requiredVersion: '^11.11.1', eager: false },
        '@emotion/styled': { singleton: true, requiredVersion: '^11.11.0', eager: false },
      },
    }),
  ],
};
