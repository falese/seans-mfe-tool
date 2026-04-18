const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: {
    main: './src/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      // Resolve the platform runtime from its source during development.
      // In production, publish @seans-mfe-tool/runtime to npm and remove this alias.
      '@seans-mfe-tool/runtime': path.resolve(__dirname, '../../src/runtime/index.ts'),
    },
  },
  devServer: {
    port: 3001,
    host: '0.0.0.0',
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath: '/static',
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
    }
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
              parser: {
                syntax: 'typescript',
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
      {
        test: /\.css$/,
        use: [
          {
            loader: 'builtin:lightningcss-loader',
            options: {
              targets: 'defaults'
            }
          }
        ],
        type: 'css'
      }
    ],
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
      publicPath: '/'
    }),
    new ModuleFederationPlugin({
      name: 'new_mfe',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/remote.tsx',
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
        '@mui/material': { 
          singleton: true, 
          requiredVersion: '^5.14.0',
          eager: true
        },
        '@mui/system': { 
          singleton: true, 
          requiredVersion: '^5.14.0',
          eager: true
        },
        '@emotion/react': { 
          singleton: true, 
          requiredVersion: '^11.11.1',
          eager: true
        },
        '@emotion/styled': { 
          singleton: true, 
          requiredVersion: '^11.11.0',
          eager: true
        }
      },
    }),
  ]
};