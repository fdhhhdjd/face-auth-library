const path = require('path');

module.exports = {
  entry: './face-auth.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'face-auth.min.js',
    library: 'FaceAuth',
    libraryTarget: 'umd',
    // XÓA DÒNG NÀY: libraryExport: 'default',
    globalObject: 'this'
  },
  mode: 'production'
};