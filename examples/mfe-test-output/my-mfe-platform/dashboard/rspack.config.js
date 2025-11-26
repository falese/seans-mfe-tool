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
    fallback: {
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "url": require.resolve("url/"),
      "buffer": require.resolve("buffer/"),
      "crypto": require.resolve("crypto-browserify"),
      "fs": false,
      "os": require.resolve("os-browserify/browser"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "assert": require.resolve("assert/"),
      "process": require.resolve("process/browser"),
      "events": require.resolve("events/")
    }
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
        exclude: /node_modules\/(?!(@huggingface|other-problematic-packages)\/).*/,
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
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env': '{}',
      'process.browser': true,
      'process.version': JSON.stringify(process.version),
    }),
    new rspack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
      publicPath: '/'
    }),
    new ModuleFederationPlugin({
      name: "dashboard",
      filename: "remoteEntry.js",
      exposes: /* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:exposes */
      {
        "./App": "./src/App.jsx"
      }
      /* MFE-GENERATOR:END */,
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
          singleton: false, 
          requiredVersion: '^5.15.0',
          eager: false
        },
        '@mui/system': { 
          singleton: false, 
          requiredVersion: '^5.15.0',
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