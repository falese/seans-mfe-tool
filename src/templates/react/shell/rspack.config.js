const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  context: __dirname,
  entry: {
    main: './src/index.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    publicPath: 'auto',
    clean: true,
  },
  mode: "development",
  target: "web",
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "ecmascript",
                jsx: true
              },
              transform: {
                react: {
                  runtime: "automatic"
                }
              }
            }
          }
        }
      }
    ]
  },
  resolve: {
    extensions: [".js", ".jsx", ".json"]
  },
  devServer: {
    port: '<%= port %>',
    host: 'localhost',
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath: '/'
    },
    devMiddleware: {
      publicPath: '/'
    }
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
      publicPath: '/'
    }),
    new ModuleFederationPlugin({
      name: "shell",
      filename: "remoteEntry.js",
      remotes: '<%= remotes %>' || {},
      shared: {
        react: { singleton: true, eager: true },
        "react-dom": { singleton: true, eager: true },
        "@mui/material": { singleton: true },
        "@mui/system": { singleton: true },
        "@emotion/react": { singleton: true },
        "@emotion/styled": { singleton: true }
      }
    })
  ],
  optimization: {
    moduleIds: 'named',
    chunkIds: 'named'
  }
};
