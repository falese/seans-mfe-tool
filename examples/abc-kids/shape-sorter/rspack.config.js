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
    // Content-hashed filenames let the immutable-cache headers in the nginx
    // config be safe: a new build emits new filenames, so clients never serve
    // a stale bundle. remoteEntry.js is exempt (fixed name, served no-cache).
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    // @seans-mfe-tool/runtime is resolved as a workspace dependency via the
    // monorepo's npm workspaces (declared at the repo root). rspack walks up
    // node_modules and picks it up via the symlink created on `npm install`.
    // node_modules order: app-local first, then upward (workspace root).
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
  },
  devServer: {
    port: 3007,
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
      name: 'abc_kids_shape_sorter',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/remote.tsx',
      },
      // NOTE on `eager: true`: shared singletons are bundled eagerly so this MFE
      // also runs standalone (its own index.tsx entry) without a host providing
      // them. The tradeoff is a larger remote bundle. In a shell-only deployment
      // where the host owns these singletons, set `eager: false` here and ensure
      // the shell provides them eagerly. See ADR-044.
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