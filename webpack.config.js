const path              = require('path')
const webpack           = require('webpack')
const nodeExternals     = require('webpack-node-externals')

module.exports = {
  mode: 'production',
  target: 'node',
  externals: [nodeExternals()],
  entry: {
    app: './index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'npm'),
    filename: 'index.js',
  },
  module: {
    rules: [{
      test: /\.js$/,
      use: [{
        loader: 'shebang-loader'
      }]
    }],
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true
    })
  ]
}
