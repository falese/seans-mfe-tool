const path = require('path');
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

class ModuleFederationPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    compiler.options.plugins = compiler.options.plugins || [];
    compiler.options.federation = this.options;
  }
}

async function createConfiguration(options) {
  const { context, type, mode, analyze } = options;

  const plugins = mode === 'development' ? [new ReactRefreshPlugin()] : [];

  // Add Module Federation configuration
  if (type === 'shell' || type === 'remote') {
    const federationConfig = getFederationConfig(type, options);
    plugins.push(new ModuleFederationPlugin(federationConfig));
  }

  const baseConfig = {
    context,
    mode,
    target: ['web', 'es2020'],
    entry: getEntry(type),
    output: {
      path: path.join(context, 'dist'),
      publicPath: 'auto',
      clean: true,
      filename: mode === 'development' ? '[name].js' : '[name].[contenthash].js',
      chunkFilename: mode === 'development' ? '[name].js' : '[name].[contenthash].js'
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          use: {
            loader: 'builtin:swc-loader',
            options: {
              sourceMap: true,
              jsc: {
                parser: {
                  syntax: 'ecmascript',
                  jsx: true
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: mode === 'development',
                    refresh: mode === 'development'
                  }
                }
              }
            }
          }
        },
        {
          test: /\.css$/,
          type: 'css'
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource'
        }
      ]
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json']
    },
    plugins,
    optimization: {
      moduleIds: mode === 'production' ? 'deterministic' : 'named',
      chunkIds: mode === 'production' ? 'deterministic' : 'named',
      splitChunks: {
        chunks: 'all'
      }
    },
    devtool: mode === 'development' ? 'eval-source-map' : 'source-map'
  };

  if (mode === 'development') {
    baseConfig.devServer = {
      port: options.port || 3000,
      hot: true,
      historyApiFallback: true,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      client: {
        overlay: {
          errors: true,
          warnings: false
        },
        progress: true
      },
      static: {
        directory: path.join(context, 'public')
      }
    };
  }

  return baseConfig;
}

function getEntry(type) {
  switch (type) {
    case 'shell':
    case 'remote':
      return './src/index';
    case 'api':
      return './src/index.js';
    default:
      throw new Error(`Unknown application type: ${type}`);
  }
}

function getFederationConfig(type, options) {
  const name = options.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const shared = {
    react: { 
      singleton: true,
      requiredVersion: '^18.2.0'
    },
    'react-dom': { 
      singleton: true,
      requiredVersion: '^18.2.0'
    }
  };

  if (type === 'shell') {
    return {
      name,
      remotes: options.remotes || {},
      shared
    };
  }

  if (type === 'remote') {
    return {
      name,
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App'
      },
      shared
    };
  }

  throw new Error(`Federation config not supported for type: ${type}`);
}

module.exports = { createConfiguration };