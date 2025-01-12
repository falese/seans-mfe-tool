const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: './src/bootstrap.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.jsx', '.js', '.json'],
  },
  devServer: {
    port: 3001,
    host: '0.0.0.0',
    hot: true,
    historyApiFallback: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
    }
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'ecmascript',
                jsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        },
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
      publicPath: '/'
    }),
    new ModuleFederationPlugin({
      name: 'editor',
      filename: 'remoteEntry.js',
      exposes: {
        './EditorPanel': './src/EditorPanel.jsx',
        './EditorService': './src/services/EditorService.js'
      },
      shared: {
        react: { 
          singleton: true, 
          requiredVersion: '^18.2.0',
          eager: true
        },
        'react-dom': { 
          singleton: true, 
          requiredVersion: '^18.2.0',
          eager: true
        },
        '@monaco-editor/react': {
          singleton: true,
          requiredVersion: deps['@monaco-editor/react']
        },
        '@mui/material': { 
          singleton: false, 
          requiredVersion: '5.15.0',
          eager: false
        },
        '@mui/system': { 
          singleton: false, 
          requiredVersion: '5.15.0',
          eager: false
        },
        '@emotion/react': { 
          singleton: true, 
          requiredVersion: '^11.11.1',
          eager: false
        },
        '@emotion/styled': { 
          singleton: true, 
          requiredVersion: '^11.11.0',
          eager: false
        }
      },
    }),
  ]
};