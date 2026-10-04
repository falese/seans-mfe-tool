const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// The three backend systems are proxied under /api/<system> so the browser
// only ever talks to the portal's own origin.
const HARBORMASTER = process.env.HARBORMASTER_URL || 'http://localhost:5101';
const LEDGER = process.env.LEDGER_URL || 'http://localhost:5102';
const STATION_OS = process.env.STATION_OS_URL || 'http://localhost:5103';

module.exports = (env, argv) => ({
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: '/',
    clean: true,
  },
  devtool: argv.mode === 'production' ? false : 'eval-cheap-module-source-map',
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: {
    rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.wasm$/, type: 'asset/resource' },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html' })],
  devServer: {
    port: 5090,
    historyApiFallback: true,
    proxy: [
      { context: ['/api/harbormaster'], target: HARBORMASTER, pathRewrite: { '^/api/harbormaster': '/api' } },
      { context: ['/api/ledger'], target: LEDGER, pathRewrite: { '^/api/ledger': '/api' } },
      { context: ['/api/stationos'], target: STATION_OS, pathRewrite: { '^/api/stationos': '/api' } },
    ],
  },
  performance: { hints: false },
});
