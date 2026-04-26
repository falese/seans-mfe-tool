const path = require('path');
const { ModuleFederationPlugin } = require('@module-federation/enhanced-rspack');

module.exports = {
  entry: './src/index.tsx',
  output: { path: path.resolve(__dirname, 'dist'), publicPath: 'http://localhost:3000/' },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      '@seans-mfe-tool/runtime': path.resolve(__dirname, '../../../src/runtime/index.ts'),
    },
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
    new ModuleFederationPlugin({
      name: 'abc_kids_shell',
      remotes: {
        abcKidsFlappy: 'abc_kids_flappy@http://localhost:3001/remoteEntry.js',
        abcKidsHockey: 'abc_kids_hockey@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        react:              { singleton: true, requiredVersion: '^18.2.0', eager: true },
        'react-dom':        { singleton: true, requiredVersion: '^18.2.0', eager: true },
        '@mui/material':    { singleton: true, requiredVersion: '^5.14.0', eager: true },
        '@emotion/react':   { singleton: true, requiredVersion: '^11.11.1', eager: true },
        '@emotion/styled':  { singleton: true, requiredVersion: '^11.11.0', eager: true },
      },
    }),
  ],
};
