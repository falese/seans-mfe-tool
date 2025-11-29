const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const { defineConfig } = require('@rspack/cli');
const { HtmlRspackPlugin } = require('@rspack/core');
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

const isDev = process.env.NODE_ENV === 'development';

module.exports = defineConfig({
  entry: './src/index.tsx',
  mode: isDev ? 'development' : 'production',
  devtool: isDev ? 'eval-source-map' : 'source-map',
  
  devServer: {
    port: 3002,
    hot: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
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
                  development: isDev,
                  refresh: isDev,
                },
              },
            },
          },
        },
      },
      {
        test: /\.css$/,
        type: 'css',
      },
    ],
  },

  plugins: [
    new HtmlRspackPlugin({
      template: './public/index.html',
    }),
    isDev && new ReactRefreshPlugin(),
    new ModuleFederationPlugin({
      name: 'csv_analyzer',
      filename: 'remoteEntry.js',
      exposes: {
      './App': './src/App',
      './DataAnalysis': './src/features/DataAnalysis',
      './ReportViewer': './src/features/ReportViewer',
      './DataAnalysisDetailed': './src/features/DataAnalysisDetailed'
},
      shared: {
      'react': {
            'singleton': true,
            'requiredVersion': '^18.0.0'
      },
      'react-dom': {
            'singleton': true,
            'requiredVersion': '^18.0.0'
      },
      '@mui/material': {
            'singleton': true,
            'requiredVersion': '^5.14.0'
      },
      '@emotion/react': {
            'singleton': true,
            'requiredVersion': '^11.11.0'
      },
      '@emotion/styled': {
            'singleton': true,
            'requiredVersion': '^11.11.0'
      }
},
    }),
  ].filter(Boolean),
});
