const { ModuleFederationPlugin } = require('@module-federation/enhanced-rspack');
const path = require('path');

module.exports = {
  entry: './src/remote.tsx',
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devServer: {
    port: 3100,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'control',
      filename: 'remoteEntry.js',
      exposes: {
        './Dashboard': './src/features/Dashboard/OrchestrationDashboard.tsx',
        './Telemetry': './src/features/Telemetry/TelemetryViewer.tsx',
        './DependencyGraph': './src/features/Dependencies/DependencyGraph.tsx',
        './DevTools': './src/features/DevTools/OrchestrationPlayground.tsx',
        './Runtime': './src/runtime/index.ts',
      },
      shared: {
        '@seans-mfe-tool/runtime': { singleton: true, eager: true },
        '@seans-mfe-tool/dsl': { singleton: true, eager: true },
        '@seans-mfe-tool/logger': { singleton: true, eager: true },
        'react': { singleton: true, eager: true, requiredVersion: '~18.2.0' },
        'react-dom': { singleton: true, eager: true, requiredVersion: '~18.2.0' },
        '@mui/material': { singleton: true },
        '@emotion/react': { singleton: true },
        '@emotion/styled': { singleton: true },
      },
    }),
  ],
};
